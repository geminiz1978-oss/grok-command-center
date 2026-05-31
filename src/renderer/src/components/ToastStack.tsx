import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastNotice {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastStackProps {
  notices: ToastNotice[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ notices, onDismiss }: ToastStackProps): JSX.Element | null {
  if (!notices.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {notices.map((notice) => (
        <article className={`toast-notice ${notice.tone}`} key={notice.id}>
          {iconForTone(notice.tone)}
          <div>
            <strong>{notice.title}</strong>
            {notice.message ? <span>{notice.message}</span> : null}
          </div>
          <button className="icon-button" title="Dismiss notification" onClick={() => onDismiss(notice.id)}>
            <X size={13} />
          </button>
        </article>
      ))}
    </div>
  );
}

function iconForTone(tone: ToastTone): JSX.Element {
  if (tone === 'success') {
    return <CheckCircle2 size={16} />;
  }

  if (tone === 'warning') {
    return <AlertTriangle size={16} />;
  }

  if (tone === 'error') {
    return <XCircle size={16} />;
  }

  return <Info size={16} />;
}
