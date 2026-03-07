import { useState } from 'react'
import { registerModule } from '../modules.ts'
import { flow, PIPELINE_QA } from '../flow.ts'

function QaSheet() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)

  const handleAsk = async () => {
    if (!query.trim() || busy) return
    setBusy(true); setAnswer(''); setStreaming('')

    flow.set('query', query)
    flow.set('onToken', (t: string) => setStreaming(t))

    try {
      await flow.run(...PIPELINE_QA)
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
          placeholder="np. Jaka jest kwota?"
          className="input input-bordered input-sm join-item flex-1" disabled={busy} />
        <button onClick={handleAsk} disabled={busy || !query.trim()} className="btn btn-sm btn-primary join-item">Zapytaj</button>
      </div>
      {(streaming || answer) && (
        <div className="bg-base-200 rounded p-3 text-sm whitespace-pre-wrap">
          {streaming || answer}{streaming && <span className="animate-pulse">|</span>}
        </div>
      )}
      <p className="text-[10px] text-base-content/20">Bielik odpowiada na podstawie tekstu OCR</p>
    </div>
  )
}

const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

registerModule({
  id: 'qa',
  label: 'Q&A',
  icon: ChatIcon,
  type: 'sheet',
  Component: QaSheet,
})
