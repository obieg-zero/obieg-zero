import { createFlow, templateNode } from '@obieg-zero/core'
import { storageModule } from '@obieg-zero/storage'
import { ocrModule } from '@obieg-zero/ocr'
import { embedModule } from '@obieg-zero/embed'
import { llmModule } from '@obieg-zero/llm'

export const flow = createFlow()

flow.use(storageModule)
flow.use(ocrModule)
flow.use(embedModule, {
  topK: 3, chunkSize: 200,
  workerFactory: () => new Worker(
    new URL('@obieg-zero/embed/src/embedding-worker.ts', import.meta.url),
    { type: 'module' },
  ),
})
flow.use(llmModule, { nPredict: 150, temperature: 0.1 })

// llm prompt assembled from query + context
flow.node('qa-prompt', templateNode({
  template: `Kontekst:\n{{context}}\n\nOdpowiedz zwięźle po polsku: {{query}}`,
  output: 'prompt',
}))

export const PIPELINE_INGEST = ['upload', 'ocr', 'embed', 'save'] as const
export const PIPELINE_QA = ['search', 'qa-prompt', 'llm'] as const
