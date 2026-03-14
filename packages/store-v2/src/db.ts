import Dexie from 'dexie'

interface ProjectRecord { id: string; name: string; createdAt: number }
export interface DocumentRecord { id: string; projectId: string; filename: string; addedAt: number; docGroup?: string }
interface PageRecord { id: string; projectId: string; documentId: string; page: number; text: string }
interface ChunkRecord { id: string; projectId: string; documentId: string; page: number; text: string; embedding: number[] }
export interface PipelineRecord { id: string; projectId: string | null; name: string; nodes: any[]; edges: any[] }

class StoreDexie extends Dexie {
  projects!: Dexie.Table<ProjectRecord, string>
  documents!: Dexie.Table<DocumentRecord, string>
  pages!: Dexie.Table<PageRecord, string>
  chunks!: Dexie.Table<ChunkRecord, string>
  pipelines!: Dexie.Table<PipelineRecord, string>
  constructor() {
    super('obieg-store')
    this.version(1).stores({
      projects: 'id',
      documents: 'id, projectId',
      pages: 'id, projectId, documentId',
      chunks: 'id, projectId, documentId, page',
    })
    this.version(2).stores({
      projects: 'id',
      documents: 'id, projectId, docGroup',
      pages: 'id, projectId, documentId',
      chunks: 'id, projectId, documentId, page',
    })
    this.version(3).stores({
      projects: 'id',
      documents: 'id, projectId, docGroup',
      pages: 'id, projectId, documentId',
      chunks: 'id, projectId, documentId, page',
      pipelines: 'id, projectId',
    })
  }
}

export interface StoreDB {
  listProjects(): Promise<ProjectRecord[]>
  getProject(id: string): Promise<ProjectRecord | undefined>
  addProject(project: ProjectRecord): Promise<void>
  removeProject(id: string): Promise<void>
  listDocuments(projectId: string): Promise<DocumentRecord[]>
  getDocument(id: string): Promise<DocumentRecord | undefined>
  addDocument(doc: DocumentRecord): Promise<void>
  getPages(documentId: string): Promise<PageRecord[]>
  setPages(pages: PageRecord[]): Promise<void>
  hasPages(documentId: string): Promise<boolean>
  getChunks(documentId: string): Promise<ChunkRecord[]>
  getChunksByProject(projectId: string): Promise<ChunkRecord[]>
  setChunks(chunks: ChunkRecord[]): Promise<void>
  hasChunks(documentId: string): Promise<boolean>
  listDocumentsByGroup(projectId: string, docGroup: string): Promise<DocumentRecord[]>
  getChunksByDocIds(docIds: string[]): Promise<ChunkRecord[]>
  getPagesByDocIds(docIds: string[]): Promise<PageRecord[]>
  clearDocument(documentId: string): Promise<void>
  clearProject(projectId: string): Promise<void>
  getPipeline(id: string): Promise<PipelineRecord | undefined>
  getPipelineByProject(projectId: string): Promise<PipelineRecord | undefined>
  savePipeline(pipeline: PipelineRecord): Promise<void>
  listTemplates(): Promise<PipelineRecord[]>
  deletePipeline(id: string): Promise<void>
  dispose(): void
}

export function createStoreDB(): StoreDB {
  const db = new StoreDexie()

  async function deleteData(where: Record<string, string>) {
    await db.transaction('rw', [db.chunks, db.pages, db.documents], async () => {
      const key = Object.keys(where)[0] as 'projectId' | 'documentId'
      const val = where[key]
      await db.chunks.where(key).equals(val).delete()
      await db.pages.where(key).equals(val).delete()
      await db.documents.where(key).equals(val).delete()
    })
  }

  return {
    async listProjects() { return db.projects.toArray() },
    async getProject(id) { return db.projects.get(id) },
    async addProject(project) { await db.projects.put(project) },
    async removeProject(id) {
      await deleteData({ projectId: id })
      await db.pipelines.where('projectId').equals(id).delete()
      await db.projects.delete(id)
    },

    async listDocuments(projectId) { return db.documents.where('projectId').equals(projectId).toArray() },
    async getDocument(id) { return db.documents.get(id) },
    async addDocument(doc) { await db.documents.put(doc) },

    async getPages(documentId) { return db.pages.where('documentId').equals(documentId).sortBy('page') },
    async setPages(pages) { await db.pages.bulkPut(pages) },
    async hasPages(documentId) { return (await db.pages.where('documentId').equals(documentId).count()) > 0 },

    async getChunks(documentId) { return db.chunks.where('documentId').equals(documentId).toArray() },
    async getChunksByProject(projectId) { return db.chunks.where('projectId').equals(projectId).toArray() },
    async setChunks(chunks) { await db.chunks.bulkPut(chunks) },
    async hasChunks(documentId) { return (await db.chunks.where('documentId').equals(documentId).count()) > 0 },

    async listDocumentsByGroup(projectId, docGroup) { return db.documents.where('docGroup').equals(docGroup).filter(d => d.projectId === projectId).toArray() },
    async getChunksByDocIds(docIds) { return docIds.length ? db.chunks.where('documentId').anyOf(docIds).toArray() : [] },
    async getPagesByDocIds(docIds) { return docIds.length ? db.pages.where('documentId').anyOf(docIds).sortBy('page') : [] },

    async getPipeline(id) { return db.pipelines.get(id) },
    async getPipelineByProject(projectId) { return db.pipelines.where('projectId').equals(projectId).first() },
    async savePipeline(pipeline) { await db.pipelines.put(pipeline) },
    async listTemplates() { return db.pipelines.filter(p => p.projectId === null).toArray() },
    async deletePipeline(id) { await db.pipelines.delete(id) },

    async clearDocument(documentId) { await deleteData({ documentId }) },
    async clearProject(projectId) { await deleteData({ projectId }) },
    dispose() { db.close() },
  }
}
