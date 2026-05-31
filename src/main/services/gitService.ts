import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitDiffFile, GitFileStatus } from '../../shared/types';

const MAX_UNTRACKED_PREVIEW_BYTES = 60000;

export class GitService {
  async status(workspacePath: string): Promise<GitFileStatus[]> {
    const output = await runGitStatus(workspacePath);
    return output
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => ({
        code: line.slice(0, 2).trim() || '??',
        path: line.slice(3)
      }));
  }

  async diff(workspacePath: string): Promise<GitDiffFile[]> {
    const status = await this.status(workspacePath);
    const diffs = await Promise.all(status.map((file) => readFileDiff(workspacePath, file)));
    return diffs.filter((file) => file.diff.trim() || file.isBinary);
  }
}

async function readFileDiff(workspacePath: string, file: GitFileStatus): Promise<GitDiffFile> {
  if (file.code === '??') {
    return readUntrackedDiff(workspacePath, file);
  }

  const unstaged = await runGit(workspacePath, ['diff', '--', file.path]);
  const staged = await runGit(workspacePath, ['diff', '--cached', '--', file.path]);
  const diff = [unstaged, staged].filter(Boolean).join('\n');

  return {
    ...file,
    diff,
    isBinary: /Binary files .* differ/i.test(diff)
  };
}

async function readUntrackedDiff(workspacePath: string, file: GitFileStatus): Promise<GitDiffFile> {
  try {
    const contents = await readFile(join(workspacePath, file.path));
    const preview = contents.subarray(0, MAX_UNTRACKED_PREVIEW_BYTES).toString('utf8');
    const truncated = contents.length > MAX_UNTRACKED_PREVIEW_BYTES;
    const lines = preview.split(/\r?\n/).map((line) => `+${line}`);

    return {
      ...file,
      diff: [`diff --git a/${file.path} b/${file.path}`, 'new file mode 100644', `--- /dev/null`, `+++ b/${file.path}`, ...lines, truncated ? '+[file truncated in Grok Command Center preview]' : ''].join('\n'),
      isBinary: preview.includes('\u0000')
    };
  } catch {
    return {
      ...file,
      diff: `diff --git a/${file.path} b/${file.path}\n[Could not read untracked file]`,
      isBinary: false
    };
  }
}

function runGitStatus(cwd: string): Promise<string> {
  return runGit(cwd, ['status', '--short']);
}

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      windowsHide: true
    });

    let output = '';

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });

    child.on('error', () => resolve(''));
    child.on('close', (code) => resolve(code === 0 ? output : ''));
  });
}
