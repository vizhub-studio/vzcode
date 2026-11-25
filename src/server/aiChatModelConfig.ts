import {
  DEFAULT_AI_CHAT_MODEL,
  LEAF_AI_CHAT_MODELS,
  type AIChatModelConfig,
} from '../aiChatModels.js';

/** Expose only model IDs and labels, never credentials. */
export function getStandaloneAIChatModelConfig(
  env: NodeJS.ProcessEnv = process.env,
): AIChatModelConfig | undefined {
  if (!env.VZCODE_EDIT_WITH_AI_API_KEY?.trim()) return undefined;
  const baseURL = env.VZCODE_EDIT_WITH_AI_BASE_URL;
  if (baseURL && baseURL.replace(/\/+$/, '') !== 'https://openrouter.ai/api/v1') {
    return undefined;
  }
  const defaultModel =
    env.VZCODE_EDIT_WITH_AI_MODEL_NAME?.trim() || DEFAULT_AI_CHAT_MODEL;
  const models = LEAF_AI_CHAT_MODELS.some(({ id }) => id === defaultModel)
    ? LEAF_AI_CHAT_MODELS
    : [...LEAF_AI_CHAT_MODELS, { id: defaultModel, label: defaultModel }];
  return { defaultModel, models };
}
