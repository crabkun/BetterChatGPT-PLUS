import useStore from '@store/store';

import { Tiktoken } from '@dqbd/tiktoken/lite';
import {
  isImageContent,
  isTextContent,
  MessageInterface,
  TextContentInterface,
  TotalTokenUsed,
} from '@type/chat';
import { ModelOptions } from './modelReader';
const cl100k_base = await import('@dqbd/tiktoken/encoders/cl100k_base.json');

const encoder = new Tiktoken(
  cl100k_base.bpe_ranks,
  {
    ...cl100k_base.special_tokens,
    '<|im_start|>': 100264,
    '<|im_end|>': 100265,
    '<|im_sep|>': 100266,
  },
  cl100k_base.pat_str
);

// https://github.com/dqbd/tiktoken/issues/23#issuecomment-1483317174
export const getChatGPTEncoding = (
  messages: MessageInterface[],
  model: ModelOptions
) => {
  const isGpt3 = model === 'gpt-3.5-turbo';

  const msgSep = isGpt3 ? '\n' : '';
  const roleSep = isGpt3 ? '\n' : '<|im_sep|>';

  const serialized = [
    messages
      .map(({ role, content }) => {
        const textContent = Array.isArray(content)
          ? content.find(isTextContent)
          : undefined;
        const text =
          textContent && isTextContent(textContent) ? textContent.text : '';
        return `<|im_start|>${role}${roleSep}${
          text
        }<|im_end|>`;
      })
      .join(msgSep),
    `<|im_start|>assistant${roleSep}`,
  ].join(msgSep);

  return encoder.encode(serialized, 'all');
};

const countTokens = (messages: MessageInterface[], model: ModelOptions) => {
  if (!messages || messages.length === 0) return 0;
  return getChatGPTEncoding(messages, model).length;
};

export const updateTotalTokenUsed = (
  model: ModelOptions,
  promptMessages: MessageInterface[],
  completionMessage: MessageInterface
) => {
  const setTotalTokenUsed = useStore.getState().setTotalTokenUsed;
  const updatedTotalTokenUsed: TotalTokenUsed = JSON.parse(
    JSON.stringify(useStore.getState().totalTokenUsed)
  );

  // Filter text and image prompts
  const textPrompts = promptMessages.filter(
    (e) => Array.isArray(e.content) && e.content.some(isTextContent)
  );
  
  const imgPrompts = promptMessages.filter(
    (e) => Array.isArray(e.content) && e.content.some(isImageContent)
  );

  // Count tokens
  const newPromptTokens = countTokens(textPrompts, model);
  const newImageTokens = countTokens(imgPrompts, model);
  const newCompletionTokens = countTokens([completionMessage], model);

  // Destructure existing token counts or default to 0
  const {
    promptTokens = 0,
    completionTokens = 0,
    imageTokens = 0,
  } = updatedTotalTokenUsed[model] ?? {};

  // Update token counts
  updatedTotalTokenUsed[model] = {
    promptTokens: promptTokens + newPromptTokens,
    completionTokens: completionTokens + newCompletionTokens,
    imageTokens: imageTokens + newImageTokens,
  };

  // Set the updated token counts in the store
  setTotalTokenUsed(updatedTotalTokenUsed);
};

export default countTokens;
