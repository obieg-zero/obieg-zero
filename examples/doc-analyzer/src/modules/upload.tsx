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
        <div className="text-center py-12 text-base-content/20 text-sm">
          Wrzuć PDF — OPFS · OCR · Embeddings · Bielik — zero backendu.
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
