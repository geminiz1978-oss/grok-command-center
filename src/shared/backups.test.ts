import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './qwenCatalog';
import type { WorkshopSessionSnapshot } from './types';
import { formatSessionBackup, formatSettingsBackup, readSessionBackup, readSettingsBackup } from './backups';

describe('settings backups', () => {
  it('exports settings without secrets and reads the nested settings payload', () => {
    const backup = JSON.parse(formatSettingsBackup(DEFAULT_SETTINGS)) as Record<string, unknown>;

    expect(backup.product).toBe('Grok Command Center');
    expect(backup.secrets).toBe('excluded');
    expect(backup).not.toHaveProperty('xai');
    expect(readSettingsBackup(backup)).toMatchObject({
      modelId: DEFAULT_SETTINGS.modelId,
      endpointKey: DEFAULT_SETTINGS.endpointKey,
      permissionMode: DEFAULT_SETTINGS.permissionMode,
      previewCommand: DEFAULT_SETTINGS.previewCommand
    });
  });

  it('rejects invalid settings payloads', () => {
    expect(() => readSettingsBackup(null)).toThrow('settings backup');
  });
});

describe('session backups', () => {
  const session: WorkshopSessionSnapshot = {
    activeWorkspacePath: 'C:\\work\\pong',
    recentWorkspaces: [{ name: 'pong', path: 'C:\\work\\pong' }],
    workspaces: {},
    updatedAt: '2026-05-29T12:00:00.000Z'
  };

  it('exports session state without project files or secrets', () => {
    const backup = JSON.parse(formatSessionBackup(session)) as Record<string, unknown>;

    expect(backup.kind).toBe('session');
    expect(backup.projectFiles).toBe('excluded');
    expect(backup.secrets).toBe('excluded');
    expect(readSessionBackup(backup)).toEqual(session);
  });

  it('rejects invalid session payloads', () => {
    expect(() => readSessionBackup(undefined)).toThrow('session backup');
  });
});
