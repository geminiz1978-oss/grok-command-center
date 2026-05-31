export interface ReasoningParts {
  reasoning: string;
  content: string;
}

const THINK_BLOCK = /<think>([\s\S]*?)<\/think>/gi;

export function splitQwenReasoning(text: string): ReasoningParts {
  const reasoning: string[] = [];
  const content = text.replace(THINK_BLOCK, (_match, thinkText: string) => {
    reasoning.push(thinkText.trim());
    return '';
  });

  return {
    reasoning: reasoning.join('\n\n').trim(),
    content: content.trim()
  };
}

export function extractMessageParts(value: unknown): ReasoningParts {
  if (typeof value === 'string') {
    return splitQwenReasoning(value);
  }

  if (!value || typeof value !== 'object') {
    return { reasoning: '', content: '' };
  }

  const record = value as Record<string, unknown>;
  const reasoningContent = readString(record.reasoning_content) ?? readString(record.reasoningContent);
  const content = readContent(record.content);

  if (reasoningContent) {
    return {
      reasoning: reasoningContent.trim(),
      content: content.trim()
    };
  }

  return splitQwenReasoning(content);
}

function readContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(readContent).filter(Boolean).join('\n');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return readString(record.text) ?? readString(record.content) ?? '';
  }

  return '';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
