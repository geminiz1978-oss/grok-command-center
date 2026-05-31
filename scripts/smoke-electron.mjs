import electronPath from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mainBundle = join(root, 'out', 'main', 'index.js');
const successMarker = 'GROK_COMMAND_CENTER_SMOKE_OK';
const layoutMode = process.argv.includes('--layout');

if (!existsSync(mainBundle)) {
  console.error('Built Electron output was not found. Run npm run build before npm run smoke:desktop.');
  process.exit(1);
}

const child = spawn(electronPath, ['.', '--grok-command-center-smoke'], {
  cwd: root,
  env: {
    ...process.env,
    GROK_COMMAND_CENTER_SMOKE: '1',
    ...(layoutMode ? { GROK_COMMAND_CENTER_LAYOUT_SMOKE: '1' } : {})
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

let output = '';
let settled = false;

const timeout = setTimeout(() => {
  fail('Timed out waiting for Electron smoke marker.');
}, 20000);

child.stdout.on('data', (chunk) => {
  const text = chunk.toString('utf8');
  output += text;
  process.stdout.write(text);

  if (text.includes(successMarker)) {
    pass();
  }
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString('utf8');
  output += text;
  process.stderr.write(text);
});

child.on('error', (error) => {
  fail(error.message);
});

child.on('close', (code) => {
  if (settled) {
    return;
  }

  fail(`Electron exited with code ${code ?? 'unknown'} before smoke marker.`);
});

function pass() {
  if (settled) {
    return;
  }

  settled = true;
  clearTimeout(timeout);
  setTimeout(() => {
    try {
      child.kill();
    } catch {
      // App normally exits itself after printing the marker.
    }
  }, 3000).unref();
}

function fail(message) {
  if (settled) {
    return;
  }

  settled = true;
  clearTimeout(timeout);

  try {
    child.kill();
  } catch {
    // Process may already be gone.
  }

  console.error(`\nElectron smoke failed: ${message}`);
  if (output.trim()) {
    console.error('\nCaptured output:');
    console.error(output.trim());
  }
  process.exit(1);
}
