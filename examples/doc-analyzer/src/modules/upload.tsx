import { useState, useRef, useEffect } from 'react'
import { registerModule } from '../modules.ts'
import { flow } from '../flow.ts'
import { useApp } from '../store.ts'
import type { FlowEvent } from '@obieg-zero/core'

interface StepState {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

const PIPELINE_STEPS = [
  { id: 'upload', label: 'OPFS — zapis pliku' },
  { id: 'ocr', label: 'OCR — rozpoznanie tekstu' },
  { id: 'embed', label: 'Embedding — indeksowanie' },
  { id: 'save', label: 'Persist — zapis do IndexedDB' },
]

function UploadPage() {
  const [steps, setSteps] = useState<StepState[]>([])
  const [pct, setPct] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pages, setPages] = useState<any[] | null>(flow.get('pages') ?? null)
  const [extracted, setExtracted] = useState<any>(flow.get('extracted') ?? null)
  const [llmStatus, setLlmStatus] = useState('')
  const modelUrl = useApp(s => s.modelUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return flow.on((e: FlowEvent) => {
      if (e.type === 'progress') {
        if (e.pct != null) setPct(e.pct)
        setSteps(prev => prev.map(s => s.id === e.id ? { ...s, detail: e.status } : s))
      }
      if (e.type === 'node:start') {
        setSteps(prev => prev.map(s => s.id === e.id ? { ...s, status: 'running' } : s))
      }
      if (e.type === 'node:done') {
        setSteps(prev => prev.map(s => s.id === e.id ? { ...s, status: 'done' } : s))
      }
      if (e.type === 'node:error') {
        setSteps(prev => prev.map(s => s.id === e.id ? { ...s, status: 'error', detail: e.error } : s))
      }
    })
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError('')
    setPct(0)
    setPages(null)
    setExtracted(null)
    setSteps(PIPELINE_STEPS.map(s => ({ ...s, status: 'pending' as const })))

    try {
      flow.set('file', file)
      flow.set('projectId', 'demo')
      flow.set('fileKey', 'doc')

      await flow.run('upload')
      await flow.run('ocr')
      const p = flow.get('pages')
      setPages(p)

      await flow.run('embed')
      await flow.run('save')
    } catch (err: any) {
      setError(err.message)
    }

    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleExtract = async () => {
    if (!pages) return
    setBusy(true)
    setError('')
    setLlmStatus('Ładuję model Bielik (~928 MB, pierwsze uruchomienie)…')

    const unsub = flow.on((e: FlowEvent) => {
      if (e.type === 'progress') setLlmStatus(e.status)
    })

    flow.set('modelUrl', modelUrl)
    flow.set('context', pages.map((p: any) => p.text).join('\n\n').slice(0, 3000))
    try {
      await flow.run('extract-prompt', 'llm', 'parse')
      setExtracted(flow.get('extracted'))
      setLlmStatus('')
    } catch (err: any) {
      setError('LLM: ' + err.message)
      setLlmStatus('')
    }

    unsub()
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload}
        disabled={busy} className="file-input file-input-bordered file-input-sm w-full" />

      {/* pipeline steps */}
      {steps.length > 0 && (
        <div className="bg-base-100 rounded-lg p-4 space-y-1">
          {steps.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-xs py-1">
              <span className={`badge badge-xs ${
                s.status === 'done' ? 'badge-success' :
                s.status === 'running' ? 'badge-primary animate-pulse' :
                s.status === 'error' ? 'badge-error' : 'badge-ghost'
              }`}>
                {s.status === 'done' ? '✓' : s.status === 'running' ? '…' : s.status === 'error' ? '✕' : '·'}
              </span>
              <span className={s.status === 'running' ? 'text-base-content' : 'text-base-content/50'}>{s.label}</span>
              {s.detail && s.status === 'running' && (
                <span className="text-base-content/30 ml-auto">{s.detail}</span>
              )}
            </div>
          ))}
          {busy && <progress className="progress progress-primary w-full h-1 mt-2" value={pct} max={100} />}
        </div>
      )}

      {error && (
        <div className="alert alert-error text-xs">{error}</div>
      )}

      {/* OCR results */}
      {pages && (
        <div className="bg-base-100 rounded-lg p-4 space-y-3">
          <span className="text-sm font-bold">{pages.length} stron rozpoznanych</span>
          <p className="text-xs text-base-content/50">{pages[0]?.text.slice(0, 200)}…</p>

          <button onClick={handleExtract} disabled={busy} className="btn btn-primary btn-sm">
            Wyciągnij dane (Bielik LLM)
          </button>
          <p className="text-[10px] text-base-content/30">Model ~928 MB pobierany przy pierwszym użyciu. Wymaga hostowania GGUF na serwerze.</p>

          {llmStatus && (
            <div className="flex items-center gap-2 text-xs text-base-content/50">
              <span className="loading loading-spinner loading-xs"></span>
              {llmStatus}
            </div>
          )}

          {extracted && (
            <div className="bg-base-200 rounded p-3">
              <div className="text-[10px] text-base-content/30 uppercase tracking-widest mb-1">Wyekstrahowane dane</div>
              <pre className="text-xs">{JSON.stringify(extracted, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* intro */}
      {!pages && !busy && steps.length === 0 && (
        <div className="space-y-6 py-4">
          <div>
            <h2 className="text-lg font-light font-mono">obieg<span className="text-primary">-zero</span></h2>
            <p className="text-xs text-base-content/40 mt-1">Browser-native document flow engine. Zero backend, zero config, zero barrier.</p>
          </div>

          <div className="text-xs text-base-content/50 space-y-2">
            <p>Wrzuć dowolny PDF powyżej. Dokument zostanie przetworzony <strong className="text-base-content/70">lokalnie w przeglądarce</strong>:</p>
            <ul className="space-y-1 ml-4">
              <li><span className="text-success">1.</span> <strong className="text-base-content/70">OPFS</strong> — plik zapisany w przeglądarkowym systemie plików</li>
              <li><span className="text-success">2.</span> <strong className="text-base-content/70">OCR</strong> — tekst wyciągnięty z PDF (pdfjs + Tesseract)</li>
              <li><span className="text-success">3.</span> <strong className="text-base-content/70">Embedding</strong> — fragmenty zaindeksowane wektorowo (multilingual-e5-small)</li>
              <li><span className="text-success">4.</span> <strong className="text-base-content/70">Persist</strong> — wyniki zapisane w IndexedDB</li>
              <li><span className="text-info">5.</span> <strong className="text-base-content/70">Bielik LLM</strong> — ekstrakcja danych / Q&A (opcjonalnie, wymaga modelu GGUF)</li>
            </ul>
            <p>Żadne dane nie opuszczają przeglądarki. Zero API, zero serwera.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/core</span><br/><span className="text-base-content/30">flow engine, templates, extract</span></div>
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/storage</span><br/><span className="text-base-content/30">OPFS + IndexedDB persistence</span></div>
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/ocr</span><br/><span className="text-base-content/30">PDF parsing + Tesseract</span></div>
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/embed</span><br/><span className="text-base-content/30">embeddings + semantic search</span></div>
            <div className="bg-base-100 rounded p-2 col-span-2"><span className="text-primary">@obieg-zero/llm</span> <span className="text-base-content/30">— local LLM via wllama/GGUF (Bielik 1.5B, ~928 MB)</span></div>
          </div>

          <div className="flex gap-2">
            <a href="https://github.com/obieg-zero/obieg-zero" className="btn btn-ghost btn-xs">GitHub</a>
            <a href="https://www.npmjs.com/org/obieg-zero" className="btn btn-ghost btn-xs">npm</a>
            <a href="https://github.com/obieg-zero/obieg-zero/tree/main/examples/doc-analyzer" className="btn btn-ghost btn-xs">Kod tego demo</a>
          </div>
        </div>
      )}
    </div>
  )
}

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
)

registerModule({
  id: 'upload',
  label: 'Dokument',
  icon: UploadIcon,
  type: 'page',
  Component: UploadPage,
})
