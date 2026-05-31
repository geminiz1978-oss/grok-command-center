import { app, safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DEFAULT_SETTINGS } from '../../shared/qwenCatalog';
import { unwrapSettingsFromStorage, wrapSettingsForStorage } from '../../shared/persistence';
import type { ApiKeyKind, AppSettings, PromptTemplateConfig, SecretStatus } from '../../shared/types';

type SecretFile = Partial<Record<ApiKeyKind, string>>;

export class SettingsStore {
  private readonly settingsPath = join(app.getPath('userData'), 'settings.json');
  private readonly secretsPath = join(app.getPath('userData'), 'secrets.json');

  async getSettings(): Promise<AppSettings> {
    const stored = unwrapSettingsFromStorage(await this.readJson<unknown>(this.settingsPath, {}));
    return normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...stored
    });
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const normalized = normalizeSettings(settings);
    await this.writeJson(this.settingsPath, wrapSettingsForStorage(normalized));
    return normalized;
  }

  async saveApiKey(kind: ApiKeyKind, value: string): Promise<void> {
    const secrets = await this.readJson<SecretFile>(this.secretsPath, {});
    secrets[kind] = this.encrypt(value);
    await this.writeJson(this.secretsPath, secrets);
  }

  async getApiKey(kind: ApiKeyKind): Promise<string | undefined> {
    const secrets = await this.readJson<SecretFile>(this.secretsPath, {});
    const encrypted = secrets[kind];
    return encrypted ? this.decrypt(encrypted) : undefined;
  }

  async getSecretStatus(): Promise<SecretStatus> {
    const secrets = await this.readJson<SecretFile>(this.secretsPath, {});
    return {
      xai: Boolean(secrets.xai)
    };
  }

  private encrypt(value: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return `safe:${safeStorage.encryptString(value).toString('base64')}`;
    }

    return `plain:${Buffer.from(value, 'utf8').toString('base64')}`;
  }

  private decrypt(value: string): string {
    if (value.startsWith('safe:')) {
      const payload = Buffer.from(value.slice(5), 'base64');
      return safeStorage.decryptString(payload);
    }

    if (value.startsWith('plain:')) {
      return Buffer.from(value.slice(6), 'base64').toString('utf8');
    }

    return '';
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const contents = await readFile(filePath, 'utf8');
      return JSON.parse(contents) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const qwenExecutablePath = settings.qwenExecutablePath.trim();
  const previewCommand = settings.previewCommand.trim().slice(0, 240);
  const previewPort = normalizePreviewPort(settings.previewPort);
  const usageLimitTokens = normalizeUsageLimit(settings.usageLimitTokens);
  const shimNames = ['qwen', 'qwen.cmd', 'qwen.ps1'];

  return {
    ...settings,
    previewPort,
    previewCommand,
    usageLimitTokens,
    onboardingCompleted: Boolean(settings.onboardingCompleted),
    promptTemplates: normalizePromptTemplates(settings.promptTemplates),
    qwenExecutablePath:
      process.platform === 'win32' && shimNames.includes(qwenExecutablePath.toLowerCase()) ? '' : qwenExecutablePath
  };
}

function normalizePreviewPort(value: number): number {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    return DEFAULT_SETTINGS.previewPort;
  }

  return value === 5173 ? DEFAULT_SETTINGS.previewPort : value;
}

function normalizeUsageLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1000) {
    return DEFAULT_SETTINGS.usageLimitTokens;
  }

  return Math.min(value, 10000000);
}

function normalizePromptTemplates(value: PromptTemplateConfig[]): PromptTemplateConfig[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SETTINGS.promptTemplates;
  }

  const seen = new Set<string>();
  const templates = value
    .map((template) => ({
      id: typeof template.id === 'string' && template.id.trim() ? template.id.trim() : crypto.randomUUID(),
      label: typeof template.label === 'string' ? template.label.trim().slice(0, 32) : '',
      prompt: typeof template.prompt === 'string' ? template.prompt.trim().slice(0, 4000) : ''
    }))
    .filter((template) => {
      if (!template.label || !template.prompt || seen.has(template.id)) {
        return false;
      }

      seen.add(template.id);
      return true;
    })
    .slice(0, 24);

  return templates.length ? templates : DEFAULT_SETTINGS.promptTemplates;
}
