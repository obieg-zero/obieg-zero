import { useReducer, useEffect, useCallback, useState } from 'react'
import { flow, NODES } from './flow.ts'
import type { FlowEvent } from '@obieg-zero/core'
import { saveSettings, loadSettings, listModels, removeModel, totalModelSize, createOpfsCache, listProjectFiles, type ModelEntry, type OpfsEntry } from '@obieg-zero/storage'
import type { S, Task, Step, Log, Preset } from './types.ts'
import { INIT, STEP_DEFS, fetchPresets } from './types.ts'

const TASKS_KEY = 'workbench:tasks'

function switchProject(pid: string) {
  for (const key of Object.keys(flow.vars)) flow.set(key, null)
  flow.cache(createOpfsCache(pid))
  flow.set('projectId', pid)
}


function ts() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

function reducer(s: S, a: Partial<S> & { _log?: { text: string; level: Log['level'] } }): S {
  const next = { ...s, ...a }
  if (a._log) next.logs = [...s.logs.slice(-199), { t: ts(), ...a._log }]
  return next
}

// Serialize tasks for IDB (strip File objects)
function serializeTasks(tasks: Task[]) {
  return tasks.map(t => ({ ...t, file: null }))
}

export function useWorkbench() {
  const [s, up] = useReducer(reducer, INIT)
  const busy = s.phase === 'running'
  const task = s.tasks.find(t => t.id === s.activeTaskId) ?? null
  const [models, setModels] = useState<{ list: ModelEntry[]; totalSize: number }>({ list: [], totalSize: 0 })
  const [opfsFiles, setOpfsFiles] = useState<OpfsEntry[]>([])
  const [presets, setPresets] = useState<Preset[]>([])

  const log = useCallback((text: string, level: Log['level'] = 'info') => up({ _log: { text, level } }), [])

  // Fetch task presets from GitHub
  useEffect(() => {
    fetchPresets().then(setPresets).catch(() => {})
  }, [])

  // Load persisted tasks on mount
  useEffect(() => {
    loadSettings(TASKS_KEY).then((saved: any) => {
      if (saved?.tasks?.length) {
        up({ tasks: saved.tasks, nextId: saved.nextId ?? 1, activeTaskId: saved.activeTaskId })
        console.log(`[workbench] Restored ${saved.tasks.length} tasks from IDB`)
      }
    }).catch(() => {})
  }, [])

  // Persist tasks on every change
  useEffect(() => {
    if (s.tasks.length > 0 || s.nextId > 1) {
      saveSettings(TASKS_KEY, {
        tasks: serializeTasks(s.tasks),
        nextId: s.nextId,
        activeTaskId: s.activeTaskId,
      }).catch(() => {})
    }
  }, [s.tasks, s.nextId, s.activeTaskId])

  // Refresh model registry
  const refreshOpfs = useCallback(async (pid?: string) => {
    const id = pid ?? task?.projectId
    if (id) setOpfsFiles(await listProjectFiles(id))
    else setOpfsFiles([])
  }, [task?.projectId])

  const refreshModels = useCallback(async () => {
    const [list, size] = await Promise.all([listModels(), totalModelSize()])
    setModels({ list, totalSize: size })
  }, [])

  useEffect(() => { refreshModels() }, [refreshModels])

  useEffect(() => {
    return flow.on((e: FlowEvent) => {
      if (e.type === 'node:start') log(`▶ ${e.id}`, 'info')
      if (e.type === 'node:done') {
        log(`✓ ${e.id}`, 'ok')
        // Refresh models after LLM loads (model gets registered)
        if (e.id === NODES.LLM) refreshModels()
      }
      if (e.type === 'node:error') log(`✕ ${e.id}: ${e.error}`, 'err')
      if (e.type === 'progress') {
        log(`  ${e.id}: ${e.status}`, 'dim')
        if (e.pct != null) up({ pct: e.pct })
      }
    })
  }, [refreshModels])

  const updateTask = (id: number, patch: Partial<Task>) =>
    up({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) })

  const updateTaskStep = (taskId: number, stepId: number, patch: Partial<Step>) =>
    up({ tasks: s.tasks.map(t => t.id === taskId
      ? { ...t, steps: t.steps.map(st => st.id === stepId ? { ...st, ...patch } : st) }
      : t
    ) })

  // Switch active task — restore file from OPFS if available
  const activateTask = async (taskId: number) => {
    const t = s.tasks.find(t => t.id === taskId)
    if (!t) return
    switchProject(t.projectId)
    // Restore per-task module overrides
    if (t.modules) {
      for (const [moduleId, settings] of Object.entries(t.modules)) {
        flow.configure(moduleId, settings)
      }
    }
    if (t.fileName && !t.file) {
      flow.set('fileKey', t.fileName)
      try {
        await flow.run(NODES.LOAD_FILE)
        const file = flow.get('file')
        if (file) updateTask(taskId, { file })
        log(`File restored from OPFS: ${t.fileName}`, 'ok')
      } catch {
        log(`File not in OPFS: ${t.fileName}`, 'dim')
      }
    }
    up({ activeTaskId: taskId, logOpen: true })
    refreshOpfs(t.projectId)
    log(`Task: ${t.name}`, 'info')
  }

  const createTask = (p: Preset) => {
    let nid = s.nextId
    const taskId = nid++
    const steps: Step[] = p.steps.map(ps => ({
      id: nid++, type: ps.type, input: ps.input, output: '', status: 'idle' as const,
    }))
    const newTask: Task = {
      id: taskId, name: p.name, desc: p.desc, steps,
      file: null, fileName: '', projectId: `task-${taskId}-${Date.now()}`,
      status: 'idle', modules: p.modules,
    }
    switchProject(newTask.projectId)
    // Apply per-task module overrides
    if (p.modules) {
      for (const [moduleId, settings] of Object.entries(p.modules)) {
        flow.configure(moduleId, settings)
      }
    }
    up({ tasks: [...s.tasks, newTask], activeTaskId: taskId, nextId: nid, logOpen: true })
    log(`New task: ${p.name}`, 'ok')
  }

  const removeTask = (id: number) => {
    const t = s.tasks.find(t => t.id === id)
    if (t) {
      // Clean up OPFS directly — avoid corrupting active task's projectId
      navigator.storage.getDirectory()
        .then(root => root.getDirectoryHandle('obieg-zero'))
        .then(dir => dir.removeEntry(t.projectId, { recursive: true }))
        .catch(() => {})
    }
    const next = s.tasks.filter(t => t.id !== id)
    up({ tasks: next, activeTaskId: s.activeTaskId === id ? (next[0]?.id ?? null) : s.activeTaskId })
  }

  const loadFile = async (file: File) => {
    if (!task) return
    // New file = clear derived state (pages, chunks, context from old file)
    for (const key of ['pages', 'chunks', 'context', 'matchedChunks', 'embedFn']) flow.set(key, null)
    flow.set('file', file)
    flow.set('fileKey', file.name)
    updateTask(task.id, { file, fileName: file.name })
    // Persist to OPFS
    try {
      await flow.run(NODES.UPLOAD)
      log(`File: ${file.name} (${(file.size / 1024).toFixed(0)} KB) → OPFS`, 'ok')
      refreshOpfs(task.projectId)
    } catch {
      log(`File: ${file.name} (${(file.size / 1024).toFixed(0)} KB) [OPFS failed]`, 'info')
    }
  }

  const loadText = (text: string) => {
    if (!task || !text.trim()) return
    for (const key of ['chunks', 'context', 'matchedChunks', 'embedFn']) flow.set(key, null)
    flow.set('pages', [{ page: 1, text }])
    const name = `Text (${text.length} chars)`
    const fakeFile = new File([text], 'paste.txt')
    updateTask(task.id, { file: fakeFile, fileName: name })
    log(`Text: ${text.length} chars`, 'ok')
  }

  const configureMod = (moduleId: string, key: string, value: any) => {
    flow.configure(moduleId, { [key]: value })
    up({})
  }

  const runStep = async (step: Step) => {
    if (!task) return
    const def = STEP_DEFS[step.type]
    if (def.needsInput && !step.input.trim()) return

    updateTask(task.id, { status: 'running' })
    updateTaskStep(task.id, step.id, { status: 'running', output: '' })
    up({ phase: 'running' })

    try {
      def.prepare?.(flow, step.input, up)
      await flow.run(...def.nodes)
      flow.set('onToken', null)
      up({ streaming: '' })
      const result = def.format(flow)
      updateTaskStep(task.id, step.id, { ...result, status: 'done' })
      up({ phase: 'ready' })
      updateTask(task.id, { status: 'done' })
      refreshOpfs()
      log(`Step ${step.id} (${step.type}) OK`, 'ok')
    } catch (err: any) {
      updateTaskStep(task.id, step.id, { output: err.message, status: 'error' })
      updateTask(task.id, { status: 'error' })
      up({ phase: 'ready', streaming: '' })
      flow.set('onToken', null)
      log(`Step ${step.id}: ${err.message}`, 'err')
    }
  }

  const runAll = async () => {
    if (!task) return
    up({ phase: 'running' })
    updateTask(task.id, { status: 'running' })
    for (const step of task.steps) {
      const def = STEP_DEFS[step.type]
      if (def.needsInput && !step.input.trim()) continue
      await runStep({ ...step })
      if (task.status === 'error') break
      up({ phase: 'running' }) // keep running between steps
    }
    up({ phase: 'ready' })
    updateTask(task.id, { status: 'done' })
  }

  const deleteModel = async (url: string) => {
    await removeModel(url)
    await refreshModels()
    log(`Model removed: ${url.split('/').pop()}`, 'ok')
  }

  return {
    s, up, busy, task, presets,
    createTask, activateTask, removeTask,
    loadFile, loadText,
    updateTaskStep, runStep, runAll, configureMod,
    models, deleteModel, refreshModels,
    opfsFiles, refreshOpfs,
    getModules: () => flow.modules(),
    getChunks: (): { text: string; page: number }[] => flow.get('chunks') ?? [],
    getVars: (): [string, any][] =>
      Object.entries(flow.vars).filter(([, v]) => v != null && typeof v !== 'function' && !(v instanceof File) && !(v instanceof Blob)),
  }
}
