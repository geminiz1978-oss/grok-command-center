import { CheckCircle2, Copy, Play, Terminal, Trash2, XCircle } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type { WorkspaceCommandHistoryItem, WorkspaceCheck } from '@shared/types';

interface TerminalPanelProps {
  checks: WorkspaceCheck[];
  history: WorkspaceCommandHistoryItem[];
  isRunning: boolean;
  workspaceReady: boolean;
  onRun: (command: string) => Promise<void>;
  onClear: () => void;
}

interface TerminalPreset {
  label: string;
  command: string;
  fillOnly?: boolean;
}

const TERMINAL_PRESETS: TerminalPreset[] = [
  {
    label: 'Status',
    command: 'git status --short'
  },
  {
    label: 'Diff stat',
    command: 'git diff --stat'
  },
  {
    label: 'Install',
    command: 'npm install'
  },
  {
    label: 'Dev',
    command: 'npm run dev',
    fillOnly: true
  },
  {
    label: 'List',
    command: isWindowsPlatform() ? 'dir' : 'ls'
  }
];

export function TerminalPanel({
  checks,
  history,
  isRunning,
  workspaceReady,
  onRun,
  onClear
}: TerminalPanelProps): JSX.Element {
  const [command, setCommand] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const recentCommands = useMemo(() => {
    const seen = new Set<string>();
    return history
      .map((item) => item.command)
      .filter((item) => {
        if (seen.has(item)) {
          return false;
        }
        seen.add(item);
        return true;
      })
      .slice(0, 4);
  }, [history]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = command.trim();

    if (!value || isRunning || !workspaceReady) {
      return;
    }

    setCommand('');
    await onRun(value);
  }

  async function copyResult(item: WorkspaceCommandHistoryItem): Promise<void> {
    await copyText(formatCommandForCopy(item));
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(''), 1200);
  }

  return (
    <section className="panel terminal-panel">
      <div className="terminal-header">
        <div>
          <span className="eyebrow">Terminal</span>
          <h2>Workspace commands</h2>
        </div>
        <button className="icon-button" title="Clear terminal history" disabled={!history.length || isRunning} onClick={onClear}>
          <Trash2 size={15} />
        </button>
      </div>

      <form className="terminal-composer" onSubmit={submit}>
        <Terminal size={15} />
        <input
          value={command}
          disabled={!workspaceReady || isRunning}
          placeholder={workspaceReady ? 'npm run test, dir, git status...' : 'Open a workspace first'}
          onChange={(event) => setCommand(event.target.value)}
        />
        <button className="icon-button" title="Run command" disabled={!workspaceReady || isRunning || !command.trim()}>
          <Play size={15} />
        </button>
      </form>

      <div className="terminal-shortcuts">
        {TERMINAL_PRESETS.map((preset) => (
          <button
            className="terminal-chip preset"
            disabled={!workspaceReady || isRunning}
            key={preset.command}
            onClick={() => (preset.fillOnly ? setCommand(preset.command) : void onRun(preset.command))}
            title={preset.command}
          >
            {preset.label}
          </button>
        ))}
        {checks.slice(0, 4).map((check) => (
          <button
            className="terminal-chip"
            disabled={!workspaceReady || isRunning}
            key={`${check.id}-${check.command}`}
            onClick={() => void onRun(check.command)}
            title={check.command}
          >
            {check.label}
          </button>
        ))}
        {recentCommands.map((recentCommand) => (
          <button
            className="terminal-chip muted"
            disabled={!workspaceReady || isRunning}
            key={recentCommand}
            onClick={() => setCommand(recentCommand)}
            title={recentCommand}
          >
            {recentCommand}
          </button>
        ))}
      </div>

      <div className="terminal-history">
        {history.length ? (
          history.map((item) => (
            <article className={`terminal-result ${item.ok ? 'ok' : 'fail'}`} key={item.id}>
              <div className="terminal-result-title">
                {item.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <strong>{item.command}</strong>
                <span>{(item.durationMs / 1000).toFixed(1)}s</span>
                <button className="bubble-copy" onClick={() => void copyResult(item)} type="button">
                  <Copy size={12} />
                  {copiedId === item.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre>{formatCommandOutput(item) || 'Command produced no output.'}</pre>
            </article>
          ))
        ) : (
          <p className="empty-copy">Run commands without leaving Grok Command Center. Output stays here for quick copy/paste.</p>
        )}
      </div>
    </section>
  );
}

function isWindowsPlatform(): boolean {
  return navigator.platform.toLowerCase().includes('win');
}

function formatCommandOutput(item: WorkspaceCommandHistoryItem): string {
  return [item.stdout, item.stderr].filter(Boolean).join('\n').trim();
}

function formatCommandForCopy(item: WorkspaceCommandHistoryItem): string {
  return [`$ ${item.command}`, `Exit Code: ${item.exitCode ?? 'unknown'}`, formatCommandOutput(item)].filter(Boolean).join('\n\n');
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
