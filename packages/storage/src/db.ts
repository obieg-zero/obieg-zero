const DB_NAME = 'obieg-zero';
const DB_VERSION = 3;
const VARS_STORE = 'vars';
const SETTINGS_STORE = 'settings';
export const CACHE_STORE = 'cache';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VARS_STORE)) db.createObjectStore(VARS_STORE);
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbOp<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const idbGet = (db: IDBDatabase, store: string, key: string) => idbOp<any>(db, store, 'readonly', s => s.get(key));
export const idbPut = (db: IDBDatabase, store: string, key: string, value: any) => idbOp<void>(db, store, 'readwrite', s => s.put(value, key));
export const idbDelete = (db: IDBDatabase, store: string, key: string) => idbOp<void>(db, store, 'readwrite', s => s.delete(key));

export function idbClearByPrefix(db: IDBDatabase, store: string, prefix: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    const req = s.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function withDB<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDB();
  try { return await fn(db); } finally { db.close(); }
}

export const loadSettings = (key: string) => withDB(db => idbGet(db, SETTINGS_STORE, key));
export const saveSettings = (key: string, value: any) => withDB(db => idbPut(db, SETTINGS_STORE, key, value));
