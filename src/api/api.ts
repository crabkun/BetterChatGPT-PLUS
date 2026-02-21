import OpenAI from 'openai';
import { ShareGPTSubmitBodyInterface } from '@type/api';
import {
  ConfigInterface,
  MessageInterface,
} from '@type/chat';

export const getChatCompletion = async (
  baseUrl: string,
  messages: MessageInterface[],
  config: ConfigInterface,
  apiKey?: string,
) => {
  const client = new OpenAI({
    apiKey: apiKey || '',
    baseURL: baseUrl.trim() || undefined,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.chat.completions.create({
    ...config,
    messages: messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    stream: false,
  });

  return response;
};

export const getChatCompletionStream = async (
  baseUrl: string,
  messages: MessageInterface[],
  config: ConfigInterface,
  apiKey?: string,
) => {
  const client = new OpenAI({
    apiKey: apiKey || '',
    baseURL: baseUrl.trim() || undefined,
    dangerouslyAllowBrowser: true,
  });

  const stream = await client.chat.completions.create({
    ...config,
    messages: messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    stream: true,
  });

  return stream;
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
