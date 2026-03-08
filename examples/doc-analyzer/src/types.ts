import { NODES } from './flow.ts'

export type StepType = 'ocr' | 'embed' | 'search' | 'llm' | 'template'

export interface StepDef {
  label: string; color: string; desc: string
  ph: string; needsInput: boolean
  nodes: string[]
}

export interface Step {
  id: number
  type: StepType
  input: string
  output: string
  status: 'idle' | 'running' | 'done' | 'error'
  meta?: string
}

export interface Task {
  id: number
  name: string
  desc: string
  steps: Step[]
  file: File | null
  fileName: string
  projectId: string
  status: 'idle' | 'running' | 'done' | 'error'
}

export type Log = { t: string; text: string; level: 'info' | 'ok' | 'err' | 'dim' }

export interface S {
  logs: Log[]
  pct: number
  phase: 'idle' | 'ready' | 'running'
  tasks: Task[]
  activeTaskId: number | null
  nextId: number
  streaming: string
  logOpen: boolean
  modulesOpen: boolean
  dark: boolean
}

export const INIT: S = {
  logs: [], pct: 0, phase: 'idle',
  tasks: [], activeTaskId: null, nextId: 1,
  streaming: '', logOpen: false, modulesOpen: false, dark: true,
}

export const STEP_DEFS: Record<StepType, StepDef> = {
  ocr: {
    label: 'OCR', color: 'primary',
    desc: 'PDF text extraction, Tesseract fallback',
    ph: '', needsInput: false, nodes: [NODES.OCR],
  },
  embed: {
    label: 'Embed', color: 'secondary',
    desc: 'Chunking + vector embeddings',
    ph: '', needsInput: false, nodes: [NODES.EMBED],
  },
  search: {
    label: 'Search', color: 'success',
    desc: 'Cosine similarity + keyword boost → top-K',
    ph: 'e.g. bank margin, loan amount', needsInput: true, nodes: [NODES.SEARCH],
  },
  llm: {
    label: 'LLM', color: 'warning',
    desc: 'Local inference (wllama/GGUF)',
    ph: 'e.g. What is the bank margin?', needsInput: true, nodes: [NODES.QA_PROMPT, NODES.LLM],
  },
  template: {
    label: 'Template', color: 'info',
    desc: 'Compose text from {{variables}}',
    ph: 'e.g. Type: {{docType}}\nMargin: {{answer}}', needsInput: true, nodes: [],
  },
}

export interface Preset { name: string; desc: string; steps: { type: StepType; input: string }[] }

export const PRESETS: Preset[] = [
  {
    name: 'LLM smoke test',
    desc: 'OCR → Embed → Search → LLM — set nPredict=1 in Modules',
    steps: [
      { type: 'ocr', input: '' },
      { type: 'embed', input: '' },
      { type: 'search', input: 'document type' },
      { type: 'llm', input: 'One word: what type of document is this?' },
    ],
  },
  {
    name: 'PDF analysis (no LLM)',
    desc: 'OCR → Embed → Search — fast, deterministic',
    steps: [
      { type: 'ocr', input: '' },
      { type: 'embed', input: '' },
      { type: 'search', input: 'bank margin loan amount' },
    ],
  },
  {
    name: 'Full WIBOR analysis',
    desc: 'OCR → Embed → Search → LLM → Template',
    steps: [
      { type: 'ocr', input: '' },
      { type: 'embed', input: '' },
      { type: 'search', input: 'margin WIBOR amount period loan' },
      { type: 'llm', input: 'Return JSON: {"margin": "...", "wibor": "...", "amount": "...", "period": "..."}' },
      { type: 'template', input: 'Contract parameters:\n{{answer}}' },
    ],
  },
]
