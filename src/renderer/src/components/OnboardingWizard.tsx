import { CheckCircle2, FolderOpen, KeyRound, Save, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QWEN_ENDPOINTS, QWEN_MODELS, getEndpoint, getModel } from '@shared/qwenCatalog';
import type { ApiKeyKind, AppSettings, SecretStatus, WorkspaceInfo } from '@shared/types';

interface OnboardingWizardProps {
  isOpen: boolean;
  settings: AppSettings;
  secretStatus: SecretStatus;
  workspace: WorkspaceInfo | null;
  onSaveApiKey: (kind: ApiKeyKind, value: string) => Promise<void>;
  onOpenWorkspace: () => Promise<void>;
  onComplete: (settings: AppSettings) => Promise<void>;
  onClose: () => void;
}

export function OnboardingWizard({
  isOpen,
  settings,
  secretStatus,
  workspace,
  onSaveApiKey,
  onOpenWorkspace,
  onComplete,
  onClose
}: OnboardingWizardProps): JSX.Element | null {
  const [draft, setDraft] = useState(settings);
  const [xaiKey, setXaiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const selectedModel = useMemo(() => getModel(draft.modelId), [draft.modelId]);
  const selectedEndpoint = useMemo(() => getEndpoint(draft.endpointKey), [draft.endpointKey]);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setXaiKey('');
    }
  }, [isOpen, settings]);

  if (!isOpen) {
    return null;
  }

  async function finish(): Promise<void> {
    setIsSaving(true);

    try {
      if (xaiKey.trim()) {
        await onSaveApiKey('xai', xaiKey.trim());
      }

      await onComplete({
        ...draft,
        onboardingCompleted: true
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="onboarding-overlay" role="presentation" onMouseDown={onClose}>
      <section className="onboarding-wizard" role="dialog" aria-modal="true" aria-label="Grok Command Center setup" onMouseDown={(event) => event.stopPropagation()}>
        <header className="onboarding-header">
          <div>
            <span className="eyebrow">Setup</span>
            <h2>Welcome to Grok Command Center</h2>
          </div>
          <button className="icon-button" title="Close setup" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="onboarding-body">
          <section className="onboarding-step">
            <div className="onboarding-step-title">
              <Sparkles size={17} />
              <div>
                <h3>Model and endpoint</h3>
                <p>Pick the Grok model this workspace should use.</p>
              </div>
            </div>
            <div className="onboarding-grid">
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
            </div>
            <div className="onboarding-note">
              <strong>{selectedModel.name}</strong>
              <span>{selectedEndpoint.label}</span>
            </div>
          </section>

          <section className="onboarding-step">
            <div className="onboarding-step-title">
              <KeyRound size={17} />
              <div>
                <h3>API keys</h3>
                <p>Paste a key now or leave it for later. Keys are saved through the desktop secure store.</p>
              </div>
            </div>
            <div className="onboarding-grid">
              <label>
                <span>xAI {secretStatus.xai ? 'saved' : 'key'}</span>
                <input
                  type="password"
                  value={xaiKey}
                  placeholder={secretStatus.xai ? 'Saved' : 'Paste xAI key'}
                  onChange={(event) => setXaiKey(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="onboarding-step">
            <div className="onboarding-step-title">
              <FolderOpen size={17} />
              <div>
                <h3>Permission and workspace</h3>
                <p>Choose how much autonomy Grok gets, then open the first folder.</p>
              </div>
            </div>
            <div className="onboarding-grid">
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
              <div className="onboarding-workspace">
                <span>{workspace ? workspace.name : 'No workspace yet'}</span>
                <button className="secondary-action" onClick={() => void onOpenWorkspace()}>
                  <FolderOpen size={15} />
                  Open folder
                </button>
              </div>
            </div>
          </section>
        </div>

        <footer className="onboarding-actions">
          <button className="secondary-action" onClick={onClose} disabled={isSaving}>
            Later
          </button>
          <button className="primary-action" onClick={() => void finish()} disabled={isSaving}>
            {workspace ? <CheckCircle2 size={15} /> : <Save size={15} />}
            Finish setup
          </button>
        </footer>
      </section>
    </div>
  );
}
