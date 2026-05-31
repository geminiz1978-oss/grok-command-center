import { DatabaseBackup, Gauge, MonitorPlay, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QWEN_ENDPOINTS, QWEN_MODELS, getEndpoint, getModel } from '@shared/qwenCatalog';
import type { AppSettings } from '@shared/types';

interface PreferencesDialogProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onExportSettings: () => Promise<void>;
  onImportSettings: () => Promise<void>;
  onExportSession: () => Promise<void>;
  onImportSession: () => Promise<void>;
  onOpenSetup: () => void;
  onManagePromptTemplates: () => void;
}

const PREVIEW_COMMAND_PRESETS = [
  {
    label: 'Auto',
    value: ''
  },
  {
    label: 'Static',
    value: 'grok-command-center-static'
  },
  {
    label: 'npm dev',
    value: 'npm run dev'
  },
  {
    label: 'npm start',
    value: 'npm start'
  },
  {
    label: 'HTTP server',
    value: 'python -m http.server 8080'
  }
];

export function PreferencesDialog({
  isOpen,
  settings,
  onClose,
  onSaveSettings,
  onExportSettings,
  onImportSettings,
  onExportSession,
  onImportSession,
  onOpenSetup,
  onManagePromptTemplates
}: PreferencesDialogProps): JSX.Element | null {
  const [draft, setDraft] = useState(settings);
  const [savedNotice, setSavedNotice] = useState('');
  const selectedModel = useMemo(() => getModel(draft.modelId), [draft.modelId]);
  const selectedEndpoint = useMemo(() => getEndpoint(draft.endpointKey), [draft.endpointKey]);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setSavedNotice('');
    }
  }, [isOpen, settings]);

  if (!isOpen) {
    return null;
  }

  async function save(): Promise<void> {
    await onSaveSettings(draft);
    setSavedNotice('Saved');
    window.setTimeout(() => setSavedNotice(''), 1600);
  }

  function closeAndRun(action: () => void): void {
    onClose();
    action();
  }

  return (
    <div className="preferences-overlay" role="presentation" onMouseDown={onClose}>
      <section className="preferences-dialog" role="dialog" aria-modal="true" aria-label="Grok Command Center preferences" onMouseDown={(event) => event.stopPropagation()}>
        <header className="preferences-header">
          <div>
            <span className="eyebrow">Preferences</span>
            <h2>Grok Command Center settings</h2>
          </div>
          <button className="icon-button" title="Close preferences" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="preferences-body">
          <section className="preferences-section">
            <div className="preferences-section-title">
              <SlidersHorizontal size={17} />
              <div>
                <h3>Agent</h3>
                <span>{selectedModel.name} on {selectedEndpoint.label}</span>
              </div>
            </div>

            <div className="preferences-grid">
              <label>
                <span>Model</span>
                <select value={draft.modelId} onChange={(event) => setDraft({ ...draft, modelId: event.target.value })}>
                  {QWEN_MODELS.map((model) => (
                    <option value={model.id} key={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Endpoint</span>
                <select
                  value={draft.endpointKey}
                  onChange={(event) => setDraft({ ...draft, endpointKey: event.target.value as AppSettings['endpointKey'] })}
                >
                  {QWEN_ENDPOINTS.map((endpoint) => (
                    <option value={endpoint.key} key={endpoint.key}>
                      {endpoint.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Permission</span>
                <select
                  value={draft.permissionMode}
                  onChange={(event) => setDraft({ ...draft, permissionMode: event.target.value as AppSettings['permissionMode'] })}
                >
                  <option value="plan">plan</option>
                  <option value="default">default</option>
                  <option value="auto-edit">auto-edit</option>
                  <option value="yolo">yolo</option>
                </select>
              </label>

              <label>
                <span>Agent CLI override</span>
                <input
                  value={draft.qwenExecutablePath}
                  placeholder="Bundled SDK CLI"
                  onChange={(event) => setDraft({ ...draft, qwenExecutablePath: event.target.value })}
                />
              </label>
            </div>

            <div className="preferences-inline-grid">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={draft.thinkingEnabled}
                  disabled={!selectedModel.supportsThinking}
                  onChange={(event) => setDraft({ ...draft, thinkingEnabled: event.target.checked })}
                />
                <span>Thinking</span>
              </label>

              <label>
                <span>Thinking budget</span>
                <input
                  type="number"
                  min={0}
                  value={draft.thinkingBudget}
                  disabled={!draft.thinkingEnabled || !selectedModel.supportsThinking}
                  onChange={(event) => setDraft({ ...draft, thinkingBudget: Number(event.target.value) })}
                />
              </label>
            </div>
          </section>

          <section className="preferences-section">
            <div className="preferences-section-title">
              <MonitorPlay size={17} />
              <div>
                <h3>Preview</h3>
                <span>{draft.previewCommand || 'Auto-detect workspace command'}</span>
              </div>
            </div>

            <div className="preview-command-presets">
              {PREVIEW_COMMAND_PRESETS.map((preset) => (
                <button
                  className={`terminal-chip ${draft.previewCommand === preset.value ? 'preset active' : 'preset'}`}
                  key={preset.label}
                  onClick={() => setDraft({ ...draft, previewCommand: preset.value })}
                  type="button"
                  title={preset.value || 'Auto-detect preview command'}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="preferences-grid">
              <label>
                <span>Preview port</span>
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={draft.previewPort}
                  onChange={(event) => setDraft({ ...draft, previewPort: Number(event.target.value) })}
                />
              </label>

              <label>
                <span>Command override</span>
                <input
                  value={draft.previewCommand}
                  placeholder="Auto, grok-command-center-static, npm run dev..."
                  onChange={(event) => setDraft({ ...draft, previewCommand: event.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="preferences-section">
            <div className="preferences-section-title">
              <Gauge size={17} />
              <div>
                <h3>Usage</h3>
                <span>{formatTokenCount(draft.usageLimitTokens)} token soft limit</span>
              </div>
            </div>

            <div className="preferences-grid">
              <label>
                <span>Usage limit</span>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={draft.usageLimitTokens}
                  onChange={(event) => setDraft({ ...draft, usageLimitTokens: Number(event.target.value) })}
                />
              </label>

              <label>
                <span>Prompt templates</span>
                <button className="secondary-action" onClick={() => closeAndRun(onManagePromptTemplates)} type="button">
                  Manage templates
                </button>
              </label>
            </div>
          </section>

          <section className="preferences-section">
            <div className="preferences-section-title">
              <DatabaseBackup size={17} />
              <div>
                <h3>Setup and backups</h3>
                <span>Settings stay separate from remembered work sessions</span>
              </div>
            </div>

            <div className="preferences-actions-grid">
              <button className="secondary-action" onClick={() => closeAndRun(onOpenSetup)} type="button">
                <RotateCcw size={15} />
                Setup wizard
              </button>
              <button className="secondary-action" onClick={() => void onExportSettings()} type="button">
                Export settings
              </button>
              <button className="secondary-action" onClick={() => void onImportSettings()} type="button">
                Import settings
              </button>
              <button className="secondary-action" onClick={() => void onExportSession()} type="button">
                Export session
              </button>
              <button className="secondary-action" onClick={() => void onImportSession()} type="button">
                Import session
              </button>
            </div>
          </section>
        </div>

        <footer className="preferences-footer">
          <span>{savedNotice}</span>
          <button className="secondary-action" onClick={onClose}>
            Close
          </button>
          <button className="primary-action" onClick={() => void save()}>
            <Save size={15} />
            Save preferences
          </button>
        </footer>
      </section>
    </div>
  );
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
