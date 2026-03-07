import { useEffect } from 'react'
import { modules } from './modules.ts'
import { useApp } from './store.ts'

// import modules — registration happens on import
import './modules/upload.tsx'
import './modules/ocr-view.tsx'
import './modules/qa.tsx'
import './modules/settings.tsx'

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
  const init = useApp(s => s.init)
  const activePageId = useApp(s => s.activePageId)
  const openSheetId = useApp(s => s.openSheetId)
  const enabledModules = useApp(s => s.enabledModules)
  const setPage = useApp(s => s.setPage)
  const toggleSheet = useApp(s => s.toggleSheet)
  const closeSheet = useApp(s => s.closeSheet)

  useEffect(() => { init() }, [init])
  useEffect(() => {
    const onHash = () => {
      const id = location.hash.slice(1)
      if (modules.find(m => m.type === 'page' && m.id === id)) setPage(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [setPage])

  const pages = modules.filter(m => m.type === 'page' && enabledModules.includes(m.id))
  const sheets = modules.filter(m => m.type === 'sheet' && enabledModules.includes(m.id))
  const activePage = pages.find(m => m.id === activePageId)
  const activeSheet = sheets.find(m => m.id === openSheetId)

  // settings always visible
  const settingsMod = modules.find(m => m.id === 'settings')

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="bg-neutral text-neutral-content">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="font-mono font-light text-sm">obieg<span className="text-primary">-zero</span></h1>
          <div className="flex gap-1">
            {pages.filter(m => m.id !== 'settings').map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => setPage(m.id)} title={m.label}
                  className={`btn btn-ghost btn-sm btn-circle ${activePageId === m.id ? '' : 'opacity-40'}`}>
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
            {sheets.length > 0 && <div className="divider divider-horizontal mx-0" />}
            {sheets.map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => toggleSheet(m.id)} title={m.label}
                  className={`btn btn-ghost btn-sm btn-circle ${openSheetId === m.id ? '' : 'opacity-40'}`}>
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
            {settingsMod && (
              <>
                <div className="divider divider-horizontal mx-0" />
                <button onClick={() => setPage('settings')} title="Ustawienia"
                  className={`btn btn-ghost btn-sm btn-circle ${activePageId === 'settings' ? '' : 'opacity-40'}`}>
                  <settingsMod.icon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 flex-1 w-full">
        {activePage && <activePage.Component />}
      </main>

      {activeSheet && <Sheet mod={activeSheet} onClose={closeSheet} />}

      <footer className="text-center text-xs text-base-content/30 py-4">
        MIT · <a href="https://github.com/obieg-zero/obieg-zero" target="_blank" rel="noopener" className="underline hover:text-base-content/50">GitHub</a>
      </footer>
    </div>
  )
}
