import { loadSettings, saveSettings } from './db.js';

export interface ModelEntry {
  url: string;
  size: number;
  downloadedAt: number;
}

const KEY = 'models';

export async function listModels(): Promise<ModelEntry[]> {
  return (await loadSettings(KEY)) ?? [];
}

export async function registerModel(url: string, size: number): Promise<void> {
  const models = await listModels();
  const existing = models.find(m => m.url === url);
  if (existing) { existing.size = size; existing.downloadedAt = Date.now(); }
  else models.push({ url, size, downloadedAt: Date.now() });
  await saveSettings(KEY, models);
}

export async function removeModel(url: string): Promise<void> {
  const models = (await listModels()).filter(m => m.url !== url);
  await saveSettings(KEY, models);
  // try to remove from Cache API
  if (typeof caches !== 'undefined') {
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      await c.delete(url);
    }
  }
}

export async function clearModels(): Promise<void> {
  await saveSettings(KEY, []);
}

export async function totalModelSize(): Promise<number> {
  return (await listModels()).reduce((sum, m) => sum + m.size, 0);
}
