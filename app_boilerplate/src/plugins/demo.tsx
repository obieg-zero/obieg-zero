import { useState, useEffect, createContext, useContext } from 'react'
import { Plus, Folder, Upload, FileText, X } from 'react-feather'
import type { PluginFactory } from '@obieg-zero/plugin-sdk'
import { doAction } from '@obieg-zero/plugin-sdk'
import { Box, Cell } from '../components/Box'

type Ctx = { projects: string[]; project: string | null; files: string[]; select: (n: string) => void; create: (n: string) => void; remove: (n: string) => void; upload: (f: File[]) => void }
const DemoCtx = createContext<Ctx | null>(null)
const useDemoCtx = () => { const c = useContext(DemoCtx); if (!c) throw new Error('DemoProvider missing'); return c }

const demoPlugin: PluginFactory = (sdk, deps) => {
  const host = deps.host

  function DemoProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<string[]>([])
    const [project, setProject] = useState<string | null>(null)
    const [files, setFiles] = useState<string[]>([])

    useEffect(() => { host.opfs.listProjects().then(setProjects) }, [])
    useEffect(() => { if (project) host.opfs.listFiles(project).then(setFiles).catch(() => setFiles([])) }, [project])

    async function create(name: string) {
      await host.opfs.createProject(name); setProjects(p => [...p, name]); setProject(name)
    }
    async function remove(name: string) {
      await host.opfs.removeProject(name).catch(() => {}); await host.db.clearProject(name).catch(() => {}); setProjects(p => p.filter(n => n !== name))
      if (project === name) { setProject(null); setFiles([]) }
    }
    async function upload(fileList: File[]) {
      if (!project) return
      for (const f of fileList) await host.opfs.writeFile(project, f.name, f)
      setFiles(await host.opfs.listFiles(project))
    }

    return <DemoCtx.Provider value={{ projects, project, files, select: (n) => { setProject(n); doAction('shell:close-left') }, create, remove, upload }}>{children}</DemoCtx.Provider>
  }

  function LeftPanel() {
    const { projects, project, select, create, remove } = useDemoCtx()
    const [name, setName] = useState('')
    return <Box header={<Cell label>projekty</Cell>} body={<div>
      {projects.map(p => (
        <div key={p} onClick={() => select(p)} className={`group flex items-center h-8 px-2 rounded-md text-xs cursor-pointer ${project === p ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content/70'}`}>
          <Folder size={12} className="mr-2 shrink-0" /><span className="truncate flex-1">{p}</span>
          <X size={12} className="shrink-0 opacity-0 group-hover:opacity-40" onClick={e => { e.stopPropagation(); remove(p) }} />
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { create(name.trim()); setName('') } }}
          placeholder="nowy..." className="input input-bordered input-sm text-xs flex-1" />
        <button onClick={() => { if (name.trim()) { create(name.trim()); setName('') } }} className="btn btn-sm btn-primary"><Plus size={14} /></button>
      </div>
    </div>} />
  }

  function CenterPanel() {
    const { project, files, upload } = useDemoCtx()
    return <>
      {project ? (
        <div className="flex-1 min-h-0 p-3 overflow-y-auto">
          <label className="btn btn-sm btn-primary gap-2 mb-3">
            <Upload size={14} /> dodaj pliki
            <input type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) upload(Array.from(e.target.files)) }} />
          </label>
          {files.length === 0 && <p className="text-2xs text-base-content/30">brak plików — wrzuć PDF, TXT lub CSV</p>}
          {files.map(f => (
            <div key={f} className="flex items-center h-8 px-2 rounded-md hover:bg-base-200 text-xs text-base-content/70">
              <FileText size={12} className="mr-2 shrink-0" />{f}
            </div>
          ))}
        </div>
      ) : (
        <div className="hero flex-1"><div className="hero-content text-center">
          <div className="max-w-sm">
            <h1 className="text-2xl font-black text-primary">DEMO</h1>
            <p className="text-xs text-base-content/50 mt-2">Utwórz projekt, wrzuć pliki. Szyna OPFS + Dexie działa.</p>
          </div>
        </div></div>
      )}
    </>
  }

  function FooterPanel() {
    const { project, files } = useDemoCtx()
    if (!project) return null
    return (
      <div className="h-10 min-h-10 shrink-0 flex items-center border-t border-base-300 divide-x divide-base-300">
        <Cell label><pre className="text-2xs text-base-content/30" data-prefix=">">{files.length} plików w {project}</pre></Cell>
      </div>
    )
  }

  sdk.registerManifest({ id: 'demo', label: 'Demo', description: 'OPFS + Dexie demo — projekty i pliki' })
  sdk.addFilter('shell:actions', (actions: any[]) => [...actions, { pluginId: 'demo', node: <Cell onClick={() => doAction('shell:activate', 'demo')}><Folder size={16} /></Cell> }], 10, 'demo')
  sdk.addFilter('routes', (routes: any[]) => [...routes, {
    path: '/*', pluginId: 'demo',
    layout: { wrapper: DemoProvider, left: LeftPanel, center: CenterPanel, footer: FooterPanel }
  }])
}

export default demoPlugin
