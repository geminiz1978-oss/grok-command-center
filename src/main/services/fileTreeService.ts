import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileTreeNode } from '../../shared/types';

const IGNORED_NAMES = new Set([
  '.git',
  '.grok-command-center',
  '.next',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out'
]);

const MAX_DEPTH = 8;
const MAX_NODES = 1500;

export class FileTreeService {
  async load(rootPath: string): Promise<FileTreeNode[]> {
    const counter = { value: 0 };
    return this.readDirectory(rootPath, 0, counter);
  }

  private async readDirectory(
    directoryPath: string,
    depth: number,
    counter: { value: number }
  ): Promise<FileTreeNode[]> {
    if (depth > MAX_DEPTH || counter.value > MAX_NODES) {
      return [];
    }

    const entries = await readdir(directoryPath, { withFileTypes: true });
    const visibleEntries = entries
      .filter((entry) => !shouldIgnore(entry.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    const nodes: FileTreeNode[] = [];

    for (const entry of visibleEntries) {
      counter.value += 1;
      if (counter.value > MAX_NODES) {
        break;
      }

      const fullPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          kind: 'directory',
          children: await this.readDirectory(fullPath, depth + 1, counter)
        });
      } else {
        nodes.push({
          name: entry.name,
          path: fullPath,
          kind: 'file'
        });
      }
    }

    return nodes;
  }
}

export function shouldIgnore(name: string): boolean {
  return IGNORED_NAMES.has(name) || name.endsWith('.log');
}
