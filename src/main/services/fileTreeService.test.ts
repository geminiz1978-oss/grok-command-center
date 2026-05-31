import { describe, expect, it } from 'vitest';
import { shouldIgnore } from './fileTreeService';

describe('shouldIgnore', () => {
  it('ignores large generated directories', () => {
    expect(shouldIgnore('node_modules')).toBe(true);
    expect(shouldIgnore('.git')).toBe(true);
    expect(shouldIgnore('src')).toBe(false);
  });
});
