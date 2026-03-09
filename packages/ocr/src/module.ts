import { defineModule } from '@obieg-zero/core';
import { ocrNode } from './ocr.js';

export const ocrModule = defineModule({
  id: 'ocr',
  label: 'OCR (PDF + Tesseract)',
  settings: {
    language: { type: 'string', label: 'Język OCR' },
    ocrThreshold: { type: 'number', label: 'Min. znaków (poniżej = OCR)' },
    scale: { type: 'number', label: 'Skala renderowania' },
  },
  nodes: () => ({
    'ocr': ocrNode(),
  }),
});
