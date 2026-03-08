import type { CacheAdapter } from '@obieg-zero/core';
import { openDB, idbGet, idbPut, idbClearByPrefix, CACHE_STORE } from './db.js';

export function createIdbCache(projectId: string): CacheAdapter {
  const prefix = `${projectId}::`;

  return {
    async get(key: string) {
      const db = await openDB();
      try { return await idbGet(db, CACHE_STORE, prefix + key); }
      finally { db.close(); }
    },

    async set(key: string, values: Record<string, any>) {
      const db = await openDB();
      try { await idbPut(db, CACHE_STORE, prefix + key, values); }
      finally { db.close(); }
    },

    async clear() {
      const db = await openDB();
      try { await idbClearByPrefix(db, CACHE_STORE, prefix); }
      finally { db.close(); }
    },
  };
}
