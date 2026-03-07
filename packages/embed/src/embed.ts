import type { NodeDef } from '@obieg-zero/core';

export interface EmbedConfig {
  model: string;
  dtype?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  workerFactory?: () => Worker;
}

interface Chunk {
  text: string;
  page: number;
  embedding: number[];
}

export function embedNode(config: EmbedConfig): NodeDef {
  const { model, dtype = 'q8', chunkSize = 500, chunkOverlap = 50, workerFactory } = config;
  let worker: Worker | null = null;
  let reqId = 0;
  const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();

  function getWorker(): Worker {
    if (worker) return worker;
    if (!workerFactory) throw new Error('embedNode: workerFactory required');
    worker = workerFactory();
    worker.onmessage = (e) => {
      const { id, embedding, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(embedding);
    };
    return worker;
  }

  function embed(text: string): Promise<number[]> {
    const id = ++reqId;
    const w = getWorker();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Embedding timeout (id=${id})`));
      }, 60_000);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      w.postMessage({ id, text, model, dtype });
    });
  }

  return {
    async run(ctx) {
      const pages: { page: number; text: string }[] = ctx.get('pages');
      if (!pages?.length) throw new Error('embed: needs $pages');

      ctx.progress('Dzielę tekst na fragmenty…');

      const chunks: Chunk[] = [];
      for (const p of pages) {
        const words = p.text.split(/\s+/);
        for (let i = 0; i < words.length; i += chunkSize - chunkOverlap) {
          const slice = words.slice(i, i + chunkSize).join(' ');
          if (slice.length > 10) {
            chunks.push({ text: slice, page: p.page, embedding: [] });
          }
        }
      }

      ctx.progress(`Embeddinguję ${chunks.length} fragmentów…`);
      for (let i = 0; i < chunks.length; i++) {
        ctx.progress(`Embedding ${i + 1}/${chunks.length}`, ((i + 1) / chunks.length) * 100);
        chunks[i].embedding = await embed(chunks[i].text);
      }

      ctx.set('chunks', chunks);
      ctx.progress('Embedding zakończony');
    },
  };
}
