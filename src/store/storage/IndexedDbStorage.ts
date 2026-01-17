import { createStore, del, get, set } from 'idb-keyval';
import { StateStorage, StorageValue } from 'zustand/middleware';
import { ChatInterface, MessageInterface } from '@type/chat';

const DB_NAME = 'better-chatgpt-plus';
const PERSIST_STORE = 'persist';
const MESSAGES_STORE = 'messages';
const MESSAGE_KEY_PREFIX = 'chat-messages:';
const WRITE_DEBOUNCE_MS = 300;

const persistStore = createStore(DB_NAME, PERSIST_STORE);
const messagesStore = createStore(DB_NAME, MESSAGES_STORE);

let hasEnsuredIndexedDb = false;
let hasShownIndexedDbAlert = false;
let ensureStoresPromise: Promise<void> | null = null;
const hydratedStores = new Set<string>();

const getMessageKey = (chatId: string) => `${MESSAGE_KEY_PREFIX}${chatId}`;

const showIndexedDbAlert = () => {
  if (hasShownIndexedDbAlert || typeof window === 'undefined') return;
  hasShownIndexedDbAlert = true;
  window.alert('IndexedDB is not available. Please enable it to use this app.');
};

export const ensureIndexedDbAvailable = async () => {
  if (hasEnsuredIndexedDb) return;
  if (typeof indexedDB === 'undefined') {
    showIndexedDbAlert();
    throw new Error('IndexedDB is not available in this environment.');
  }

  try {
    await ensureStores();
    await set('__idb_test__', '1', persistStore);
    await del('__idb_test__', persistStore);
    hasEnsuredIndexedDb = true;
  } catch (error) {
    showIndexedDbAlert();
    throw new Error('IndexedDB is not available or is blocked.');
  }
};

const openDb = (version?: number) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PERSIST_STORE)) {
        db.createObjectStore(PERSIST_STORE);
      }
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const ensureStores = async () => {
  if (ensureStoresPromise) return ensureStoresPromise;
  ensureStoresPromise = (async () => {
    const db = await openDb();
    const hasPersist = db.objectStoreNames.contains(PERSIST_STORE);
    const hasMessages = db.objectStoreNames.contains(MESSAGES_STORE);
    const needsUpgrade = !hasPersist || !hasMessages;
    const nextVersion = db.version + 1;
    db.close();
    if (needsUpgrade) {
      const upgradedDb = await openDb(nextVersion);
      upgradedDb.close();
    }
  })();

  try {
    await ensureStoresPromise;
  } finally {
    ensureStoresPromise = null;
  }
};

export const indexedDbStateStorage: StateStorage = {
  getItem: async (name) => {
    await ensureIndexedDbAvailable();
    await migrateLocalStorageToIndexedDbIfNeeded();
    const value = await get<string | null>(name, persistStore);
    hydratedStores.add(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await ensureIndexedDbAvailable();
    if (!hydratedStores.has(name)) {
      const existing = await get<string | null>(name, persistStore);
      if (existing) return;
    }
    await set(name, value, persistStore);
  },
  removeItem: async (name) => {
    await ensureIndexedDbAvailable();
    await del(name, persistStore);
  },
};

const pendingMessageWrites = new Map<string, MessageInterface[]>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const scheduleMessageWrite = (chatId: string, messages: MessageInterface[]) => {
  pendingMessageWrites.set(chatId, messages);

  const existingTimer = pendingTimers.get(chatId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    const pending = pendingMessageWrites.get(chatId);
    pendingMessageWrites.delete(chatId);
    pendingTimers.delete(chatId);
    if (!pending) return;
    try {
      await ensureIndexedDbAvailable();
      await set(getMessageKey(chatId), pending, messagesStore);
    } catch (error) {
      console.error('Failed to persist chat messages.', error);
    }
  }, WRITE_DEBOUNCE_MS);

  pendingTimers.set(chatId, timer);
};

export const queuePersistChatMessages = (chats: ChatInterface[]) => {
  void ensureIndexedDbAvailable();
  chats.forEach((chat) => {
    scheduleMessageWrite(chat.id, chat.messages || []);
  });
};

export const persistChatMessagesNow = async (chats: ChatInterface[]) => {
  await ensureIndexedDbAvailable();
  await Promise.all(
    chats.map((chat) =>
      set(getMessageKey(chat.id), chat.messages || [], messagesStore)
    )
  );
};

export const deleteChatMessages = async (chatIds: string[]) => {
  await ensureIndexedDbAvailable();
  await Promise.all(chatIds.map((id) => del(getMessageKey(id), messagesStore)));
};

export const hydrateChatsWithMessages = async (chats: ChatInterface[]) => {
  await ensureIndexedDbAvailable();
  const messagesList = await Promise.all(
    chats.map((chat) => get<MessageInterface[]>(getMessageKey(chat.id), messagesStore))
  );

  return chats.map((chat, index) => ({
    ...chat,
    messages: messagesList[index] ?? chat.messages ?? [],
  }));
};

export const syncChatsWithMessages = async (chats: ChatInterface[]) => {
  await ensureIndexedDbAvailable();
  const messagesList = await Promise.all(
    chats.map((chat) => get<MessageInterface[]>(getMessageKey(chat.id), messagesStore))
  );

  const missingChats: ChatInterface[] = [];
  const hydratedChats = chats.map((chat, index) => {
    const storedMessages = messagesList[index];
    if (!storedMessages && chat.messages && chat.messages.length > 0) {
      missingChats.push(chat);
    }
    return {
      ...chat,
      messages: storedMessages ?? chat.messages ?? [],
    };
  });

  if (missingChats.length > 0) {
    await persistChatMessagesNow(missingChats);
  }

  return hydratedChats;
};

let hasMigratedLocalStorage = false;

export const migrateLocalStorageToIndexedDbIfNeeded = async () => {
  if (hasMigratedLocalStorage) return;
  hasMigratedLocalStorage = true;
  if (typeof localStorage === 'undefined') return;

  const storageKey = 'free-chat-gpt';
  const existing = await get(storageKey, persistStore);

  if (!existing) {
    const localValue = localStorage.getItem(storageKey);
    if (localValue) {
      await set(storageKey, localValue, persistStore);
      try {
        const parsed = JSON.parse(localValue) as StorageValue<{
          chats?: ChatInterface[];
        }>;
        if (parsed?.state?.chats) {
          await persistChatMessagesNow(parsed.state.chats);
        }
      } catch (error) {
        console.warn('Failed to parse localStorage state for migration.', error);
      }
      localStorage.removeItem(storageKey);
    }
  }

  const cloudKey = 'cloud';
  const existingCloud = await get(cloudKey, persistStore);
  if (!existingCloud) {
    const cloudValue = localStorage.getItem(cloudKey);
    if (cloudValue) {
      await set(cloudKey, cloudValue, persistStore);
      localStorage.removeItem(cloudKey);
    }
  }
};

export const readPersistedState = async <S>(storageKey: string) => {
  await ensureIndexedDbAvailable();
  const raw = await get<string | null>(storageKey, persistStore);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StorageValue<S>;
  } catch (error) {
    return null;
  }
};

export const writePersistedState = async <S>(
  storageKey: string,
  value: StorageValue<S>
) => {
  await ensureIndexedDbAvailable();
  await set(storageKey, JSON.stringify(value), persistStore);
};
