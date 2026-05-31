import { AlertTriangle, Check, Copy, ExternalLink, FileCode, RefreshCw, Save, X } from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceFileContent } from '@shared/types';

interface FileEditorPanelProps {
  file: WorkspaceFileContent | null;
  draft: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onCopy: () => Promise<void>;
  onOpenExternal: () => Promise<void>;
  onReload: () => Promise<void>;
  onSave: () => Promise<void>;
}

export function FileEditorPanel({
  file,
  draft,
  isDirty,
  isLoading,
  error,
  onDraftChange,
  onClose,
  onCopy,
  onOpenExternal,
  onReload,
  onSave
}: FileEditorPanelProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copyFile(): Promise<void> {
    await onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="panel file-editor-panel">
      <div className="file-editor-header">
        <div className="file-editor-title">
          <FileCode size={17} />
          <div>
            <span className="eyebrow">Editor</span>
            <h2>{file?.name ?? 'No file selected'}</h2>
            {file ? <small>{file.relativePath}</small> : null}
          </div>
        </div>
        <div className="file-editor-actions">
          {file ? <span className="file-pill">{file.language}</span> : null}
          {file?.isTooLarge ? <span className="file-pill warning">Preview limited</span> : null}
          <button className="icon-button" title="Copy file" disabled={!file || file.isBinary} onClick={() => void copyFile()}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button className="icon-button" title="Open with system app" disabled={!file} onClick={() => void onOpenExternal()}>
            <ExternalLink size={15} />
          </button>
          <button className="icon-button" title="Reload file" disabled={!file || isLoading} onClick={() => void onReload()}>
            <RefreshCw size={15} />
          </button>
          <button
            className="secondary-action"
            disabled={!file || !isDirty || isLoading || file.isBinary || file.isTooLarge}
            onClick={() => void onSave()}
          >
            <Save size={15} />
            Save
          </button>
          <button className="icon-button" title="Close editor" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="file-editor-warning">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      ) : null}

      {!file ? (
        <div className="file-editor-empty">
          <FileCode size={28} />
          <h3>Select a file to inspect or edit.</h3>
          <p>Use search or the file tree on the left to open files inside the workspace.</p>
        </div>
      ) : file.isBinary ? (
        <div className="file-editor-empty">
          <AlertTriangle size={28} />
          <h3>Binary file preview is not available.</h3>
          <p>Open it with the system app or attach it to chat when Grok needs to inspect it.</p>
        </div>
      ) : (
        <textarea
          className="file-editor-textarea"
          spellCheck={false}
          value={draft}
          disabled={isLoading || file.isTooLarge}
          onChange={(event) => onDraftChange(event.target.value)}
        />
      )}
    </section>
  );
}
