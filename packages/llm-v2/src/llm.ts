export interface LlmHandle {
  ask(prompt: string, opts?: AskOpts): Promise<AskResult>
  dispose(): Promise<void>
}

export interface AskResult {
  text: string
  tokenCount: number
  durationMs: number
  usedTemplate: boolean
}

export interface AskOpts {
  nPredict?: number
  temperature?: number
  topP?: number
  topK?: number
  onToken?: (text: string) => void
}

export interface LlmOpts {
  modelUrl: string
  wasmPaths: Record<string, string>
  nCtx?: number
  chatTemplate?: boolean
  onProgress?: (msg: string) => void
}

export async function createLlm(opts: LlmOpts): Promise<LlmHandle> {
  const { modelUrl, wasmPaths, nCtx = 2048, chatTemplate = true, onProgress } = opts

  if (!modelUrl) throw new Error('llm: modelUrl is required')
  if (nCtx < 128) throw new Error(`llm: nCtx=${nCtx} too small (min 128)`)

  const { Wllama } = await import('@wllama/wllama')
  const wllama = new Wllama(wasmPaths as any)

  onProgress?.('Downloading model…')
  await wllama.loadModelFromUrl(modelUrl, {
    n_ctx: nCtx,
    progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
      if (total > 0) onProgress?.(`Model ${Math.round(loaded / total * 100)}%`)
    },
  })
  onProgress?.('Model ready')

  return {
    async ask(prompt, askOpts = {}) {
      const { nPredict = 64, temperature = 0.1, topP = 0.9, topK = 20, onToken } = askOpts

      let formatted = prompt
      let usedTemplate = false
      if (chatTemplate) {
        try {
          formatted = await wllama.formatChat([{ role: 'user', content: prompt }], true)
          usedTemplate = true
        } catch (err) {
          onProgress?.(`Chat template failed, using raw prompt: ${err}`)
        }
      }

      let tokenCount = 0
      const t0 = Date.now()

      const result = await wllama.createCompletion(formatted, {
        nPredict,
        sampling: { temp: temperature, top_p: topP, top_k: topK },
        onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
          tokenCount++
          onToken?.(currentText)
        },
      } as any)

      const text = (typeof result === 'string' ? result : (result as any)?.response ?? '').trim()
      const durationMs = Date.now() - t0

      if (!text) onProgress?.('Warning: LLM returned empty response')

      return { text, tokenCount, durationMs, usedTemplate }
    },

    async dispose() {
      try {
        await wllama.exit()
      } catch (err) {
        onProgress?.(`LLM dispose error: ${err}`)
      }
    },
  }
}
