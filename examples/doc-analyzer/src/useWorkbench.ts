import { useReducer, useEffect, useCallback } from 'react'
import { flow } from './flow.ts'
import { templateNode } from '@obieg-zero/core'
import type { FlowEvent } from '@obieg-zero/core'
import type { S, Step, StepType, Log, Preset } from './types.ts'
import { INIT, STEP_DEFS } from './types.ts'

function ts() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

function reducer(s: S, a: Partial<S> & { _log?: { text: string; level: Log['level'] } }): S {
  const next = { ...s, ...a }
  if (a._log) next.logs = [...s.logs.slice(-199), { t: ts(), ...a._log }]
  return next
}

export function useWorkbench() {
  const [s, up] = useReducer(reducer, INIT)
  const busy = s.phase === 'running'
  const hasFile = !!s.file

  const log = useCallback((text: string, level: Log['level'] = 'info') => up({ _log: { text, level } }), [])

  useEffect(() => {
    return flow.on((e: FlowEvent) => {
      if (e.type === 'node:start') log(`▶ ${e.id}`, 'info')
      if (e.type === 'node:done') log(`✓ ${e.id}`, 'ok')
      if (e.type === 'node:error') log(`✕ ${e.id}: ${e.error}`, 'err')
      if (e.type === 'progress') {
        log(`  ${e.id}: ${e.status}`, 'dim')
        if (e.pct != null) up({ pct: e.pct })
      }
    })
  }, [])

  const loadFile = (file: File) => {
    flow.set('file', file)
    flow.set('projectId', 'demo')
    flow.set('fileKey', 'doc')
    up({ file, fileName: file.name, logOpen: true })
    log(`File: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`, 'ok')
  }

  const loadText = (text: string) => {
    if (!text.trim()) return
    flow.set('pages', [{ page: 1, text }])
    flow.set('projectId', 'demo-paste')
    const name = `Text (${text.length} chars)`
    up({ file: new File([text], 'paste.txt'), fileName: name, logOpen: true })
    log(`Text: ${text.length} chars`, 'ok')
  }

  const addStep = (type: StepType) => {
    up({
      steps: [...s.steps, { id: s.nextId, type, input: '', output: '', status: 'idle' }],
      nextId: s.nextId + 1,
    })
  }

  const updateStep = (id: number, patch: Partial<Step>) =>
    up({ steps: s.steps.map(st => st.id === id ? { ...st, ...patch } : st) })

  const removeStep = (id: number) => up({ steps: s.steps.filter(st => st.id !== id) })

  const loadPreset = (p: Preset) => {
    let nid = s.nextId
    const steps: Step[] = p.steps.map(ps => ({
      id: nid++, type: ps.type, input: ps.input, output: '', status: 'idle' as const,
    }))
    up({ steps, nextId: nid })
  }

  // Module settings — one path: flow.configure() rebuilds nodes
  const configureMod = (moduleId: string, key: string, value: any) => {
    flow.configure(moduleId, { [key]: value })
    up({}) // trigger re-render
  }

  const runStep = async (step: Step) => {
    const def = STEP_DEFS[step.type]
    if (def.needsInput && !step.input.trim()) return

    up({ phase: 'running', steps: s.steps.map(st => st.id === step.id ? { ...st, status: 'running', output: '' } : st) })

    try {
      if (step.type === 'llm') {
        flow.set('query', step.input)
        flow.set('onToken', (t: string) => up({ streaming: t }))
        if (!flow.get('context')) await flow.run('search')
        await flow.run(...def.nodes)
        flow.set('onToken', null)
        up({ streaming: '' })
        const answer = flow.get('answer') ?? ''
        updateStep(step.id, {
          output: answer, status: 'done',
          meta: `context: ${(flow.get('context') ?? '').length} → prompt: ${(flow.get('prompt') ?? '').length} → answer: ${answer.length} chars`,
        })

      } else if (step.type === 'search') {
        flow.set('query', step.input)
        await flow.run(...def.nodes)
        const matched: any[] = flow.get('matchedChunks') ?? []
        updateStep(step.id, {
          output: matched.map((c: any, i: number) =>
            `#${i + 1} [page ${c.page}, score ${c.score.toFixed(3)}]\n${c.text.slice(0, 200)}${c.text.length > 200 ? '…' : ''}`
          ).join('\n\n'),
          status: 'done',
          meta: `${matched.length} chunks, scores: ${matched.map((c: any) => c.score.toFixed(3)).join(', ')}`,
        })

      } else if (step.type === 'template') {
        flow.node('tpl', templateNode({ template: step.input, output: 'templateResult' }))
        await flow.run('tpl')
        updateStep(step.id, { output: flow.get('templateResult'), status: 'done' })

      } else {
        await flow.run(...def.nodes)
        if (step.type === 'ocr') {
          const pages: any[] = flow.get('pages') ?? []
          const chars = pages.reduce((a: number, p: any) => a + p.text.length, 0)
          updateStep(step.id, { output: `${pages.length} pages, ${chars} chars`, status: 'done' })
        } else if (step.type === 'embed') {
          const chunks: any[] = flow.get('chunks') ?? []
          updateStep(step.id, { output: `${chunks.length} chunks embedded`, status: 'done' })
        }
      }

      up({ phase: 'ready' })
      log(`Step ${step.id} (${step.type}) OK`, 'ok')
    } catch (err: any) {
      updateStep(step.id, { output: err.message, status: 'error' })
      up({ phase: 'ready', streaming: '' })
      flow.set('onToken', null)
      log(`Step ${step.id}: ${err.message}`, 'err')
    }
  }

  const runAll = async () => {
    up({ phase: 'running' })
    for (const step of s.steps) {
      const def = STEP_DEFS[step.type]
      if (def.needsInput && !step.input.trim()) continue
      await runStep({ ...step })
    }
    up({ phase: 'ready' })
  }

  return {
    s, up, busy, hasFile,
    loadFile, loadText,
    addStep, updateStep, removeStep, loadPreset,
    runStep, runAll, configureMod,
    getModules: () => flow.modules(),
    getChunks: (): { text: string; page: number }[] => flow.get('chunks') ?? [],
    getVars: (): [string, any][] =>
      Object.entries(flow.vars).filter(([, v]) => v != null && typeof v !== 'function' && !(v instanceof File) && !(v instanceof Blob)),
  }
}
