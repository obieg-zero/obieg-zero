import type { NodeDef } from '@obieg-zero/core';

export function ocrNode(config?: { language?: string; ocrThreshold?: number; scale?: number }): NodeDef {
  const { language = 'pol', ocrThreshold = 20, scale = 2 } = config ?? {};

  return {
    reads: ['file', 'language', 'ocrThreshold', 'scale'],
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
        // Sort items by position: top-to-bottom (Y descending in PDF coords), then left-to-right
        const items = content.items
          .filter((item: any) => typeof item.str === 'string' && item.str.length > 0 && item.transform)
          .map((item: any) => ({
            str: item.str,
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
            h: item.height ?? item.transform[3] ?? 12,
          }))
          .sort((a: any, b: any) => {
            const lineThreshold = Math.min(a.h, b.h) * 0.5;
            if (Math.abs(a.y - b.y) < lineThreshold) return a.x - b.x;
            return b.y - a.y;
          });
        let text = '';
        let prevY = items.length > 0 ? items[0].y : 0;
        let prevH = items.length > 0 ? items[0].h : 12;
        for (const item of items) {
          const gap = Math.abs(prevY - item.y);
          if (text.length > 0) {
            const th = Math.min(prevH, item.h) * 0.5;
            text += gap > th ? '\n' : ' ';
          }
          text += item.str;
          prevY = item.y;
          prevH = item.h;
        }
        text = text.trim();

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
