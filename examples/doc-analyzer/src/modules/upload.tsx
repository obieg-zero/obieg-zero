import { useState, useRef, useEffect } from 'react'
import { registerModule } from '../modules.ts'
import { flow } from '../flow.ts'
import type { FlowEvent } from '@obieg-zero/core'

function UploadPage() {
  const [status, setStatus] = useState('')
  const [pct, setPct] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pages, setPages] = useState<any[] | null>(flow.get('pages') ?? null)
  const [extracted, setExtracted] = useState<any>(flow.get('extracted') ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return flow.on((e: FlowEvent) => {
      if (e.type === 'progress') {
        setStatus(e.status)
        if (e.pct != null) setPct(e.pct)
      }
    })
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setStatus(''); setPct(0); setPages(null); setExtracted(null)
    try {
      flow.set('file', file)
      flow.set('projectId', 'demo')
      flow.set('fileKey', 'doc')
      await flow.run('upload')
      await flow.run('ocr')
      setPages(flow.get('pages'))
      await flow.run('embed')
      await flow.run('save')
      setStatus('Dokument przetworzony')
    } catch (err: any) {
      setStatus('Błąd: ' + err.message)
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleExtract = async () => {
    if (!pages) return
    setBusy(true)
    flow.set('context', pages.map((p: any) => p.text).join('\n\n').slice(0, 3000))
    try {
      await flow.run('extract-prompt', 'llm', 'parse')
      setExtracted(flow.get('extracted'))
    } catch (err: any) {
      setStatus('Błąd: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload}
        disabled={busy} className="file-input file-input-bordered file-input-sm w-full" />
      {busy && <progress className="progress progress-primary w-full h-1" value={pct} max={100} />}
      {status && <p className="text-xs text-base-content/50">{status}</p>}

      {pages && (
        <div className="bg-base-100 rounded-lg p-4 space-y-3">
          <span className="text-sm font-bold">{pages.length} stron rozpoznanych</span>
          <p className="text-xs text-base-content/50">{pages[0]?.text.slice(0, 200)}…</p>
          <button onClick={handleExtract} disabled={busy} className="btn btn-primary btn-sm">
            Wyciągnij dane (Bielik)
          </button>
          {extracted && (
            <div className="bg-base-200 rounded p-3">
              <div className="text-[10px] text-base-content/30 uppercase tracking-widest mb-1">Wyekstrahowane</div>
              <pre className="text-xs">{JSON.stringify(extracted, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {!pages && !busy && (
        <div className="space-y-6 py-4">
          <div>
            <h2 className="text-lg font-light font-mono">obieg<span className="text-primary">-zero</span></h2>
            <p className="text-xs text-base-content/40 mt-1">Browser-native document flow engine. Zero backend, zero config, zero barrier.</p>
          </div>

          <div className="text-xs text-base-content/50 space-y-2">
            <p>Wrzuć dowolny PDF powyżej. Dokument zostanie przetworzony <strong className="text-base-content/70">lokalnie w przeglądarce</strong>:</p>
            <ul className="space-y-1 ml-4">
              <li>→ Zapisany w <strong className="text-base-content/70">OPFS</strong> (przeglądarkowy system plików)</li>
              <li>→ Rozpoznany przez <strong className="text-base-content/70">OCR</strong> (pdfjs + Tesseract)</li>
              <li>→ Zaindeksowany <strong className="text-base-content/70">embeddingami</strong> (multilingual-e5-small)</li>
              <li>→ Analizowany przez <strong className="text-base-content/70">Bielik 1.5B</strong> — polski LLM działający w WebAssembly</li>
            </ul>
            <p>Żadne dane nie opuszczają przeglądarki. Zero API, zero serwera.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/core</span><br/><span className="text-base-content/30">flow engine, templates, extract</span></div>
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/storage</span><br/><span className="text-base-content/30">OPFS + IndexedDB persistence</span></div>
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/ocr</span><br/><span className="text-base-content/30">PDF parsing + Tesseract</span></div>
            <div className="bg-base-100 rounded p-2"><span className="text-primary">@obieg-zero/embed</span><br/><span className="text-base-content/30">embeddings + semantic search</span></div>
            <div className="bg-base-100 rounded p-2 col-span-2"><span className="text-primary">@obieg-zero/llm</span> <span className="text-base-content/30">— local LLM via wllama/GGUF (Bielik 1.5B, ~928 MB, pobierany przy pierwszym użyciu)</span></div>
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

// svg inline — no dependency on lucide
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
