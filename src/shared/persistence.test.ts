import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './qwenCatalog';
import type { WorkshopSessionSnapshot } from './types';
import {
  SESSION_SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION,
  unwrapSessionFromStorage,
  unwrapSettingsFromStorage,
  wrapSessionForStorage,
  wrapSettingsForStorage
} from './persistence';

describe('settings persistence schema', () => {
  it('wraps settings with a versioned storage envelope', () => {
    const payload = wrapSettingsForStorage(DEFAULT_SETTINGS);

    expect(payload).toMatchObject({
      product: 'Grok Command Center',
      kind: 'settings',
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      settings: DEFAULT_SETTINGS
    });
  });

  it('reads both new envelope and legacy raw settings payloads', () => {
    const wrapped = wrapSettingsForStorage(DEFAULT_SETTINGS);

    expect(unwrapSettingsFromStorage(wrapped)).toEqual(DEFAULT_SETTINGS);
    expect(unwrapSettingsFromStorage({ modelId: 'qwen-plus' })).toEqual({ modelId: 'qwen-plus' });
  });
});

describe('session persistence schema', () => {
  const session: WorkshopSessionSnapshot = {
    activeWorkspacePath: 'C:\\work\\game',
    recentWorkspaces: [{ name: 'game', path: 'C:\\work\\game' }],
    workspaces: {},
    updatedAt: '2026-05-29T12:00:00.000Z'
  };

  it('wraps sessions with a versioned storage envelope', () => {
    const payload = wrapSessionForStorage(session);

    expect(payload).toMatchObject({
      product: 'Grok Command Center',
      kind: 'session',
      schemaVersion: SESSION_SCHEMA_VERSION,
      session
    });
  });

  it('reads both new envelope and legacy raw session payloads', () => {
    const wrapped = wrapSessionForStorage(session);

    expect(unwrapSessionFromStorage(wrapped)).toEqual(session);
    expect(unwrapSessionFromStorage({ recentWorkspaces: [] })).toEqual({ recentWorkspaces: [] });
  });
});
