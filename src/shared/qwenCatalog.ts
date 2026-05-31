import type { AppSettings, EndpointConfig, PromptTemplateConfig, QwenModelConfig } from './types';

export const QWEN_ENDPOINTS: EndpointConfig[] = [
  {
    key: 'xai',
    label: 'xAI API',
    apiKeyKind: 'xai',
    baseUrl: 'https://api.x.ai/v1'
  }
];

export const QWEN_MODELS: QwenModelConfig[] = [
  {
    id: 'grok-4.3',
    name: 'Grok 4.3',
    description: 'Flagship Grok model for complex coding, analysis, and long-horizon desktop work.',
    recommendedEndpoint: 'xai',
    supportsThinking: true,
    capabilities: ['thinking', 'frontier', 'agentic-coding', 'file-input', 'latest']
  },
  {
    id: 'grok-latest',
    name: 'Grok Latest',
    description: 'xAI alias for the latest stable Grok chat model.',
    recommendedEndpoint: 'xai',
    supportsThinking: true,
    capabilities: ['thinking', 'balanced', 'frontier', 'agentic-coding', 'file-input']
  },
  {
    id: 'grok-build-0.1',
    name: 'Grok Build 0.1',
    description: 'Fast coding-focused Grok model for quick edits, diffs, and tight feedback loops.',
    recommendedEndpoint: 'xai',
    supportsThinking: true,
    capabilities: ['thinking', 'coding', 'agentic-coding', 'fast', 'file-input']
  }
];

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplateConfig[] = [
  {
    id: 'inspect',
    label: 'Inspect',
    prompt: 'Inspect this workspace and summarize the current architecture, key files, scripts, and risks. Do not edit files yet.'
  },
  {
    id: 'fix-checks',
    label: 'Fix checks',
    prompt: 'Run the available checks, identify failures, fix them, and rerun the relevant checks.'
  },
  {
    id: 'ui-pass',
    label: 'UI pass',
    prompt: 'Improve the UI polish, spacing, responsive behavior, and accessibility while keeping the existing visual language.'
  },
  {
    id: 'review',
    label: 'Review',
    prompt: 'Review the current git changes for bugs, regressions, and missing tests. Do not edit files unless asked.'
  },
  {
    id: 'game',
    label: 'Game',
    prompt: 'Build a polished browser-playable game in this workspace. Keep it self-contained unless the project already has a stack.'
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  modelId: 'grok-4.3',
  endpointKey: 'xai',
  permissionMode: 'auto-edit',
  thinkingEnabled: true,
  thinkingBudget: 8192,
  usageLimitTokens: 100000,
  previewPort: 6173,
  previewCommand: '',
  qwenExecutablePath: '',
  onboardingCompleted: false,
  promptTemplates: DEFAULT_PROMPT_TEMPLATES
};

export function getEndpoint(key: string): EndpointConfig {
  return QWEN_ENDPOINTS.find((endpoint) => endpoint.key === key) ?? QWEN_ENDPOINTS[0];
}

export function getModel(id: string): QwenModelConfig {
  return QWEN_MODELS.find((model) => model.id === id) ?? QWEN_MODELS[0];
}

export function isAllowedQwenModel(modelId: string): boolean {
  return QWEN_MODELS.some((model) => model.id === modelId);
}
