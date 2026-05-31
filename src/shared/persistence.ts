import type { AppSettings, WorkshopSessionSnapshot } from './types';

export const SETTINGS_SCHEMA_VERSION = 1;
export const SESSION_SCHEMA_VERSION = 1;

export interface PersistedSettingsFile {
  product: 'Grok Command Center';
  kind: 'settings';
  schemaVersion: number;
  updatedAt: string;
  settings: AppSettings;
}

export interface PersistedSessionFile {
  product: 'Grok Command Center';
  kind: 'session';
  schemaVersion: number;
  updatedAt: string;
  session: WorkshopSessionSnapshot;
}

export function wrapSettingsForStorage(settings: AppSettings): PersistedSettingsFile {
  return {
    product: 'Grok Command Center',
    kind: 'settings',
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    settings
  };
}

export function unwrapSettingsFromStorage(payload: unknown): Partial<AppSettings> {
  const candidate =
    payload && typeof payload === 'object' && 'settings' in payload
      ? (payload as { settings?: unknown }).settings
      : payload;

  return candidate && typeof candidate === 'object' ? (candidate as Partial<AppSettings>) : {};
}

export function wrapSessionForStorage(session: WorkshopSessionSnapshot): PersistedSessionFile {
  return {
    product: 'Grok Command Center',
    kind: 'session',
    schemaVersion: SESSION_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    session
  };
}

export function unwrapSessionFromStorage(payload: unknown): Partial<WorkshopSessionSnapshot> {
  const candidate =
    payload && typeof payload === 'object' && 'session' in payload
      ? (payload as { session?: unknown }).session
      : payload;

  return candidate && typeof candidate === 'object' ? (candidate as Partial<WorkshopSessionSnapshot>) : {};
}
