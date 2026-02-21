import { defaultAPIBaseUrl } from '@constants/auth';
import { ApiProvider } from '@type/provider';
import { StoreSlice } from './store';

export interface AuthSlice {
  apiKey?: string;
  apiBaseUrl: string;
  apiProvider: ApiProvider;
  geminiApiKey: string;
  geminiVertexProjectId: string;
  geminiVertexLocation: string;
  firstVisit: boolean;
  apiKeyConfigured: boolean;
  setApiKey: (apiKey: string) => void;
  setApiBaseUrl: (apiBaseUrl: string) => void;
  setApiProvider: (apiProvider: ApiProvider) => void;
  setGeminiApiKey: (geminiApiKey: string) => void;
  setGeminiVertexProjectId: (projectId: string) => void;
  setGeminiVertexLocation: (location: string) => void;
  setFirstVisit: (firstVisit: boolean) => void;
  setApiKeyConfigured: (apiKeyConfigured: boolean) => void;
}

export const createAuthSlice: StoreSlice<AuthSlice> = (set, get) => ({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || undefined,
  apiBaseUrl: defaultAPIBaseUrl,
  apiProvider: 'openai',
  geminiApiKey: '',
  geminiVertexProjectId: '',
  geminiVertexLocation: 'us-central1',
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
  setApiProvider: (apiProvider: ApiProvider) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiProvider: apiProvider,
    }));
  },
  setGeminiApiKey: (geminiApiKey: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      geminiApiKey: geminiApiKey,
      apiKeyConfigured: geminiApiKey.length > 0 ? true : prev.apiKeyConfigured,
    }));
  },
  setGeminiVertexProjectId: (projectId: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      geminiVertexProjectId: projectId,
    }));
  },
  setGeminiVertexLocation: (location: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      geminiVertexLocation: location,
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
