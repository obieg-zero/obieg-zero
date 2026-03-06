import { useState } from 'react'
import { registerModule } from '../modules.ts'
import { flow } from '../flow.ts'

function OcrSheet() {
  const pages: any[] = flow.get('pages') ?? []
  const [expanded, setExpanded] = useState<number | null>(null)

  if (!pages.length) return <p className="text-sm text-base-content/40">Brak danych OCR. Wgraj PDF.</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-base-content/40">
        {pages.length} stron, {pages.reduce((s: number, p: any) => s + p.text.length, 0).toLocaleString()} znaków
      </p>
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

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
)

registerModule({
  id: 'ocr',
  label: 'OCR',
  icon: FileIcon,
  type: 'sheet',
  Component: OcrSheet,
})
