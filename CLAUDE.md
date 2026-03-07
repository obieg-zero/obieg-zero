# obieg-zero — Architecture Guide

Browser-native document flow engine. Zero backend, zero config, zero barrier. Everything runs in the browser: OPFS, IndexedDB, WebAssembly, Web Workers.

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

### @obieg-zero/core

**templateNode({ template, output? })**
- Reads: any `{{varName}}` referenced in template string
- Writes: `$output` (default: `prompt`)

**extractNode({ output? })**
- Reads: `$answer`
- Writes: `$output` (default: `extracted`), `$extractError`
- Parses first JSON object/array from answer string

### @obieg-zero/storage

**opfsUpload()**
- Reads: `$projectId`, `$fileKey`, `$file` (File object)
- Writes: `$storedFile` ({ projectId, fileKey, name, size })

**opfsRead()**
- Reads: `$projectId`, `$fileKey`
- Writes: `$file` (File object from OPFS)

**opfsDelete()**
- Reads: `$projectId`, `$fileKey`

**opfsDeleteProject()**
- Reads: `$projectId`
- Deletes entire project directory from OPFS

**opfsOpen()**
- Reads: `$projectId`, `$fileKey`
- Writes: `$fileUrl` — opens file in new tab

**persistSave({ keys })**
- Reads: `$projectId` + each key from `keys` array
- Saves to IndexedDB scoped by projectId

**persistLoad({ keys })**
- Reads: `$projectId`
- Writes: each key from `keys` array (loaded from IndexedDB)

**persistDelete({ keys })**
- Reads: `$projectId`
- Deletes keys from IndexedDB

### @obieg-zero/ocr

**ocrNode({ language? })**
- Reads: `$file` (File/Blob)
- Writes: `$pages` — array of `{ page: number, text: string }`
- Uses pdfjs-dist for text layer, falls back to Tesseract OCR
- Peer deps: `pdfjs-dist`, `tesseract.js`

### @obieg-zero/embed

**embedNode({ model, dtype?, chunkSize?, chunkOverlap?, workerFactory })**
- Reads: `$pages` (from OCR)
- Writes: `$chunks` — array of `{ text, page, embedding: number[] }`
- `workerFactory` must return a Worker pointing to `embedding-worker.ts`
- Peer dep: `@huggingface/transformers`

**searchNode({ topK? })**
- Reads: `$query`, `$chunks`, `$queryEmbedding`
- Writes: `$context` (joined text), `$matchedChunks`
- Cosine similarity + keyword boost

### @obieg-zero/llm

**llmNode({ modelUrl, nCtx?, nPredict?, temperature? })**
- Reads: `$prompt` OR (`$query` + `$context`), optional `$onToken` callback
- Writes: `$answer`, `$llmReady` (after first model load)
- Defaults: `nCtx=8192`, `nPredict=1024`, `temperature=0.3`
- Peer dep: `@wllama/wllama`

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
