import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsStore } from './settingsStore';
import { ImagineService } from './imagineService';
import type { ImagineGenerateRequest, ImagineRunEvent } from '../../shared/types';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l8yN5wAAAABJRU5ErkJggg==',
  'base64'
);
const VIDEO_BYTES = Buffer.from('fake mp4 bytes');

let tempDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  tempDirectories = [];
});

describe('ImagineService', () => {
  it('submits image generation with xAI Imagine fields and saves the returned asset', async () => {
    const workspacePath = await createTempDirectory('grok-imagine-workspace-');
    const fetchMock = mockFetch(async (url, init) => {
      expect(String(url)).toBe('https://api.x.ai/v1/images/generations');
      expect(readJsonBody(init)).toMatchObject({
        model: 'grok-imagine-image-quality',
        prompt: 'bronze cyber command center',
        n: 3,
        response_format: 'b64_json',
        resolution: '2k',
        aspect_ratio: '16:9'
      });
      expect(readJsonBody(init).size).toBeUndefined();

      return jsonResponse({ data: [{ b64_json: PNG_BYTES.toString('base64') }] });
    });
    const service = createService();

    const result = await service.generate({
      ...requestFor(workspacePath),
      prompt: 'bronze cyber command center',
      imageCount: 3,
      imageResolution: '2k',
      imageAspectRatio: '16:9'
    }, vi.fn());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].relativePath).toMatch(/^assets[\\/]imagine[\\/]/);
    expect(await readFile(result.assets[0].path)).toEqual(PNG_BYTES);
    expect(await service.list(workspacePath)).toHaveLength(1);
  });

  it('allows source images outside the workspace for edits', async () => {
    const workspacePath = await createTempDirectory('grok-imagine-workspace-');
    const sourceDirectory = await createTempDirectory('grok-imagine-source-');
    const sourcePath = join(sourceDirectory, 'reference.png');
    await writeFile(sourcePath, PNG_BYTES);

    mockFetch(async (url, init) => {
      expect(String(url)).toBe('https://api.x.ai/v1/images/edits');
      const body = readJsonBody(init);
      expect(body.image).toEqual({
        url: `data:image/png;base64,${PNG_BYTES.toString('base64')}`
      });
      expect(body.images).toBeUndefined();
      expect(body.resolution).toBe('1k');

      return jsonResponse({ data: [{ b64_json: PNG_BYTES.toString('base64') }] });
    });

    const result = await createService().generate({
      ...requestFor(workspacePath),
      mode: 'image-edit',
      sourcePaths: [sourcePath]
    }, vi.fn());

    expect(result.assets[0].sourcePaths).toEqual([sourcePath]);
    await expect(stat(result.assets[0].path)).resolves.toBeTruthy();
  });

  it('polls video generation and downloads completed media', async () => {
    const workspacePath = await createTempDirectory('grok-imagine-workspace-');
    const sourcePath = join(workspacePath, 'reference.webp');
    await writeFile(sourcePath, PNG_BYTES);
    const events: ImagineRunEvent[] = [];
    const fetchMock = mockFetch(async (url, init) => {
      const target = String(url);
      if (target.endsWith('/videos/generations')) {
        const body = readJsonBody(init);
        expect(body).toMatchObject({
          model: 'grok-imagine-video',
          prompt: 'make the badge glow',
          duration: 6,
          aspect_ratio: '16:9',
          resolution: '720p',
          image: {
            url: `data:image/webp;base64,${PNG_BYTES.toString('base64')}`
          }
        });
        return jsonResponse({ request_id: 'video_123' });
      }

      if (target.endsWith('/videos/video_123')) {
        return jsonResponse({ status: 'completed', data: { videoUrl: 'https://example.test/video.mp4' } });
      }

      if (target === 'https://example.test/video.mp4') {
        return new Response(VIDEO_BYTES);
      }

      throw new Error(`Unexpected request: ${target}`);
    });

    const result = await createService().generate({
      ...requestFor(workspacePath),
      mode: 'image-to-video',
      prompt: 'make the badge glow',
      sourcePaths: [sourcePath]
    }, (event) => events.push(event));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.requestId).toBe('video_123');
    expect(result.assets[0].kind).toBe('video');
    expect(await readFile(result.assets[0].path)).toEqual(VIDEO_BYTES);
    expect(events.map((event) => event.phase)).toContain('saved');
  });
});

function createService(): ImagineService {
  return new ImagineService({
    getApiKey: async () => 'xai-test-key'
  } as unknown as SettingsStore);
}

function requestFor(workspacePath: string): ImagineGenerateRequest {
  return {
    runId: crypto.randomUUID(),
    workspacePath,
    mode: 'image-generate',
    prompt: 'bronze cyber command center',
    outputFolder: 'assets/imagine',
    filenamePrefix: 'test-imagine',
    sourcePaths: [],
    imageCount: 1,
    imageAspectRatio: '1:1',
    imageResolution: '1k',
    videoAspectRatio: '16:9',
    videoDuration: 6,
    videoResolution: '720p'
  };
}

async function createTempDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

function mockFetch(handler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function readJsonBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') {
    throw new Error('Expected JSON request body.');
  }

  return JSON.parse(init.body) as Record<string, unknown>;
}
