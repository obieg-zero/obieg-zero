import { useReducer, useEffect, useRef, useMemo } from 'react'
import { flow, PIPELINE_INGEST, FIELD_MAP, CLASSIFY_QUERIES } from './flow.ts'
import type { FlowEvent } from '@obieg-zero/core'

type Log = { t: string; text: string; level: 'info' | 'ok' | 'err' | 'dim' }
type Phase = 'idle' | 'ingest' | 'ready' | 'analyzing' | 'done' | 'error'
type FieldResult = { field: string; text: string; page: number; score: number }

interface S {
  logs: Log[]
  pct: number
  phase: Phase
  docType: string
  docScore: number
  fields: FieldResult[]
  doc: { pages: number; chars: number; chunks: number } | null
}

const init: S = { logs: [], pct: 0, phase: 'idle', docType: '', docScore: 0, fields: [], doc: null }

function ts() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

function reducer(s: S, a: Partial<S> & { _log?: { text: string; level: Log['level'] } }): S {
  const next = { ...s, ...a }
  if (a._log) next.logs = [...s.logs.slice(-199), { t: ts(), ...a._log }]
  return next
}

const isBusy = (p: Phase) => p === 'ingest' || p === 'analyzing'

async function searchFor(query: string): Promise<{ text: string; page: number; score: number }[]> {
  flow.set('query', query)
  await flow.run('search')
  return (flow.get('matchedChunks') ?? []).map((c: any) => ({ text: c.text, page: c.page, score: c.score }))
}

export default function App() {
  const [s, up] = useReducer(reducer, init)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = isBusy(s.phase)

  const log = (text: string, level: Log['level'] = 'info') => up({ _log: { text, level } })

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, [s.logs])

  useEffect(() => flow.on((e: FlowEvent) => {
    if (e.type === 'node:start') log(`>> ${e.id}`, 'info')
    if (e.type === 'node:done') log(`<< ${e.id} OK`, 'ok')
    if (e.type === 'node:error') log(`!! ${e.id}: ${e.error}`, 'err')
    if (e.type === 'progress') {
      log(`   ${e.id}: ${e.status}`, 'dim')
      if (e.pct != null) up({ pct: e.pct })
    }
  }), [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    up({ ...init, phase: 'ingest' })
    log(`Upload: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`)

    flow.set('file', file)
    flow.set('projectId', 'demo')
    flow.set('fileKey', 'doc')

    try {
      await flow.run(...PIPELINE_INGEST)
      const pages: any[] = flow.get('pages') ?? []
      const chunks: any[] = flow.get('chunks') ?? []
      up({ phase: 'ready', doc: { pages: pages.length, chars: pages.reduce((a, p) => a + p.text.length, 0), chunks: chunks.length } })
      log('INGEST done', 'ok')
    } catch (err: any) {
      log(`INGEST failed: ${err.message}`, 'err')
      up({ phase: 'error' })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleAnalyze = async () => {
    up({ phase: 'analyzing', fields: [], docType: '' })

    // --- Classify by search score ---
    log('--- Klasyfikacja (search) ---', 'info')
    let bestType = 'inne'
    let bestScore = -1

    for (const [type, query] of Object.entries(CLASSIFY_QUERIES)) {
      const results = await searchFor(query)
      const score = results[0]?.score ?? 0
      log(`   ${type}: ${score.toFixed(3)}`, 'dim')
      if (score > bestScore) { bestScore = score; bestType = type }
    }

    log(`Typ: ${bestType} (score: ${bestScore.toFixed(3)})`, 'ok')
    up({ docType: bestType, docScore: bestScore })

    // --- Extract fields by search ---
    log('--- Ekstrakcja pól (search) ---', 'info')
    const fieldDefs = FIELD_MAP[bestType] ?? FIELD_MAP['inne']
    const fields: FieldResult[] = []

    for (const field of fieldDefs) {
      const results = await searchFor(field)
      if (results.length > 0) {
        fields.push({ field, text: results[0].text, page: results[0].page, score: results[0].score })
        log(`   ${field}: p.${results[0].page} (${results[0].score.toFixed(3)})`, 'ok')
      } else {
        log(`   ${field}: brak`, 'dim')
      }
    }

    up({ fields, phase: 'done' })
    log(`Done: ${fields.length}/${fieldDefs.length} pól znalezionych`, 'ok')
  }

  const colors: Record<string, string> = { info: 'text-sky-400', ok: 'text-emerald-400', err: 'text-red-400', dim: 'text-gray-500' }

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <h1 className="font-mono text-lg font-light">obieg<span className="text-primary">-zero</span> <span className="text-base-content/30 text-sm">playground</span></h1>
          <a href="https://github.com/obieg-zero/obieg-zero" target="_blank" rel="noopener" className="btn btn-ghost btn-xs">GitHub</a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            <div className="bg-base-100 rounded-lg p-4 space-y-2">
              <div className="text-xs text-base-content/40 uppercase tracking-widest">1. Upload PDF</div>
              <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload} disabled={busy}
                className="file-input file-input-bordered file-input-sm w-full" />
              {s.phase === 'ingest' && <progress className="progress progress-primary w-full h-1" value={s.pct} max={100} />}
            </div>

            {s.doc && (
              <div className="bg-base-100 rounded-lg p-4 text-sm">
                <span className="font-bold">{s.doc.pages}</span> stron, <span className="font-bold">{s.doc.chars.toLocaleString()}</span> znaków, <span className="font-bold">{s.doc.chunks}</span> chunków
              </div>
            )}

            {s.phase === 'ready' && (
              <div className="bg-base-100 rounded-lg p-4 space-y-2">
                <div className="text-xs text-base-content/40 uppercase tracking-widest">2. Analyze</div>
                <button onClick={handleAnalyze} className="btn btn-primary btn-sm w-full">Analizuj dokument</button>
                <p className="text-[10px] text-base-content/30">Klasyfikacja + ekstrakcja przez semantic search. Bez LLM — instant.</p>
              </div>
            )}

            {s.phase === 'analyzing' && (
              <div className="text-xs text-primary animate-pulse px-1">Analizuję...</div>
            )}

            {s.phase === 'idle' && (
              <div className="bg-base-100 rounded-lg p-4 text-xs text-base-content/50 space-y-1">
                <ol className="list-decimal ml-4 space-y-1">
                  <li><strong>Upload</strong> — OPFS + OCR + Embed</li>
                  <li><strong>Klasyfikacja</strong> — search score per typ dokumentu</li>
                  <li><strong>Ekstrakcja</strong> — search per pole → trafiony fragment</li>
                </ol>
                <p className="text-base-content/30">Wszystko w przegladarce. Zero backendu. Zero LLM.</p>
              </div>
            )}
          </div>

          {/* CENTER */}
          <div className="space-y-3">
            {s.phase === 'idle' && <div className="text-center text-base-content/20 py-20 text-sm">Wrzuc PDF aby rozpoczac</div>}

            {s.docType && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-1">
                <div className="text-xs text-primary uppercase tracking-widest">Typ dokumentu</div>
                <div className="text-lg font-bold">{s.docType}</div>
                <div className="text-[10px] text-base-content/30">confidence: {s.docScore.toFixed(3)}</div>
              </div>
            )}

            {s.fields.map((f, i) => (
              <div key={i} className="bg-base-100 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">{f.field}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-base-content/30">{f.score.toFixed(3)}</span>
                    <span className="badge badge-xs badge-ghost">str. {f.page}</span>
                  </div>
                </div>
                <p className="text-xs text-base-content/60 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>

          {/* RIGHT — log */}
          <div className="bg-gray-900 text-gray-300 rounded-lg flex flex-col" style={{ minHeight: '400px' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Flow Log</span>
              <button onClick={() => up({ logs: [] })} className="btn btn-ghost btn-xs text-gray-500">clear</button>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5" style={{ maxHeight: '70vh' }}>
              {s.logs.length === 0 && <div className="text-gray-600">Wrzuc PDF...</div>}
              {s.logs.map((l, i) => (
                <div key={i} className={colors[l.level]}><span className="text-gray-600">{l.t}</span> {l.text}</div>
              ))}
            </div>
          </div>
        </div>

        <footer className="text-center text-[10px] text-base-content/20 py-2">All processing in browser. No data leaves your machine.</footer>
      </div>
    </div>
  )
}
