import { useReducer, useEffect, useCallback, useState } from 'react'
import { flow } from './flow.ts'
import { classifyNode, templateNode } from '@obieg-zero/core'
import { saveSettings, loadSettings, createOpfsCache, listProjectFiles, listModels, removeModel, totalModelSize } from '@obieg-zero/storage'
import type { FlowEvent } from '@obieg-zero/core'

// --- Types ---

export interface DocSlot {
  type: string; label: string; required?: boolean
  multiple?: boolean; parent?: string; patterns: string[]
}

export interface ExtractField { key: string; label: string; query: string }

interface Doc {
  id: number; name: string; scope: string
  status: 'processing' | 'ready' | 'error'
  error?: string; pages?: number; chunks?: number; docType?: string
}

interface Task {
  id: number; name: string; desc: string; docs: Doc[]; projectId: string
  promptTemplate?: string; extractPrompt?: string
  modules?: Record<string, Record<string, any>>
  documents?: DocSlot[]; extract?: ExtractField[]
  extracted?: Record<string, string>
}

export interface Preset {
  name: string; desc: string; promptTemplate?: string; extractPrompt?: string
  modules?: Record<string, Record<string, any>>
  documents?: DocSlot[]; extract?: ExtractField[]
}

// --- State ---

interface State {
  tasks: Task[]; activeId: number | null; nextId: number
  logs: { t: string; text: string; lvl: 'i' | 'ok' | 'err' | 'dim' }[]
  running: boolean; query: string; answer: string; streaming: string
  panel: 'data' | 'modules' | 'log' | null; dark: boolean
  progress: Record<string, string>
}

const INIT: State = {
  tasks: [], activeId: null, nextId: 1,
  logs: [], running: false, progress: {},
  query: '', answer: '', streaming: '',
  panel: null, dark: true,
}

type Action = Partial<State> & {
  _log?: { text: string; lvl: State['logs'][0]['lvl'] }
  _setTask?: { id: number; patch: Partial<Task> }
  _setDoc?: { taskId: number; docId: number; patch: Partial<Doc> }
}

function now() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

function reduce(s: State, a: Action): State {
  const next = { ...s, ...a }
  if (a._log) next.logs = [...s.logs.slice(-199), { t: now(), ...a._log }]
  if (a._setTask) next.tasks = s.tasks.map(t => t.id === a._setTask!.id ? { ...t, ...a._setTask!.patch } : t)
  if (a._setDoc) next.tasks = (next.tasks ?? s.tasks).map(t => t.id === a._setDoc!.taskId
    ? { ...t, docs: t.docs.map(d => d.id === a._setDoc!.docId ? { ...d, ...a._setDoc!.patch } : d) }
    : t)
  return next
}

function toScope(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}

const DB_KEY = 'obieg:tasks:v2'

// --- Presets ---

const PRESET_CACHE_KEY = 'obieg-zero:presets'
const PRESET_TTL = 24 * 60 * 60 * 1000

async function loadPresets(): Promise<{ presets: Preset[]; limited: boolean }> {
  try {
    const c = localStorage.getItem(PRESET_CACHE_KEY)
    if (c) { const { ts, data } = JSON.parse(c); if (Date.now() - ts < PRESET_TTL) return { presets: data, limited: false } }
  } catch {}
  const res = await fetch('https://api.github.com/orgs/obieg-zero/repos?per_page=100')
  if (!res.ok) return { presets: [], limited: res.status === 403 || res.status === 429 }
  const repos: any[] = await res.json()
  const presets: Preset[] = []
  for (const r of repos.filter((r: any) => r.topics?.includes('obieg-zero-task'))) {
    try {
      const raw = await fetch(`https://raw.githubusercontent.com/${r.full_name}/${r.default_branch}/task.json`)
      if (raw.ok) {
        const t = await raw.json()
        if (t.name && t.desc) presets.push({ name: t.name, desc: t.desc, promptTemplate: t.promptTemplate, extractPrompt: t.extractPrompt, modules: t.modules, documents: t.documents, extract: t.extract })
      }
    } catch {}
  }
  try { localStorage.setItem(PRESET_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: presets })) } catch {}
  return { presets, limited: false }
}

// --- Flow helpers ---

function initFlow(task: { projectId: string; modules?: Record<string, Record<string, any>> }) {
  flow.reset()
  flow.cache(createOpfsCache(task.projectId))
  flow.set('projectId', task.projectId)
  if (task.modules) for (const [mid, cfg] of Object.entries(task.modules)) flow.configure(mid, cfg)
}

function searchAcrossDocs(docs: Doc[]): Promise<string[]> {
  const parts: string[] = []
  return (async () => {
    for (const doc of docs) {
      await flow.run(`search:${doc.scope}`)
      const ctx = flow.get(`context:${doc.scope}`)
      if (ctx != null && ctx !== '') parts.push(ctx)
    }
    return parts
  })()
}

async function runLlm(
  template: string,
  onStream: (text: string) => void,
): Promise<void> {
  flow.node('qa-prompt', templateNode({ template, output: 'prompt' }))
  flow.set('onToken', (t: string) => onStream(t))
  try {
    await flow.run('qa-prompt', 'llm', 'extract')
  } finally {
    flow.set('onToken', null)
  }
}

// --- Hook ---

export function useStore() {
  const [s, up] = useReducer(reduce, INIT)
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetsLimited, setPresetsLimited] = useState(false)
  const [models, setModels] = useState<{ url: string; size: number }[]>([])
  const [modelsSize, setModelsSize] = useState(0)
  const [opfs, setOpfs] = useState<{ name: string; size: number }[]>([])

  const task = s.tasks.find(t => t.id === s.activeId) ?? null
  const log = useCallback((text: string, lvl: State['logs'][0]['lvl'] = 'i') => up({ _log: { text, lvl } }), [])
  const setTask = (id: number, patch: Partial<Task>) => up({ _setTask: { id, patch } })
  const setDoc = (taskId: number, docId: number, patch: Partial<Doc>) => up({ _setDoc: { taskId, docId, patch } })

  useEffect(() => { loadPresets().then(r => { setPresets(r.presets); setPresetsLimited(r.limited) }) }, [])

  useEffect(() => {
    loadSettings(DB_KEY).then((saved: any) => {
      if (saved?.tasks?.length) up({ tasks: saved.tasks, nextId: saved.nextId ?? 1, activeId: saved.activeId })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (s.tasks.length || s.nextId > 1) {
      saveSettings(DB_KEY, { tasks: s.tasks, nextId: s.nextId, activeId: s.activeId }).catch(() => {})
    }
  }, [s.tasks, s.nextId, s.activeId])

  const refreshModels = useCallback(async () => {
    const [list, size] = await Promise.all([listModels(), totalModelSize()])
    setModels(list.map(m => ({ url: m.url, size: m.size }))); setModelsSize(size)
  }, [])

  useEffect(() => { refreshModels() }, [refreshModels])

  const refreshOpfs = useCallback(async (pid?: string) => {
    const id = pid ?? task?.projectId
    if (id) setOpfs(await listProjectFiles(id)); else setOpfs([])
  }, [task?.projectId])

  useEffect(() => {
    const unsub = flow.on((e: FlowEvent) => {
      if (e.type === 'vars') return
      const scope = e.id.includes(':') ? e.id.split(':').slice(1).join(':') : ''
      if (e.type === 'node:start') { log(`> ${e.id}`, 'i'); if (scope) up({ progress: { ...s.progress, [scope]: `${e.id}…` } }) }
      if (e.type === 'node:done') { log(`ok ${e.id}`, 'ok'); if (scope) up({ progress: { ...s.progress, [scope]: '' } }); if (e.id === 'llm' || e.id.startsWith('llm:')) refreshModels() }
      if (e.type === 'node:error') { log(`err ${e.id}: ${e.error}`, 'err'); if (scope) up({ progress: { ...s.progress, [scope]: '' } }) }
      if (e.type === 'progress') { log(`  ${e.id}: ${e.status}`, 'dim'); if (scope) up({ progress: { ...s.progress, [scope]: e.status } }) }
    })
    return unsub
  }, [refreshModels])

  // --- Actions ---

  function activate(id: number) {
    const t = s.tasks.find(t => t.id === id)
    if (!t) return
    initFlow(t)
    up({ activeId: id, panel: 'log', query: '', answer: '', streaming: '' })
    refreshOpfs(t.projectId)
    log(`Task: ${t.name}`, 'i')
  }

  function create(p: Preset) {
    let nid = s.nextId
    const id = nid++
    const t: Task = {
      id, name: p.name, desc: p.desc, docs: [],
      projectId: `t-${id}-${Date.now()}`,
      promptTemplate: p.promptTemplate, extractPrompt: p.extractPrompt,
      modules: p.modules, documents: p.documents, extract: p.extract,
    }
    initFlow(t)
    up({ tasks: [...s.tasks, t], activeId: id, nextId: nid, panel: 'log', query: '', answer: '' })
    log(`New: ${p.name}`, 'ok')
  }

  function remove(id: number) {
    const t = s.tasks.find(t => t.id === id)
    if (t) {
      navigator.storage.getDirectory()
        .then(r => r.getDirectoryHandle('obieg-zero'))
        .then(d => d.removeEntry(t.projectId, { recursive: true }))
        .catch(() => {})
    }
    const rest = s.tasks.filter(t => t.id !== id)
    up({ tasks: rest, activeId: s.activeId === id ? (rest[0]?.id ?? null) : s.activeId })
  }

  async function addFile(file: File) {
    if (!task) return
    const docId = s.nextId
    const scope = toScope(file.name)
    const doc: Doc = { id: docId, name: file.name, scope, status: 'processing' }
    up({ nextId: s.nextId + 1, tasks: s.tasks.map(t => t.id === task.id ? { ...t, docs: [...t.docs, doc] } : t) })

    flow.set(`file:${scope}`, file)
    flow.set(`fileKey:${scope}`, file.name)
    try { await flow.run(`upload:${scope}`) } catch {}

    try {
      up({ running: true })
      await flow.run(`ocr:${scope}`)
      const pages: any[] = flow.get(`pages:${scope}`) ?? []
      setDoc(task.id, docId, { pages: pages.length })

      let docType: string | undefined
      if (task.documents?.length) {
        flow.node(`classify:${scope}`, classifyNode({
          rules: task.documents.map(d => ({ type: d.type, patterns: d.patterns, parent: d.parent })),
        }))
        await flow.run(`classify:${scope}`)
        docType = flow.get(`docType:${scope}`) ?? 'unknown'
        setDoc(task.id, docId, { docType })
        const slot = task.documents.find(d => d.type === docType)
        log(`Classified: ${file.name} → ${slot?.label ?? docType}`, 'ok')
      }

      await flow.run(`embed:${scope}`)
      const chunks: any[] = flow.get(`chunks:${scope}`) ?? []
      setDoc(task.id, docId, { chunks: chunks.length, status: 'ready', docType })
      log(`${file.name}: ${pages.length}p, ${chunks.length}ch`, 'ok')
    } catch (e: any) {
      setDoc(task.id, docId, { status: 'error', error: e.message })
      log(`${file.name}: ${e.message}`, 'err')
    } finally {
      up({ running: false })
      refreshOpfs()
    }
  }

  async function addText(text: string) {
    if (!task || !text.trim()) return
    const docId = s.nextId
    const scope = `text_${docId}`
    const doc: Doc = { id: docId, name: `Text (${text.length} ch)`, scope, status: 'processing' }
    up({ nextId: s.nextId + 1, tasks: s.tasks.map(t => t.id === task.id ? { ...t, docs: [...t.docs, doc] } : t) })

    flow.set(`pages:${scope}`, [{ page: 1, text }])
    try {
      up({ running: true })
      await flow.run(`embed:${scope}`)
      const chunks: any[] = flow.get(`chunks:${scope}`) ?? []
      setDoc(task.id, docId, { pages: 1, chunks: chunks.length, status: 'ready' })
      log(`Text: ${chunks.length}ch`, 'ok')
    } catch (e: any) {
      setDoc(task.id, docId, { status: 'error', error: e.message })
      log(`Text: ${e.message}`, 'err')
    } finally { up({ running: false }) }
  }

  function removeDoc(docId: number) {
    if (!task) return
    setTask(task.id, { docs: task.docs.filter(d => d.id !== docId) })
  }

  async function ask(query: string) {
    if (!task?.promptTemplate || !query.trim()) return
    const ready = task.docs.filter(d => d.status === 'ready')
    if (!ready.length) return

    up({ running: true, answer: '', streaming: '', query })
    try {
      flow.set('query', query)
      const parts = await searchAcrossDocs(ready)
      flow.set('context', parts.map((p, i) => `[${ready[i].name}]\n${p}`).join('\n\n'))

      let acc = ''
      await runLlm(task.promptTemplate, t => { acc = t; up({ streaming: acc }) })

      const answer = flow.get('answer') ?? ''
      up({ running: false, answer, streaming: '' })
      refreshOpfs()
      log(`Done: ${answer.length} chars`, 'ok')
    } catch (e: any) {
      up({ running: false, streaming: '', answer: e.message })
      log(`Query: ${e.message}`, 'err')
    }
  }

  async function runExtract() {
    if (!task?.extract?.length || !task.promptTemplate || !task.extractPrompt) return
    const ready = task.docs.filter(d => d.status === 'ready')
    if (!ready.length) return

    const maxChars = Number(flow.module('embed')?.config?.maxContextChars) || 1500
    const perFieldChars = Math.floor(maxChars / task.extract.length)

    up({ running: true, streaming: '' })
    try {
      const fieldContexts: Record<string, string> = {}
      for (const field of task.extract) {
        flow.set('query', field.query)
        const parts = await searchAcrossDocs(ready)
        fieldContexts[field.key] = parts.join('\n')
        log(`Search: ${field.label}`, 'ok')
      }

      const contextBlock = task.extract.map(f =>
        `[${f.label}]\n${fieldContexts[f.key]?.slice(0, perFieldChars) ?? '(brak)'}`
      ).join('\n\n')
      const fieldsJson = task.extract.map(f => `"${f.key}": "<${f.label}>"`).join(', ')

      flow.set('context', contextBlock)
      flow.set('query', task.extractPrompt.replace('%fields%', fieldsJson))

      let acc = ''
      await runLlm(task.promptTemplate, t => { acc = t; up({ streaming: acc }) })

      const extracted = flow.get('extracted')
      if (extracted && typeof extracted === 'object') {
        setTask(task.id, { extracted })
        log(`Extracted: ${Object.keys(extracted).length} fields`, 'ok')
      } else {
        log(`Extract failed: ${flow.get('extractError') ?? 'No JSON in answer'}`, 'err')
      }

      up({ running: false, streaming: '' })
      refreshOpfs()
    } catch (e: any) {
      up({ running: false, streaming: '' })
      log(`Extract: ${e.message}`, 'err')
    }
  }

  function configure(moduleId: string, key: string, value: any) {
    flow.configure(moduleId, { [key]: value }); up({})
  }

  async function deleteModel(url: string) {
    await removeModel(url); await refreshModels()
    log(`Model removed`, 'ok')
  }

  return {
    s, up, task, presets, presetsLimited,
    models, modelsSize, opfs,
    activate, create, remove,
    addFile, addText, removeDoc, ask, runExtract,
    configure, deleteModel, refreshModels,
    getModules: () => flow.modules(),
    getVars: (): [string, any][] =>
      Object.entries(flow.vars).filter(([, v]) => v != null && typeof v !== 'function' && !(v instanceof File) && !(v instanceof Blob)),
  }
}
