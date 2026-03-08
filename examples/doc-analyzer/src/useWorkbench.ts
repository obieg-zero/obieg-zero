import { useReducer, useEffect, useCallback, useState } from 'react'
import { flow, NODES, TPL_OUTPUT } from './flow.ts'
import { templateNode } from '@obieg-zero/core'
import type { FlowEvent } from '@obieg-zero/core'
import { saveSettings, loadSettings, listModels, removeModel, totalModelSize, type ModelEntry } from '@obieg-zero/storage'
import type { S, Task, Step, Log, Preset } from './types.ts'
import { INIT, STEP_DEFS } from './types.ts'

const TASKS_KEY = 'workbench:tasks'

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

  const log = useCallback((text: string, level: Log['level'] = 'info') => up({ _log: { text, level } }), [])

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
    for (const key of Object.keys(flow.vars)) flow.set(key, null)
    flow.set('projectId', t.projectId)
    if (t.fileName) {
      flow.set('fileKey', t.fileName)
      // Try to restore file from OPFS
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
      status: 'idle',
    }
    for (const key of Object.keys(flow.vars)) flow.set(key, null)
    flow.set('projectId', newTask.projectId)
    up({ tasks: [...s.tasks, newTask], activeTaskId: taskId, nextId: nid, logOpen: true })
    log(`New task: ${p.name}`, 'ok')
  }

  const removeTask = (id: number) => {
    const t = s.tasks.find(t => t.id === id)
    if (t) {
      // Clean up OPFS project
      flow.set('projectId', t.projectId)
      flow.run('opfs-delete-project').catch(() => {})
    }
    const next = s.tasks.filter(t => t.id !== id)
    up({ tasks: next, activeTaskId: s.activeTaskId === id ? (next[0]?.id ?? null) : s.activeTaskId })
  }

  const loadFile = async (file: File) => {
    if (!task) return
    const pid = `task-${task.id}-${file.name}-${file.size}`
    flow.set('file', file)
    flow.set('projectId', pid)
    flow.set('fileKey', file.name)
    updateTask(task.id, { file, fileName: file.name, projectId: pid })
    // Persist to OPFS
    try {
      await flow.run(NODES.UPLOAD)
      log(`File: ${file.name} (${(file.size / 1024).toFixed(0)} KB) → OPFS`, 'ok')
    } catch {
      log(`File: ${file.name} (${(file.size / 1024).toFixed(0)} KB) [OPFS failed]`, 'info')
    }
  }

  const loadText = (text: string) => {
    if (!task || !text.trim()) return
    const pid = `task-${task.id}-paste-${Date.now()}`
    flow.set('pages', [{ page: 1, text }])
    flow.set('projectId', pid)
    const name = `Text (${text.length} chars)`
    const fakeFile = new File([text], 'paste.txt')
    updateTask(task.id, { file: fakeFile, fileName: name, projectId: pid })
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
      if (step.type === 'llm') {
        flow.set('query', step.input)
        flow.set('onToken', (t: string) => up({ streaming: t }))
        if (!flow.get('context')) await flow.run(NODES.SEARCH)
        await flow.run(...def.nodes)
        flow.set('onToken', null)
        up({ streaming: '' })
        // Run extractNode to parse JSON from answer
        await flow.run(NODES.EXTRACT)
        const answer = flow.get('answer') ?? ''
        const extracted = flow.get('extracted')
        const extractError = flow.get('extractError')
        updateTaskStep(task.id, step.id, {
          output: answer, status: 'done',
          meta: [
            `context: ${(flow.get('context') ?? '').length} → prompt: ${(flow.get('prompt') ?? '').length} → answer: ${answer.length} chars`,
            extracted ? `extracted: ${JSON.stringify(extracted).slice(0, 80)}` : null,
            extractError ? `extract: ${extractError}` : null,
          ].filter(Boolean).join(' | '),
        })

      } else if (step.type === 'search') {
        flow.set('query', step.input)
        await flow.run(...def.nodes)
        const matched: any[] = flow.get('matchedChunks') ?? []
        updateTaskStep(task.id, step.id, {
          output: matched.map((c: any, i: number) =>
            `#${i + 1} [page ${c.page}, score ${c.score.toFixed(3)}]\n${c.text.slice(0, 200)}${c.text.length > 200 ? '…' : ''}`
          ).join('\n\n'),
          status: 'done',
          meta: `${matched.length} chunks, scores: ${matched.map((c: any) => c.score.toFixed(3)).join(', ')}`,
        })

      } else if (step.type === 'template') {
        flow.node(NODES.TPL, templateNode({ template: step.input, output: TPL_OUTPUT }))
        await flow.run(NODES.TPL)
        updateTaskStep(task.id, step.id, { output: flow.get(TPL_OUTPUT), status: 'done' })

      } else {
        await flow.run(...def.nodes)
        if (step.type === 'ocr') {
          const pages: any[] = flow.get('pages') ?? []
          const chars = pages.reduce((a: number, p: any) => a + p.text.length, 0)
          updateTaskStep(task.id, step.id, { output: `${pages.length} pages, ${chars} chars`, status: 'done' })
        } else if (step.type === 'embed') {
          const chunks: any[] = flow.get('chunks') ?? []
          updateTaskStep(task.id, step.id, { output: `${chunks.length} chunks embedded`, status: 'done' })
        }
      }

      up({ phase: 'ready' })
      updateTask(task.id, { status: 'done' })
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
    s, up, busy, task,
    createTask, activateTask, removeTask,
    loadFile, loadText,
    updateTaskStep, runStep, runAll, configureMod,
    models, deleteModel, refreshModels,
    getModules: () => flow.modules(),
    getChunks: (): { text: string; page: number }[] => flow.get('chunks') ?? [],
    getVars: (): [string, any][] =>
      Object.entries(flow.vars).filter(([, v]) => v != null && typeof v !== 'function' && !(v instanceof File) && !(v instanceof Blob)),
  }
}
