import { NODES, TPL_OUTPUT } from './flow.ts'
import { templateNode } from '@obieg-zero/core'
import type { FlowInstance } from './flow.ts'

export type StepType = 'ocr' | 'embed' | 'search' | 'llm' | 'template'

export type StepResult = { output: string; meta?: string }
type Up = (patch: { streaming?: string }) => void

export interface StepDef {
  label: string; color: string; desc: string
  ph: string; needsInput: boolean
  nodes: string[]
  prepare?: (flow: FlowInstance, input: string, up: Up) => void
  format: (flow: FlowInstance) => StepResult
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
  modules?: Record<string, Record<string, any>>
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
  rightPanel: 'data' | 'modules' | 'log' | null
  dark: boolean
}

export const INIT: S = {
  logs: [], pct: 0, phase: 'idle',
  tasks: [], activeTaskId: null, nextId: 1,
  streaming: '', rightPanel: null, dark: true,
}

export const STEP_DEFS: Record<StepType, StepDef> = {
  ocr: {
    label: 'OCR', color: 'primary',
    desc: 'PDF text extraction, Tesseract fallback',
    ph: '', needsInput: false, nodes: [NODES.OCR],
    format: (f) => {
      const pages: any[] = f.get('pages') ?? []
      const chars = pages.reduce((a: number, p: any) => a + p.text.length, 0)
      return { output: `${pages.length} pages, ${chars} chars` }
    },
  },
  embed: {
    label: 'Embed', color: 'secondary',
    desc: 'Chunking + vector embeddings',
    ph: '', needsInput: false, nodes: [NODES.EMBED],
    format: (f) => ({ output: `${(f.get('chunks') ?? []).length} chunks embedded` }),
  },
  search: {
    label: 'Search', color: 'success',
    desc: 'Cosine similarity + keyword boost → top-K',
    ph: 'e.g. bank margin, loan amount', needsInput: true, nodes: [NODES.SEARCH],
    prepare: (f, input) => f.set('query', input),
    format: (f) => {
      const matched: any[] = f.get('matchedChunks') ?? []
      return {
        output: matched.map((c: any, i: number) =>
          `#${i + 1} [page ${c.page}, score ${c.score.toFixed(3)}]\n${c.text.slice(0, 200)}${c.text.length > 200 ? '…' : ''}`
        ).join('\n\n'),
        meta: `${matched.length} chunks, scores: ${matched.map((c: any) => c.score.toFixed(3)).join(', ')}`,
      }
    },
  },
  llm: {
    label: 'LLM', color: 'warning',
    desc: 'Local inference (wllama/GGUF)',
    ph: 'e.g. What is the bank margin?', needsInput: true,
    nodes: [NODES.SEARCH, NODES.QA_PROMPT, NODES.LLM, NODES.EXTRACT],
    prepare: (f, input, up) => {
      f.set('query', input)
      let acc = ''
      f.set('onToken', (t: string) => { acc += t; up({ streaming: acc }) })
    },
    format: (f) => {
      const answer = f.get('answer') ?? ''
      const extracted = f.get('extracted')
      const extractError = f.get('extractError')
      return {
        output: answer,
        meta: [
          `context: ${(f.get('context') ?? '').length} → prompt: ${(f.get('prompt') ?? '').length} → answer: ${answer.length} chars`,
          extracted ? `extracted: ${JSON.stringify(extracted).slice(0, 80)}` : null,
          extractError ? `extract: ${extractError}` : null,
        ].filter(Boolean).join(' | '),
      }
    },
  },
  template: {
    label: 'Template', color: 'info',
    desc: 'Compose text from {{variables}}',
    ph: 'e.g. Type: {{docType}}\nMargin: {{answer}}', needsInput: true, nodes: [NODES.TPL],
    prepare: (f, input) => {
      f.node(NODES.TPL, templateNode({ template: input, output: TPL_OUTPUT }))
    },
    format: (f) => ({ output: f.get(TPL_OUTPUT) ?? '' }),
  },
}

export interface Preset {
  name: string
  desc: string
  modules?: Record<string, Record<string, any>>
  steps: { type: StepType; input: string }[]
  repo?: string
}

const ORG = 'obieg-zero'
const TOPIC = 'obieg-zero-task'
const CACHE_KEY = 'obieg-zero:presets'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

export type FetchResult = { presets: Preset[]; rateLimited: boolean }

export async function fetchPresets(): Promise<FetchResult> {
  // Check localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { ts, data } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_TTL) return { presets: data, rateLimited: false }
    }
  } catch { /* ignore */ }

  const res = await fetch(`https://api.github.com/orgs/${ORG}/repos?per_page=100`)
  if (!res.ok) return { presets: [], rateLimited: res.status === 403 || res.status === 429 }
  const repos: any[] = await res.json()
  const taskRepos = repos.filter((r: any) => r.topics?.includes(TOPIC))
  const presets: Preset[] = []
  for (const repo of taskRepos) {
    try {
      const raw = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/task.json`)
      if (!raw.ok) continue
      const task = await raw.json()
      presets.push({ ...task, repo: repo.full_name })
    } catch { /* skip broken repos */ }
  }

  // Cache result
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: presets })) } catch { /* ignore */ }
  return { presets, rateLimited: false }
}
