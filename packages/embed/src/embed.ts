import type { NodeDef } from '@obieg-zero/core';

interface Chunk { text: string; page: number; embedding: number[] }

export function embedNode(): NodeDef {
  let worker: Worker | null = null;
  let disposed = false;
  let reqId = 0;
  let activeModel: string | null = null;
  const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();

  function getWorker(factory: () => Worker): Worker {
    if (worker) return worker;
    worker = factory();
    worker.onmessage = (e) => {
      const { id, embedding, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error)); else p.resolve(embedding);
    };
    return worker;
  }

  function embed(text: string, factory: () => Worker, model: string, dtype: string, timeout: number): Promise<number[]> {
    if (disposed) throw new Error('embedNode has been disposed');
    const id = ++reqId;
    const w = getWorker(factory);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Embedding timeout (id=${id})`)); }, timeout);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      w.postMessage({ id, text, model, dtype });
    });
  }

  return {
    reads: ['pages'],
    writes: ['chunks'],
    dispose() {
      disposed = true;
      if (worker) { worker.terminate(); worker = null; }
      for (const [, p] of pending) p.reject(new Error('embedNode disposed'));
      pending.clear();
    },
    async run(ctx) {
      const pages: { page: number; text: string }[] = ctx.get('pages');
      if (!pages?.length) throw new Error('embed: needs $pages');

      const workerFactory = ctx.get('workerFactory');
      if (!workerFactory) throw new Error('embed: needs workerFactory in config');

      const model = ctx.get('model');
      const dtype = ctx.get('dtype');
      const chunkSize = ctx.get('chunkSize');
      const chunkOverlap = ctx.get('chunkOverlap');
      const minChunkLength = ctx.get('minChunkLength');
      const timeout = ctx.get('embedTimeout');

      const chunks: Chunk[] = [];
      for (const p of pages) {
        const words = p.text.split(/\s+/);
        for (let i = 0; i < words.length; i += chunkSize - chunkOverlap) {
          const slice = words.slice(i, i + chunkSize).join(' ');
          if (slice.length > minChunkLength) chunks.push({ text: slice, page: p.page, embedding: [] });
        }
      }

      ctx.progress(`Embedding ${chunks.length} chunks…`);
      const embedFn = (text: string) => embed(text, workerFactory, model, dtype, timeout);
      for (let i = 0; i < chunks.length; i++) {
        ctx.progress(`Embedding ${i + 1}/${chunks.length}`, ((i + 1) / chunks.length) * 100);
        chunks[i].embedding = await embedFn(chunks[i].text);
      }

      ctx.set('chunks', chunks);
      ctx.set('embedFn', embedFn);
      ctx.progress('Done');
    },
  };
}
