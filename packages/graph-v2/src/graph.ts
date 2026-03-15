import Dexie from 'dexie'

export interface GraphNode {
  id: string
  type: string
  label: string
  data: Record<string, unknown>
  trace?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  type: string
  label: string
  data?: Record<string, unknown>
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphDB {
  addNodes(nodes: GraphNode[]): Promise<void>
  addEdges(edges: GraphEdge[]): Promise<void>
  removeNode(id: string): Promise<void>
  removeEdge(id: string): Promise<void>
  updateNode(id: string, data: Record<string, unknown>): Promise<void>
  getGraph(): Promise<Graph>
  getContext(nodeId: string, maxHops?: number): Promise<Graph>
  clear(): Promise<void>
  dispose(): void
}

class GraphDexie extends Dexie {
  nodes!: Dexie.Table<GraphNode, string>
  edges!: Dexie.Table<GraphEdge, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      nodes: 'id, type',
      edges: 'id, from, to, type',
    })
  }
}

export async function createGraphDB(name: string): Promise<GraphDB> {
  const db = new GraphDexie(name)

  return {
    async addNodes(nodes) {
      await db.nodes.bulkPut(nodes)
    },

    async addEdges(edges) {
      await db.edges.bulkPut(edges)
    },

    async removeNode(id) {
      await db.nodes.delete(id)
    },

    async removeEdge(id) {
      await db.edges.delete(id)
    },

    async updateNode(id, data) {
      const node = await db.nodes.get(id)
      if (node) await db.nodes.put({ ...node, data: { ...node.data, ...data } })
    },

    async getGraph() {
      const [nodes, edges] = await Promise.all([
        db.nodes.toArray(),
        db.edges.toArray(),
      ])
      return { nodes, edges }
    },

    async getContext(nodeId, maxHops = 2) {
      const visitedNodes = new Set<string>()
      const visitedEdges = new Set<string>()
      const frontier = [nodeId]

      for (let hop = 0; hop <= maxHops && frontier.length > 0; hop++) {
        const batch = [...frontier]
        frontier.length = 0

        for (const nid of batch) {
          if (visitedNodes.has(nid)) continue
          visitedNodes.add(nid)

          const [from, to] = await Promise.all([
            db.edges.where('from').equals(nid).toArray(),
            db.edges.where('to').equals(nid).toArray(),
          ])
          for (const e of [...from, ...to]) {
            visitedEdges.add(e.id)
            const neighbor = e.from === nid ? e.to : e.from
            if (!visitedNodes.has(neighbor)) frontier.push(neighbor)
          }
        }
      }

      const nodes = (await db.nodes.bulkGet([...visitedNodes])).filter((n): n is GraphNode => n !== undefined)
      const edges = (await db.edges.bulkGet([...visitedEdges])).filter((e): e is GraphEdge => e !== undefined)
      return { nodes, edges }
    },

    async clear() {
      await db.transaction('rw', db.nodes, db.edges, async () => {
        await db.nodes.clear()
        await db.edges.clear()
      })
    },

    dispose() {
      db.close()
    },
  }
}
