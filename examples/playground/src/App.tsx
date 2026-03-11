import { useState, useCallback, useEffect, useRef, type DragEvent } from 'react'
import {
  ReactFlow, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection,
} from '@xyflow/react'
import { Folder, Plus, Layout, Grid, Play, Terminal, Trash2, X, List, Upload, FileText, Layers, Cpu, Globe, GitBranch } from 'react-feather'
import { opfs } from './store'
import { TEMPLATES, BIELIK } from './templates'
import { nodeTypes } from './nodes'
import {
  blockUpload, blockParse, blockEmbed,
  blockExtract, blockExtractApi, blockGraph,
  type Chunk, type Log,
} from './blocks'

const PALETTE = [
  { type: 'upload', label: 'Upload', icon: Upload, config: {} },
  { type: 'parse', label: 'Parse', icon: FileText, config: { language: 'pol' } },
  { type: 'embed', label: 'Embed', icon: Layers, config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
  { type: 'extract', label: 'Extract', icon: Cpu, config: { questions: '', topK: '2', modelUrl: BIELIK } },
  { type: 'extract-api', label: 'ExtractAPI', icon: Globe, config: { questions: '', topK: '2', apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: '', apiModel: 'gpt-4o-mini' } },
  { type: 'graph', label: 'Graph', icon: GitBranch, config: {} },
]

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
    const pipe = n.filter(x => x.type !== 'data')
    const pipeIds = new Set(pipe.map(x => x.id))
    const pipeEdges = e.filter(x => pipeIds.has(x.source) && pipeIds.has(x.target))
    localStorage.setItem(`pipeline:${p}`, JSON.stringify({ nodes: pipe, edges: pipeEdges }))
  }
  function loadPipeline(p: string): { nodes: Node[]; edges: Edge[] } | null {
    try { return JSON.parse(localStorage.getItem(`pipeline:${p}`) || 'null') } catch { return null }
  }

  const onNodesChange: OnNodesChange = useCallback(changes => setNodes(n => applyNodeChanges(changes, n)), [])
  const onEdgesChange: OnEdgesChange = useCallback(changes => setEdges(e => applyEdgeChanges(changes, e)), [])
  const onConnect = useCallback((c: Connection) => setEdges(e => addEdge(c, e)), [])

  async function createProject() {
    const name = newName.trim()
    if (!name) return
    await opfs.createProject(name)
    setProjects(p => [...p, name])
    setProject(name)
    setNewName('')
    setNodes([]); setEdges([]); setLog([])
  }

  function selectProject(name: string) {
    setProject(name); setLog([])
    const saved = loadPipeline(name)
    if (saved) { setNodes(saved.nodes); setEdges(saved.edges) } else { setNodes([]); setEdges([]) }
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }

  async function removeProject(name: string) {
    await opfs.removeProject(name).catch(() => {})
    localStorage.removeItem(`pipeline:${name}`)
    setProjects(p => p.filter(n => n !== name))
    if (project === name) { setProject(null); setNodes([]); setEdges([]) }
  }

  function loadTemplate(id: string) {
    const tpl = TEMPLATES.find(t => t.id === id)
    if (!tpl || !project) return
    setNodes(tpl.nodes.map(n => ({ ...n, data: { ...n.data, config: { ...(n.data.config as any || {}) } } })))
    setEdges([...tpl.edges])
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }

  function onDragStart(e: DragEvent, type: string) {
    e.dataTransfer.setData('application/reactflow', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow')
    if (!type || !rfInstance.current) return
    const position = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const entry = PALETTE.find(p => p.type === type)
    if (!entry) return
    setNodes(n => [...n, {
      id: `${type}-${Date.now()}`, type, position,
      data: { label: entry.label, config: { ...entry.config } },
    }])
  }

  // --- runner ---

  function topoSort(): string[] {
    const pipeNodes = nodes.filter(n => n.type !== 'data')
    const pipeIds = new Set(pipeNodes.map(n => n.id))
    const inDeg = new Map<string, number>()
    const adj = new Map<string, string[]>()
    for (const n of pipeNodes) { inDeg.set(n.id, 0); adj.set(n.id, []) }
    for (const e of edges.filter(e => pipeIds.has(e.source) && pipeIds.has(e.target))) { adj.get(e.source)!.push(e.target); inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1) }
    const queue = [...inDeg.entries()].filter(([, d]) => d === 0).map(([id]) => id)
    const result: string[] = []
    while (queue.length) {
      const id = queue.shift()!; result.push(id)
      for (const next of adj.get(id) || []) { inDeg.set(next, inDeg.get(next)! - 1); if (!inDeg.get(next)) queue.push(next) }
    }
    return result
  }

  function setNodeResult(id: string, status: string, result?: string) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, status, result: result || n.data.result } } : n))
  }

  function addDataNodes(parentId: string, items: { id: string; label: string; detail?: string }[]) {
    const parent = nodes.find(n => n.id === parentId)
    const right = dataNodeSide.current++ % 2 === 0
    const px = parent ? parent.position.x + (right ? 200 : -180) : 500
    const py = parent ? parent.position.y - ((items.length - 1) * 14) : 0
    setNodes(n => [...n, ...items.map((item, i) => ({
      id: item.id, type: 'data' as const, position: { x: px, y: py + i * 28 },
      data: { label: item.label, detail: item.detail },
    }))])
    setEdges(e => [...e, ...items.map(item => ({
      id: `e:${parentId}→${item.id}`, source: parentId,
      sourceHandle: right ? 'data' : 'data-left', target: item.id,
      targetHandle: right ? 'left' : 'right',
      style: { strokeDasharray: '4 2', stroke: '#d1d5db' },
    }))])
  }

  async function runPipeline() {
    if (!project) { addLog('Wybierz projekt'); return }
    dataNodeSide.current = 0; setRunning(true); setLog([])
    addLog(`=== Projekt: ${project} ===`)
    setNodes(n => n.filter(x => x.type !== 'data'))
    setEdges(e => e.filter(x => !x.id.startsWith('e:') || !x.id.includes('→')))

    const sorted = topoSort()
    const ctx: Record<string, any> = { project }

    for (const nodeId of sorted) {
      const node = nodes.find(n => n.id === nodeId)
      if (!node || node.type === 'data') continue
      const cfg = (node.data.config || {}) as Record<string, string>
      setNodeResult(nodeId, 'running')
      addLog(`>>> ${node.data.label}`)

      try {
        switch (node.type) {
          case 'upload': {
            const files = (node.data._files || []) as File[]
            if (!files.length) throw new Error('Brak plikow — kliknij "+ pliki"')
            await blockUpload(project, files, addLog)
            setNodeResult(nodeId, 'done', `${files.length} plikow: ${files.map(f => f.name).join(', ')}`)
            addDataNodes(nodeId, files.map(f => ({ id: `d:file:${f.name}`, label: f.name })))
            break
          }
          case 'parse': {
            ctx.pages = await blockParse(project, cfg.language || 'pol', addLog)
            setNodeResult(nodeId, 'done', `${ctx.pages.length} stron, ${ctx.pages.reduce((s: number, p: any) => s + p.text.length, 0)} zn.`)
            addDataNodes(nodeId, ctx.pages.slice(0, 5).map((p: any) => ({ id: `d:page:${p.page}`, label: `str. ${p.page}`, detail: `${p.text.length} zn.` })))
            break
          }
          case 'embed': {
            const r = await blockEmbed(project, ctx.pages || [], cfg.model, parseInt(cfg.chunkSize) || 200, addLog)
            if (!r) throw new Error('Brak stron do embeddingu')
            ctx.chunks = r.chunks; ctx.embedFn = r.embedFn
            setNodeResult(nodeId, 'done', `${r.chunks.length} chunków po ~${cfg.chunkSize || 200} zn.`)
            addDataNodes(nodeId, r.chunks.slice(0, 6).map((c: Chunk, i: number) => ({ id: `d:chunk:${i}`, label: `chunk ${i}`, detail: c.text.slice(0, 40) + '...' })))
            break
          }
          case 'extract': {
            const q = cfg.questions?.split('\n').map((s: string) => s.trim()).filter((s: string) => s) || []
            if (!q.length) throw new Error('Brak pytan — otworz config')
            if (!ctx.chunks?.length) throw new Error('Brak chunków — dodaj Embed')
            const stats = await blockExtract(ctx.chunks, ctx.embedFn, q, cfg.modelUrl, parseInt(cfg.topK) || 2, project, addLog)
            setNodeResult(nodeId, 'done', `${stats?.extracted || 0}/${stats?.total || 0} odpowiedzi`)
            break
          }
          case 'extract-api': {
            const q = cfg.questions?.split('\n').map((s: string) => s.trim()).filter((s: string) => s) || []
            if (!cfg.apiKey) throw new Error('Brak API Key — otworz config')
            if (!ctx.chunks?.length) throw new Error('Brak chunków — dodaj Embed')
            const stats = await blockExtractApi(ctx.chunks, ctx.embedFn, q, cfg.apiUrl || '', cfg.apiKey, cfg.apiModel || 'gpt-4o-mini', parseInt(cfg.topK) || 2, project, addLog)
            setNodeResult(nodeId, 'done', `${stats?.extracted || 0}/${stats?.total || 0} odpowiedzi`)
            break
          }
          case 'graph': {
            ctx.graph = await blockGraph(project, addLog)
            const values = ctx.graph.nodes.filter((n: any) => n.type !== 'document')
            setNodeResult(nodeId, 'done', `${ctx.graph.nodes.length} encji, ${ctx.graph.edges.length} relacji`)
            addDataNodes(nodeId, values.map((n: any) => ({ id: `d:${n.id}`, label: n.label, detail: n.type })))
            break
          }
        }
      } catch (e: any) {
        addLog(`ERROR: ${e.message}`)
        setNodeResult(nodeId, 'error', e.message)
        break
      }
    }
    addLog('--- done ---'); setRunning(false)
  }

  // --- render ---

  return (
    <div className="h-screen bg-base-200 overflow-hidden text-sm">
      <div className={`flex flex-row h-full transition-transform duration-300 ease-in-out ${leftOpen ? '' : 'max-md:-translate-x-72'}`}>

      {/* === LEFT === */}
      <div className="w-72 shrink-0 flex flex-col bg-base-100 border-r border-base-300 min-h-0">
        <div className="flex items-center gap-1.5 px-4 h-12 shrink-0 border-b border-base-300">
          <Folder size={14} className="text-base-content/40" />
          <span className="text-xs font-semibold uppercase tracking-wider text-base-content/40">Projekty</span>
          <span className="text-2xs text-base-content/20">{projects.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* project list */}
          <div className="space-y-1">
            {projects.map(name => (
              <button key={name} onClick={() => { selectProject(name); setLeftOpen(false) }}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${project === name ? 'bg-primary/10 border border-primary/20' : 'hover:bg-base-200'}`}>
                <div className="flex items-center gap-2">
                  <Folder size={12} className={project === name ? 'text-primary' : 'text-base-content/30'} />
                  <span className={`flex-1 truncate ${project === name ? 'font-semibold text-primary' : ''}`}>{name}</span>
                  <button onClick={e => { e.stopPropagation(); removeProject(name) }}
                    className="opacity-0 group-hover:opacity-100 hover:!opacity-100 text-base-content/20 hover:text-error transition-opacity">
                    <Trash2 size={11} />
                  </button>
                </div>
              </button>
            ))}
          </div>

          {/* new project */}
          <div className="join w-full">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="nowy projekt..." className="input input-bordered input-sm join-item flex-1 text-xs" />
            <button onClick={createProject} className="btn btn-sm btn-primary join-item"><Plus size={14} /></button>
          </div>

          {/* tabs + content */}
          {project && <>
            <div role="tablist" className="tabs tabs-bordered tabs-sm">
              <button role="tab" className={`tab gap-1.5 ${leftTab === 'templates' ? 'tab-active' : ''}`} onClick={() => setLeftTab('templates')}>
                <Layout size={12} />Szablony
              </button>
              <button role="tab" className={`tab gap-1.5 ${leftTab === 'blocks' ? 'tab-active' : ''}`} onClick={() => setLeftTab('blocks')}>
                <Grid size={12} />Bloki
              </button>
            </div>

            {leftTab === 'templates' ? (
              <div className="space-y-2">{TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { loadTemplate(t.id); setLeftOpen(false) }}
                  className="w-full text-left rounded-lg bg-base-200 hover:bg-base-300 p-3 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Play size={12} className="text-primary" />
                    <span className="text-xs font-semibold">{t.name}</span>
                  </div>
                  <p className="text-2xs text-base-content/30 leading-relaxed">{t.nodes.map(n => n.data.label).join(' → ')}</p>
                </button>
              ))}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">{PALETTE.map(p => {
                const Icon = p.icon
                return (
                  <div key={p.type} draggable onDragStart={e => onDragStart(e, p.type)}
                    className="flex flex-col items-center gap-1.5 rounded-lg bg-base-200 hover:bg-base-300 cursor-grab p-3 transition-colors">
                    <Icon size={18} className="text-base-content/50" />
                    <span className="text-2xs font-medium">{p.label}</span>
                  </div>
                )
              })}</div>
            )}
          </>}
        </div>

        {/* left footer */}
        <div className="px-4 py-3 border-t border-base-300">
          <span className="text-2xs text-base-content/20">obieg-zero playground</span>
        </div>
      </div>

      {/* === CENTER === */}
      <div className="flex-1 max-md:min-w-[100vw] flex flex-col bg-base-100 min-h-0">
        <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-base-300">
          <button onClick={() => setLeftOpen(!leftOpen)} className="btn btn-ghost btn-square btn-sm md:hidden -ml-2">
            {leftOpen ? <X size={16} /> : <List size={16} />}
          </button>
          <span className="text-sm font-black tracking-tight text-primary">OBIEG-ZERO</span>
          <span className="flex-1" />
          {project && <span className="text-2xs text-base-content/30">{project}</span>}
        </div>

        <div className="flex-1">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onInit={i => { rfInstance.current = i }} onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }} />
        </div>

        {/* footer: button or logs */}
        <div className="border-t border-base-300">
          {running || log.length > 0 ? (
            <div className="flex flex-col max-h-52">
              <div className="flex items-center gap-1.5 px-4 h-8 shrink-0">
                {running && <span className="loading loading-spinner loading-xs text-primary" />}
                <Terminal size={12} className="text-base-content/30" />
                <span className="flex-1 text-2xs font-medium uppercase tracking-wider text-base-content/30">Log</span>
                {!running && <button onClick={() => setLog([])} className="btn btn-ghost btn-xs gap-1 text-base-content/30">
                  <Trash2 size={10} />wyczysc
                </button>}
              </div>
              <pre ref={logRef} className="flex-1 overflow-y-auto px-4 pb-3 text-2xs font-mono whitespace-pre-wrap break-all text-base-content/50 leading-relaxed">{log.join('\n')}</pre>
            </div>
          ) : project && (
            <div className="p-3">
              <button onClick={() => { runPipeline(); setLeftOpen(false) }}
                className="btn btn-sm btn-primary w-full gap-2">
                <Play size={14} />Analizuj
              </button>
            </div>
          )}
        </div>
      </div>

      </div>
      {running && <progress className="progress progress-primary w-full fixed top-0 left-0 z-50 h-0.5" />}
    </div>
  )
}
