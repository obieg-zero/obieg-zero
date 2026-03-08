import type { NodeDef } from '@obieg-zero/core';

export interface LlmConfig {
  modelUrl: string;
  nCtx?: number;
  nPredict?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  timeout?: number;
  wasmPaths?: Record<string, string>;
}

export function llmNode(config: LlmConfig): NodeDef {
  const {
    modelUrl, nCtx = 2048, nPredict = 512,
    temperature = 0.3, topP = 0.9, topK = 40,
    timeout = 300_000, wasmPaths,
  } = config;
  let wllama: any = null;

  return {
    reads: ['prompt'],
    writes: ['answer'],
    dispose() {
      if (wllama) { wllama.exit().catch(() => {}); wllama = null; }
    },
    async run(ctx) {
      const prompt = ctx.get('prompt');
      if (!prompt) throw new Error('llm: needs $prompt');

      // guard: estimate tokens (~4 chars/token for latin, ~2 for polish)
      const estimatedTokens = Math.ceil(prompt.length / 3);
      const ctxSize = ctx.get('nCtx') ?? nCtx;
      const np = ctx.get('nPredict') ?? nPredict;
      if (estimatedTokens + np > ctxSize) {
        throw new Error(`llm: prompt too long (~${estimatedTokens} tokens) + nPredict(${np}) > nCtx(${ctxSize}). Trim context or raise nCtx.`);
      }

      if (!wllama) {
        ctx.progress('Loading model…');
        const { Wllama } = await import('@wllama/wllama');
        const paths = wasmPaths ?? {
          'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
          'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
        };
        wllama = new Wllama(paths as any);
        await wllama.loadModelFromUrl(modelUrl, {
          n_ctx: ctxSize,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            ctx.progress(`Downloading model ${total > 0 ? Math.round((loaded / total) * 100) : 0}%`);
          },
        });
        ctx.set('llmReady', true);
      }

      ctx.progress(`Generating… (prompt: ${prompt.length} chars, max tokens: ${np})`);
      const onToken = ctx.get('onToken');
      let fullText = '';
      let tokenCount = 0;

      const t = ctx.get('timeout') ?? timeout;

      const completion = wllama.createCompletion(prompt, {
        nPredict: np,
        sampling: {
          temp: ctx.get('temperature') ?? temperature,
          top_p: ctx.get('topP') ?? topP,
          top_k: ctx.get('topK') ?? topK,
        },
        onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
          fullText = currentText;
          tokenCount++;
          ctx.progress(`Token ${tokenCount}/${np}`, (tokenCount / np) * 100);
          if (onToken) onToken(currentText);
        },
      } as any);

      let result: any;
      try {
        result = await Promise.race([
          completion,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(
            `llm: timeout (${Math.round(t / 1000)}s, ${tokenCount} tokens generated)`
          )), t)),
        ]);
      } catch (err) {
        wllama.exit().catch(() => {});
        wllama = null;
        throw err;
      }

      const answer = typeof result === 'string' ? result
        : result && typeof result === 'object' && 'response' in result ? (result as any).response
        : fullText;
      ctx.set('answer', answer);
      ctx.progress('Done');
    },
  };
}
