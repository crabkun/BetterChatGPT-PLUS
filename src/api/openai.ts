import OpenAI from 'openai';
import {
    ConfigInterface,
    MessageInterface,
    ThinkingLevel,
} from '@type/chat';

/**
 * Map unified thinking level to OpenAI reasoning_effort.
 * Returns undefined for non-o-series models.
 * OpenAI doesn't have 'minimal' — maps to 'low'.
 */
const getOpenAIReasoningEffort = (config: ConfigInterface): string | undefined => {
    const model = config.model.toLowerCase();
    // Only o-series models support reasoning_effort
    if (!/^o[0-9]/.test(model) && !model.includes('-o1') && !model.includes('-o3') && !model.includes('-o4')) {
        return undefined;
    }
    const levelMap: Record<ThinkingLevel, string> = {
        minimal: 'low',
        low: 'low',
        medium: 'medium',
        high: 'high',
    };
    return levelMap[config.thinking_level || 'high'];
};

/**
 * Strip non-OpenAI fields from config before passing to SDK.
 */
const stripConfig = (config: ConfigInterface) => {
    const { thinking_level, ...rest } = config;
    return rest;
};

/**
 * Non-streaming OpenAI chat completion.
 */
export const getOpenAIChatCompletion = async (
    baseUrl: string,
    messages: MessageInterface[],
    config: ConfigInterface,
    apiKey?: string,
    signal?: AbortSignal,
) => {
    const client = new OpenAI({
        apiKey: apiKey || '',
        baseURL: baseUrl.trim() || undefined,
        dangerouslyAllowBrowser: true,
    });

    const oSeriesReasoning = getOpenAIReasoningEffort(config);

    const response = await client.chat.completions.create({
        ...stripConfig(config),
        messages: messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: false,
        ...(oSeriesReasoning ? { reasoning_effort: oSeriesReasoning as any } : {}),
    }, { signal });

    return response;
};

/**
 * Streaming OpenAI chat completion.
 * Returns an async iterable that yields OpenAI-compatible chunk objects.
 */
export const getOpenAIChatCompletionStream = async (
    baseUrl: string,
    messages: MessageInterface[],
    config: ConfigInterface,
    apiKey?: string,
    signal?: AbortSignal,
) => {
    const client = new OpenAI({
        apiKey: apiKey || '',
        baseURL: baseUrl.trim() || undefined,
        dangerouslyAllowBrowser: true,
    });

    const oSeriesReasoning = getOpenAIReasoningEffort(config);

    const stream = await client.chat.completions.create({
        ...stripConfig(config),
        messages: messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: true,
        ...(oSeriesReasoning ? { reasoning_effort: oSeriesReasoning as any } : {}),
    }, { signal });

    return stream;
};
