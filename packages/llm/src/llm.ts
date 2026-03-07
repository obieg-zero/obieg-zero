import type { NodeDef } from '@obieg-zero/core';

export interface LlmConfig {
  modelUrl: string;
  nCtx?: number;
  nPredict?: number;
  temperature?: number;
}

const WASM_CDN = {
  'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/src/single-thread/wllama.wasm',
  'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/src/multi-thread/wllama.wasm',
};

export function llmNode(config: LlmConfig): NodeDef {
  const { modelUrl, nCtx = 4096, nPredict = 256, temperature = 0.3 } = config;
  let wllamaInstance: any = null;

  return {
    dispose() {
      if (wllamaInstance) {
        wllamaInstance.exit().catch(() => {});
        wllamaInstance = null;
      }
    },
    async run(ctx) {
      const prompt = ctx.get('prompt');
      if (!prompt) throw new Error('llm: needs $prompt');
      if (!modelUrl) throw new Error('llm: needs modelUrl');

      if (!wllamaInstance) {
        ctx.progress('Ładuję model…');
        const { Wllama, LoggerWithoutDebug } = await import('@wllama/wllama');
        const instance = new Wllama(WASM_CDN, {
          logger: LoggerWithoutDebug,
          allowOffline: true,
        });

        try {
          await instance.loadModelFromUrl(modelUrl, {
            n_ctx: nCtx,
            n_batch: 256,
            progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
              const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
              ctx.progress(`Pobieranie modelu ${pct}%`, pct);
            },
          });
        } catch (err) {
          instance.exit().catch(() => {});
          throw err;
        }

        wllamaInstance = instance;
        ctx.set('llmReady', true);
        ctx.progress('Model gotowy');
      }

      ctx.progress('Generuję odpowiedź…');

      const onToken = ctx.get('onToken');
      let fullText = '';

      const result = await wllamaInstance.createChatCompletion(
        [{ role: 'user', content: prompt }] as any,
        {
          nPredict,
          sampling: { temp: temperature, top_p: 0.9, top_k: 40 },
          useCache: true,
          onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
            fullText = currentText;
            if (onToken) onToken(currentText);
          },
        } as any,
      );

      const answer = typeof result === 'string' ? result : fullText;
      ctx.set('answer', answer);
      ctx.progress('Gotowe');
    },
  };
}
