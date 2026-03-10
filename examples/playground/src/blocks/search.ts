import { search } from '@obieg-zero/embed-v2'
import type { BlockDef } from './types'

export const searchBlock: BlockDef = {
  type: 'search',
  label: 'Search',
  color: '#2563eb',
  fields: [
    { key: 'query', label: 'Zapytanie' },
    { key: 'topK', label: 'Top K', default: '3' },
  ],
  defaults: { query: '', topK: '3' },
  async run(config, ctx, log) {
    if (!ctx.data.chunks?.length || !ctx.data._embedFn) { log('Brak chunks — dodaj Embed przed Search'); return }
    if (!config.query) { log('Brak zapytania'); return }

    const results = await search(ctx.data.chunks, config.query, ctx.data._embedFn, {
      topK: parseInt(config.topK) || 3,
      minWordLength: 2,
    })
    ctx.data.searchResults = results
    ctx.data.context = results.map(r => r.text).join('\n\n')
    for (const r of results) log(`  [${r.score.toFixed(3)}] str.${r.page}: ${r.text.slice(0, 80)}...`)
  },
}
