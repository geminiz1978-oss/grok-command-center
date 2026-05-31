import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { detectPreviewCommand, parseCommandLine } from './previewServerService';

let tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  tempDirectories = [];
});

async function createWorkspace(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'grok-command-center-preview-'));
  tempDirectories.push(directory);
  return directory;
}

describe('detectPreviewCommand', () => {
  it('uses the built-in static server for simple browser projects', async () => {
    const workspacePath = await createWorkspace();

    expect(detectPreviewCommand(workspacePath)).toBe('grok-command-center-static');
  });

  it('prefers npm dev when a workspace provides it', async () => {
    const workspacePath = await createWorkspace();
    await writeFile(
      join(workspacePath, 'package.json'),
      JSON.stringify({ scripts: { start: 'vite --host 127.0.0.1', dev: 'vite' } }),
      'utf8'
    );

    expect(detectPreviewCommand(workspacePath)).toBe('npm run dev');
  });

  it('falls back to npm start when no dev script exists', async () => {
    const workspacePath = await createWorkspace();
    await writeFile(join(workspacePath, 'package.json'), JSON.stringify({ scripts: { start: 'vite' } }), 'utf8');

    expect(detectPreviewCommand(workspacePath)).toBe('npm start');
  });
});

describe('parseCommandLine', () => {
  it('keeps quoted executable and argument paths together', () => {
    expect(parseCommandLine('"C:\\Program Files\\nodejs\\node.exe" "scripts\\dev server.js" --flag')).toEqual([
      'C:\\Program Files\\nodejs\\node.exe',
      'scripts\\dev server.js',
      '--flag'
    ]);
  });
});
