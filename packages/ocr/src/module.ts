import { defineModule } from '@obieg-zero/core';
import { ocrNode } from './ocr.js';

export const ocrModule = defineModule({
  id: 'ocr',
  label: 'OCR (PDF + Tesseract)',
  settings: {
    language: { type: 'string', label: 'Język OCR', default: 'pol' },
  },
  nodes: (config) => ({
    'ocr': ocrNode({ language: config.language }),
  }),
});
