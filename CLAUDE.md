# obieg-zero — Architecture Guide

Browser-native document flow engine. Zero backend, zero API, zero cloud. Everything runs in the browser: OPFS, IndexedDB, WebAssembly, Web Workers.

**CRITICAL CONSTRAINT: LLM runs as Q4 GGUF via WASM on a weak laptop. Every token costs seconds. Every wasted computation = wasted energy. Design everything to minimize LLM input: search a lot, send minimum context, ask LLM once. Never re-run nodes whose output already exists. Never send more chunks than needed. This is not a cloud app with unlimited GPU — this is a browser app with a carbon footprint goal of near zero.**

## Monorepo Structure

```
packages/
├── core/       # @obieg-zero/core    — flow engine, template, extract
├── storage/    # @obieg-zero/storage — OPFS files + IndexedDB persistence
├── ocr/        # @obieg-zero/ocr     — PDF parsing + Tesseract OCR
├── embed/      # @obieg-zero/embed   — HuggingFace embeddings + semantic search
└── llm/        # @obieg-zero/llm     — local LLM (wllama/GGUF, e.g. Bielik)
```

## Core Concepts

### Flow
Central orchestrator. Holds **variables** (shared state) and **nodes** (processing steps).

```ts
const flow = createFlow();
flow.node('myNode', myNodeDef);   // register
flow.set('key', value);           // set variable
flow.get('key');                   // read variable
await flow.run('node1', 'node2'); // execute sequentially
flow.on(event => { ... });        // listen to events
```

### NodeDef
A node is `{ run(ctx: FlowContext): Promise<void> }`. Context provides:
- `ctx.get(key)` — read variable
- `ctx.set(key, value)` — write variable (emits `vars` event)
- `ctx.progress(status, pct?)` — emit progress event

### Events (FlowEvent)
- `{ type: 'vars', key, value }` — variable changed
- `{ type: 'node:start' | 'node:done' | 'node:error', id }` — node lifecycle
- `{ type: 'progress', id, status, pct? }` — progress update

## Node Reference — Variables Contract

All config params are also overridable at runtime via `ctx.get('paramName')`.

### @obieg-zero/core

**templateNode({ template, output? })**
- Reads: any `{{varName}}` referenced in template string — **throws on missing variable**
- Writes: `$output` (default: `prompt`)

**extractNode({ output? })**
- Reads: `$answer`
- Writes: `$output` (default: `extracted`), `$extractError`
- Parses first JSON object/array from answer string

### @obieg-zero/storage

All OPFS nodes read `$opfsRoot` (default: `obieg-zero`) for root directory name.

**opfsUpload()**
- Reads: `$projectId`, `$fileKey`, `$file` (File object)
- Writes: `$storedFile` ({ projectId, fileKey, name, size })

**opfsRead()**
- Reads: `$projectId`, `$fileKey`
- Writes: `$file` (File object from OPFS)

**opfsDelete()** — Reads: `$projectId`, `$fileKey`

**opfsDeleteProject()** — Reads: `$projectId`

**opfsOpen()**
- Reads: `$projectId`, `$fileKey`, `$revokeTimeout` (default: 60000ms)
- Writes: `$fileUrl` — opens file in new tab

**persistSave/Load/Delete({ keys })** — Reads: `$projectId`, saves/loads/deletes keys from IndexedDB

### @obieg-zero/ocr

**ocrNode({ language?, ocrThreshold?, scale? })**
- Reads: `$file` (File/Blob)
- Writes: `$pages` — array of `{ page: number, text: string }`
- Config: `language` (default: `pol`), `ocrThreshold` (default: 20 chars), `scale` (default: 2)
- Uses pdfjs-dist for text layer, falls back to Tesseract OCR when text < threshold
- Peer deps: `pdfjs-dist`, `tesseract.js`

### @obieg-zero/embed

**embedNode({ model, dtype?, chunkSize?, chunkOverlap?, minChunkLength?, timeout?, workerFactory })**
- Reads: `$pages` (from OCR)
- Writes: `$chunks`, `$embedFn`, `$queryEmbedding` (reset to null)
- Config: `chunkSize` (500), `chunkOverlap` (50), `minChunkLength` (10), `timeout` (60000ms)
- Peer dep: `@huggingface/transformers`

**searchNode({ topK?, keywordBoost? })**
- Reads: `$query`, `$chunks`, `$queryEmbedding` (or `$embedFn`)
- Writes: `$context` (joined text), `$matchedChunks`
- Config: `topK` (5), `keywordBoost` (0.05 per keyword match)

### @obieg-zero/llm

**llmNode({ modelUrl, nCtx?, nPredict?, temperature?, topP?, topK?, timeout?, wasmPaths? })**
- Reads: `$prompt`, optional `$onToken` callback
- Writes: `$answer`, `$llmReady` (after first model load)
- Config: `nCtx` (8192), `nPredict` (256), `temperature` (0.3), `topP` (0.9), `topK` (40), `timeout` (300000ms)
- `wasmPaths` overrides default CDN URLs for wllama WASM
- Peer dep: `@wllama/wllama`

## Auto-Cache

Nodes that declare `reads` and `writes` are automatically cached via IndexedDB. Cache key = hash of (nodeId + input values). On cache hit, node is skipped entirely.

```ts
import { createIdbCache } from '@obieg-zero/storage'

const flow = createFlow()
flow.cache(createIdbCache('my-project'))  // one line — caching enabled

// Nodes with reads/writes are cached automatically:
// ocrNode:  reads=['file'], writes=['pages']
// llmNode:  reads=['prompt'], writes=['answer']
// Second run with same file → OCR skipped, pages from cache
```

- `flow.clearCache()` — wipe all cached results for the project
- Non-serializable outputs (functions, Workers) are never cached
- File inputs are hashed by name+size+lastModified (not content)

## Model Registry

```ts
import { listModels, registerModel, removeModel, totalModelSize } from '@obieg-zero/storage'

await listModels()       // → [{ url, size, downloadedAt }]
await totalModelSize()   // → bytes
await removeModel(url)   // removes from registry + Cache API
```

## Performance Rule: Minimize LLM Calls

This runs on a Q4 GGUF model in the browser via WebAssembly on a weak laptop. Every token costs seconds. Design accordingly:

- **Search is free, LLM is expensive** — use search to narrow down, send only the minimum context to LLM
- **Never re-run a node whose output already exists** — if `$context` is set, don't re-run search
- **Smallest possible prompt** — trim context to what's needed, not "all chunks"
- **topK should be low** (2-3) — more chunks = more tokens = slower inference, worse output
- **nPredict should be low** — ask for structured output (JSON), not essays
- **Zero waste** — no duplicate embeddings, no redundant inference, no silent re-computation

When building pipelines: search a lot, ask LLM once, with minimal input.

## Conventions

- **Source format**: TypeScript, ESM (`"type": "module"`), published as `.ts` source (no build step)
- **No runtime deps**: all heavy libs are peer dependencies (consumer installs what they need)
- **Node factories**: always functions returning `NodeDef` — e.g. `ocrNode()`, not `class OcrNode`
- **Variable names**: lowercase, colon-namespaced for scoping (e.g. `pages:contract`)
- **Dynamic imports**: heavy deps (pdfjs, tesseract, wllama) loaded via `await import()` — no upfront cost
- **Error handling**: nodes throw on missing required variables, caller catches
- **Package exports**: each package has `src/index.ts` re-exporting public API

## Adding a New Node

1. Create `packages/<pkg>/src/myNode.ts`
2. Export factory: `export function myNode(config): NodeDef`
3. Document reads/writes in this file
4. Re-export from `packages/<pkg>/src/index.ts`
5. Bump version in `package.json`, publish with `npm publish --access public`

## Adding a New Package

1. `mkdir -p packages/<name>/src`
2. Create `package.json` with `@obieg-zero/<name>` scope, peer dep on `@obieg-zero/core`
3. Create `src/index.ts` with exports
4. Add to root `package.json` workspaces
5. Publish: `cd packages/<name> && npm publish --access public`

## What This Project Is

obieg-zero is a **framework published on npm**. The packages `@obieg-zero/*` are the product — people install them via `npm install`. The demo at `obieg-zero.github.io` is a showcase of the framework, not the project itself.

## Workflow After Changing packages/

Every change in `packages/` MUST be published. Local workspace symlinks are for development only — npm is the delivery mechanism.

```bash
# 1. Bump version in each changed package
cd packages/<name> && npm version patch --no-git-tag-version

# 2. Publish each changed package
cd packages/<name> && npm publish --access public

# 3. Build demo
cd examples/doc-analyzer && npx vite build

# 4. Deploy demo
npx gh-pages -d examples/doc-analyzer/dist -r https://github.com/obieg-zero/obieg-zero.github.io.git -b main
```

Do NOT skip step 2. Do NOT ask the user whether to publish — just do it.

## Publishing

```bash
# From package directory:
npm publish --access public
# Requires npm token with org access (granular token + bypass 2FA)
```

## Known Constraints

- `embedding-worker.ts` must be explicitly exported in package.json for Vite worker URL resolution
- wllama `.ts` source conflicts with `erasableSyntaxOnly` — consumers should set `skipLibCheck: true`
- OPFS requires secure context (HTTPS or localhost)
- Cross-origin isolation headers needed for SharedArrayBuffer (wllama multi-thread):
  `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin`
