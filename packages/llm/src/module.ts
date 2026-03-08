import { defineModule } from '@obieg-zero/core';
import { llmNode, type LlmConfig } from './llm.js';

const DEFAULT_MODEL_URL = 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf';

export const llmModule = defineModule({
  id: 'llm',
  label: 'LLM (Bielik)',
  settings: {
    modelUrl: { type: 'string', label: 'Model GGUF URL', default: DEFAULT_MODEL_URL },
    nCtx: { type: 'number', label: 'Context window (n_ctx)', default: 2048 },
    nPredict: { type: 'number', label: 'Max output tokens', default: 512 },
    temperature: { type: 'number', label: 'Temperature', default: 0.3 },
    topP: { type: 'number', label: 'Top P', default: 0.9 },
    topK: { type: 'number', label: 'Top K', default: 40 },
    timeout: { type: 'number', label: 'Timeout (ms)', default: 300000 },
  },
  nodes: (config) => ({
    'llm': llmNode(config as LlmConfig),
  }),
});
