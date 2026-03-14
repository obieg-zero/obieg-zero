import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { Plus, Trash2, FileText } from 'react-feather'
import { doAction, type PluginFactory } from '@obieg-zero/plugin-sdk'
import { Box, Cell, Bar, ListItem } from '../themes'

const DOC_ID = '__notes__'
const PROJ_ID = '__notes__'

type Note = { id: string; title: string; text: string; ts: number }
type Ctx = { notes: Note[]; active: Note | null; select: (n: Note) => void; create: () => void; remove: (id: string) => void; update: (n: Note) => void }
const NotesCtx = createContext<Ctx | null>(null)
const useNotesCtx = () => { const c = useContext(NotesCtx); if (!c) throw new Error('NotesProvider missing'); return c }

function toNote(r: { id: string; page: number; text: string }): Note {
  return { id: r.id, title: r.text?.split('\n')[0] || 'bez tytułu', text: r.text || '', ts: r.page }
}
function toPage(n: Note) {
  return { id: n.id, projectId: PROJ_ID, documentId: DOC_ID, page: n.ts, text: n.text }
}

const notesPlugin: PluginFactory = (deps) => {
  const host = deps.host

  function NotesProvider({ children }: { children: React.ReactNode }) {
    const [notes, setNotes] = useState<Note[]>([])
    const [active, setActive] = useState<Note | null>(null)
    const db = host.db
    const saveTimer = useRef(0)

    useEffect(() => { db.getPages(DOC_ID).then((rows: any[]) => setNotes(rows.map(toNote))) }, [])

    const persist = useCallback((list: Note[]) => {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(async () => {
        await db.clearProject(PROJ_ID)
        await db.setPages(list.map(toPage))
      }, 500)
    }, [])

    function create() {
      const n: Note = { id: `n-${Date.now()}`, title: 'Nowa notatka', text: '', ts: Date.now() }
      const list = [n, ...notes]; setNotes(list); persist(list); setActive(n); doAction('shell:close-left')
    }
    function remove(id: string) {
      const list = notes.filter(n => n.id !== id); setNotes(list); persist(list)
      if (active?.id === id) setActive(null)
    }
    function update(n: Note) {
      const updated = { ...n, title: n.text.split('\n')[0] || 'bez tytułu' }
      const list = notes.map(x => x.id === n.id ? updated : x); setNotes(list); persist(list); setActive(updated)
    }
    function select(n: Note) { setActive(n); doAction('shell:close-left') }

    return <NotesCtx.Provider value={{ notes, active, select, create, remove, update }}>{children}</NotesCtx.Provider>
  }

  function LeftPanel() {
    const { notes, active, select, create, remove } = useNotesCtx()
    return <Box header={<>
      <Cell label>notatki ({notes.length})</Cell>
      <Cell onClick={create}><Plus size={16} /></Cell>
    </>} body={<div>
      {notes.map(n => (
        <ListItem key={n.id} label={n.title} active={active?.id === n.id} onClick={() => select(n)} action={{ icon: Trash2, onClick: () => remove(n.id) }} />
      ))}
    </div>} />
  }

  function CenterPanel() {
    const { active, update } = useNotesCtx()
    return <>
      {active ? (
        <textarea className="flex-1 min-h-0 p-3 bg-transparent text-xs text-base-content/70 resize-none outline-none"
          value={active.text} onChange={e => update({ ...active, text: e.target.value })}
          placeholder="pisz..." />
      ) : (
        <div className="hero flex-1"><div className="hero-content text-center">
          <div className="max-w-sm">
            <h1 className="text-2xl font-black text-primary">NOTATKI</h1>
            <p className="text-xs text-base-content/50 mt-2">Lokalne notatki zapisywane w Dexie.</p>
          </div>
        </div></div>
      )}
    </>
  }

  function FooterPanel() {
    const { active } = useNotesCtx()
    if (!active) return null
    return <Bar><Cell label>{active.text.length} zn.</Cell></Bar>
  }

  return {
    id: 'notes',
    label: 'Notatki',
    description: 'Lokalne notatki w Dexie',
    icon: FileText,
    layout: { wrapper: NotesProvider, left: LeftPanel, center: CenterPanel, footer: FooterPanel },
  }
}

export default notesPlugin
