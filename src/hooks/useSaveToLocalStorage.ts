import React, { useEffect, useRef } from 'react';
import useStore from '@store/store';
import { queuePersistChatMessages } from '@store/storage/IndexedDbStorage';

const useSaveToLocalStorage = () => {
  const chatsRef = useRef(useStore.getState().chats);

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      if (chatsRef && chatsRef.current !== state.chats) {
        chatsRef.current = state.chats;
        if (state.chats) {
          queuePersistChatMessages(state.chats);
        }
      }
    });

    return unsubscribe;
  }, []);
};

export default useSaveToLocalStorage;
