import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { SettingsStore } from './settingsStore';
import type {
  ImagineAsset,
  ImagineGenerateRequest,
  ImagineGenerateResult,
  ImagineMode,
  ImagineRunEvent
} from '../../shared/types';

const XAI_BASE_URL = 'https://api.x.ai/v1';
const IMAGE_MODEL = 'grok-imagine-image-quality';
const VIDEO_MODEL = 'grok-imagine-video';
const GALLERY_INDEX_PATH = join('.grok-command-center', 'imagine-gallery.json');
const VIDEO_POLL_INTERVAL_MS = 3500;
const VIDEO_POLL_TIMEOUT_MS = 8 * 60 * 1000;
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

type EmitImagineEvent = (event: ImagineRunEvent) => void;

interface XaiImageResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    image?: string;
  }>;
}

interface XaiVideoGenerationResponse {
  request_id?: string;
  id?: string;
}

interface XaiVideoStatusResponse {
  status?: string;
  progress?: number;
  video?: {
    url?: string;
    duration?: number;
  };
  url?: string;
  video_url?: string;
  videoUrl?: string;
  output_url?: string;
  outputUrl?: string;
  data?: {
    url?: string;
    video_url?: string;
    videoUrl?: string;
    output_url?: string;
    outputUrl?: string;
  };
  error?: {
    message?: string;
  };
}

interface XaiSourceMedia {
  url: string;
}

export class ImagineService {
  constructor(private readonly settingsStore: SettingsStore) {}

  async generate(request: ImagineGenerateRequest, emit: EmitImagineEvent): Promise<ImagineGenerateResult> {
    const apiKey = await this.settingsStore.getApiKey('xai');

    if (!apiKey) {
      throw new Error('Missing xAI API key. Save the key before using Imagine.');
    }

    validateImagineRequest(request);
    const workspacePath = resolve(request.workspacePath);
    const outputDirectory = resolveWorkspacePath(workspacePath, request.outputFolder || 'assets/imagine');
    const sourcePaths = request.sourcePaths.map((sourcePath) => resolveSourcePath(workspacePath, sourcePath));

    emitImagine(emit, request.runId, 'submitted', `Submitting ${labelForMode(request.mode)} request.`);

    if (request.mode === 'image-generate' || request.mode === 'image-edit') {
      const assets = await this.generateImages(apiKey, request, outputDirectory, sourcePaths, emit);
      await this.addAssetsToGallery(workspacePath, assets);
      return {
        runId: request.runId,
        assets
      };
    }

    const result = await this.generateVideo(apiKey, request, outputDirectory, sourcePaths, emit);
    await this.addAssetsToGallery(workspacePath, result.assets);
    return result;
  }

  async list(workspacePath: string, limit = 48): Promise<ImagineAsset[]> {
    const gallery = await this.readGallery(resolve(workspacePath));
    return gallery
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }

  private async generateImages(
    apiKey: string,
    request: ImagineGenerateRequest,
    outputDirectory: string,
    sourcePaths: string[],
    emit: EmitImagineEvent
  ): Promise<ImagineAsset[]> {
    const body: Record<string, unknown> = {
      model: IMAGE_MODEL,
      prompt: request.prompt,
      n: Math.max(1, Math.min(request.imageCount, 4)),
      response_format: 'b64_json'
    };

    if (request.mode === 'image-generate') {
      body.resolution = request.imageResolution;
      body.aspect_ratio = request.imageAspectRatio;
    } else {
      const images = await Promise.all(sourcePaths.map((sourcePath) => fileToSourceMedia(sourcePath)));
      if (images.length === 1) {
        body.image = images[0];
      } else {
        body.images = images;
      }
      body.resolution = request.imageResolution;
    }

    const response = await postJson<XaiImageResponse>(`${XAI_BASE_URL}/images/${request.mode === 'image-edit' ? 'edits' : 'generations'}`, apiKey, body);
    const outputs = response.data ?? [];

    if (!outputs.length) {
      throw new Error('xAI did not return any image outputs.');
    }

    emitImagine(emit, request.runId, 'downloading', `Saving ${outputs.length} image${outputs.length === 1 ? '' : 's'} into the workspace.`);
    await mkdir(outputDirectory, { recursive: true });

    const assets: ImagineAsset[] = [];
    for (const [index, output] of outputs.entries()) {
      const bytes = await readImageOutput(output);
      const fileName = `${formatAssetBaseName(request.filenamePrefix, index, outputs.length)}.png`;
      const filePath = join(outputDirectory, fileName);
      await writeFile(filePath, bytes);
      assets.push(await createAssetRecord(request, filePath, 'image', 'image/png', IMAGE_MODEL, sourcePaths));
    }

    emitImagine(emit, request.runId, 'saved', `Saved ${assets.length} image${assets.length === 1 ? '' : 's'}.`);
    return assets;
  }

  private async generateVideo(
    apiKey: string,
    request: ImagineGenerateRequest,
    outputDirectory: string,
    sourcePaths: string[],
    emit: EmitImagineEvent
  ): Promise<ImagineGenerateResult> {
    const body: Record<string, unknown> = {
      model: VIDEO_MODEL,
      prompt: request.prompt,
      duration: request.videoDuration,
      aspect_ratio: request.videoAspectRatio,
      resolution: request.videoResolution
    };

    if (request.mode === 'image-to-video') {
      body.image = await fileToSourceMedia(sourcePaths[0]);
    }

    if (request.mode === 'reference-to-video') {
      body.reference_images = await Promise.all(sourcePaths.map((sourcePath) => fileToSourceMedia(sourcePath)));
    }

    const submission = await postJson<XaiVideoGenerationResponse>(`${XAI_BASE_URL}/videos/generations`, apiKey, body);
    const requestId = submission.request_id ?? submission.id;

    if (!requestId) {
      throw new Error('xAI did not return a video request id.');
    }

    emitImagine(emit, request.runId, 'polling', 'Video request accepted. Waiting for render.', requestId);
    const status = await this.pollVideo(apiKey, request.runId, requestId, emit);
    const videoUrl = status.video?.url
      ?? status.url
      ?? status.video_url
      ?? status.videoUrl
      ?? status.output_url
      ?? status.outputUrl
      ?? status.data?.url
      ?? status.data?.video_url
      ?? status.data?.videoUrl
      ?? status.data?.output_url
      ?? status.data?.outputUrl;

    if (!videoUrl) {
      throw new Error('xAI marked the video complete but did not return a downloadable URL.');
    }

    emitImagine(emit, request.runId, 'downloading', 'Downloading video into the workspace.', requestId);
    await mkdir(outputDirectory, { recursive: true });
    const bytes = await downloadUrl(videoUrl);
    const filePath = join(outputDirectory, `${formatAssetBaseName(request.filenamePrefix, 0, 1)}.mp4`);
    await writeFile(filePath, bytes);
    const asset = await createAssetRecord(request, filePath, 'video', 'video/mp4', VIDEO_MODEL, sourcePaths, requestId);

    emitImagine(emit, request.runId, 'saved', 'Saved video into the workspace.', requestId);
    return {
      runId: request.runId,
      requestId,
      assets: [asset]
    };
  }

  private async pollVideo(
    apiKey: string,
    runId: string,
    requestId: string,
    emit: EmitImagineEvent
  ): Promise<XaiVideoStatusResponse> {
    const startedAt = Date.now();
    let lastStatus = '';

    while (Date.now() - startedAt < VIDEO_POLL_TIMEOUT_MS) {
      const status = await getJson<XaiVideoStatusResponse>(`${XAI_BASE_URL}/videos/${encodeURIComponent(requestId)}`, apiKey);
      const state = (status.status ?? '').toLowerCase();
      const progress = typeof status.progress === 'number' ? ` (${Math.round(status.progress)}%)` : '';

      if (state && state !== lastStatus) {
        lastStatus = state;
        emitImagine(emit, runId, 'polling', `Video status: ${state}${progress}.`, requestId);
      }

      if (state === 'done' || state === 'completed' || state === 'succeeded' || state === 'ready') {
        return status;
      }

      if (state === 'failed' || state === 'expired' || state === 'cancelled' || state === 'canceled' || state === 'error') {
        throw new Error(status.error?.message ?? `Video generation failed with status: ${state || 'unknown'}.`);
      }

      await delay(VIDEO_POLL_INTERVAL_MS);
    }

    throw new Error('Video generation timed out before xAI returned a completed result.');
  }

  private async addAssetsToGallery(workspacePath: string, assets: ImagineAsset[]): Promise<void> {
    const current = await this.readGallery(workspacePath);
    const merged = [...assets, ...current.filter((asset) => !assets.some((nextAsset) => nextAsset.path === asset.path))].slice(0, 200);
    await writeJson(join(workspacePath, GALLERY_INDEX_PATH), merged);
  }

  private async readGallery(workspacePath: string): Promise<ImagineAsset[]> {
    try {
      const value = JSON.parse(await readFile(join(workspacePath, GALLERY_INDEX_PATH), 'utf8')) as unknown;
      if (!Array.isArray(value)) {
        return [];
      }
      return value.filter(isImagineAsset);
    } catch {
      return [];
    }
  }
}

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  return parseJsonResponse<T>(response);
}

async function getJson<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  return parseJsonResponse<T>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let value: Record<string, unknown> = {};

  try {
    value = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    if (response.ok) {
      throw new Error('xAI Imagine returned a non-JSON response.');
    }
    throw new Error(`xAI Imagine request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    const message = readApiErrorMessage(value) ?? `${response.status} ${response.statusText}`;
    throw new Error(`xAI Imagine request failed: ${message}`);
  }

  return value as T;
}

async function downloadUrl(url: string | undefined): Promise<Buffer> {
  if (!url) {
    throw new Error('xAI returned an empty media URL.');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download generated media: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function readImageOutput(output: { b64_json?: string; url?: string; image?: string }): Promise<Buffer> {
  if (output.b64_json) {
    return Buffer.from(output.b64_json, 'base64');
  }

  if (output.image?.startsWith('data:')) {
    return decodeDataUrl(output.image);
  }

  return downloadUrl(output.url ?? output.image);
}

async function fileToSourceMedia(filePath: string): Promise<XaiSourceMedia> {
  return {
    url: await fileToDataUrl(filePath)
  };
}

async function fileToDataUrl(filePath: string): Promise<string> {
  const extension = extname(filePath).toLowerCase();
  const mimeType = IMAGE_MIME_TYPES[extension];

  if (!mimeType) {
    throw new Error(`Source file must be PNG, JPG, JPEG, or WEBP: ${basename(filePath)}`);
  }

  const bytes = await readFile(filePath);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function decodeDataUrl(value: string): Buffer {
  const match = /^data:[^;]+;base64,(.+)$/i.exec(value);
  if (!match) {
    throw new Error('xAI returned an unreadable image data URL.');
  }

  return Buffer.from(match[1], 'base64');
}

async function createAssetRecord(
  request: ImagineGenerateRequest,
  filePath: string,
  kind: 'image' | 'video',
  mimeType: string,
  model: string,
  sourcePaths: string[],
  requestId?: string
): Promise<ImagineAsset> {
  const fileStat = await stat(filePath);

  return {
    id: crypto.randomUUID(),
    kind,
    mode: request.mode,
    prompt: request.prompt,
    model,
    path: filePath,
    relativePath: relative(resolve(request.workspacePath), filePath),
    name: basename(filePath),
    mimeType,
    size: fileStat.size,
    createdAt: new Date().toISOString(),
    ...(requestId ? { requestId } : {}),
    ...(sourcePaths.length ? { sourcePaths } : {})
  };
}

function resolveWorkspacePath(workspacePath: string, value: string): string {
  const normalized = value.trim() || '.';
  const target = resolve(workspacePath, normalized);
  const relation = relative(workspacePath, target);

  if (relation.startsWith('..') || isAbsolute(relation)) {
    throw new Error('Imagine paths must stay inside the open workspace.');
  }

  return target;
}

function resolveSourcePath(workspacePath: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Source image path is empty.');
  }

  return isAbsolute(normalized) ? resolve(normalized) : resolve(workspacePath, normalized);
}

function validateImagineRequest(request: ImagineGenerateRequest): void {
  if (!request.workspacePath.trim()) {
    throw new Error('Open a workspace before using Imagine.');
  }

  if (!request.prompt.trim()) {
    throw new Error('Write an Imagine prompt first.');
  }

  if ((request.mode === 'image-edit' || request.mode === 'image-to-video') && request.sourcePaths.length < 1) {
    throw new Error(`${labelForMode(request.mode)} needs one source image.`);
  }

  if (request.mode === 'reference-to-video' && request.sourcePaths.length < 1) {
    throw new Error('Reference video generation needs at least one reference image.');
  }

  if (request.mode !== 'image-edit' && request.sourcePaths.length > 7) {
    throw new Error('Use at most 7 reference images.');
  }

  if (request.mode === 'image-edit' && request.sourcePaths.length > 3) {
    throw new Error('Use at most 3 source images for image editing.');
  }
}

function formatAssetBaseName(prefix: string, index: number, count: number): string {
  const cleanPrefix = slugify(prefix) || 'grok-imagine';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const suffix = count > 1 ? `-${String(index + 1).padStart(2, '0')}` : '';
  return `${cleanPrefix}-${stamp}${suffix}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isImagineAsset(value: unknown): value is ImagineAsset {
  const record = value as Partial<ImagineAsset>;
  return Boolean(record && typeof record.path === 'string' && typeof record.relativePath === 'string' && typeof record.createdAt === 'string');
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function emitImagine(
  emit: EmitImagineEvent,
  runId: string,
  phase: ImagineRunEvent['phase'],
  message: string,
  requestId?: string
): void {
  emit({
    runId,
    phase,
    message,
    createdAt: new Date().toISOString(),
    ...(requestId ? { requestId } : {})
  });
}

function readApiErrorMessage(value: Record<string, unknown>): string | undefined {
  const error = value.error;
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  if (typeof value.message === 'string') {
    return value.message;
  }

  return undefined;
}

function labelForMode(mode: ImagineMode): string {
  switch (mode) {
    case 'image-generate':
      return 'image generation';
    case 'image-edit':
      return 'image edit';
    case 'video-generate':
      return 'video generation';
    case 'image-to-video':
      return 'image-to-video';
    case 'reference-to-video':
      return 'reference-to-video';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
