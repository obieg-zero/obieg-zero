import { createFlow, templateNode, extractNode } from '@obieg-zero/core'
import { opfsUpload, opfsRead, persistSave } from '@obieg-zero/storage'
import { ocrNode } from '@obieg-zero/ocr'
import { embedNode, searchNode } from '@obieg-zero/embed'
import { llmNode } from '@obieg-zero/llm'
import { useApp } from './store.ts'

export const flow = createFlow()

// storage
flow.node('upload', opfsUpload())
flow.node('read-file', opfsRead())
flow.node('save', persistSave({ keys: ['pages', 'chunks', 'extracted'] }))

// ocr
flow.node('ocr', ocrNode({ language: 'pol' }))

// embed + search
flow.node('embed', embedNode({
  model: 'Xenova/multilingual-e5-small',
  dtype: 'q8',
  workerFactory: () => new Worker(
    new URL('@obieg-zero/embed/src/embedding-worker.ts', import.meta.url),
    { type: 'module' },
  ),
}))
flow.node('search', searchNode({ topK: 3 }))

// llm
flow.node('llm', llmNode({ modelUrl: () => useApp.getState().modelUrl, nCtx: 4096, nPredict: 1024 }))

// prompts
flow.node('extract-prompt', templateNode({
  template: `Z dokumentu wyciągnij dane. Podaj TYLKO JSON, nic więcej.

TEKST:
{{context}}

Wyciągnij: {"typ_dokumentu": "<string>", "data": "<YYYY-MM-DD>", "strony": ["<nazwa>"], "kwota": <number|null>, "waluta": "<string>"}

JSON:`,
}))

flow.node('qa-prompt', templateNode({
  template: `Kontekst:\n{{context}}\n\nOdpowiedz zwięźle po polsku: {{query}}`,
}))

flow.node('parse', extractNode({ output: 'extracted' }))
