export interface AIChatModelOption {
  id: string;
  label: string;
}

/** Without a catalog, the host fixes the model and no picker is shown. */
export interface AIChatModelConfig {
  defaultModel: string;
  models?: readonly AIChatModelOption[];
}

export const DEFAULT_AI_CHAT_MODEL = 'anthropic/claude-haiku-5.5';

/** Snapshot of VizHub's Leaf catalog; intentionally no paid-tier models. */
export const LEAF_AI_CHAT_MODELS: readonly AIChatModelOption[] = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
  { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna' },
  { id: DEFAULT_AI_CHAT_MODEL, label: 'Claude Haiku 5.5' },
  { id: 'z-ai/glm-5.3-flash', label: 'GLM 5.3 Flash' },
];

export function resolveAIChatModel(
  config: AIChatModelConfig | undefined,
  selected: unknown,
): string | undefined {
  if (!config) return undefined;
  return typeof selected === 'string' &&
    config.models?.some(({ id }) => id === selected)
    ? selected
    : config.defaultModel;
}
