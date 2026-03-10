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
        prompt: 'Wypisz fakty z tekstu. Kazdy fakt w osobnej linii w formacie TYP: wartosc\n\nPrzyklad:\nosoba: Jan Kowalski\nkwota: 50000 PLN\ndata: 1 stycznia 2020\n\nTekst: "{{chunk}}"\n\nFakty:',
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
        prompt: 'Wypisz fakty z tekstu. Kazdy fakt w osobnej linii w formacie TYP: wartosc\nMozliwe typy: bank, kwota, marza, wibor, data, okres, rata, waluta, oprocentowanie\n\nPrzyklad:\nbank: PKO BP\nkwota: 200000 PLN\nmarza: 2.5%\n\nTekst: "{{chunk}}"\n\nFakty:',
        modelUrl: BIELIK,
      }},
      { type: 'graph', config: {} },
    ],
  },
]
