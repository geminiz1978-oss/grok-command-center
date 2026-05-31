import { ExternalLink, Monitor, Play, RotateCw, SlidersHorizontal, Smartphone, Square, Tablet } from 'lucide-react';
import { useState } from 'react';
import type { PreviewInfo } from '@shared/types';

interface PreviewPanelProps {
  previewInfo: PreviewInfo | null;
  logs: string[];
  workspaceReady: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onConfigure: () => void;
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export function PreviewPanel({ previewInfo, logs, workspaceReady, onStart, onStop, onConfigure }: PreviewPanelProps): JSX.Element {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const previewUrl = previewInfo?.url;

  return (
    <aside className="panel preview-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Artifact</span>
          <h2>Live preview</h2>
        </div>
        <div className="preview-controls">
          <button className="icon-button" title="Desktop viewport" onClick={() => setViewport('desktop')}>
            <Monitor size={15} />
          </button>
          <button className="icon-button" title="Tablet viewport" onClick={() => setViewport('tablet')}>
            <Tablet size={15} />
          </button>
          <button className="icon-button" title="Mobile viewport" onClick={() => setViewport('mobile')}>
            <Smartphone size={15} />
          </button>
        </div>
      </div>

      <div className="preview-action-row">
        {previewInfo?.status === 'running' || previewInfo?.status === 'starting' ? (
          <button className="secondary-action danger" onClick={onStop}>
            <Square size={15} />
            Stop
          </button>
        ) : (
          <button className="primary-action" disabled={!workspaceReady} onClick={onStart}>
            <Play size={15} />
            Start
          </button>
        )}
        <button className="icon-button" title="Reload preview" onClick={() => setReloadKey((key) => key + 1)} disabled={!previewUrl}>
          <RotateCw size={15} />
        </button>
        <button className="icon-button" title="Open external preview" disabled={!previewUrl} onClick={() => previewUrl && window.open(previewUrl)}>
          <ExternalLink size={15} />
        </button>
        <button className="icon-button" title="Configure preview" onClick={onConfigure}>
          <SlidersHorizontal size={15} />
        </button>
        <span className="preview-command">{previewInfo ? formatPreviewCommand(previewInfo.command) : 'idle'}</span>
      </div>

      <div className={`preview-frame-shell ${viewport}`}>
        {previewUrl ? (
          <iframe key={`${previewUrl}-${reloadKey}`} src={previewUrl} title="Grok Command Center live preview" />
        ) : (
          <div className="preview-empty">
            <Monitor size={30} />
            <p>Start the project preview to watch Grok edits hot-reload here.</p>
          </div>
        )}
      </div>

      <section className="dev-logs">
        <div className="subsection-title">
          <span>Dev server</span>
          <span>{previewInfo?.status ?? 'idle'}</span>
        </div>
        <pre>{logs.length ? logs.join('\n') : 'No preview logs yet.'}</pre>
      </section>
    </aside>
  );
}

function formatPreviewCommand(command: string): string {
  return command === 'grok-command-center-static' ? 'static' : command;
}
