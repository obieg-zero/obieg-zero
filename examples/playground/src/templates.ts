import type { Node, Edge } from '@xyflow/react'

export const BIELIK = 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf'

export interface Template { id: string; name: string; nodes: Node[]; edges: Edge[] }

function pipe(types: { type: string; label: string; config?: Record<string, string> }[]): { nodes: Node[]; edges: Edge[] } {
  const nodes = types.map((t, i) => ({
    id: `${i + 1}`,
    type: t.type,
    position: { x: 300, y: i * 120 },
    data: { label: t.label, config: t.config || {} },
  }))
  const edges = types.slice(1).map((_, i) => ({
    id: `e${i + 1}-${i + 2}`,
    source: `${i + 1}`,
    sourceHandle: 'next',
    target: `${i + 2}`,
  }))
  return { nodes, edges }
}

export const TEMPLATES: Template[] = [
  {
    id: 'wibor',
    name: 'Analiza WIBOR',
    ...pipe([
      { type: 'upload', label: 'Upload' },
      { type: 'parse', label: 'Parse', config: { language: 'pol' } },
      { type: 'embed', label: 'Embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
      { type: 'extract', label: 'Extract', config: { questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nMiesieczna rata wynosi\nKredytobiorca to', topK: '2', modelUrl: BIELIK } },
      { type: 'graph', label: 'Graph' },
    ]),
  },
  {
    id: 'wibor-api',
    name: 'WIBOR (API)',
    ...pipe([
      { type: 'upload', label: 'Upload' },
      { type: 'parse', label: 'Parse', config: { language: 'pol' } },
      { type: 'embed', label: 'Embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
      { type: 'extract-api', label: 'Extract API', config: { questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nMiesieczna rata wynosi\nKredytobiorca to', topK: '2', apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: '', apiModel: 'gpt-4o-mini' } },
      { type: 'graph', label: 'Graph' },
    ]),
  },
]
