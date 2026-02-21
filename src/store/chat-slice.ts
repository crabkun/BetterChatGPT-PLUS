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
  generatingChatIds: string[];
  error: string;
  folders: FolderCollection;
  setMessages: (messages: MessageInterface[]) => void;
  setChats: (chats: ChatInterface[]) => void;
  setCurrentChatIndex: (currentChatIndex: number) => void;
  addGeneratingChat: (chatId: string) => void;
  removeGeneratingChat: (chatId: string) => void;
  setError: (error: string) => void;
  setFolders: (folders: FolderCollection) => void;
}

export const createChatSlice: StoreSlice<ChatSlice> = (set, get) => {
  return {
    messages: [],
    currentChatIndex: -1,
    generatingChatIds: [],
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
    addGeneratingChat: (chatId: string) => {
      set((prev: ChatSlice) => ({
        ...prev,
        generatingChatIds: prev.generatingChatIds.includes(chatId)
          ? prev.generatingChatIds
          : [...prev.generatingChatIds, chatId],
      }));
    },
    removeGeneratingChat: (chatId: string) => {
      set((prev: ChatSlice) => ({
        ...prev,
        generatingChatIds: prev.generatingChatIds.filter((id) => id !== chatId),
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
