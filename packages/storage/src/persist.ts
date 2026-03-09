import type { NodeDef } from '@obieg-zero/core';
import { openDB, idbGet, idbPut, idbDelete } from './db.js';

const STORE = 'vars';
const sk = (pid: string, key: string) => `${pid}::${key}`;

function getKeys(ctx: { get(key: string): any }): string[] {
  const raw = ctx.get('persistKeys');
  if (!raw) throw new Error('persist: needs persistKeys in config');
  if (Array.isArray(raw)) return raw;
  return String(raw).split(',').map(k => k.trim()).filter(Boolean);
}

export function persistSave(): NodeDef {
  return {
    async run(ctx) {
      const pid = ctx.get('projectId');
      if (!pid) throw new Error('persistSave: needs $projectId');
      const keys = getKeys(ctx);
      const db = await openDB();
      try {
        for (const key of keys) {
          const val = ctx.get(key);
          if (val !== undefined) await idbPut(db, STORE, sk(pid, key), val);
        }
      } finally { db.close(); }
    },
  };
}

export function persistLoad(): NodeDef {
  return {
    async run(ctx) {
      const pid = ctx.get('projectId');
      if (!pid) throw new Error('persistLoad: needs $projectId');
      const keys = getKeys(ctx);
      const db = await openDB();
      try {
        for (const key of keys) {
          const val = await idbGet(db, STORE, sk(pid, key));
          if (val !== undefined) ctx.set(key, val);
        }
      } finally { db.close(); }
    },
  };
}

export function persistDelete(): NodeDef {
  return {
    async run(ctx) {
      const pid = ctx.get('projectId');
      if (!pid) throw new Error('persistDelete: needs $projectId');
      const keys = getKeys(ctx);
      const db = await openDB();
      try {
        for (const key of keys) await idbDelete(db, STORE, sk(pid, key));
      } finally { db.close(); }
    },
  };
}
