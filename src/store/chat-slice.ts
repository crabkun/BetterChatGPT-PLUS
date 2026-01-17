import { StoreSlice } from './store';
import { ChatInterface, FolderCollection, MessageInterface } from '@type/chat';
import { toast } from 'react-toastify';
import {
  deleteChatMessages,
  persistChatMessagesNow,
} from './storage/IndexedDbStorage';

export interface ChatSlice {
  messages: MessageInterface[];
  chats?: ChatInterface[];
  currentChatIndex: number;
  generating: boolean;
  error: string;
  folders: FolderCollection;
  setMessages: (messages: MessageInterface[]) => void;
  setChats: (chats: ChatInterface[]) => void;
  setCurrentChatIndex: (currentChatIndex: number) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string) => void;
  setFolders: (folders: FolderCollection) => void;
}

export const createChatSlice: StoreSlice<ChatSlice> = (set, get) => {
  return {
    messages: [],
    currentChatIndex: -1,
    generating: false,
    error: '',
    folders: {},
    setMessages: (messages: MessageInterface[]) => {
      set((prev: ChatSlice) => ({
        ...prev,
        messages: messages,
      }));
    },
    setChats: (chats: ChatInterface[]) => {
      try {
        const previousChats = get().chats || [];
        const previousIds = new Set(previousChats.map((chat) => chat.id));
        const nextIds = new Set(chats.map((chat) => chat.id));
        const removedIds = Array.from(previousIds).filter(
          (id) => !nextIds.has(id)
        );

        set((prev: ChatSlice) => ({
          ...prev,
          chats: chats,
        }));
        if (removedIds.length > 0) {
          void deleteChatMessages(removedIds);
        }
        void persistChatMessagesNow(chats);
      } catch (e: unknown) {
        // Notify if storage quota exceeded
        toast((e as Error).message);
        throw e;
      }
    },
    setCurrentChatIndex: (currentChatIndex: number) => {
      set((prev: ChatSlice) => ({
        ...prev,
        currentChatIndex: currentChatIndex,
      }));
    },
    setGenerating: (generating: boolean) => {
      set((prev: ChatSlice) => ({
        ...prev,
        generating: generating,
      }));
    },
    setError: (error: string) => {
      set((prev: ChatSlice) => ({
        ...prev,
        error: error,
      }));
    },
    setFolders: (folders: FolderCollection) => {
      set((prev: ChatSlice) => ({
        ...prev,
        folders: folders,
      }));
    },
  };
};
