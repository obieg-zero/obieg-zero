import { createLlm } from '@obieg-zero/llm-v2'
import type { BlockDef } from './types'

export const llmBlock: BlockDef = {
  type: 'llm',
  label: 'LLM',
  color: '#16a34a',
  fields: [
    { key: 'prompt', label: 'Prompt ({{context}} = kontekst)' },
    { key: 'modelUrl', label: 'Model URL', default: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf' },
  ],
  defaults: {
    prompt: 'Na podstawie tekstu odpowiedz krotko.\n\nTekst: "{{context}}"\n\nOdpowiedz:',
    modelUrl: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf',
  },
  async run(config, ctx, log) {
    if (!ctx._llm) {
      ctx._llm = await createLlm({
        modelUrl: config.modelUrl,
        wasmPaths: {
          'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
          'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
        },
        nCtx: 512,
        chatTemplate: true,
        onProgress: m => log(`  ${m}`),
      })
    }

    const prompt = config.prompt.replace('{{context}}', ctx.data.context || '(brak kontekstu)')
    const result = await ctx._llm.ask(prompt, { nPredict: 32, temperature: 0 })
    ctx.data.answer = result.text
    log(`Odpowiedz (${result.tokenCount} tok, ${(result.durationMs / 1000).toFixed(1)}s): ${result.text}`)
  },
}
