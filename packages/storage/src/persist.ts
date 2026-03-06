import type { NodeDef } from '@obieg-zero/core';

const DB_NAME = 'rag-toolkit-persist';
const STORE_NAME = 'vars';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function scopedKey(projectId: string, key: string) {
  return `${projectId}::${key}`;
}

export function persistSave(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      if (!projectId) throw new Error('persistSave: needs $projectId');

      ctx.progress('Zapisuję dane…');
      const db = await openDB();
      for (const key of config.keys) {
        const val = ctx.get(key);
        if (val !== undefined) {
          await idbPut(db, scopedKey(projectId, key), val);
        }
      }
      db.close();
      ctx.progress('Dane zapisane');
    },
  };
}

export function persistLoad(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      if (!projectId) throw new Error('persistLoad: needs $projectId');

      ctx.progress('Wczytuję dane…');
      const db = await openDB();
      for (const key of config.keys) {
        const val = await idbGet(db, scopedKey(projectId, key));
        if (val !== undefined) {
          ctx.set(key, val);
        }
      }
      db.close();
      ctx.progress('Dane wczytane');
    },
  };
}

export function persistDelete(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      if (!projectId) throw new Error('persistDelete: needs $projectId');

      const db = await openDB();
      for (const key of config.keys) {
        await idbDelete(db, scopedKey(projectId, key));
      }
      db.close();
    },
  };
}
