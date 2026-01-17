import { StoreApi, create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CloudAuthSlice, createCloudAuthSlice } from './cloud-auth-slice';
import { indexedDbStateStorage } from './storage/IndexedDbStorage';

export type StoreState = CloudAuthSlice;

export type StoreSlice<T> = (
  set: StoreApi<StoreState>['setState'],
  get: StoreApi<StoreState>['getState']
) => T;

const useCloudAuthStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createCloudAuthSlice(set, get),
    }),
    {
      name: 'cloud',
      partialize: (state) => ({
        cloudSync: state.cloudSync,
        fileId: state.fileId,
      }),
      storage: createJSONStorage(() => indexedDbStateStorage),
      version: 1,
    }
  )
);

export default useCloudAuthStore;
