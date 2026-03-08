import { useReducer, useEffect, useCallback } from 'react'
import { flow, PIPELINE_INGEST } from './flow.ts'
import type { FlowEvent } from '@obieg-zero/core'
import type { S, Step, StepType, ChunkConfig, Log, Preset } from './types.ts'
import { INIT } from './types.ts'

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
  const busy = s.phase === 'ingest' || s.phase === 'running'
  const hasDoc = !!s.doc

  const log = useCallback((text: string, level: Log['level'] = 'info') => up({ _log: { text, level } }), [])

  useEffect(() => {
    const unsub = flow.on((e: FlowEvent) => {
      if (e.type === 'node:start') log(`▶ ${e.id}`, 'info')
      if (e.type === 'node:done') log(`✓ ${e.id}`, 'ok')
      if (e.type === 'node:error') log(`✕ ${e.id}: ${e.error}`, 'err')
      if (e.type === 'progress') {
        log(`  ${e.id}: ${e.status}`, 'dim')
        if (e.pct != null) up({ pct: e.pct })
      }
    })
    return unsub
  }, [])

  // --- chunk config ---
  const updateChunkCfg = (patch: Partial<ChunkConfig>) => {
    const next = { ...s.chunkCfg, ...patch }
    up({ chunkCfg: next })
    flow.configure('embed', { chunkSize: next.chunkSize, chunkOverlap: next.chunkOverlap, topK: next.topK })
  }

  const getChunks = (): { text: string; page: number }[] => flow.get('chunks') ?? []

  // --- step mutations ---
  const addStep = (type: StepType, input = '') =>
    up({ steps: [...s.steps, { id: s.nextId, type, input, output: '', status: 'idle' }], nextId: s.nextId + 1 })

  const updateStep = (id: number, patch: Partial<Step>) =>
    up({ steps: s.steps.map(st => st.id === id ? { ...st, ...patch } : st) })

  const removeStep = (id: number) => up({ steps: s.steps.filter(st => st.id !== id) })

  const loadPreset = (p: Preset) => {
    let nid = s.nextId
    up({ steps: p.steps.map(ps => ({ id: nid++, ...ps, output: '', status: 'idle' as const })), nextId: nid })
  }

  // --- ingest ---
  const ingestFile = async (file: File) => {
    up({ phase: 'ingest', pct: 0, logOpen: true })
    log(`Upload: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`)
    flow.set('file', file); flow.set('projectId', 'demo'); flow.set('fileKey', 'doc')
    try {
      await flow.run(...PIPELINE_INGEST)
      const pages: any[] = flow.get('pages') ?? []
      const chunks: any[] = flow.get('chunks') ?? []
      up({ phase: 'ready', doc: { name: file.name, pages: pages.length, chars: pages.reduce((a, p) => a + p.text.length, 0), chunks: chunks.length } })
      log('Dokument gotowy', 'ok')
    } catch (err: any) { log(err.message, 'err'); up({ phase: 'idle' }) }
  }

  const ingestText = async (text: string) => {
    if (!text.trim()) return
    up({ phase: 'ingest', pct: 0, logOpen: true })
    log(`Tekst: ${text.length} zn`)
    flow.set('pages', [{ page: 1, text }]); flow.set('projectId', 'demo-paste')
    try {
      await flow.run('embed', 'save')
      const chunks: any[] = flow.get('chunks') ?? []
      up({ phase: 'ready', doc: { name: `Tekst (${text.length} zn)`, pages: 1, chars: text.length, chunks: chunks.length } })
      log('Tekst gotowy', 'ok')
    } catch (err: any) { log(err.message, 'err'); up({ phase: 'idle' }) }
  }

  const reEmbed = async () => {
    if (!hasDoc) return
    up({ phase: 'ingest', pct: 0 })
    log('Re-embed...')
    try {
      await flow.run('embed', 'save')
      const chunks: any[] = flow.get('chunks') ?? []
      up({ phase: 'ready', doc: { ...s.doc!, chunks: chunks.length } })
      log(`Re-embed: ${chunks.length} chunków`, 'ok')
    } catch (err: any) { log(err.message, 'err'); up({ phase: 'ready' }) }
  }

  // --- run ---
  const runLLMPipeline = async (step: Step) => {
    flow.set('query', step.input)
    flow.set('onToken', (t: string) => up({ streaming: t }))
    await flow.run('search', 'qa-prompt', 'llm')
    flow.set('onToken', null)
    up({ streaming: '' })
    return flow.get('answer') ?? ''
  }

  const runStep = async (step: Step) => {
    if (!step.input.trim()) return
    up({ phase: 'running', steps: s.steps.map(st => st.id === step.id ? { ...st, status: 'running', output: '' } : st) })
    try {
      if (step.type === 'search') {
        flow.set('query', step.input)
        await flow.run('search')
        const matched: any[] = flow.get('matchedChunks') ?? []
        updateStep(step.id, {
          output: flow.get('context') ?? '', status: 'done',
          meta: `${matched.length} fragm., str. ${matched.map(c => c.page).join(', ')} | score: ${matched.map(c => c.score.toFixed(3)).join(', ')}`
        })

      } else if (step.type === 'classify') {
        const answer = await runLLMPipeline(step)
        flow.set('docType', answer.trim())
        updateStep(step.id, { output: answer, status: 'done', meta: `→ $docType = "${answer.trim().slice(0, 50)}"` })

      } else if (step.type === 'extract') {
        const answer = await runLLMPipeline(step)
        const jsonMatch = answer.match(/\{[\s\S]*\}/)
        let output = answer, meta = 'brak JSON — raw output'
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            output = JSON.stringify(parsed, null, 2)
            meta = `→ $extracted (${Object.keys(parsed).length} pól)`
          } catch { /* use raw */ }
        }
        flow.set('extracted', output)
        updateStep(step.id, { output, status: 'done', meta })

      } else if (step.type === 'llm') {
        const answer = await runLLMPipeline(step)
        updateStep(step.id, { output: answer, status: 'done', meta: `context: ${(flow.get('context') ?? '').length} zn` })

      } else if (step.type === 'template') {
        const result = step.input.replace(/\{\{([\w:.]+)\}\}/g, (_, k) => {
          const v = flow.get(k); return v != null ? String(v) : `{{${k}}}`
        })
        updateStep(step.id, { output: result, status: 'done' })
      }

      up({ phase: 'ready' })
      log(`Krok ${step.id} (${step.type}) OK`, 'ok')
    } catch (err: any) {
      updateStep(step.id, { output: err.message, status: 'error' })
      up({ phase: 'ready', streaming: '' }); flow.set('onToken', null)
      log(`Krok ${step.id}: ${err.message}`, 'err')
    }
  }

  const runAll = async () => {
    up({ phase: 'running' })
    for (const step of s.steps) { if (step.input.trim()) await runStep({ ...step }) }
    up({ phase: 'ready' })
  }

  const getVar = (k: string) => flow.get(k)

  return {
    s, up, busy, hasDoc,
    updateChunkCfg, getChunks,
    addStep, updateStep, removeStep, loadPreset,
    ingestFile, ingestText, reEmbed,
    runStep, runAll, getVar,
  }
}
