import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './main.css';
await import('katex/dist/katex.min.css');

import './i18n';
import {
  ensureIndexedDbAvailable,
  migrateLocalStorageToIndexedDbIfNeeded,
} from '@store/storage/IndexedDbStorage';
import { persistStoreSnapshot } from '@store/store';

try {
  await ensureIndexedDbAvailable();
  await migrateLocalStorageToIndexedDbIfNeeded();
} catch (error) {
  throw error;
}

if (typeof window !== 'undefined') {
  const flushPersistedState = () => {
    void persistStoreSnapshot();
  };

  window.addEventListener('pagehide', flushPersistedState);
  window.addEventListener('beforeunload', flushPersistedState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPersistedState();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
