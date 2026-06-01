import { Activity, CheckCircle2, DatabaseBackup, GitBranch, Gauge, Play, RefreshCw, Sparkles } from 'lucide-react';
import type {
  ChatEntry,
  GitFileStatus,
  PreviewInfo,
  WorkspaceCheck,
  WorkspaceCheckpointInfo,
  WorkspaceCommandHistoryItem,
  WorkspaceInfo
} from '@shared/types';

interface WorkspaceDashboardProps {
  workspace: WorkspaceInfo | null;
  gitStatus: GitFileStatus[];
  checks: WorkspaceCheck[];
  checkpoints: WorkspaceCheckpointInfo[];
  commandHistory: WorkspaceCommandHistoryItem[];
  chatEntries: ChatEntry[];
  previewInfo: PreviewInfo | null;
  imagineAssetCount: number;
  usageText: string;
  usagePercent: number;
  isRunning: boolean;
  onOpenWorkspace: () => Promise<void>;
  onReviewChanges: () => Promise<void>;
  onStartPreview: () => Promise<void>;
  onRunFirstCheck: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function WorkspaceDashboard({
  workspace,
  gitStatus,
  checks,
  checkpoints,
  commandHistory,
  chatEntries,
  previewInfo,
  imagineAssetCount,
  usageText,
  usagePercent,
  isRunning,
  onOpenWorkspace,
  onReviewChanges,
  onStartPreview,
  onRunFirstCheck,
  onRefresh
}: WorkspaceDashboardProps): JSX.Element {
  const lastCommand = commandHistory[0];
  const lastAssistant = [...chatEntries].reverse().find((entry) => entry.role === 'assistant' || entry.role === 'result');
  const previewActive = previewInfo?.status === 'running' || previewInfo?.status === 'starting';

  return (
    <section className="panel workspace-dashboard">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h2>{workspace?.name ?? 'No workspace'}</h2>
        </div>
        <button className="icon-button" title="Refresh dashboard" disabled={!workspace} onClick={() => void onRefresh()}>
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="dashboard-metrics">
        <Metric icon={<GitBranch size={14} />} label="Changes" value={String(gitStatus.length)} tone={gitStatus.length ? 'warning' : 'muted'} />
        <Metric icon={<CheckCircle2 size={14} />} label="Checks" value={String(checks.length)} tone={checks.length ? 'ok' : 'muted'} />
        <Metric icon={<DatabaseBackup size={14} />} label="Checkpoints" value={String(checkpoints.length)} tone={checkpoints.length ? 'ok' : 'muted'} />
        <Metric icon={<Sparkles size={14} />} label="Assets" value={String(imagineAssetCount)} tone={imagineAssetCount ? 'ok' : 'muted'} />
        <Metric icon={<Gauge size={14} />} label="Usage" value={usageText} tone={usagePercent >= 80 ? 'warning' : 'muted'} />
      </div>

      <div className="dashboard-activity">
        <div>
          <span>Preview</span>
          <strong>{previewInfo?.status ?? 'idle'}</strong>
        </div>
        <div>
          <span>Last command</span>
          <strong>{lastCommand ? `${lastCommand.ok ? 'Passed' : 'Failed'}: ${lastCommand.command}` : 'None yet'}</strong>
        </div>
        <div>
          <span>Last Grok output</span>
          <strong>{lastAssistant ? compact(lastAssistant.text) : isRunning ? 'Grok is working' : 'No run yet'}</strong>
        </div>
      </div>

      <div className="dashboard-actions">
        <button className="secondary-action" onClick={() => void onOpenWorkspace()}>
          <Activity size={15} />
          Open
        </button>
        <button className="secondary-action" disabled={!workspace || !gitStatus.length} onClick={() => void onReviewChanges()}>
          <GitBranch size={15} />
          Review
        </button>
        <button className="secondary-action" disabled={!workspace || previewActive} onClick={() => void onStartPreview()}>
          <Play size={15} />
          Preview
        </button>
        <button className="secondary-action" disabled={!workspace || !checks.length} onClick={() => void onRunFirstCheck()}>
          <CheckCircle2 size={15} />
          Check
        </button>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  tone: 'ok' | 'warning' | 'muted';
}): JSX.Element {
  return (
    <div className={`dashboard-metric ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function compact(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > 90 ? `${singleLine.slice(0, 87)}...` : singleLine;
}
