import { createStore, del, get, set } from 'idb-keyval';
import { PersistStorage, StorageValue } from 'zustand/middleware';
import { ChatInterface, MessageInterface } from '@type/chat';
import { applyMigrations, ensureChatIds, LATEST_PERSIST_VERSION } from '../migrate';

const DB_NAME = 'better-chatgpt-plus';
const PERSIST_STORE = 'persist';
const MESSAGES_STORE = 'messages';
const MESSAGE_KEY_PREFIX = 'chat-messages:';
const WRITE_DEBOUNCE_MS = 300;
const META_SUFFIX = '__meta';

const persistStore = createStore(DB_NAME, PERSIST_STORE);
const messagesStore = createStore(DB_NAME, MESSAGES_STORE);

let hasEnsuredIndexedDb = false;
let hasShownIndexedDbAlert = false;
let ensureStoresPromise: Promise<void> | null = null;
const getMessageKey = (chatId: string) => `${MESSAGE_KEY_PREFIX}${chatId}`;
const getMetaKey = (name: string) => `${name}:${META_SUFFIX}`;
const getPersistKey = (name: string, key: string) => `${name}:${key}`;

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

type PersistMeta = {
  version: number;
  keys: string[];
};

export const indexedDbPersistStorage: PersistStorage<any> = {
  getItem: async (name) => {
    await ensureIndexedDbAvailable();
    await migrateLocalStorageToIndexedDbIfNeeded();
    const meta = await get<PersistMeta | undefined>(
      getMetaKey(name),
      persistStore
    );
    if (!meta) return null;
    const values = await Promise.all(
      meta.keys.map((key) => get(getPersistKey(name, key), persistStore))
    );
    const state = meta.keys.reduce<Record<string, unknown>>((acc, key, index) => {
      acc[key] = values[index];
      return acc;
    }, {});
    return { state, version: meta.version };
  },
  setItem: async (name, value) => {
    await ensureIndexedDbAvailable();
    const metaKey = getMetaKey(name);
    const nextKeys = Object.keys(value.state ?? {});
    const previousMeta = await get<PersistMeta | undefined>(metaKey, persistStore);
    const previousKeys = previousMeta?.keys ?? [];
    const removedKeys = previousKeys.filter((key) => !nextKeys.includes(key));
    await Promise.all(
      removedKeys.map((key) => del(getPersistKey(name, key), persistStore))
    );
    await Promise.all(
      nextKeys.map((key) => set(getPersistKey(name, key), value.state[key], persistStore))
    );
    await set(metaKey, { version: value.version, keys: nextKeys }, persistStore);
  },
  removeItem: async (name) => {
    await ensureIndexedDbAvailable();
    const metaKey = getMetaKey(name);
    const meta = await get<PersistMeta | undefined>(metaKey, persistStore);
    if (meta?.keys?.length) {
      await Promise.all(
        meta.keys.map((key) => del(getPersistKey(name, key), persistStore))
      );
    }
    await del(metaKey, persistStore);
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
  const existing = await get<PersistMeta | undefined>(
    getMetaKey(storageKey),
    persistStore
  );

  if (!existing) {
    const localValue = localStorage.getItem(storageKey);
    if (localValue) {
      try {
        const parsed = JSON.parse(localValue) as StorageValue<{
          chats?: ChatInterface[];
        }>;
        const parsedVersion =
          typeof parsed.version === 'number' ? parsed.version : 0;
        const migratedState = applyMigrations(parsed.state, parsedVersion) as {
          chats?: ChatInterface[];
        };
        const normalizedChats = ensureChatIds(migratedState?.chats);
        const normalizedState =
          normalizedChats === migratedState?.chats
            ? migratedState
            : { ...migratedState, chats: normalizedChats };
        const migrated = {
          ...parsed,
          state: normalizedState,
          version: LATEST_PERSIST_VERSION,
        };
        await writePersistedState(storageKey, migrated);
        if (normalizedChats) {
          await persistChatMessagesNow(normalizedChats);
        }
      } catch (error) {
        console.warn('Failed to parse localStorage state for migration.', error);
      }
    }
  }

  const cloudKey = 'cloud';
  const existingCloud = await get<PersistMeta | undefined>(
    getMetaKey(cloudKey),
    persistStore
  );
  if (!existingCloud) {
    const cloudValue = localStorage.getItem(cloudKey);
    if (cloudValue) {
      try {
        const parsed = JSON.parse(cloudValue) as StorageValue<Record<string, unknown>>;
        await writePersistedState(cloudKey, parsed);
      } catch (error) {
        console.warn('Failed to parse cloud localStorage state for migration.', error);
      }
    }
  }
};

export const readPersistedState = async <S>(storageKey: string) => {
  await ensureIndexedDbAvailable();
  return indexedDbPersistStorage.getItem(storageKey) as Promise<StorageValue<S> | null>;
};

export const writePersistedState = async <S>(
  storageKey: string,
  value: StorageValue<S>
) => {
  await ensureIndexedDbAvailable();
  await indexedDbPersistStorage.setItem(storageKey, value);
};
