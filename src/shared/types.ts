export type PermissionMode = 'plan' | 'default' | 'auto-edit' | 'yolo';

export type ApiKeyKind = 'xai';

export type NodeKind = 'file' | 'directory';

export interface FileTreeNode {
  name: string;
  path: string;
  kind: NodeKind;
  children?: FileTreeNode[];
}

export interface WorkspaceFileRequest {
  workspacePath: string;
  filePath: string;
}

export interface WorkspaceFileContent {
  path: string;
  name: string;
  relativePath: string;
  content: string;
  size: number;
  mtimeMs: number;
  isBinary: boolean;
  isTooLarge: boolean;
  language: string;
}

export interface SaveWorkspaceFileRequest extends WorkspaceFileRequest {
  content: string;
}

export interface WorkspaceSearchRequest {
  workspacePath: string;
  query: string;
  maxResults?: number;
}

export interface WorkspaceSearchResult {
  path: string;
  name: string;
  relativePath: string;
  matchKind: 'name' | 'content';
  lineNumber?: number;
  preview?: string;
}

export interface WorkspaceMemoryInfo {
  path: string;
  content: string;
  exists: boolean;
  updatedAt?: string;
}

export interface SaveWorkspaceMemoryRequest {
  workspacePath: string;
  content: string;
}

export interface WorkspaceCheckpointInfo {
  id: string;
  label: string;
  createdAt: string;
  fileCount: number;
  totalBytes: number;
}

export interface RestoreWorkspaceCheckpointRequest {
  workspacePath: string;
  checkpointId: string;
}

export interface RestoreWorkspaceCheckpointResult {
  checkpoint: WorkspaceCheckpointInfo;
  restoredFiles: number;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
}

export type QwenModelCapability =
  | 'thinking'
  | 'agentic-coding'
  | 'vision'
  | 'file-input'
  | 'fast'
  | 'balanced'
  | 'frontier'
  | 'coding'
  | 'preview'
  | 'latest';

export interface QwenModelConfig {
  id: string;
  name: string;
  description: string;
  recommendedEndpoint: EndpointKey;
  supportsThinking: boolean;
  capabilities: QwenModelCapability[];
}

export type EndpointKey = 'xai';

export interface EndpointConfig {
  key: EndpointKey;
  label: string;
  apiKeyKind: ApiKeyKind;
  baseUrl: string;
}

export interface AppSettings {
  modelId: string;
  endpointKey: EndpointKey;
  permissionMode: PermissionMode;
  thinkingEnabled: boolean;
  thinkingBudget: number;
  usageLimitTokens: number;
  previewPort: number;
  previewCommand: string;
  qwenExecutablePath: string;
  onboardingCompleted: boolean;
  promptTemplates: PromptTemplateConfig[];
}

export interface PromptTemplateConfig {
  id: string;
  label: string;
  prompt: string;
}

export interface QwenRunRequest {
  workspacePath: string;
  prompt: string;
  attachments?: AttachmentInfo[];
  modelId: string;
  endpointKey: EndpointKey;
  permissionMode: PermissionMode;
  thinkingEnabled: boolean;
  thinkingBudget: number;
  qwenExecutablePath?: string;
}

export interface QwenRunStarted {
  runId: string;
}

export interface QwenConnectionTestRequest {
  modelId: string;
  endpointKey: EndpointKey;
}

export interface QwenConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  modelId: string;
  endpointLabel: string;
}

export type AgentTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface AgentTodoItem {
  id: string;
  content: string;
  status: AgentTodoStatus;
  priority?: 'low' | 'medium' | 'high';
}

export type QwenEventKind =
  | 'started'
  | 'assistant'
  | 'reasoning'
  | 'tool'
  | 'todo'
  | 'result'
  | 'raw'
  | 'error'
  | 'done';

export interface QwenStreamEvent {
  runId: string;
  kind: QwenEventKind;
  text?: string;
  raw?: unknown;
  todos?: AgentTodoItem[];
  fatal?: boolean;
}

export interface QwenPermissionRequest {
  requestId: string;
  runId: string;
  toolName: string;
  summary: string;
  input: unknown;
  suggestions?: string[];
  createdAt: string;
}

export interface QwenPermissionResponse {
  requestId: string;
  approved: boolean;
}

export interface ChatEntry {
  id: string;
  role: QwenEventKind | 'user' | 'system';
  text: string;
  createdAt: string;
  attachments?: AttachmentInfo[];
}

export type QwenRunPhase = 'running' | 'stalled' | 'completed' | 'error' | 'interrupted';

export interface QwenRunStatus {
  runId: string;
  phase: QwenRunPhase;
  modelId: string;
  modelName: string;
  endpointLabel: string;
  permissionMode: PermissionMode;
  prompt: string;
  attachmentCount: number;
  startedAt: string;
  lastEventAt: string;
  lastEventKind?: QwenEventKind;
  lastTool?: string;
  errorText?: string;
  completedAt?: string;
}

export interface PreviewStartRequest {
  workspacePath: string;
  port: number;
  command?: string;
}

export interface PreviewInfo {
  previewId: string;
  url: string;
  command: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

export interface PreviewEvent {
  previewId: string;
  kind: 'log' | 'url' | 'error' | 'stopped';
  text: string;
  url?: string;
}

export interface GitFileStatus {
  code: string;
  path: string;
}

export interface GitDiffFile {
  code: string;
  path: string;
  diff: string;
  isBinary: boolean;
}

export interface WorkspaceCheck {
  id: string;
  label: string;
  command: string;
}

export interface WorkspaceCommandRequest {
  workspacePath: string;
  command: string;
}

export interface WorkspaceCommandResult {
  command: string;
  exitCode: number | null;
  ok: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

export interface WorkspaceCommandHistoryItem extends WorkspaceCommandResult {
  id: string;
  createdAt: string;
}

export interface ExportTranscriptRequest {
  workspaceName: string;
  workspacePath?: string;
  entries: ChatEntry[];
}

export interface ExportTranscriptResult {
  path: string;
}

export interface SettingsBackupResult {
  path: string;
}

export interface ImportSettingsBackupResult {
  path: string;
  settings: AppSettings;
}

export interface SessionBackupResult {
  path: string;
}

export interface ImportSessionBackupResult {
  path: string;
  session: WorkshopSessionSnapshot;
}

export interface RuntimeLogInfo {
  path: string;
  exists: boolean;
  content: string;
  updatedAt?: string;
}

export interface DiagnosticFileInfo {
  path: string;
  exists: boolean;
  size: number;
  updatedAt?: string;
}

export interface AppDiagnosticsInfo {
  appName: string;
  appVersion: string;
  mode: 'development' | 'packaged';
  isPackaged: boolean;
  platform: string;
  arch: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  v8Version: string;
  userDataPath: string;
  appPath: string;
  resourcesPath: string;
  executablePath: string;
  currentWorkingDirectory: string;
  settingsPath: string;
  sessionPath: string;
  secretsPath: string;
  runtimeLogPath: string;
  files: {
    settings: DiagnosticFileInfo;
    session: DiagnosticFileInfo;
    secrets: DiagnosticFileInfo;
    runtimeLog: DiagnosticFileInfo;
  };
  generatedAt: string;
}

export interface SecretStatus {
  xai: boolean;
}

export interface SaveApiKeyRequest {
  kind: ApiKeyKind;
  value: string;
}

export type AttachmentKind = 'image' | 'audio' | 'video' | 'text' | 'pdf' | 'archive' | 'other';

export interface AttachmentInfo {
  id: string;
  name: string;
  path: string;
  originalPath: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  textPreview?: string;
}

export interface ImportAttachmentsRequest {
  workspacePath: string;
  sourcePaths: string[];
}

export interface WorkspaceSessionRecord {
  workspace: WorkspaceInfo;
  chatEntries: ChatEntry[];
  previewActive: boolean;
  commandHistory?: WorkspaceCommandHistoryItem[];
  agentTodos?: AgentTodoItem[];
  threads?: ChatThreadRecord[];
  updatedAt: string;
}

export interface ChatThreadRecord {
  id: string;
  title: string;
  chatEntries: ChatEntry[];
  commandHistory?: WorkspaceCommandHistoryItem[];
  agentTodos?: AgentTodoItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopSessionSnapshot {
  activeWorkspacePath?: string;
  recentWorkspaces: WorkspaceInfo[];
  workspaces: Record<string, WorkspaceSessionRecord>;
  updatedAt: string;
}

export interface WorkshopApi {
  isDesktopBridge: boolean;
  resolveFilePaths: (files: File[]) => string[];
  selectWorkspace: () => Promise<WorkspaceInfo | null>;
  loadFileTree: (workspacePath: string) => Promise<FileTreeNode[]>;
  readWorkspaceFile: (request: WorkspaceFileRequest) => Promise<WorkspaceFileContent>;
  saveWorkspaceFile: (request: SaveWorkspaceFileRequest) => Promise<WorkspaceFileContent>;
  openWorkspaceFileExternal: (request: WorkspaceFileRequest) => Promise<void>;
  searchWorkspace: (request: WorkspaceSearchRequest) => Promise<WorkspaceSearchResult[]>;
  getWorkspaceMemory: (workspacePath: string) => Promise<WorkspaceMemoryInfo>;
  saveWorkspaceMemory: (request: SaveWorkspaceMemoryRequest) => Promise<WorkspaceMemoryInfo>;
  listWorkspaceCheckpoints: (workspacePath: string) => Promise<WorkspaceCheckpointInfo[]>;
  restoreWorkspaceCheckpoint: (request: RestoreWorkspaceCheckpointRequest) => Promise<RestoreWorkspaceCheckpointResult>;
  getGitStatus: (workspacePath: string) => Promise<GitFileStatus[]>;
  getGitDiff: (workspacePath: string) => Promise<GitDiffFile[]>;
  detectWorkspaceChecks: (workspacePath: string) => Promise<WorkspaceCheck[]>;
  runWorkspaceCommand: (request: WorkspaceCommandRequest) => Promise<WorkspaceCommandResult>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  getSession: () => Promise<WorkshopSessionSnapshot>;
  saveSession: (session: WorkshopSessionSnapshot) => Promise<WorkshopSessionSnapshot>;
  exportTranscript: (request: ExportTranscriptRequest) => Promise<ExportTranscriptResult | null>;
  exportSettingsBackup: () => Promise<SettingsBackupResult | null>;
  importSettingsBackup: () => Promise<ImportSettingsBackupResult | null>;
  exportSessionBackup: () => Promise<SessionBackupResult | null>;
  importSessionBackup: () => Promise<ImportSessionBackupResult | null>;
  getRuntimeLog: () => Promise<RuntimeLogInfo>;
  clearRuntimeLog: () => Promise<RuntimeLogInfo>;
  openRuntimeLogExternal: () => Promise<void>;
  getAppDiagnostics: () => Promise<AppDiagnosticsInfo>;
  openUserDataFolder: () => Promise<void>;
  getSecretStatus: () => Promise<SecretStatus>;
  saveApiKey: (request: SaveApiKeyRequest) => Promise<void>;
  importAttachments: (request: ImportAttachmentsRequest) => Promise<AttachmentInfo[]>;
  testQwenConnection: (request: QwenConnectionTestRequest) => Promise<QwenConnectionTestResult>;
  startQwenRun: (request: QwenRunRequest) => Promise<QwenRunStarted>;
  interruptQwenRun: (runId: string) => Promise<void>;
  onQwenEvent: (listener: (event: QwenStreamEvent) => void) => () => void;
  onQwenPermissionRequest: (listener: (request: QwenPermissionRequest) => void) => () => void;
  respondQwenPermission: (response: QwenPermissionResponse) => Promise<void>;
  startPreview: (request: PreviewStartRequest) => Promise<PreviewInfo>;
  stopPreview: (previewId: string) => Promise<void>;
  onPreviewEvent: (listener: (event: PreviewEvent) => void) => () => void;
}
