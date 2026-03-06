import { pipeline } from '@huggingface/transformers';

let extractor: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { id, text, model, dtype } = e.data;
  try {
    if (!extractor) {
      extractor = await (pipeline as any)('feature-extraction', model, { dtype });
    }
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    self.postMessage({ id, embedding });
  } catch (err: any) {
    self.postMessage({ id, error: err.message ?? String(err) });
  }
};
