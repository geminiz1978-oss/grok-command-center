import type { AppSettings, WorkshopSessionSnapshot } from './types';

export function formatSettingsBackup(settings: AppSettings): string {
  return `${JSON.stringify(
    {
      product: 'Grok Command Center',
      version: 1,
      exportedAt: new Date().toISOString(),
      secrets: 'excluded',
      settings
    },
    null,
    2
  )}\n`;
}

export function formatSessionBackup(session: WorkshopSessionSnapshot): string {
  return `${JSON.stringify(
    {
      product: 'Grok Command Center',
      kind: 'session',
      version: 1,
      exportedAt: new Date().toISOString(),
      secrets: 'excluded',
      projectFiles: 'excluded',
      session
    },
    null,
    2
  )}\n`;
}

export function readSettingsBackup(payload: unknown): Partial<AppSettings> {
  const candidate =
    payload && typeof payload === 'object' && 'settings' in payload
      ? (payload as { settings?: unknown }).settings
      : payload;

  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Selected file is not a Grok Command Center settings backup.');
  }

  const record = candidate as Record<string, unknown>;

  return {
    ...(typeof record.modelId === 'string' ? { modelId: record.modelId } : {}),
    ...(typeof record.endpointKey === 'string' ? { endpointKey: record.endpointKey as AppSettings['endpointKey'] } : {}),
    ...(typeof record.permissionMode === 'string'
      ? { permissionMode: record.permissionMode as AppSettings['permissionMode'] }
      : {}),
    ...(typeof record.thinkingEnabled === 'boolean' ? { thinkingEnabled: record.thinkingEnabled } : {}),
    ...(typeof record.thinkingBudget === 'number' ? { thinkingBudget: record.thinkingBudget } : {}),
    ...(typeof record.usageLimitTokens === 'number' ? { usageLimitTokens: record.usageLimitTokens } : {}),
    ...(typeof record.previewPort === 'number' ? { previewPort: record.previewPort } : {}),
    ...(typeof record.previewCommand === 'string' ? { previewCommand: record.previewCommand } : {}),
    ...(typeof record.qwenExecutablePath === 'string' ? { qwenExecutablePath: record.qwenExecutablePath } : {}),
    ...(typeof record.onboardingCompleted === 'boolean' ? { onboardingCompleted: record.onboardingCompleted } : {}),
    ...(Array.isArray(record.promptTemplates) ? { promptTemplates: record.promptTemplates as AppSettings['promptTemplates'] } : {})
  };
}

export function readSessionBackup(payload: unknown): WorkshopSessionSnapshot {
  const candidate =
    payload && typeof payload === 'object' && 'session' in payload
      ? (payload as { session?: unknown }).session
      : payload;

  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Selected file is not a Grok Command Center session backup.');
  }

  return candidate as WorkshopSessionSnapshot;
}
