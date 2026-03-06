import { useState, useEffect, useRef } from 'react'
import { flow } from './flow.ts'
import type { FlowEvent } from '@obieg-zero/core'

// ── Sheet (drawer) ──

function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="drawer drawer-end open">
      <input type="checkbox" className="drawer-toggle" checked readOnly />
      <div className="drawer-side z-50">
        <label className="drawer-overlay" onClick={onClose}></label>
        <div className="bg-base-100 min-h-full w-[480px] max-w-[90vw] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── OCR Results Sheet ──

function OcrSheet({ pages }: { pages: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      <p className="text-xs text-base-content/40">{pages.length} stron, {pages.reduce((s: number, p: any) => s + p.text.length, 0).toLocaleString()} znaków</p>
      {pages.map((p: any) => (
        <div key={p.page} className="bg-base-200 rounded p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="badge badge-xs badge-primary">str. {p.page}</span>
            <button onClick={() => setExpanded(expanded === p.page ? null : p.page)} className="btn btn-ghost btn-xs">
              {expanded === p.page ? 'Zwiń' : 'Rozwiń'}
            </button>
          </div>
          <pre className="text-xs text-base-content/60 whitespace-pre-wrap font-sans">
            {expanded === p.page ? p.text : p.text.slice(0, 150) + (p.text.length > 150 ? '…' : '')}
          </pre>
        </div>
      ))}
    </div>
  )
}

// ── Q&A Sheet ──

function QaSheet() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)

  const handleAsk = async () => {
    if (!query.trim() || busy) return
    setBusy(true)
    setAnswer('')
    setStreaming('')

    const pages = flow.get('pages')
    if (pages) {
      flow.set('context', pages.map((p: any) => p.text).join('\n\n').slice(0, 2000))
    }

    flow.set('query', query)
    flow.set('onToken', (t: string) => setStreaming(t))

    try {
      await flow.run('qa-prompt', 'llm')
      setAnswer(flow.get('answer'))
      setStreaming('')
    } catch (err: any) {
      setAnswer('Błąd: ' + err.message)
    }

    flow.set('onToken', null)
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <div className="join w-full">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          placeholder="np. Jaka jest kwota? Kto jest stroną?"
          className="input input-bordered input-sm join-item flex-1" disabled={busy} />
        <button onClick={handleAsk} disabled={busy || !query.trim()} className="btn btn-sm btn-primary join-item">Zapytaj</button>
      </div>
      {(streaming || answer) && (
        <div className="bg-base-200 rounded p-3 text-sm whitespace-pre-wrap">
          {streaming || answer}{streaming && <span className="animate-pulse">|</span>}
        </div>
      )}
      <p className="text-[10px] text-base-content/20">Bielik odpowiada na podstawie tekstu OCR z dokumentu</p>
    </div>
  )
}

// ── Main App ──

export default function App() {
  const [status, setStatus] = useState('')
  const [pct, setPct] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pages, setPages] = useState<any[] | null>(null)
  const [extracted, setExtracted] = useState<any>(null)
  const [sheet, setSheet] = useState<'ocr' | 'qa' | null>(null)
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
    setBusy(true)
    setStatus('')
    setPct(0)
    setPages(null)
    setExtracted(null)

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
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* header */}
      <header className="bg-neutral text-neutral-content">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-mono font-light">obieg<span className="text-primary">-zero</span> <span className="opacity-30 text-sm">doc analyzer</span></h1>
          <div className="flex gap-1">
            {pages && (
              <>
                <button onClick={() => setSheet(sheet === 'ocr' ? null : 'ocr')}
                  className={`btn btn-ghost btn-sm ${sheet === 'ocr' ? '' : 'opacity-40'}`}>OCR</button>
                <button onClick={() => setSheet(sheet === 'qa' ? null : 'qa')}
                  className={`btn btn-ghost btn-sm ${sheet === 'qa' ? '' : 'opacity-40'}`}>Q&A</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* main */}
      <main className="max-w-3xl mx-auto px-6 py-6 flex-1 w-full space-y-4">
        {/* upload */}
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload}
            disabled={busy} className="file-input file-input-bordered file-input-sm w-full" />
          {busy && <progress className="progress progress-primary w-full h-1" value={pct} max={100} />}
          {status && <p className="text-xs text-base-content/50">{status}</p>}
        </div>

        {/* ocr summary */}
        {pages && (
          <div className="bg-base-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{pages.length} stron rozpoznanych</span>
              <button onClick={() => setSheet('ocr')} className="btn btn-ghost btn-xs">Pokaż tekst →</button>
            </div>
            <p className="text-xs text-base-content/50">{pages[0]?.text.slice(0, 200)}…</p>

            {/* extract */}
            <button onClick={handleExtract} disabled={busy} className="btn btn-primary btn-sm">
              Wyciągnij dane (Bielik)
            </button>

            {extracted && (
              <div className="bg-base-200 rounded p-3">
                <div className="text-[10px] text-base-content/30 uppercase tracking-widest mb-1">Wyekstrahowane dane</div>
                <pre className="text-xs">{JSON.stringify(extracted, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {!pages && !busy && (
          <div className="text-center py-12 text-base-content/20 text-sm">
            Wrzuć PDF — zostanie przetworzony lokalnie w przeglądarce.<br />
            OPFS · OCR · Embeddings · Bielik LLM — zero backendu.
          </div>
        )}
      </main>

      <footer className="text-center text-[10px] text-base-content/15 py-4">
        obieg-zero example · wszystko działa w przeglądarce
      </footer>

      {/* sheets */}
      <Sheet open={sheet === 'ocr'} onClose={() => setSheet(null)} title="OCR — tekst dokumentu">
        {pages && <OcrSheet pages={pages} />}
      </Sheet>
      <Sheet open={sheet === 'qa'} onClose={() => setSheet(null)} title="Pytania o dokument">
        <QaSheet />
      </Sheet>
    </div>
  )
}
