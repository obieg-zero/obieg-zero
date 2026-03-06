import { useState, useEffect } from 'react'
import { modules } from './modules.ts'

// import modules — registration happens on import
import './modules/upload.tsx'
import './modules/ocr-view.tsx'
import './modules/qa.tsx'

function Sheet({ mod, onClose }: { mod: typeof modules[0]; onClose: () => void }) {
  return (
    <div className="drawer drawer-end open">
      <input type="checkbox" className="drawer-toggle" checked readOnly />
      <div className="drawer-side z-50">
        <label className="drawer-overlay" onClick={onClose}></label>
        <div className="bg-base-100 min-h-full w-[480px] max-w-[90vw] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
            <h2 className="text-lg font-bold">{mod.label}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4"><mod.Component /></div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activePageId, setActivePageId] = useState(() => {
    const hash = location.hash.slice(1)
    return modules.find(m => m.type === 'page' && m.id === hash)?.id
      ?? modules.find(m => m.type === 'page')?.id ?? ''
  })
  const [openSheetId, setOpenSheetId] = useState<string | null>(null)

  // hash routing
  useEffect(() => {
    const onHash = () => {
      const id = location.hash.slice(1)
      const mod = modules.find(m => m.type === 'page' && m.id === id)
      if (mod) setActivePageId(mod.id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => { location.hash = activePageId }, [activePageId])

  const pages = modules.filter(m => m.type === 'page')
  const sheets = modules.filter(m => m.type === 'sheet')
  const activePage = pages.find(m => m.id === activePageId)
  const activeSheet = sheets.find(m => m.id === openSheetId)

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="bg-neutral text-neutral-content">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="font-mono font-light text-sm">obieg<span className="text-primary">-zero</span></h1>
          <div className="flex gap-1">
            {pages.map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => setActivePageId(m.id)} title={m.label}
                  className={`btn btn-ghost btn-sm btn-circle ${activePageId === m.id ? '' : 'opacity-40'}`}>
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
            {sheets.length > 0 && <div className="divider divider-horizontal mx-0" />}
            {sheets.map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => setOpenSheetId(openSheetId === m.id ? null : m.id)} title={m.label}
                  className={`btn btn-ghost btn-sm btn-circle ${openSheetId === m.id ? '' : 'opacity-40'}`}>
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 flex-1 w-full">
        {activePage && <activePage.Component />}
      </main>

      {activeSheet && <Sheet mod={activeSheet} onClose={() => setOpenSheetId(null)} />}
    </div>
  )
}
