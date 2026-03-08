import { createFlow, templateNode } from '@obieg-zero/core'
import { storageModule, createIdbCache } from '@obieg-zero/storage'
import { ocrModule } from '@obieg-zero/ocr'
import { embedModule } from '@obieg-zero/embed'
import { llmModule } from '@obieg-zero/llm'

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

flow.node('qa-prompt', templateNode({
  template: `Context:\n{{context}}\n\nAnswer concisely in Polish: {{query}}`,
  output: 'prompt',
}))
