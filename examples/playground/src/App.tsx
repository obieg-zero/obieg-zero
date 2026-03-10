import { useState, useRef, useEffect } from 'react'
import type { Block, BlockDef, RunContext } from './blocks'
import { BLOCK_DEFS, BlockCard, opfs } from './blocks'
import { TEMPLATES, type Template } from './templates.ts'

interface Project { name: string; templateId: string; pipeline: Block[] }

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentIdx, setCurrentIdx] = useState<number | null>(null)
  const [opfsFiles, setOpfsFiles] = useState<string[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [rightPanel, setRightPanel] = useState<{ type: string; data: any } | null>(null)
  const ctxRef = useRef<RunContext>({ data: {} })

  const addLog = (msg: string) => setLog(p => [...p, `${new Date().toLocaleTimeString()} ${msg}`])
  const current = currentIdx !== null ? projects[currentIdx] : null

  async function refreshFiles(name: string) {
    try { setOpfsFiles(await opfs.listFiles(name)) } catch { setOpfsFiles([]) }
  }

  useEffect(() => {
    if (current) refreshFiles(current.name)
    else setOpfsFiles([])
  }, [currentIdx])

  function startCreate() { setCreating('') }

  async function finishCreate(template: Template) {
    const name = creating!.trim()
    if (!name) return
    await opfs.createProject(name)
    const pipeline = template.nodes.map((n, i) => ({
      id: `${n.type}-${i}`,
      type: n.type,
      config: { ...n.config, ...(n.config.project !== undefined ? { project: name } : {}) },
    }))
    const proj: Project = { name, templateId: template.id, pipeline }
    setProjects(p => [...p, proj])
    setCurrentIdx(projects.length)
    setCreating(null)
    setRightPanel(null)
    setLog([])
    ctxRef.current = { data: { project: name } }
  }

  function selectProject(idx: number) {
    setCurrentIdx(idx)
    setRightPanel(null)
    setLog([])
    ctxRef.current = { data: { project: projects[idx].name } }
  }

  async function deleteProject(idx: number) {
    const proj = projects[idx]
    await opfs.removeProject(proj.name).catch(() => {})
    setProjects(p => p.filter((_, i) => i !== idx))
    if (currentIdx === idx) setCurrentIdx(null)
    else if (currentIdx !== null && currentIdx > idx) setCurrentIdx(currentIdx - 1)
  }

  function updatePipeline(fn: (p: Block[]) => Block[]) {
    if (currentIdx === null) return
    setProjects(prev => prev.map((proj, i) =>
      i === currentIdx ? { ...proj, pipeline: fn(proj.pipeline) } : proj
    ))
  }

  function addBlock(def: BlockDef) {
    const name = current?.name || 'default'
    updatePipeline(p => [...p, {
      id: `${def.type}-${Date.now()}`,
      type: def.type,
      config: { ...def.defaults, ...(def.defaults.project !== undefined ? { project: name } : {}) },
    }])
  }

  function removeBlock(id: string) { updatePipeline(p => p.filter(b => b.id !== id)) }

  function updateConfig(id: string, key: string, value: string) {
    updatePipeline(p => p.map(b => b.id === id ? { ...b, config: { ...b.config, [key]: value } } : b))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    updatePipeline(p => {
      const i = p.findIndex(b => b.id === id)
      if (i < 0) return p
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function runSingle(block: Block) {
    setRunning(true)
    const ctx = ctxRef.current
    const def = BLOCK_DEFS.find(d => d.type === block.type)
    if (def) {
      addLog(`>>> ${def.label}`)
      try {
        await def.run(block.config, ctx, addLog)
        updateRightPanel(block.type, ctx)
        if (current) refreshFiles(current.name)
      } catch (e: any) { addLog(`ERROR: ${e.message}`) }
    }
    setRunning(false)
  }

  async function runAll() {
    if (!current) return
    setRunning(true)
    setLog([])
    const tpl = TEMPLATES.find(t => t.id === current.templateId)
    addLog(`=== Pipeline: ${tpl?.name || current.templateId} | projekt: ${current.name} ===`)
    const ctx = ctxRef.current
    ctx.data = { project: current.name }
    for (const block of current.pipeline) {
      const def = BLOCK_DEFS.find(d => d.type === block.type)
      if (!def) continue
      addLog(`>>> ${def.label}`)
      try {
        await def.run(block.config, ctx, addLog)
        updateRightPanel(block.type, ctx)
      } catch (e: any) { addLog(`ERROR: ${e.message}`); break }
    }
    refreshFiles(current.name)
    addLog('--- done ---')
    setRunning(false)
  }

  function updateRightPanel(type: string, ctx: RunContext) {
    switch (type) {
      case 'ocr': setRightPanel({ type: 'pages', data: ctx.data.pages || [] }); break
      case 'search': setRightPanel({ type: 'search', data: ctx.data.searchResults || [] }); break
      case 'llm': setRightPanel({ type: 'answer', data: ctx.data.answer || '' }); break
      case 'extract': setRightPanel({ type: 'extract', data: ctx.data.extractStats }); break
      case 'graph': setRightPanel({ type: 'graph', data: ctx.data.graph }); break
      default: setRightPanel({ type: 'info', data: `${type} done` })
    }
  }

  return (
    <div className="grid h-screen font-sans text-sm" style={{ gridTemplateColumns: '220px 300px 1fr', gridTemplateRows: '1fr auto' }}>

      {/* === LEFT === */}
      <div className="border-r border-base-300 overflow-auto p-3 flex flex-col gap-4">

        {/* Projects */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Projekty</h3>
          {projects.map((p, i) => (
            <div key={i} className={`flex gap-1 items-center px-2 py-1 rounded mb-0.5 ${currentIdx === i ? 'bg-primary/10 border border-primary/30' : 'border border-transparent'}`}>
              <span onClick={() => selectProject(i)}
                className={`flex-1 cursor-pointer ${currentIdx === i ? 'font-bold' : ''}`}>{p.name}</span>
              <span className="text-[10px] text-base-content/40">{TEMPLATES.find(t => t.id === p.templateId)?.name}</span>
              <button onClick={() => deleteProject(i)} className="btn btn-xs btn-ghost text-error">x</button>
            </div>
          ))}

          {creating === null ? (
            <button onClick={startCreate} className="btn btn-sm btn-primary w-full mt-1">+ Nowy projekt</button>
          ) : (
            <div className="mt-1 p-2 border-2 border-primary rounded-lg bg-base-200">
              <input value={creating} onChange={e => setCreating(e.target.value)}
                placeholder="Nazwa projektu" autoFocus
                className="input input-bordered input-sm w-full mb-2" />
              {TEMPLATES.map(t => (
                <div key={t.id} onClick={() => finishCreate(t)}
                  className="p-2 rounded cursor-pointer mb-0.5 border border-base-300 bg-base-100 hover:bg-base-200">
                  <div className="font-semibold text-xs">{t.name}</div>
                  <div className="text-[10px] text-base-content/50">{t.description}</div>
                </div>
              ))}
              <button onClick={() => setCreating(null)} className="btn btn-xs btn-ghost mt-1">Anuluj</button>
            </div>
          )}
        </section>

        {/* OPFS files */}
        {current && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">OPFS / {current.name}</h3>
            {opfsFiles.length === 0 && <p className="text-base-content/30 text-xs">Brak plikow — uzyj Upload</p>}
            {opfsFiles.map(f => (
              <div key={f} className="flex items-center gap-1 py-0.5 border-b border-base-200 text-xs">
                <span className="flex-1">{f}</span>
                <button onClick={async () => { await opfs.removeFile(current.name, f); refreshFiles(current.name) }}
                  className="btn btn-xs btn-ghost text-error">x</button>
              </div>
            ))}
          </section>
        )}

        {/* Add block */}
        {current && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Dodaj blok</h3>
            <div className="flex gap-1 flex-wrap">
              {BLOCK_DEFS.map(def => (
                <button key={def.type} onClick={() => addBlock(def)}
                  className="btn btn-xs" style={{ background: def.color + '22', color: def.color, borderColor: def.color + '44' }}>
                  + {def.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* === MIDDLE: Pipeline === */}
      <div className="border-r border-base-300 overflow-auto p-3">
        {!current && <p className="text-base-content/30">Utworz lub wybierz projekt</p>}

        {current && current.pipeline.length === 0 && <p className="text-base-content/30">Dodaj bloki z palety</p>}

        {current && current.pipeline.length > 0 && (
          <button onClick={runAll} disabled={running}
            className={`btn btn-sm w-full mb-3 ${running ? 'btn-disabled' : 'btn-success'}`}>
            {running ? 'Dziala...' : '▶ Uruchom pipeline'}
          </button>
        )}

        {current?.pipeline.map((block, i) => (
          <BlockCard key={block.id} block={block} index={i} total={current.pipeline.length}
            running={running}
            onRemove={() => removeBlock(block.id)}
            onMove={dir => moveBlock(block.id, dir)}
            onConfig={(k, v) => updateConfig(block.id, k, v)}
            onRun={() => runSingle(block)} />
        ))}
      </div>

      {/* === RIGHT: Results === */}
      <div className="overflow-auto p-3">
        {!rightPanel && <p className="text-base-content/30">Uruchom blok aby zobaczyc wyniki</p>}

        {rightPanel?.type === 'pages' && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Strony OCR ({rightPanel.data.length})</h3>
            {rightPanel.data.map((p: any, i: number) => (
              <details key={i} className="collapse collapse-arrow bg-base-200 mb-1">
                <summary className="collapse-title text-xs py-2 min-h-0">Strona {p.page} — {p.text.length} zn.</summary>
                <div className="collapse-content"><pre className="text-xs bg-neutral text-neutral-content p-2 rounded whitespace-pre-wrap break-all">{p.text}</pre></div>
              </details>
            ))}
          </div>
        )}

        {rightPanel?.type === 'search' && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Wyniki ({rightPanel.data.length})</h3>
            {rightPanel.data.map((r: any, i: number) => (
              <div key={i} className="card card-compact bg-base-200 mb-2">
                <div className="card-body p-2">
                  <div className="text-[11px] text-base-content/50">str. {r.page} — score: {r.score.toFixed(4)}</div>
                  <pre className="text-xs bg-neutral text-neutral-content p-2 rounded whitespace-pre-wrap break-all">{r.text}</pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {rightPanel?.type === 'answer' && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Odpowiedz LLM</h3>
            <div className="alert alert-success">{rightPanel.data}</div>
          </div>
        )}

        {rightPanel?.type === 'extract' && rightPanel.data && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Ekstrakcja</h3>
            <p>{rightPanel.data.extracted} faktow wydobytych, {rightPanel.data.failed} bledow, {rightPanel.data.total} chunkow</p>
          </div>
        )}

        {rightPanel?.type === 'graph' && rightPanel.data && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Graf wiedzy ({rightPanel.data.nodes?.length} encji, {rightPanel.data.edges?.length} relacji)</h3>
            {(() => {
              const g = rightPanel.data as { nodes: any[]; edges: any[] }
              const byType = new Map<string, any[]>()
              g.nodes?.forEach((n: any) => { const arr = byType.get(n.type) || []; arr.push(n); byType.set(n.type, arr) })
              return [...byType.entries()].map(([type, nodes]) => (
                <details key={type} className="collapse collapse-arrow bg-base-200 mb-1">
                  <summary className="collapse-title text-sm font-semibold py-2 min-h-0">{type} ({nodes.length})</summary>
                  <div className="collapse-content">
                    {nodes.map((n: any) => (
                      <div key={n.id} className="text-xs pl-3 py-0.5">
                        <strong>{n.label}</strong>{n.data?.value ? `: ${n.data.value}` : ''}
                      </div>
                    ))}
                  </div>
                </details>
              ))
            })()}
          </div>
        )}

        {rightPanel?.type === 'info' && (
          <div><h3 className="text-xs uppercase tracking-wider text-base-content/40 mb-2">Status</h3><p>{rightPanel.data}</p></div>
        )}
      </div>

      {/* === LOG === */}
      {log.length > 0 && (
        <div className="col-span-full border-t border-base-300 max-h-52 overflow-auto p-2">
          <div className="flex gap-2 items-center mb-1">
            <span className="text-xs text-base-content/40">Log ({log.length})</span>
            <button onClick={() => setLog([])} className="btn btn-xs btn-ghost">wyczysc</button>
          </div>
          <pre className="text-xs bg-neutral text-neutral-content p-2 rounded whitespace-pre-wrap break-all m-0">{log.join('\n')}</pre>
        </div>
      )}

      {running && <div className="fixed top-0 left-0 right-0 h-1 bg-primary animate-pulse" />}
    </div>
  )
}
