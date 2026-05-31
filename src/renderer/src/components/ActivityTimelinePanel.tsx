import { Activity, Bot, CheckCircle2, Play, Terminal, UserRound, XCircle } from 'lucide-react';
import type { ChatEntry, PreviewInfo, WorkspaceCommandHistoryItem } from '@shared/types';

interface ActivityTimelinePanelProps {
  chatEntries: ChatEntry[];
  commandHistory: WorkspaceCommandHistoryItem[];
  previewInfo: PreviewInfo | null;
  isRunning: boolean;
}

interface TimelineItem {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  tone: 'normal' | 'ok' | 'warning' | 'error';
  icon: JSX.Element;
}

export function ActivityTimelinePanel({
  chatEntries,
  commandHistory,
  previewInfo,
  isRunning
}: ActivityTimelinePanelProps): JSX.Element {
  const items = buildTimelineItems(chatEntries, commandHistory, previewInfo, isRunning);

  return (
    <section className="panel activity-timeline-panel">
      <div className="activity-timeline-header">
        <div>
          <span className="eyebrow">Activity</span>
          <h2>Run timeline</h2>
        </div>
        <span className={`timeline-status ${isRunning ? 'working' : ''}`}>
          <Activity size={14} />
          {isRunning ? 'Working' : `${items.length} events`}
        </span>
      </div>

      <div className="activity-timeline-list">
        {items.length ? (
          items.map((item) => (
            <article className={`activity-timeline-row ${item.tone}`} key={item.id}>
              <div className="timeline-icon">{item.icon}</div>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <time>{formatTime(item.createdAt)}</time>
            </article>
          ))
        ) : (
          <p className="empty-copy">Activity will appear here as Grok runs, tools execute, checks finish, and previews start.</p>
        )}
      </div>
    </section>
  );
}

function buildTimelineItems(
  chatEntries: ChatEntry[],
  commandHistory: WorkspaceCommandHistoryItem[],
  previewInfo: PreviewInfo | null,
  isRunning: boolean
): TimelineItem[] {
  const chatItems: TimelineItem[] = chatEntries
    .filter((entry) => shouldShowChatEntry(entry))
    .slice(-18)
    .map((entry) => ({
      id: entry.id,
      title: titleForChatEntry(entry),
      detail: compact(entry.text),
      createdAt: entry.createdAt,
      tone: toneForChatEntry(entry),
      icon: iconForChatEntry(entry)
    }));

  const commandItems: TimelineItem[] = commandHistory.slice(0, 8).map((item) => ({
    id: `command-${item.id}`,
    title: item.ok ? 'Command passed' : 'Command failed',
    detail: item.command,
    createdAt: item.createdAt,
    tone: item.ok ? 'ok' : 'error',
    icon: item.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />
  }));

  const previewItem = previewInfo
    ? [
        {
          id: `preview-${previewInfo.previewId}-${previewInfo.status}`,
          title: `Preview ${previewInfo.status}`,
          detail: previewInfo.url,
          createdAt: new Date().toISOString(),
          tone: previewInfo.status === 'error' ? 'error' : previewInfo.status === 'running' ? 'ok' : 'normal',
          icon: <Play size={14} />
        } satisfies TimelineItem
      ]
    : [];

  const activeItem = isRunning
    ? [
        {
          id: 'active-run',
          title: 'Grok is working',
          detail: 'Streaming updates, tool calls, or thinking may still be in progress.',
          createdAt: new Date().toISOString(),
          tone: 'warning',
          icon: <Activity size={14} />
        } satisfies TimelineItem
      ]
    : [];

  return [...activeItem, ...previewItem, ...commandItems, ...chatItems]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 18);
}

function shouldShowChatEntry(entry: ChatEntry): boolean {
  return entry.role !== 'raw' && entry.role !== 'reasoning' && entry.role !== 'todo' && Boolean(entry.text.trim());
}

function titleForChatEntry(entry: ChatEntry): string {
  if (entry.role === 'user') {
    return 'Prompt sent';
  }

  if (entry.role === 'assistant' || entry.role === 'result') {
    return 'Grok response';
  }

  if (entry.role === 'tool') {
    return 'Tool activity';
  }

  if (entry.role === 'error') {
    return 'Error';
  }

  return 'System update';
}

function toneForChatEntry(entry: ChatEntry): TimelineItem['tone'] {
  if (entry.role === 'error') {
    return 'error';
  }

  if (entry.role === 'assistant' || entry.role === 'result' || entry.role === 'done') {
    return 'ok';
  }

  if (entry.role === 'tool') {
    return 'warning';
  }

  return 'normal';
}

function iconForChatEntry(entry: ChatEntry): JSX.Element {
  if (entry.role === 'user') {
    return <UserRound size={14} />;
  }

  if (entry.role === 'tool') {
    return <Terminal size={14} />;
  }

  if (entry.role === 'error') {
    return <XCircle size={14} />;
  }

  return <Bot size={14} />;
}

function compact(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > 96 ? `${singleLine.slice(0, 93)}...` : singleLine;
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}
