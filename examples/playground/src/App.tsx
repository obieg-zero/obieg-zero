import { useState, useRef, useEffect } from 'react'
import type { Block, BlockDef, RunContext } from './blocks.tsx'
import { BLOCK_DEFS, BlockCard } from './blocks.tsx'
import { TEMPLATES, type Template } from './templates.ts'
import { opfs } from './blocks.tsx'

// project = name + templateId + pipeline state
interface Project { name: string; templateId: string; pipeline: Block[] }

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentIdx, setCurrentIdx] = useState<number | null>(null)
  const [opfsFiles, setOpfsFiles] = useState<string[]>([])

  // creation flow: step 1 = enter name, step 2 = pick template
  const [creating, setCreating] = useState<string | null>(null) // null = not creating, string = name entered

  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [rightPanel, setRightPanel] = useState<{ type: string; data: any } | null>(null)
  const ctxRef = useRef<RunContext>({ data: {} })

  const addLog = (msg: string) => setLog(p => [...p, `${new Date().toLocaleTimeString()} ${msg}`])
  const current = currentIdx !== null ? projects[currentIdx] : null

  // --- OPFS files refresh ---

  async function refreshFiles(name: string) {
    try { setOpfsFiles(await opfs.listFiles(name)) } catch { setOpfsFiles([]) }
  }

  useEffect(() => {
    if (current) refreshFiles(current.name)
    else setOpfsFiles([])
  }, [currentIdx])

  // --- project creation: name → template → done ---

  function startCreate() {
    setCreating('')
  }

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
    setCurrentIdx(projects.length) // will be last
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


  // --- pipeline ops (modify current project's pipeline) ---

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

  // --- render ---

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 300px 1fr', gridTemplateRows: '1fr auto', height: '100vh', fontFamily: 'system-ui', fontSize: 13 }}>

      {/* === LEFT === */}
      <div style={{ borderRight: '1px solid #e2e8f0', overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Projects */}
        <section>
          <h3 style={sectionH}>Projekty</h3>
          {projects.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '5px 6px', marginBottom: 2, borderRadius: 4,
              background: currentIdx === i ? '#eff6ff' : 'transparent',
              border: currentIdx === i ? '1px solid #bfdbfe' : '1px solid transparent' }}>
              <span onClick={() => selectProject(i)}
                style={{ flex: 1, cursor: 'pointer', fontWeight: currentIdx === i ? 700 : 400 }}>{p.name}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{TEMPLATES.find(t => t.id === p.templateId)?.name}</span>
              <button onClick={() => deleteProject(i)} style={btn('#dc2626', true)}>x</button>
            </div>
          ))}

          {/* Creation flow */}
          {creating === null ? (
            <button onClick={startCreate} style={{ ...btn('#2563eb'), width: '100%', marginTop: 4 }}>+ Nowy projekt</button>
          ) : (
            <div style={{ marginTop: 4, padding: 8, border: '2px solid #2563eb', borderRadius: 8, background: '#f8fafc' }}>
              <input value={creating} onChange={e => setCreating(e.target.value)}
                placeholder="Nazwa projektu" autoFocus
                style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
              {TEMPLATES.map(t => (
                <div key={t.id} onClick={() => finishCreate(t)}
                  style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', marginBottom: 2, border: '1px solid #e2e8f0', background: '#fff' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{t.description}</div>
                </div>
              ))}
              <button onClick={() => setCreating(null)} style={{ ...btn('#64748b', true), marginTop: 4 }}>Anuluj</button>
            </div>
          )}
        </section>

        {/* OPFS files */}
        {current && (
          <section>
            <h3 style={sectionH}>OPFS / {current.name}</h3>
            {opfsFiles.length === 0 && <p style={{ color: '#aaa', fontSize: 12 }}>Brak plikow — uzyj Upload</p>}
            {opfsFiles.map(f => (
              <div key={f} style={{ padding: '3px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ flex: 1 }}>{f}</span>
                <button onClick={async () => { await opfs.removeFile(current.name, f); refreshFiles(current.name) }}
                  style={{ ...btn('#dc2626', true), fontSize: 10, padding: '1px 5px' }}>x</button>
              </div>
            ))}
          </section>
        )}

        {/* Add block (only when project selected) */}
        {current && (
          <section>
            <h3 style={sectionH}>Dodaj blok</h3>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {BLOCK_DEFS.map(def => (
                <button key={def.type} onClick={() => addBlock(def)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ccc', background: def.color + '22', color: def.color, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
                  + {def.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* === MIDDLE: Pipeline === */}
      <div style={{ borderRight: '1px solid #e2e8f0', overflow: 'auto', padding: 12 }}>
        {!current && <p style={{ color: '#aaa' }}>Utworz lub wybierz projekt</p>}

        {current && current.pipeline.length === 0 && <p style={{ color: '#aaa' }}>Dodaj bloki z palety</p>}

        {current && current.pipeline.length > 0 && (
          <button onClick={runAll} disabled={running}
            style={{ width: '100%', marginBottom: 12, padding: '8px 16px', background: running ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: running ? 'wait' : 'pointer' }}>
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
      <div style={{ overflow: 'auto', padding: 12 }}>
        {!rightPanel && <p style={{ color: '#aaa' }}>Uruchom blok aby zobaczyc wyniki</p>}

        {rightPanel?.type === 'pages' && (
          <div>
            <h3 style={sectionH}>Strony OCR ({rightPanel.data.length})</h3>
            {rightPanel.data.map((p: any, i: number) => (
              <details key={i} style={{ marginBottom: 4 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12 }}>Strona {p.page} — {p.text.length} zn.</summary>
                <pre style={mono}>{p.text}</pre>
              </details>
            ))}
          </div>
        )}

        {rightPanel?.type === 'search' && (
          <div>
            <h3 style={sectionH}>Wyniki ({rightPanel.data.length})</h3>
            {rightPanel.data.map((r: any, i: number) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#888' }}>str. {r.page} — score: {r.score.toFixed(4)}</div>
                <pre style={mono}>{r.text}</pre>
              </div>
            ))}
          </div>
        )}

        {rightPanel?.type === 'answer' && (
          <div>
            <h3 style={sectionH}>Odpowiedz LLM</h3>
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>{rightPanel.data}</div>
          </div>
        )}

        {rightPanel?.type === 'extract' && rightPanel.data && (
          <div>
            <h3 style={sectionH}>Ekstrakcja</h3>
            <p>{rightPanel.data.extracted} faktow wydobytych, {rightPanel.data.failed} bledow, {rightPanel.data.total} chunkow</p>
          </div>
        )}

        {rightPanel?.type === 'graph' && rightPanel.data && (
          <div>
            <h3 style={sectionH}>Graf wiedzy ({rightPanel.data.nodes?.length} encji, {rightPanel.data.edges?.length} relacji)</h3>
            {(() => {
              const g = rightPanel.data as { nodes: any[]; edges: any[] }
              const byType = new Map<string, any[]>()
              g.nodes?.forEach((n: any) => { const arr = byType.get(n.type) || []; arr.push(n); byType.set(n.type, arr) })
              return [...byType.entries()].map(([type, nodes]) => (
                <details key={type} style={{ marginBottom: 4 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{type} ({nodes.length})</summary>
                  {nodes.map((n: any) => (
                    <div key={n.id} style={{ padding: '2px 0 2px 12px', fontSize: 12 }}>
                      <strong>{n.label}</strong>{n.data?.value ? `: ${n.data.value}` : ''}
                    </div>
                  ))}
                </details>
              ))
            })()}
          </div>
        )}

        {rightPanel?.type === 'info' && (
          <div><h3 style={sectionH}>Status</h3><p>{rightPanel.data}</p></div>
        )}
      </div>

      {/* === LOG === */}
      {log.length > 0 && (
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', maxHeight: 200, overflow: 'auto', padding: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Log ({log.length})</span>
            <button onClick={() => setLog([])} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}>wyczysc</button>
          </div>
          <pre style={{ ...mono, margin: 0 }}>{log.join('\n')}</pre>
        </div>
      )}

      {running && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: '#2563eb', animation: 'pulse 1s infinite' }} />}
    </div>
  )
}

const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, margin: '0 0 8px' }
const inputStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }
const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: 11, background: '#1e1e1e', color: '#d4d4d4', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }

function btn(color: string, small = false): React.CSSProperties {
  return { padding: small ? '3px 8px' : '6px 14px', background: color, color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: small ? 11 : 13 }
}
