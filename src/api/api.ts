import { ShareGPTSubmitBodyInterface } from '@type/api';
import {
  ConfigInterface,
  MessageInterface,
} from '@type/chat';
import useStore from '@store/store';

import { getOpenAIChatCompletion, getOpenAIChatCompletionStream } from './openai';
import { getGeminiChatCompletion, getGeminiChatCompletionStream } from './gemini';

/**
 * Resolve the effective API key and provider-specific config from the store.
 * This encapsulates all provider-aware logic so callers don't need to know about it.
 */
const resolveProviderConfig = () => {
  const state = useStore.getState();
  const provider = state.apiProvider;

  if (provider === 'gemini-aistudio') {
    return {
      provider,
      apiKey: state.geminiApiKey,
      baseUrl: '',
      vertexConfig: undefined,
    } as const;
  }

  if (provider === 'gemini-vertexai') {
    return {
      provider,
      apiKey: state.geminiApiKey,
      baseUrl: '',
      vertexConfig: {
        projectId: state.geminiVertexProjectId,
        location: state.geminiVertexLocation,
      },
    } as const;
  }

  return {
    provider: 'openai' as const,
    apiKey: state.apiKey,
    baseUrl: state.apiBaseUrl,
    vertexConfig: undefined,
  };
};

/**
 * Unified non-streaming chat completion.
 * Reads provider config from the store internally — callers only pass messages + config.
 */
export const getChatCompletion = async (
  messages: MessageInterface[],
  config: ConfigInterface,
  signal?: AbortSignal,
) => {
  const { provider, apiKey, baseUrl, vertexConfig } = resolveProviderConfig();

  if (provider === 'gemini-aistudio' || provider === 'gemini-vertexai') {
    return getGeminiChatCompletion(messages, config, apiKey, provider, vertexConfig, signal);
  }

  return getOpenAIChatCompletion(baseUrl, messages, config, apiKey, signal);
};

/**
 * Unified streaming chat completion.
 * Reads provider config from the store internally — callers only pass messages + config.
 */
export const getChatCompletionStream = async (
  messages: MessageInterface[],
  config: ConfigInterface,
  signal?: AbortSignal,
) => {
  const { provider, apiKey, baseUrl, vertexConfig } = resolveProviderConfig();

  if (provider === 'gemini-aistudio' || provider === 'gemini-vertexai') {
    return getGeminiChatCompletionStream(messages, config, apiKey, provider, vertexConfig, signal);
  }

  return getOpenAIChatCompletionStream(baseUrl, messages, config, apiKey, signal);
};

export const submitShareGPT = async (body: ShareGPTSubmitBodyInterface) => {
  const request = await fetch('https://sharegpt.com/api/conversations', {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const response = await request.json();
  const { id } = response;
  const url = `https://shareg.pt/${id}`;
  window.open(url, '_blank');
};
