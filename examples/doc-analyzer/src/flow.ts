import { createFlow, templateNode, extractNode } from '@obieg-zero/core'
import { storageModule } from '@obieg-zero/storage'
import { ocrModule } from '@obieg-zero/ocr'
import { embedModule } from '@obieg-zero/embed'
import { llmModule } from '@obieg-zero/llm'

export const flow = createFlow()

// modules — defaults from packages, overrides where needed
flow.use(storageModule)
flow.use(ocrModule)
flow.use(embedModule, {
  workerFactory: () => new Worker(
    new URL('@obieg-zero/embed/src/embedding-worker.ts', import.meta.url),
    { type: 'module' },
  ),
})
flow.use(llmModule)

// prompts (app-specific, not module defaults)
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
