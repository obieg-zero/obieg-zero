import { ocrFile } from '@obieg-zero/ocr-v2'
import type { BlockDef } from './types'
import { opfs } from './types'

export const parseBlock: BlockDef = {
  type: 'ocr',
  label: 'Parse',
  color: '#ea580c',
  fields: [{ key: 'language', label: 'Jezyk OCR', default: 'pol' }],
  defaults: { language: 'pol' },
  async run(config, ctx, log) {
    const project = ctx.data.project || 'default'
    const files = await opfs.listFiles(project)
    if (files.length === 0) { log('Brak plikow w projekcie'); return }

    const allPages: { page: number; text: string }[] = []
    let pageNum = 1

    for (const filename of files) {
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      log(`Parse: ${filename} (${ext})`)

      if (ext === 'pdf') {
        const file = await opfs.readFile(project, filename)
        const pages = await ocrFile(file, { language: config.language || 'pol', onProgress: m => log(`  ${m}`) })
        for (const p of pages) allPages.push({ page: pageNum++, text: `[${filename}] ${p.text}` })
      } else if (ext === 'csv' || ext === 'tsv') {
        const file = await opfs.readFile(project, filename)
        const text = await file.text()
        const lines = text.split('\n')
        const header = lines[0] || ''
        for (let i = 1; i < lines.length; i += 20) {
          const chunk = [header, ...lines.slice(i, i + 20)].join('\n')
          allPages.push({ page: pageNum++, text: `[${filename}] ${chunk}` })
        }
      } else {
        const file = await opfs.readFile(project, filename)
        const text = await file.text()
        allPages.push({ page: pageNum++, text: `[${filename}] ${text}` })
      }
    }

    ctx.data.pages = allPages
    log(`Parse: ${allPages.length} stron, ${allPages.reduce((s, p) => s + p.text.length, 0)} zn.`)
  },
}
