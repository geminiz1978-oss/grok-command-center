import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { AttachmentInfo, AttachmentKind, ImportAttachmentsRequest } from '../../shared/types';

const MAX_TEXT_PREVIEW_BYTES = 12000;
const ATTACHMENT_ROOT = '.grok-command-center';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.log',
  '.md',
  '.mjs',
  '.py',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml'
]);

const MIME_BY_EXTENSION = new Map<string, string>([
  ['.aac', 'audio/aac'],
  ['.css', 'text/css'],
  ['.csv', 'text/csv'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.m4a', 'audio/mp4'],
  ['.md', 'text/markdown'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain'],
  ['.wav', 'audio/wav'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
  ['.zip', 'application/zip']
]);

export class AttachmentService {
  async importAttachments(request: ImportAttachmentsRequest): Promise<AttachmentInfo[]> {
    if (!request.workspacePath.trim()) {
      throw new Error('Open a workspace before attaching files.');
    }

    const sourcePaths = dedupePaths(request.sourcePaths);
    if (!sourcePaths.length) {
      return [];
    }

    const targetDirectory = join(
      request.workspacePath,
      ATTACHMENT_ROOT,
      'attachments',
      new Date().toISOString().replace(/[:.]/g, '-')
    );
    await mkdir(targetDirectory, { recursive: true });

    const attachments: AttachmentInfo[] = [];

    for (const sourcePath of sourcePaths) {
      const fileStat = await stat(sourcePath);
      if (!fileStat.isFile()) {
        continue;
      }

      const safeName = sanitizeFileName(basename(sourcePath));
      const targetPath = join(targetDirectory, `${attachments.length + 1}-${safeName}`);
      await copyFile(sourcePath, targetPath);

      const extension = extname(sourcePath).toLowerCase();
      const mimeType = MIME_BY_EXTENSION.get(extension) ?? 'application/octet-stream';
      const kind = inferKind(extension, mimeType);
      const textPreview = kind === 'text' ? await readTextPreview(targetPath) : undefined;

      attachments.push({
        id: crypto.randomUUID(),
        name: safeName,
        path: targetPath,
        originalPath: sourcePath,
        kind,
        mimeType,
        size: fileStat.size,
        ...(textPreview ? { textPreview } : {})
      });
    }

    return attachments;
  }
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const path of paths) {
    const trimmed = path.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(trimmed);
  }

  return deduped;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 140) || 'attachment';
}

function inferKind(extension: string, mimeType: string): AttachmentKind {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  if (mimeType === 'application/pdf') {
    return 'pdf';
  }

  if (mimeType.includes('zip') || ['.7z', '.rar', '.tar', '.gz'].includes(extension)) {
    return 'archive';
  }

  if (mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
    return 'text';
  }

  return 'other';
}

async function readTextPreview(filePath: string): Promise<string | undefined> {
  const buffer = await readFile(filePath);
  const preview = buffer.subarray(0, MAX_TEXT_PREVIEW_BYTES).toString('utf8').trim();
  return preview || undefined;
}
