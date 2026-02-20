import { StoreApi, create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSlice, createChatSlice } from './chat-slice';
import { InputSlice, createInputSlice } from './input-slice';
import { AuthSlice, createAuthSlice } from './auth-slice';
import { ConfigSlice, createConfigSlice } from './config-slice';
import { PromptSlice, createPromptSlice } from './prompt-slice';
import { ToastSlice, createToastSlice } from './toast-slice';
import { CustomModelsSlice, createCustomModelsSlice } from './custom-models-slice';
import { applyMigrations, LATEST_PERSIST_VERSION } from './migrate';
import {
  indexedDbPersistStorage,
  persistChatMessagesNow,
  writePersistedState,
  syncChatsWithMessages,
} from './storage/IndexedDbStorage';

export type StoreState = ChatSlice &
  InputSlice &
  AuthSlice &
  ConfigSlice &
  PromptSlice &
  ToastSlice &
  CustomModelsSlice;

export type StoreSlice<T> = (
  set: StoreApi<StoreState>['setState'],
  get: StoreApi<StoreState>['getState']
) => T;

export const stripChatMessages = (chats?: ChatSlice['chats']) =>
  chats
    ? chats.map(({ messages, ...rest }) => ({
      ...rest,
      messages: [],
    }))
    : chats;

export const createPartializedState = (
  state: StoreState,
  options?: { includeMessages?: boolean }
) => ({
  chats: options?.includeMessages ? state.chats : stripChatMessages(state.chats),
  currentChatIndex: state.currentChatIndex,
  apiKey: state.apiKey,
  apiKeyConfigured: state.apiKeyConfigured,
  apiEndpoint: state.apiEndpoint,
  theme: state.theme,
  autoTitle: state.autoTitle,
  advancedMode: state.advancedMode,
  prompts: state.prompts,
  defaultChatConfig: state.defaultChatConfig,
  defaultSystemMessage: state.defaultSystemMessage,
  hideMenuOptions: state.hideMenuOptions,
  firstVisit: state.firstVisit,
  hideSideMenu: state.hideSideMenu,
  folders: state.folders,
  enterToSubmit: state.enterToSubmit,
  inlineLatex: state.inlineLatex,
  markdownMode: state.markdownMode,
  totalTokenUsed: state.totalTokenUsed,
  countTotalTokens: state.countTotalTokens,
  displayChatSize: state.displayChatSize,
  menuWidth: state.menuWidth,
  defaultImageDetail: state.defaultImageDetail,
  autoScroll: state.autoScroll,
  shareGPTEnabled: state.shareGPTEnabled,
  customModels: state.customModels,
});

export const persistStoreSnapshot = async () => {
  const state = useStore.getState();
  const options = useStore.persist.getOptions();
  const storageKey = options.name ?? 'free-chat-gpt';
  const payload = {
    state: createPartializedState(state),
    version: options.version ?? 0,
  };
  await writePersistedState(storageKey, payload);
  if (state.chats) {
    await persistChatMessagesNow(state.chats);
  }
};

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createChatSlice(set, get),
      ...createInputSlice(set, get),
      ...createAuthSlice(set, get),
      ...createConfigSlice(set, get),
      ...createPromptSlice(set, get),
      ...createToastSlice(set, get),
      ...createCustomModelsSlice(set, get),
    }),
    {
      name: 'free-chat-gpt',
      partialize: (state) => createPartializedState(state),
      storage: indexedDbPersistStorage,
      version: LATEST_PERSIST_VERSION,
      migrate: (persistedState, version) =>
        applyMigrations(persistedState, version) as StoreState,
      onRehydrateStorage: () => async (state, error) => {
        if (error || !state?.chats) {
          return;
        }
        try {
          const hydratedChats = await syncChatsWithMessages(state.chats);
          state.setChats(hydratedChats);
        } catch (e) {
          console.error('Failed to hydrate chats from IndexedDB.', e);
        }
      },
    }
  )
);

export default useStore;
