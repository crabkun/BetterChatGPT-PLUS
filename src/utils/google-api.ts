import { listDriveFiles } from '@api/google-api';

import useStore, { createPartializedState } from '@store/store';
import { hydrateChatsWithMessages } from '@store/storage/IndexedDbStorage';
import useCloudAuthStore from '@store/cloud-auth-store';

export const getFiles = async (googleAccessToken: string) => {
  try {
    const driveFiles = await listDriveFiles(googleAccessToken);
    return driveFiles.files;
  } catch (e: unknown) {
    useCloudAuthStore.getState().setSyncStatus('unauthenticated');
    useStore.getState().setToastMessage((e as Error).message);
    useStore.getState().setToastShow(true);
    useStore.getState().setToastStatus('error');
    return;
  }
};

export const getFileID = async (
  googleAccessToken: string
): Promise<string | null> => {
  const driveFiles = await listDriveFiles(googleAccessToken);
  if (driveFiles.files.length === 0) return null;
  return driveFiles.files[0].id;
};

export const stateToFile = async () => {
  const baseState = createPartializedState(useStore.getState(), {
    includeMessages: true,
  });
  const hydratedChats = baseState.chats
    ? await hydrateChatsWithMessages(baseState.chats)
    : baseState.chats;
  const partializedState = {
    ...baseState,
    chats: hydratedChats,
  };

  const blob = new Blob([JSON.stringify(partializedState)], {
    type: 'application/json',
  });
  const file = new File([blob], 'better-chatgpt.json', {
    type: 'application/json',
  });

  return file;
};
