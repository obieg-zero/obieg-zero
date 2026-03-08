import { defineModule } from '@obieg-zero/core';
import { ocrNode } from './ocr.js';

export const ocrModule = defineModule({
  id: 'ocr',
  label: 'OCR (PDF + Tesseract)',
  settings: {
    language: { type: 'string', label: 'Język OCR', default: 'pol' },
    ocrThreshold: { type: 'number', label: 'Min. znaków (poniżej = OCR)', default: 20 },
    scale: { type: 'number', label: 'Skala renderowania', default: 2 },
  },
  nodes: (config) => ({
    'ocr': ocrNode(config),
  }),
});
