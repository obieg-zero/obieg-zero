import type { ComponentType, FC, ReactNode } from 'react'

// --- Host API types (what plugins get from deps.host) ---

export interface OpfsHandle {
  listProjects(): Promise<string[]>
  createProject(name: string): Promise<void>
  removeProject(name: string): Promise<void>
  listFiles(project: string): Promise<string[]>
  writeFile(project: string, filename: string, data: File | Blob | ArrayBuffer): Promise<void>
  readFile(project: string, filename: string): Promise<File>
}

export interface StoreDB {
  addProject(project: { id: string; name: string; createdAt: number }): Promise<void>
  getDocument(id: string): Promise<{ id: string; projectId: string; filename: string; docGroup?: string } | undefined>
  addDocument(doc: { id: string; projectId: string; filename: string; addedAt: number; docGroup?: string }): Promise<void>
  getPages(documentId: string): Promise<{ id: string; page: number; text: string }[]>
  setPages(pages: { id: string; projectId: string; documentId: string; page: number; text: string }[]): Promise<void>
  getChunksByDocIds(docIds: string[]): Promise<{ text: string; page: number; embedding: number[] }[]>
  getPagesByDocIds(docIds: string[]): Promise<{ page: number; text: string }[]>
  setChunks(chunks: { id: string; projectId: string; documentId: string; page: number; text: string; embedding: number[] }[]): Promise<void>
  clearDocument(documentId: string): Promise<void>
  clearProject(projectId: string): Promise<void>
  getPipeline(id: string): Promise<PipelineRecord | undefined>
  getPipelineByProject(projectId: string): Promise<PipelineRecord | undefined>
  savePipeline(pipeline: PipelineRecord): Promise<void>
  listTemplates(): Promise<PipelineRecord[]>
  dispose(): void
}

export interface PipelineRecord {
  id: string
  projectId: string | null
  name: string
  nodes: any[]
  edges: any[]
}

export interface EmbedHandle {
  embed(text: string): Promise<number[]>
  createIndex(pages: { page: number; text: string }[], opts: { chunkSize: number; onProgress?: (msg: string) => void }): Promise<{ chunks: Chunk[]; embed: (text: string) => Promise<number[]> }>
  dispose(): void
}

export interface Chunk {
  text: string
  page: number
  embedding: number[]
}

export interface LlmHandle {
  ask(prompt: string, opts?: { nPredict?: number; temperature?: number }): Promise<{ text: string; tokenCount: number; durationMs: number }>
  dispose(): Promise<void>
}

export interface GraphDB {
  addNodes(nodes: { id: string; type: string; label: string; data: Record<string, unknown> }[]): Promise<void>
  addEdges(edges: { id: string; from: string; to: string; type: string; label: string; data?: Record<string, unknown> }[]): Promise<void>
  removeNode(id: string): Promise<void>
  removeEdge(id: string): Promise<void>
  updateNode(id: string, data: Record<string, unknown>): Promise<void>
  getGraph(): Promise<{ nodes: any[]; edges: any[] }>
  getContext(nodeId: string, maxHops?: number): Promise<{ nodes: any[]; edges: any[] }>
  clear(): Promise<void>
  dispose(): void
}

export interface HostAPI {
  opfs: OpfsHandle
  db: StoreDB
  embedder: EmbedHandle | null
  llm: LlmHandle | null
  createGraphDB: (name: string) => Promise<GraphDB>
  search: (chunks: Chunk[], query: string, embedFn: (text: string) => Promise<number[]>, opts?: { topK?: number; minWordLength?: number }) => Promise<(Chunk & { score: number })[]>
}

// --- Plugin types ---

export interface PluginDef {
  id: string
  label: string
  description: string
  version?: string
  author?: string
  icon?: ComponentType<{ size?: number }>
  alwaysOn?: boolean
  requires?: string[]
  defaultEnabled?: boolean
  repo?: string
  entry?: string

  layout?: {
    wrapper?: FC<{ children: ReactNode }>
    left?: ComponentType
    leftFooter?: ComponentType
    center?: ComponentType
    footer?: ComponentType
    right?: ComponentType
  }

  action?: ReactNode
  setup?: () => void | (() => void)
}

export type PluginDeps = { host: HostAPI; React?: any; ui?: any; icons?: any }

export type PluginFactory = (deps: PluginDeps) => PluginDef

/** JSON-serializable plugin metadata. Used in: manifest.json, registry index.json, OPFS. */
export interface PluginManifest {
  id: string
  label: string
  description: string
  version: string
  author: string
  repo?: string
  entry?: string
  icon?: string
  requires?: string[]
  private?: boolean
  tags?: string[]
}
