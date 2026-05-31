import { Copy, ExternalLink, FileWarning, FolderOpen, HardDrive, Info, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppDiagnosticsInfo, DiagnosticFileInfo, RuntimeLogInfo } from '@shared/types';

interface RuntimeLogPanelProps {
  onLoad: () => Promise<RuntimeLogInfo>;
  onClear: () => Promise<RuntimeLogInfo>;
  onOpenExternal: () => Promise<void>;
  onLoadDiagnostics: () => Promise<AppDiagnosticsInfo>;
  onOpenUserDataFolder: () => Promise<void>;
}

export function RuntimeLogPanel({
  onLoad,
  onClear,
  onOpenExternal,
  onLoadDiagnostics,
  onOpenUserDataFolder
}: RuntimeLogPanelProps): JSX.Element {
  const [logInfo, setLogInfo] = useState<RuntimeLogInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<AppDiagnosticsInfo | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError('');

    try {
      const [loadedLog, loadedDiagnostics] = await Promise.all([onLoad(), onLoadDiagnostics()]);
      setLogInfo(loadedLog);
      setDiagnostics(loadedDiagnostics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function clear(): Promise<void> {
    setIsLoading(true);
    setError('');

    try {
      setLogInfo(await onClear());
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    } finally {
      setIsLoading(false);
    }
  }

  async function openExternal(): Promise<void> {
    setError('');

    try {
      await onOpenExternal();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }

  async function openStorage(): Promise<void> {
    setError('');

    try {
      await onOpenUserDataFolder();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }

  async function copyLog(): Promise<void> {
    if (!logInfo?.content) {
      return;
    }

    await copyText(logInfo.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function copyDiagnostics(): Promise<void> {
    if (!diagnostics) {
      return;
    }

    await copyText(formatDiagnosticsBundle(diagnostics, logInfo));
    setCopiedDiagnostics(true);
    window.setTimeout(() => setCopiedDiagnostics(false), 1200);
  }

  return (
    <section className="panel runtime-log-panel">
      <div className="runtime-log-header">
        <div>
          <span className="eyebrow">Runtime</span>
          <h2>Crash log</h2>
        </div>
        <div className="runtime-log-actions">
          <button className="icon-button" title="Refresh runtime log" disabled={isLoading} onClick={() => void refresh()}>
            <RefreshCw size={14} />
          </button>
          <button className="icon-button" title="Copy runtime log" disabled={!logInfo?.content} onClick={() => void copyLog()}>
            <Copy size={14} />
          </button>
          <button className="icon-button" title="Copy diagnostics bundle" disabled={!diagnostics} onClick={() => void copyDiagnostics()}>
            <Info size={14} />
          </button>
          <button className="icon-button" title="Open app storage folder" onClick={() => void openStorage()}>
            <FolderOpen size={14} />
          </button>
          <button className="icon-button" title="Open runtime log externally" onClick={() => void openExternal()}>
            <ExternalLink size={14} />
          </button>
          <button className="icon-button danger" title="Clear runtime log" disabled={isLoading} onClick={() => void clear()}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <section className="diagnostics-card">
        <div className="diagnostics-title">
          <HardDrive size={14} />
          <span>Diagnostics</span>
          <strong>{diagnostics ? `${diagnostics.mode} ${diagnostics.appVersion}` : 'loading'}</strong>
        </div>

        {diagnostics ? (
          <>
            <div className="diagnostics-grid">
              <DiagnosticCell label="Mode" value={diagnostics.mode} />
              <DiagnosticCell label="Electron" value={diagnostics.electronVersion || 'n/a'} />
              <DiagnosticCell label="Node" value={diagnostics.nodeVersion || 'n/a'} />
              <DiagnosticCell label="Platform" value={`${diagnostics.platform} ${diagnostics.arch}`} />
            </div>
            <div className="diagnostics-path" title={diagnostics.userDataPath}>
              <span>Storage</span>
              <strong>{diagnostics.userDataPath || 'Unavailable'}</strong>
            </div>
            <div className="diagnostics-files">
              <DiagnosticFile label="settings" file={diagnostics.files.settings} />
              <DiagnosticFile label="session" file={diagnostics.files.session} />
              <DiagnosticFile label="secrets" file={diagnostics.files.secrets} />
              <DiagnosticFile label="runtime" file={diagnostics.files.runtimeLog} />
            </div>
          </>
        ) : (
          <p className="empty-copy">{isLoading ? 'Loading diagnostics...' : 'Diagnostics unavailable.'}</p>
        )}
      </section>

      <div className="runtime-log-meta">
        <FileWarning size={14} />
        <span>{logInfo?.path || 'Runtime log path unavailable'}</span>
      </div>

      <div className="runtime-log-body">
        {error ? (
          <p className="empty-copy error-copy">{error}</p>
        ) : logInfo?.content ? (
          <pre>{logInfo.content}</pre>
        ) : (
          <p className="empty-copy">{isLoading ? 'Loading runtime log...' : 'No runtime issues logged yet.'}</p>
        )}
      </div>

      {copied ? <div className="runtime-log-notice">Copied log text</div> : null}
      {copiedDiagnostics ? <div className="runtime-log-notice">Copied diagnostics</div> : null}
    </section>
  );
}

function DiagnosticCell({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="diagnostic-cell">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function DiagnosticFile({ label, file }: { label: string; file: DiagnosticFileInfo }): JSX.Element {
  return (
    <div className={`diagnostic-file ${file.exists ? 'ok' : 'missing'}`} title={file.path}>
      <span>{label}</span>
      <strong>{file.exists ? formatBytes(file.size) : 'missing'}</strong>
    </div>
  );
}

function formatDiagnosticsBundle(diagnostics: AppDiagnosticsInfo, logInfo: RuntimeLogInfo | null): string {
  return JSON.stringify(
    {
      diagnostics,
      runtimeLog: logInfo
        ? {
            path: logInfo.path,
            exists: logInfo.exists,
            updatedAt: logInfo.updatedAt,
            tail: logInfo.content.slice(-20000)
          }
        : null
    },
    null,
    2
  );
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
