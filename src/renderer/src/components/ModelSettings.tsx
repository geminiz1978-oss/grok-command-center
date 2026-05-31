import { Activity, Check, KeyRound, Lock, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QWEN_ENDPOINTS, QWEN_MODELS, getEndpoint, getModel } from '@shared/qwenCatalog';
import type { ApiKeyKind, AppSettings, QwenConnectionTestResult, QwenModelCapability, SecretStatus } from '@shared/types';

interface ModelSettingsProps {
  settings: AppSettings;
  secretStatus: SecretStatus;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onSaveApiKey: (kind: ApiKeyKind, value: string) => Promise<void>;
  onTestConnection: () => Promise<QwenConnectionTestResult>;
}

export function ModelSettings({
  settings,
  secretStatus,
  onSaveSettings,
  onSaveApiKey,
  onTestConnection
}: ModelSettingsProps): JSX.Element {
  const [draft, setDraft] = useState(settings);
  const [xaiKey, setXaiKey] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [testResult, setTestResult] = useState<QwenConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const selectedModel = useMemo(() => getModel(draft.modelId), [draft.modelId]);
  const selectedEndpoint = useMemo(() => getEndpoint(draft.endpointKey), [draft.endpointKey]);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function saveConfig(): Promise<void> {
    await onSaveSettings(draft);
    setSavedNotice('Settings saved');
    setTimeout(() => setSavedNotice(''), 1800);
  }

  async function saveKey(kind: ApiKeyKind, value: string): Promise<void> {
    if (!value.trim()) {
      return;
    }

    await onSaveApiKey(kind, value.trim());
    setXaiKey('');

    setSavedNotice('API key saved');
    setTimeout(() => setSavedNotice(''), 1800);
  }

  async function testConnection(): Promise<void> {
    setIsTesting(true);
    setTestResult(null);

    try {
      setTestResult(await onTestConnection());
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        latencyMs: 0,
        modelId: draft.modelId,
        endpointLabel: selectedEndpoint.label
      });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <section className="settings-band">
      <div className="settings-grid">
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
          <select value={draft.endpointKey} onChange={(event) => setDraft({ ...draft, endpointKey: event.target.value as AppSettings['endpointKey'] })}>
            {QWEN_ENDPOINTS.map((endpoint) => (
              <option value={endpoint.key} key={endpoint.key}>
                {endpoint.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Permission</span>
          <select value={draft.permissionMode} onChange={(event) => setDraft({ ...draft, permissionMode: event.target.value as AppSettings['permissionMode'] })}>
            <option value="plan">plan</option>
            <option value="default">default</option>
            <option value="auto-edit">auto-edit</option>
            <option value="yolo">yolo</option>
          </select>
        </label>

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
          <span>Usage limit</span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={draft.usageLimitTokens}
            onChange={(event) => setDraft({ ...draft, usageLimitTokens: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="settings-detail-row">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={draft.thinkingEnabled}
            disabled={!selectedModel.supportsThinking}
            onChange={(event) => setDraft({ ...draft, thinkingEnabled: event.target.checked })}
          />
          <span>Thinking</span>
        </label>

        <label className="budget-input">
          <span>Budget</span>
          <input
            type="number"
            min={0}
            value={draft.thinkingBudget}
            disabled={!draft.thinkingEnabled || !selectedModel.supportsThinking}
            onChange={(event) => setDraft({ ...draft, thinkingBudget: Number(event.target.value) })}
          />
        </label>

        <label className="qwen-path-input">
          <span>Agent CLI override</span>
          <input
            value={draft.qwenExecutablePath}
            placeholder="Bundled SDK CLI"
            onChange={(event) => setDraft({ ...draft, qwenExecutablePath: event.target.value })}
          />
        </label>

        <button className="secondary-action" onClick={saveConfig}>
          <Save size={15} />
          Save
        </button>
        <button className="secondary-action test-action" onClick={testConnection} disabled={isTesting}>
          <Activity size={15} />
          {isTesting ? 'Testing' : 'Test Grok'}
        </button>
      </div>

      <div className="secret-row">
        <SecretInput
          label="xAI"
          hasKey={secretStatus.xai}
          value={xaiKey}
          onChange={setXaiKey}
          onSave={() => saveKey('xai', xaiKey)}
        />
        <div className="model-note">
          <strong>{selectedEndpoint.label}</strong>
          <span>{selectedEndpoint.baseUrl}</span>
        </div>
        {savedNotice ? (
          <div className="saved-notice">
            <Check size={14} />
            {savedNotice}
          </div>
        ) : null}
      </div>

      <div className="model-capability-row">
        {selectedModel.capabilities.map((capability) => (
          <span className={`capability-badge capability-${capability}`} key={capability} title={capabilityHelp(capability)}>
            {capabilityLabel(capability)}
          </span>
        ))}
        <span
          className={`capability-badge ${selectedEndpoint.key === selectedModel.recommendedEndpoint ? 'recommended' : 'warning'}`}
          title="Recommended endpoint for this model"
        >
          {selectedEndpoint.key === selectedModel.recommendedEndpoint ? 'Recommended endpoint' : 'Endpoint mismatch'}
        </span>
      </div>

      {testResult ? (
        <div className={`connection-result ${testResult.ok ? 'ok' : 'fail'}`}>
          <strong>{testResult.ok ? 'Grok ready' : 'Grok check failed'}</strong>
          <span>
            {testResult.message}
            {testResult.latencyMs ? ` (${testResult.latencyMs} ms)` : ''}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function capabilityLabel(capability: QwenModelCapability): string {
  const labels: Record<QwenModelCapability, string> = {
    thinking: 'Thinking',
    'agentic-coding': 'Agentic coding',
    vision: 'Vision',
    'file-input': 'File input',
    fast: 'Fast',
    balanced: 'Balanced',
    frontier: 'Frontier',
    coding: 'Coding',
    preview: 'Preview',
    latest: 'Latest'
  };

  return labels[capability];
}

function capabilityHelp(capability: QwenModelCapability): string {
  const descriptions: Record<QwenModelCapability, string> = {
    thinking: 'Supports Grok reasoning controls when the selected model provides them.',
    'agentic-coding': 'Good fit for multi-file coding workflows.',
    vision: 'Expected to handle visual or multimodal inputs when supported by the endpoint.',
    'file-input': 'Good fit for file and attachment-assisted work.',
    fast: 'Optimized for lower-latency tasks.',
    balanced: 'Balanced general-purpose model choice.',
    frontier: 'xAI flagship model family for hard reasoning and automation.',
    coding: 'Designed for coding-heavy command center workflows.',
    preview: 'Preview model; capabilities may move quickly.',
    latest: 'Alias that follows the latest model release.'
  };

  return descriptions[capability];
}

interface SecretInputProps {
  label: string;
  hasKey: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

function SecretInput({ label, hasKey, value, onChange, onSave }: SecretInputProps): JSX.Element {
  return (
    <label className="secret-input">
      <span>
        {hasKey ? <Lock size={13} /> : <KeyRound size={13} />}
        {label}
      </span>
      <input
        type="password"
        value={value}
        placeholder={hasKey ? 'Saved' : 'Paste key'}
        onChange={(event) => onChange(event.target.value)}
      />
      <button className="icon-button" title={`Save ${label} key`} onClick={onSave} type="button">
        <Save size={14} />
      </button>
    </label>
  );
}
