import { useState, useCallback, useEffect, useRef, type DragEvent } from 'react'
import {
  ReactFlow, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection,
} from '@xyflow/react'
import { Folder, Plus, Layout, Grid, Play, Terminal, Trash2, X, List, Upload, FileText, Layers, Cpu, Globe, GitBranch, Moon, Sun } from 'react-feather'
import { opfs } from './store'
import { TEMPLATES, BIELIK } from './templates'
import { nodeTypes } from './nodes'
import { blockUpload, blockParse, blockEmbed, blockExtract, blockExtractApi, blockGraph, type Chunk, type Log } from './blocks'

const PALETTE = [
  { type: 'upload', label: 'Upload', icon: Upload, config: {} },
  { type: 'parse', label: 'Parse', icon: FileText, config: { language: 'pol' } },
  { type: 'embed', label: 'Embed', icon: Layers, config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
  { type: 'extract', label: 'Extract', icon: Cpu, config: { questions: '', topK: '2', modelUrl: BIELIK } },
  { type: 'extract-api', label: 'ExtractAPI', icon: Globe, config: { questions: '', topK: '2', apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: '', apiModel: 'gpt-4o-mini' } },
  { type: 'graph', label: 'Graph', icon: GitBranch, config: {} },
]

/* scale: text-2xs(10) → text-xs(12) → text-sm(14=base) | spacing: 2(8) → 3(12) → 4(16) | gap: 2(8) | icons: 12-14 | headers: h-10 px-3 */

const Lbl = ({ children }: { children: React.ReactNode }) => <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium">{children}</div>

export function App() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [project, setProject] = useState<string | null>(null)
  const [projects, setProjects] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [leftOpen, setLeftOpen] = useState(false)
  const [leftTab, setLeftTab] = useState<'templates' | 'blocks'>('templates')
  const [dark, setDark] = useState(true)
  const logRef = useRef<HTMLPreElement>(null)
  const rfInstance = useRef<any>(null)
  const dataNodeSide = useRef(0)

  const addLog: Log = useCallback((msg: string) => {
    setLog(p => [...p, `${new Date().toLocaleTimeString()} ${msg}`])
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 0)
  }, [])

  useEffect(() => { opfs.listProjects().then(setProjects).catch(() => {}) }, [])
  useEffect(() => { if (project) savePipeline(project, nodes, edges) }, [project, nodes, edges])

  function savePipeline(p: string, n: Node[], e: Edge[]) {
    const pipe = n.filter(x => x.type !== 'data'), ids = new Set(pipe.map(x => x.id))
    localStorage.setItem(`pipeline:${p}`, JSON.stringify({ nodes: pipe, edges: e.filter(x => ids.has(x.source) && ids.has(x.target)) }))
  }
  function loadPipeline(p: string): { nodes: Node[]; edges: Edge[] } | null {
    try { return JSON.parse(localStorage.getItem(`pipeline:${p}`) || 'null') } catch { return null }
  }

  const onNodesChange: OnNodesChange = useCallback(ch => setNodes(n => applyNodeChanges(ch, n)), [])
  const onEdgesChange: OnEdgesChange = useCallback(ch => setEdges(e => applyEdgeChanges(ch, e)), [])
  const onConnect = useCallback((c: Connection) => setEdges(e => addEdge(c, e)), [])

  function selectProject(name: string) {
    setProject(name); setLog([])
    const s = loadPipeline(name); s ? (setNodes(s.nodes), setEdges(s.edges)) : (setNodes([]), setEdges([]))
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }
  async function createProject() {
    const name = newName.trim(); if (!name) return
    await opfs.createProject(name); setProjects(p => [...p, name]); setProject(name); setNewName('')
    setNodes([]); setEdges([]); setLog([])
  }
  async function removeProject(name: string) {
    await opfs.removeProject(name).catch(() => {}); localStorage.removeItem(`pipeline:${name}`)
    setProjects(p => p.filter(n => n !== name))
    if (project === name) { setProject(null); setNodes([]); setEdges([]) }
  }
  function loadTemplate(id: string) {
    const t = TEMPLATES.find(t => t.id === id); if (!t || !project) return
    setNodes(t.nodes.map(n => ({ ...n, data: { ...n.data, config: { ...(n.data.config as any || {}) } } }))); setEdges([...t.edges])
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }
  function onDragStart(e: DragEvent, type: string) { e.dataTransfer.setData('application/reactflow', type); e.dataTransfer.effectAllowed = 'move' }
  function onDrop(e: DragEvent) {
    e.preventDefault(); const type = e.dataTransfer.getData('application/reactflow')
    if (!type || !rfInstance.current) return; const p = PALETTE.find(p => p.type === type); if (!p) return
    setNodes(n => [...n, { id: `${type}-${Date.now()}`, type, position: rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY }), data: { label: p.label, config: { ...p.config } } }])
  }

  // --- runner ---
  function topoSort(): string[] {
    const pipe = nodes.filter(n => n.type !== 'data'), ids = new Set(pipe.map(n => n.id))
    const deg = new Map<string, number>(), adj = new Map<string, string[]>()
    for (const n of pipe) { deg.set(n.id, 0); adj.set(n.id, []) }
    for (const e of edges.filter(e => ids.has(e.source) && ids.has(e.target))) { adj.get(e.source)!.push(e.target); deg.set(e.target, (deg.get(e.target) || 0) + 1) }
    const q = [...deg.entries()].filter(([, d]) => d === 0).map(([id]) => id), r: string[] = []
    while (q.length) { const id = q.shift()!; r.push(id); for (const n of adj.get(id) || []) { deg.set(n, deg.get(n)! - 1); if (!deg.get(n)) q.push(n) } }
    return r
  }
  function setNodeResult(id: string, status: string, result?: string) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, status, result: result || n.data.result } } : n))
  }
  function addDataNodes(pid: string, items: { id: string; label: string; detail?: string }[]) {
    const p = nodes.find(n => n.id === pid), right = dataNodeSide.current++ % 2 === 0
    const px = p ? p.position.x + (right ? 320 : -280) : 500, py = p ? p.position.y - ((items.length - 1) * 14) : 0
    setNodes(n => [...n, ...items.map((it, i) => ({ id: it.id, type: 'data' as const, position: { x: px, y: py + i * 28 }, data: { label: it.label, detail: it.detail } }))])
    setEdges(e => [...e, ...items.map(it => ({ id: `e:${pid}→${it.id}`, source: pid, sourceHandle: right ? 'data' : 'data-left', target: it.id, targetHandle: right ? 'left' : 'right', style: { strokeDasharray: '4 2', stroke: '#6b7280' } }))])
  }

  async function runPipeline() {
    if (!project) return addLog('Wybierz projekt')
    dataNodeSide.current = 0; setRunning(true); setLog([]); addLog(`=== ${project} ===`)
    setNodes(n => n.filter(x => x.type !== 'data')); setEdges(e => e.filter(x => !x.id.startsWith('e:') || !x.id.includes('→')))
    const sorted = topoSort(), ctx: Record<string, any> = { project }
    for (const nid of sorted) {
      const node = nodes.find(n => n.id === nid); if (!node || node.type === 'data') continue
      const c = (node.data.config || {}) as Record<string, string>
      setNodeResult(nid, 'running'); addLog(`>>> ${node.data.label}`)
      try {
        switch (node.type) {
          case 'upload': { const f = (node.data._files || []) as File[]; if (!f.length) throw new Error('Brak plikow'); await blockUpload(project, f, addLog); setNodeResult(nid, 'done', `${f.length} plikow`); addDataNodes(nid, f.map(f => ({ id: `d:file:${f.name}`, label: f.name }))); break }
          case 'parse': { ctx.pages = await blockParse(project, c.language || 'pol', addLog); setNodeResult(nid, 'done', `${ctx.pages.length} stron`); addDataNodes(nid, ctx.pages.slice(0, 5).map((p: any) => ({ id: `d:p:${p.page}`, label: `str. ${p.page}`, detail: `${p.text.length} zn.` }))); break }
          case 'embed': { const r = await blockEmbed(project, ctx.pages || [], c.model, parseInt(c.chunkSize) || 200, addLog); if (!r) throw new Error('Brak stron'); ctx.chunks = r.chunks; ctx.embedFn = r.embedFn; setNodeResult(nid, 'done', `${r.chunks.length} chunków`); addDataNodes(nid, r.chunks.slice(0, 6).map((ch: Chunk, i: number) => ({ id: `d:c:${i}`, label: `chunk ${i}`, detail: ch.text.slice(0, 40) + '...' }))); break }
          case 'extract': { const q = c.questions?.split('\n').map((s: string) => s.trim()).filter(Boolean) || []; if (!q.length) throw new Error('Brak pytan'); if (!ctx.chunks?.length) throw new Error('Brak chunków'); const s = await blockExtract(ctx.chunks, ctx.embedFn, q, c.modelUrl, parseInt(c.topK) || 2, project, addLog); setNodeResult(nid, 'done', `${s?.extracted || 0}/${s?.total || 0}`); break }
          case 'extract-api': { const q = c.questions?.split('\n').map((s: string) => s.trim()).filter(Boolean) || []; if (!c.apiKey) throw new Error('Brak API Key'); if (!ctx.chunks?.length) throw new Error('Brak chunków'); const s = await blockExtractApi(ctx.chunks, ctx.embedFn, q, c.apiUrl || '', c.apiKey, c.apiModel || 'gpt-4o-mini', parseInt(c.topK) || 2, project, addLog); setNodeResult(nid, 'done', `${s?.extracted || 0}/${s?.total || 0}`); break }
          case 'graph': { ctx.graph = await blockGraph(project, addLog); setNodeResult(nid, 'done', `${ctx.graph.nodes.length} encji, ${ctx.graph.edges.length} relacji`); addDataNodes(nid, ctx.graph.nodes.filter((n: any) => n.type !== 'document').map((n: any) => ({ id: `d:${n.id}`, label: n.label, detail: n.type }))); break }
        }
      } catch (e: any) { addLog(`ERROR: ${e.message}`); setNodeResult(nid, 'error', e.message); break }
    }
    addLog('--- done ---'); setRunning(false)
  }

  return (
    <div className="h-screen bg-base-200 overflow-hidden text-sm">
      <div className={`flex flex-row h-full transition-transform duration-300 ease-in-out ${leftOpen ? '' : 'max-md:-translate-x-72'}`}>

      {/* LEFT — px-4 py-3 grid, h-8 items, text-xs base */}
      <div className="w-72 shrink-0 flex flex-col bg-base-100 border-r border-base-300 min-h-0">
        <div className="flex items-center h-10 px-4 shrink-0 border-b border-base-300">
          <Folder size={14} className="text-base-content/40 mr-2" />
          <span className="text-xs font-semibold text-base-content/40">Projects</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">

          {/* project list */}
          {projects.length > 0 && <div className="space-y-1">
            <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium mb-2">Active ({projects.length})</div>
            {projects.map(name => (
              <div key={name} onClick={() => { selectProject(name); setLeftOpen(false) }}
                className={`group flex items-center h-8 px-2 rounded-md text-xs cursor-pointer transition-colors ${project === name ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content/70'}`}>
                <span className="truncate flex-1">{name}</span>
                <X size={12} className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-100" onClick={e => { e.stopPropagation(); removeProject(name) }} />
              </div>
            ))}
          </div>}

          {/* new project */}
          <div className="space-y-2">
            <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium">New project</div>
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createProject()}
                placeholder="nazwa..." className="input input-bordered input-sm text-xs flex-1" />
              <button onClick={createProject} className="btn btn-sm btn-primary text-xs"><Plus size={14} /></button>
            </div>
          </div>

          {/* templates / blocks */}
          {project && <div className="space-y-3">
            <div className="border-t border-base-content/5 pt-3" />
            <div className="flex gap-1">
              <button onClick={() => setLeftTab('templates')} className={`flex items-center h-8 px-3 rounded-md text-xs transition-colors ${leftTab === 'templates' ? 'bg-base-200 font-semibold' : 'hover:bg-base-200 text-base-content/50'}`}><Layout size={12} className="mr-2" />Szablony</button>
              <button onClick={() => setLeftTab('blocks')} className={`flex items-center h-8 px-3 rounded-md text-xs transition-colors ${leftTab === 'blocks' ? 'bg-base-200 font-semibold' : 'hover:bg-base-200 text-base-content/50'}`}><Grid size={12} className="mr-2" />Bloki</button>
            </div>
            {leftTab === 'templates' ? (
              <div className="space-y-2">{TEMPLATES.map(t => (
                <div key={t.id} onClick={() => { loadTemplate(t.id); setLeftOpen(false) }}
                  className="flex flex-col justify-center px-2 py-3 rounded-md cursor-pointer hover:bg-base-200 transition-colors">
                  <div className="text-xs font-semibold">{t.name}</div>
                  <div className="text-2xs text-base-content/30 mt-1">{t.nodes.map(n => n.data.label).join(' → ')}</div>
                </div>))}</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">{PALETTE.map(p => {
                const I = p.icon; return (
                  <div key={p.type} draggable onDragStart={e => onDragStart(e, p.type)}
                    className="flex flex-col items-center justify-center h-16 rounded-md hover:bg-base-200 cursor-grab transition-colors">
                    <I size={14} className="text-base-content/50 mb-1" /><span className="text-2xs text-base-content/40">{p.label}</span>
                  </div>)
              })}</div>
            )}
          </div>}
        </div>

        <div className="px-4 py-3 border-t border-base-content/5 space-y-2">
          <a href="https://github.com/obieg-zero" target="_blank" rel="noopener"
            className="flex items-center h-8 px-2 rounded-md text-xs text-base-content/50 hover:bg-base-200 transition-colors"><GitBranch size={12} className="mr-2" />obieg-zero</a>
          <div className="text-2xs text-base-content/20 px-2">Your data never leaves your machine.</div>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 max-md:min-w-[100vw] flex flex-col bg-base-100 min-h-0">
        <div className="navbar min-h-10 h-10 px-3 border-b border-base-300">
          <div className="flex-1 flex items-center">
            <button onClick={() => setLeftOpen(!leftOpen)} className="btn btn-ghost btn-square btn-sm -ml-3 border-r border-base-300 rounded-none md:hidden">{leftOpen ? <X size={16} /> : <List size={16} />}</button>
            <span className="text-xs font-black text-primary ml-2">OBIEG-ZERO</span>
          </div>
          <div className="flex-none flex items-center gap-1">
            {project && <span className="badge badge-ghost badge-sm text-2xs">{project}</span>}
            {log.length > 0 && <button onClick={() => setLog([])} className="btn btn-ghost btn-xs btn-square"><Trash2 size={12} /></button>}
            <button onClick={() => { const d = !dark; document.documentElement.dataset.theme = d ? 'dracula' : 'corporate'; setDark(d) }} className="btn btn-ghost btn-xs btn-square">{dark ? <Sun size={14} /> : <Moon size={14} />}</button>
          </div>
        </div>

        {!project ? (
          <div className="hero flex-1">
            <div className="hero-content text-center">
              <div className="max-w-md space-y-3">
                <h1 className="text-2xl font-black text-primary tracking-tight">OBIEG-ZERO</h1>
                <p className="text-xs text-base-content/50">Upload PDFs. Build pipelines. Extract knowledge. All in your browser.</p>
                <p className="text-2xs text-base-content/20">Create a project from the sidebar.</p>
              </div>
            </div>
          </div>
        ) : (<>
          <div className="flex-1">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onInit={i => { rfInstance.current = i }} onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }} />
          </div>
          <div className="border-t border-base-300">
            {running || log.length > 0 ? (
              <div className="flex flex-col max-h-56">
                <div className="navbar min-h-10 h-10 px-3">
                  {running && <span className="loading loading-spinner loading-xs text-warning mr-2" />}
                  <Terminal size={12} className="text-base-content/25 mr-2" />
                  <span className="flex-1 text-2xs font-medium uppercase tracking-wider text-base-content/25">Log</span>
                  {!running && <button onClick={() => setLog([])} className="btn btn-ghost btn-xs btn-square"><Trash2 size={12} /></button>}
                </div>
                <pre ref={logRef} className="flex-1 overflow-y-auto px-3 pb-4 font-mono text-2xs whitespace-pre-wrap break-all text-base-content/40 leading-relaxed">{log.join('\n')}</pre>
              </div>
            ) : (
              <div className="p-4"><button onClick={() => { runPipeline(); setLeftOpen(false) }} disabled={running} className="btn btn-primary btn-lg w-full gap-2"><Play size={18} />Analizuj</button></div>
            )}
          </div>
        </>)}
      </div>

      </div>
      {running && <progress className="progress progress-primary w-full fixed top-0 left-0 z-50 h-0.5" />}
    </div>
  )
}
