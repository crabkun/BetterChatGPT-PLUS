import { v4 as uuidv4 } from 'uuid';

import {
  Folder,
  FolderCollection,
  ChatInterface,
  LocalStorageInterfaceV0ToV1,
  LocalStorageInterfaceV1ToV2,
  LocalStorageInterfaceV2ToV3,
  LocalStorageInterfaceV3ToV4,
  LocalStorageInterfaceV4ToV5,
  LocalStorageInterfaceV5ToV6,
  LocalStorageInterfaceV6ToV7,
  LocalStorageInterfaceV7oV8,
  LocalStorageInterfaceV8_1ToV8_2,
  LocalStorageInterfaceV8oV8_1,
  TextContentInterface,
  LocalStorageInterfaceV8_2ToV9,
} from '@type/chat';
import {
  _defaultChatConfig,
  _defaultMenuWidth,
  _defaultDisplayChatSize,
  defaultApiVersion,
  defaultModel,
  _defaultImageDetail,
} from '@constants/chat';
import defaultPrompts from '@constants/prompt';

export const LATEST_PERSIST_VERSION = 11;

export const ensureChatIds = (chats?: ChatInterface[]) => {
  if (!chats?.length) return chats;
  const seen = new Set<string>();
  return chats.map((chat) => {
    const nextId = chat.id && !seen.has(chat.id) ? chat.id : uuidv4();
    seen.add(nextId);
    if (nextId === chat.id) return chat;
    return { ...chat, id: nextId };
  });
};

export const migrateV0 = (persistedState: LocalStorageInterfaceV0ToV1) => {
  persistedState.chats.forEach((chat) => {
    chat.titleSet = false;
    if (!chat.config) chat.config = { ..._defaultChatConfig };
  });
};

export const migrateV1 = (persistedState: LocalStorageInterfaceV1ToV2) => {
  if (persistedState.apiFree) {
    persistedState.apiEndpoint = persistedState.apiFreeEndpoint;
  } else {
    persistedState.apiEndpoint = '';
  }
};

export const migrateV2 = (persistedState: LocalStorageInterfaceV2ToV3) => {
  persistedState.chats.forEach((chat) => {
    chat.config = {
      ...chat.config,
      top_p: _defaultChatConfig.top_p,
      frequency_penalty: _defaultChatConfig.frequency_penalty,
    };
  });
  persistedState.autoTitle = false;
};

export const migrateV3 = (persistedState: LocalStorageInterfaceV3ToV4) => {
  persistedState.prompts = defaultPrompts;
};

export const migrateV4 = (persistedState: LocalStorageInterfaceV4ToV5) => {
  persistedState.chats.forEach((chat) => {
    chat.config = {
      ...chat.config,
      model: defaultModel,
    };
  });
};

export const migrateV5 = (persistedState: LocalStorageInterfaceV5ToV6) => {
  persistedState.chats.forEach((chat) => {
    chat.config = {
      ...chat.config,
    };
  });
};

export const migrateV6 = (persistedState: LocalStorageInterfaceV6ToV7) => {
  if (
    persistedState.apiEndpoint ===
    'https://sharegpt.churchless.tech/share/v1/chat'
  ) {
    persistedState.apiEndpoint = 'https://chatgpt-api.shn.hk/v1/';
  }
  if (!persistedState.apiKey || persistedState.apiKey.length === 0)
    persistedState.apiKey = '';
};

export const migrateV7 = (persistedState: LocalStorageInterfaceV7oV8) => {
  let folders: FolderCollection = {};
  const folderNameToIdMap: Record<string, string> = {};

  // convert foldersExpanded and foldersName to folders
  persistedState.foldersName.forEach((name, index) => {
    const id = uuidv4();
    const folder: Folder = {
      id,
      name,
      expanded: persistedState.foldersExpanded[index],
      order: index,
    };

    folders = { [id]: folder, ...folders };
    folderNameToIdMap[name] = id;
  });
  persistedState.folders = folders;

  // change the chat.folder from name to id
  persistedState.chats.forEach((chat) => {
    if (chat.folder) chat.folder = folderNameToIdMap[chat.folder];
    chat.id = uuidv4();
  });
};

export const migrateV8_1 = (persistedState: LocalStorageInterfaceV8oV8_1) => {
  persistedState.chats.forEach((chat) => {
    persistedState.apiVersion = defaultApiVersion;
    chat.messages.forEach((msg) => {
      if (typeof msg.content === 'string') {
        const content: TextContentInterface[] = [
          { type: 'text', text: msg.content },
        ];
        msg.content = content;
      }
    });
  });
};

export const migrateV8_1_fix = (persistedState: LocalStorageInterfaceV8_1ToV8_2) => {
  persistedState.menuWidth = _defaultMenuWidth;
  persistedState.displayChatSize = _defaultDisplayChatSize;
};

export const migrateV8_2 = (persistedState: LocalStorageInterfaceV8_2ToV9) => {
  persistedState.chats.forEach((chat) => {
    if (chat.imageDetail == undefined) chat.imageDetail = _defaultImageDetail
  });
};

export const migrateV9 = (persistedState: any) => {
  if ('apiEndpoint' in persistedState) {
    persistedState.apiBaseUrl = persistedState.apiEndpoint;
    delete persistedState.apiEndpoint;
  }
};

export const migrateV10 = (persistedState: any) => {
  if (!persistedState.apiProvider) {
    persistedState.apiProvider = 'openai';
  }
  if (persistedState.geminiApiKey === undefined) {
    persistedState.geminiApiKey = '';
  }
  if (persistedState.geminiVertexProjectId === undefined) {
    persistedState.geminiVertexProjectId = '';
  }
  if (persistedState.geminiVertexLocation === undefined) {
    persistedState.geminiVertexLocation = 'us-central1';
  }
  // Backfill thinking_level on all existing chat configs
  if (persistedState.chats) {
    for (const chat of persistedState.chats) {
      if (chat.config && !chat.config.thinking_level) {
        chat.config.thinking_level = 'high';
      }
    }
  }
  if (persistedState.defaultChatConfig && !persistedState.defaultChatConfig.thinking_level) {
    persistedState.defaultChatConfig.thinking_level = 'high';
  }
};

export const applyMigrations = (persistedState: unknown, version: number) => {
  switch (version) {
    case 0:
      migrateV0(persistedState as LocalStorageInterfaceV0ToV1);
    case 1:
      migrateV1(persistedState as LocalStorageInterfaceV1ToV2);
    case 2:
      migrateV2(persistedState as LocalStorageInterfaceV2ToV3);
    case 3:
      migrateV3(persistedState as LocalStorageInterfaceV3ToV4);
    case 4:
      migrateV4(persistedState as LocalStorageInterfaceV4ToV5);
    case 5:
      migrateV5(persistedState as LocalStorageInterfaceV5ToV6);
    case 6:
      migrateV6(persistedState as LocalStorageInterfaceV6ToV7);
    case 7:
      migrateV7(persistedState as LocalStorageInterfaceV7oV8);
    case 8:
      migrateV8_1(persistedState as LocalStorageInterfaceV8oV8_1);
    case 8.1:
      migrateV8_1_fix(persistedState as LocalStorageInterfaceV8_1ToV8_2);
    case 8.2:
      migrateV8_2(persistedState as LocalStorageInterfaceV8_2ToV9);
    case 9:
      migrateV9(persistedState);
    case 10:
      migrateV10(persistedState);
      break;
  }
  return persistedState;
};
