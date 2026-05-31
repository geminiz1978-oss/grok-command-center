import { CheckCircle2, Play, Terminal, XCircle } from 'lucide-react';
import type { WorkspaceCheck, WorkspaceCommandResult } from '@shared/types';

interface CheckRunnerPanelProps {
  checks: WorkspaceCheck[];
  isRunning: boolean;
  result: WorkspaceCommandResult | null;
  workspaceReady: boolean;
  onRun: (check: WorkspaceCheck) => Promise<void>;
}

export function CheckRunnerPanel({
  checks,
  isRunning,
  result,
  workspaceReady,
  onRun
}: CheckRunnerPanelProps): JSX.Element {
  return (
    <section className="panel checks-panel">
      <div className="checks-header">
        <div>
          <span className="eyebrow">Checks</span>
          <h2>Run verification</h2>
        </div>
        <Terminal size={16} />
      </div>

      <div className="check-buttons">
        {checks.length ? (
          checks.map((check) => (
            <button
              className="secondary-action"
              key={`${check.id}-${check.command}`}
              disabled={!workspaceReady || isRunning}
              onClick={() => void onRun(check)}
              title={check.command}
            >
              <Play size={14} />
              {check.label}
            </button>
          ))
        ) : (
          <p className="empty-copy">Open a package workspace to detect test, build, lint, or typecheck scripts.</p>
        )}
      </div>

      {result ? (
        <div className={`check-result ${result.ok ? 'ok' : 'fail'}`}>
          <div className="check-result-title">
            {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            <strong>{result.command}</strong>
            <span>{(result.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <pre>{[result.stdout, result.stderr].filter(Boolean).join('\n') || 'Command produced no output.'}</pre>
        </div>
      ) : null}
    </section>
  );
}
