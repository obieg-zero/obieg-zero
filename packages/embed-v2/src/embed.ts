export interface Chunk { text: string; page: number; embedding: number[] }

export interface EmbedIndex {
  chunks: Chunk[]
  embed: (text: string) => Promise<number[]>
}

export interface EmbedOpts {
  model: string
  dtype: string
  onProgress?: (msg: string) => void
}

export interface IndexOpts {
  chunkSize: number
  chunkOverlap?: number
  minChunkLength?: number
  onProgress?: (msg: string) => void
}

export interface SearchResult extends Chunk { score: number }

export interface SearchOpts {
  topK?: number
  keywordBoost?: number
  maxContextChars?: number
  minWordLength?: number
}

// --- search (pure function) ---

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

export async function search(
  chunks: Chunk[],
  query: string,
  embedFn: (text: string) => Promise<number[]>,
  opts: SearchOpts = {},
): Promise<SearchResult[]> {
  const { topK = 3, keywordBoost = 0.05, maxContextChars, minWordLength = 2 } = opts
  const queryEmb = await embedFn(query)
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length >= minWordLength)

  const scored = chunks
    .map(chunk => {
      const sim = cosineSim(queryEmb, chunk.embedding)
      const lower = chunk.text.toLowerCase()
      const kw = queryWords.filter(w => lower.includes(w)).length * keywordBoost
      return { ...chunk, score: sim + kw }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  if (maxContextChars) {
    let len = 0
    return scored.filter(r => { len += r.text.length; return len <= maxContextChars })
  }

  return scored
}

// --- chunking (character-based) ---

function chunkText(text: string, chunkSize: number, overlap: number, minLen: number): string[] {
  const chunks: string[] = []
  const step = Math.max(1, chunkSize - overlap)
  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + chunkSize).trim()
    if (slice.length >= minLen) chunks.push(slice)
    if (i + chunkSize >= text.length) break
  }
  return chunks
}

// --- embedder handle ---

export async function createEmbedder(opts: EmbedOpts): Promise<EmbedHandle> {
  const { model, dtype, onProgress } = opts

  onProgress?.('Loading embedding model…')
  const { pipeline: create } = await import('@huggingface/transformers')
  const pipe = await create('feature-extraction', model, { dtype })
  onProgress?.('Embedding model ready')

  async function embedText(text: string): Promise<number[]> {
    const result = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(result.data as Float32Array)
  }

  return {
    embed: embedText,

    async createIndex(pages, indexOpts) {
      const { chunkSize, chunkOverlap = 30, minChunkLength = 10, onProgress: ip } = indexOpts

      const chunks: Chunk[] = []
      for (const p of pages) {
        const texts = chunkText(p.text, chunkSize, chunkOverlap, minChunkLength)
        for (const text of texts) {
          chunks.push({ text, page: p.page, embedding: [] })
        }
      }

      ip?.(`Embedding ${chunks.length} chunks`)
      for (let i = 0; i < chunks.length; i++) {
        ip?.(`Embedding ${i + 1}/${chunks.length}`)
        chunks[i].embedding = await embedText(chunks[i].text)
      }

      return { chunks, embed: embedText }
    },

    dispose() {},
  }
}

export interface EmbedHandle {
  embed(text: string): Promise<number[]>
  createIndex(pages: { page: number; text: string }[], opts: IndexOpts): Promise<EmbedIndex>
  dispose(): void
}
