import { describe, expect, it } from 'vitest';
import { extractMessageParts, splitQwenReasoning } from './reasoning';

describe('splitQwenReasoning', () => {
  it('separates think blocks from final content', () => {
    const result = splitQwenReasoning('<think>plan first</think>\nShip the patch.');

    expect(result.reasoning).toBe('plan first');
    expect(result.content).toBe('Ship the patch.');
  });

  it('uses official reasoning_content when present', () => {
    const result = extractMessageParts({
      reasoning_content: 'internal plan',
      content: 'final answer'
    });

    expect(result.reasoning).toBe('internal plan');
    expect(result.content).toBe('final answer');
  });
});
