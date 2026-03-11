import { useState, useCallback, useEffect, useRef, type DragEvent } from 'react'
import {
  ReactFlow, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection,
} from '@xyflow/react'
import { opfs } from './store'
import { TEMPLATES, BIELIK } from './templates'
import { nodeTypes } from './nodes'
import {
  blockUpload, blockParse, blockEmbed,
  blockExtract, blockExtractApi, blockGraph,
  type Chunk, type Log,
} from './blocks'

const PALETTE = [
  { type: 'upload', label: 'Upload', icon: '↑', config: {} },
  { type: 'parse', label: 'Parse', icon: '¶', config: { language: 'pol' } },
  { type: 'embed', label: 'Embed', icon: '◈', config: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' } },
  { type: 'extract', label: 'Extract', icon: '⊕', config: { questions: '', topK: '2', modelUrl: BIELIK } },
  { type: 'extract-api', label: 'ExtractAPI', icon: '⊛', config: { questions: '', topK: '2', apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: '', apiModel: 'gpt-4o-mini' } },
  { type: 'graph', label: 'Graph', icon: '◇', config: {} },
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

  // --- project ---

  async function createProject() {
    const name = newName.trim()
    if (!name) return
    await opfs.createProject(name)
    setProjects(p => [...p, name])
    setProject(name)
    setNewName('')
    setNodes([]); setEdges([]); setLog([])
  }

  function loadTemplate(id: string) {
    const tpl = TEMPLATES.find(t => t.id === id)
    if (!tpl || !project) return
    const n = tpl.nodes.map(n => ({ ...n, data: { ...n.data, config: { ...(n.data.config as any || {}) } } }))
    const e = [...tpl.edges]
    setNodes(n); setEdges(e)
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }

  // --- DnD from palette ---

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
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { label: entry.label, config: { ...entry.config } },
    }
    setNodes(n => [...n, newNode])
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
      const id = queue.shift()!
      result.push(id)
      for (const next of adj.get(id) || []) {
        inDeg.set(next, inDeg.get(next)! - 1)
        if (!inDeg.get(next)) queue.push(next)
      }
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

    const newNodes: Node[] = items.map((item, i) => ({
      id: item.id,
      type: 'data',
      position: { x: px, y: py + i * 28 },
      data: { label: item.label, detail: item.detail },
    }))
    const newEdges: Edge[] = items.map(item => ({
      id: `e:${parentId}→${item.id}`,
      source: parentId,
      sourceHandle: right ? 'data' : 'data-left',
      target: item.id,
      targetHandle: right ? 'left' : 'right',
      style: { strokeDasharray: '4 2', stroke: '#d1d5db' },
    }))

    setNodes(n => [...n, ...newNodes])
    setEdges(e => [...e, ...newEdges])
  }

  async function runPipeline() {
    if (!project) { addLog('Wybierz projekt'); return }
    dataNodeSide.current = 0
    setRunning(true)
    setLog([])
    addLog(`=== Projekt: ${project} ===`)

    // clear old data nodes
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
            const chars = ctx.pages.reduce((s: number, p: any) => s + p.text.length, 0)
            setNodeResult(nodeId, 'done', `${ctx.pages.length} stron, ${chars} zn.`)
            addDataNodes(nodeId, ctx.pages.slice(0, 5).map((p: any) => ({
              id: `d:page:${p.page}`, label: `str. ${p.page}`, detail: `${p.text.length} zn.`,
            })))
            break
          }
          case 'embed': {
            const r = await blockEmbed(project, ctx.pages || [], cfg.model, parseInt(cfg.chunkSize) || 200, addLog)
            if (!r) throw new Error('Brak stron do embeddingu')
            ctx.chunks = r.chunks; ctx.embedFn = r.embedFn
            setNodeResult(nodeId, 'done', `${r.chunks.length} chunków po ~${cfg.chunkSize || 200} zn.`)
            addDataNodes(nodeId, r.chunks.slice(0, 6).map((c: Chunk, i: number) => ({
              id: `d:chunk:${i}`, label: `chunk ${i}`, detail: c.text.slice(0, 40) + '...',
            })))
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
            addDataNodes(nodeId, values.map((n: any) => ({
              id: `d:${n.id}`, label: n.label, detail: n.type,
            })))
            break
          }
        }
      } catch (e: any) {
        addLog(`ERROR: ${e.message}`)
        setNodeResult(nodeId, 'error', e.message)
        break
      }
    }
    addLog('--- done ---')
    setRunning(false)
  }

  // --- render ---

  return (
    <div className="h-screen bg-base-200 overflow-hidden text-xs">
      <div className={`flex flex-row h-full transition-transform duration-300 ease-in-out ${leftOpen ? '' : 'max-md:-translate-x-72'}`}>

      {/* === LEFT === */}
      <div className="w-72 shrink-0 flex flex-col bg-base-100 border-r border-base-300 min-h-0">
        <div className="navbar min-h-10 h-10 border-b border-base-300 text-xs font-semibold text-base-content/40">Projekty</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <ul className="menu menu-sm p-0">
            {projects.map(name => (
              <li key={name}><a className={project === name ? 'active' : ''} onClick={() => {
                setProject(name); setLog([])
                const saved = loadPipeline(name)
                if (saved) { setNodes(saved.nodes); setEdges(saved.edges) } else { setNodes([]); setEdges([]) }
                setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
              }}>{name}<button onClick={async (e) => {
                e.stopPropagation(); await opfs.removeProject(name).catch(() => {})
                localStorage.removeItem(`pipeline:${name}`); setProjects(p => p.filter(n => n !== name))
                if (project === name) { setProject(null); setNodes([]); setEdges([]) }
              }} className="btn btn-ghost btn-xs text-error">✕</button></a></li>
            ))}
          </ul>
          <div className="join w-full">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="nowy..." className="input input-bordered input-sm join-item flex-1" />
            <button onClick={createProject} className="btn btn-sm btn-primary join-item">+</button>
          </div>
          {project && <>
            <div role="tablist" className="tabs tabs-bordered">
              <button role="tab" className={`tab ${leftTab === 'templates' ? 'tab-active' : ''}`} onClick={() => setLeftTab('templates')}>Szablony</button>
              <button role="tab" className={`tab ${leftTab === 'blocks' ? 'tab-active' : ''}`} onClick={() => setLeftTab('blocks')}>Bloki</button>
            </div>
            {leftTab === 'templates' ? (
              <div className="space-y-2">{TEMPLATES.map(t => (
                <div key={t.id} className="card card-compact bg-base-200 cursor-pointer hover:bg-base-300"
                  onClick={() => { loadTemplate(t.id); setLeftOpen(false) }}>
                  <div className="card-body"><h3 className="card-title text-sm">{t.name}</h3>
                    <p className="text-[10px] text-base-content/40">{t.nodes.map(n => n.data.label).join(' → ')}</p></div>
                </div>
              ))}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">{PALETTE.map(p => (
                <div key={p.type} draggable onDragStart={e => onDragStart(e, p.type)}
                  className="card card-compact bg-base-200 cursor-grab hover:bg-base-300 items-center py-3">
                  <span className="text-2xl">{p.icon}</span><span className="text-xs font-medium">{p.label}</span>
                </div>
              ))}</div>
            )}
          </>}
        </div>
      </div>

      {/* === CENTER === */}
      <div className="flex-1 max-md:min-w-[100vw] flex flex-col bg-base-100 min-h-0">
        <div className="navbar min-h-10 h-10 px-3 border-b border-base-300">
          <button onClick={() => setLeftOpen(!leftOpen)} className="btn btn-ghost btn-square btn-sm md:hidden">{leftOpen ? '✕' : '☰'}</button>
          <span className="flex-1 text-xs font-black text-primary">OBIEG-ZERO</span>
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
            <div className="flex flex-col max-h-48">
              <div className="navbar min-h-8 h-8 px-3">
                <span className="flex-1 text-xs font-semibold text-base-content/40">
                  {running && <span className="loading loading-spinner loading-xs mr-1" />}Log
                </span>
                {!running && <button onClick={() => setLog([])} className="btn btn-ghost btn-xs">wyczysc</button>}
              </div>
              <pre ref={logRef} className="flex-1 overflow-y-auto px-3 pb-2 text-[11px] font-mono whitespace-pre-wrap break-all text-base-content/60">{log.join('\n')}</pre>
            </div>
          ) : project && (
            <div className="p-2">
              <button onClick={() => { runPipeline(); setLeftOpen(false) }}
                className="btn btn-sm btn-success w-full">Analizuj</button>
            </div>
          )}
        </div>
      </div>

      </div>
      {running && <progress className="progress progress-primary w-full fixed top-0 left-0 z-50 h-1" />}
    </div>
  )
}
