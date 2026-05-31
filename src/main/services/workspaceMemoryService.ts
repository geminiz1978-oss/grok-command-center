import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { SaveWorkspaceMemoryRequest, WorkspaceMemoryInfo } from '../../shared/types';

const WORKSHOP_DIR = '.grok-command-center';
const MEMORY_FILE = 'MEMORY.md';
const MAX_PROMPT_MEMORY_CHARS = 12000;

const DEFAULT_MEMORY_TEMPLATE = `# Grok Command Center Memory

## Project Rules
- 

## Common Commands
- 

## Notes
- 
`;

export class WorkspaceMemoryService {
  async get(workspacePath: string): Promise<WorkspaceMemoryInfo> {
    const memoryPath = resolveMemoryPath(workspacePath);

    try {
      const [content, fileStat] = await Promise.all([readFile(memoryPath, 'utf8'), stat(memoryPath)]);
      return {
        path: memoryPath,
        content,
        exists: true,
        updatedAt: fileStat.mtime.toISOString()
      };
    } catch {
      return {
        path: memoryPath,
        content: DEFAULT_MEMORY_TEMPLATE,
        exists: false
      };
    }
  }

  async save(request: SaveWorkspaceMemoryRequest): Promise<WorkspaceMemoryInfo> {
    const memoryPath = resolveMemoryPath(request.workspacePath);
    await mkdir(dirname(memoryPath), { recursive: true });
    await writeFile(memoryPath, ensureTrailingNewline(request.content), 'utf8');
    return this.get(request.workspacePath);
  }

  async readForPrompt(workspacePath: string): Promise<string> {
    const memory = await this.get(workspacePath);

    if (!memory.exists) {
      return '';
    }

    const content = memory.content.trim();
    return content.length > MAX_PROMPT_MEMORY_CHARS ? `${content.slice(0, MAX_PROMPT_MEMORY_CHARS)}\n[Memory clipped]` : content;
  }
}

function resolveMemoryPath(workspacePath: string): string {
  return join(resolve(workspacePath), WORKSHOP_DIR, MEMORY_FILE);
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}
