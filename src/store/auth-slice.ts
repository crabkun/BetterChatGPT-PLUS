import { defaultAPIEndpoint } from '@constants/auth';
import { StoreSlice } from './store';

export interface AuthSlice {
  apiKey?: string;
  apiEndpoint: string;
  apiVersion?: string;
  firstVisit: boolean;
  apiKeyConfigured: boolean;
  setApiKey: (apiKey: string) => void;
  setApiEndpoint: (apiEndpoint: string) => void;
  setApiVersion: (apiVersion: string) => void;
  setFirstVisit: (firstVisit: boolean) => void;
  setApiKeyConfigured: (apiKeyConfigured: boolean) => void;
}

export const createAuthSlice: StoreSlice<AuthSlice> = (set, get) => ({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || undefined,
  apiEndpoint: defaultAPIEndpoint,
  apiVersion: undefined,
  firstVisit: true,
  apiKeyConfigured: false,
  setApiKey: (apiKey: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiKey: apiKey,
      apiKeyConfigured: apiKey.length > 0 ? true : prev.apiKeyConfigured,
    }));
  },
  setApiEndpoint: (apiEndpoint: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiEndpoint: apiEndpoint,
    }));
  },
  setApiVersion: (apiVersion: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiVersion: apiVersion,
    }));
  },
  setFirstVisit: (firstVisit: boolean) => {
    set((prev: AuthSlice) => ({
      ...prev,
      firstVisit: firstVisit,
    }));
  },
  setApiKeyConfigured: (apiKeyConfigured: boolean) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiKeyConfigured: apiKeyConfigured,
    }));
  },
});
