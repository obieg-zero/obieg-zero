import type { NodeDef } from '@obieg-zero/core';
import { openDB, idbGet, idbPut, idbDelete } from './db.js';

const STORE = 'vars';
const sk = (pid: string, key: string) => `${pid}::${key}`;

export function persistSave(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const pid = ctx.get('projectId');
      if (!pid) throw new Error('persistSave: needs $projectId');
      const db = await openDB();
      try {
        for (const key of config.keys) {
          const val = ctx.get(key);
          if (val !== undefined) await idbPut(db, STORE, sk(pid, key), val);
        }
      } finally { db.close(); }
    },
  };
}

export function persistLoad(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const pid = ctx.get('projectId');
      if (!pid) throw new Error('persistLoad: needs $projectId');
      const db = await openDB();
      try {
        for (const key of config.keys) {
          const val = await idbGet(db, STORE, sk(pid, key));
          if (val !== undefined) ctx.set(key, val);
        }
      } finally { db.close(); }
    },
  };
}

export function persistDelete(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const pid = ctx.get('projectId');
      if (!pid) throw new Error('persistDelete: needs $projectId');
      const db = await openDB();
      try {
        for (const key of config.keys) await idbDelete(db, STORE, sk(pid, key));
      } finally { db.close(); }
    },
  };
}
