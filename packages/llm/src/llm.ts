import type { NodeDef } from '@obieg-zero/core';

export function llmNode(): NodeDef {
  let wllama: any = null;
  let loadedModelUrl: string | null = null;

  return {
    reads: ['prompt'],
    writes: ['answer'],
    dispose() {
      if (wllama) { wllama.exit().catch(() => {}); wllama = null; loadedModelUrl = null; }
    },
    async run(ctx) {
      const prompt = ctx.get('prompt');
      if (!prompt) throw new Error('llm: needs $prompt');

      const modelUrl = ctx.get('modelUrl');
      if (!modelUrl) throw new Error('llm: needs modelUrl in config');

      const nCtx = ctx.get('nCtx');
      const nPredict = ctx.get('nPredict');
      const temperature = ctx.get('temperature');
      const topP = ctx.get('topP');
      const topK = ctx.get('topK');
      const timeout = ctx.get('timeout');
      const chatTemplate = ctx.get('chatTemplate');

      const t0 = Date.now();
      const log = (msg: string) => console.log(`[llm +${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

      // Load or reload model if URL changed
      if (wllama && loadedModelUrl !== modelUrl) {
        log(`Model URL changed, reloading…`);
        await wllama.exit().catch(() => {});
        wllama = null;
        loadedModelUrl = null;
      }

      if (!wllama) {
        ctx.progress('Loading model…');
        log(`Loading wllama…`);
        const { Wllama } = await import('@wllama/wllama');
        const wasmPaths = ctx.get('wasmPaths');
        if (!wasmPaths) throw new Error('llm: needs wasmPaths in config');
        wllama = new Wllama(wasmPaths as any);
        log(`Loading model from ${modelUrl.split('/').pop()}, nCtx=${nCtx}`);
        await wllama.loadModelFromUrl(modelUrl, {
          n_ctx: nCtx,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            ctx.progress(`Downloading model ${total > 0 ? Math.round((loaded / total) * 100) : 0}%`);
          },
        });
        loadedModelUrl = modelUrl;
        log(`Model loaded`);
        ctx.set('llmReady', true);
      }

      // Apply chat template if configured
      let formatted: string;
      if (chatTemplate) {
        try {
          formatted = await wllama.formatChat(
            [{ role: 'user', content: prompt }],
            true,
          );
          log(`Chat template applied, ${prompt.length} → ${formatted.length} chars`);
        } catch {
          formatted = prompt;
          log(`formatChat failed, using raw prompt`);
        }
      } else {
        formatted = prompt;
      }

      const estimatedTokens = Math.ceil(formatted.length / 3);
      if (estimatedTokens + nPredict > nCtx) {
        throw new Error(`llm: prompt too long (~${estimatedTokens} tokens) + nPredict(${nPredict}) > nCtx(${nCtx}). Trim context or raise nCtx.`);
      }

      log(`Prompt: ${formatted.length} chars, ~${estimatedTokens} tokens, nPredict=${nPredict}, nCtx=${nCtx}, chatTemplate=${chatTemplate}`);
      ctx.progress(`Processing prompt (~${estimatedTokens} tokens)…`);
      const onToken = ctx.get('onToken');
      let fullText = '';
      let tokenCount = 0;

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeout);
      const heartbeat = setInterval(() => {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        ctx.progress(`Processing… ${elapsed}s, ${tokenCount} tokens`);
      }, 10_000);

      let result: any;
      try {
        result = await wllama.createCompletion(formatted, {
          nPredict,
          sampling: { temp: temperature, top_p: topP, top_k: topK },
          abortSignal: abort.signal,
          onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
            if (!tokenCount) log(`First token! Prompt processing took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            fullText = currentText;
            tokenCount++;
            ctx.progress(`Token ${tokenCount}/${nPredict}`, (tokenCount / nPredict) * 100);
            if (onToken) onToken(currentText);
          },
        } as any);
      } catch (err) {
        log(`Error: ${err}`);
        if (abort.signal.aborted) {
          wllama.exit().catch(() => {});
          wllama = null;
          loadedModelUrl = null;
          throw new Error(`llm: timeout (${Math.round(timeout / 1000)}s, ${tokenCount} tokens generated)`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
        clearInterval(heartbeat);
      }

      log(`Done: ${tokenCount} tokens`);
      const answer = typeof result === 'string' ? result
        : result && typeof result === 'object' && 'response' in result ? (result as any).response
        : fullText;
      ctx.set('answer', answer);
      ctx.progress('Done');
    },
  };
}
