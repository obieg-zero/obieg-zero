import { createFlow, templateNode, extractNode } from '@obieg-zero/core'
import { storageModule, createIdbCache, opfsUpload, opfsRead } from '@obieg-zero/storage'
import { ocrModule } from '@obieg-zero/ocr'
import { embedModule } from '@obieg-zero/embed'
import { llmModule } from '@obieg-zero/llm'

// single source of truth for node IDs
export const NODES = {
  OCR: 'ocr',
  EMBED: 'embed',
  SEARCH: 'search',
  QA_PROMPT: 'qa-prompt',
  LLM: 'llm',
  TPL: 'tpl',
  UPLOAD: 'opfs-upload',
  LOAD_FILE: 'opfs-read',
  EXTRACT: 'extract',
} as const

export const TPL_OUTPUT = 'templateResult'

export const flow = createFlow()

flow.cache(createIdbCache('workbench'))
flow.use(storageModule)
flow.use(ocrModule)
flow.use(embedModule, {
  topK: 3, chunkSize: 200, chunkOverlap: 30, maxContextChars: 1500,
  workerFactory: () => new Worker(
    new URL('@obieg-zero/embed/src/embedding-worker.ts', import.meta.url),
    { type: 'module' },
  ),
})
flow.use(llmModule, { nCtx: 2048, nPredict: 256 })

flow.node(NODES.QA_PROMPT, templateNode({
  template: `Context:\n{{context}}\n\nQuestion: {{query}}`,
  output: 'prompt',
}))
flow.node(NODES.UPLOAD, opfsUpload())
flow.node(NODES.LOAD_FILE, opfsRead())
flow.node(NODES.EXTRACT, extractNode())
