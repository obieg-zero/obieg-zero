export interface Page { page: number; text: string }

export interface OcrOpts {
  language?: string
  ocrThreshold?: number
  scale?: number
  maxFileSize?: number
  workerSrc?: string
  onProgress?: (msg: string) => void
}

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

export async function ocrFile(file: File, opts: OcrOpts = {}): Promise<Page[]> {
  const {
    language,
    ocrThreshold = 20,
    scale = 2,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    workerSrc,
    onProgress,
  } = opts

  if (file.size > maxFileSize) {
    throw new Error(`ocr: file "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB, max ${(maxFileSize / 1024 / 1024).toFixed(0)} MB`)
  }

  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc || new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href
  }

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: Page[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Page ${i}/${pdf.numPages}`)

    let text = ''
    try {
      text = await extractTextFromPage(pdf, i)
    } catch (err) {
      onProgress?.(`Page ${i}: text extraction failed: ${err}`)
    }

    if (!text || text.replace(/\s+/g, '').length < ocrThreshold) {
      onProgress?.(`Page ${i}: OCR fallback`)
      try {
        text = await ocrPage(pdf, i, scale, language)
      } catch (err) {
        onProgress?.(`Page ${i}: OCR failed: ${err}`)
        text = ''
      }
    }

    pages.push({ page: i, text })
  }

  return pages
}

async function extractTextFromPage(pdf: any, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const content = await page.getTextContent()
  const items = content.items
    .filter((it: any) => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform) && it.transform.length >= 6)
    .map((it: any) => ({
      str: it.str,
      x: it.transform[4] ?? 0,
      y: it.transform[5] ?? 0,
      h: it.height ?? it.transform[3] ?? 12,
    }))
    .sort((a: any, b: any) => {
      const th = Math.min(a.h, b.h) * 0.5
      return Math.abs(a.y - b.y) < th ? a.x - b.x : b.y - a.y
    })

  let text = ''
  let prevY = items[0]?.y ?? 0
  let prevH = items[0]?.h ?? 12
  for (const item of items) {
    const gap = Math.abs(prevY - item.y)
    if (text.length > 0) text += gap > Math.min(prevH, item.h) * 0.5 ? '\n' : ' '
    text += item.str
    prevY = item.y
    prevH = item.h
  }

  return text.trim()
}

async function ocrPage(pdf: any, pageNum: number, scale: number, language?: string): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = new OffscreenCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(`ocr: canvas context failed for page ${pageNum}`)
  await page.render({ canvasContext: ctx as any, viewport }).promise

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const Tesseract = await import('tesseract.js')
  const result = await (Tesseract as any).default.recognize(blob, language)
  const text = result?.data?.text
  if (typeof text !== 'string') throw new Error(`ocr: Tesseract returned no text for page ${pageNum}`)
  return text.trim()
}
