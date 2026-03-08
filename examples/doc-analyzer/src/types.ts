export type StepType = 'search' | 'classify' | 'extract' | 'llm' | 'template'

export interface Step {
  id: number
  type: StepType
  input: string
  output: string
  status: 'idle' | 'running' | 'done' | 'error'
  meta?: string
}

export interface ChunkConfig { chunkSize: number; chunkOverlap: number; topK: number }

export type Log = { t: string; text: string; level: 'info' | 'ok' | 'err' | 'dim' }

export interface S {
  logs: Log[]
  pct: number
  phase: 'idle' | 'ingest' | 'ready' | 'running'
  doc: { name: string; pages: number; chars: number; chunks: number } | null
  steps: Step[]
  nextId: number
  streaming: string
  logOpen: boolean
  chunksOpen: boolean
  chunkCfg: ChunkConfig
}

export const INIT: S = {
  logs: [], pct: 0, phase: 'idle', doc: null, steps: [], nextId: 1,
  streaming: '', logOpen: false, chunksOpen: false,
  chunkCfg: { chunkSize: 200, chunkOverlap: 30, topK: 3 },
}

export const STEPS: Record<StepType, { icon: string; label: string; color: string; desc: string; ph: string }> = {
  search:   { icon: '⌕', label: 'Szukaj',     color: 'success',   desc: 'Znajdź fragmenty dokumentu',     ph: 'np. marża banku, kwota kredytu' },
  classify: { icon: '◈', label: 'Klasyfikuj', color: 'secondary', desc: 'Określ typ dokumentu',            ph: 'np. Czy to umowa kredytowa, aneks czy regulamin?' },
  extract:  { icon: '⊞', label: 'Wyciągnij',  color: 'accent',   desc: 'Ekstrakcja pól → JSON',           ph: 'np. Podaj jako JSON: marża, WIBOR, kwota, okres' },
  llm:      { icon: '◎', label: 'Pytaj AI',   color: 'warning',  desc: 'Dowolne pytanie do Bielika',      ph: 'np. Jaka jest marża banku?' },
  template: { icon: '⎗', label: 'Szablon',    color: 'info',     desc: 'Złóż tekst z {{zmiennych}}',      ph: 'np. Typ: {{docType}}\nMarża: {{answer}}' },
}

export interface Preset { name: string; desc: string; steps: { type: StepType; input: string }[] }

export const PRESETS: Preset[] = [
  { name: 'Klasyfikacja + ekstrakcja', desc: 'Pełny pipeline WIBOR', steps: [
    { type: 'classify', input: 'Czy to umowa kredytowa, aneks, regulamin, czy inny dokument? Odpowiedz jednym słowem.' },
    { type: 'extract', input: 'Podaj w formacie JSON: {"marza": "...", "wibor": "...", "kwota": "...", "okres": "..."}' },
    { type: 'template', input: 'Typ dokumentu: {{docType}}\n\nParametry:\n{{extracted}}' },
  ]},
  { name: 'Szybkie pytanie', desc: 'Search + AI', steps: [
    { type: 'llm', input: '' },
  ]},
  { name: 'Tylko search', desc: 'Instant, bez AI', steps: [
    { type: 'search', input: '' },
  ]},
]
