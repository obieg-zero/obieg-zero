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

const opfs = createOpfs()

// --- block definitions ---

export const BLOCK_DEFS: BlockDef[] = [

  // --- Upload → OPFS ---
  {
    type: 'upload',
    label: 'Upload PDF',
    color: '#6366f1',
    fields: [{ key: 'project', label: 'Projekt', default: 'default' }],
    defaults: { project: 'default' },
    async run(config, ctx, log) {
      const project = config.project || 'default'
      await opfs.createProject(project).catch(() => {})

      const file: File | undefined = (window as any).__miniCtxFile
      if (!file) {
        log('Brak pliku — wybierz PDF w karcie Upload')
        return
      }
      delete (window as any).__miniCtxFile

      await opfs.writeFile(project, file.name, file)
      ctx.data.project = project
      ctx.data.filename = file.name
      log(`Zapisano ${file.name} → OPFS/${project}/`)
    },
  },

  // --- OCR ← OPFS → ctx.pages ---
  {
    type: 'ocr',
    label: 'OCR',
    color: '#ea580c',
    fields: [{ key: 'language', label: 'Jezyk', default: 'pol' }],
    defaults: { language: 'pol' },
    async run(config, ctx, log) {
      const project = ctx.data.project || 'default'
      const filename = ctx.data.filename
      if (!filename) { log('Brak pliku w kontekscie — dodaj Upload przed OCR'); return }

      const file = await opfs.readFile(project, filename)
      const pages = await ocrFile(file, { language: config.language || 'pol', onProgress: m => log(`  ${m}`) })
      ctx.data.pages = pages
      log(`${pages.length} stron, ${pages.reduce((s, p) => s + p.text.length, 0)} zn.`)
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
      log(`${index.chunks.length} chunks`)
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

  // --- Graph Store ← ctx.answer → graph-v2 ---
  {
    type: 'graph',
    label: 'Graph',
    color: '#dc2626',
    fields: [
      { key: 'nodeType', label: 'Typ encji', default: 'fact' },
      { key: 'field', label: 'Pole', default: 'value' },
    ],
    defaults: { nodeType: 'fact', field: 'value' },
    async run(config, ctx, log) {
      if (!ctx.data.answer) { log('Brak answer — dodaj LLM przed Graph'); return }
      if (!ctx._graph) {
        ctx._graph = await createGraphDB(`mini-${ctx.data.project || 'default'}`)
      }
      const id = `${config.nodeType}:${config.field}:${Date.now()}`
      await ctx._graph.addNode({
        id,
        type: config.nodeType,
        label: config.field,
        data: { [config.field]: ctx.data.answer },
      })
      const all = await ctx._graph.getAllNodes()
      log(`Graf: dodano ${id}, razem ${all.length} nodes`)
    },
  },
]

// --- Block card UI ---

export function BlockCard({ block, index, total, onRemove, onMove, onConfig }: {
  block: Block
  index: number
  total: number
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onConfig: (key: string, value: string) => void
}) {
  const def = BLOCK_DEFS.find(d => d.type === block.type)
  if (!def) return null

  return (
    <div style={{ marginBottom: 8, padding: 10, borderRadius: 8, border: `2px solid ${def.color}33`, background: `${def.color}08` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: def.color, fontSize: 13 }}>{index + 1}. {def.label}</span>
        <span style={{ flex: 1 }} />
        {index > 0 && <button onClick={() => onMove(-1)} style={sm}>↑</button>}
        {index < total - 1 && <button onClick={() => onMove(1)} style={sm}>↓</button>}
        <button onClick={onRemove} style={{ ...sm, color: '#dc2626' }}>✕</button>
      </div>

      {/* file picker for upload block */}
      {block.type === 'upload' && (
        <label style={{ display: 'inline-block', padding: '4px 10px', background: def.color, color: '#fff', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>
          Wybierz PDF
          <input type="file" accept=".pdf" hidden onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              // store file reference in a way the run can pick up
              (window as any).__miniCtxFile = f
              onConfig('_filename', f.name)
            }
          }} />
        </label>
      )}
      {block.type === 'upload' && block.config._filename && (
        <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>{block.config._filename}</span>
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
