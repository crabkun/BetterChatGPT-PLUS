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
import { parseEventSource } from '@api/helper';
import { updateTotalTokenUsed } from '@utils/messageUtils';
import { _defaultChatConfig } from '@constants/chat';
import { modelStreamSupport } from '@constants/modelLoader';

const useSubmit = () => {
  const { t, i18n } = useTranslation('api');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const apiEndpoint = useStore((state) => state.apiEndpoint);
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
        useStore.getState().apiEndpoint,
        message,
        titleChatConfig,
        apiKey || undefined,
      );
    } catch (error: unknown) {
      throw new Error(
        `${t('errors.errorGeneratingTitle')}\n${(error as Error).message}`
      );
    }
    return data.choices[0].message.content;
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
      let stream;
      if (chats[currentChatIndex].messages.length === 0)
        throw new Error(t('errors.noMessagesSubmitted') as string);

      const messages = stripReasoningFromMessages(
        chats[currentChatIndex].messages
      );
      if (!isStreamSupported) {
        data = await getChatCompletion(
          useStore.getState().apiEndpoint,
          messages,
          chats[currentChatIndex].config,
          apiKey || undefined,
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
        const finalReasoning = parsed.reasoning + flushParsed.reasoning;
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
        stream = await getChatCompletionStream(
          useStore.getState().apiEndpoint,
          messages,
          chats[currentChatIndex].config,
          apiKey || undefined,
        );

        if (stream) {
          if (stream.locked)
            throw new Error(t('errors.streamLocked') as string);
          const reader = stream.getReader();
          let reading = true;
          let partial = '';
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
          while (reading && useStore.getState().generating) {
            const { done, value } = await reader.read();
            const result = parseEventSource(
              partial + new TextDecoder().decode(value)
            );
            partial = '';

            if (result === '[DONE]' || done) {
              reading = false;
            } else {
              const resultStrings = result.reduce(
                (
                  output: { content: string; reasoning: string; hasContent: boolean },
                  curr
                ) => {
                  if (typeof curr === 'string') {
                    partial += curr;
                  } else {
                    if (!curr.choices || !curr.choices[0] || !curr.choices[0].delta) {
                      // cover the case where we get some element which doesnt have text data, e.g. usage stats
                      return output;
                    }
                    const content = curr.choices[0]?.delta?.content ?? null;
                    const reasoningContent =
                      curr.choices[0]?.delta?.reasoning_content ?? null;
                    if (reasoningContent) {
                      output.reasoning += reasoningContent;
                      if (!reasoningStart) {
                        reasoningStart = Date.now();
                      }
                    }
                    if (content) {
                      const parsed = processThinkChunk(content, thinkState);
                      if (parsed.reasoning) {
                        output.reasoning += parsed.reasoning;
                        if (!reasoningStart) {
                          reasoningStart = Date.now();
                        }
                      }
                      if (parsed.content) {
                        output.content += parsed.content;
                        output.hasContent = true;
                      }
                    }
                  }
                  return output;
                },
                { content: '', reasoning: '', hasContent: false }
              );

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
          if (useStore.getState().generating) {
            reader.cancel(t('errors.cancelledByUser') as string);
          } else {
            reader.cancel(t('errors.generationCompleted') as string);
          }
          reader.releaseLock();
          stream.cancel();
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
      const err = (e as Error).message;
      console.log(err);
      setError(err);
    }
    setGenerating(false);
  };

  return { handleSubmit, error };
};

export default useSubmit;
