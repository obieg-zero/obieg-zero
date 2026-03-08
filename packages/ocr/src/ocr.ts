import type { NodeDef } from '@obieg-zero/core';

export function ocrNode(config?: { language?: string; ocrThreshold?: number; scale?: number }): NodeDef {
  const { language = 'pol', ocrThreshold = 20, scale = 2 } = config ?? {};

  return {
    reads: ['file'],
    writes: ['pages'],
    async run(ctx) {
      const file: File | undefined = ctx.get('file');
      if (!file || !(file instanceof File)) throw new Error('ocr: needs $file (File object)');

      ctx.progress('Loading PDF…');
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages: { page: number; text: string }[] = [];
      const lang = ctx.get('language') ?? language;
      const threshold = ctx.get('ocrThreshold') ?? ocrThreshold;
      const sc = ctx.get('scale') ?? scale;

      for (let i = 1; i <= pdf.numPages; i++) {
        ctx.progress(`Page ${i}/${pdf.numPages}`, (i / pdf.numPages) * 100);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let text = content.items.map((item: any) => item.str).join(' ').trim();

        if (!text || text.replace(/\s+/g, '').length < threshold) {
          const viewport = page.getViewport({ scale: sc });
          const canvas = new OffscreenCanvas(viewport.width, viewport.height);
          const renderCtx = canvas.getContext('2d');
          if (!renderCtx) throw new Error(`ocr: failed to create canvas context for page ${i}`);
          await page.render({ canvasContext: renderCtx as any, viewport }).promise;

          const blob = await canvas.convertToBlob({ type: 'image/png' });
          const Tesseract = await import('tesseract.js');
          text = ((await (Tesseract as any).default.recognize(blob, lang)).data.text as string).trim();
        }

        pages.push({ page: i, text });
      }

      ctx.set('pages', pages);
      ctx.progress('Done');
    },
  };
}
