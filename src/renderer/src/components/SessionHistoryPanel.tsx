import { MessageSquare, RotateCcw, Trash2 } from 'lucide-react';
import type { ChatThreadRecord } from '@shared/types';

interface SessionHistoryPanelProps {
  currentTitle: string;
  currentMessageCount: number;
  threads: ChatThreadRecord[];
  isRunning: boolean;
  workspaceReady: boolean;
  onNewSession: () => void;
  onDeleteCurrentSession: () => void;
  onRestoreThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
}

export function SessionHistoryPanel({
  currentTitle,
  currentMessageCount,
  threads,
  isRunning,
  workspaceReady,
  onNewSession,
  onDeleteCurrentSession,
  onRestoreThread,
  onDeleteThread
}: SessionHistoryPanelProps): JSX.Element {
  return (
    <section className="panel session-history-panel">
      <div className="session-history-header">
        <div>
          <span className="eyebrow">Sessions</span>
          <h2>Chat history</h2>
        </div>
        <button className="secondary-action" disabled={!workspaceReady || isRunning} onClick={onNewSession} type="button">
          <MessageSquare size={15} />
          New
        </button>
      </div>

      <div className="current-session-card" title={currentTitle}>
        <div className="current-session-copy">
          <span>Current</span>
          <strong>{currentTitle}</strong>
          <small>{currentMessageCount ? `${currentMessageCount} messages` : 'No messages yet'}</small>
        </div>
        <button
          className="icon-button danger"
          disabled={isRunning || !currentMessageCount}
          onClick={onDeleteCurrentSession}
          title="Delete current chat"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="session-thread-list">
        {threads.length ? (
          threads.map((thread) => (
            <article className="session-thread-row" key={thread.id}>
              <button
                className="session-thread-main"
                disabled={isRunning}
                onClick={() => onRestoreThread(thread.id)}
                title={`Open ${thread.title}`}
                type="button"
              >
                <strong>{thread.title}</strong>
                <span>{visibleChatEntryCount(thread)} messages - {formatDate(thread.updatedAt)}</span>
              </button>
              <button
                className="icon-button"
                disabled={isRunning}
                onClick={() => onRestoreThread(thread.id)}
                title="Open session"
                type="button"
              >
                <RotateCcw size={14} />
              </button>
              <button
                className="icon-button danger"
                disabled={isRunning}
                onClick={() => onDeleteThread(thread.id)}
                title="Delete session"
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))
        ) : (
          <p className="empty-copy">Older chats will appear here when you start a new session.</p>
        )}
      </div>
    </section>
  );
}

function visibleChatEntryCount(thread: ChatThreadRecord): number {
  return thread.chatEntries.filter(
    (entry) => entry.role !== 'raw' && entry.role !== 'reasoning' && entry.role !== 'tool' && entry.role !== 'started' && entry.role !== 'todo'
  ).length;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
