import { ocrFile } from '@obieg-zero/ocr-v2'
import { createEmbedder, search } from '@obieg-zero/embed-v2'
import type { EmbedHandle, Chunk } from '@obieg-zero/embed-v2'
import { createLlm } from '@obieg-zero/llm-v2'
import type { LlmHandle } from '@obieg-zero/llm-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import type { GraphDB } from '@obieg-zero/graph-v2'
import { createOpfs } from '@obieg-zero/store-v2'

// --- types ---

export interface RunContext {
  data: Record<string, any>
  _embedder?: EmbedHandle
  _llm?: LlmHandle
  _graph?: GraphDB
}

export interface Block {
  id: string
  type: string
  config: Record<string, string>
}

type Log = (msg: string) => void

export interface BlockDef {
  type: string
  label: string
  color: string
  fields: { key: string; label: string; default?: string }[]
  defaults: Record<string, string>
  run: (config: Record<string, string>, ctx: RunContext, log: Log) => Promise<void>
}

// --- singletons ---

export const opfs = createOpfs()

// --- block definitions ---

export const BLOCK_DEFS: BlockDef[] = [

  // --- Upload → OPFS ---
  {
    type: 'upload',
    label: 'Upload',
    color: '#6366f1',
    fields: [{ key: 'project', label: 'Projekt', default: 'default' }],
    defaults: { project: 'default' },
    async run(config, ctx, log) {
      const project = config.project || 'default'
      await opfs.createProject(project).catch(() => {})

      const files: File[] = (window as any).__miniCtxFiles || []
      if (files.length === 0) { log('Brak plikow — wybierz pliki w karcie Upload'); return }
      delete (window as any).__miniCtxFiles

      for (const file of files) {
        await opfs.writeFile(project, file.name, file)
        log(`Zapisano ${file.name} → OPFS/${project}/`)
      }
      ctx.data.project = project
      log(`Upload: ${files.length} plikow → OPFS/${project}/`)
    },
  },

  // --- Parse ← OPFS → ctx.pages (PDF→OCR, CSV/TXT→read) ---
  {
    type: 'ocr',
    label: 'Parse',
    color: '#ea580c',
    fields: [{ key: 'language', label: 'Jezyk OCR', default: 'pol' }],
    defaults: { language: 'pol' },
    async run(config, ctx, log) {
      const project = ctx.data.project || 'default'
      const files = await opfs.listFiles(project)
      if (files.length === 0) { log('Brak plikow w projekcie'); return }

      const allPages: { page: number; text: string }[] = []
      let pageNum = 1

      for (const filename of files) {
        const ext = filename.split('.').pop()?.toLowerCase() || ''
        log(`Parse: ${filename} (${ext})`)

        if (ext === 'pdf') {
          const file = await opfs.readFile(project, filename)
          const pages = await ocrFile(file, { language: config.language || 'pol', onProgress: m => log(`  ${m}`) })
          for (const p of pages) allPages.push({ page: pageNum++, text: `[${filename}] ${p.text}` })
        } else if (ext === 'csv' || ext === 'tsv') {
          const file = await opfs.readFile(project, filename)
          const text = await file.text()
          const lines = text.split('\n')
          const header = lines[0] || ''
          // chunk CSV: 20 rows per page
          for (let i = 1; i < lines.length; i += 20) {
            const chunk = [header, ...lines.slice(i, i + 20)].join('\n')
            allPages.push({ page: pageNum++, text: `[${filename}] ${chunk}` })
          }
        } else {
          const file = await opfs.readFile(project, filename)
          const text = await file.text()
          allPages.push({ page: pageNum++, text: `[${filename}] ${text}` })
        }
      }

      ctx.data.pages = allPages
      log(`Parse: ${allPages.length} stron, ${allPages.reduce((s, p) => s + p.text.length, 0)} zn.`)
    },
  },

  // --- Embed ← ctx.pages → ctx.chunks ---
  {
    type: 'embed',
    label: 'Embed',
    color: '#7c3aed',
    fields: [
      { key: 'model', label: 'Model', default: 'Xenova/multilingual-e5-small' },
      { key: 'chunkSize', label: 'Chunk (zn)', default: '200' },
    ],
    defaults: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' },
    async run(config, ctx, log) {
      if (!ctx.data.pages?.length) { log('Brak stron — dodaj OCR przed Embed'); return }

      if (!ctx._embedder) {
        ctx._embedder = await createEmbedder({ model: config.model, dtype: 'q8', onProgress: m => log(`  ${m}`) })
      }
      const index = await ctx._embedder.createIndex(ctx.data.pages, {
        chunkSize: parseInt(config.chunkSize) || 200,
        onProgress: m => log(`  ${m}`),
      })
      ctx.data.chunks = index.chunks
      ctx.data._embedFn = index.embed
      log(`Embed: ${index.chunks.length} chunks po ~${config.chunkSize} zn. z ${ctx.data.pages.length} stron`)
      // pokaz pierwsze 3 chunki
      for (let i = 0; i < Math.min(3, index.chunks.length); i++) {
        log(`  chunk[${i}]: "${index.chunks[i].text.slice(0, 100)}..."`)
      }
      if (index.chunks.length > 3) log(`  ...i ${index.chunks.length - 3} wiecej`)
    },
  },

  // --- Search ← ctx.chunks → ctx.context ---
  {
    type: 'search',
    label: 'Search',
    color: '#2563eb',
    fields: [
      { key: 'query', label: 'Zapytanie' },
      { key: 'topK', label: 'Top K', default: '3' },
    ],
    defaults: { query: '', topK: '3' },
    async run(config, ctx, log) {
      if (!ctx.data.chunks?.length || !ctx.data._embedFn) { log('Brak chunks — dodaj Embed przed Search'); return }
      if (!config.query) { log('Brak zapytania'); return }

      const results = await search(ctx.data.chunks, config.query, ctx.data._embedFn, {
        topK: parseInt(config.topK) || 3,
        minWordLength: 2,
      })
      ctx.data.searchResults = results
      ctx.data.context = results.map(r => r.text).join('\n\n')
      for (const r of results) log(`  [${r.score.toFixed(3)}] str.${r.page}: ${r.text.slice(0, 80)}...`)
    },
  },

  // --- LLM Ask ← ctx.context → ctx.answer ---
  {
    type: 'llm',
    label: 'LLM',
    color: '#16a34a',
    fields: [
      { key: 'prompt', label: 'Prompt ({{context}} = kontekst)' },
      { key: 'modelUrl', label: 'Model URL', default: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf' },
    ],
    defaults: {
      prompt: 'Na podstawie tekstu odpowiedz krotko.\n\nTekst: "{{context}}"\n\nOdpowiedz:',
      modelUrl: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf',
    },
    async run(config, ctx, log) {
      if (!ctx._llm) {
        ctx._llm = await createLlm({
          modelUrl: config.modelUrl,
          wasmPaths: {
            'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
            'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
          },
          nCtx: 2048,
          chatTemplate: true,
          onProgress: m => log(`  ${m}`),
        })
      }

      const prompt = config.prompt.replace('{{context}}', ctx.data.context || '(brak kontekstu)')
      const result = await ctx._llm.ask(prompt, { nPredict: 64, temperature: 0.1 })
      ctx.data.answer = result.text
      log(`Odpowiedz (${result.tokenCount} tok, ${(result.durationMs / 1000).toFixed(1)}s): ${result.text}`)
    },
  },

  // --- Extract: LLM na KAZDYM chunku → fakty → Graph (mrowki) ---
  {
    type: 'extract',
    label: 'Extract',
    color: '#f59e0b',
    fields: [
      { key: 'prompt', label: 'Prompt ({{chunk}} = tekst chunka)' },
      { key: 'modelUrl', label: 'Model URL', default: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf' },
    ],
    defaults: {
      prompt: 'Wypisz fakty z tekstu, kazdy w osobnej linii w formacie TYP: wartosc\nMozliwe typy: bank, kwota, marza, wibor, data, okres, rata, waluta, oprocentowanie\nJesli brak faktow — napisz: brak\n\nTekst: "{{chunk}}"\n\nFakty:',
      modelUrl: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf',
    },
    async run(config, ctx, log) {
      if (!ctx.data.chunks?.length) { log('Brak chunks — dodaj Embed przed Extract'); return }

      if (!ctx._llm) {
        ctx._llm = await createLlm({
          modelUrl: config.modelUrl,
          wasmPaths: {
            'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
            'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
          },
          nCtx: 2048,
          chatTemplate: true,
          onProgress: m => log(`  ${m}`),
        })
      }

      if (!ctx._graph) {
        ctx._graph = await createGraphDB(`mini-${ctx.data.project || 'default'}`)
      }

      let extracted = 0, failed = 0
      const chunks = ctx.data.chunks as Chunk[]
      const t0 = Date.now()
      let avgMs = 0
      log(`Extract: ${chunks.length} chunkow`)

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const prompt = config.prompt.replace('{{chunk}}', chunk.text.slice(0, 400))
        const eta = i > 0 ? ` | ETA: ${Math.round(avgMs * (chunks.length - i) / 1000)}s` : ''
        log(`--- [${i + 1}/${chunks.length}]${eta} ---`)
        log(`  IN: "${chunk.text.slice(0, 100)}..."`)

        try {
          const result = await ctx._llm.ask(prompt, { nPredict: 128, temperature: 0.1 })
          avgMs = (Date.now() - t0) / (i + 1)
          log(`  OUT (${result.tokenCount}tok ${(result.durationMs / 1000).toFixed(1)}s): ${result.text}`)

          // parse lines with ":" — accept anything LLM produces
          const facts = result.text.split('\n')
            .map(l => l.trim().replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, ''))
            .filter(l => l.includes(':'))
            .map(line => {
              const idx = line.indexOf(':')
              return { type: line.slice(0, idx).trim().toLowerCase(), value: line.slice(idx + 1).trim() }
            })
            .filter(f => f.type && f.value)

          if (facts.length === 0) { failed++; log(`  WYNIK: brak faktow`); continue }

          const nodes = facts.map((f, j) => ({
            id: `c${i}:e${j}:${Date.now()}`,
            type: f.type,
            label: f.type,
            data: { value: f.value },
            trace: { chunk: i, page: chunk.page },
          }))
          await ctx._graph.addNodes(nodes)

          // co-occurrence edges
          const edges = []
          for (let a = 0; a < nodes.length; a++) {
            for (let b = a + 1; b < nodes.length; b++) {
              edges.push({ id: `e:${nodes[a].id}:${nodes[b].id}`, from: nodes[a].id, to: nodes[b].id, type: 'co-occurs', label: 'w tym samym chunku' })
            }
          }
          if (edges.length) await ctx._graph.addEdges(edges)

          extracted += nodes.length
          log(`  WYNIK: ${facts.map(f => `${f.type}: ${f.value}`).join(' | ')}`)
        } catch (e: any) {
          failed++
          log(`  BLAD: ${e.message}`)
        }
      }

      ctx.data.extractStats = { extracted, failed, total: chunks.length }
      log(`=== PODSUMOWANIE: ${extracted} faktow, ${failed} pustych, ${chunks.length} chunkow ===`)
    },
  },

  // --- Graph View ---
  {
    type: 'graph',
    label: 'Graph',
    color: '#dc2626',
    fields: [],
    defaults: {},
    async run(_config, ctx, log) {
      if (!ctx._graph) { log('Brak grafu — dodaj Extract przed Graph'); return }
      const graph = await ctx._graph.getGraph()
      ctx.data.graph = graph

      const byType = new Map<string, number>()
      graph.nodes.forEach(n => byType.set(n.type, (byType.get(n.type) || 0) + 1))
      log(`Graf: ${graph.nodes.length} encji, ${graph.edges.length} relacji`)
      for (const [type, count] of byType) log(`  ${type}: ${count}`)
    },
  },
]

// --- Block card UI ---

export function BlockCard({ block, index, total, running, onRemove, onMove, onConfig, onRun }: {
  block: Block
  index: number
  total: number
  running?: boolean
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onConfig: (key: string, value: string) => void
  onRun?: () => void
}) {
  const def = BLOCK_DEFS.find(d => d.type === block.type)
  if (!def) return null

  return (
    <div style={{ marginBottom: 8, padding: 10, borderRadius: 8, border: `2px solid ${def.color}33`, background: `${def.color}08` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: def.color, fontSize: 13 }}>{index + 1}. {def.label}</span>
        <span style={{ flex: 1 }} />
        {onRun && <button onClick={onRun} disabled={running} style={{ ...sm, color: def.color, fontWeight: 700 }}>▶</button>}
        {index > 0 && <button onClick={() => onMove(-1)} style={sm}>↑</button>}
        {index < total - 1 && <button onClick={() => onMove(1)} style={sm}>↓</button>}
        <button onClick={onRemove} style={{ ...sm, color: '#dc2626' }}>✕</button>
      </div>

      {block.type === 'upload' && (
        <label style={{ display: 'inline-block', padding: '4px 10px', background: def.color, color: '#fff', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>
          Wybierz pliki
          <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
            const files = Array.from(e.target.files || [])
            if (files.length) {
              (window as any).__miniCtxFiles = files
              onConfig('_files', files.map(f => f.name).join(', '))
            }
          }} />
        </label>
      )}
      {block.type === 'upload' && block.config._files && (
        <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>{block.config._files}</span>
      )}

      {def.fields.map(f => (
        <div key={f.key} style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 11, color: '#666' }}>{f.label}</label>
          {(block.config[f.key]?.length ?? 0) > 60 ? (
            <textarea value={block.config[f.key] ?? ''} onChange={e => onConfig(f.key, e.target.value)}
              rows={3} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 11 }} />
          ) : (
            <input value={block.config[f.key] ?? ''} onChange={e => onConfig(f.key, e.target.value)}
              style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }} />
          )}
        </div>
      ))}
    </div>
  )
}

const sm: React.CSSProperties = { padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11 }
