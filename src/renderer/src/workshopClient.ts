import { DEFAULT_SETTINGS } from '@shared/qwenCatalog';
import type { WorkshopApi } from '@shared/types';

const mockWorkshop: WorkshopApi = {
  isDesktopBridge: false,
  resolveFilePaths: () => [],
  selectWorkspace: async () => null,
  loadFileTree: async () => [],
  readWorkspaceFile: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  saveWorkspaceFile: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  openWorkspaceFileExternal: async () => undefined,
  searchWorkspace: async () => [],
  getWorkspaceMemory: async () => ({
    path: '',
    content: '# Grok Command Center Memory\n\n## Project Rules\n- \n',
    exists: false
  }),
  saveWorkspaceMemory: async (request) => ({
    path: '',
    content: request.content,
    exists: false
  }),
  listWorkspaceCheckpoints: async () => [],
  restoreWorkspaceCheckpoint: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  getGitStatus: async () => [],
  getGitDiff: async () => [],
  detectWorkspaceChecks: async () => [],
  runWorkspaceCommand: async (request) => ({
    command: request.command,
    exitCode: null,
    ok: false,
    durationMs: 0,
    stdout: '',
    stderr: 'Grok Command Center desktop bridge is not available in browser preview.'
  }),
  getSettings: async () => DEFAULT_SETTINGS,
  saveSettings: async (settings) => settings,
  getSession: async () => ({
    recentWorkspaces: [],
    workspaces: {},
    updatedAt: new Date().toISOString()
  }),
  saveSession: async (session) => session,
  exportTranscript: async () => null,
  exportSettingsBackup: async () => null,
  importSettingsBackup: async () => null,
  exportSessionBackup: async () => null,
  importSessionBackup: async () => null,
  getRuntimeLog: async () => ({
    path: '',
    exists: false,
    content: ''
  }),
  clearRuntimeLog: async () => ({
    path: '',
    exists: false,
    content: ''
  }),
  openRuntimeLogExternal: async () => undefined,
  getAppDiagnostics: async () => ({
    appName: 'Grok Command Center',
    appVersion: '0.1.0',
    mode: 'development',
    isPackaged: false,
    platform: 'browser',
    arch: 'unknown',
    electronVersion: '',
    chromeVersion: '',
    nodeVersion: '',
    v8Version: '',
    userDataPath: '',
    appPath: '',
    resourcesPath: '',
    executablePath: '',
    currentWorkingDirectory: '',
    settingsPath: '',
    sessionPath: '',
    secretsPath: '',
    runtimeLogPath: '',
    files: {
      settings: { path: '', exists: false, size: 0 },
      session: { path: '', exists: false, size: 0 },
      secrets: { path: '', exists: false, size: 0 },
      runtimeLog: { path: '', exists: false, size: 0 }
    },
    generatedAt: new Date().toISOString()
  }),
  openUserDataFolder: async () => undefined,
  getSecretStatus: async () => ({ xai: false }),
  saveApiKey: async () => undefined,
  importAttachments: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  generateImagineAsset: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  listImagineAssets: async () => [],
  openImagineAssetExternal: async () => undefined,
  onImagineEvent: () => () => undefined,
  testQwenConnection: async (request) => ({
    ok: false,
    message: 'Grok Command Center desktop bridge is not available in browser preview.',
    latencyMs: 0,
    modelId: request.modelId,
    endpointLabel: request.endpointKey
  }),
  startQwenRun: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  interruptQwenRun: async () => undefined,
  onQwenEvent: () => () => undefined,
  onQwenPermissionRequest: () => () => undefined,
  respondQwenPermission: async () => undefined,
  startPreview: async () => {
    throw new Error('Grok Command Center desktop bridge is not available in browser preview.');
  },
  stopPreview: async () => undefined,
  onPreviewEvent: () => () => undefined
};

export const workshop: WorkshopApi = window.workshop ?? mockWorkshop;
