import { useState } from 'react'
import { useProjects } from './useProjects.ts'
import { useLog } from './useLog.ts'
import { blockOcr, blockEmbed, blockSearch, blockRag } from './blocks.ts'
import type { EmbedConfig, LlmConfig } from './blocks.ts'
import { db } from './store.ts'
import type { PageRecord, ChunkRecord } from '@obieg-zero/store-v2'

const EMBED_CONFIG: EmbedConfig = {
  model: 'Xenova/multilingual-e5-small',
  dtype: 'q8',
  chunkSize: 200,
}

const LLM_CONFIG: LlmConfig = {
  modelUrl: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf',
  nCtx: 2048,
  chatTemplate: true,
  wasmPaths: {
    'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
    'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
  },
}

type Tab = 'files' | 'pages' | 'search' | 'rag'

export function App() {
  const proj = useProjects()
  const { entries, log, clear: clearLog } = useLog()
  const [tab, setTab] = useState<Tab>('files')
  const [busy, setBusy] = useState(false)
  const [pages, setPages] = useState<PageRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [ragQuery, setRagQuery] = useState('')
  const [ragAnswer, setRagAnswer] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')

  async function wrap(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } catch (e: any) { log(`ERROR: ${e.message}`) }
    setBusy(false)
  }

  // --- Project actions ---

  function handleCreateProject() {
    if (!newProjectName.trim()) return
    wrap(async () => {
      await proj.createProject(newProjectName.trim())
      setNewProjectName('')
      log(`Projekt utworzony: ${newProjectName}`)
    })
  }

  function handleUpload(files: FileList) {
    wrap(async () => {
      for (const file of Array.from(files)) {
        await proj.uploadFile(file)
        log(`Upload: ${file.name}`)
      }
    })
  }

  // --- Block actions ---

  function handleOcr(docId: string, filename: string) {
    if (!proj.current) return
    wrap(async () => {
      await blockOcr(proj.current!, docId, filename, log)
    })
  }

  function handleOcrAll() {
    if (!proj.current) return
    wrap(async () => {
      for (const doc of proj.documents) {
        await blockOcr(proj.current!, doc.id, doc.filename, log)
      }
    })
  }

  function handleEmbedAll() {
    if (!proj.current) return
    wrap(async () => {
      for (const doc of proj.documents) {
        await blockEmbed(proj.current!, doc.id, EMBED_CONFIG, log)
      }
    })
  }

  function handleViewPages(docId: string) {
    wrap(async () => {
      const p = await db.getPages(docId)
      setPages(p)
      setTab('pages')
    })
  }

  function handleSearch() {
    if (!proj.current || !searchQuery.trim()) return
    wrap(async () => {
      const r = await blockSearch(proj.current!, searchQuery, 5, log)
      setSearchResults(r)
    })
  }

  function handleRag() {
    if (!proj.current || !ragQuery.trim()) return
    wrap(async () => {
      const r = await blockRag(proj.current!, ragQuery, EMBED_CONFIG, LLM_CONFIG, log)
      setRagAnswer(r?.answer.text ?? 'Brak odpowiedzi')
    })
  }

  // --- Render ---

  const curProj = proj.projects.find(p => p.id === proj.current)

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>obieg-zero — Playground</h1>

      {/* Project list */}
      {!proj.current && (
        <div>
          <h2 style={{ fontSize: 16 }}>Projekty</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              placeholder="Nazwa nowego projektu"
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', flex: 1 }}
            />
            <button onClick={handleCreateProject} style={btn('#2563eb')}>Utwórz</button>
          </div>
          {proj.projects.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Brak projektów. Utwórz pierwszy.</p>}
          {proj.projects.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <button onClick={() => proj.selectProject(p.id)} style={{ ...btn('#16a34a'), flex: 1, textAlign: 'left' }}>
                {p.name}
              </button>
              <span style={{ fontSize: 11, color: '#888' }}>{new Date(p.createdAt).toLocaleDateString()}</span>
              <button onClick={() => proj.removeProject(p.id)} style={btn('#dc2626', true)}>Usuń</button>
            </div>
          ))}
        </div>
      )}

      {/* Inside project */}
      {proj.current && curProj && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => proj.selectProject(null)} style={btn('#64748b')}>← Projekty</button>
            <h2 style={{ fontSize: 16, margin: 0 }}>{curProj.name}</h2>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {(['files', 'pages', 'search', 'rag'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 14px', borderRadius: 6, border: tab === t ? '2px solid #2563eb' : '1px solid #ccc', background: tab === t ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13 }}>
                {t === 'files' ? 'Pliki' : t === 'pages' ? 'Strony' : t === 'search' ? 'Search' : 'RAG'}
              </button>
            ))}
          </div>

          {/* Tab: Files */}
          {tab === 'files' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <label style={{ ...btn('#2563eb'), cursor: 'pointer' }}>
                  Upload PDF
                  <input type="file" accept=".pdf" multiple hidden onChange={e => e.target.files?.length && handleUpload(e.target.files)} />
                </label>
                <button onClick={handleOcrAll} disabled={busy} style={btn('#ea580c')}>OCR all</button>
                <button onClick={handleEmbedAll} disabled={busy} style={btn('#7c3aed')}>Embed all</button>
              </div>
              {proj.documents.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Brak dokumentów. Wrzuć PDF.</p>}
              {proj.documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{doc.filename}</span>
                  {doc.pageCount != null && <span style={{ color: '#888' }}>{doc.pageCount} str.</span>}
                  <button onClick={() => handleOcr(doc.id, doc.filename)} disabled={busy} style={btn('#ea580c', true)}>OCR</button>
                  <button onClick={() => handleViewPages(doc.id)} style={btn('#64748b', true)}>Strony</button>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Pages */}
          {tab === 'pages' && (
            <div>
              {pages.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Wybierz dokument i kliknij "Strony".</p>}
              {pages.map(p => (
                <details key={p.id} style={{ marginBottom: 4 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12 }}>Strona {p.page} — {p.text.length} zn.</summary>
                  <pre style={mono}>{p.text}</pre>
                </details>
              ))}
            </div>
          )}

          {/* Tab: Search */}
          {tab === 'search' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Szukaj semantycznie..."
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', flex: 1 }} />
                <button onClick={handleSearch} disabled={busy} style={btn('#2563eb')}>Szukaj</button>
              </div>
              {searchResults.map((r, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>str. {r.page} — score: {r.score.toFixed(4)}</div>
                  <pre style={mono}>{r.text}</pre>
                </div>
              ))}
            </div>
          )}

          {/* Tab: RAG */}
          {tab === 'rag' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={ragQuery} onChange={e => setRagQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRag()}
                  placeholder="Zadaj pytanie..."
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', flex: 1 }} />
                <button onClick={handleRag} disabled={busy} style={btn('#16a34a')}>Pytaj</button>
              </div>
              {ragAnswer && (
                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <strong>Odpowiedź:</strong> {ragAnswer}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Log */}
      {entries.length > 0 && (
        <details open={busy} style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: '#666', display: 'flex', gap: 8, alignItems: 'center' }}>
            Log ({entries.length})
            <button onClick={clearLog} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}>Wyczyść</button>
          </summary>
          <pre style={{ ...mono, maxHeight: 300, overflow: 'auto' }}>{entries.join('\n')}</pre>
        </details>
      )}

      {busy && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: '#2563eb', animation: 'pulse 1s infinite' }} />}
    </div>
  )
}

// --- styles ---

const mono = { fontFamily: 'monospace', fontSize: 11, background: '#1e1e1e', color: '#d4d4d4', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const }

function btn(color: string, small = false): React.CSSProperties {
  return {
    padding: small ? '4px 10px' : '8px 16px',
    background: color,
    color: '#fff',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: small ? 12 : 14,
  }
}
