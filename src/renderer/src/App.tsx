import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bolt, BookOpenText, Command, Gauge, PanelRightOpen, ShieldCheck, SlidersHorizontal, Square } from 'lucide-react';
import { DEFAULT_PROMPT_TEMPLATES, QWEN_ENDPOINTS, QWEN_MODELS, getEndpoint, getModel } from '@shared/qwenCatalog';
import type {
  AgentTodoItem,
  AppSettings,
  AttachmentInfo,
  ChatEntry,
  ChatThreadRecord,
  FileTreeNode,
  GitDiffFile,
  GitFileStatus,
  ImagineAsset,
  ImagineGenerateRequest,
  ImagineRunEvent,
  PromptTemplateConfig,
  PreviewEvent,
  PreviewInfo,
  QwenConnectionTestResult,
  QwenPermissionRequest,
  QwenRunStatus,
  QwenStreamEvent,
  SecretStatus,
  WorkspaceCheckpointInfo,
  WorkspaceCommandHistoryItem,
  WorkspaceFileContent,
  WorkspaceMemoryInfo,
  WorkspaceSearchResult,
  WorkspaceCheck,
  WorkspaceCommandResult,
  WorkspaceSessionRecord,
  WorkshopSessionSnapshot,
  WorkspaceInfo
} from '@shared/types';
import { formatQwenErrorForChat } from '@shared/qwenErrors';
import { ChangeReviewPanel } from './components/ChangeReviewPanel';
import { AgentPlanPanel } from './components/AgentPlanPanel';
import { ActivityTimelinePanel } from './components/ActivityTimelinePanel';
import { CheckRunnerPanel } from './components/CheckRunnerPanel';
import { ChatPanel } from './components/ChatPanel';
import { CommandPalette, type CommandPaletteAction } from './components/CommandPalette';
import { FileEditorPanel } from './components/FileEditorPanel';
import { ImaginePanel } from './components/ImaginePanel';
import { ModelSettings } from './components/ModelSettings';
import { OnboardingWizard } from './components/OnboardingWizard';
import { OwnerManual } from './components/OwnerManual';
import { PermissionPrompt } from './components/PermissionPrompt';
import { PreferencesDialog } from './components/PreferencesDialog';
import { PreviewPanel } from './components/PreviewPanel';
import { PromptTemplateManager } from './components/PromptTemplateManager';
import { ProjectToolsPanel, type ProjectDiagnosticItem } from './components/ProjectToolsPanel';
import { RuntimeLogPanel } from './components/RuntimeLogPanel';
import { SessionHistoryPanel } from './components/SessionHistoryPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { ToastStack, type ToastNotice, type ToastTone } from './components/ToastStack';
import { WorkspaceDashboard } from './components/WorkspaceDashboard';
import { WorkspaceExplorer } from './components/WorkspaceExplorer';
import { workshop } from './workshopClient';
import workshopIconUrl from './assets/grok-command-center-icon.png';
import workshopLogoUrl from './assets/grok-command-center-logo.png';

type RightRailView = 'overview' | 'build' | 'runtime' | 'preview' | 'imagine' | 'all';

const RIGHT_RAIL_VIEWS: Array<{ id: RightRailView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'build', label: 'Build' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'preview', label: 'Preview' },
  { id: 'imagine', label: 'Imagine' },
  { id: 'all', label: 'All' }
];

const QWEN_STALL_MS = 45_000;

interface LastRunRequest {
  prompt: string;
  attachments: AttachmentInfo[];
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [secretStatus, setSecretStatus] = useState<SecretStatus>({ xai: false });
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [workspaceSessions, setWorkspaceSessions] = useState<Record<string, WorkspaceSessionRecord>>({});
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFileContent | null>(null);
  const [fileDraft, setFileDraft] = useState('');
  const [fileError, setFileError] = useState('');
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitFileStatus[]>([]);
  const [gitDiffFiles, setGitDiffFiles] = useState<GitDiffFile[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [workspaceChecks, setWorkspaceChecks] = useState<WorkspaceCheck[]>([]);
  const [commandResult, setCommandResult] = useState<WorkspaceCommandResult | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [commandHistory, setCommandHistory] = useState<WorkspaceCommandHistoryItem[]>([]);
  const [isRunningTerminalCommand, setIsRunningTerminalCommand] = useState(false);
  const [workspaceMemory, setWorkspaceMemory] = useState<WorkspaceMemoryInfo | null>(null);
  const [workspaceCheckpoints, setWorkspaceCheckpoints] = useState<WorkspaceCheckpointInfo[]>([]);
  const [isRestoringCheckpoint, setIsRestoringCheckpoint] = useState(false);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThreadRecord[]>([]);
  const [agentTodos, setAgentTodos] = useState<AgentTodoItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<QwenRunStatus | null>(null);
  const [runStatusNow, setRunStatusNow] = useState(() => Date.now());
  const [lastRunRequest, setLastRunRequest] = useState<LastRunRequest | null>(null);
  const [permissionRequests, setPermissionRequests] = useState<QwenPermissionRequest[]>([]);
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);
  const [previewLogs, setPreviewLogs] = useState<string[]>([]);
  const [imagineAssets, setImagineAssets] = useState<ImagineAsset[]>([]);
  const [imagineEvents, setImagineEvents] = useState<ImagineRunEvent[]>([]);
  const [isImagineGenerating, setIsImagineGenerating] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOwnerManualOpen, setIsOwnerManualOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isPromptManagerOpen, setIsPromptManagerOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [rightRailView, setRightRailView] = useState<RightRailView>('overview');
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const workspaceRef = useRef<WorkspaceInfo | null>(null);
  const settingsRef = useRef<AppSettings | null>(null);
  const previewInfoRef = useRef<PreviewInfo | null>(null);
  const recentWorkspacesRef = useRef<WorkspaceInfo[]>([]);
  const workspaceSessionsRef = useRef<Record<string, WorkspaceSessionRecord>>({});
  const chatEntriesRef = useRef<ChatEntry[]>([]);
  const chatThreadsRef = useRef<ChatThreadRecord[]>([]);
  const commandHistoryRef = useRef<WorkspaceCommandHistoryItem[]>([]);
  const agentTodosRef = useRef<AgentTodoItem[]>([]);
  const interruptedRunIdsRef = useRef<Set<string>>(new Set());
  const sessionSaveTimerRef = useRef<number | undefined>(undefined);
  const sessionPersistenceReadyRef = useRef(false);

  useEffect(() => {
    void boot();

    const offQwen = workshop.onQwenEvent(handleQwenEvent);
    const offPermission = workshop.onQwenPermissionRequest(handleQwenPermissionRequest);
    const offPreview = workshop.onPreviewEvent(handlePreviewEvent);
    const offImagine = workshop.onImagineEvent(handleImagineEvent);

    return () => {
      void saveSessionNow();
      offQwen();
      offPermission();
      offPreview();
      offImagine();
      if (sessionSaveTimerRef.current) {
        window.clearTimeout(sessionSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    previewInfoRef.current = previewInfo;
  }, [previewInfo]);

  useEffect(() => {
    recentWorkspacesRef.current = recentWorkspaces;
  }, [recentWorkspaces]);

  useEffect(() => {
    workspaceSessionsRef.current = workspaceSessions;
  }, [workspaceSessions]);

  useEffect(() => {
    chatEntriesRef.current = chatEntries;
  }, [chatEntries]);

  useEffect(() => {
    chatThreadsRef.current = chatThreads;
  }, [chatThreads]);

  useEffect(() => {
    commandHistoryRef.current = commandHistory;
  }, [commandHistory]);

  useEffect(() => {
    agentTodosRef.current = agentTodos;
  }, [agentTodos]);

  useEffect(() => {
    if (!runStatus || !isRunInProgress(runStatus)) {
      return;
    }

    const timer = window.setInterval(() => {
      const now = Date.now();
      setRunStatusNow(now);
      setRunStatus((status) => markRunStalled(status, now));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [runStatus?.runId, runStatus?.phase]);

  useEffect(() => {
    if (sessionPersistenceReadyRef.current) {
      scheduleSessionSave();
    }
  }, [workspace, recentWorkspaces, workspaceSessions, chatEntries, chatThreads, commandHistory, agentTodos, previewInfo]);

  useEffect(() => {
    if (settings && !settings.onboardingCompleted) {
      setIsOnboardingOpen(true);
    }
  }, [settings]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      if (event.key === 'F1') {
        event.preventDefault();
        setIsOwnerManualOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeEndpoint = useMemo(() => (settings ? getEndpoint(settings.endpointKey) : QWEN_ENDPOINTS[0]), [settings]);
  const activeModel = useMemo(() => (settings ? getModel(settings.modelId) : QWEN_MODELS[0]), [settings]);
  const usageEstimate = useMemo(() => estimateUsageTokens(chatEntries), [chatEntries]);
  const usageLimit = settings?.usageLimitTokens ?? 0;
  const usagePercent = usageLimit ? Math.min(100, Math.round((usageEstimate / usageLimit) * 100)) : 0;
  const isQwenRunning = Boolean(activeRunId) || Boolean(runStatus && isRunInProgress(runStatus));
  const currentThreadTitle = useMemo(() => deriveThreadTitle(chatEntries), [chatEntries]);
  const visibleMessageCount = useMemo(
    () => chatEntries.filter(isUserFacingChatEntry).length,
    [chatEntries]
  );
  const commandPaletteActions = useMemo<CommandPaletteAction[]>(() => {
    const workspaceReady = Boolean(workspace);
    const previewActive = isPreviewActive(previewInfo);
    const baseActions: CommandPaletteAction[] = [
      {
        id: 'help-owner-manual',
        label: "Open owner's manual",
        group: 'Help',
        description: 'Search app features, workflows, shortcuts, and troubleshooting',
        run: () => setIsOwnerManualOpen(true)
      },
      {
        id: 'runtime-log-open',
        label: 'Open runtime log',
        group: 'Help',
        description: 'Open the desktop crash and runtime log in the system editor',
        run: () => void openRuntimeLogExternal()
      },
      {
        id: 'diagnostics-show',
        label: 'Show diagnostics',
        group: 'Help',
        description: 'Open runtime diagnostics, storage paths, and crash log tools',
        run: () => setRightRailView('runtime')
      },
      {
        id: 'setup-wizard',
        label: 'Open setup wizard',
        group: 'Help',
        description: 'Configure model, endpoint, key, permissions, and workspace',
        run: () => setIsOnboardingOpen(true)
      },
      {
        id: 'prompt-templates',
        label: 'Manage prompt templates',
        group: 'Chat',
        description: 'Edit the reusable prompt chips under chat',
        run: () => setIsPromptManagerOpen(true)
      },
      {
        id: 'layout-overview',
        label: 'Show overview rail',
        group: 'Layout',
        description: 'Focus the right rail on dashboard, activity, and chat history',
        run: () => setRightRailView('overview')
      },
      {
        id: 'layout-build',
        label: 'Show build rail',
        group: 'Layout',
        description: 'Focus the right rail on memory, plans, checks, and terminal',
        run: () => setRightRailView('build')
      },
      {
        id: 'layout-runtime',
        label: 'Show runtime rail',
        group: 'Layout',
        description: 'Focus the right rail on activity, logs, plan, and terminal',
        run: () => setRightRailView('runtime')
      },
      {
        id: 'layout-preview',
        label: 'Show preview rail',
        group: 'Layout',
        description: 'Focus the right rail on preview and recent activity',
        run: () => setRightRailView('preview')
      },
      {
        id: 'layout-imagine',
        label: 'Show Imagine suite',
        group: 'Layout',
        description: 'Generate images and videos into the open workspace',
        run: () => setRightRailView('imagine')
      },
      {
        id: 'layout-all',
        label: 'Show all rail panels',
        group: 'Layout',
        description: 'Show every right rail panel in one scroll',
        run: () => setRightRailView('all')
      },
      {
        id: 'workspace-open',
        label: 'Open folder',
        group: 'Workspace',
        description: 'Choose a local project folder',
        run: () => void selectWorkspace()
      },
      {
        id: 'workspace-refresh',
        label: 'Refresh workspace',
        group: 'Workspace',
        description: 'Reload files, checks, memory, and git status',
        disabled: !workspaceReady,
        run: () => void refreshCurrentWorkspace()
      },
      {
        id: 'changes-review',
        label: 'Review changes',
        group: 'Git',
        description: 'Open the git diff drawer',
        disabled: !workspaceReady,
        run: () => void openChangeReview()
      },
      {
        id: 'preview-start',
        label: 'Start live preview',
        group: 'Preview',
        description: 'Run the detected preview server',
        disabled: !workspaceReady || previewActive,
        run: () => void startPreview()
      },
      {
        id: 'preview-stop',
        label: 'Stop live preview',
        group: 'Preview',
        description: 'Stop the active preview server',
        disabled: !previewActive,
        run: () => void stopPreview()
      },
      {
        id: 'chat-new',
        label: 'New chat session',
        group: 'Chat',
        description: 'Archive the current transcript and start fresh',
        disabled: !workspaceReady || isQwenRunning,
        run: () => startNewChatSession()
      },
      {
        id: 'chat-delete-current',
        label: 'Delete current chat',
        group: 'Chat',
        description: 'Clear the active chat without saving it to history',
        disabled: !workspaceReady || isQwenRunning || !visibleMessageCount,
        run: () => deleteCurrentChatSession()
      },
      {
        id: 'chat-export',
        label: 'Export transcript',
        group: 'Chat',
        description: 'Save the visible transcript as Markdown',
        disabled: !workspaceReady || !visibleMessageCount,
        run: () => void exportTranscript()
      },
      {
        id: 'chat-retry-last',
        label: 'Retry last Grok prompt',
        group: 'Chat',
        description: 'Send the last prompt and attachments again',
        disabled: !workspaceReady || isQwenRunning || !lastRunRequest,
        run: () => void retryLastQwen()
      },
      {
        id: 'preferences-open',
        label: 'Open preferences',
        group: 'Settings',
        description: 'Edit model, endpoint, preview, usage, and backup settings',
        run: () => setIsPreferencesOpen(true)
      },
      {
        id: 'settings-export',
        label: 'Export settings',
        group: 'Settings',
        description: 'Save a non-secret settings backup',
        run: () => void exportSettingsBackup()
      },
      {
        id: 'settings-import',
        label: 'Import settings',
        group: 'Settings',
        description: 'Restore a non-secret settings backup',
        run: () => void importSettingsBackup()
      },
      {
        id: 'session-export',
        label: 'Export session backup',
        group: 'Settings',
        description: 'Save recent workspaces, chats, command history, and panel state',
        run: () => void exportSessionBackup()
      },
      {
        id: 'session-import',
        label: 'Import session backup',
        group: 'Settings',
        description: 'Restore recent workspaces, chats, command history, and panel state',
        disabled: isQwenRunning,
        run: () => void importSessionBackup()
      },
      {
        id: 'terminal-git-status',
        label: 'Run git status',
        group: 'Terminal',
        description: 'git status --short',
        disabled: !workspaceReady || isRunningTerminalCommand,
        run: () => void runTerminalCommand('git status --short')
      },
      {
        id: 'terminal-git-diff',
        label: 'Run git diff stat',
        group: 'Terminal',
        description: 'git diff --stat',
        disabled: !workspaceReady || isRunningTerminalCommand,
        run: () => void runTerminalCommand('git diff --stat')
      }
    ];

    const checkActions = workspaceChecks.slice(0, 6).map<CommandPaletteAction>((check) => ({
      id: `check-${check.id}`,
      label: `Run ${check.label}`,
      group: 'Checks',
      description: check.command,
      disabled: !workspaceReady || isRunningCheck,
      run: () => void runWorkspaceCheck(check)
    }));

    return [...baseActions, ...checkActions];
  }, [
    isRunningCheck,
    isRunningTerminalCommand,
    isQwenRunning,
    lastRunRequest,
    previewInfo,
    visibleMessageCount,
    workspace,
    workspaceChecks
  ]);
  const projectDiagnostics = useMemo<ProjectDiagnosticItem[]>(
    () => [
      {
        label: 'Bridge',
        value: workshop.isDesktopBridge ? 'Desktop' : 'Browser',
        tone: workshop.isDesktopBridge ? 'ok' : 'warning'
      },
      {
        label: 'Model',
        value: activeModel.name,
        tone: 'muted'
      },
      {
        label: 'Endpoint',
        value: activeEndpoint.label,
        tone: 'muted'
      },
      {
        label: 'Preview',
        value: previewInfo?.status ?? 'idle',
        tone: previewInfo?.status === 'running' ? 'ok' : 'muted'
      },
      {
        label: 'xAI',
        value: secretStatus.xai ? 'Saved' : 'Missing',
        tone: secretStatus.xai ? 'ok' : 'warning'
      },
      {
        label: 'Usage',
        value: `${formatTokenCount(usageEstimate)} / ${formatTokenCount(usageLimit)}`,
        tone: usagePercent >= 80 ? 'warning' : 'muted'
      }
    ],
    [
      activeEndpoint.label,
      activeModel.name,
      previewInfo?.status,
      secretStatus,
      usageEstimate,
      usageLimit,
      usagePercent
    ]
  );

  async function boot(): Promise<void> {
    const [loadedSettings, loadedSecrets, savedSession, diagnostics] = await Promise.all([
      workshop.getSettings(),
      workshop.getSecretStatus(),
      workshop.getSession(),
      workshop.getAppDiagnostics().catch(() => null)
    ]);
    const activeRecord = getActiveWorkspaceRecord(savedSession);

    setSettings(loadedSettings);
    setAppVersion(diagnostics?.appVersion ?? '');
    setSecretStatus(loadedSecrets);
    setRecentWorkspaces(savedSession.recentWorkspaces);
    setWorkspaceSessions(savedSession.workspaces);

    if (activeRecord) {
      setWorkspace(activeRecord.workspace);
      setChatEntries(activeRecord.chatEntries);
      setChatThreads(activeRecord.threads ?? []);
      setCommandHistory(activeRecord.commandHistory ?? []);
      setAgentTodos(activeRecord.agentTodos ?? []);
      await refreshWorkspace(activeRecord.workspace.path);
      await refreshWorkspaceChecks(activeRecord.workspace.path);
      await refreshProjectTools(activeRecord.workspace.path);
      await loadImagineAssets(activeRecord.workspace.path);
    }

    sessionPersistenceReadyRef.current = true;

    if (activeRecord?.previewActive) {
      window.setTimeout(() => {
        void startPreviewFor(activeRecord.workspace, loadedSettings, { automatic: true });
      }, 450);
    }
  }

  async function selectWorkspace(): Promise<void> {
    const selected = await workshop.selectWorkspace();
    if (!selected) {
      return;
    }

    await openWorkspace(selected);
  }

  async function openWorkspace(selected: WorkspaceInfo, options: { announce?: boolean } = {}): Promise<void> {
    const mergedSessions = captureCurrentWorkspaceSession();
    const targetSession = readWorkspaceRecord(mergedSessions, selected.path);

    await stopCurrentPreview();

    setWorkspaceSessions(mergedSessions);
    setWorkspace(selected);
    setChatEntries(targetSession?.chatEntries ?? []);
    setChatThreads(targetSession?.threads ?? []);
    setCommandHistory(targetSession?.commandHistory ?? []);
    setAgentTodos(targetSession?.agentTodos ?? []);
    setPreviewInfo(null);
    setPreviewLogs([]);
    setImagineAssets([]);
    setImagineEvents([]);
    setIsImagineGenerating(false);
    setCommandResult(null);
    setGitDiffFiles([]);
    setWorkspaceMemory(null);
    setWorkspaceCheckpoints([]);
    setSelectedFile(null);
    setFileDraft('');
    setFileError('');
    setSearchResults([]);
    setRecentWorkspaces((items) => rememberWorkspace(selected, items));

    await refreshWorkspace(selected.path);
    await refreshWorkspaceChecks(selected.path);
    await refreshProjectTools(selected.path);
    await loadImagineAssets(selected.path);

    if (options.announce ?? true) {
      appendEntry('system', `${targetSession ? 'Workspace reopened' : 'Workspace opened'}: ${selected.path}`);
    }
  }

  async function forgetRecentWorkspace(selected: WorkspaceInfo): Promise<void> {
    const selectedKey = workspaceKey(selected.path);
    const currentWorkspace = workspaceRef.current;
    const isCurrentWorkspace = Boolean(currentWorkspace && workspaceKey(currentWorkspace.path) === selectedKey);

    if (isCurrentWorkspace && activeRunId) {
      appendEntry('error', 'Stop the active Grok run before removing the open folder from Recents.');
      return;
    }

    setRecentWorkspaces((items) => items.filter((item) => workspaceKey(item.path) !== selectedKey));

    if (!isCurrentWorkspace) {
      pushToast('info', 'Recent folder removed', selected.name);
      return;
    }

    await closeCurrentWorkspaceView({
      toastTitle: 'Recent folder removed',
      toastDetail: `${selected.name} was closed from the workspace view.`
    });
  }

  async function clearRecentWorkspaces(): Promise<void> {
    const recentItems = recentWorkspacesRef.current;

    if (!recentItems.length) {
      return;
    }

    const currentWorkspace = workspaceRef.current;
    const currentKey = currentWorkspace ? workspaceKey(currentWorkspace.path) : '';
    const closesCurrentWorkspace = Boolean(
      currentWorkspace && recentItems.some((item) => workspaceKey(item.path) === currentKey)
    );

    if (closesCurrentWorkspace && activeRunId) {
      appendEntry('error', 'Stop the active Grok run before clearing Recents for the open folder.');
      return;
    }

    if (!window.confirm('Clear all recent folders? This only removes shortcuts and does not delete any folders from disk.')) {
      return;
    }

    setRecentWorkspaces([]);

    if (closesCurrentWorkspace) {
      await closeCurrentWorkspaceView({
        toastTitle: 'Recent folders cleared',
        toastDetail: 'The open workspace was closed from the workspace view.'
      });
      return;
    }

    pushToast('info', 'Recent folders cleared');
  }

  async function closeCurrentWorkspaceView(options: { saveSession?: boolean; toastTitle?: string; toastDetail?: string } = {}): Promise<void> {
    const mergedSessions = options.saveSession === false ? workspaceSessionsRef.current : captureCurrentWorkspaceSession();

    try {
      await stopCurrentPreview();
    } catch (error) {
      pushToast('warning', 'Preview stop failed', error instanceof Error ? error.message : String(error));
    }

    setWorkspaceSessions(mergedSessions);
    setWorkspace(null);
    setChatEntries([]);
    setChatThreads([]);
    setCommandHistory([]);
    setAgentTodos([]);
    setPermissionRequests([]);
    setRunStatus(null);
    setLastRunRequest(null);
    setPreviewInfo(null);
    setPreviewLogs([]);
    setImagineAssets([]);
    setImagineEvents([]);
    setIsImagineGenerating(false);
    setCommandResult(null);
    setGitDiffFiles([]);
    setWorkspaceMemory(null);
    setWorkspaceCheckpoints([]);
    setWorkspaceChecks([]);
    setGitStatus([]);
    setFileTree([]);
    setSelectedFile(null);
    setFileDraft('');
    setFileError('');
    setSearchResults([]);
    setRightRailView('overview');

    if (options.toastTitle) {
      pushToast('info', options.toastTitle, options.toastDetail);
    }
  }

  async function refreshWorkspace(workspacePath = workspaceRef.current?.path): Promise<FileTreeNode[]> {
    if (!workspacePath) {
      return [];
    }

    try {
      const [tree, status] = await Promise.all([
        workshop.loadFileTree(workspacePath),
        workshop.getGitStatus(workspacePath)
      ]);

      setFileTree(tree);
      setGitStatus(status);
      return tree;
    } catch (error) {
      setFileTree([]);
      setGitStatus([]);
      appendEntry('error', `Could not refresh workspace: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async function refreshWorkspaceChecks(workspacePath = workspaceRef.current?.path): Promise<void> {
    if (!workspacePath) {
      setWorkspaceChecks([]);
      return;
    }

    try {
      setWorkspaceChecks(await workshop.detectWorkspaceChecks(workspacePath));
    } catch {
      setWorkspaceChecks([]);
    }
  }

  async function refreshProjectTools(workspacePath = workspaceRef.current?.path): Promise<void> {
    if (!workspacePath) {
      setWorkspaceMemory(null);
      setWorkspaceCheckpoints([]);
      return;
    }

    try {
      const [memory, checkpoints] = await Promise.all([
        workshop.getWorkspaceMemory(workspacePath),
        workshop.listWorkspaceCheckpoints(workspacePath)
      ]);
      setWorkspaceMemory(memory);
      setWorkspaceCheckpoints(checkpoints);
    } catch (error) {
      appendEntry('error', `Could not refresh project tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function refreshCurrentWorkspace(): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before refreshing.');
      return;
    }

    await Promise.all([
      refreshWorkspace(currentWorkspace.path),
      refreshWorkspaceChecks(currentWorkspace.path),
      refreshProjectTools(currentWorkspace.path),
      loadImagineAssets(currentWorkspace.path),
      isReviewOpen ? loadGitDiff(currentWorkspace.path) : Promise.resolve()
    ]);
  }

  async function saveWorkspaceMemory(content: string): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before saving memory.');
      return;
    }

    try {
      const saved = await workshop.saveWorkspaceMemory({
        workspacePath: currentWorkspace.path,
        content
      });
      setWorkspaceMemory(saved);
      appendEntry('system', 'Project memory saved.');
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function restoreWorkspaceCheckpoint(checkpointId: string): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before restoring checkpoints.');
      return;
    }

    const checkpoint = workspaceCheckpoints.find((item) => item.id === checkpointId);
    const confirmed = window.confirm(
      `Restore files from ${checkpoint ? formatCheckpointForConfirm(checkpoint) : 'this checkpoint'}?\n\nThis overwrites matching files from the snapshot but does not delete newer files.`
    );

    if (!confirmed) {
      return;
    }

    setIsRestoringCheckpoint(true);

    try {
      const result = await workshop.restoreWorkspaceCheckpoint({
        workspacePath: currentWorkspace.path,
        checkpointId
      });
      appendEntry('system', `Restored ${result.restoredFiles} files from checkpoint ${formatCheckpointForConfirm(result.checkpoint)}.`);
      await refreshWorkspace(currentWorkspace.path);
      await refreshWorkspaceChecks(currentWorkspace.path);
      await refreshProjectTools(currentWorkspace.path);
      await loadGitDiff(currentWorkspace.path);
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    } finally {
      setIsRestoringCheckpoint(false);
    }
  }

  async function openWorkspaceFile(filePath: string): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before opening files.');
      return;
    }

    setIsFileLoading(true);
    setFileError('');

    try {
      const file = await workshop.readWorkspaceFile({
        workspacePath: currentWorkspace.path,
        filePath
      });
      setSelectedFile(file);
      setFileDraft(file.content);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsFileLoading(false);
    }
  }

  async function saveOpenFile(): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace || !selectedFile) {
      return;
    }

    setIsFileLoading(true);
    setFileError('');

    try {
      const saved = await workshop.saveWorkspaceFile({
        workspacePath: currentWorkspace.path,
        filePath: selectedFile.path,
        content: fileDraft
      });
      setSelectedFile(saved);
      setFileDraft(saved.content);
      await refreshWorkspace(currentWorkspace.path);
      appendEntry('system', `Saved ${saved.relativePath}`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsFileLoading(false);
    }
  }

  async function reloadOpenFile(): Promise<void> {
    if (selectedFile) {
      await openWorkspaceFile(selectedFile.path);
    }
  }

  async function copyOpenFile(): Promise<void> {
    if (!selectedFile || selectedFile.isBinary) {
      return;
    }

    await copyText(fileDraft);
  }

  async function openSelectedFileExternal(): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace || !selectedFile) {
      return;
    }

    try {
      await workshop.openWorkspaceFileExternal({
        workspacePath: currentWorkspace.path,
        filePath: selectedFile.path
      });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  }

  async function searchWorkspace(query: string): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace || !query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      setSearchResults(
        await workshop.searchWorkspace({
          workspacePath: currentWorkspace.path,
          query,
          maxResults: 60
        })
      );
    } catch (error) {
      setSearchResults([]);
      appendEntry('error', `Search failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSearching(false);
    }
  }

  async function openChangeReview(): Promise<void> {
    setIsReviewOpen(true);
    await loadGitDiff();
  }

  async function loadGitDiff(workspacePath = workspaceRef.current?.path): Promise<void> {
    if (!workspacePath) {
      setGitDiffFiles([]);
      return;
    }

    setIsLoadingDiff(true);

    try {
      setGitDiffFiles(await workshop.getGitDiff(workspacePath));
    } catch (error) {
      appendEntry('error', `Could not load git diff: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingDiff(false);
    }
  }

  async function runWorkspaceCheck(check: WorkspaceCheck): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before running checks.');
      return;
    }

    setIsRunningCheck(true);
    setCommandResult(null);
    appendEntry('system', `Running check: ${check.command}`);

    try {
      const result = await workshop.runWorkspaceCommand({
        workspacePath: currentWorkspace.path,
        command: check.command
      });
      setCommandResult(result);
      rememberCommandResult(result);
      appendEntry(result.ok ? 'system' : 'error', formatCommandResultForChat(result));
      if (result.ok) {
        pushToast('success', 'Check passed', check.label);
      }
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunningCheck(false);
    }
  }

  async function runTerminalCommand(command: string): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before running terminal commands.');
      return;
    }

    setIsRunningTerminalCommand(true);
    appendEntry('system', `Running command: ${command}`);

    try {
      const result = await workshop.runWorkspaceCommand({
        workspacePath: currentWorkspace.path,
        command
      });
      rememberCommandResult(result);
      appendEntry(result.ok ? 'system' : 'error', formatCommandResultForChat(result));
      if (result.ok) {
        pushToast('success', 'Command complete', command);
      }
      await refreshWorkspace(currentWorkspace.path);
      await refreshWorkspaceChecks(currentWorkspace.path);
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunningTerminalCommand(false);
    }
  }

  function clearCommandHistory(): void {
    setCommandHistory([]);
  }

  function rememberCommandResult(result: WorkspaceCommandResult): void {
    setCommandHistory((items) => [
      {
        ...result,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      },
      ...items
    ].slice(0, 30));
  }

  async function exportTranscript(): Promise<void> {
    const currentWorkspace = workspaceRef.current;
    const entries = chatEntriesRef.current.filter(isUserFacingChatEntry);

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before exporting a transcript.');
      return;
    }

    if (!entries.length) {
      appendEntry('error', 'There is no visible transcript to export yet.');
      return;
    }

    try {
      const result = await workshop.exportTranscript({
        workspaceName: currentWorkspace.name,
        workspacePath: currentWorkspace.path,
        entries
      });

      if (result) {
        appendEntry('system', `Transcript exported: ${result.path}`);
        pushToast('success', 'Transcript exported', result.path);
      }
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function exportSettingsBackup(): Promise<void> {
    try {
      const result = await workshop.exportSettingsBackup();

      if (result) {
        appendEntry('system', `Settings backup exported: ${result.path}`);
        pushToast('success', 'Settings exported', result.path);
      }
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function importSettingsBackup(): Promise<void> {
    if (!window.confirm('Import Grok Command Center settings from a backup? Current non-secret settings will be updated.')) {
      return;
    }

    try {
      const result = await workshop.importSettingsBackup();

      if (result) {
        setSettings(result.settings);
        appendEntry('system', `Settings imported: ${result.path}`);
        pushToast('success', 'Settings imported', result.path);
      }
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function exportSessionBackup(): Promise<void> {
    try {
      await saveSessionNow();
      const result = await workshop.exportSessionBackup();

      if (result) {
        appendEntry('system', `Session backup exported: ${result.path}`);
        pushToast('success', 'Session exported', result.path);
      }
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function importSessionBackup(): Promise<void> {
    if (activeRunId) {
      appendEntry('error', 'Stop the active Grok run before importing a session backup.');
      return;
    }

    if (!window.confirm('Import a Grok Command Center session backup? Current remembered workspaces, chats, command history, and preview state will be replaced.')) {
      return;
    }

    try {
      const result = await workshop.importSessionBackup();

      if (result) {
        await applySessionSnapshot(result.session);
        appendEntry('system', `Session backup imported: ${result.path}`);
        pushToast('success', 'Session imported', result.path);
      }
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function applySessionSnapshot(session: WorkshopSessionSnapshot): Promise<void> {
    await stopCurrentPreview();
    const activeRecord = getActiveWorkspaceRecord(session);

    sessionPersistenceReadyRef.current = false;
    setWorkspaceSessions(session.workspaces);
    setRecentWorkspaces(session.recentWorkspaces);
    setWorkspace(activeRecord?.workspace ?? null);
    setChatEntries(activeRecord?.chatEntries ?? []);
    setChatThreads(activeRecord?.threads ?? []);
    setCommandHistory(activeRecord?.commandHistory ?? []);
    setAgentTodos(activeRecord?.agentTodos ?? []);
    setPreviewInfo(null);
    setPreviewLogs([]);
    setCommandResult(null);
    setGitDiffFiles([]);
    setSelectedFile(null);
    setFileDraft('');
    setFileError('');
    setSearchResults([]);
    setWorkspaceMemory(null);
    setWorkspaceCheckpoints([]);
    setWorkspaceChecks([]);
    setGitStatus([]);
    setFileTree([]);
    setRightRailView('overview');

    if (activeRecord) {
      await refreshWorkspace(activeRecord.workspace.path);
      await refreshWorkspaceChecks(activeRecord.workspace.path);
      await refreshProjectTools(activeRecord.workspace.path);
    }

    window.setTimeout(() => {
      sessionPersistenceReadyRef.current = true;
      void saveSessionNow();
    }, 0);
  }

  function startNewChatSession(): void {
    if (activeRunId) {
      appendEntry('error', 'Stop the active Grok run before starting a new chat session.');
      return;
    }

    const visibleEntries = chatEntriesRef.current.filter(isUserFacingChatEntry);
    if (visibleEntries.length && !window.confirm('Start a new chat session for this workspace? The current transcript will be cleared from the app session.')) {
      return;
    }

    const archivedThread = buildThreadFromCurrentSession();
    if (archivedThread) {
      setChatThreads((threads) => [archivedThread, ...threads].slice(0, 24));
    }

    setChatEntries([]);
    setAgentTodos([]);
    setPermissionRequests([]);
  }

  function restoreChatThread(threadId: string): void {
    if (activeRunId) {
      appendEntry('error', 'Stop the active Grok run before switching chat sessions.');
      return;
    }

    const thread = chatThreadsRef.current.find((item) => item.id === threadId);
    if (!thread) {
      return;
    }

    const currentArchive = buildThreadFromCurrentSession();
    const confirmed =
      !currentArchive ||
      window.confirm('Open this saved chat session? The current session will be saved in history first.');

    if (!confirmed) {
      return;
    }

    setChatThreads((threads) => {
      const remaining = threads.filter((item) => item.id !== threadId);
      return currentArchive ? [currentArchive, ...remaining].slice(0, 24) : remaining;
    });
    setChatEntries(thread.chatEntries);
    setCommandHistory(thread.commandHistory ?? commandHistoryRef.current);
    setAgentTodos(thread.agentTodos ?? []);
    setPermissionRequests([]);
  }

  function deleteChatThread(threadId: string): void {
    const thread = chatThreadsRef.current.find((item) => item.id === threadId);
    if (!thread) {
      return;
    }

    if (!window.confirm(`Delete saved chat "${thread.title}"?`)) {
      return;
    }

    setChatThreads((threads) => threads.filter((item) => item.id !== threadId));
  }

  function deleteCurrentChatSession(): void {
    if (activeRunId) {
      appendEntry('error', 'Stop the active Grok run before deleting the current chat.');
      return;
    }

    const visibleEntries = chatEntriesRef.current.filter(isUserFacingChatEntry);
    if (!visibleEntries.length) {
      setChatEntries([]);
      setAgentTodos([]);
      setPermissionRequests([]);
      setRunStatus(null);
      setLastRunRequest(null);
      return;
    }

    if (!window.confirm('Delete the current chat? This clears it from the app session without saving it to history.')) {
      return;
    }

    setChatEntries([]);
    setAgentTodos([]);
    setPermissionRequests([]);
    setRunStatus(null);
    setLastRunRequest(null);
  }

  async function saveSettings(nextSettings: AppSettings): Promise<void> {
    const saved = await workshop.saveSettings(nextSettings);
    setSettings(saved);
  }

  async function completeOnboarding(nextSettings: AppSettings): Promise<void> {
    await saveSettings(nextSettings);
    setIsOnboardingOpen(false);
    appendEntry('system', 'Grok Command Center setup complete.');
    pushToast('success', 'Setup complete', 'Grok Command Center is ready.');
  }

  async function savePromptTemplates(templates: PromptTemplateConfig[]): Promise<void> {
    const currentSettings = settingsRef.current;

    if (!currentSettings) {
      return;
    }

    await saveSettings({
      ...currentSettings,
      promptTemplates: templates
    });
    pushToast('success', 'Templates saved', `${templates.length} prompt templates available.`);
  }

  async function resetPromptTemplates(): Promise<void> {
    const currentSettings = settingsRef.current;

    if (!currentSettings) {
      return;
    }

    await saveSettings({
      ...currentSettings,
      promptTemplates: DEFAULT_PROMPT_TEMPLATES
    });
    pushToast('success', 'Templates reset', 'Default prompt templates restored.');
  }

  async function saveApiKey(kind: 'xai', value: string): Promise<void> {
    await workshop.saveApiKey({ kind, value });
    setSecretStatus(await workshop.getSecretStatus());
    pushToast('success', 'API key saved', 'xAI key updated.');
  }

  async function testQwenConnection(): Promise<QwenConnectionTestResult> {
    if (!settings) {
      throw new Error('Settings are not loaded yet.');
    }

    return workshop.testQwenConnection({
      modelId: settings.modelId,
      endpointKey: settings.endpointKey
    });
  }

  async function importAttachments(files: File[]): Promise<AttachmentInfo[]> {
    if (!workspace) {
      appendEntry('error', 'Open a workspace before attaching files.');
      return [];
    }

    const sourcePaths = workshop.resolveFilePaths(files);
    if (!sourcePaths.length) {
      appendEntry('error', 'Grok Command Center could not resolve local paths for those files.');
      return [];
    }

    try {
      const attachments = await workshop.importAttachments({
        workspacePath: workspace.path,
        sourcePaths
      });

      void refreshWorkspace(workspace.path);
      pushToast('success', 'Files attached', `${attachments.length} file${attachments.length === 1 ? '' : 's'} ready for Grok.`);
      return attachments;
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  async function loadImagineAssets(workspacePath = workspaceRef.current?.path): Promise<void> {
    if (!workspacePath) {
      setImagineAssets([]);
      return;
    }

    try {
      setImagineAssets(await workshop.listImagineAssets({ workspacePath, limit: 80 }));
    } catch (error) {
      setImagineAssets([]);
      appendEntry('error', `Could not load Imagine assets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function generateImagineAsset(request: ImagineGenerateRequest): Promise<void> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      appendEntry('error', 'Open a workspace before using Imagine.');
      return;
    }

    setIsImagineGenerating(true);
    setImagineEvents([]);
    setRightRailView('imagine');

    try {
      const result = await workshop.generateImagineAsset(request);
      setImagineAssets((assets) => mergeImagineAssets(result.assets, assets));
      await refreshWorkspace(currentWorkspace.path);
      await loadImagineAssets(currentWorkspace.path);
      appendEntry(
        'system',
        `Imagine saved ${result.assets.length} ${result.assets.length === 1 ? 'asset' : 'assets'}:\n${result.assets.map((asset) => `- ${asset.relativePath}`).join('\n')}`
      );
      pushToast('success', 'Imagine complete', result.assets.map((asset) => asset.name).join(', '));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEntry('error', message);
      pushToast('error', 'Imagine failed', message);
    } finally {
      setIsImagineGenerating(false);
    }
  }

  async function openImagineAsset(assetPath: string): Promise<void> {
    try {
      await workshop.openImagineAssetExternal(assetPath);
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function startQwen(prompt: string, attachments: AttachmentInfo[] = []): Promise<void> {
    if (!workspace || !settings) {
      appendEntry('error', 'Open a workspace before starting Grok.');
      return;
    }

    const promptText = prompt.trim() || (attachments.length ? 'Please review the attached file(s).' : '');
    const nextUsageEstimate =
      estimateUsageTokens(chatEntriesRef.current) + estimateTextTokens(promptText) + estimateAttachmentTokens(attachments);

    if (settings.usageLimitTokens && nextUsageEstimate >= settings.usageLimitTokens) {
      appendEntry(
        'error',
        `Local usage limit reached (${formatTokenCount(nextUsageEstimate)} / ${formatTokenCount(settings.usageLimitTokens)} estimated tokens). Raise the usage limit in settings or start a new workspace/session.`
      );
      return;
    }

    appendEntry('user', promptText, attachments);
    setLastRunRequest({ prompt: promptText, attachments });
    setAgentTodos([]);

    try {
      const result = await workshop.startQwenRun({
        workspacePath: workspace.path,
        prompt: promptText,
        attachments,
        modelId: settings.modelId,
        endpointKey: settings.endpointKey,
        permissionMode: settings.permissionMode,
        thinkingEnabled: settings.thinkingEnabled,
        thinkingBudget: settings.thinkingBudget,
        qwenExecutablePath: settings.qwenExecutablePath
      });

      const startedAt = new Date().toISOString();
      interruptedRunIdsRef.current.delete(result.runId);
      setActiveRunId(result.runId);
      setRunStatus({
        runId: result.runId,
        phase: 'running',
        modelId: settings.modelId,
        modelName: activeModel.name,
        endpointLabel: activeEndpoint.label,
        permissionMode: settings.permissionMode,
        prompt: promptText,
        attachmentCount: attachments.length,
        startedAt,
        lastEventAt: startedAt,
        lastEventKind: 'started'
      });
      setRunStatusNow(Date.now());
      pushToast('info', 'Grok started', activeModel.name);
    } catch (error) {
      const formatted = formatQwenErrorForChat(error);
      const failedAt = new Date().toISOString();
      setRunStatus({
        runId: `failed-${crypto.randomUUID()}`,
        phase: 'error',
        modelId: settings.modelId,
        modelName: activeModel.name,
        endpointLabel: activeEndpoint.label,
        permissionMode: settings.permissionMode,
        prompt: promptText,
        attachmentCount: attachments.length,
        startedAt: failedAt,
        lastEventAt: failedAt,
        completedAt: failedAt,
        errorText: formatted
      });
      appendEntry('error', formatted);
    }
  }

  async function interruptQwen(): Promise<void> {
    const runId = activeRunId;

    if (!runId) {
      return;
    }

    interruptedRunIdsRef.current.add(runId);
    const stoppedAt = new Date().toISOString();

    try {
      await workshop.interruptQwenRun(runId);
    } catch (error) {
      appendEntry('error', formatQwenErrorForChat(error));
    } finally {
      setActiveRunId((currentRunId) => (currentRunId === runId ? null : currentRunId));
      setRunStatus((status) =>
        status?.runId === runId
          ? {
              ...status,
              phase: 'interrupted',
              lastEventAt: stoppedAt,
              completedAt: stoppedAt
            }
          : status
      );
      appendEntry('system', 'Grok run interrupted.');
      pushToast('warning', 'Grok interrupted', 'The active run was stopped.');
    }
  }

  async function retryLastQwen(): Promise<void> {
    if (!lastRunRequest) {
      appendEntry('error', 'There is no Grok prompt to retry yet.');
      return;
    }

    await startQwen(lastRunRequest.prompt, lastRunRequest.attachments);
  }

  async function startPreview(options: { automatic?: boolean } = {}): Promise<void> {
    const currentWorkspace = workspaceRef.current;
    const currentSettings = settingsRef.current;

    if (!currentWorkspace || !currentSettings) {
      appendEntry('error', 'Open a workspace before starting preview.');
      return;
    }

    await startPreviewFor(currentWorkspace, currentSettings, options);
  }

  async function startPreviewFor(
    currentWorkspace: WorkspaceInfo,
    currentSettings: AppSettings,
    options: { automatic?: boolean } = {}
  ): Promise<void> {
    try {
      const info = await workshop.startPreview({
        workspacePath: currentWorkspace.path,
        port: currentSettings.previewPort,
        command: currentSettings.previewCommand || undefined
      });
      setPreviewInfo(info);
      setPreviewLogs((logs) => [...logs, `${options.automatic ? 'Auto-starting' : 'Starting'} ${formatPreviewCommand(info.command)}`]);
      pushToast('info', options.automatic ? 'Preview auto-starting' : 'Preview starting', formatPreviewCommand(info.command));
    } catch (error) {
      setPreviewLogs((logs) => [...logs, error instanceof Error ? error.message : String(error)]);
      pushToast('error', 'Preview failed', error instanceof Error ? error.message : String(error));
    }
  }

  async function stopPreview(): Promise<void> {
    await stopPreviewByInfo(previewInfoRef.current);
  }

  async function stopCurrentPreview(): Promise<void> {
    await stopPreviewByInfo(previewInfoRef.current);
  }

  async function stopPreviewByInfo(info: PreviewInfo | null): Promise<void> {
    if (!info) {
      return;
    }

    await workshop.stopPreview(info.previewId);
    setPreviewInfo((currentInfo) => (currentInfo ? { ...currentInfo, status: 'stopped' } : currentInfo));
    pushToast('info', 'Preview stopped', formatPreviewCommand(info.command));
  }

  function handleQwenEvent(event: QwenStreamEvent): void {
    markRunEvent(event);

    if (event.kind === 'done') {
      void completeQwenRun();
    }

    if (event.kind === 'todo') {
      setAgentTodos(event.todos ?? []);
      return;
    }

    if (event.kind === 'started' || event.kind === 'done') {
      appendEntry('system', event.text ?? event.kind);
      return;
    }

    if (!event.text) {
      return;
    }

    if (event.kind === 'error') {
      if (event.fatal && interruptedRunIdsRef.current.has(event.runId)) {
        return;
      }

      appendEntry('error', formatQwenErrorForChat(event.text));
      return;
    }

    appendEntry(event.kind, event.text);
  }

  function markRunEvent(event: QwenStreamEvent): void {
    const observedAt = new Date().toISOString();
    setRunStatusNow(Date.now());
    setRunStatus((status) => {
      if (!status || status.runId !== event.runId) {
        return status;
      }

      if (status.phase === 'interrupted') {
        return status;
      }

      const isFatalError = event.kind === 'error' && Boolean(event.fatal);
      const isDone = event.kind === 'done';
      const formattedError = event.kind === 'error' && event.text ? formatQwenErrorForChat(event.text) : status.errorText;

      return {
        ...status,
        phase: isDone ? 'completed' : isFatalError ? 'error' : isRunInProgress(status) ? 'running' : status.phase,
        lastEventAt: observedAt,
        lastEventKind: event.kind,
        ...(event.kind === 'tool' && event.text ? { lastTool: event.text } : {}),
        ...(formattedError ? { errorText: formattedError } : {}),
        ...(isDone || isFatalError ? { completedAt: observedAt } : {})
      };
    });

    if (event.kind === 'error' && event.fatal) {
      setActiveRunId((runId) => (runId === event.runId ? null : runId));
      void refreshWorkspace();
      void refreshProjectTools();
    }
  }

  function handleQwenPermissionRequest(request: QwenPermissionRequest): void {
    setPermissionRequests((requests) => {
      if (requests.some((item) => item.requestId === request.requestId)) {
        return requests;
      }

      return [...requests, request];
    });
    pushToast('warning', 'Grok needs approval', request.summary);
  }

  async function respondToPermission(request: QwenPermissionRequest, approved: boolean): Promise<void> {
    await workshop.respondQwenPermission({
      requestId: request.requestId,
      approved
    });
    setPermissionRequests((requests) => requests.filter((item) => item.requestId !== request.requestId));
    appendEntry('system', `${approved ? 'Approved' : 'Denied'}: ${request.summary}`);
  }

  async function completeQwenRun(): Promise<void> {
    const completedAt = new Date().toISOString();
    setActiveRunId(null);
    setRunStatus((status) =>
      status && isRunInProgress(status)
        ? {
            ...status,
            phase: 'completed',
            lastEventAt: completedAt,
            completedAt
          }
        : status
    );
    const tree = await refreshWorkspace();
    await refreshProjectTools();
    pushToast('success', 'Grok complete', 'Workspace refreshed after the run.');

    if (hasRootIndexHtml(tree) && !isPreviewActive(previewInfoRef.current)) {
      appendEntry('system', 'Detected index.html. Starting live preview.');
      await startPreview({ automatic: true });
    }
  }

  function handlePreviewEvent(event: PreviewEvent): void {
    setPreviewLogs((logs) => [...logs.slice(-300), event.text]);

    if (event.kind === 'url' && event.url) {
      setPreviewInfo((info) => (info ? { ...info, url: event.url ?? info.url, status: 'running' } : info));
      pushToast('success', 'Preview running', event.url);
    }

    if (event.kind === 'error') {
      pushToast('error', 'Preview error', event.text);
    }

    if (event.kind === 'stopped') {
      setPreviewInfo((info) => (info ? { ...info, status: 'stopped' } : info));
      pushToast('info', 'Preview stopped', event.text);
    }
  }

  function handleImagineEvent(event: ImagineRunEvent): void {
    setImagineEvents((events) => [event, ...events].slice(0, 12));

    if (event.phase === 'saved') {
      void loadImagineAssets();
    }
  }

  function appendEntry(role: ChatEntry['role'], text: string, attachments?: AttachmentInfo[]): void {
    if (role === 'error') {
      pushToast('error', 'Grok Command Center', compactToast(text));
    }

    setChatEntries((entries) => [
      ...entries,
      {
        id: crypto.randomUUID(),
        role,
        text,
        createdAt: new Date().toISOString(),
        ...(attachments?.length ? { attachments } : {})
      }
    ]);
  }

  function pushToast(tone: ToastTone, title: string, message?: string): void {
    const id = crypto.randomUUID();
    const notice: ToastNotice = {
      id,
      tone,
      title,
      ...(message ? { message: compactToast(message) } : {})
    };

    setToasts((items) => [...items, notice].slice(-5));
    window.setTimeout(() => dismissToast(id), 5200);
  }

  function dismissToast(id: string): void {
    setToasts((items) => items.filter((item) => item.id !== id));
  }

  async function openRuntimeLogExternal(): Promise<void> {
    try {
      await workshop.openRuntimeLogExternal();
      pushToast('info', 'Runtime log opened');
    } catch (error) {
      appendEntry('error', error instanceof Error ? error.message : String(error));
    }
  }

  function scheduleSessionSave(): void {
    if (sessionSaveTimerRef.current) {
      window.clearTimeout(sessionSaveTimerRef.current);
    }

    sessionSaveTimerRef.current = window.setTimeout(() => {
      void saveSessionNow();
    }, 650);
  }

  async function saveSessionNow(): Promise<void> {
    if (!sessionPersistenceReadyRef.current) {
      return;
    }

    try {
      await workshop.saveSession(buildSessionSnapshot());
    } catch (error) {
      console.warn('Failed to save Grok Command Center session.', error);
    }
  }

  function buildSessionSnapshot(): WorkshopSessionSnapshot {
    const currentWorkspace = workspaceRef.current;

    return {
      activeWorkspacePath: currentWorkspace?.path,
      recentWorkspaces: recentWorkspacesRef.current,
      workspaces: captureCurrentWorkspaceSession(),
      updatedAt: new Date().toISOString()
    };
  }

  function captureCurrentWorkspaceSession(): Record<string, WorkspaceSessionRecord> {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace) {
      return workspaceSessionsRef.current;
    }

    return {
      ...workspaceSessionsRef.current,
      [workspaceKey(currentWorkspace.path)]: {
        workspace: currentWorkspace,
        chatEntries: chatEntriesRef.current,
        commandHistory: commandHistoryRef.current,
        agentTodos: agentTodosRef.current,
        threads: chatThreadsRef.current,
        previewActive: isPreviewActive(previewInfoRef.current),
        updatedAt: new Date().toISOString()
      }
    };
  }

  function buildThreadFromCurrentSession(): ChatThreadRecord | null {
    const visibleEntries = chatEntriesRef.current.filter(isUserFacingChatEntry);

    if (!visibleEntries.length) {
      return null;
    }

    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      title: deriveThreadTitle(chatEntriesRef.current),
      chatEntries: chatEntriesRef.current,
      commandHistory: commandHistoryRef.current,
      agentTodos: agentTodosRef.current,
      createdAt: visibleEntries[0]?.createdAt ?? now,
      updatedAt: now
    };
  }

  function isPreviewActive(info: PreviewInfo | null): boolean {
    return info?.status === 'running' || info?.status === 'starting';
  }

  function hasRootIndexHtml(nodes: FileTreeNode[]): boolean {
    return nodes.some((node) => node.kind === 'file' && node.name.toLowerCase() === 'index.html');
  }

  function formatPreviewCommand(command: string): string {
    return command === 'grok-command-center-static' ? 'static preview' : command;
  }

  function formatCheckpointForConfirm(checkpoint: WorkspaceCheckpointInfo): string {
    const createdAt = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(checkpoint.createdAt));

    return `${createdAt} (${checkpoint.fileCount} files)`;
  }

  function workspaceKey(workspacePath: string): string {
    return workspacePath.trim().toLowerCase();
  }

  function getActiveWorkspaceRecord(session: WorkshopSessionSnapshot): WorkspaceSessionRecord | undefined {
    return session.activeWorkspacePath ? readWorkspaceRecord(session.workspaces, session.activeWorkspacePath) : undefined;
  }

  function readWorkspaceRecord(
    records: Record<string, WorkspaceSessionRecord>,
    workspacePath: string
  ): WorkspaceSessionRecord | undefined {
    const key = workspaceKey(workspacePath);
    return records[key] ?? Object.values(records).find((record) => workspaceKey(record.workspace.path) === key);
  }

  function rememberWorkspace(selected: WorkspaceInfo, items: WorkspaceInfo[]): WorkspaceInfo[] {
    const selectedKey = workspaceKey(selected.path);
    return [selected, ...items.filter((item) => workspaceKey(item.path) !== selectedKey)].slice(0, 12);
  }

  function rightRailMeta(view: RightRailView): string {
    if (view === 'overview') {
      return workspace ? `${gitStatus.length} changes` : 'start';
    }

    if (view === 'build') {
      return `${workspaceChecks.length} checks`;
    }

    if (view === 'runtime') {
      return runStatus && isRunInProgress(runStatus) ? runStatus.phase : `${commandHistory.length} cmds`;
    }

    if (view === 'preview') {
      return previewInfo?.status ?? 'idle';
    }

    if (view === 'imagine') {
      return isImagineGenerating ? 'working' : `${imagineAssets.length} assets`;
    }

    return 'full';
  }

  if (!settings) {
    return (
      <div className="boot-screen">
        <img className="boot-logo" src={workshopLogoUrl} alt="" />
        <p>Starting Grok Command Center</p>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-icon" src={workshopIconUrl} alt="" />
          <div>
            <h1>Grok Command Center</h1>
            <span>xAI-native desktop command center{appVersion ? ` - v${appVersion}` : ''}</span>
          </div>
        </div>

        <div className="status-strip">
          <button className="icon-button" title="Command palette" onClick={() => setIsCommandPaletteOpen(true)}>
            <Command size={15} />
          </button>
          <button className="icon-button" title="Owner's manual" onClick={() => setIsOwnerManualOpen(true)}>
            <BookOpenText size={15} />
          </button>
          <button className="icon-button" title="Preferences" onClick={() => setIsPreferencesOpen(true)}>
            <SlidersHorizontal size={15} />
          </button>
          <span className="status-pill">
            <Activity size={14} />
            {activeModel.name}
          </span>
          <span
            className={`status-pill usage-pill ${usagePercent >= 100 ? 'usage-danger' : usagePercent >= 80 ? 'usage-warning' : ''}`}
            title="Local estimated session usage. Provider quota may differ."
          >
            <Gauge size={14} />
            {formatTokenCount(usageEstimate)} / {formatTokenCount(usageLimit)}
          </span>
          <span className="status-pill muted">{activeEndpoint.label}</span>
          <span className={`status-pill mode-${settings.permissionMode}`}>
            <Bolt size={14} />
            {settings.permissionMode}
          </span>
          <span className={`status-pill ${workshop.isDesktopBridge ? 'bridge-ok' : 'bridge-missing'}`}>
            <ShieldCheck size={14} />
            {workshop.isDesktopBridge ? 'Desktop bridge' : 'Preview only'}
          </span>
          {activeRunId ? (
            <button className="icon-button danger" title="Interrupt Grok" onClick={interruptQwen}>
              <Square size={15} />
            </button>
          ) : null}
        </div>
      </header>

      {!workshop.isDesktopBridge ? (
        <div className="bridge-warning">
          Browser preview mode: Grok, folders, secrets, and preview servers only work in the Electron desktop app.
        </div>
      ) : null}

      <section className="workspace-grid">
        <WorkspaceExplorer
          workspace={workspace}
          recentWorkspaces={recentWorkspaces}
          fileTree={fileTree}
          gitStatus={gitStatus}
          selectedFilePath={selectedFile?.path}
          searchResults={searchResults}
          isSearching={isSearching}
          onOpenWorkspace={selectWorkspace}
          onOpenRecentWorkspace={(recentWorkspace) => openWorkspace(recentWorkspace)}
          onForgetRecentWorkspace={forgetRecentWorkspace}
          onClearRecentWorkspaces={clearRecentWorkspaces}
          onOpenFile={(filePath) => void openWorkspaceFile(filePath)}
          onSearch={(query) => void searchWorkspace(query)}
          onReviewChanges={openChangeReview}
          onRefresh={() => refreshWorkspace()}
        />

        <div className={`center-stack ${selectedFile || fileError ? 'with-editor' : ''}`}>
          <ModelSettings
            settings={settings}
            secretStatus={secretStatus}
            onSaveSettings={saveSettings}
            onSaveApiKey={saveApiKey}
            onTestConnection={testQwenConnection}
          />
          {selectedFile || fileError ? (
            <FileEditorPanel
              file={selectedFile}
              draft={fileDraft}
              isDirty={Boolean(selectedFile && fileDraft !== selectedFile.content)}
              isLoading={isFileLoading}
              error={fileError}
              onDraftChange={setFileDraft}
              onClose={() => {
                setSelectedFile(null);
                setFileDraft('');
                setFileError('');
              }}
              onCopy={copyOpenFile}
              onOpenExternal={openSelectedFileExternal}
              onReload={reloadOpenFile}
              onSave={saveOpenFile}
            />
          ) : null}
          <ChatPanel
            entries={chatEntries}
            isRunning={isQwenRunning}
            runStatus={runStatus}
            runStatusNow={runStatusNow}
            canRetry={Boolean(workspace && lastRunRequest) && !isQwenRunning}
            workspaceReady={Boolean(workspace)}
            promptTemplates={settings.promptTemplates}
            onImportAttachments={importAttachments}
            onSubmit={startQwen}
            onRetryLast={retryLastQwen}
            onExportTranscript={exportTranscript}
            onNewSession={startNewChatSession}
            onDeleteSession={deleteCurrentChatSession}
            onManagePromptTemplates={() => setIsPromptManagerOpen(true)}
            onInterrupt={interruptQwen}
          />
        </div>

        <div className="right-stack">
          <div className="right-rail-tabs" role="tablist" aria-label="Right rail view">
            {RIGHT_RAIL_VIEWS.map((view) => (
              <button
                aria-selected={rightRailView === view.id}
                className={`right-rail-tab ${rightRailView === view.id ? 'active' : ''}`}
                key={view.id}
                onClick={() => setRightRailView(view.id)}
                role="tab"
                type="button"
              >
                <span>{view.label}</span>
                <small>{rightRailMeta(view.id)}</small>
              </button>
            ))}
          </div>

          {(rightRailView === 'overview' || rightRailView === 'all') ? (
            <WorkspaceDashboard
              workspace={workspace}
              gitStatus={gitStatus}
              checks={workspaceChecks}
              checkpoints={workspaceCheckpoints}
              commandHistory={commandHistory}
              chatEntries={chatEntries}
              previewInfo={previewInfo}
              imagineAssetCount={imagineAssets.length}
              usageText={`${formatTokenCount(usageEstimate)} / ${formatTokenCount(usageLimit)}`}
              usagePercent={usagePercent}
              isRunning={isQwenRunning}
              onOpenWorkspace={selectWorkspace}
              onReviewChanges={openChangeReview}
              onStartPreview={() => startPreview()}
              onRunFirstCheck={() => (workspaceChecks[0] ? runWorkspaceCheck(workspaceChecks[0]) : Promise.resolve())}
              onRefresh={refreshCurrentWorkspace}
            />
          ) : null}

          {(rightRailView === 'overview' || rightRailView === 'runtime' || rightRailView === 'preview' || rightRailView === 'all') ? (
            <ActivityTimelinePanel
              chatEntries={chatEntries}
              commandHistory={commandHistory}
              previewInfo={previewInfo}
              isRunning={isQwenRunning}
            />
          ) : null}

          {(rightRailView === 'overview' || rightRailView === 'all') ? (
            <SessionHistoryPanel
              currentTitle={currentThreadTitle}
              currentMessageCount={visibleMessageCount}
              threads={chatThreads}
              isRunning={isQwenRunning}
              workspaceReady={Boolean(workspace)}
              onNewSession={startNewChatSession}
              onDeleteCurrentSession={deleteCurrentChatSession}
              onRestoreThread={restoreChatThread}
              onDeleteThread={deleteChatThread}
            />
          ) : null}

          {(rightRailView === 'build' || rightRailView === 'all') ? (
            <ProjectToolsPanel
              memory={workspaceMemory}
              checkpoints={workspaceCheckpoints}
              diagnostics={projectDiagnostics}
              workspaceReady={Boolean(workspace)}
              isRestoring={isRestoringCheckpoint}
              onRefresh={refreshProjectTools}
              onSaveMemory={saveWorkspaceMemory}
              onRestoreCheckpoint={restoreWorkspaceCheckpoint}
              onExportSettings={exportSettingsBackup}
              onImportSettings={importSettingsBackup}
            />
          ) : null}

          {(rightRailView === 'runtime' || rightRailView === 'all') ? (
            <RuntimeLogPanel
              onLoad={workshop.getRuntimeLog}
              onClear={workshop.clearRuntimeLog}
              onOpenExternal={workshop.openRuntimeLogExternal}
              onLoadDiagnostics={workshop.getAppDiagnostics}
              onOpenUserDataFolder={workshop.openUserDataFolder}
            />
          ) : null}

          {(rightRailView === 'build' || rightRailView === 'runtime' || rightRailView === 'all') ? (
            <AgentPlanPanel todos={agentTodos} isRunning={isQwenRunning} />
          ) : null}

          {(rightRailView === 'build' || rightRailView === 'all') ? (
            <CheckRunnerPanel
              checks={workspaceChecks}
              isRunning={isRunningCheck}
              result={commandResult}
              workspaceReady={Boolean(workspace)}
              onRun={runWorkspaceCheck}
            />
          ) : null}

          {(rightRailView === 'build' || rightRailView === 'runtime' || rightRailView === 'all') ? (
            <TerminalPanel
              checks={workspaceChecks}
              history={commandHistory}
              isRunning={isRunningTerminalCommand}
              workspaceReady={Boolean(workspace)}
              onRun={runTerminalCommand}
              onClear={clearCommandHistory}
            />
          ) : null}

          {(rightRailView === 'preview' || rightRailView === 'all') ? (
            <PreviewPanel
              previewInfo={previewInfo}
              logs={previewLogs}
              workspaceReady={Boolean(workspace)}
              onStart={startPreview}
              onStop={stopPreview}
              onConfigure={() => setIsPreferencesOpen(true)}
            />
          ) : null}

          {(rightRailView === 'imagine' || rightRailView === 'all') ? (
            <ImaginePanel
              workspace={workspace}
              secretStatus={secretStatus}
              assets={imagineAssets}
              events={imagineEvents}
              isGenerating={isImagineGenerating}
              onGenerate={generateImagineAsset}
              onRefresh={loadImagineAssets}
              onOpenAsset={openImagineAsset}
            />
          ) : null}
        </div>
      </section>

      <ChangeReviewPanel
        files={gitDiffFiles}
        isOpen={isReviewOpen}
        isLoading={isLoadingDiff}
        onClose={() => setIsReviewOpen(false)}
        onRefresh={loadGitDiff}
      />

      <PermissionPrompt
        request={permissionRequests[0] ?? null}
        queueCount={permissionRequests.length}
        onApprove={(request) => respondToPermission(request, true)}
        onDeny={(request) => respondToPermission(request, false)}
      />

      <CommandPalette
        actions={commandPaletteActions}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <OwnerManual isOpen={isOwnerManualOpen} onClose={() => setIsOwnerManualOpen(false)} />

      <PreferencesDialog
        isOpen={isPreferencesOpen}
        settings={settings}
        onClose={() => setIsPreferencesOpen(false)}
        onSaveSettings={saveSettings}
        onExportSettings={exportSettingsBackup}
        onImportSettings={importSettingsBackup}
        onExportSession={exportSessionBackup}
        onImportSession={importSessionBackup}
        onOpenSetup={() => setIsOnboardingOpen(true)}
        onManagePromptTemplates={() => setIsPromptManagerOpen(true)}
      />

      <PromptTemplateManager
        isOpen={isPromptManagerOpen}
        templates={settings.promptTemplates}
        onClose={() => setIsPromptManagerOpen(false)}
        onSave={savePromptTemplates}
        onReset={resetPromptTemplates}
      />

      <OnboardingWizard
        isOpen={isOnboardingOpen}
        settings={settings}
        secretStatus={secretStatus}
        workspace={workspace}
        onSaveApiKey={saveApiKey}
        onOpenWorkspace={selectWorkspace}
        onComplete={completeOnboarding}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <ToastStack notices={toasts} onDismiss={dismissToast} />

      <button className="floating-layout-button" title="Grok Command Center layout">
        <PanelRightOpen size={18} />
      </button>
    </main>
  );
}

function isRunInProgress(status: QwenRunStatus): boolean {
  return status.phase === 'running' || status.phase === 'stalled';
}

function isUserFacingChatEntry(entry: ChatEntry): boolean {
  return entry.role !== 'raw' && entry.role !== 'reasoning' && entry.role !== 'tool' && entry.role !== 'started' && entry.role !== 'todo';
}

function markRunStalled(status: QwenRunStatus | null, now: number): QwenRunStatus | null {
  if (!status || status.phase !== 'running') {
    return status;
  }

  const lastEventAt = Date.parse(status.lastEventAt);
  if (Number.isNaN(lastEventAt) || now - lastEventAt < QWEN_STALL_MS) {
    return status;
  }

  return {
    ...status,
    phase: 'stalled'
  };
}

function mergeImagineAssets(incoming: ImagineAsset[], current: ImagineAsset[]): ImagineAsset[] {
  const seen = new Set<string>();
  return [...incoming, ...current]
    .filter((asset) => {
      const key = asset.path.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 80);
}

function estimateUsageTokens(entries: ChatEntry[]): number {
  return entries.reduce((total, entry) => {
    if (entry.role === 'raw') {
      return total;
    }

    return total + estimateTextTokens(entry.text) + estimateAttachmentTokens(entry.attachments ?? []);
  }, 0);
}

function deriveThreadTitle(entries: ChatEntry[]): string {
  const userEntry = entries.find((entry) => entry.role === 'user' && entry.text.trim());
  const fallbackEntry = entries.find((entry) => isUserFacingChatEntry(entry) && entry.text.trim());
  const source = userEntry?.text ?? fallbackEntry?.text ?? 'New chat';
  const singleLine = source.replace(/\s+/g, ' ').trim();

  return singleLine.length > 54 ? `${singleLine.slice(0, 51)}...` : singleLine;
}

function estimateTextTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function estimateAttachmentTokens(attachments: AttachmentInfo[]): number {
  return attachments.reduce((total, attachment) => {
    const metadataTokens = estimateTextTokens(`${attachment.name} ${attachment.path} ${attachment.mimeType}`);
    return total + metadataTokens + estimateTextTokens(attachment.textPreview ?? '');
  }, 0);
}

function formatTokenCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return String(value);
}

function formatCommandResultForChat(result: WorkspaceCommandResult): string {
  const header = `${result.command} ${result.ok ? 'passed' : 'failed'} in ${(result.durationMs / 1000).toFixed(1)}s.`;
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

  if (!output) {
    return header;
  }

  const limit = 5000;
  const clipped = output.length > limit ? `${output.slice(output.length - limit)}\n[output clipped]` : output;
  return `${header}\n\n${clipped}`;
}

function compactToast(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > 120 ? `${singleLine.slice(0, 117)}...` : singleLine;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
