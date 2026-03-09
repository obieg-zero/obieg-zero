import { useState, useRef } from 'react'
import type { Block, BlockDef, RunContext } from './blocks.tsx'
import { BLOCK_DEFS, BlockCard } from './blocks.tsx'

export function App() {
  const [pipeline, setPipeline] = useState<Block[]>([])
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const ctxRef = useRef<RunContext>({ data: {} })

  const addLog = (msg: string) => setLog(p => [...p, `${new Date().toLocaleTimeString()} ${msg}`])

  function addBlock(def: BlockDef) {
    setPipeline(p => [...p, { id: `${def.type}-${Date.now()}`, type: def.type, config: { ...def.defaults } }])
  }

  function removeBlock(id: string) {
    setPipeline(p => p.filter(b => b.id !== id))
  }

  function updateConfig(id: string, key: string, value: string) {
    setPipeline(p => p.map(b => b.id === id ? { ...b, config: { ...b.config, [key]: value } } : b))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setPipeline(p => {
      const i = p.findIndex(b => b.id === id)
      if (i < 0) return p
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function run() {
    setRunning(true)
    setLog([])
    const ctx = ctxRef.current
    ctx.data = {}
    for (const block of pipeline) {
      const def = BLOCK_DEFS.find(d => d.type === block.type)
      if (!def) continue
      addLog(`>>> ${def.label}`)
      try {
        await def.run(block.config, ctx, addLog)
      } catch (e: any) {
        addLog(`ERROR: ${e.message}`)
        break
      }
    }
    addLog('--- done ---')
    setRunning(false)
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 700, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>mini-playground</h1>

      {/* block palette */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {BLOCK_DEFS.map(def => (
          <button key={def.type} onClick={() => addBlock(def)}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #ccc', background: def.color + '22', color: def.color, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            + {def.label}
          </button>
        ))}
      </div>

      {/* pipeline */}
      {pipeline.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Dodaj bloki z palety powyzej.</p>}
      {pipeline.map((block, i) => (
        <BlockCard key={block.id} block={block} index={i} total={pipeline.length}
          onRemove={() => removeBlock(block.id)}
          onMove={dir => moveBlock(block.id, dir)}
          onConfig={(k, v) => updateConfig(block.id, k, v)} />
      ))}

      {/* run */}
      {pipeline.length > 0 && (
        <button onClick={run} disabled={running}
          style={{ marginTop: 12, padding: '10px 24px', background: running ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: running ? 'wait' : 'pointer' }}>
          {running ? 'Dziala...' : 'Uruchom pipeline'}
        </button>
      )}

      {/* log */}
      {log.length > 0 && (
        <pre style={{ marginTop: 16, fontSize: 11, background: '#1e1e1e', color: '#d4d4d4', padding: 10, borderRadius: 8, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {log.join('\n')}
        </pre>
      )}

      {/* context inspector */}
      {Object.keys(ctxRef.current.data).length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, color: '#888', cursor: 'pointer' }}>Context data</summary>
          <pre style={{ fontSize: 11, background: '#f8fafc', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(ctxRef.current.data, (_, v) => Array.isArray(v) && v.length > 3 ? `[${v.length} items]` : v, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
