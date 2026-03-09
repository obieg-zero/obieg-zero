# obieg-zero

Browser-native document analysis. Zero backend, zero config, zero barrier.

## Packages

| Package | Description |
|---|---|
| `@obieg-zero/ocr-v2` | PDF text extraction + Tesseract OCR fallback |
| `@obieg-zero/embed-v2` | Embeddings + semantic search (transformers.js) |
| `@obieg-zero/llm-v2` | Local LLM inference (wllama/GGUF) |
| `@obieg-zero/graph-v2` | Graph database on IndexedDB |

## Quick start

```ts
import { ocrFile } from '@obieg-zero/ocr-v2'
import { createEmbedder, search } from '@obieg-zero/embed-v2'
import { createLlm } from '@obieg-zero/llm-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'

const pages = await ocrFile(pdf, { language: 'pol' })

const embedder = await createEmbedder({ model: 'Xenova/multilingual-e5-small', dtype: 'q8' })
const index = await embedder.createIndex(pages, { chunkSize: 200 })
const hits = await search(index.chunks, 'kwota kredytu', index.embed, { topK: 3 })

const llm = await createLlm({ modelUrl: '...gguf', wasmPaths: { ... } })
const answer = await llm.ask(`Podaj kwotę: "${hits.map(h => h.text).join(' ')}"`)

const db = await createGraphDB('case-1')
await db.addNode({ id: 'n:1', type: 'credit', label: 'Kredyt', data: { amount: answer } })
```

## Examples

| Example | Description |
|---|---|
| `examples/playground` | Interactive pipeline demo — upload PDF, see graph |
| `examples/doc-analyzer` | Document analyzer app |

## Philosophy

- **Zero backend** — everything runs in the browser (IndexedDB, WebAssembly)
- **Zero config** — no accounts, no API keys, no server setup
- **Uniform API** — stateful `createX(opts) → Handle { dispose() }`, stateless `fn(input, opts) → output`

## License

MIT
