import { createFlow, extractNode } from '@obieg-zero/core'
import { storageModule } from '@obieg-zero/storage'
import { ocrModule } from '@obieg-zero/ocr'
import { embedModule } from '@obieg-zero/embed'
import { llmModule } from '@obieg-zero/llm'

export const flow = createFlow()

flow.use(storageModule)
flow.use(ocrModule)
flow.use(embedModule, {
  workerFactory: () => new Worker(
    new URL('@obieg-zero/embed/src/embedding-worker.ts', import.meta.url),
    { type: 'module' },
  ),
})
flow.use(llmModule, {
  wasmPaths: {
    'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
    'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
  },
})
flow.node('extract', extractNode())
