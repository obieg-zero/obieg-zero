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
  // single ops
  addNode(node: GraphNode): Promise<void>
  getNode(id: string): Promise<GraphNode | undefined>
  updateNode(id: string, patch: Omit<Partial<GraphNode>, 'id'>): Promise<void>
  removeNode(id: string): Promise<void>

  // batch ops
  addNodes(nodes: GraphNode[]): Promise<void>
  addEdges(edges: GraphEdge[]): Promise<void>

  // queries
  getNodesByType(type: string): Promise<GraphNode[]>
  queryNodes(predicate: (n: GraphNode) => boolean): Promise<GraphNode[]>
  getAllNodes(): Promise<GraphNode[]>

  // edges
  addEdge(edge: GraphEdge): Promise<void>
  getEdge(id: string): Promise<GraphEdge | undefined>
  removeEdge(id: string): Promise<void>
  getEdgesFrom(nodeId: string): Promise<GraphEdge[]>
  getEdgesTo(nodeId: string): Promise<GraphEdge[]>
  getAllEdges(): Promise<GraphEdge[]>

  // traversal
  getNeighbors(nodeId: string): Promise<GraphNode[]>
  getContext(nodeId: string, maxHops?: number): Promise<Graph>

  // bulk
  getGraph(): Promise<Graph>
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

  const h: GraphDB = {
    async addNode(node) {
      await db.nodes.put(node)
    },

    async addNodes(nodes) {
      await db.nodes.bulkPut(nodes)
    },

    async getNode(id) {
      return db.nodes.get(id)
    },

    async updateNode(id, patch) {
      const count = await db.nodes.where('id').equals(id).count()
      if (count === 0) throw new Error(`Node ${id} not found`)
      await db.nodes.update(id, patch)
    },

    async removeNode(id) {
      await db.transaction('rw', db.nodes, db.edges, async () => {
        await db.edges.where('from').equals(id).delete()
        await db.edges.where('to').equals(id).delete()
        await db.nodes.delete(id)
      })
    },

    async getNodesByType(type) {
      return db.nodes.where('type').equals(type).toArray()
    },

    async queryNodes(predicate) {
      return db.nodes.filter(predicate).toArray()
    },

    async getAllNodes() {
      return db.nodes.toArray()
    },

    async addEdge(edge) {
      await db.edges.put(edge)
    },

    async addEdges(edges) {
      await db.edges.bulkPut(edges)
    },

    async getEdge(id) {
      return db.edges.get(id)
    },

    async removeEdge(id) {
      await db.edges.delete(id)
    },

    async getEdgesFrom(nodeId) {
      return db.edges.where('from').equals(nodeId).toArray()
    },

    async getEdgesTo(nodeId) {
      return db.edges.where('to').equals(nodeId).toArray()
    },

    async getNeighbors(nodeId) {
      const edges = await db.transaction('r', db.edges, db.nodes, async () => {
        const from = await db.edges.where('from').equals(nodeId).toArray()
        const to = await db.edges.where('to').equals(nodeId).toArray()
        return [...from, ...to]
      })
      const ids = [...new Set(edges.flatMap(e => [e.from, e.to]).filter(id => id !== nodeId))]
      if (ids.length === 0) return []
      const nodes = await db.nodes.bulkGet(ids)
      return nodes.filter((n): n is GraphNode => n !== undefined)
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

      const nodeIds = [...visitedNodes]
      const edgeIds = [...visitedEdges]
      const nodes = (await db.nodes.bulkGet(nodeIds)).filter((n): n is GraphNode => n !== undefined)
      const edges = (await db.edges.bulkGet(edgeIds)).filter((e): e is GraphEdge => e !== undefined)
      return { nodes, edges }
    },

    async getAllEdges() {
      return db.edges.toArray()
    },

    async getGraph() {
      const [nodes, edges] = await Promise.all([
        db.nodes.toArray(),
        db.edges.toArray(),
      ])
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

  return h
}
