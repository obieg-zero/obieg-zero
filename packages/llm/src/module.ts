import { defineModule } from '@obieg-zero/core';
import { llmNode } from './llm.js';

export const llmModule = defineModule({
  id: 'llm',
  label: 'LLM',
  settings: {
    modelUrl: { type: 'string', label: 'Model GGUF URL' },
    chatTemplate: { type: 'boolean', label: 'Chat template (Instruct)' },
    nCtx: { type: 'number', label: 'Context window (n_ctx)' },
    nPredict: { type: 'number', label: 'Max output tokens' },
    temperature: { type: 'number', label: 'Temperature' },
    topP: { type: 'number', label: 'Top P' },
    topK: { type: 'number', label: 'Top K' },
    timeout: { type: 'number', label: 'Timeout (ms)' },
  },
  nodes: () => ({
    'llm': llmNode(),
  }),
});
