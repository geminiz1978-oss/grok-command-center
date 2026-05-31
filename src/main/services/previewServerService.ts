import type { BrowserWindow } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import type { PreviewEvent, PreviewInfo, PreviewStartRequest } from '../../shared/types';

type PreviewSession = ProcessPreviewSession | StaticPreviewSession;

interface ProcessPreviewSession {
  kind: 'process';
  info: PreviewInfo;
  process: ChildProcessWithoutNullStreams;
}

interface StaticPreviewSession {
  kind: 'static';
  info: PreviewInfo;
  server: Server;
}

const LOCAL_URL_PATTERN = /(https?:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s]*)/i;
const ELECTRON_RENDERER_DEV_PORT = 5173;
const DEFAULT_STATIC_PREVIEW_PORT = 6173;
const STATIC_PORT_ATTEMPTS = 40;

export class PreviewServerService {
  private sessions = new Map<string, PreviewSession>();

  async start(window: BrowserWindow, request: PreviewStartRequest): Promise<PreviewInfo> {
    const previewId = crypto.randomUUID();
    const command = request.command?.trim() || detectPreviewCommand(request.workspacePath);
    const info: PreviewInfo = {
      previewId,
      url: `http://localhost:${request.port}`,
      command,
      status: 'starting'
    };

    if (command === 'grok-command-center-static') {
      return this.startStatic(window, request, info);
    }

    const processInfo = createProcess(command, request.workspacePath);
    const session: PreviewSession = {
      kind: 'process',
      info,
      process: processInfo
    };

    this.sessions.set(previewId, session);
    this.emit(window, { previewId, kind: 'log', text: `Starting preview: ${command}` });

    processInfo.stdout.on('data', (chunk: Buffer) => {
      this.handleOutput(window, previewId, chunk.toString('utf8'));
    });

    processInfo.stderr.on('data', (chunk: Buffer) => {
      this.handleOutput(window, previewId, chunk.toString('utf8'));
    });

    processInfo.on('error', (error) => {
      session.info.status = 'error';
      this.emit(window, { previewId, kind: 'error', text: error.message });
    });

    processInfo.on('close', (code) => {
      session.info.status = 'stopped';
      this.emit(window, {
        previewId,
        kind: 'stopped',
        text: `Preview stopped with code ${code ?? 'unknown'}`
      });
      this.sessions.delete(previewId);
    });

    return info;
  }

  async stop(previewId: string): Promise<void> {
    const session = this.sessions.get(previewId);
    if (!session) {
      return;
    }

    if (session.kind === 'process') {
      session.process.kill();
    } else {
      await new Promise<void>((resolveStop) => session.server.close(() => resolveStop()));
    }

    this.sessions.delete(previewId);
  }

  stopAll(): void {
    for (const session of this.sessions.values()) {
      if (session.kind === 'process') {
        session.process.kill();
      } else {
        session.server.close();
      }
    }
    this.sessions.clear();
  }

  private async startStatic(
    window: BrowserWindow,
    request: PreviewStartRequest,
    info: PreviewInfo
  ): Promise<PreviewInfo> {
    this.emit(window, {
      previewId: info.previewId,
      kind: 'log',
      text: `Starting Grok Command Center static server for ${request.workspacePath}`
    });

    let server: Server;
    let port: number;

    try {
      const started = await startStaticServer(request.workspacePath, request.port);
      server = started.server;
      port = started.port;
    } catch (error) {
      info.status = 'error';
      this.emit(window, {
        previewId: info.previewId,
        kind: 'error',
        text: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    const session: StaticPreviewSession = {
      kind: 'static',
      info,
      server
    };

    this.sessions.set(info.previewId, session);
    info.status = 'running';
    info.url = `http://localhost:${port}`;
    if (port !== request.port) {
      this.emit(window, {
        previewId: info.previewId,
        kind: 'log',
        text: `Preview port ${request.port} was unavailable; using ${port}.`
      });
    }
    this.emit(window, {
      previewId: info.previewId,
      kind: 'url',
      text: `Static preview available at ${info.url}`,
      url: info.url
    });
    this.emit(window, {
      previewId: info.previewId,
      kind: 'log',
      text: 'Serving static files with Grok Command Center.'
    });

    return info;
  }

  private handleOutput(window: BrowserWindow, previewId: string, text: string): void {
    const session = this.sessions.get(previewId);
    if (!session || session.kind !== 'process') {
      return;
    }

    const match = text.match(LOCAL_URL_PATTERN);
    if (match) {
      session.info.status = 'running';
      session.info.url = match[1];
      this.emit(window, {
        previewId,
        kind: 'url',
        text: `Preview available at ${match[1]}`,
        url: match[1]
      });
    }

    this.emit(window, { previewId, kind: 'log', text });
  }

  private emit(window: BrowserWindow, event: PreviewEvent): void {
    window.webContents.send('preview:event', event);
  }
}

export function detectPreviewCommand(workspacePath: string): string {
  const packageJsonPath = join(workspacePath, 'package.json');

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    if (packageJson.scripts?.dev) {
      return 'npm run dev';
    }

    if (packageJson.scripts?.start) {
      return 'npm start';
    }
  }

  return 'grok-command-center-static';
}

function createProcess(command: string, cwd: string): ChildProcessWithoutNullStreams {
  const [rawCommand, ...args] = parseCommandLine(command);

  if (!rawCommand) {
    throw new Error('Preview command is empty.');
  }

  const executable = process.platform === 'win32' && rawCommand === 'npm' ? 'npm.cmd' : rawCommand;

  return spawn(executable, args, {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      BROWSER: 'none'
    }
  });
}

export function parseCommandLine(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;

  for (const character of command.trim()) {
    if ((character === '"' || character === "'") && !quote) {
      quote = character;
      continue;
    }

    if (character === quote) {
      quote = undefined;
      continue;
    }

    if (/\s/.test(character) && !quote) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

async function startStaticServer(rootPath: string, requestedPort: number): Promise<{ server: Server; port: number }> {
  const firstPort = requestedPort === ELECTRON_RENDERER_DEV_PORT ? DEFAULT_STATIC_PREVIEW_PORT : requestedPort;
  let lastError: unknown;

  for (let offset = 0; offset < STATIC_PORT_ATTEMPTS; offset += 1) {
    const port = firstPort + offset;
    const server = createStaticServer(rootPath);

    try {
      await listen(server, port);
      return { server, port };
    } catch (error) {
      closeQuietly(server);
      lastError = error;

      if (!isAddressInUse(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `No available preview port found from ${firstPort} to ${firstPort + STATIC_PORT_ATTEMPTS - 1}. Last error: ${readErrorMessage(lastError)}`
  );
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error: Error): void => {
      server.off('error', onError);
      rejectListen(error);
    };

    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolveListen();
    });
  });
}

function closeQuietly(server: Server): void {
  try {
    server.close();
  } catch {
    // The server may not have reached the listening state yet.
  }
}

function isAddressInUse(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'EADDRINUSE');
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createStaticServer(rootPath: string): Server {
  const root = resolve(rootPath);

  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const requestedPath = pathname === '/' ? '/index.html' : pathname;
      const filePath = resolve(root, `.${normalize(requestedPath)}`);
      const pathRelation = relative(root, filePath);

      if (pathRelation.startsWith('..') || isAbsolute(pathRelation)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        response.writeHead(302, { Location: joinUrlPath(pathname, 'index.html') });
        response.end();
        return;
      }

      response.writeHead(200, {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'no-store'
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
}

function joinUrlPath(basePath: string, segment: string): string {
  const trimmed = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${trimmed}${segment}`;
}

function getMimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.wasm':
      return 'application/wasm';
    default:
      return 'application/octet-stream';
  }
}
