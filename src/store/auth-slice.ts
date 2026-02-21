import { defaultAPIBaseUrl } from '@constants/auth';
import { StoreSlice } from './store';

export interface AuthSlice {
  apiKey?: string;
  apiBaseUrl: string;
  firstVisit: boolean;
  apiKeyConfigured: boolean;
  setApiKey: (apiKey: string) => void;
  setApiBaseUrl: (apiBaseUrl: string) => void;
  setFirstVisit: (firstVisit: boolean) => void;
  setApiKeyConfigured: (apiKeyConfigured: boolean) => void;
}

export const createAuthSlice: StoreSlice<AuthSlice> = (set, get) => ({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || undefined,
  apiBaseUrl: defaultAPIBaseUrl,
  firstVisit: true,
  apiKeyConfigured: false,
  setApiKey: (apiKey: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiKey: apiKey,
      apiKeyConfigured: apiKey.length > 0 ? true : prev.apiKeyConfigured,
    }));
  },
  setApiBaseUrl: (apiBaseUrl: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiBaseUrl: apiBaseUrl,
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
