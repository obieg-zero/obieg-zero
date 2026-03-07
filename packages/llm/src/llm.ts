import type { NodeDef } from '@obieg-zero/core';

export interface LlmConfig {
  modelUrl: string;
  nCtx?: number;
  nPredict?: number;
  temperature?: number;
}

export function llmNode(config: LlmConfig): NodeDef {
  const { modelUrl, nCtx = 2048, nPredict = 512, temperature = 0.3 } = config;
  let wllamaInstance: any = null;

  return {
    async run(ctx) {
      const prompt = ctx.get('prompt');
      const query = ctx.get('query');
      const context = ctx.get('context');

      const finalPrompt = prompt
        ?? (query && context ? `Kontekst:\n${context}\n\nPytanie: ${query}\n\nOdpowiedź:` : null);

      if (!finalPrompt) throw new Error('llm: needs $prompt or ($query + $context)');

      const effectiveUrl = ctx.get('modelUrl') ?? modelUrl;

      if (!wllamaInstance) {
        ctx.progress('Ładuję model…');
        const { Wllama } = await import('@wllama/wllama');
        wllamaInstance = new Wllama({
          'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
          'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
        } as any);

        await wllamaInstance.loadModelFromUrl(effectiveUrl, {
          n_ctx: nCtx,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
            ctx.progress(`Pobieranie modelu ${pct}%`, pct);
          },
        });

        ctx.set('llmReady', true);
        ctx.progress('Model gotowy');
      }

      ctx.progress('Generuję odpowiedź…');

      const onToken = ctx.get('onToken');
      let fullText = '';

      const result = await wllamaInstance.createChatCompletion(
        [{ role: 'user', content: finalPrompt }] as any,
        {
          nPredict,
          sampling: { temp: temperature },
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
