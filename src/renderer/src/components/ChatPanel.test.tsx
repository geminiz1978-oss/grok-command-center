import { describe, expect, it } from 'vitest';
import type { ChatEntry } from '@shared/types';
import { buildChatRenderItems, splitMessageBlocks } from './ChatPanel';

describe('splitMessageBlocks', () => {
  it('splits prose and fenced code blocks for the chat renderer', () => {
    const blocks = splitMessageBlocks('## Build\n- create canvas\n\n```ts\nconst score = 7;\n```\nDone.');

    expect(blocks).toEqual([
      {
        id: 'text-0',
        kind: 'text',
        lines: ['## Build', '- create canvas', '']
      },
      {
        id: 'code-1',
        kind: 'code',
        language: 'ts',
        text: 'const score = 7;'
      },
      {
        id: 'text-2',
        kind: 'text',
        lines: ['Done.']
      }
    ]);
  });

  it('keeps unfinished fenced output readable instead of dropping it', () => {
    expect(splitMessageBlocks('```html\n<div>partial')).toEqual([
      {
        id: 'code-0',
        kind: 'code',
        language: 'html',
        text: '<div>partial'
      }
    ]);
  });
});

describe('buildChatRenderItems', () => {
  it('keeps internal reasoning and tool chatter out of the main transcript', () => {
    const entries: ChatEntry[] = [
      chatEntry('1', 'user', 'fix the game'),
      chatEntry('2', 'reasoning', 'thinking'),
      chatEntry('3', 'tool', 'read file'),
      chatEntry('4', 'assistant', 'fixed it'),
      chatEntry('5', 'done', 'complete')
    ];

    const items = buildChatRenderItems(entries);

    expect(items.map((item) => item.kind)).toEqual(['entry', 'entry', 'entry']);
    expect(items.map((item) => item.entry.role)).toEqual(['user', 'assistant', 'done']);
  });
});

function chatEntry(id: string, role: ChatEntry['role'], text: string): ChatEntry {
  return {
    id,
    role,
    text,
    createdAt: '2026-05-30T00:00:00.000Z'
  };
}
