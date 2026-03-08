import type { CacheAdapter } from '@obieg-zero/core';
import { getProjectDir } from './opfs-helpers.js';

const IDX = '_index.json';

async function readIndex(dir: FileSystemDirectoryHandle): Promise<Record<string, string[]>> {
  try {
    const h = await dir.getFileHandle(IDX);
    return JSON.parse(await (await h.getFile()).text());
  } catch { return {}; }
}

async function writeIndex(dir: FileSystemDirectoryHandle, idx: Record<string, string[]>) {
  const h = await dir.getFileHandle(IDX, { create: true });
  const w = await h.createWritable();
  await w.write(JSON.stringify(idx));
  await w.close();
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: any) {
  const h = await dir.getFileHandle(name, { create: true });
  const w = await h.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

export function createOpfsCache(projectId: string, rootDir = 'obieg-zero'): CacheAdapter {
  return {
    async get(key) {
      try {
        const dir = await getProjectDir(projectId, rootDir);
        const idx = await readIndex(dir);
        const vars = idx[key];
        if (!vars) return undefined;
        const result: Record<string, any> = {};
        for (const v of vars) {
          const h = await dir.getFileHandle(`${v}.json`);
          result[v] = JSON.parse(await (await h.getFile()).text());
        }
        return result;
      } catch { return undefined; }
    },

    async set(key, values) {
      const dir = await getProjectDir(projectId, rootDir);
      for (const [name, data] of Object.entries(values)) {
        await writeFile(dir, `${name}.json`, data);
      }
      const idx = await readIndex(dir);
      idx[key] = Object.keys(values);
      await writeIndex(dir, idx);
    },

    async clear() {
      try {
        const dir = await getProjectDir(projectId, rootDir);
        const idx = await readIndex(dir);
        for (const vars of Object.values(idx)) {
          for (const v of vars) {
            try { await dir.removeEntry(`${v}.json`); } catch {}
          }
        }
        try { await dir.removeEntry(IDX); } catch {}
      } catch {}
    },
  };
}

export interface OpfsEntry { name: string; size: number }

export async function listProjectFiles(projectId: string, rootDir = 'obieg-zero'): Promise<OpfsEntry[]> {
  try {
    const dir = await getProjectDir(projectId, rootDir);
    const entries: OpfsEntry[] = [];
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind === 'file' && name !== IDX) {
        const file = await (handle as FileSystemFileHandle).getFile();
        entries.push({ name, size: file.size });
      }
    }
    return entries;
  } catch { return []; }
}

export async function readProjectFile(projectId: string, fileName: string, rootDir = 'obieg-zero'): Promise<string> {
  const dir = await getProjectDir(projectId, rootDir);
  const h = await dir.getFileHandle(fileName);
  return (await h.getFile()).text();
}

export async function writeProjectFile(projectId: string, fileName: string, data: any, rootDir = 'obieg-zero'): Promise<void> {
  const dir = await getProjectDir(projectId, rootDir);
  const h = await dir.getFileHandle(fileName, { create: true });
  const w = await h.createWritable();
  await w.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  await w.close();
}
