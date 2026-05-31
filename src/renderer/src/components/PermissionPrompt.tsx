import { Check, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import type { QwenPermissionRequest } from '@shared/types';

interface PermissionPromptProps {
  request: QwenPermissionRequest | null;
  queueCount: number;
  onApprove: (request: QwenPermissionRequest) => Promise<void>;
  onDeny: (request: QwenPermissionRequest) => Promise<void>;
}

export function PermissionPrompt({
  request,
  queueCount,
  onApprove,
  onDeny
}: PermissionPromptProps): JSX.Element | null {
  const [isResponding, setIsResponding] = useState(false);

  if (!request) {
    return null;
  }

  async function respond(approved: boolean): Promise<void> {
    if (!request || isResponding) {
      return;
    }

    setIsResponding(true);

    try {
      await (approved ? onApprove(request) : onDeny(request));
    } finally {
      setIsResponding(false);
    }
  }

  return (
    <div className="permission-overlay" role="dialog" aria-modal="true" aria-labelledby="permission-title">
      <section className="permission-panel">
        <div className="permission-header">
          <div className="permission-icon">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="eyebrow">Approval needed</span>
            <h2 id="permission-title">Grok wants to use a tool</h2>
          </div>
          {queueCount > 1 ? <span className="permission-queue">{queueCount} waiting</span> : null}
        </div>

        <div className="permission-summary">
          <span>{request.toolName}</span>
          <strong>{request.summary}</strong>
        </div>

        {request.suggestions?.length ? (
          <div className="permission-suggestions">
            {request.suggestions.map((suggestion) => (
              <span key={suggestion}>{suggestion}</span>
            ))}
          </div>
        ) : null}

        <details className="permission-details">
          <summary>Tool input</summary>
          <pre>{formatInput(request.input)}</pre>
        </details>

        <div className="permission-actions">
          <button className="secondary-action danger" disabled={isResponding} onClick={() => void respond(false)}>
            <X size={15} />
            Deny
          </button>
          <button className="primary-action" disabled={isResponding} onClick={() => void respond(true)}>
            <Check size={15} />
            Approve
          </button>
        </div>
      </section>
    </div>
  );
}

function formatInput(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }

  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}
