import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_CHAT_MODEL,
  LEAF_AI_CHAT_MODELS,
  resolveAIChatModel,
  resolveAIChatRequestModel,
} from '../src/aiChatModels';
import { getStandaloneAIChatModelConfig } from '../src/server/aiChatModelConfig';

describe('AI chat model selection', () => {
  it('exposes the five Leaf models without exposing credentials', () => {
    const config = getStandaloneAIChatModelConfig({
      VZCODE_EDIT_WITH_AI_API_KEY: 'secret',
    });
    expect(config).toEqual({
      defaultModel: DEFAULT_AI_CHAT_MODEL,
      models: LEAF_AI_CHAT_MODELS,
    });
    expect(config?.models).toHaveLength(5);
    expect(JSON.stringify(config)).not.toContain('secret');
  });
  it('preserves the environment override and hides the picker for custom endpoints', () => {
    expect(
      getStandaloneAIChatModelConfig({
        VZCODE_EDIT_WITH_AI_API_KEY: 'secret',
        VZCODE_EDIT_WITH_AI_MODEL_NAME: 'custom/model',
      })?.models,
    ).toContainEqual({ id: 'custom/model', label: 'custom/model' });
    expect(getStandaloneAIChatModelConfig({})).toBeUndefined();
    expect(
      getStandaloneAIChatModelConfig({
        VZCODE_EDIT_WITH_AI_API_KEY: 'secret',
        VZCODE_EDIT_WITH_AI_BASE_URL: 'http://localhost:8080/v1',
      }),
    ).toBeUndefined();
  });
  it('uses only allowed selections and never overrides a fixed host model', () => {
    const config = {
      defaultModel: DEFAULT_AI_CHAT_MODEL,
      models: LEAF_AI_CHAT_MODELS,
    };
    expect(resolveAIChatModel(config, 'openai/gpt-oss-120b')).toBe(
      'openai/gpt-oss-120b',
    );
    expect(resolveAIChatModel(config, 'removed/model')).toBe(
      DEFAULT_AI_CHAT_MODEL,
    );
    expect(
      resolveAIChatModel({ defaultModel: 'fixed' }, 'openai/gpt-oss-120b'),
    ).toBe('fixed');
    expect(resolveAIChatModel(undefined, 'old')).toBeUndefined();
    expect(resolveAIChatRequestModel({ defaultModel: 'fixed' }, 'old')).toBeUndefined();
    expect(resolveAIChatRequestModel(config, 'openai/gpt-oss-120b')).toBe('openai/gpt-oss-120b');
  });
});
