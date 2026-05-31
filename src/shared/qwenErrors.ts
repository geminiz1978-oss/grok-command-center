export type QwenErrorKind =
  | 'api-key'
  | 'auth'
  | 'quota'
  | 'context'
  | 'network'
  | 'cli-launch'
  | 'permission'
  | 'tool'
  | 'process'
  | 'unknown';

export interface QwenErrorClassification {
  kind: QwenErrorKind;
  title: string;
  message: string;
  raw: string;
}

export function classifyQwenError(value: unknown): QwenErrorClassification {
  const raw = readErrorText(value);
  const lower = raw.toLowerCase();

  if (lower.includes('missing xai') || lower.includes('missing api key')) {
    return buildClassification(
      'api-key',
      'Grok API key is missing',
      'Save the xAI API key, then retry the prompt.',
      raw
    );
  }

  if (
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid token') ||
    /\b(401|403)\b/.test(lower)
  ) {
    return buildClassification(
      'auth',
      'Grok authentication failed',
      'Check that the saved key belongs to the selected endpoint and has access to the selected model.',
      raw
    );
  }

  if (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('insufficient balance') ||
    /\b429\b/.test(lower)
  ) {
    return buildClassification(
      'quota',
      'Grok quota or rate limit hit',
      'Wait a bit, switch to a lower-cost Grok model, or raise the provider-side quota before retrying.',
      raw
    );
  }

  if (
    lower.includes('context length') ||
    lower.includes('maximum context') ||
    lower.includes('input is too long') ||
    lower.includes('tokens') && lower.includes('limit')
  ) {
    return buildClassification(
      'context',
      'Grok context limit hit',
      'Start a fresh chat, export the current transcript if needed, or ask with fewer attachments and less history.',
      raw
    );
  }

  if (
    lower.includes('enotfound') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('network') ||
    lower.includes('fetch failed')
  ) {
    return buildClassification(
      'network',
      'Grok network request failed',
      'Check the connection and endpoint region, then retry the prompt.',
      raw
    );
  }

  if (
    lower.includes('spawn einval') ||
    lower.includes('spawn enoent') ||
    lower.includes('path to qwen executable') ||
    lower.includes('qwen executable')
  ) {
    return buildClassification(
      'cli-launch',
      'Agent CLI launch failed',
      'Clear the CLI override to use the bundled SDK CLI, or point it at a real executable path. On Windows, avoid .ps1 shims.',
      raw
    );
  }

  if (
    lower.includes('operation cancelled') ||
    lower.includes('operation canceled') ||
    lower.includes('reason: denied') ||
    lower.includes('permission denied')
  ) {
    return buildClassification(
      'permission',
      'Grok action was denied',
      'The run stopped because a requested action was cancelled or denied. Retry with a more explicit prompt or adjust permissions.',
      raw
    );
  }

  if (lower.startsWith('tool result error') || lower.startsWith('tool ')) {
    return buildClassification(
      'tool',
      'Grok tool reported an issue',
      'Grok may recover on its own. If it keeps happening, retry the task or switch to plan mode to inspect the next action.',
      raw
    );
  }

  if (lower.includes('process exited') || lower.includes('exit code') || lower.includes('run failed')) {
    return buildClassification(
      'process',
      'Grok process stopped',
      'The Grok agent process exited before finishing. Retry the prompt, or check the runtime log if it happens again.',
      raw
    );
  }

  return buildClassification(
    'unknown',
    'Grok run needs attention',
    'The agent reported an error. Retry once, then check the raw stream or runtime diagnostics if it repeats.',
    raw
  );
}

export function formatQwenErrorForChat(value: unknown): string {
  const classification = classifyQwenError(value);
  const details = classification.raw && classification.raw !== classification.message ? `\n\nDetails: ${classification.raw}` : '';

  return `${classification.title}\n${classification.message}${details}`;
}

function buildClassification(
  kind: QwenErrorKind,
  title: string,
  message: string,
  raw: string
): QwenErrorClassification {
  return {
    kind,
    title,
    message,
    raw
  };
}

function readErrorText(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value);
}
