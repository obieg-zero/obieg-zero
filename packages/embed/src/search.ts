import type { NodeDef } from '@obieg-zero/core';

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export function searchNode(config?: { topK?: number; keywordBoost?: number }): NodeDef {
  const { topK = 5, keywordBoost = 0.05 } = config ?? {};

  return {
    async run(ctx) {
      const query: string = ctx.get('query');
      const chunks: { text: string; page: number; embedding: number[] }[] = ctx.get('chunks');
      if (!query || !chunks?.length) throw new Error('search: needs $query and $chunks');

      const embedFn = ctx.get('embedFn');
      if (!embedFn) throw new Error('search: needs $embedFn (run embed node first)');
      ctx.progress('Embedding query…');
      const queryEmbedding: number[] = await embedFn(query);

      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const boost = ctx.get('keywordBoost') ?? keywordBoost;

      const scored = chunks
        .map((chunk) => {
          const sim = cosineSim(queryEmbedding, chunk.embedding);
          const kw = queryWords.filter(w => chunk.text.toLowerCase().includes(w)).length * boost;
          return { ...chunk, score: sim + kw };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, ctx.get('topK') ?? topK);

      ctx.set('context', scored.map(m => m.text).join('\n\n'));
      ctx.set('matchedChunks', scored);
      ctx.progress(`Top ${scored.length} chunks (best: ${scored[0]?.score.toFixed(3) ?? '—'})`);
    },
  };
}
