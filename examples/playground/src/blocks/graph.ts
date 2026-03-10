import type { BlockDef } from './types'

export const graphBlock: BlockDef = {
  type: 'graph',
  label: 'Graph',
  color: '#dc2626',
  fields: [],
  defaults: {},
  async run(_config, ctx, log) {
    if (!ctx._graph) { log('Brak grafu — dodaj Extract przed Graph'); return }
    const graph = await ctx._graph.getGraph()
    ctx.data.graph = graph

    const byType = new Map<string, number>()
    graph.nodes.forEach(n => byType.set(n.type, (byType.get(n.type) || 0) + 1))
    log(`Graf: ${graph.nodes.length} encji, ${graph.edges.length} relacji`)
    for (const [type, count] of byType) log(`  ${type}: ${count}`)
  },
}
