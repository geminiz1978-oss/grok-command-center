import { BookOpenText, DatabaseBackup, Download, RefreshCw, RotateCcw, Save, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceCheckpointInfo, WorkspaceMemoryInfo } from '@shared/types';

export interface ProjectDiagnosticItem {
  label: string;
  value: string;
  tone?: 'ok' | 'warning' | 'muted';
}

interface ProjectToolsPanelProps {
  memory: WorkspaceMemoryInfo | null;
  checkpoints: WorkspaceCheckpointInfo[];
  diagnostics: ProjectDiagnosticItem[];
  workspaceReady: boolean;
  isRestoring: boolean;
  onRefresh: () => Promise<void>;
  onSaveMemory: (content: string) => Promise<void>;
  onRestoreCheckpoint: (checkpointId: string) => Promise<void>;
  onExportSettings: () => Promise<void>;
  onImportSettings: () => Promise<void>;
}

export function ProjectToolsPanel({
  memory,
  checkpoints,
  diagnostics,
  workspaceReady,
  isRestoring,
  onRefresh,
  onSaveMemory,
  onRestoreCheckpoint,
  onExportSettings,
  onImportSettings
}: ProjectToolsPanelProps): JSX.Element {
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState(memory?.content ?? '');
  const [selectedCheckpointId, setSelectedCheckpointId] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const latestCheckpoint = checkpoints[0];
  const selectedCheckpoint = useMemo(
    () => checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? latestCheckpoint,
    [checkpoints, latestCheckpoint, selectedCheckpointId]
  );

  useEffect(() => {
    if (!isMemoryOpen) {
      setMemoryDraft(memory?.content ?? '');
    }
  }, [isMemoryOpen, memory]);

  useEffect(() => {
    if (!selectedCheckpointId || !checkpoints.some((checkpoint) => checkpoint.id === selectedCheckpointId)) {
      setSelectedCheckpointId(latestCheckpoint?.id ?? '');
    }
  }, [checkpoints, latestCheckpoint, selectedCheckpointId]);

  async function saveMemory(): Promise<void> {
    setIsSavingMemory(true);

    try {
      await onSaveMemory(memoryDraft);
      setIsMemoryOpen(false);
    } finally {
      setIsSavingMemory(false);
    }
  }

  return (
    <section className="panel project-tools-panel">
      <div className="project-tools-header">
        <div>
          <span className="eyebrow">Project</span>
          <h2>Memory & restore</h2>
        </div>
        <button className="icon-button" title="Refresh project tools" disabled={!workspaceReady} onClick={() => void onRefresh()}>
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="project-tool-actions">
        <button className="secondary-action" disabled={!workspaceReady} onClick={() => setIsMemoryOpen(true)}>
          <BookOpenText size={15} />
          Memory
        </button>
        <div className="project-tool-status">
          <strong>{memory?.exists ? 'Saved' : 'Not saved'}</strong>
          <span>{memory?.updatedAt ? formatDate(memory.updatedAt) : 'Workspace guidance'}</span>
        </div>
      </div>

      <div className="checkpoint-row">
        <DatabaseBackup size={15} />
        <select
          value={selectedCheckpoint?.id ?? ''}
          disabled={!workspaceReady || !checkpoints.length || isRestoring}
          onChange={(event) => setSelectedCheckpointId(event.target.value)}
        >
          {checkpoints.length ? (
            checkpoints.map((checkpoint) => (
              <option value={checkpoint.id} key={checkpoint.id}>
                {formatCheckpointLabel(checkpoint)}
              </option>
            ))
          ) : (
            <option value="">No checkpoints yet</option>
          )}
        </select>
        <button
          className="secondary-action"
          disabled={!workspaceReady || !selectedCheckpoint || isRestoring}
          onClick={() => selectedCheckpoint && void onRestoreCheckpoint(selectedCheckpoint.id)}
          title="Restore files from the selected checkpoint"
        >
          <RotateCcw size={15} />
          Restore
        </button>
      </div>

      <div className="settings-backup-row">
        <button className="secondary-action" onClick={() => void onExportSettings()}>
          <Download size={15} />
          Export settings
        </button>
        <button className="secondary-action" onClick={() => void onImportSettings()}>
          <Upload size={15} />
          Import
        </button>
      </div>

      <div className="project-diagnostics" aria-label="Project diagnostics">
        {diagnostics.map((item) => (
          <div className={`diagnostic-row ${item.tone ?? 'muted'}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      {isMemoryOpen ? (
        <div className="memory-overlay">
          <section className="memory-panel">
            <div className="memory-header">
              <div>
                <span className="eyebrow">Memory</span>
                <h2>Project guidance for Grok</h2>
              </div>
              <button className="icon-button" title="Close memory" onClick={() => setIsMemoryOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <textarea
              value={memoryDraft}
              spellCheck={false}
              onChange={(event) => setMemoryDraft(event.target.value)}
              placeholder="Add project rules, preferred commands, coding style, gotchas, or things Grok should always remember for this folder."
            />
            <div className="memory-actions">
              <span>{memory?.path ? memory.path : '.grok-command-center/MEMORY.md'}</span>
              <button className="secondary-action" disabled={isSavingMemory} onClick={() => void saveMemory()}>
                <Save size={15} />
                Save memory
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function formatCheckpointLabel(checkpoint: WorkspaceCheckpointInfo): string {
  return `${formatDate(checkpoint.createdAt)} - ${checkpoint.fileCount} files`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
