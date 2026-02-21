import { GoogleGenAI } from '@google/genai';
import {
    ConfigInterface,
    MessageInterface,
    ThinkingLevel,
    isImageContent,
    isTextContent,
} from '@type/chat';
import { ApiProvider, GeminiVertexConfig } from '@type/provider';

/**
 * Convert our internal MessageInterface[] to Gemini SDK format.
 * - Extracts system messages → systemInstruction
 * - Maps role 'assistant' → 'model'
 * - Maps ContentInterface[] → Gemini parts[]
 */
const convertMessages = (messages: MessageInterface[]) => {
    let systemInstruction: string | undefined;
    const contents: Array<{ role: string; parts: Array<Record<string, any>> }> =
        [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            // Gemini uses systemInstruction config rather than a system role
            const textParts = msg.content
                .filter(isTextContent)
                .map((c) => c.text)
                .join('\n');
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n${textParts}`
                : textParts;
            continue;
        }

        const parts: Array<Record<string, any>> = [];
        for (const c of msg.content) {
            if (isTextContent(c)) {
                parts.push({ text: c.text });
            } else if (isImageContent(c)) {
                // Gemini supports inline image data
                const url = c.image_url.url;
                if (url.startsWith('data:')) {
                    const match = url.match(/^data:(.+?);base64,(.+)$/);
                    if (match) {
                        parts.push({
                            inlineData: {
                                mimeType: match[1],
                                data: match[2],
                            },
                        });
                    }
                } else {
                    // URL-based images — pass as file data
                    parts.push({ text: `[Image: ${url}]` });
                }
            }
            // Skip reasoning content — Gemini doesn't need it
        }

        if (parts.length > 0) {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts,
            });
        }
    }

    return { systemInstruction, contents };
};

/**
 * Create a GoogleGenAI client for the given provider.
 */
const createClient = (
    apiKey: string,
    provider: ApiProvider,
    vertexConfig?: GeminiVertexConfig
): GoogleGenAI => {
    if (provider === 'gemini-vertexai' && vertexConfig) {
        return new GoogleGenAI({
            vertexai: true,
            project: vertexConfig.projectId,
            location: vertexConfig.location,
            apiKey,
        });
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Map our unified ThinkingLevel to Gemini SDK thinkingConfig.
 * - Gemini 2.5 models use thinkingBudget (number)
 * - Gemini 3.x+ models use thinkingLevel (string)
 */
const mapThinkingConfig = (level: ThinkingLevel | undefined, model: string) => {
    const effectiveLevel = level || 'high';
    const is25 = model.includes('gemini-2.5') || model.includes('gemini-2.0');

    if (is25) {
        const budgetMap: Record<ThinkingLevel, number> = {
            minimal: 0,
            low: 1024,
            medium: 8192,
            high: -1,   // dynamic
        };
        return {
            includeThoughts: true,
            thinkingBudget: budgetMap[effectiveLevel],
        };
    }

    // Gemini 3.x — use thinkingLevel directly
    // Cast to any because SDK exports ThinkingLevel as an enum
    // but the underlying API accepts the same string values
    return {
        includeThoughts: true,
        thinkingLevel: effectiveLevel as any,
    };
};

/**
 * Non-streaming Gemini chat completion.
 * Returns a response shaped like OpenAI's ChatCompletion for compatibility.
 * Handles thinking parts (thought: true) by returning them as reasoning_content.
 */
export const getGeminiChatCompletion = async (
    messages: MessageInterface[],
    config: ConfigInterface,
    apiKey?: string,
    provider: ApiProvider = 'gemini-aistudio',
    vertexConfig?: GeminiVertexConfig
) => {
    const client = createClient(apiKey || '', provider, vertexConfig);
    const { systemInstruction, contents } = convertMessages(messages);

    const response = await client.models.generateContent({
        model: config.model,
        contents: contents as any,
        config: {
            systemInstruction,
            temperature: config.temperature,
            topP: config.top_p,
            presencePenalty: config.presence_penalty,
            frequencyPenalty: config.frequency_penalty,
            thinkingConfig: mapThinkingConfig(config.thinking_level, config.model),
        },
    });

    // Separate thinking parts from content parts
    let contentText = '';
    let reasoningText = '';
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (!part.text) continue;
            if ((part as any).thought) {
                reasoningText += part.text;
            } else {
                contentText += part.text;
            }
        }
    } else {
        // Fallback to response.text if parts not available
        contentText = response.text || '';
    }

    // Return OpenAI-compatible shape with reasoning_content
    return {
        choices: [
            {
                message: {
                    role: 'assistant' as const,
                    content: contentText,
                    reasoning_content: reasoningText || undefined,
                },
            },
        ],
    };
};

/**
 * Streaming Gemini chat completion.
 * Returns an async iterable that yields OpenAI-like chunk objects.
 * Handles thinking parts by emitting reasoning_content in delta.
 */
export const getGeminiChatCompletionStream = async (
    messages: MessageInterface[],
    config: ConfigInterface,
    apiKey?: string,
    provider: ApiProvider = 'gemini-aistudio',
    vertexConfig?: GeminiVertexConfig
) => {
    const client = createClient(apiKey || '', provider, vertexConfig);
    const { systemInstruction, contents } = convertMessages(messages);

    const stream = await client.models.generateContentStream({
        model: config.model,
        contents: contents as any,
        config: {
            systemInstruction,
            temperature: config.temperature,
            topP: config.top_p,
            presencePenalty: config.presence_penalty,
            frequencyPenalty: config.frequency_penalty,
            thinkingConfig: mapThinkingConfig(config.thinking_level, config.model),
        },
    });

    // Wrap in an async generator that yields OpenAI-compatible chunks
    // Separates thinking parts (thought: true) into reasoning_content
    async function* toOpenAIChunks() {
        for await (const chunk of stream) {
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (parts) {
                let contentText = '';
                let reasoningText = '';
                for (const part of parts) {
                    if (!part.text) continue;
                    if ((part as any).thought) {
                        reasoningText += part.text;
                    } else {
                        contentText += part.text;
                    }
                }
                // Yield a single chunk per iteration with both content and reasoning
                if (contentText || reasoningText) {
                    yield {
                        choices: [
                            {
                                delta: {
                                    content: contentText || null,
                                    reasoning_content: reasoningText || null,
                                },
                            },
                        ],
                    };
                }
            } else {
                // Fallback: use chunk.text for models without parts
                const text = chunk.text || '';
                if (text) {
                    yield {
                        choices: [
                            {
                                delta: {
                                    content: text,
                                    reasoning_content: null,
                                },
                            },
                        ],
                    };
                }
            }
        }
    }

    return toOpenAIChunks();
};
