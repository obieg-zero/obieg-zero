import { defineModule } from '@obieg-zero/core';
import { llmNode } from './llm.js';

const DEFAULT_MODEL_URL = 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf';

export const llmModule = defineModule({
  id: 'llm',
  label: 'LLM (Bielik)',
  settings: {
    modelUrl: { type: 'string', label: 'URL modelu GGUF', default: DEFAULT_MODEL_URL },
    nCtx: { type: 'number', label: 'Kontekst (n_ctx)', default: 8192 },
    nPredict: { type: 'number', label: 'Maks. tokenów odpowiedzi', default: 256 },
    temperature: { type: 'number', label: 'Temperatura', default: 0.3 },
  },
  nodes: (config) => ({
    'llm': llmNode({
      modelUrl: config.modelUrl,
      nCtx: config.nCtx,
      nPredict: config.nPredict,
      temperature: config.temperature,
    }),
  }),
});
