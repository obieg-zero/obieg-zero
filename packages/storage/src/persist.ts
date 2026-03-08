import type { NodeDef } from '@obieg-zero/core';
import { openDB, idbGet, idbPut, idbDelete } from './db.js';

const STORE = 'vars';

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
      try {
        for (const key of config.keys) {
          const val = ctx.get(key);
          if (val !== undefined) {
            await idbPut(db, STORE, scopedKey(projectId, key), val);
          }
        }
        ctx.progress('Dane zapisane');
      } finally {
        db.close();
      }
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
      try {
        for (const key of config.keys) {
          const val = await idbGet(db, STORE, scopedKey(projectId, key));
          if (val !== undefined) {
            ctx.set(key, val);
          }
        }
        ctx.progress('Dane wczytane');
      } finally {
        db.close();
      }
    },
  };
}

export function persistDelete(config: { keys: string[] }): NodeDef {
  return {
    async run(ctx) {
      const projectId: string = ctx.get('projectId');
      if (!projectId) throw new Error('persistDelete: needs $projectId');

      const db = await openDB();
      try {
        for (const key of config.keys) {
          await idbDelete(db, STORE, scopedKey(projectId, key));
        }
      } finally {
        db.close();
      }
    },
  };
}
