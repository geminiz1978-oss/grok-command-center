import type { BrowserWindow } from 'electron';
import { createSdkMcpServer, query, tool } from '@qwen-code/sdk';
import type { CanUseTool, PermissionResult, ToolInput } from '@qwen-code/sdk';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { getEndpoint, isAllowedQwenModel } from '../../shared/qwenCatalog';
import { extractMessageParts } from '../../shared/reasoning';
import type {
  AgentTodoItem,
  AgentTodoStatus,
  ApiKeyKind,
  AttachmentInfo,
  PermissionMode,
  QwenConnectionTestRequest,
  QwenConnectionTestResult,
  QwenPermissionRequest,
  QwenPermissionResponse,
  QwenRunRequest,
  QwenRunStarted,
  QwenStreamEvent
} from '../../shared/types';
import type { SettingsStore } from './settingsStore';
import type { WorkspaceCheckpointService } from './workspaceCheckpointService';
import type { WorkspaceMemoryService } from './workspaceMemoryService';

interface ActiveRun {
  interrupt: () => Promise<void>;
}

interface PendingPermission {
  runId: string;
  resolve: (approved: boolean) => void;
}

export class QwenSessionService {
  private runs = new Map<string, ActiveRun>();
  private lastAssistantTextByRun = new Map<string, string>();
  private pendingPermissions = new Map<string, PendingPermission>();

  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly workspaceMemoryService: WorkspaceMemoryService,
    private readonly workspaceCheckpointService: WorkspaceCheckpointService
  ) {}

  async testConnection(request: QwenConnectionTestRequest): Promise<QwenConnectionTestResult> {
    if (!isAllowedQwenModel(request.modelId)) {
      throw new Error(`Model "${request.modelId}" is not in the Grok Command Center allowlist.`);
    }

    const endpoint = getEndpoint(request.endpointKey);
    const apiKey = await this.getApiKey(endpoint.apiKeyKind);

    if (!apiKey) {
      return {
        ok: false,
        message: `Missing ${endpoint.apiKeyKind} API key.`,
        latencyMs: 0,
        modelId: request.modelId,
        endpointLabel: endpoint.label
      };
    }

    const startedAt = performance.now();

    try {
      const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.modelId,
          messages: [
            {
              role: 'system',
              content: 'You are a Grok Command Center connection diagnostic.'
            },
            {
              role: 'user',
              content: 'Reply exactly: GROK_COMMAND_CENTER_OK'
            }
          ],
          temperature: 0,
          max_tokens: 16,
          stream: false
        })
      });

      const latencyMs = Math.round(performance.now() - startedAt);
      const payload = await readJson(response);

      if (!response.ok) {
        return {
          ok: false,
          message: summarizeApiError(response.status, payload),
          latencyMs,
          modelId: request.modelId,
          endpointLabel: endpoint.label
        };
      }

      return {
        ok: true,
        message: 'Grok endpoint responded successfully.',
        latencyMs,
        modelId: request.modelId,
        endpointLabel: endpoint.label
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Math.round(performance.now() - startedAt),
        modelId: request.modelId,
        endpointLabel: endpoint.label
      };
    }
  }

  async start(window: BrowserWindow, request: QwenRunRequest): Promise<QwenRunStarted> {
    if (!isAllowedQwenModel(request.modelId)) {
      throw new Error(`Model "${request.modelId}" is not in the Grok Command Center allowlist.`);
    }

    const endpoint = getEndpoint(request.endpointKey);
    const apiKey = await this.getApiKey(endpoint.apiKeyKind);

    if (!apiKey) {
      throw new Error('Missing xAI API key. Save it in Grok Command Center settings first.');
    }

    const runId = crypto.randomUUID();
    this.emit(window, { runId, kind: 'started', text: `Running ${request.modelId}` });

    void this.runQuery(window, runId, request, endpoint.baseUrl, endpoint.apiKeyKind, apiKey);

    return { runId };
  }

  async interrupt(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }

    this.denyPendingPermissionsForRun(runId);
    await run.interrupt();
    this.runs.delete(runId);
  }

  async resolvePermission(response: QwenPermissionResponse): Promise<void> {
    const pending = this.pendingPermissions.get(response.requestId);
    if (!pending) {
      return;
    }

    pending.resolve(response.approved);
  }

  private async runQuery(
    window: BrowserWindow,
    runId: string,
    request: QwenRunRequest,
    baseUrl: string,
    apiKeyKind: ApiKeyKind,
    apiKey: string
  ): Promise<void> {
    try {
      await this.createRunCheckpoint(window, runId, request);
      const workspaceMemory = await this.workspaceMemoryService.readForPrompt(request.workspacePath);
      const qwenExecutable = resolveQwenExecutablePath(request.qwenExecutablePath);
      const result = withNodeExecPath(() =>
        query({
          prompt: formatPromptWithWorkspaceMemory(
            formatPromptWithAttachments(request.prompt, request.attachments ?? []),
            workspaceMemory
          ),
          options: {
            cwd: request.workspacePath,
            model: request.modelId,
            ...(qwenExecutable ? { pathToQwenExecutable: qwenExecutable } : {}),
            permissionMode: request.permissionMode,
            authType: 'openai',
            includePartialMessages: true,
            systemPrompt: {
              type: 'preset',
              preset: 'qwen_code',
              append: WORKSHOP_SYSTEM_PROMPT_APPEND
            },
            excludeTools: ['run_shell_command', 'ShellTool', 'ask_user_question'],
            mcpServers: {
              'grok-command-center': this.createWorkshopMcpServer(window, runId, request)
            },
            canUseTool: this.createToolPermissionHandler(window, runId, request.permissionMode),
            env: buildQwenEnv(baseUrl, apiKeyKind, apiKey, request)
          }
        } as never)
      );

      this.runs.set(runId, {
        interrupt: async () => {
          if (typeof (result as { interrupt?: () => Promise<void> }).interrupt === 'function') {
            await (result as { interrupt: () => Promise<void> }).interrupt();
          }
        }
      });

      for await (const message of result as AsyncIterable<unknown>) {
        this.handleMessage(window, runId, message);
      }

      this.emit(window, { runId, kind: 'done', text: 'Grok run complete.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit(window, {
        runId,
        kind: 'error',
        text: isUsageLimitError(message) ? formatUsageLimitError(message) : message,
        fatal: true
      });
    } finally {
      this.runs.delete(runId);
      this.lastAssistantTextByRun.delete(runId);
      this.denyPendingPermissionsForRun(runId);
    }
  }

  private handleMessage(window: BrowserWindow, runId: string, message: unknown): void {
    const record = message && typeof message === 'object' ? (message as Record<string, unknown>) : {};
    const type = typeof record.type === 'string' ? record.type : 'assistant';

    this.emit(window, { runId, kind: 'raw', text: formatRawMessage(message), raw: message });

    if (type === 'assistant') {
      this.handleAssistantMessage(window, runId, record);
      return;
    }

    if (type === 'user') {
      this.handleUserMessage(window, runId, record);
      return;
    }

    if (type === 'stream_event') {
      this.handleStreamEvent(window, runId, record);
      return;
    }

    if (type === 'result') {
      this.handleResultMessage(window, runId, record);
      return;
    }

    const nestedMessage = record.message ?? record.delta ?? record;
    this.emitMessageParts(window, runId, nestedMessage);
  }

  private handleAssistantMessage(window: BrowserWindow, runId: string, record: Record<string, unknown>): void {
    const blocks = readContentBlocks(record.message);

    if (!blocks.length) {
      this.emitMessageParts(window, runId, record.message ?? record);
      return;
    }

    for (const block of blocks) {
      const blockType = readStringProperty(block, 'type');

      if (blockType === 'text') {
        this.emitAssistant(window, runId, readStringProperty(block, 'text'));
        continue;
      }

      if (blockType === 'thinking') {
        this.emit(window, { runId, kind: 'reasoning', raw: block, text: readStringProperty(block, 'thinking') });
        continue;
      }

      if (blockType === 'tool_use') {
        const todos = extractTodoItems(block);
        if (todos.length) {
          this.emit(window, {
            runId,
            kind: 'todo',
            raw: block,
            text: `Plan updated: ${todos.length} item${todos.length === 1 ? '' : 's'}`,
            todos
          });
          continue;
        }

        this.emit(window, { runId, kind: 'tool', raw: block, text: summarizeToolUseBlock(block) });
        continue;
      }

      if (blockType === 'tool_result') {
        const isError = Boolean(block.is_error);
        if (isError) {
          this.emit(window, { runId, kind: 'error', raw: block, text: summarizeToolResultBlock(block), fatal: false });
        }
      }
    }
  }

  private handleUserMessage(window: BrowserWindow, runId: string, record: Record<string, unknown>): void {
    const blocks = readContentBlocks(record.message);

    for (const block of blocks) {
      if (readStringProperty(block, 'type') === 'tool_result' && Boolean(block.is_error)) {
        this.emit(window, { runId, kind: 'error', raw: block, text: summarizeToolResultBlock(block), fatal: false });
      }
    }
  }

  private handleStreamEvent(window: BrowserWindow, runId: string, record: Record<string, unknown>): void {
    void window;
    void runId;
    void record;
  }

  private handleResultMessage(window: BrowserWindow, runId: string, record: Record<string, unknown>): void {
    if (record.is_error) {
      const errorRecord = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : {};
      const message = readStringProperty(errorRecord, 'message') || readText(record.result) || 'Grok run failed.';
      this.emit(window, { runId, kind: 'error', raw: record, text: message, fatal: true });
      return;
    }

    const resultText = readText(record.result).trim();
    const lastAssistantText = this.lastAssistantTextByRun.get(runId)?.trim();

    if (resultText && resultText !== lastAssistantText) {
      this.emitAssistant(window, runId, resultText);
    }
  }

  private emitMessageParts(window: BrowserWindow, runId: string, value: unknown): void {
    const parts = extractMessageParts(value);

    if (parts.reasoning) {
      this.emit(window, { runId, kind: 'reasoning', raw: value, text: parts.reasoning });
    }

    if (parts.content) {
      this.emitAssistant(window, runId, parts.content);
    }
  }

  private emitAssistant(window: BrowserWindow, runId: string, text: string): void {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    this.lastAssistantTextByRun.set(runId, trimmed);
    this.emit(window, { runId, kind: 'assistant', text: trimmed });
  }

  private emit(window: BrowserWindow, event: QwenStreamEvent): void {
    window.webContents.send('qwen:event', event);
  }

  private async getApiKey(kind: ApiKeyKind): Promise<string | undefined> {
    return this.settingsStore.getApiKey(kind);
  }

  private async createRunCheckpoint(window: BrowserWindow, runId: string, request: QwenRunRequest): Promise<void> {
    try {
      const checkpoint = await this.workspaceCheckpointService.create(request.workspacePath, `Before ${request.modelId} run`);
      this.emit(window, {
        runId,
        kind: 'tool',
        text: `Checkpoint saved: ${checkpoint.fileCount} files (${formatBytes(checkpoint.totalBytes)})`
      });
    } catch (error) {
      this.emit(window, {
        runId,
        kind: 'tool',
        text: `Checkpoint skipped: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private createToolPermissionHandler(
    window: BrowserWindow,
    runId: string,
    permissionMode: PermissionMode
  ): CanUseTool {
    return async (toolName, input, options) =>
      this.resolveToolPermission(window, runId, toolName, input, permissionMode, options.signal, options.suggestions);
  }

  private createWorkshopMcpServer(window: BrowserWindow, runId: string, request: QwenRunRequest) {
    const runCommandTool = tool(
      'workshop_run_command',
      'Run a shell command in the current workspace through Grok Command Center. Use this instead of run_shell_command. Grok Command Center may ask the user for approval before the command runs.',
      {
        command: z.string().min(1).describe('The shell command to run.'),
        description: z.string().optional().describe('A short reason for running this command.')
      },
      async (args) => {
        const commandInput = {
          command: args.command,
          description: args.description ?? ''
        };

        if (request.permissionMode === 'plan') {
          return createMcpTextResult('Plan mode blocks command execution. Ask the user to switch permission mode first.', true);
        }

        const approved =
          request.permissionMode === 'yolo' ||
          (await this.requestPermission(window, {
            runId,
            toolName: 'workshop_run_command',
            summary: `Run ${args.command}`,
            input: commandInput
          }));

        if (!approved) {
          return createMcpTextResult(`Command denied by Grok Command Center: ${args.command}`, true);
        }

        this.emit(window, { runId, kind: 'tool', text: `Run ${args.command}` });
        const result = await runWorkshopCommand(request.workspacePath, args.command);
        return createMcpTextResult(formatWorkshopCommandResult(args.command, result), result.exitCode !== 0);
      }
    );

    return createSdkMcpServer({
      name: 'grok-command-center',
      version: '0.1.5',
      tools: [runCommandTool]
    });
  }

  private async resolveToolPermission(
    window: BrowserWindow,
    runId: string,
    toolName: string,
    input: ToolInput,
    permissionMode: PermissionMode,
    signal: AbortSignal,
    suggestions: unknown
  ): Promise<PermissionResult> {
    const normalizedName = toolName.toLowerCase();

    if (normalizedName === 'ask_user_question') {
      return { behavior: 'allow', updatedInput: input };
    }

    if (isReadLikeTool(normalizedName) || normalizedName === 'todo_write' || normalizedName === 'exit_plan_mode') {
      return { behavior: 'allow', updatedInput: input };
    }

    if (permissionMode === 'yolo') {
      return { behavior: 'allow', updatedInput: input };
    }

    if (permissionMode === 'plan' && !isReadLikeTool(normalizedName)) {
      return {
        behavior: 'deny',
        message: `Plan mode blocks ${toolName}. Switch permission mode if you want Grok to execute it.`
      };
    }

    if (isEditLikeTool(normalizedName) && permissionMode === 'auto-edit') {
      return { behavior: 'allow', updatedInput: input };
    }

    const approved = await this.requestPermission(window, {
      runId,
      toolName,
      summary: summarizePermissionRequest(toolName, input),
      input,
      suggestions: formatPermissionSuggestions(suggestions)
    }, signal);

    if (approved) {
      return { behavior: 'allow', updatedInput: input };
    }

    return {
      behavior: 'deny',
      message: `Grok Command Center user denied ${toolName}.`,
      interrupt: false
    };
  }

  private requestPermission(
    window: BrowserWindow,
    request: Omit<QwenPermissionRequest, 'requestId' | 'createdAt'>,
    signal?: AbortSignal
  ): Promise<boolean> {
    const requestId = crypto.randomUUID();
    const effectiveSignal = signal ?? new AbortController().signal;

    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (approved: boolean): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        effectiveSignal.removeEventListener('abort', abort);
        this.pendingPermissions.delete(requestId);
        resolve(approved);
      };
      const abort = (): void => finish(false);
      timer = setTimeout(() => finish(false), 55000);

      this.pendingPermissions.set(requestId, {
        runId: request.runId,
        resolve: finish
      });

      effectiveSignal.addEventListener('abort', abort, { once: true });
      window.webContents.send('qwen:permission-request', {
        ...request,
        requestId,
        createdAt: new Date().toISOString()
      } satisfies QwenPermissionRequest);
      this.emit(window, { runId: request.runId, kind: 'tool', text: `Approval needed: ${request.summary}` });
    });
  }

  private denyPendingPermissionsForRun(runId: string): void {
    for (const [requestId, pending] of this.pendingPermissions.entries()) {
      if (pending.runId === runId) {
        pending.resolve(false);
        this.pendingPermissions.delete(requestId);
      }
    }
  }
}

const WORKSHOP_SYSTEM_PROMPT_APPEND = [
  'You are running inside Grok Command Center, a desktop coding workspace with local file editing and live preview.',
  'When the user gives a clear build, edit, inspect, test, or fix request, proceed directly instead of asking for permission to continue.',
  'Do not use ask_user_question. If you need clarification, ask in normal assistant text and stop.',
  'If Grok Command Center includes project memory in the user prompt, treat it as persistent workspace guidance.',
  'For shell commands, checks, package manager commands, and command-line inspection, use the workshop_run_command MCP tool instead of run_shell_command.',
  'Prefer creating browser-playable prototypes as complete local files that Grok Command Center can preview immediately.',
  'Tiny internal reference: keep the operator calm, efficient, and doing only good everyday efficiency.'
].join('\n');

function isReadLikeTool(toolName: string): boolean {
  return (
    toolName.startsWith('read') ||
    toolName.includes('read_') ||
    toolName.includes('list') ||
    toolName.includes('glob') ||
    toolName.includes('grep') ||
    toolName.includes('search') ||
    toolName === 'todo_read'
  );
}

function isEditLikeTool(toolName: string): boolean {
  return (
    toolName.includes('write') ||
    toolName.includes('edit') ||
    toolName.includes('replace') ||
    toolName.includes('patch') ||
    toolName.includes('create') ||
    toolName.includes('delete_file')
  );
}

function isShellLikeTool(toolName: string): boolean {
  return (
    toolName.includes('shell') ||
    toolName.includes('bash') ||
    toolName.includes('terminal') ||
    toolName.includes('command') ||
    toolName.includes('exec')
  );
}

function summarizePermissionRequest(toolName: string, input: ToolInput): string {
  const normalizedName = toolName.toLowerCase();
  const command = readInputString(input, 'command') || readInputString(input, 'cmd') || readInputString(input, 'script');

  if (isShellLikeTool(normalizedName) && command) {
    return `Run ${command}`;
  }

  const filePath =
    readInputString(input, 'file_path') ||
    readInputString(input, 'path') ||
    readInputString(input, 'absolute_path') ||
    readInputString(input, 'target_path');

  if (filePath) {
    if (isEditLikeTool(normalizedName)) {
      return `${humanizeToolName(toolName)} ${formatPath(filePath)}`;
    }

    return `${humanizeToolName(toolName)} ${filePath}`;
  }

  return humanizeToolName(toolName);
}

function formatPermissionSuggestions(suggestions: unknown): string[] | undefined {
  if (!Array.isArray(suggestions)) {
    return undefined;
  }

  const formatted = suggestions
    .map((suggestion) => {
      if (typeof suggestion === 'string') {
        return suggestion;
      }

      if (suggestion && typeof suggestion === 'object') {
        const record = suggestion as Record<string, unknown>;
        return readText(record.description) || readText(record.title) || readText(record.rule);
      }

      return '';
    })
    .filter(Boolean);

  return formatted.length ? formatted : undefined;
}

function readInputString(input: ToolInput, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function buildQwenEnv(
  baseUrl: string,
  _apiKeyKind: ApiKeyKind,
  apiKey: string,
  request: QwenRunRequest
): Record<string, string> {
  const inheritedEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );

  return {
    ...inheritedEnv,
    ELECTRON_RUN_AS_NODE: '1',
    XAI_API_KEY: apiKey,
    OPENAI_API_KEY: apiKey,
    OPENAI_BASE_URL: baseUrl,
    OPENAI_MODEL: request.modelId,
    QWEN_MODEL: request.modelId,
    QWEN_ENABLE_THINKING: String(request.thinkingEnabled),
    QWEN_THINKING_BUDGET: String(request.thinkingBudget)
  };
}

function runWorkshopCommand(
  workspacePath: string,
  command: string
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: workspacePath,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        BROWSER: 'none'
      }
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      stderr = appendCommandOutput(stderr, '\nCommand timed out in Grok Command Center.');
      child.kill();
    }, 120000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendCommandOutput(stdout, chunk.toString('utf8'));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendCommandOutput(stderr, chunk.toString('utf8'));
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        exitCode: null,
        stdout,
        stderr: appendCommandOutput(stderr, error.message),
        timedOut
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}

function formatWorkshopCommandResult(
  command: string,
  result: { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }
): string {
  const sections = [
    `Command: ${command}`,
    `Exit Code: ${result.exitCode ?? 'unknown'}`,
    result.timedOut ? 'Timed Out: yes' : '',
    result.stdout.trim() ? `Stdout:\n${result.stdout.trim()}` : 'Stdout: (empty)',
    result.stderr.trim() ? `Stderr:\n${result.stderr.trim()}` : 'Stderr: (empty)'
  ].filter(Boolean);

  return sections.join('\n\n');
}

function appendCommandOutput(current: string, next: string): string {
  const output = `${current}${next}`;
  const limit = 80000;
  return output.length > limit ? output.slice(output.length - limit) : output;
}

function createMcpTextResult(text: string, isError = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text
      }
    ],
    ...(isError ? { isError: true } : {})
  };
}

function formatPromptWithAttachments(prompt: string, attachments: AttachmentInfo[]): string {
  if (!attachments.length) {
    return prompt;
  }

  const attachmentSummary = attachments
    .map((attachment, index) => {
      const lines = [
        `${index + 1}. ${attachment.name}`,
        `   Kind: ${attachment.kind}`,
        `   MIME: ${attachment.mimeType}`,
        `   Size: ${formatBytes(attachment.size)}`,
        `   Local path: ${attachment.path}`
      ];

      if (attachment.textPreview) {
        lines.push('   Text preview:');
        lines.push(indent(attachment.textPreview.slice(0, 4000), '   > '));
      }

      return lines.join('\n');
    })
    .join('\n\n');

  return `${prompt}\n\nAttached files were imported into this workspace. Inspect them by path when useful:\n\n${attachmentSummary}`;
}

function formatPromptWithWorkspaceMemory(prompt: string, memory: string): string {
  const trimmed = memory.trim();

  if (!trimmed) {
    return prompt;
  }

  return `${prompt}\n\nGrok Command Center project memory for this workspace:\n\n${trimmed}`;
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function indent(value: string, prefix: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function isUsageLimitError(message: string): boolean {
  return /quota|rate.?limit|usage.?limit|insufficient|billing|credit|free.?trial|too many requests|429/i.test(message);
}

function formatUsageLimitError(message: string): string {
  return `Grok usage limit or rate limit reached. Check your xAI quota, billing, or wait for the limit window to reset.\n\nProvider message: ${message}`;
}

function resolveQwenExecutablePath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return resolvePackagedBundledQwenCliPath();
  }

  const lower = trimmed.toLowerCase();
  const isWindowsQwenShim = process.platform === 'win32' && ['qwen', 'qwen.cmd', 'qwen.ps1'].includes(lower);

  return isWindowsQwenShim ? resolvePackagedBundledQwenCliPath() : trimmed;
}

function resolvePackagedBundledQwenCliPath(): string | undefined {
  const resourcesPath = process.resourcesPath;

  if (!resourcesPath || !resourcesPath.includes('resources')) {
    return undefined;
  }

  const candidate = join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '@qwen-code',
    'sdk',
    'dist',
    'cli',
    'cli.js'
  );

  return existsSync(candidate) ? candidate : undefined;
}

function withNodeExecPath<T>(operation: () => T): T {
  const nodeExecutable = resolveNodeExecutable();

  if (!nodeExecutable) {
    return operation();
  }

  const previousExecPath = process.execPath;
  process.execPath = nodeExecutable;

  try {
    return operation();
  } finally {
    process.execPath = previousExecPath;
  }
}

function resolveNodeExecutable(): string | undefined {
  const candidates = [
    process.env.npm_node_execpath,
    process.env.NODE_EXE,
    process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node.exe' : undefined
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const output = execFileSync(command, ['node'], { encoding: 'utf8', windowsHide: true });
    return output.split(/\r?\n/).find(Boolean)?.trim();
  } catch {
    return undefined;
  }
}

function readContentBlocks(value: unknown): Record<string, unknown>[] {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const content = record.content;

  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === 'object');
}

function readStringProperty(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function summarizeToolUseBlock(block: Record<string, unknown>): string {
  const toolName = readStringProperty(block, 'name') || 'tool';
  const input = block.input && typeof block.input === 'object' ? (block.input as Record<string, unknown>) : {};

  if (toolName === 'read_file') {
    return `Read ${formatPath(readStringProperty(input, 'file_path'))}`;
  }

  if (toolName === 'write_file') {
    return `Write ${formatPath(readStringProperty(input, 'file_path'))}`;
  }

  if (toolName === 'replace' || toolName === 'edit') {
    return `Edit ${formatPath(readStringProperty(input, 'file_path'))}`;
  }

  if (toolName === 'glob') {
    return `Find files ${readStringProperty(input, 'pattern') || ''}`.trim();
  }

  if (toolName === 'list_directory') {
    return `List ${formatPath(readStringProperty(input, 'path'))}`;
  }

  if (toolName === 'run_shell_command' || toolName === 'shell' || toolName === 'bash') {
    return `Run ${readStringProperty(input, 'command') || 'command'}`;
  }

  if (toolName.includes('workshop_run_command')) {
    return `Run ${readStringProperty(input, 'command') || 'command'}`;
  }

  return `Tool ${toolName}`;
}

function extractTodoItems(block: Record<string, unknown>): AgentTodoItem[] {
  const toolName = readStringProperty(block, 'name').toLowerCase();
  const input = block.input && typeof block.input === 'object' ? (block.input as Record<string, unknown>) : {};

  if (!toolName.includes('todo') && !toolName.includes('plan')) {
    return [];
  }

  const candidates = [input.todos, input.items, input.tasks, input.plan].filter(Array.isArray) as unknown[][];
  const source = candidates[0];

  if (!source?.length) {
    return [];
  }

  return source
    .map((item, index) => normalizeTodoItem(item, index))
    .filter((item): item is AgentTodoItem => Boolean(item));
}

function normalizeTodoItem(value: unknown, index: number): AgentTodoItem | undefined {
  if (typeof value === 'string') {
    const content = value.trim();
    return content
      ? {
          id: `todo-${index}`,
          content,
          status: 'pending'
        }
      : undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const content =
    readStringProperty(record, 'content') ||
    readStringProperty(record, 'text') ||
    readStringProperty(record, 'task') ||
    readStringProperty(record, 'title') ||
    readStringProperty(record, 'description');

  if (!content.trim()) {
    return undefined;
  }

  return {
    id: readStringProperty(record, 'id') || `todo-${index}-${content.slice(0, 18)}`,
    content: content.trim(),
    status: normalizeTodoStatus(readStringProperty(record, 'status') || readStringProperty(record, 'state')),
    priority: normalizeTodoPriority(readStringProperty(record, 'priority'))
  };
}

function normalizeTodoStatus(value: string): AgentTodoStatus {
  const normalized = value.toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized === 'completed' || normalized === 'complete' || normalized === 'done') {
    return 'completed';
  }

  if (normalized === 'in_progress' || normalized === 'active' || normalized === 'doing') {
    return 'in_progress';
  }

  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'blocked') {
    return 'cancelled';
  }

  return 'pending';
}

function normalizeTodoPriority(value: string): AgentTodoItem['priority'] {
  const normalized = value.toLowerCase();

  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }

  return undefined;
}

function summarizeToolResultBlock(block: Record<string, unknown>): string {
  const content = block.content;

  if (typeof content === 'string' && content.trim()) {
    return `Tool result error: ${content.trim().slice(0, 500)}`;
  }

  return 'Tool result error.';
}

function formatPath(value: string): string {
  if (!value) {
    return 'file';
  }

  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).at(-1) ?? value;
}

function formatRawMessage(value: unknown): string {
  const text = JSON.stringify(value, null, 2) ?? '';
  const limit = 12000;

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}\n\n[raw stream truncated: ${text.length - limit} more characters]`;
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function summarizeApiError(status: number, payload: unknown): string {
  const errorMessage = readNestedString(payload, ['error', 'message']) ?? readNestedString(payload, ['message']);
  const errorCode = readNestedString(payload, ['error', 'code']) ?? readNestedString(payload, ['code']);
  const detail = [errorCode, errorMessage].filter(Boolean).join(': ');

  return detail ? `Grok API returned ${status}: ${detail}` : `Grok API returned HTTP ${status}.`;
}

function readNestedString(value: unknown, path: string[]): string | undefined {
  let current = value;

  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}
