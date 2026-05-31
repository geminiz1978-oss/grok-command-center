import { describe, expect, it } from 'vitest';
import { classifyQwenError, formatQwenErrorForChat } from './qwenErrors';

describe('classifyQwenError', () => {
  it('recognizes Windows CLI spawn failures', () => {
    const result = classifyQwenError('spawn EINVAL');

    expect(result.kind).toBe('cli-launch');
    expect(result.title).toBe('Agent CLI launch failed');
  });

  it('recognizes provider quota and rate limits', () => {
    const result = classifyQwenError('Grok API returned 429: rate limit exceeded');

    expect(result.kind).toBe('quota');
    expect(result.message).toContain('quota');
  });

  it('formats missing key errors with a direct next step', () => {
    expect(formatQwenErrorForChat('Missing xAI API key.')).toContain('Save the xAI API key');
  });

  it('keeps raw details for support debugging', () => {
    expect(formatQwenErrorForChat('Tool result error: file was not found')).toContain('Details: Tool result error');
  });
});
