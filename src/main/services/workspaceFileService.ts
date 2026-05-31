import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import type {
  SaveWorkspaceFileRequest,
  WorkspaceFileContent,
  WorkspaceFileRequest,
  WorkspaceSearchRequest,
  WorkspaceSearchResult
} from '../../shared/types';
import { shouldIgnore } from './fileTreeService';

const MAX_EDITABLE_BYTES = 1024 * 1024;
const MAX_SEARCH_FILE_BYTES = 512 * 1024;
const MAX_SEARCH_RESULTS = 80;
const MAX_SEARCH_DEPTH = 8;
const MAX_SEARCH_FILES = 1800;

export class WorkspaceFileService {
  async read(request: WorkspaceFileRequest): Promise<WorkspaceFileContent> {
    const filePath = resolveInsideWorkspace(request.workspacePath, request.filePath);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      throw new Error('Grok Command Center can only open files in the editor.');
    }

    const buffer = await readFile(filePath);
    const isBinary = looksBinary(buffer);
    const isTooLarge = buffer.byteLength > MAX_EDITABLE_BYTES;
    const content = isBinary ? '' : buffer.toString('utf8', 0, isTooLarge ? MAX_EDITABLE_BYTES : buffer.byteLength);

    return {
      path: filePath,
      name: basename(filePath),
      relativePath: toWorkspaceRelativePath(request.workspacePath, filePath),
      content,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      isBinary,
      isTooLarge,
      language: languageForPath(filePath)
    };
  }

  async save(request: SaveWorkspaceFileRequest): Promise<WorkspaceFileContent> {
    const filePath = resolveInsideWorkspace(request.workspacePath, request.filePath);
    const existing = await this.read({
      workspacePath: request.workspacePath,
      filePath
    });

    if (existing.isBinary) {
      throw new Error('Binary files cannot be edited in Grok Command Center yet.');
    }

    if (Buffer.byteLength(request.content, 'utf8') > MAX_EDITABLE_BYTES) {
      throw new Error('This file is too large for the built-in editor.');
    }

    await writeFile(filePath, request.content, 'utf8');
    return this.read({
      workspacePath: request.workspacePath,
      filePath
    });
  }

  resolveFilePath(request: WorkspaceFileRequest): string {
    return resolveInsideWorkspace(request.workspacePath, request.filePath);
  }

  async search(request: WorkspaceSearchRequest): Promise<WorkspaceSearchResult[]> {
    const query = request.query.trim();

    if (!query) {
      return [];
    }

    const rootPath = resolve(request.workspacePath);
    const state = {
      filesSeen: 0,
      results: [] as WorkspaceSearchResult[]
    };

    await searchDirectory(rootPath, rootPath, query.toLowerCase(), request.maxResults ?? MAX_SEARCH_RESULTS, 0, state);
    return state.results;
  }
}

async function searchDirectory(
  rootPath: string,
  directoryPath: string,
  query: string,
  maxResults: number,
  depth: number,
  state: { filesSeen: number; results: WorkspaceSearchResult[] }
): Promise<void> {
  if (depth > MAX_SEARCH_DEPTH || state.filesSeen > MAX_SEARCH_FILES || state.results.length >= maxResults) {
    return;
  }

  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (state.results.length >= maxResults || state.filesSeen > MAX_SEARCH_FILES || shouldIgnore(entry.name)) {
      continue;
    }

    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await searchDirectory(rootPath, entryPath, query, maxResults, depth + 1, state);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    state.filesSeen += 1;
    const relativePath = toWorkspaceRelativePath(rootPath, entryPath);
    const lowerRelativePath = relativePath.toLowerCase();

    if (lowerRelativePath.includes(query)) {
      state.results.push({
        path: entryPath,
        name: entry.name,
        relativePath,
        matchKind: 'name'
      });

      continue;
    }

    if (state.results.length >= maxResults) {
      break;
    }

    const contentMatch = await findContentMatch(entryPath, query);
    if (contentMatch) {
      state.results.push({
        path: entryPath,
        name: entry.name,
        relativePath,
        matchKind: 'content',
        ...contentMatch
      });
    }
  }
}

async function findContentMatch(filePath: string, query: string): Promise<{ lineNumber: number; preview: string } | undefined> {
  let fileStat;

  try {
    fileStat = await stat(filePath);
  } catch {
    return undefined;
  }

  if (fileStat.size > MAX_SEARCH_FILE_BYTES) {
    return undefined;
  }

  let buffer;

  try {
    buffer = await readFile(filePath);
  } catch {
    return undefined;
  }
  if (looksBinary(buffer)) {
    return undefined;
  }

  const lines = buffer.toString('utf8').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.toLowerCase().includes(query)) {
      return {
        lineNumber: index + 1,
        preview: line.trim().slice(0, 220)
      };
    }
  }

  return undefined;
}

function resolveInsideWorkspace(workspacePath: string, filePath: string): string {
  const rootPath = resolve(workspacePath);
  const resolvedPath = resolve(filePath);
  const relativePath = relative(rootPath, resolvedPath);

  if (relativePath.startsWith('..') || relativePath === '..' || relativePath.includes(`..\\`) || relativePath.includes('../')) {
    throw new Error('File is outside the active workspace.');
  }

  return resolvedPath;
}

function toWorkspaceRelativePath(workspacePath: string, filePath: string): string {
  return relative(resolve(workspacePath), resolve(filePath)).replace(/\\/g, '/');
}

function looksBinary(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.byteLength, 8000);

  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }

  return false;
}

function languageForPath(filePath: string): string {
  const extension = extname(filePath).toLowerCase();

  switch (extension) {
    case '.css':
      return 'CSS';
    case '.html':
      return 'HTML';
    case '.js':
    case '.jsx':
      return 'JavaScript';
    case '.json':
      return 'JSON';
    case '.md':
      return 'Markdown';
    case '.py':
      return 'Python';
    case '.ts':
    case '.tsx':
      return 'TypeScript';
    case '.txt':
      return 'Text';
    case '.xml':
      return 'XML';
    case '.yml':
    case '.yaml':
      return 'YAML';
    default:
      return extension ? extension.slice(1).toUpperCase() : 'Text';
  }
}
