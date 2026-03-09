import Dexie from 'dexie'

// --- Data models ---

export interface ProjectRecord {
  id: string
  name: string
  createdAt: number
}

export interface DocumentRecord {
  id: string
  projectId: string
  filename: string
  pageCount?: number
  addedAt: number
}

export interface PageRecord {
  id: string          // "projectId:filename:pageNum"
  projectId: string
  documentId: string
  page: number
  text: string
}

export interface ChunkRecord {
  id: string          // "projectId:filename:pageNum:chunkIdx"
  projectId: string
  documentId: string
  page: number
  text: string
  embedding: number[]
}

// --- Dexie schema ---

class StoreDexie extends Dexie {
  projects!: Dexie.Table<ProjectRecord, string>
  documents!: Dexie.Table<DocumentRecord, string>
  pages!: Dexie.Table<PageRecord, string>
  chunks!: Dexie.Table<ChunkRecord, string>

  constructor() {
    super('obieg-store')
    this.version(1).stores({
      projects: 'id',
      documents: 'id, projectId',
      pages: 'id, projectId, documentId',
      chunks: 'id, projectId, documentId, page',
    })
  }
}

// --- Store handle ---

export interface StoreDB {
  // projects
  listProjects(): Promise<ProjectRecord[]>
  getProject(id: string): Promise<ProjectRecord | undefined>
  addProject(project: ProjectRecord): Promise<void>
  removeProject(id: string): Promise<void>

  // documents
  listDocuments(projectId: string): Promise<DocumentRecord[]>
  getDocument(id: string): Promise<DocumentRecord | undefined>
  addDocument(doc: DocumentRecord): Promise<void>
  removeDocument(id: string): Promise<void>

  // pages
  getPages(documentId: string): Promise<PageRecord[]>
  setPages(pages: PageRecord[]): Promise<void>
  hasPages(documentId: string): Promise<boolean>

  // chunks / embeddings
  getChunks(documentId: string): Promise<ChunkRecord[]>
  getChunksByProject(projectId: string): Promise<ChunkRecord[]>
  setChunks(chunks: ChunkRecord[]): Promise<void>
  hasChunks(documentId: string): Promise<boolean>

  // cleanup
  clearProject(projectId: string): Promise<void>
  dispose(): void
}

export function createStoreDB(): StoreDB {
  const db = new StoreDexie()

  return {
    // --- projects ---
    async listProjects() {
      return db.projects.toArray()
    },
    async getProject(id) {
      return db.projects.get(id)
    },
    async addProject(project) {
      await db.projects.put(project)
    },
    async removeProject(id) {
      await db.transaction('rw', [db.projects, db.documents, db.pages, db.chunks], async () => {
        await db.chunks.where('projectId').equals(id).delete()
        await db.pages.where('projectId').equals(id).delete()
        await db.documents.where('projectId').equals(id).delete()
        await db.projects.delete(id)
      })
    },

    // --- documents ---
    async listDocuments(projectId) {
      return db.documents.where('projectId').equals(projectId).toArray()
    },
    async getDocument(id) {
      return db.documents.get(id)
    },
    async addDocument(doc) {
      await db.documents.put(doc)
    },
    async removeDocument(id) {
      await db.transaction('rw', [db.documents, db.pages, db.chunks], async () => {
        await db.chunks.where('documentId').equals(id).delete()
        await db.pages.where('documentId').equals(id).delete()
        await db.documents.delete(id)
      })
    },

    // --- pages ---
    async getPages(documentId) {
      return db.pages.where('documentId').equals(documentId).sortBy('page')
    },
    async setPages(pages) {
      await db.pages.bulkPut(pages)
    },
    async hasPages(documentId) {
      return (await db.pages.where('documentId').equals(documentId).count()) > 0
    },

    // --- chunks ---
    async getChunks(documentId) {
      return db.chunks.where('documentId').equals(documentId).toArray()
    },
    async getChunksByProject(projectId) {
      return db.chunks.where('projectId').equals(projectId).toArray()
    },
    async setChunks(chunks) {
      await db.chunks.bulkPut(chunks)
    },
    async hasChunks(documentId) {
      return (await db.chunks.where('documentId').equals(documentId).count()) > 0
    },

    // --- cleanup ---
    async clearProject(projectId) {
      await db.transaction('rw', [db.documents, db.pages, db.chunks], async () => {
        await db.chunks.where('projectId').equals(projectId).delete()
        await db.pages.where('projectId').equals(projectId).delete()
        await db.documents.where('projectId').equals(projectId).delete()
      })
    },

    dispose() {
      db.close()
    },
  }
}
