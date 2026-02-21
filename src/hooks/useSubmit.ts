import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import {
  ChatInterface,
  ConfigInterface,
  ContentInterface,
  MessageInterface,
  ReasoningContentInterface,
  TextContentInterface,
  isReasoningContent,
} from '@type/chat';
import { getChatCompletion, getChatCompletionStream } from '@api/api';
import { updateTotalTokenUsed } from '@utils/messageUtils';
import { _defaultChatConfig } from '@constants/chat';
import { modelStreamSupport } from '@constants/modelLoader';

// Module-level AbortController so we can cancel in-flight requests
// when the user stops generation or starts a new request.
let activeAbortController: AbortController | null = null;

export const abortActiveRequest = () => {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
};

const useSubmit = () => {
  const { t, i18n } = useTranslation('api');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const apiBaseUrl = useStore((state) => state.apiBaseUrl);
  const apiKey = useStore((state) => state.apiKey);
  const setGenerating = useStore((state) => state.setGenerating);
  const generating = useStore((state) => state.generating);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const setChats = useStore((state) => state.setChats);
  const THINK_OPEN = '<think>';
  const THINK_CLOSE = '</think>';
  const THINK_OPEN_TAIL = THINK_OPEN.length - 1;
  const THINK_CLOSE_TAIL = THINK_CLOSE.length - 1;
  const stripReasoningFromContent = (content: ContentInterface[]) =>
    content.filter((entry) => !isReasoningContent(entry));
  const stripReasoningFromMessages = (
    messages: MessageInterface[]
  ): MessageInterface[] =>
    messages.map((message) => ({
      ...message,
      content: Array.isArray(message.content)
        ? message.content.filter((content) => !isReasoningContent(content))
        : message.content,
    }));
  const processThinkChunk = (
    chunk: string,
    state: { inThink: boolean; carry: string }
  ): { content: string; reasoning: string } => {
    let data = `${state.carry}${chunk}`;
    let content = '';
    let reasoning = '';
    while (data.length > 0) {
      if (state.inThink) {
        const closeIndex = data.indexOf(THINK_CLOSE);
        if (closeIndex === -1) {
          if (data.length > THINK_CLOSE_TAIL) {
            reasoning += data.slice(0, data.length - THINK_CLOSE_TAIL);
            state.carry = data.slice(-THINK_CLOSE_TAIL);
          } else {
            state.carry = data;
          }
          return { content, reasoning };
        }
        reasoning += data.slice(0, closeIndex);
        data = data.slice(closeIndex + THINK_CLOSE.length);
        state.inThink = false;
        state.carry = '';
      } else {
        const openIndex = data.indexOf(THINK_OPEN);
        if (openIndex === -1) {
          if (data.length > THINK_OPEN_TAIL) {
            content += data.slice(0, data.length - THINK_OPEN_TAIL);
            state.carry = data.slice(-THINK_OPEN_TAIL);
          } else {
            state.carry = data;
          }
          return { content, reasoning };
        }
        content += data.slice(0, openIndex);
        data = data.slice(openIndex + THINK_OPEN.length);
        state.inThink = true;
        state.carry = '';
      }
    }
    state.carry = '';
    return { content, reasoning };
  };
  const flushThinkState = (state: {
    inThink: boolean;
    carry: string;
  }): { content: string; reasoning: string } => {
    if (!state.carry) {
      return { content: '', reasoning: '' };
    }
    const leftover = state.carry;
    state.carry = '';
    if (state.inThink) {
      return { content: '', reasoning: leftover };
    }
    return { content: leftover, reasoning: '' };
  };

  const generateTitle = async (
    message: MessageInterface[],
    modelConfig: ConfigInterface
  ): Promise<string> => {
    let data;
    try {
      const titleChatConfig = {
        ...(apiKey ? modelConfig : _defaultChatConfig),
        model: useStore.getState().titleModel ?? (apiKey ? modelConfig : _defaultChatConfig).model,
      };
      data = await getChatCompletion(
        message,
        titleChatConfig,
      );
    } catch (error: unknown) {
      throw new Error(
        `${t('errors.errorGeneratingTitle')}\n${(error as Error).message}`
      );
    }
    return data.choices[0].message.content || '';
  };

  const handleSubmit = async () => {
    const chats = useStore.getState().chats;
    if (generating || !chats) return;

    const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));

    updatedChats[currentChatIndex].messages.push({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '',
        } as TextContentInterface,
      ],
    });

    setChats(updatedChats);
    setGenerating(true);

    // Abort any previous in-flight request and create a new controller
    abortActiveRequest();
    const abortController = new AbortController();
    activeAbortController = abortController;
    const signal = abortController.signal;

    try {
      const isStreamSupported =
        modelStreamSupport[chats[currentChatIndex].config.model];
      const { model } = chats[currentChatIndex].config;
      const supportsStream = modelStreamSupport[model];
      console.log('[useSubmit] Model streaming support:', {
        model,
        supportsStream,
        isStreamSupported
      });
      let data;
      if (chats[currentChatIndex].messages.length === 0)
        throw new Error(t('errors.noMessagesSubmitted') as string);

      const messages = stripReasoningFromMessages(
        chats[currentChatIndex].messages
      );
      if (!isStreamSupported) {
        data = await getChatCompletion(
          messages,
          chats[currentChatIndex].config,
          signal,
        );

        if (
          !data ||
          !data.choices ||
          !data.choices[0] ||
          !data.choices[0].message ||
          !data.choices[0].message.content
        ) {
          throw new Error(t('errors.failedToRetrieveData') as string);
        }

        const updatedChats: ChatInterface[] = JSON.parse(
          JSON.stringify(useStore.getState().chats)
        );
        const updatedMessages = updatedChats[currentChatIndex].messages;
        const latestMessage = updatedMessages[updatedMessages.length - 1];
        const thinkState = { inThink: false, carry: '' };
        const parsed = processThinkChunk(
          data.choices[0].message.content,
          thinkState
        );
        const flushParsed = flushThinkState(thinkState);
        const finalContent = parsed.content + flushParsed.content;
        // Merge think-tag reasoning with native reasoning_content (e.g. Gemini thinking)
        const nativeReasoning = (data.choices[0].message as any).reasoning_content || '';
        const finalReasoning = nativeReasoning + parsed.reasoning + flushParsed.reasoning;
        (
          latestMessage.content[0] as TextContentInterface
        ).text += finalContent;
        if (finalReasoning) {
          const reasoningEntry: ReasoningContentInterface = {
            type: 'reasoning',
            text: finalReasoning,
            isCollapsed: true,
            isCompleted: true,
          };
          const nextContent: ContentInterface[] = [];
          if (latestMessage.content.length > 0) {
            nextContent.push(latestMessage.content[0]);
            nextContent.push(reasoningEntry);
            nextContent.push(...latestMessage.content.slice(1));
          } else {
            nextContent.push(reasoningEntry);
          }
          latestMessage.content = nextContent;
        }
        setChats(updatedChats);
      } else {
        const stream = await getChatCompletionStream(
          messages,
          chats[currentChatIndex].config,
          signal,
        );

        if (stream) {
          let reasoningStart: number | null = null;
          let reasoningCompleted = false;
          const thinkState = { inThink: false, carry: '' };
          const applyStreamResultStrings = (resultStrings: {
            content: string;
            reasoning: string;
            hasContent: boolean;
          }) => {
            const updatedChats: ChatInterface[] = JSON.parse(
              JSON.stringify(useStore.getState().chats)
            );
            const updatedMessages = updatedChats[currentChatIndex].messages;
            const latestMessage = updatedMessages[updatedMessages.length - 1];
            if (resultStrings.reasoning) {
              let reasoningIndex = latestMessage.content.findIndex((content) =>
                isReasoningContent(content)
              );
              if (reasoningIndex === -1) {
                const reasoningEntry: ReasoningContentInterface = {
                  type: 'reasoning',
                  text: '',
                  isCollapsed: false,
                  isCompleted: false,
                };
                const nextContent: ContentInterface[] = [];
                if (latestMessage.content.length > 0) {
                  nextContent.push(latestMessage.content[0]);
                  nextContent.push(reasoningEntry);
                  nextContent.push(...latestMessage.content.slice(1));
                } else {
                  nextContent.push(reasoningEntry);
                }
                latestMessage.content = nextContent;
                reasoningIndex = nextContent.indexOf(reasoningEntry);
              }
              const reasoningEntry = latestMessage.content[
                reasoningIndex
              ] as ReasoningContentInterface;
              reasoningEntry.text += resultStrings.reasoning;
            }
            const liveReasoningEntry = latestMessage.content.find(
              (content) => isReasoningContent(content)
            ) as ReasoningContentInterface | undefined;
            if (liveReasoningEntry && reasoningStart && !reasoningCompleted) {
              const durationSeconds = Math.max(
                1,
                Math.ceil((Date.now() - reasoningStart) / 1000)
              );
              liveReasoningEntry.durationSeconds = durationSeconds;
              liveReasoningEntry.isCompleted = false;
            }
            if (
              resultStrings.hasContent &&
              reasoningStart &&
              !reasoningCompleted
            ) {
              const durationSeconds = Math.max(
                1,
                Math.ceil((Date.now() - reasoningStart) / 1000)
              );
              const reasoningEntry = latestMessage.content.find(
                (content) => isReasoningContent(content)
              ) as ReasoningContentInterface | undefined;
              if (reasoningEntry) {
                reasoningEntry.isCollapsed = true;
                reasoningEntry.durationSeconds = durationSeconds;
                reasoningEntry.isCompleted = true;
              }
              reasoningCompleted = true;
            }
            if (resultStrings.content) {
              (
                latestMessage.content[0] as TextContentInterface
              ).text += resultStrings.content;
            }
            setChats(updatedChats);
          };

          // Use the SDK's async iterable stream
          for await (const chunk of stream) {
            if (!useStore.getState().generating) break;

            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            const contentText = delta.content ?? null;
            const reasoningContent = (delta as any).reasoning_content ?? null;

            const resultStrings = {
              content: '',
              reasoning: '',
              hasContent: false,
            };

            if (reasoningContent) {
              resultStrings.reasoning += reasoningContent;
              if (!reasoningStart) {
                reasoningStart = Date.now();
              }
            }
            if (contentText) {
              const parsed = processThinkChunk(contentText, thinkState);
              if (parsed.reasoning) {
                resultStrings.reasoning += parsed.reasoning;
                if (!reasoningStart) {
                  reasoningStart = Date.now();
                }
              }
              if (parsed.content) {
                resultStrings.content += parsed.content;
                resultStrings.hasContent = true;
              }
            }

            if (resultStrings.content || resultStrings.reasoning) {
              applyStreamResultStrings(resultStrings);
            }
          }

          const flushed = flushThinkState(thinkState);
          if (flushed.reasoning || flushed.content) {
            if (flushed.reasoning && !reasoningStart) {
              reasoningStart = Date.now();
            }
            applyStreamResultStrings({
              content: flushed.content,
              reasoning: flushed.reasoning,
              hasContent: Boolean(flushed.content),
            });
          }

          if (reasoningStart && !reasoningCompleted) {
            const updatedChats: ChatInterface[] = JSON.parse(
              JSON.stringify(useStore.getState().chats)
            );
            const updatedMessages = updatedChats[currentChatIndex].messages;
            const latestMessage = updatedMessages[updatedMessages.length - 1];
            const reasoningEntry = latestMessage.content.find(
              (content) => isReasoningContent(content)
            ) as ReasoningContentInterface | undefined;
            if (reasoningEntry) {
              const durationSeconds = Math.max(
                1,
                Math.ceil((Date.now() - reasoningStart) / 1000)
              );
              reasoningEntry.durationSeconds = durationSeconds;
              reasoningEntry.isCompleted = true;
              reasoningEntry.isCollapsed = true;
              setChats(updatedChats);
            }
          }
        }
      }

      // update tokens used in chatting
      const currChats = useStore.getState().chats;
      const countTotalTokens = useStore.getState().countTotalTokens;

      if (currChats && countTotalTokens) {
        const model = currChats[currentChatIndex].config.model;
        const messages = currChats[currentChatIndex].messages;
        updateTotalTokenUsed(
          model,
          messages.slice(0, -1),
          messages[messages.length - 1]
        );
      }

      // generate title for new chats
      if (
        useStore.getState().autoTitle &&
        currChats &&
        !currChats[currentChatIndex]?.titleSet
      ) {
        const messages_length = currChats[currentChatIndex].messages.length;
        const assistant_message =
          currChats[currentChatIndex].messages[messages_length - 1].content;
        const user_message =
          currChats[currentChatIndex].messages[messages_length - 2].content;

        const message: MessageInterface = {
          role: 'user',
          content: [
            ...stripReasoningFromContent(user_message),
            ...stripReasoningFromContent(assistant_message),
            {
              type: 'text',
              text: `Generate a title in less than 6 words for the conversation so far (language: ${i18n.language})`,
            } as TextContentInterface,
          ],
        };

        const updatedChats: ChatInterface[] = JSON.parse(
          JSON.stringify(useStore.getState().chats)
        );
        let title = (
          await generateTitle([message], updatedChats[currentChatIndex].config)
        ).trim();
        if (title.startsWith('"') && title.endsWith('"')) {
          title = title.slice(1, -1);
        }
        updatedChats[currentChatIndex].title = title;
        updatedChats[currentChatIndex].titleSet = true;
        setChats(updatedChats);

        // update tokens used for generating title
        if (countTotalTokens) {
          const model = _defaultChatConfig.model;
          updateTotalTokenUsed(model, [message], {
            role: 'assistant',
            content: [{ type: 'text', text: title } as TextContentInterface],
          });
        }
      }
    } catch (e: unknown) {
      const err = (e as Error);
      // Silently ignore abort errors — these are expected when the user stops generation
      if (err.name !== 'AbortError') {
        console.log(err.message);
        setError(err.message);
      }
    }
    activeAbortController = null;
    setGenerating(false);
  };

  return { handleSubmit, error };
};

export default useSubmit;
