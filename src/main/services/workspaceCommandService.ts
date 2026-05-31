import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkspaceCheck, WorkspaceCommandRequest, WorkspaceCommandResult } from '../../shared/types';

const MAX_OUTPUT_CHARS = 80000;
const COMMAND_TIMEOUT_MS = 120000;
const CHECK_ORDER = ['typecheck', 'test', 'lint', 'build'];

export class WorkspaceCommandService {
  async detectChecks(workspacePath: string): Promise<WorkspaceCheck[]> {
    const packageJsonPath = join(workspacePath, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return [
        {
          id: 'static-smoke',
          label: 'Static smoke',
          command: process.platform === 'win32' ? 'dir' : 'ls'
        }
      ];
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    return CHECK_ORDER.filter((script) => scripts[script]).map((script) => ({
      id: script,
      label: labelForScript(script),
      command: `npm run ${script}`
    }));
  }

  async run(request: WorkspaceCommandRequest): Promise<WorkspaceCommandResult> {
    const startedAt = performance.now();
    const result = await runCommand(request.workspacePath, request.command);

    return {
      command: request.command,
      exitCode: result.exitCode,
      ok: result.exitCode === 0,
      durationMs: Math.round(performance.now() - startedAt),
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
}

function labelForScript(script: string): string {
  if (script === 'typecheck') {
    return 'Typecheck';
  }

  return script.slice(0, 1).toUpperCase() + script.slice(1);
}

function runCommand(cwd: string, command: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        BROWSER: 'none'
      }
    });
    let stdout = '';
    let stderr = '';
    const timeout = windowlessTimeout(() => {
      child.kill();
      stderr += '\nCommand timed out in Grok Command Center.';
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk.toString('utf8'));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk.toString('utf8'));
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        exitCode: null,
        stdout,
        stderr: appendOutput(stderr, error.message)
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code,
        stdout,
        stderr
      });
    });
  });
}

function appendOutput(current: string, next: string): string {
  const output = `${current}${next}`;
  return output.length > MAX_OUTPUT_CHARS ? output.slice(output.length - MAX_OUTPUT_CHARS) : output;
}

function windowlessTimeout(callback: () => void, timeoutMs: number): NodeJS.Timeout {
  return setTimeout(callback, timeoutMs);
}
