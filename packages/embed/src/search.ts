import type { NodeDef } from '@obieg-zero/core';
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export function searchNode(config?: { topK?: number }): NodeDef {
  const topK = config?.topK ?? 5;

  return {
    async run(ctx) {
      const query: string = ctx.get('query');
      const chunks: { text: string; page: number; embedding: number[] }[] = ctx.get('chunks');
      if (!query || !chunks?.length) throw new Error('search: needs $query and $chunks');

      let queryEmbedding: number[] = ctx.get('queryEmbedding');
      if (!queryEmbedding) {
        const embedFn = ctx.get('embedFn');
        if (!embedFn) throw new Error('search: needs $queryEmbedding or $embedFn (run embed node first)');
        queryEmbedding = await embedFn(query);
      }

      ctx.progress('Szukam…');

      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

      const scored = chunks.map((chunk) => {
        const sim = cosineSim(queryEmbedding, chunk.embedding);
        const lower = chunk.text.toLowerCase();
        const keywordBoost = queryWords.filter(w => lower.includes(w)).length * 0.05;
        return { ...chunk, score: sim + keywordBoost };
      });

      scored.sort((a, b) => b.score - a.score);
      const matched = scored.slice(0, topK);

      ctx.set('context', matched.map(m => m.text).join('\n\n'));
      ctx.set('matchedChunks', matched);
      ctx.progress('Wyszukiwanie zakończone');
    },
  };
}
