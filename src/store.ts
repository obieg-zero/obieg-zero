import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'

// ── Types ────────────────────────────────────────────────────────────

export interface PostRecord {
  id: string
  type: string
  parentId: string | null
  data: Record<string, any>
  createdAt: number
  updatedAt: number
}

export type SchemaField = { key: string; label: string; required?: boolean; inputType?: string }
export interface PostType { type: string; schema: SchemaField[]; label?: string }
export interface SeedNode { type: string; data: Record<string, any>; children?: SeedNode[] }

export interface Store {
  add(type: string, data: Record<string, any>, opts?: { id?: string; parentId?: string }): Promise<PostRecord>
  get(id: string): Promise<PostRecord | undefined>
  update(id: string, data: Record<string, any>): Promise<void>
  remove(id: string): Promise<void>
  usePosts(type: string): PostRecord[]
  setOption(key: string, value: any): Promise<void>
  useOption(key: string): any
  importJSON(nodes: SeedNode[]): Promise<number>
  registerType(type: string, schema: SchemaField[], label?: string): void
  getType(type: string): PostType | undefined
  getTypes(): PostType[]
  exportJSON(type?: string): Promise<Record<string, { schema: SchemaField[] | null; records: PostRecord[] }>>
  writeFile(postId: string, name: string, data: File | Blob): Promise<void>
  readFile(postId: string, name: string): Promise<File>
  listFiles(postId: string): Promise<string[]>
  removeFile(postId: string, name: string): Promise<void>
}

// ── DB ───────────────────────────────────────────────────────────────

class StoreDB extends Dexie {
  posts!: Dexie.Table<PostRecord, string>
  options!: Dexie.Table<{ key: string; value: any }, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({ posts: 'id, type, parentId', options: 'key' })
  }
}

// ── OPFS ─────────────────────────────────────────────────────────────

const opfsDir = async (...path: string[]) => {
  let dir = await navigator.storage.getDirectory()
  for (const seg of path) dir = await dir.getDirectoryHandle(seg, { create: true })
  return dir
}
const opfsDirSafe = async (...path: string[]) => {
  try { return await opfsDir(...path) } catch { return null }
}

// ── Factory ──────────────────────────────────────────────────────────

export function createStore(dbName = 'ozr-store'): Store {
  const db = new StoreDB(dbName)
  const types = new Map<string, PostType>()

  const dirFor = async (postId: string, create = false) => {
    const p = await db.posts.get(postId)
    if (!p) return null
    return create ? opfsDir('posts', p.type, postId) : opfsDirSafe('posts', p.type, postId)
  }

  return {
    async add(type, data, o) {
      const now = Date.now()
      const post: PostRecord = { id: o?.id ?? crypto.randomUUID(), type, parentId: o?.parentId ?? null, data, createdAt: now, updatedAt: now }
      await db.posts.put(post)
      return post
    },
    async get(id) { return db.posts.get(id) },
    async update(id, data) {
      const p = await db.posts.get(id)
      if (p) await db.posts.put({ ...p, data: { ...p.data, ...data }, updatedAt: Date.now() })
    },
    async remove(id) {
      const queue = [id]
      while (queue.length) {
        const cur = queue.shift()!
        queue.push(...await db.posts.where('parentId').equals(cur).primaryKeys())
        const p = await db.posts.get(cur)
        if (!p) continue
        try { (await opfsDirSafe('posts', p.type))?.removeEntry(cur, { recursive: true }) } catch {}
        await db.posts.delete(cur)
      }
    },
    usePosts(type) { return useLiveQuery(() => db.posts.where('type').equals(type).sortBy('createdAt'), [type], []) },
    async setOption(key, value) { await db.options.put({ key, value }) },
    useOption(key) { return useLiveQuery(() => db.options.get(key).then(o => o?.value), [key]) },
    async importJSON(nodes) {
      let count = 0
      const imp = async (node: SeedNode, parentId?: string) => {
        const now = Date.now()
        const post: PostRecord = { id: crypto.randomUUID(), type: node.type, parentId: parentId ?? null, data: node.data, createdAt: now, updatedAt: now }
        await db.posts.put(post); count++
        if (node.children) for (const ch of node.children) await imp(ch, post.id)
      }
      for (const n of nodes) await imp(n)
      return count
    },
    registerType(type, schema, label) { types.set(type, { type, schema, label }) },
    getType(type) { return types.get(type) },
    getTypes() { return Array.from(types.values()) },
    async exportJSON(type?) {
      const tt = type ? [type] : Array.from(new Set((await db.posts.toArray()).map(p => p.type)))
      const r: Record<string, { schema: SchemaField[] | null; records: PostRecord[] }> = {}
      for (const t of tt) r[t] = { schema: types.get(t)?.schema ?? null, records: await db.posts.where('type').equals(t).sortBy('createdAt') }
      return r
    },
    async writeFile(postId, name, data) {
      const dir = await dirFor(postId, true); if (!dir) return
      const w = await (await dir.getFileHandle(name, { create: true }) as any).createWritable()
      await w.write(data); await w.close()
    },
    async readFile(postId, name) { const dir = await dirFor(postId); if (!dir) throw new Error('not found'); return (await dir.getFileHandle(name)).getFile() },
    async listFiles(postId) { const dir = await dirFor(postId); if (!dir) return []; const n: string[] = []; for await (const [name] of (dir as any).entries()) n.push(name); return n.sort() },
    async removeFile(postId, name) { try { (await dirFor(postId))?.removeEntry(name) } catch {} },
  }
}
