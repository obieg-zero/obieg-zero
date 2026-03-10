import { createEmbedder } from '@obieg-zero/embed-v2'
import type { BlockDef } from './types'

export const embedBlock: BlockDef = {
  type: 'embed',
  label: 'Embed',
  color: '#7c3aed',
  fields: [
    { key: 'model', label: 'Model', default: 'Xenova/multilingual-e5-small' },
    { key: 'chunkSize', label: 'Chunk (zn)', default: '200' },
  ],
  defaults: { model: 'Xenova/multilingual-e5-small', chunkSize: '200' },
  async run(config, ctx, log) {
    if (!ctx.data.pages?.length) { log('Brak stron — dodaj OCR przed Embed'); return }

    if (!ctx._embedder) {
      ctx._embedder = await createEmbedder({ model: config.model, dtype: 'q8', onProgress: m => log(`  ${m}`) })
    }
    const index = await ctx._embedder.createIndex(ctx.data.pages, {
      chunkSize: parseInt(config.chunkSize) || 200,
      onProgress: m => log(`  ${m}`),
    })
    ctx.data.chunks = index.chunks
    ctx.data._embedFn = index.embed
    log(`Embed: ${index.chunks.length} chunks po ~${config.chunkSize} zn. z ${ctx.data.pages.length} stron`)
    for (let i = 0; i < Math.min(3, index.chunks.length); i++) {
      log(`  chunk[${i}]: "${index.chunks[i].text.slice(0, 100)}..."`)
    }
    if (index.chunks.length > 3) log(`  ...i ${index.chunks.length - 3} wiecej`)
  },
}
