import { defineModule } from '@obieg-zero/core';
import { embedNode } from './embed.js';
import { searchNode } from './search.js';

export const embedModule = defineModule({
  id: 'embed',
  label: 'Embedding + Search',
  settings: {
    model: { type: 'string', label: 'Model embeddingów', default: 'Xenova/multilingual-e5-small' },
    dtype: { type: 'string', label: 'Precyzja', default: 'q8' },
    chunkSize: { type: 'number', label: 'Rozmiar chunka (słowa)', default: 500 },
    chunkOverlap: { type: 'number', label: 'Overlap chunków (słowa)', default: 50 },
    minChunkLength: { type: 'number', label: 'Min. długość chunka (znaki)', default: 10 },
    topK: { type: 'number', label: 'Wyniki wyszukiwania (topK)', default: 5 },
    keywordBoost: { type: 'number', label: 'Waga keyword boost', default: 0.05 },
    maxContextChars: { type: 'number', label: 'Max context do LLM (znaki)', default: 2000 },
    embedTimeout: { type: 'number', label: 'Timeout embeddingu (ms)', default: 60000 },
  },
  nodes: (config) => ({
    'embed': embedNode({
      model: config.model, dtype: config.dtype,
      chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap,
      minChunkLength: config.minChunkLength, timeout: config.embedTimeout,
      workerFactory: config.workerFactory,
    }),
    'search': searchNode({ topK: config.topK, keywordBoost: config.keywordBoost, maxContextChars: config.maxContextChars }),
  }),
});
