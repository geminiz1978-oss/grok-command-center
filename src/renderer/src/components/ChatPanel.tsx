import {
  Bot,
  Brain,
  Check,
  CircleStop,
  Clipboard,
  Copy,
  Download,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Hourglass,
  Image,
  Mic,
  MicOff,
  Paperclip,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Terminal,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { AttachmentInfo, ChatEntry, PromptTemplateConfig, QwenRunPhase, QwenRunStatus } from '@shared/types';

interface ChatPanelProps {
  entries: ChatEntry[];
  isRunning: boolean;
  runStatus: QwenRunStatus | null;
  runStatusNow: number;
  canRetry: boolean;
  workspaceReady: boolean;
  onSubmit: (prompt: string, attachments: AttachmentInfo[]) => Promise<void>;
  onImportAttachments: (files: File[]) => Promise<AttachmentInfo[]>;
  onRetryLast: () => Promise<void>;
  onExportTranscript: () => Promise<void>;
  onNewSession: () => void;
  onDeleteSession: () => void;
  onManagePromptTemplates: () => void;
  onInterrupt: () => Promise<void>;
  promptTemplates: PromptTemplateConfig[];
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

export function ChatPanel({
  entries,
  isRunning,
  runStatus,
  runStatusNow,
  canRetry,
  workspaceReady,
  onSubmit,
  onImportAttachments,
  onRetryLast,
  onExportTranscript,
  onNewSession,
  onDeleteSession,
  onManagePromptTemplates,
  onInterrupt,
  promptTemplates
}: ChatPanelProps): JSX.Element {
  const [prompt, setPrompt] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentInfo[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const visibleEntries = entries.filter((entry) => entry.role !== 'raw' && !isInternalActivityEntry(entry));
  const renderItems = buildChatRenderItems(visibleEntries);
  const rawEntries = entries.filter((entry) => entry.role === 'raw');
  const canSubmit = Boolean(prompt.trim() || pendingAttachments.length) && workspaceReady && !isRunning && !isImporting;
  const isStalled = runStatus?.phase === 'stalled';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = prompt.trim();
    if (!canSubmit) {
      return;
    }

    const attachments = pendingAttachments;
    setPrompt('');
    setPendingAttachments([]);
    await onSubmit(value, attachments);
  }

  async function copyTranscript(): Promise<void> {
    const transcript = visibleEntries
      .map(formatTranscriptEntry)
      .join('\n\n---\n\n');

    await copyText(transcript);
    setCopiedTranscript(true);
    window.setTimeout(() => setCopiedTranscript(false), 1400);
  }

  async function copyRawStream(): Promise<void> {
    await copyText(rawEntries.map((entry) => entry.text).join('\n\n--- RAW EVENT ---\n\n'));
    setCopiedRaw(true);
    window.setTimeout(() => setCopiedRaw(false), 1400);
  }

  async function importFiles(files: File[]): Promise<void> {
    if (!files.length || !workspaceReady || isRunning) {
      return;
    }

    setIsImporting(true);

    try {
      const imported = await onImportAttachments(files);
      setPendingAttachments((current) => mergeAttachments(current, imported));
    } finally {
      setIsImporting(false);
    }
  }

  function removeAttachment(attachmentId: string): void {
    setPendingAttachments((attachments) => attachments.filter((attachment) => attachment.id !== attachmentId));
  }

  function openFilePicker(): void {
    fileInputRef.current?.click();
  }

  async function handlePickedFiles(files: FileList | null): Promise<void> {
    await importFiles(Array.from(files ?? []));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = workspaceReady && !isRunning ? 'copy' : 'none';
  }

  async function handleDrop(event: DragEvent<HTMLElement>): Promise<void> {
    event.preventDefault();
    await importFiles(Array.from(event.dataTransfer.files));
  }

  function toggleDictation(): void {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      const transcript = readFinalTranscript(event);
      if (transcript) {
        setPrompt((value) => `${value}${value.trim() ? ' ' : ''}${transcript}`);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function applyPromptTemplate(template: PromptTemplateConfig): void {
    setPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${template.prompt}` : template.prompt;
    });
  }

  return (
    <section className="panel chat-panel" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="panel-header">
        <div>
          <span className="eyebrow">Agent</span>
          <h2>Grok session</h2>
        </div>
        <div className="chat-actions">
          {isRunning ? <WorkingIndicator compact stalled={isStalled} /> : null}
          <button className="secondary-action raw-toggle" onClick={() => setRawOpen((open) => !open)} disabled={!rawEntries.length}>
            <Terminal size={15} />
            Raw {rawEntries.length}
          </button>
          <button className="icon-button" title="Copy transcript" onClick={copyTranscript} disabled={!visibleEntries.length}>
            {copiedTranscript ? <Check size={15} /> : <Clipboard size={15} />}
          </button>
          <button className="icon-button" title="Export transcript" onClick={() => void onExportTranscript()} disabled={!visibleEntries.length}>
            <Download size={15} />
          </button>
          <button className="icon-button" title="New chat session" onClick={onNewSession} disabled={isRunning || !workspaceReady}>
            <RefreshCw size={15} />
          </button>
          <button className="icon-button danger" title="Delete current chat" onClick={onDeleteSession} disabled={isRunning || !visibleEntries.length}>
            <Trash2 size={15} />
          </button>
          {isRunning ? (
            <button className="secondary-action danger" onClick={onInterrupt}>
              <CircleStop size={15} />
              Stop
            </button>
          ) : null}
        </div>
      </div>

      {runStatus ? (
        <RunStatusPanel
          canRetry={canRetry}
          isRunning={isRunning}
          now={runStatusNow}
          onInterrupt={onInterrupt}
          onRetryLast={onRetryLast}
          status={runStatus}
        />
      ) : null}

      <div className="chat-scroll" ref={scrollRef}>
        {renderItems.length ? (
          renderItems.map((item) => <ChatBubble entry={item.entry} key={item.entry.id} />)
        ) : (
          <div className="empty-chat">
            <Bot size={28} />
            <h3>Grok is ready for a workspace.</h3>
            <p>Open a folder, save an xAI API key, and start with a concrete coding task.</p>
          </div>
        )}
      </div>

      <div className="chat-dock">
        {rawOpen ? (
          <section className="raw-drawer">
            <div className="raw-drawer-header">
              <span>Raw stream</span>
              <button className="bubble-copy" onClick={copyRawStream} disabled={!rawEntries.length}>
                {copiedRaw ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedRaw ? 'Copied' : 'Copy raw'}</span>
              </button>
            </div>
            <pre>{rawEntries.length ? rawEntries.map((entry) => entry.text).join('\n\n--- RAW EVENT ---\n\n') : 'No raw stream events yet.'}</pre>
          </section>
        ) : null}

        {isRunning ? <WorkingIndicator stalled={isStalled} /> : null}

        {pendingAttachments.length ? (
          <AttachmentTray attachments={pendingAttachments} onRemove={removeAttachment} />
        ) : null}

        <div className="prompt-library" aria-label="Prompt library">
          {promptTemplates.map((template) => (
            <button
              className="prompt-template-chip"
              disabled={!workspaceReady || isRunning}
              key={template.id}
              onClick={() => applyPromptTemplate(template)}
              title={template.prompt}
              type="button"
            >
              {template.label}
            </button>
          ))}
          <button
            className="prompt-template-chip manage"
            disabled={isRunning}
            onClick={onManagePromptTemplates}
            title="Manage prompt templates"
            type="button"
          >
            <SlidersHorizontal size={13} />
            Manage
          </button>
        </div>

        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          multiple
          onChange={(event) => void handlePickedFiles(event.currentTarget.files)}
        />

        <form className="composer" onSubmit={submit}>
          <div className="composer-tools">
            <button
              className="icon-button"
              title="Attach files"
              type="button"
              disabled={!workspaceReady || isRunning || isImporting}
              onClick={openFilePicker}
            >
              <Paperclip size={16} />
            </button>
            <button
              className={`icon-button ${isListening ? 'danger' : ''}`}
              title={speechSupported ? 'Dictate prompt' : 'Speech recognition is not available in this Chromium build'}
              type="button"
              disabled={!workspaceReady || isRunning || !speechSupported}
              onClick={toggleDictation}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
          <textarea
            value={prompt}
            placeholder={
              isRunning
                ? 'Grok is working...'
                : isImporting
                  ? 'Importing attachments...'
                : workspaceReady
                  ? 'Ask Grok to inspect, edit, test, build, or drop files here...'
                  : 'Open a workspace first'
            }
            disabled={!workspaceReady || isRunning}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button className="send-button" disabled={!canSubmit} title="Send to Grok">
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}

function formatTranscriptEntry(entry: ChatEntry): string {
  const attachments = entry.attachments?.length
    ? `\n\nAttachments:\n${entry.attachments
        .map((attachment) => `- ${attachment.name} (${attachment.kind}, ${formatBytes(attachment.size)}): ${attachment.path}`)
        .join('\n')}`
    : '';

  return `${labelForRole(entry.role)}\n${entry.text}${attachments}`;
}

export type ChatRenderItem = {
  kind: 'entry';
  entry: ChatEntry;
};

export function buildChatRenderItems(entries: ChatEntry[]): ChatRenderItem[] {
  return entries.filter((entry) => !isInternalActivityEntry(entry)).map((entry) => ({ kind: 'entry', entry }));
}

function isInternalActivityEntry(entry: ChatEntry): boolean {
  return entry.role === 'reasoning' || entry.role === 'tool' || entry.role === 'started' || entry.role === 'todo';
}

function AttachmentTray({
  attachments,
  onRemove
}: {
  attachments: AttachmentInfo[];
  onRemove: (attachmentId: string) => void;
}): JSX.Element {
  return (
    <div className="attachment-tray">
      {attachments.map((attachment) => (
        <div className="attachment-chip" key={attachment.id} title={attachment.path}>
          {iconForAttachment(attachment)}
          <span>{attachment.name}</span>
          <small>{formatBytes(attachment.size)}</small>
          <button type="button" title="Remove attachment" onClick={() => onRemove(attachment.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ChatActivityGroup({ entries }: { entries: ChatEntry[] }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const reasoningCount = entries.filter((entry) => entry.role === 'reasoning').length;
  const toolCount = entries.filter((entry) => entry.role === 'tool').length;
  const latestEntry = entries[entries.length - 1];

  async function copyActivity(): Promise<void> {
    await copyText(entries.map(formatTranscriptEntry).join('\n\n---\n\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="chat-activity-group">
      <details>
        <summary>
          <span className="activity-group-title">
            <Brain size={15} />
            Grok activity
          </span>
          <span className="activity-group-summary">
            {entries.length} events
            {reasoningCount ? ` - ${reasoningCount} reasoning` : ''}
            {toolCount ? ` - ${toolCount} tools` : ''}
            {latestEntry ? ` - Latest: ${compactLine(latestEntry.text, 82)}` : ''}
          </span>
        </summary>
        <div className="activity-group-toolbar">
          <button className="bubble-copy" onClick={() => void copyActivity()} type="button">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy activity'}</span>
          </button>
        </div>
        <div className="activity-event-list">
          {entries.map((entry) => (
            <details className={`activity-event ${entry.role}`} key={entry.id}>
              <summary>
                <span>{labelForRole(entry.role)}</span>
                <code>{compactLine(entry.text, 140)}</code>
              </summary>
              <pre>{entry.text}</pre>
            </details>
          ))}
        </div>
      </details>
    </article>
  );
}

function RunStatusPanel({
  status,
  now,
  canRetry,
  isRunning,
  onRetryLast,
  onInterrupt
}: {
  status: QwenRunStatus;
  now: number;
  canRetry: boolean;
  isRunning: boolean;
  onRetryLast: () => Promise<void>;
  onInterrupt: () => Promise<void>;
}): JSX.Element {
  const elapsedMs = getRunElapsedMs(status, now);
  const idleMs = Math.max(0, now - Date.parse(status.lastEventAt));
  const statusText = status.phase === 'stalled' ? `No stream update for ${formatDuration(idleMs)}` : phaseDescription(status.phase);
  const lastActivity = status.lastTool ?? (status.lastEventKind ? labelForEventKind(status.lastEventKind) : 'Starting Grok');

  return (
    <section className={`run-status-panel phase-${status.phase}`} aria-label="Grok run status">
      <div className="run-status-heading">
        <span className="run-status-light" aria-hidden="true" />
        <div className="run-status-title">
          <strong>{labelForRunPhase(status.phase)}</strong>
          <span>
            {status.modelName} | {status.endpointLabel} | {status.permissionMode}
          </span>
        </div>
        <div className="run-status-actions">
          <button className="secondary-action" disabled={!canRetry} onClick={() => void onRetryLast()} type="button">
            <RefreshCw size={14} />
            Retry
          </button>
          {isRunning ? (
            <button className="secondary-action danger" onClick={() => void onInterrupt()} type="button">
              <CircleStop size={14} />
              Stop
            </button>
          ) : null}
        </div>
      </div>

      <div className="run-status-metrics">
        <span>
          Elapsed <strong>{formatDuration(elapsedMs)}</strong>
        </span>
        <span>
          Idle <strong>{formatDuration(idleMs)}</strong>
        </span>
        <span>
          Files <strong>{status.attachmentCount}</strong>
        </span>
        <span title={lastActivity}>
          Last <strong>{lastActivity}</strong>
        </span>
      </div>

      <p className="run-status-detail">{statusText}</p>
      <p className="run-status-prompt" title={status.prompt}>
        {status.prompt || 'Attachment review'}
      </p>
      {status.errorText ? <p className="run-status-error">{compactLine(status.errorText, 180)}</p> : null}
    </section>
  );
}

function WorkingIndicator({ compact = false, stalled = false }: { compact?: boolean; stalled?: boolean }): JSX.Element {
  return (
    <div className={`${compact ? 'agent-working compact' : 'agent-working'} ${stalled ? 'stalled' : ''}`} role="status" aria-live="polite">
      <Hourglass className="working-hourglass" size={compact ? 14 : 15} />
      <span>{compact ? (stalled ? 'Waiting' : 'Working') : stalled ? 'Grok is quiet, still waiting' : 'Grok is thinking and editing'}</span>
      <span className="working-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

function labelForRunPhase(phase: QwenRunPhase): string {
  switch (phase) {
    case 'running':
      return 'Grok is working';
    case 'stalled':
      return 'Waiting on Grok';
    case 'completed':
      return 'Run complete';
    case 'error':
      return 'Needs attention';
    case 'interrupted':
      return 'Run stopped';
  }
}

function phaseDescription(phase: QwenRunPhase): string {
  switch (phase) {
    case 'running':
      return 'Streaming updates, using tools, or thinking between steps.';
    case 'stalled':
      return 'No new stream updates yet.';
    case 'completed':
      return 'The workspace was refreshed after Grok finished.';
    case 'error':
      return 'Review the error, then retry or adjust the task.';
    case 'interrupted':
      return 'The run was stopped by the user.';
  }
}

function labelForEventKind(kind: ChatEntry['role']): string {
  if (kind === 'assistant') {
    return 'Response';
  }

  if (kind === 'reasoning') {
    return 'Reasoning';
  }

  if (kind === 'tool') {
    return 'Tool';
  }

  if (kind === 'todo') {
    return 'Plan';
  }

  if (kind === 'raw') {
    return 'Stream';
  }

  if (kind === 'error') {
    return 'Error';
  }

  if (kind === 'done') {
    return 'Done';
  }

  return 'Start';
}

function getRunElapsedMs(status: QwenRunStatus, now: number): number {
  const start = Date.parse(status.startedAt);
  const end = status.completedAt ? Date.parse(status.completedAt) : now;

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  return Math.max(0, end - start);
}

function formatDuration(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  return `${seconds}s`;
}

function compactLine(value: string, limit: number): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > limit ? `${singleLine.slice(0, limit - 3)}...` : singleLine;
}

function ChatBubble({ entry }: { entry: ChatEntry }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const icon = entry.role === 'user' ? <UserRound size={15} /> : entry.role === 'reasoning' ? <Brain size={15} /> : entry.role === 'tool' ? <Terminal size={15} /> : <Bot size={15} />;

  async function copyEntry(): Promise<void> {
    await copyText(entry.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (entry.role === 'reasoning') {
    return (
      <article className="chat-bubble reasoning">
        <div className="bubble-meta">
          <span className="bubble-role">
            {icon}
            {labelForRole(entry.role)}
          </span>
          <button className="bubble-copy" title="Copy reasoning" onClick={copyEntry}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <details className="reasoning-details">
          <summary>Show reasoning</summary>
          <pre>{entry.text}</pre>
        </details>
      </article>
    );
  }

  return (
    <article className={`chat-bubble ${entry.role}`}>
      <div className="bubble-meta">
        <span className="bubble-role">
          {icon}
          {labelForRole(entry.role)}
        </span>
        <button className="bubble-copy" title={`Copy ${labelForRole(entry.role)} message`} onClick={copyEntry}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      {entry.attachments?.length ? <ChatAttachments attachments={entry.attachments} /> : null}
      {entry.role === 'tool' || entry.role === 'system' || entry.role === 'error' ? (
        <p>{entry.text}</p>
      ) : (
        <MessageContent text={entry.text} />
      )}
    </article>
  );
}

export type MessageBlock =
  | {
      id: string;
      kind: 'code';
      language: string;
      text: string;
    }
  | {
      id: string;
      kind: 'text';
      lines: string[];
    };

function MessageContent({ text }: { text: string }): JSX.Element {
  const blocks = splitMessageBlocks(text);

  return (
    <div className="message-content">
      {blocks.map((block) =>
        block.kind === 'code' ? (
          <CodeBlock block={block} key={block.id} />
        ) : (
          <TextBlock lines={block.lines} key={block.id} />
        )
      )}
    </div>
  );
}

function CodeBlock({ block }: { block: Extract<MessageBlock, { kind: 'code' }> }): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copyCode(): Promise<void> {
    await copyText(block.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <figure className="message-code-block">
      <figcaption>
        <span>{block.language || 'code'}</span>
        <button className="bubble-copy" onClick={() => void copyCode()} type="button">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy code'}</span>
        </button>
      </figcaption>
      <pre>
        <code>{block.text}</code>
      </pre>
    </figure>
  );
}

function TextBlock({ lines }: { lines: string[] }): JSX.Element {
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];

  function flushList(): void {
    if (!listItems.length) {
      return;
    }

    elements.push(
      <ul className="message-list" key={`list-${elements.length}`}>
        {listItems.map((item, index) => (
          <li key={`${index}-${item}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const HeadingTag = (`h${Math.min(level + 2, 5)}` as keyof JSX.IntrinsicElements);
      elements.push(
        <HeadingTag className="message-heading" key={`heading-${elements.length}`}>
          {renderInlineMarkdown(headingMatch[2])}
        </HeadingTag>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    elements.push(
      <p className="message-paragraph" key={`paragraph-${elements.length}`}>
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();

  return <>{elements}</>;
}

export function splitMessageBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let textLines: string[] = [];
  let codeLines: string[] = [];
  let language = '';
  let inCode = false;

  function pushText(): void {
    if (!textLines.some((line) => line.trim())) {
      textLines = [];
      return;
    }

    blocks.push({
      id: `text-${blocks.length}`,
      kind: 'text',
      lines: textLines
    });
    textLines = [];
  }

  function pushCode(): void {
    blocks.push({
      id: `code-${blocks.length}`,
      kind: 'code',
      language,
      text: codeLines.join('\n')
    });
    codeLines = [];
    language = '';
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^```\s*([A-Za-z0-9_+.#-]*)\s*$/);

    if (fenceMatch) {
      if (inCode) {
        pushCode();
        inCode = false;
      } else {
        pushText();
        language = fenceMatch[1];
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
    } else {
      textLines.push(line);
    }
  }

  if (inCode) {
    pushCode();
  }

  pushText();

  return blocks.length
    ? blocks
    : [
        {
          id: 'text-empty',
          kind: 'text',
          lines: ['']
        }
      ];
}

function renderInlineMarkdown(text: string): Array<string | JSX.Element> {
  const parts: Array<string | JSX.Element> = [];
  const inlinePattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text))) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith('`')) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a href={linkMatch[2]} key={key} rel="noreferrer" target="_blank">
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

function ChatAttachments({ attachments }: { attachments: AttachmentInfo[] }): JSX.Element {
  return (
    <div className="chat-attachments">
      {attachments.map((attachment) => (
        <div className="chat-attachment" key={attachment.id} title={attachment.path}>
          {iconForAttachment(attachment)}
          <span>{attachment.name}</span>
          <small>{attachment.kind}</small>
        </div>
      ))}
    </div>
  );
}

function labelForRole(role: ChatEntry['role']): string {
  if (role === 'reasoning') {
    return 'Grok reasoning';
  }

  if (role === 'tool') {
    return 'Tool';
  }

  if (role === 'todo') {
    return 'Plan';
  }

  if (role === 'raw') {
    return 'Raw stream';
  }

  if (role === 'error') {
    return 'Error';
  }

  if (role === 'system') {
    return 'System';
  }

  return role === 'user' ? 'You' : 'Grok';
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

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function readFinalTranscript(event: SpeechRecognitionEventLike): string {
  const parts: string[] = [];

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (result.isFinal) {
      parts.push(result[0].transcript.trim());
    }
  }

  return parts.filter(Boolean).join(' ');
}

function mergeAttachments(current: AttachmentInfo[], incoming: AttachmentInfo[]): AttachmentInfo[] {
  const existing = new Set(current.map((attachment) => attachment.path.toLowerCase()));
  const merged = [...current];

  for (const attachment of incoming) {
    const key = attachment.path.toLowerCase();
    if (!existing.has(key)) {
      existing.add(key);
      merged.push(attachment);
    }
  }

  return merged;
}

function iconForAttachment(attachment: AttachmentInfo): JSX.Element {
  if (attachment.kind === 'image') {
    return <Image size={14} />;
  }

  if (attachment.kind === 'audio') {
    return <FileAudio size={14} />;
  }

  if (attachment.kind === 'video') {
    return <FileVideo size={14} />;
  }

  if (attachment.kind === 'text' || attachment.kind === 'pdf') {
    return <FileText size={14} />;
  }

  if (attachment.kind === 'archive') {
    return <FileArchive size={14} />;
  }

  return <FileIcon size={14} />;
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
