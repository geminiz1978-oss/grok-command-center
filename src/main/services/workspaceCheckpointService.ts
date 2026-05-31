import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type {
  RestoreWorkspaceCheckpointRequest,
  RestoreWorkspaceCheckpointResult,
  WorkspaceCheckpointInfo
} from '../../shared/types';
import { shouldIgnore } from './fileTreeService';

interface CheckpointManifest {
  checkpoint: WorkspaceCheckpointInfo;
  files: CheckpointFile[];
}

interface CheckpointFile {
  relativePath: string;
  size: number;
}

const WORKSHOP_DIR = '.grok-command-center';
const CHECKPOINTS_DIR = 'checkpoints';
const SNAPSHOT_DIR = 'snapshot';
const MANIFEST_FILE = 'manifest.json';
const MAX_DEPTH = 10;
const MAX_FILES = 650;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;

export class WorkspaceCheckpointService {
  async create(workspacePath: string, label: string): Promise<WorkspaceCheckpointInfo> {
    const rootPath = resolve(workspacePath);
    const checkpointId = createCheckpointId();
    const checkpointRoot = getCheckpointRoot(rootPath, checkpointId);
    const snapshotRoot = join(checkpointRoot, SNAPSHOT_DIR);
    const state = {
      files: [] as CheckpointFile[],
      totalBytes: 0
    };

    await mkdir(snapshotRoot, { recursive: true });
    await copyDirectory(rootPath, rootPath, snapshotRoot, 0, state);

    const checkpoint: WorkspaceCheckpointInfo = {
      id: checkpointId,
      label,
      createdAt: new Date().toISOString(),
      fileCount: state.files.length,
      totalBytes: state.totalBytes
    };

    await writeManifest(checkpointRoot, {
      checkpoint,
      files: state.files
    });

    return checkpoint;
  }

  async list(workspacePath: string): Promise<WorkspaceCheckpointInfo[]> {
    const checkpointsPath = getCheckpointsPath(resolve(workspacePath));
    let entries;

    try {
      entries = await readdir(checkpointsPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const checkpoints = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            return (await readManifest(join(checkpointsPath, entry.name))).checkpoint;
          } catch {
            return undefined;
          }
        })
    );

    return checkpoints
      .filter((checkpoint): checkpoint is WorkspaceCheckpointInfo => Boolean(checkpoint))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restore(request: RestoreWorkspaceCheckpointRequest): Promise<RestoreWorkspaceCheckpointResult> {
    const rootPath = resolve(request.workspacePath);
    const checkpointRoot = getCheckpointRoot(rootPath, request.checkpointId);
    const manifest = await readManifest(checkpointRoot);
    const snapshotRoot = join(checkpointRoot, SNAPSHOT_DIR);
    let restoredFiles = 0;

    for (const file of manifest.files) {
      const targetPath = resolveInsideWorkspace(rootPath, file.relativePath);
      const sourcePath = join(snapshotRoot, file.relativePath);
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      restoredFiles += 1;
    }

    return {
      checkpoint: manifest.checkpoint,
      restoredFiles
    };
  }
}

async function copyDirectory(
  rootPath: string,
  directoryPath: string,
  snapshotRoot: string,
  depth: number,
  state: { files: CheckpointFile[]; totalBytes: number }
): Promise<void> {
  if (depth > MAX_DEPTH || state.files.length >= MAX_FILES || state.totalBytes >= MAX_TOTAL_BYTES) {
    return;
  }

  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (state.files.length >= MAX_FILES || state.totalBytes >= MAX_TOTAL_BYTES || shouldIgnore(entry.name)) {
      continue;
    }

    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(rootPath, entryPath, snapshotRoot, depth + 1, state);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(entryPath);
    if (fileStat.size > MAX_FILE_BYTES || state.totalBytes + fileStat.size > MAX_TOTAL_BYTES) {
      continue;
    }

    const relativePath = toWorkspaceRelativePath(rootPath, entryPath);
    const targetPath = join(snapshotRoot, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(entryPath, targetPath);

    state.files.push({
      relativePath,
      size: fileStat.size
    });
    state.totalBytes += fileStat.size;
  }
}

async function readManifest(checkpointRoot: string): Promise<CheckpointManifest> {
  const content = await readFile(join(checkpointRoot, MANIFEST_FILE), 'utf8');
  return JSON.parse(content) as CheckpointManifest;
}

async function writeManifest(checkpointRoot: string, manifest: CheckpointManifest): Promise<void> {
  await mkdir(checkpointRoot, { recursive: true });
  await writeFile(join(checkpointRoot, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function getCheckpointsPath(rootPath: string): string {
  return join(rootPath, WORKSHOP_DIR, CHECKPOINTS_DIR);
}

function getCheckpointRoot(rootPath: string, checkpointId: string): string {
  if (basename(checkpointId) !== checkpointId || checkpointId.includes('..')) {
    throw new Error('Invalid checkpoint id.');
  }

  return join(getCheckpointsPath(rootPath), checkpointId);
}

function createCheckpointId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${timestamp}-${crypto.randomUUID().slice(0, 8)}`;
}

function resolveInsideWorkspace(rootPath: string, relativePath: string): string {
  const targetPath = resolve(rootPath, relativePath);
  const targetRelativePath = relative(rootPath, targetPath);

  if (
    targetRelativePath.startsWith('..') ||
    targetRelativePath === '..' ||
    targetRelativePath.includes(`..\\`) ||
    targetRelativePath.includes('../')
  ) {
    throw new Error('Checkpoint contains a path outside the workspace.');
  }

  return targetPath;
}

function toWorkspaceRelativePath(workspacePath: string, filePath: string): string {
  return relative(resolve(workspacePath), resolve(filePath)).replace(/\\/g, '/');
}
