import { Check, Clipboard, Copy, GitCompare, RotateCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { GitDiffFile } from '@shared/types';

interface ChangeReviewPanelProps {
  files: GitDiffFile[];
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function ChangeReviewPanel({
  files,
  isOpen,
  isLoading,
  onClose,
  onRefresh
}: ChangeReviewPanelProps): JSX.Element | null {
  const [activePath, setActivePath] = useState('');
  const [copied, setCopied] = useState(false);
  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath) ?? files[0],
    [activePath, files]
  );
  const fullDiff = useMemo(() => files.map((file) => file.diff).join('\n\n'), [files]);

  useEffect(() => {
    if (files.length && !files.some((file) => file.path === activePath)) {
      setActivePath(files[0].path);
    }
  }, [activePath, files]);

  if (!isOpen) {
    return null;
  }

  async function copyDiff(): Promise<void> {
    await navigator.clipboard.writeText(activeFile?.diff || fullDiff);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="change-review-overlay" aria-label="Review changes">
      <div className="change-review-panel">
        <header className="change-review-header">
          <div>
            <span className="eyebrow">Review</span>
            <h2>Workspace changes</h2>
          </div>
          <div className="change-review-actions">
            <button className="secondary-action" onClick={onRefresh} disabled={isLoading}>
              <RotateCw size={15} />
              Refresh
            </button>
            <button className="secondary-action" onClick={copyDiff} disabled={!files.length}>
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
              {copied ? 'Copied' : 'Copy diff'}
            </button>
            <button className="icon-button" title="Close review" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="change-review-body">
          <aside className="change-file-list">
            {files.length ? (
              files.map((file) => (
                <button
                  className={`change-file-button ${activeFile?.path === file.path ? 'active' : ''}`}
                  key={`${file.code}-${file.path}`}
                  onClick={() => setActivePath(file.path)}
                >
                  <span>{file.code}</span>
                  <p>{file.path}</p>
                </button>
              ))
            ) : (
              <div className="change-empty">
                <GitCompare size={24} />
                <p>{isLoading ? 'Loading changes...' : 'No git diff available for this workspace.'}</p>
              </div>
            )}
          </aside>

          <main className="diff-viewer">
            {activeFile ? (
              <>
                <div className="diff-viewer-title">
                  <span>{activeFile.code}</span>
                  <strong>{activeFile.path}</strong>
                  {activeFile.isBinary ? <small>Binary</small> : null}
                </div>
                <pre>{activeFile.isBinary ? 'Binary file changed.' : activeFile.diff}</pre>
              </>
            ) : (
              <div className="change-empty">
                <Copy size={24} />
                <p>Select a changed file to inspect its diff.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
