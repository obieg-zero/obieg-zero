# obieg-zero

Browser-native document flow engine. Zero backend, zero config, zero barrier.

## Packages

| Package | Description |
|---|---|
| `@obieg-zero/core` | Flow engine — nodes, variables, events |
| `@obieg-zero/storage` | OPFS file storage + IndexedDB persistence |
| `@obieg-zero/ocr` | PDF parsing + Tesseract OCR |
| `@obieg-zero/embed` | HuggingFace embeddings + semantic search |
| `@obieg-zero/llm` | Local LLM inference (wllama/GGUF) |

## Quick start

```ts
import { createFlow, templateNode } from '@obieg-zero/core';
import { ocrNode } from '@obieg-zero/ocr';
import { llmNode } from '@obieg-zero/llm';

const flow = createFlow();

flow.node('ocr', ocrNode({ language: 'pol' }));
flow.node('prompt', templateNode({
  template: 'Summarize: {{context}}',
}));
flow.node('llm', llmNode({
  modelUrl: '/models/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf',
}));

// Upload a PDF, OCR it, generate a summary
flow.set('file', pdfFile);
await flow.run('ocr', 'prompt', 'llm');
console.log(flow.get('answer'));
```

## Philosophy

- **Zero backend** — everything runs in the browser (OPFS, IndexedDB, WebAssembly)
- **Zero config** — sensible defaults, just plug in nodes
- **Zero barrier** — no accounts, no API keys, no server setup

## License

MIT
