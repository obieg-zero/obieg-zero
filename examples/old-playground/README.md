# playground

Pipeline: PDF → OCR → Embedding → LLM → Graf wiedzy. Wszystko w przeglądarce, zero backendu.

## Pakiety v2

Wzorzec: **stateful** `createX(opts) → Handle { methods, dispose() }`, **stateless** `fn(input, opts) → output`.
Zero domenowych defaults — konsument podaje model, język, parametry.

---

### `@obieg-zero/ocr-v2` — stateless

Ekstrakcja tekstu z PDF. Fallback na Tesseract OCR gdy tekst za krótki.

| | Typ | Opis |
|---|---|---|
| **IN** | `File` | Plik PDF |
| **IN** | `OcrOpts?` | `{ language?, ocrThreshold?, scale?, workerSrc?, onProgress? }` |
| **OUT** | `Page[]` | `{ page: number, text: string }` |

```ts
const pages = await ocrFile(file, { language: 'pol' })
```

---

### `@obieg-zero/embed-v2` — stateful

Embeddingi + semantic search. Model ładowany eagerly w `createEmbedder`.

| | Typ | Opis |
|---|---|---|
| **IN** | `EmbedOpts` | `{ model, dtype, onProgress? }` |
| **OUT** | `EmbedHandle` | `{ embed(text), createIndex(pages, opts), dispose() }` |

```ts
const embedder = await createEmbedder({ model: 'Xenova/multilingual-e5-small', dtype: 'q8' })
const index = await embedder.createIndex(pages, { chunkSize: 200 })
const results = await search(index.chunks, 'kwota kredytu', index.embed, { topK: 3 })
embedder.dispose()
```

`search(chunks, query, embedFn, opts?)` — czysta funkcja, nie na handle.

---

### `@obieg-zero/llm-v2` — stateful

Lokalne LLM w przeglądarce przez wllama (GGUF).

| | Typ | Opis |
|---|---|---|
| **IN** | `LlmOpts` | `{ modelUrl, wasmPaths, nCtx?, chatTemplate?, onProgress? }` |
| **OUT** | `LlmHandle` | `{ ask(prompt, opts?), dispose() }` |

```ts
const llm = await createLlm({ modelUrl: '...gguf', wasmPaths: { ... } })
const answer = await llm.ask('Podaj kwotę kredytu', { nPredict: 64, temperature: 0.1 })
llm.dispose()
```

---

### `@obieg-zero/graph-v2` — stateful

Graf wiedzy na IndexedDB. CRUD na node/edge, bez opinii o kształcie danych.

| | Typ | Opis |
|---|---|---|
| **IN** | `string` | nazwa bazy IndexedDB |
| **OUT** | `GraphDB` | `{ addNode, getNode, updateNode, removeNode, addEdge, getEdge, removeEdge, getGraph, clear, dispose() }` |

```ts
const db = await createGraphDB('case-1')
await db.addNode({ id: 'doc:1', type: 'document', label: 'umowa.pdf', data: { filename: 'umowa.pdf' } })
const { nodes, edges } = await db.getGraph()
db.dispose()
```

`GraphNode: { id, type, label, data, trace? }` — trace to generyczny `Record`, kształt definiuje konsument.

---

## Pipeline flow

```
PDF ──→ ocrFile(file, { language }) ──→ Page[]
                                          │
              createEmbedder({ model }) ──→ EmbedHandle
                                          │
                    embedder.createIndex(pages, { chunkSize }) ──→ EmbedIndex
                                          │
                    search(chunks, query, embedFn) ──→ context
                                          │
                    createLlm({ modelUrl }) ──→ LlmHandle
                                          │
                    llm.ask(prompt + context) ──→ wartość
                                          │
                    db.addNode({ data, trace }) ──→ GraphDB
```
