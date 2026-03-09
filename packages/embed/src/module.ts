import { defineModule } from '@obieg-zero/core';
import { embedNode } from './embed.js';
import { searchNode } from './search.js';

export const embedModule = defineModule({
  id: 'embed',
  label: 'Embedding + Search',
  settings: {
    model: { type: 'string', label: 'Model embeddingów' },
    dtype: { type: 'string', label: 'Precyzja' },
    chunkSize: { type: 'number', label: 'Rozmiar chunka (słowa)' },
    chunkOverlap: { type: 'number', label: 'Overlap chunków (słowa)' },
    minChunkLength: { type: 'number', label: 'Min. długość chunka (znaki)' },
    topK: { type: 'number', label: 'Wyniki wyszukiwania (topK)' },
    keywordBoost: { type: 'number', label: 'Waga keyword boost' },
    maxContextChars: { type: 'number', label: 'Max context do LLM (znaki)' },
    embedTimeout: { type: 'number', label: 'Timeout embeddingu (ms)' },
  },
  nodes: () => ({
    'embed': embedNode(),
    'search': searchNode(),
  }),
});
