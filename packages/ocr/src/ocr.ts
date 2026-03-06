import type { NodeDef } from '@obieg-zero/core';

// Polyfill for Map.getOrInsertComputed (not yet in all runtimes)
if (!(Map.prototype as any).getOrInsertComputed) {
  (Map.prototype as any).getOrInsertComputed = function <K, V>(
    this: Map<K, V>, key: K, fn: (key: K) => V,
  ): V {
    if (this.has(key)) return this.get(key)!;
    const val = fn(key);
    this.set(key, val);
    return val;
  };
}

export function ocrNode(config?: { language?: string }): NodeDef {
  const language = config?.language ?? 'eng';

  return {
    async run(ctx) {
      const file: File | undefined = ctx.get('file');
      const storedFile = ctx.get('storedFile');
      const target = file ?? storedFile;
      if (!target) throw new Error('ocr: needs $file or $storedFile');

      ctx.progress('Ładuję PDF…');

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

      const arrayBuffer = target instanceof File
        ? await target.arrayBuffer()
        : await (target as File).arrayBuffer();

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const pages: { page: number; text: string }[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        ctx.progress(`Strona ${i}/${pdf.numPages}`, (i / pdf.numPages) * 100);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let text = content.items.map((item: any) => item.str).join(' ').trim();

        // If text layer is empty, fall back to OCR
        if (!text || text.length < 20) {
          ctx.progress(`OCR strona ${i}/${pdf.numPages}…`);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = new OffscreenCanvas(viewport.width, viewport.height);
          const canvasCtx = canvas.getContext('2d')!;
          await page.render({ canvasContext: canvasCtx as any, viewport }).promise;

          const blob = await canvas.convertToBlob({ type: 'image/png' });
          const Tesseract = await import('tesseract.js');
          const result = await (Tesseract as any).default.recognize(blob, language);
          text = result.data.text.trim();
        }

        pages.push({ page: i, text });
      }

      ctx.set('pages', pages);
      ctx.progress('OCR zakończony');
    },
  };
}
