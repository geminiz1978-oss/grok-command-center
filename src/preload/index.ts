import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AppSettings,
  AppDiagnosticsInfo,
  AttachmentInfo,
  ExportTranscriptRequest,
  ExportTranscriptResult,
  FileTreeNode,
  GitFileStatus,
  GitDiffFile,
  ImagineAsset,
  ImagineGalleryRequest,
  ImagineGenerateRequest,
  ImagineGenerateResult,
  ImagineRunEvent,
  ImportAttachmentsRequest,
  ImportSessionBackupResult,
  ImportSettingsBackupResult,
  PreviewEvent,
  PreviewInfo,
  PreviewStartRequest,
  QwenConnectionTestRequest,
  QwenConnectionTestResult,
  QwenPermissionRequest,
  QwenPermissionResponse,
  QwenRunRequest,
  QwenRunStarted,
  QwenStreamEvent,
  RestoreWorkspaceCheckpointRequest,
  RestoreWorkspaceCheckpointResult,
  RuntimeLogInfo,
  SaveWorkspaceFileRequest,
  SaveApiKeyRequest,
  SaveWorkspaceMemoryRequest,
  SecretStatus,
  SessionBackupResult,
  SettingsBackupResult,
  WorkshopApi,
  WorkspaceCheckpointInfo,
  WorkspaceFileContent,
  WorkspaceFileRequest,
  WorkspaceMemoryInfo,
  WorkspaceSearchRequest,
  WorkspaceSearchResult,
  WorkshopSessionSnapshot,
  WorkspaceCheck,
  WorkspaceCommandRequest,
  WorkspaceCommandResult,
  WorkspaceInfo
} from '../shared/types';

const api: WorkshopApi = {
  isDesktopBridge: true,
  resolveFilePaths: (files: File[]) => files.map((file) => webUtils.getPathForFile(file)).filter(Boolean),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select') as Promise<WorkspaceInfo | null>,
  loadFileTree: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:file-tree', workspacePath) as Promise<FileTreeNode[]>,
  readWorkspaceFile: (request: WorkspaceFileRequest) =>
    ipcRenderer.invoke('workspace:file-read', request) as Promise<WorkspaceFileContent>,
  saveWorkspaceFile: (request: SaveWorkspaceFileRequest) =>
    ipcRenderer.invoke('workspace:file-save', request) as Promise<WorkspaceFileContent>,
  openWorkspaceFileExternal: (request: WorkspaceFileRequest) =>
    ipcRenderer.invoke('workspace:file-open-external', request) as Promise<void>,
  searchWorkspace: (request: WorkspaceSearchRequest) =>
    ipcRenderer.invoke('workspace:search', request) as Promise<WorkspaceSearchResult[]>,
  getWorkspaceMemory: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:memory-get', workspacePath) as Promise<WorkspaceMemoryInfo>,
  saveWorkspaceMemory: (request: SaveWorkspaceMemoryRequest) =>
    ipcRenderer.invoke('workspace:memory-save', request) as Promise<WorkspaceMemoryInfo>,
  listWorkspaceCheckpoints: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:checkpoints-list', workspacePath) as Promise<WorkspaceCheckpointInfo[]>,
  restoreWorkspaceCheckpoint: (request: RestoreWorkspaceCheckpointRequest) =>
    ipcRenderer.invoke('workspace:checkpoint-restore', request) as Promise<RestoreWorkspaceCheckpointResult>,
  getGitStatus: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:git-status', workspacePath) as Promise<GitFileStatus[]>,
  getGitDiff: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:git-diff', workspacePath) as Promise<GitDiffFile[]>,
  detectWorkspaceChecks: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:checks', workspacePath) as Promise<WorkspaceCheck[]>,
  runWorkspaceCommand: (request: WorkspaceCommandRequest) =>
    ipcRenderer.invoke('workspace:run-command', request) as Promise<WorkspaceCommandResult>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings) as Promise<AppSettings>,
  getSession: () => ipcRenderer.invoke('session:get') as Promise<WorkshopSessionSnapshot>,
  saveSession: (session: WorkshopSessionSnapshot) =>
    ipcRenderer.invoke('session:save', session) as Promise<WorkshopSessionSnapshot>,
  exportTranscript: (request: ExportTranscriptRequest) =>
    ipcRenderer.invoke('session:export-transcript', request) as Promise<ExportTranscriptResult | null>,
  exportSettingsBackup: () =>
    ipcRenderer.invoke('settings:export-backup') as Promise<SettingsBackupResult | null>,
  importSettingsBackup: () =>
    ipcRenderer.invoke('settings:import-backup') as Promise<ImportSettingsBackupResult | null>,
  exportSessionBackup: () =>
    ipcRenderer.invoke('session:export-backup') as Promise<SessionBackupResult | null>,
  importSessionBackup: () =>
    ipcRenderer.invoke('session:import-backup') as Promise<ImportSessionBackupResult | null>,
  getRuntimeLog: () => ipcRenderer.invoke('runtime-log:get') as Promise<RuntimeLogInfo>,
  clearRuntimeLog: () => ipcRenderer.invoke('runtime-log:clear') as Promise<RuntimeLogInfo>,
  openRuntimeLogExternal: () => ipcRenderer.invoke('runtime-log:open-external') as Promise<void>,
  getAppDiagnostics: () => ipcRenderer.invoke('diagnostics:get') as Promise<AppDiagnosticsInfo>,
  openUserDataFolder: () => ipcRenderer.invoke('diagnostics:open-user-data') as Promise<void>,
  getSecretStatus: () => ipcRenderer.invoke('secrets:status') as Promise<SecretStatus>,
  saveApiKey: (request: SaveApiKeyRequest) => ipcRenderer.invoke('secrets:save', request) as Promise<void>,
  importAttachments: (request: ImportAttachmentsRequest) =>
    ipcRenderer.invoke('attachments:import', request) as Promise<AttachmentInfo[]>,
  generateImagineAsset: (request: ImagineGenerateRequest) =>
    ipcRenderer.invoke('imagine:generate', request) as Promise<ImagineGenerateResult>,
  listImagineAssets: (request: ImagineGalleryRequest) =>
    ipcRenderer.invoke('imagine:list', request) as Promise<ImagineAsset[]>,
  openImagineAssetExternal: (assetPath: string) =>
    ipcRenderer.invoke('imagine:open-external', assetPath) as Promise<void>,
  onImagineEvent: (listener: (event: ImagineRunEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ImagineRunEvent): void => listener(payload);
    ipcRenderer.on('imagine:event', wrapped);
    return () => ipcRenderer.removeListener('imagine:event', wrapped);
  },
  testQwenConnection: (request: QwenConnectionTestRequest) =>
    ipcRenderer.invoke('qwen:test', request) as Promise<QwenConnectionTestResult>,
  startQwenRun: (request: QwenRunRequest) => ipcRenderer.invoke('qwen:start', request) as Promise<QwenRunStarted>,
  interruptQwenRun: (runId: string) => ipcRenderer.invoke('qwen:interrupt', runId) as Promise<void>,
  onQwenEvent: (listener: (event: QwenStreamEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: QwenStreamEvent): void => listener(payload);
    ipcRenderer.on('qwen:event', wrapped);
    return () => ipcRenderer.removeListener('qwen:event', wrapped);
  },
  onQwenPermissionRequest: (listener: (request: QwenPermissionRequest) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: QwenPermissionRequest): void => listener(payload);
    ipcRenderer.on('qwen:permission-request', wrapped);
    return () => ipcRenderer.removeListener('qwen:permission-request', wrapped);
  },
  respondQwenPermission: (response: QwenPermissionResponse) =>
    ipcRenderer.invoke('qwen:permission-response', response) as Promise<void>,
  startPreview: (request: PreviewStartRequest) =>
    ipcRenderer.invoke('preview:start', request) as Promise<PreviewInfo>,
  stopPreview: (previewId: string) => ipcRenderer.invoke('preview:stop', previewId) as Promise<void>,
  onPreviewEvent: (listener: (event: PreviewEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: PreviewEvent): void => listener(payload);
    ipcRenderer.on('preview:event', wrapped);
    return () => ipcRenderer.removeListener('preview:event', wrapped);
  }
};

contextBridge.exposeInMainWorld('workshop', api);
