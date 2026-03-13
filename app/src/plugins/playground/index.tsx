import { useState, useCallback, useEffect, useRef, createContext, useContext, type DragEvent } from 'react'
import {
  ReactFlow, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection,
} from '@xyflow/react'
import { Layout, Grid, Play, Terminal, Trash2, Upload, FileText, Layers, Cpu, Globe, GitBranch } from 'react-feather'
import type { PluginFactory } from '@obieg-zero/plugin-sdk'
import { doAction, getProvider } from '@obieg-zero/plugin-sdk'
import type { HostAPI } from '@obieg-zero/plugin-sdk'
import { TEMPLATES, BIELIK } from './templates'
import { nodeTypes } from './nodes'
import { blockUpload, blockParse, blockEmbed, blockExtract, blockExtractApi, blockGraph, type Chunk, type Log } from './blocks'
import type { ProjectsAPI } from '../projects'

const PALETTE = [
  { type: 'upload', label: 'Upload', icon: Upload, config: {} },
  { type: 'parse', label: 'Parse', icon: FileText, config: { language: 'pol' } },
  { type: 'embed', label: 'Embed', icon: Layers, config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
  { type: 'extract', label: 'Extract', icon: Cpu, config: { questions: '', topK: '2', modelUrl: BIELIK } },
  { type: 'extract-api', label: 'ExtractAPI', icon: Globe, config: { questions: '', topK: '2', apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: '', apiModel: 'gpt-4o-mini' } },
  { type: 'graph', label: 'Graph', icon: GitBranch, config: {} },
]

const Lbl = ({ children }: { children: React.ReactNode }) => <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium">{children}</div>

// --- Shared state via React Context ---

type State = { nodes: Node[]; edges: Edge[]; project: string | null; log: string[]; running: boolean; leftTab: 'templates' | 'blocks' }
type Actions = {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>; setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  setLog: React.Dispatch<React.SetStateAction<string[]>>; setLeftTab: (t: 'templates' | 'blocks') => void
  addLog: Log; loadTemplate: (id: string) => void; runPipeline: () => void
  onNodesChange: OnNodesChange; onEdgesChange: OnEdgesChange; onConnect: (c: Connection) => void
  onDrop: (e: DragEvent) => void; rfInstance: React.MutableRefObject<any>
}

const Ctx = createContext<{ s: State; a: Actions }>(null!)
const use = () => useContext(Ctx)

let _host: HostAPI

// --- Left sidebar (slot) ---

function LeftSidebar() {
  const { s, a } = use()
  const pApi = getProvider<ProjectsAPI>('projects')!
  const { current: project } = pApi.useProjects()

  return <>
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center h-10 px-3 border-b border-base-300"><Lbl>Projekty</Lbl></div>
      <pApi.ProjectList />

      {project && <>
        <div className="flex items-center h-10 px-3 border-t border-b border-base-300"><Lbl>Schemat</Lbl></div>
        <div className="flex gap-1 mx-2 my-2">
          <button onClick={() => a.setLeftTab?.('templates')} className={`flex items-center h-8 px-3 rounded-md text-xs transition-colors ${s.leftTab === 'templates' ? 'bg-base-200' : 'hover:bg-base-200 text-base-content/50'}`}><Layout size={12} className="mr-2" />Szablony</button>
          <button onClick={() => a.setLeftTab?.('blocks')} className={`flex items-center h-8 px-3 rounded-md text-xs transition-colors ${s.leftTab === 'blocks' ? 'bg-base-200' : 'hover:bg-base-200 text-base-content/50'}`}><Grid size={12} className="mr-2" />Bloki</button>
        </div>
        {s.leftTab === 'templates' ? (
          <div className="mx-2">{TEMPLATES.map(t => (
            <div key={t.id} onClick={() => { a.loadTemplate?.(t.id); doAction('shell:close-left') }}
              className="flex flex-col justify-center px-2 py-3 rounded-md cursor-pointer hover:bg-base-200 transition-colors">
              <div className="text-xs">{t.name}</div>
              <div className="text-2xs text-base-content/30 mt-1">{t.nodes.map(n => n.data.label).join(' → ')}</div>
            </div>))}</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-4">{PALETTE.map(p => {
            const I = p.icon; return (
              <div key={p.type} draggable onDragStart={e => { e.dataTransfer.setData('application/reactflow', p.type); e.dataTransfer.effectAllowed = 'move' }}
                className="flex flex-col items-center justify-center h-16 rounded-md hover:bg-base-200 cursor-grab transition-colors">
                <I size={14} className="text-base-content/50 mb-1" /><span className="text-2xs text-base-content/40">{p.label}</span>
              </div>)
          })}</div>
        )}
      </>}
    </div>
    <div className="border-t border-base-300 px-4 p-3 flex items-center h-[56px]">
      <div className="text-2xs text-base-content/20">Twoje dane nie opuszczają tego urządzenia.</div>
    </div>
  </>
}

// --- Footer (slot) ---

function FooterPanel() {
  const { s, a } = use()
  const logRef = useRef<HTMLPreElement>(null)
  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, [s.log])

  if (!s.project) return null
  return (
    <div className="border-t border-base-300">
      {s.running || s.log?.length > 0 ? (
        <div className="flex flex-col max-h-56">
          <div className="navbar min-h-10 h-10 px-3">
            {s.running && <span className="loading loading-spinner loading-xs text-warning mr-2" />}
            <Terminal size={12} className="text-base-content/25 mr-2" />
            <span className="flex-1 text-2xs font-medium uppercase tracking-wider text-base-content/25">Dziennik</span>
            {!s.running && <button onClick={() => a.setLog?.([])} className="btn btn-ghost btn-xs btn-square"><Trash2 size={12} /></button>}
          </div>
          <pre ref={logRef} className="flex-1 overflow-y-auto px-3 pb-4 font-mono text-2xs whitespace-pre-wrap break-all text-base-content/40 leading-relaxed">{(s.log || []).join('\n')}</pre>
        </div>
      ) : (
        <div className="p-3"><button onClick={() => { a.runPipeline?.(); doAction('shell:close-left') }} disabled={s.running} className="btn btn-primary btn-sm w-full gap-2"><Play size={14} />Analizuj</button></div>
      )}
    </div>
  )
}

// --- Provider (wrapper slot, owns all state) ---

function PlaygroundProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [leftTab, setLeftTab] = useState<'templates' | 'blocks'>('templates')
  const rfInstance = useRef<any>(null)
  const dataNodeSide = useRef(0)
  const host = _host
  const project = getProvider<ProjectsAPI>('projects')!.useProjects().current

  const addLog: Log = useCallback((msg: string) => {
    setLog(p => [...p, `${new Date().toLocaleTimeString()} ${msg}`])
  }, [])

  // Load pipeline when project changes
  useEffect(() => {
    if (!project) { setNodes([]); setEdges([]); return }
    try { const s = JSON.parse(localStorage.getItem(`pipeline:${project}`) || 'null'); s ? (setNodes(s.nodes), setEdges(s.edges)) : (setNodes([]), setEdges([])) } catch { setNodes([]); setEdges([]) }
    setLog([])
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }, [project])

  // Save pipeline
  useEffect(() => {
    if (!project) return
    const pipe = nodes.filter(x => x.type !== 'data'), ids = new Set(pipe.map(x => x.id))
    localStorage.setItem(`pipeline:${project}`, JSON.stringify({ nodes: pipe, edges: edges.filter(x => ids.has(x.source) && ids.has(x.target)) }))
  }, [project, nodes, edges])

  const onNodesChange: OnNodesChange = useCallback(ch => setNodes(n => applyNodeChanges(ch, n)), [])
  const onEdgesChange: OnEdgesChange = useCallback(ch => setEdges(e => applyEdgeChanges(ch, e)), [])
  const onConnect = useCallback((c: Connection) => setEdges(e => addEdge(c, e)), [])

  function loadTemplate(id: string) {
    const t = TEMPLATES.find(t => t.id === id); if (!t || !project) return
    setNodes(t.nodes.map(n => ({ ...n, data: { ...n.data, config: { ...(n.data.config as any || {}) } } }))); setEdges([...t.edges])
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }
  function onDrop(e: DragEvent) {
    e.preventDefault(); const type = e.dataTransfer.getData('application/reactflow')
    if (!type || !rfInstance.current) return; const p = PALETTE.find(p => p.type === type); if (!p) return
    setNodes(n => [...n, { id: `${type}-${Date.now()}`, type, position: rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY }), data: { label: p.label, config: { ...p.config } } }])
  }

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
  function addDataNodes(pid: string, items: { id: string; label: string; detail?: string }[], posRef?: { x: number; y: number }) {
    const right = dataNodeSide.current++ % 2 === 0
    const px = posRef ? posRef.x + (right ? 320 : -280) : 500, py = posRef ? posRef.y - ((items.length - 1) * 14) : 0
    setNodes(n => [...n, ...items.map((it, i) => ({ id: it.id, type: 'data' as const, position: { x: px, y: py + i * 28 }, data: { label: it.label, detail: it.detail } }))])
    setEdges(e => [...e, ...items.map(it => ({ id: `e:${pid}→${it.id}`, source: pid, sourceHandle: right ? 'data' : 'data-left', target: it.id, targetHandle: right ? 'left' : 'right', style: { strokeDasharray: '4 2', strokeWidth: 1, stroke: 'currentColor', opacity: 0.2 } }))])
  }
  function addGraphNodes(pid: string, graph: { nodes: any[]; edges: any[] }, posRef?: { x: number; y: number }) {
    const baseX = posRef ? posRef.x : 500, baseY = posRef ? posRef.y : 0
    const docs = graph.nodes.filter((n: any) => n.type === 'document')
    const values = graph.nodes.filter((n: any) => n.type !== 'document')
    const sharedIds = new Set<string>()
    for (const v of values) {
      const sources = new Set(graph.edges.filter((e: any) => e.to === v.id).map((e: any) => e.from))
      if (sources.size > 1) sharedIds.add(v.id)
    }
    setNodes(n => [...n,
      ...docs.map((d: any, i: number) => ({ id: `g:${d.id}`, type: 'doc' as const, position: { x: baseX - 200, y: baseY + 80 + i * 40 }, data: { label: d.label } })),
      ...values.map((v: any, i: number) => ({ id: `g:${v.id}`, type: 'entity' as const, position: { x: baseX + 280, y: baseY + 80 + i * 36 }, data: { label: v.label, detail: v.type, shared: sharedIds.has(v.id) } })),
    ])
    setEdges(e => [...e, ...graph.edges.map((ge: any) => ({
      id: `g:${ge.id}`, source: `g:${ge.from}`, sourceHandle: 'right', target: `g:${ge.to}`, targetHandle: 'left',
      label: ge.label, style: { strokeWidth: 1, stroke: sharedIds.has(ge.to) ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)' },
      labelStyle: { fontSize: 9, fill: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' },
    }))])
  }

  async function runPipeline() {
    if (!project) return addLog('Wybierz projekt')
    const sorted = topoSort()
    const snap = new Map(nodes.filter(n => n.type !== 'data').map(n => [n.id, { type: n.type!, label: n.data.label as string, config: { ...(n.data.config || {}) } as Record<string, string>, _files: (n.data._files || []) as File[], position: n.position }]))
    dataNodeSide.current = 0; setRunning(true); setLog([]); addLog(`=== ${project} ===`)
    setNodes(n => n.filter(x => x.type !== 'data' && x.type !== 'entity' && x.type !== 'doc')); setEdges(e => e.filter(x => !x.id.startsWith('e:') && !x.id.startsWith('g:')))
    const ctx: Record<string, any> = { project }
    for (const nid of sorted) {
      const nd = snap.get(nid); if (!nd) continue
      const c = nd.config
      setNodeResult(nid, 'running'); addLog(`>>> ${nd.label}`)
      try {
        switch (nd.type) {
          case 'upload': { const f = nd._files; if (!f.length) throw new Error('Brak plikow'); await blockUpload(host, project, f, addLog); setNodeResult(nid, 'done', `${f.length} plikow`); addDataNodes(nid, f.map(f => ({ id: `d:file:${f.name}`, label: f.name })), nd.position); break }
          case 'parse': { ctx.pages = await blockParse(host, project, c.language || 'pol', addLog); setNodeResult(nid, 'done', `${ctx.pages.length} stron`); addDataNodes(nid, ctx.pages.slice(0, 5).map((p: any) => ({ id: `d:p:${p.page}`, label: `str. ${p.page}`, detail: `${p.text.length} zn.` })), nd.position); break }
          case 'embed': { const r = await blockEmbed(host, project, ctx.pages || [], c.model, parseInt(c.chunkSize) || 200, addLog); if (!r) throw new Error('Brak stron'); ctx.chunks = r.chunks; ctx.embedFn = r.embedFn; setNodeResult(nid, 'done', `${r.chunks.length} chunków`); addDataNodes(nid, r.chunks.slice(0, 6).map((ch: Chunk, i: number) => ({ id: `d:c:${i}`, label: `chunk ${i}`, detail: ch.text.slice(0, 40) + '...' })), nd.position); break }
          case 'extract': { const q = c.questions?.split('\n').map((s: string) => s.trim()).filter(Boolean) || []; if (!q.length) throw new Error('Brak pytan'); if (!ctx.chunks?.length) throw new Error('Brak chunków'); const s = await blockExtract(host, ctx.chunks, ctx.embedFn, q, c.modelUrl, parseInt(c.topK) || 2, project, addLog); setNodeResult(nid, 'done', `${s?.extracted || 0}/${s?.total || 0}`); break }
          case 'extract-api': { const q = c.questions?.split('\n').map((s: string) => s.trim()).filter(Boolean) || []; if (!c.apiKey) throw new Error('Brak API Key'); if (!ctx.chunks?.length) throw new Error('Brak chunków'); const s = await blockExtractApi(host, ctx.chunks, ctx.embedFn, q, c.apiUrl || '', c.apiKey, c.apiModel || 'gpt-4o-mini', parseInt(c.topK) || 2, project, addLog); setNodeResult(nid, 'done', `${s?.extracted || 0}/${s?.total || 0}`); break }
          case 'graph': { ctx.graph = await blockGraph(host, project, addLog); setNodeResult(nid, 'done', `${ctx.graph.nodes.length} encji, ${ctx.graph.edges.length} relacji`); addGraphNodes(nid, ctx.graph, nd.position); break }
        }
      } catch (e: any) { addLog(`ERROR: ${e.message}`); setNodeResult(nid, 'error', e.message); break }
    }
    addLog('--- done ---'); setRunning(false)
  }

  const s = { nodes, edges, project, log, running, leftTab }
  const a = { setNodes, setEdges, setLog, setLeftTab, addLog, loadTemplate, runPipeline,
    onNodesChange, onEdgesChange, onConnect, onDrop, rfInstance }

  return <Ctx.Provider value={{ s, a }}>{children}</Ctx.Provider>
}

// --- Center (slot) ---

function CenterCanvas() {
  const { s: { nodes, edges, project, running }, a } = use()

  return <>
    {!project ? (
      <div className="hero flex-1">
        <div className="hero-content text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-black text-primary tracking-tight">OBIEG-ZERO</h1>
            <p className="text-xs text-base-content/50">Analiza dokumentów z&nbsp;Bielikiem — lokalnie, w&nbsp;przeglądarce.</p>
            <p className="text-2xs text-base-content/20">Utwórz projekt w sidebarze i wybierz szablon.</p>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex-1 min-h-0">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={a.onNodesChange} onEdgesChange={a.onEdgesChange}
          onConnect={a.onConnect} onInit={i => { a.rfInstance.current = i }} onDrop={a.onDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
          nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }} />
      </div>
    )}
    {running && <progress className="progress progress-primary w-full fixed top-0 left-0 z-50 h-0.5" />}
  </>
}

// --- Plugin factory ---

const playgroundPlugin: PluginFactory = (deps) => {
  _host = deps.host
  return {
    id: 'playground',
    label: 'Playground',
    description: 'Wizualny potok analizy dokumentów (React Flow)',
    icon: GitBranch,
    requires: ['projects'],
    layout: { wrapper: PlaygroundProvider, left: LeftSidebar, center: CenterCanvas, footer: FooterPanel },
  }
}

export default playgroundPlugin
