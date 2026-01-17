import React, {
  DetailedHTMLProps,
  HTMLAttributes,
  memo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import ReactMarkdown from 'react-markdown';
import { CodeProps, ReactMarkdownProps } from 'react-markdown/lib/ast-to-react';

import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import useStore from '@store/store';

import TickIcon from '@icon/TickIcon';
import CrossIcon from '@icon/CrossIcon';

import useSubmit from '@hooks/useSubmit';

import {
  ChatInterface,
  ContentInterface,
  ImageContentInterface,
  isImageContent,
  isReasoningContent,
  isTextContent,
  ReasoningContentInterface,
} from '@type/chat';

import { codeLanguageSubset } from '@constants/chat';

import RefreshButton from './Button/RefreshButton';
import UpButton from './Button/UpButton';
import DownButton from './Button/DownButton';
import CopyButton from './Button/CopyButton';
import EditButton from './Button/EditButton';
import DeleteButton from './Button/DeleteButton';
import MarkdownModeButton from './Button/MarkdownModeButton';

import CodeBlock from '../CodeBlock';
import PopupModal from '@components/PopupModal';
import { preprocessLaTeX } from '@utils/chat';

const ContentView = memo(
  ({
    role,
    content,
    setIsEdit,
    messageIndex,
  }: {
    role: string;
    content: ContentInterface[];
    setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
    messageIndex: number;
  }) => {
    const { handleSubmit } = useSubmit();
    const { t } = useTranslation('main');

    const [isDelete, setIsDelete] = useState<boolean>(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const currentChatIndex = useStore((state) => state.currentChatIndex);
    const setChats = useStore((state) => state.setChats);
    const lastMessageIndex = useStore((state) =>
      state.chats ? state.chats[state.currentChatIndex].messages.length - 1 : 0
    );
    const inlineLatex = useStore((state) => state.inlineLatex);
    const markdownMode = useStore((state) => state.markdownMode);
    const reasoningContent = content.find(isReasoningContent) as
      | ReasoningContentInterface
      | undefined;
    const reasoningText = reasoningContent?.text ?? '';
    const reasoningSeconds = reasoningContent?.durationSeconds ?? 0;
    const reasoningIsCompleted =
      reasoningContent?.isCompleted ?? reasoningContent?.durationSeconds !== undefined;
    const reasoningTitle = reasoningIsCompleted
      ? (t('reasoning.completed', {
          seconds: reasoningSeconds,
        }) as string)
      : (t('reasoning.inProgress', {
          seconds: reasoningSeconds,
        }) as string);

    const handleDelete = () => {
      const updatedChats: ChatInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedChats[currentChatIndex].messages.splice(messageIndex, 1);
      setChats(updatedChats);
    };

    const handleMove = (direction: 'up' | 'down') => {
      const updatedChats: ChatInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      const updatedMessages = updatedChats[currentChatIndex].messages;
      const temp = updatedMessages[messageIndex];
      if (direction === 'up') {
        updatedMessages[messageIndex] = updatedMessages[messageIndex - 1];
        updatedMessages[messageIndex - 1] = temp;
      } else {
        updatedMessages[messageIndex] = updatedMessages[messageIndex + 1];
        updatedMessages[messageIndex + 1] = temp;
      }
      setChats(updatedChats);
    };

    const handleMoveUp = () => {
      handleMove('up');
    };

    const handleMoveDown = () => {
      handleMove('down');
    };

    const handleRefresh = () => {
      const updatedChats: ChatInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      const updatedMessages = updatedChats[currentChatIndex].messages;
      updatedMessages.splice(updatedMessages.length - 1, 1);
      setChats(updatedChats);
      handleSubmit();
    };
    const handleReasoningToggle = (
      event: React.SyntheticEvent<HTMLDetailsElement>
    ) => {
      const isOpen = (event.currentTarget as HTMLDetailsElement).open;
      const updatedChats: ChatInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      const updatedMessage =
        updatedChats[currentChatIndex].messages[messageIndex];
      const reasoningEntry = updatedMessage.content.find(isReasoningContent) as
        | ReasoningContentInterface
        | undefined;
      if (reasoningEntry) {
        reasoningEntry.isCollapsed = !isOpen;
        setChats(updatedChats);
      }
    };
    const textEntry = content.find(isTextContent);
    const currentTextContent = textEntry ? textEntry.text : '';
    const handleCopy = () => {
      navigator.clipboard.writeText(currentTextContent);
    };

    const handleImageClick = (imageUrl: string) => {
      setZoomedImage(imageUrl);
    };

    const handleCloseZoom = () => {
      setZoomedImage(null);
    };
    const validImageContents = Array.isArray(content)
    ? (content.slice(1).filter(isImageContent) as ImageContentInterface[])
    : [];
    return (
      <>
        {reasoningText && (
          <details
            className='mb-3 rounded-md border border-black/10 bg-gray-100/80 dark:bg-gray-700/70 dark:border-gray-600'
            open={!reasoningContent?.isCollapsed}
            onToggle={handleReasoningToggle}
          >
            <summary className='cursor-pointer select-none px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200'>
              {reasoningTitle}
            </summary>
            <div className='px-3 pb-3 text-xs text-gray-700 dark:text-gray-200'>
              {markdownMode ? (
                <div className='markdown prose prose-sm w-full max-w-full break-words dark:prose-invert'>
                  <ReactMarkdown
                    remarkPlugins={[
                      remarkGfm,
                      [remarkMath, { singleDollarTextMath: inlineLatex }],
                    ]}
                    rehypePlugins={[
                      rehypeKatex,
                      [
                        rehypeHighlight,
                        {
                          detect: true,
                          ignoreMissing: true,
                          subset: codeLanguageSubset,
                        },
                      ],
                    ]}
                    linkTarget='_new'
                    components={{
                      code,
                      p,
                    }}
                  >
                    {inlineLatex
                      ? preprocessLaTeX(reasoningText)
                      : reasoningText}
                  </ReactMarkdown>
                </div>
              ) : (
                <span className='whitespace-pre-wrap'>{reasoningText}</span>
              )}
            </div>
          </details>
        )}
        <div className='markdown prose w-full md:max-w-full break-words dark:prose-invert dark share-gpt-message'>
          {markdownMode ? (
            <ReactMarkdown
              remarkPlugins={[
                remarkGfm,
                [remarkMath, { singleDollarTextMath: inlineLatex }],
              ]}
              rehypePlugins={[
                rehypeKatex,
                [
                  rehypeHighlight,
                  {
                    detect: true,
                    ignoreMissing: true,
                    subset: codeLanguageSubset,
                  },
                ],
              ]}
              linkTarget='_new'
              components={{
                code,
                p,
              }}
            >
              {inlineLatex
                ? preprocessLaTeX(currentTextContent)
                : currentTextContent}
            </ReactMarkdown>
          ) : (
            <span className='whitespace-pre-wrap'>{currentTextContent}</span>
          )}
        </div>
        {validImageContents.length > 0 && (
          <div className='flex gap-4'>
            {validImageContents.map((image, index) => (
              <div key={index} className='image-container'>
                <img
                  src={image.image_url.url}
                  alt={`uploaded-${index}`}
                  className='h-20 cursor-pointer'
                  onClick={() => handleImageClick(image.image_url.url)}
                />
              </div>
            ))}
          </div>
        )}
        {zoomedImage && (
          <PopupModal
            title=''
            setIsModalOpen={handleCloseZoom}
            handleConfirm={handleCloseZoom}
            cancelButton={false}
          >
            <div className='flex justify-center'>
              <img
                src={zoomedImage}
                alt='Zoomed'
                className='max-w-full max-h-full'
              />
            </div>
          </PopupModal>
        )}
        <div className='flex justify-end gap-2 w-full mt-2'>
          {isDelete || (
            <>
              {!useStore.getState().generating &&
                role === 'assistant' &&
                messageIndex === lastMessageIndex && (
                  <RefreshButton onClick={handleRefresh} />
                )}
              {messageIndex !== 0 && <UpButton onClick={handleMoveUp} />}
              {messageIndex !== lastMessageIndex && (
                <DownButton onClick={handleMoveDown} />
              )}

              <MarkdownModeButton />
              <CopyButton onClick={handleCopy} />
              <EditButton setIsEdit={setIsEdit} />
              <DeleteButton setIsDelete={setIsDelete} />
            </>
          )}
          {isDelete && (
            <>
              <button
                className='p-1 hover:text-white'
                aria-label='cancel'
                onClick={() => setIsDelete(false)}
              >
                <CrossIcon />
              </button>
              <button
                className='p-1 hover:text-white'
                aria-label='confirm'
                onClick={handleDelete}
              >
                <TickIcon />
              </button>
            </>
          )}
        </div>
      </>
    );
  }
);

const code = memo((props: CodeProps) => {
  const { inline, className, children } = props;
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];

  if (inline) {
    return <code className={className}>{children}</code>;
  } else {
    return <CodeBlock lang={lang || 'text'} codeChildren={children} />;
  }
});

const p = memo(
  (
    props?: Omit<
      DetailedHTMLProps<
        HTMLAttributes<HTMLParagraphElement>,
        HTMLParagraphElement
      >,
      'ref'
    > &
      ReactMarkdownProps
  ) => {
    return <p className='whitespace-pre-wrap'>{props?.children}</p>;
  }
);

export default ContentView;

