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
    topK: { type: 'number', label: 'Wyniki wyszukiwania (topK)', default: 5 },
  },
  nodes: (config) => ({
    'embed': embedNode({
      model: config.model,
      dtype: config.dtype,
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      workerFactory: config.workerFactory,
    }),
    'search': searchNode({ topK: config.topK }),
  }),
});
