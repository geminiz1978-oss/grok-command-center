import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { unwrapSessionFromStorage, wrapSessionForStorage } from '../../shared/persistence';
import type {
  AgentTodoItem,
  AttachmentInfo,
  ChatEntry,
  ChatThreadRecord,
  WorkspaceCommandHistoryItem,
  WorkspaceInfo,
  WorkspaceSessionRecord,
  WorkshopSessionSnapshot
} from '../../shared/types';

const MAX_RECENT_WORKSPACES = 12;
const MAX_CHAT_ENTRIES = 400;
const MAX_ENTRY_TEXT_LENGTH = 12000;
const MAX_COMMAND_HISTORY = 80;
const MAX_THREADS = 24;

const EMPTY_SESSION: WorkshopSessionSnapshot = {
  recentWorkspaces: [],
  workspaces: {},
  updatedAt: new Date(0).toISOString()
};

const PERSISTED_CHAT_ROLES = new Set<ChatEntry['role']>([
  'started',
  'assistant',
  'reasoning',
  'tool',
  'result',
  'error',
  'done',
  'user',
  'system'
]);

export class SessionStore {
  private readonly sessionPath = join(app.getPath('userData'), 'session.json');

  async getSession(): Promise<WorkshopSessionSnapshot> {
    const stored = unwrapSessionFromStorage(await this.readJson<unknown>(this.sessionPath, {}));
    return normalizeSession(stored);
  }

  async saveSession(session: WorkshopSessionSnapshot): Promise<WorkshopSessionSnapshot> {
    const normalized = normalizeSession({
      ...session,
      updatedAt: new Date().toISOString()
    });
    await this.writeJson(this.sessionPath, wrapSessionForStorage(normalized));
    return normalized;
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const contents = await readFile(filePath, 'utf8');
      return JSON.parse(contents) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
}

function normalizeSession(value: Partial<WorkshopSessionSnapshot>): WorkshopSessionSnapshot {
  const workspaces = normalizeWorkspaceRecords(value.workspaces);
  const recentWorkspaces = normalizeRecentWorkspaces(value.recentWorkspaces);
  const activeWorkspacePath =
    typeof value.activeWorkspacePath === 'string' && value.activeWorkspacePath.trim()
      ? value.activeWorkspacePath.trim()
      : undefined;

  return {
    ...EMPTY_SESSION,
    activeWorkspacePath,
    recentWorkspaces,
    workspaces,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  };
}

function normalizeWorkspaceRecords(value: unknown): Record<string, WorkspaceSessionRecord> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const records: Record<string, WorkspaceSessionRecord> = {};

  for (const [key, rawRecord] of Object.entries(value as Record<string, unknown>)) {
    const record = normalizeWorkspaceRecord(rawRecord);

    if (record) {
      records[key] = record;
    }
  }

  return records;
}

function normalizeWorkspaceRecord(value: unknown): WorkspaceSessionRecord | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<WorkspaceSessionRecord>) : undefined;
  const workspace = normalizeWorkspace(record?.workspace);

  if (!workspace) {
    return undefined;
  }

  return {
    workspace,
    chatEntries: normalizeChatEntries(record?.chatEntries),
    commandHistory: normalizeCommandHistory(record?.commandHistory),
    agentTodos: normalizeAgentTodos(record?.agentTodos),
    threads: normalizeChatThreads(record?.threads),
    previewActive: Boolean(record?.previewActive),
    updatedAt: typeof record?.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
  };
}

function normalizeRecentWorkspaces(value: unknown): WorkspaceInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const recent: WorkspaceInfo[] = [];

  for (const item of value) {
    const workspace = normalizeWorkspace(item);
    if (!workspace) {
      continue;
    }

    const key = workspace.path.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    recent.push(workspace);

    if (recent.length >= MAX_RECENT_WORKSPACES) {
      break;
    }
  }

  return recent;
}

function normalizeWorkspace(value: unknown): WorkspaceInfo | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<WorkspaceInfo>) : undefined;
  const path = typeof record?.path === 'string' ? record.path.trim() : '';
  const name = typeof record?.name === 'string' && record.name.trim() ? record.name.trim() : readNameFromPath(path);

  return path ? { name, path } : undefined;
}

function normalizeChatEntries(value: unknown): ChatEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-MAX_CHAT_ENTRIES)
    .map(normalizeChatEntry)
    .filter((entry): entry is ChatEntry => Boolean(entry));
}

function normalizeChatEntry(value: unknown): ChatEntry | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<ChatEntry>) : undefined;
  const role = typeof record?.role === 'string' && PERSISTED_CHAT_ROLES.has(record.role) ? record.role : undefined;
  const text = typeof record?.text === 'string' ? record.text.slice(0, MAX_ENTRY_TEXT_LENGTH) : '';

  if (!role || !text) {
    return undefined;
  }

  return {
    id: typeof record?.id === 'string' && record.id ? record.id : crypto.randomUUID(),
    role,
    text,
    createdAt: typeof record?.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    ...(record?.attachments?.length ? { attachments: normalizeAttachments(record.attachments) } : {})
  };
}

function normalizeChatThreads(value: unknown): ChatThreadRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_THREADS)
    .map(normalizeChatThread)
    .filter((thread): thread is ChatThreadRecord => Boolean(thread));
}

function normalizeChatThread(value: unknown): ChatThreadRecord | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<ChatThreadRecord>) : undefined;
  const chatEntries = normalizeChatEntries(record?.chatEntries);

  if (!chatEntries.length) {
    return undefined;
  }

  const now = new Date().toISOString();

  return {
    id: typeof record?.id === 'string' && record.id ? record.id : crypto.randomUUID(),
    title: typeof record?.title === 'string' && record.title.trim() ? record.title.trim().slice(0, 80) : 'Untitled chat',
    chatEntries,
    commandHistory: normalizeCommandHistory(record?.commandHistory),
    agentTodos: normalizeAgentTodos(record?.agentTodos),
    createdAt: typeof record?.createdAt === 'string' ? record.createdAt : chatEntries[0]?.createdAt ?? now,
    updatedAt: typeof record?.updatedAt === 'string' ? record.updatedAt : now
  };
}

function normalizeCommandHistory(value: unknown): WorkspaceCommandHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_COMMAND_HISTORY)
    .map(normalizeCommandHistoryItem)
    .filter((item): item is WorkspaceCommandHistoryItem => Boolean(item));
}

function normalizeCommandHistoryItem(value: unknown): WorkspaceCommandHistoryItem | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<WorkspaceCommandHistoryItem>) : undefined;
  const command = typeof record?.command === 'string' ? record.command.trim() : '';

  if (!command) {
    return undefined;
  }

  return {
    id: typeof record?.id === 'string' && record.id ? record.id : crypto.randomUUID(),
    createdAt: typeof record?.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    command,
    exitCode: typeof record?.exitCode === 'number' ? record.exitCode : null,
    ok: Boolean(record?.ok),
    durationMs: typeof record?.durationMs === 'number' ? record.durationMs : 0,
    stdout: typeof record?.stdout === 'string' ? record.stdout.slice(0, MAX_ENTRY_TEXT_LENGTH) : '',
    stderr: typeof record?.stderr === 'string' ? record.stderr.slice(0, MAX_ENTRY_TEXT_LENGTH) : ''
  };
}

function normalizeAgentTodos(value: unknown): AgentTodoItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeAgentTodo).filter((item): item is AgentTodoItem => Boolean(item));
}

function normalizeAgentTodo(value: unknown): AgentTodoItem | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<AgentTodoItem>) : undefined;
  const content = typeof record?.content === 'string' ? record.content.trim() : '';
  const status = record?.status;

  if (!content || !status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    return undefined;
  }

  return {
    id: typeof record?.id === 'string' && record.id ? record.id : crypto.randomUUID(),
    content,
    status,
    ...(record?.priority && ['low', 'medium', 'high'].includes(record.priority) ? { priority: record.priority } : {})
  };
}

function normalizeAttachments(value: unknown): AttachmentInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeAttachment).filter((attachment): attachment is AttachmentInfo => Boolean(attachment));
}

function normalizeAttachment(value: unknown): AttachmentInfo | undefined {
  const record = value && typeof value === 'object' ? (value as Partial<AttachmentInfo>) : undefined;
  const name = typeof record?.name === 'string' ? record.name.trim() : '';
  const path = typeof record?.path === 'string' ? record.path.trim() : '';
  const originalPath = typeof record?.originalPath === 'string' ? record.originalPath.trim() : path;

  if (!name || !path) {
    return undefined;
  }

  return {
    id: typeof record?.id === 'string' && record.id ? record.id : crypto.randomUUID(),
    name,
    path,
    originalPath,
    kind: record?.kind ?? 'other',
    mimeType: typeof record?.mimeType === 'string' ? record.mimeType : '',
    size: typeof record?.size === 'number' ? record.size : 0,
    ...(typeof record?.textPreview === 'string' ? { textPreview: record.textPreview.slice(0, MAX_ENTRY_TEXT_LENGTH) } : {})
  };
}

function readNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Workspace';
}
