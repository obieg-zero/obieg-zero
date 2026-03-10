export interface TemplateNode {
  type: string
  config: Record<string, string>
}

export interface Template {
  id: string
  name: string
  description: string
  nodes: TemplateNode[]
}

const BIELIK = 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf'

export const TEMPLATES: Template[] = [
  {
    id: 'graph-rag',
    name: 'Graph RAG',
    description: 'Wyciagnij fakty z dowolnego dokumentu, zbuduj graf wiedzy',
    nodes: [
      { type: 'upload', config: { project: 'default' } },
      { type: 'ocr', config: { language: 'pol' } },
      { type: 'embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
      { type: 'extract', config: {
        questions: 'Wlasciciel to\nNazwa firmy to\nMiejsce to\nData to\nGlowna kwota to',
        modelUrl: BIELIK,
      }},
      { type: 'graph', config: {} },
    ],
  },
  {
    id: 'wibor-analysis',
    name: 'Analiza WIBOR',
    description: 'Wyciagnij fakty z umowy kredytowej, harmonogramu i danych WIBOR',
    nodes: [
      { type: 'upload', config: { project: 'default' } },
      { type: 'ocr', config: { language: 'pol' } },
      { type: 'embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
      { type: 'extract', config: {
        questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nMiesieczna rata wynosi\nKredytobiorca to',
        modelUrl: BIELIK,
      }},
      { type: 'graph', config: {} },
    ],
  },
  {
    id: 'wibor-api',
    name: 'Analiza WIBOR (API)',
    description: 'Jak Analiza WIBOR ale przez API — szybkie testowanie',
    nodes: [
      { type: 'upload', config: { project: 'default' } },
      { type: 'ocr', config: { language: 'pol' } },
      { type: 'embed', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
      { type: 'extract-api', config: {
        questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nMiesieczna rata wynosi\nKredytobiorca to',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini',
      }},
      { type: 'graph', config: {} },
    ],
  },
]
