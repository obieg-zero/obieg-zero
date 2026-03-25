import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef } from 'react'

function useStableLiveQuery<T>(querier: () => Promise<T>, deps: unknown[], fallback: T): T {
  const result = useLiveQuery(querier, deps, undefined as T | undefined)
  const ref = useRef<T>(fallback)
  if (result !== undefined) ref.current = result
  return ref.current
}

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
export type ValidationMode = 'off' | 'warn' | 'strict'
export interface PostType { type: string; schema: SchemaField[]; label?: string; validation: ValidationMode }
export interface SeedNode { type: string; data: Record<string, any>; children?: SeedNode[] }

export interface Store {
  validate(type: string, data: Record<string, any>): string[]
  add(type: string, data: Record<string, any>, opts?: { id?: string; parentId?: string }): Promise<PostRecord>
  get(id: string): Promise<PostRecord | undefined>
  update(id: string, data: Record<string, any>): Promise<void>
  remove(id: string): Promise<void>
  usePosts(type: string): PostRecord[]
  setOption(key: string, value: unknown): Promise<void>
  useOption(key: string): unknown
  importJSON(nodes: SeedNode[]): Promise<number>
  registerType(type: string, schema: SchemaField[], label?: string, opts?: { validation?: ValidationMode }): void
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
  options!: Dexie.Table<{ key: string; value: unknown }, string>
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

  const validate = (type: string, data: Record<string, any>): string[] => {
    const t = types.get(type)
    if (!t) return []
    const errors: string[] = []
    const schemaKeys = new Set(t.schema.map(f => f.key))
    for (const f of t.schema) {
      if (f.required && (data[f.key] === undefined || data[f.key] === null || data[f.key] === ''))
        errors.push(`Missing required field: ${f.key}`)
    }
    for (const key of Object.keys(data)) {
      if (!schemaKeys.has(key)) console.warn(`[store] Unknown field "${key}" for type "${type}"`)
    }
    return errors
  }

  const enforce = (op: string, type: string, data: Record<string, any>) => {
    const mode = types.get(type)?.validation ?? 'warn'
    if (mode === 'off') return
    const errors = validate(type, data)
    if (!errors.length) return
    const msg = `[store] ${op}("${type}"): ${errors.join(', ')}`
    if (mode === 'strict') throw new Error(msg)
    console.warn(msg)
  }

  return {
    validate,
    async add(type, data, o) {
      enforce('add', type, data)
      const now = Date.now()
      const post: PostRecord = { id: o?.id ?? crypto.randomUUID(), type, parentId: o?.parentId ?? null, data, createdAt: now, updatedAt: now }
      await db.posts.put(post)
      return post
    },
    async get(id) { return db.posts.get(id) },
    async update(id, data) {
      const p = await db.posts.get(id)
      if (!p) return
      const merged = { ...p.data, ...data }
      enforce('update', p.type, merged)
      await db.posts.put({ ...p, data: merged, updatedAt: Date.now() })
    },
    async remove(id) {
      const queue = [id]
      while (queue.length) {
        const cur = queue.shift()!
        queue.push(...await db.posts.where('parentId').equals(cur).primaryKeys())
        const p = await db.posts.get(cur)
        if (!p) continue
        try { (await opfsDirSafe('posts', p.type))?.removeEntry(cur, { recursive: true }) } catch { /* files may not exist */ }
        await db.posts.delete(cur)
      }
    },
    usePosts(type) { return useStableLiveQuery(() => db.posts.where('type').equals(type).sortBy('createdAt'), [type], []) },
    async setOption(key, value) { await db.options.put({ key, value }) },
    useOption(key) { return useStableLiveQuery(() => db.options.get(key).then(o => o?.value), [key], undefined) },
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
    registerType(type, schema, label, opts) {
      const existing = types.get(type)
      if (existing) {
        const knownKeys = new Set(existing.schema.map(f => f.key))
        const newFields = schema.filter(f => !knownKeys.has(f.key))
        existing.schema.push(...newFields)
        if (label) existing.label = label
        if (opts?.validation) existing.validation = opts.validation
      } else {
        types.set(type, { type, schema: [...schema], label, validation: opts?.validation ?? 'warn' })
      }
    },
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
      // FileSystemFileHandle.createWritable() is not yet in all TS libs
      const handle = await dir.getFileHandle(name, { create: true }) as FileSystemFileHandle & { createWritable(): Promise<{ write(d: File | Blob): Promise<void>; close(): Promise<void> }> }
      const w = await handle.createWritable()
      await w.write(data); await w.close()
    },
    async readFile(postId, name) {
      const dir = await dirFor(postId)
      if (!dir) throw new Error(`readFile: post "${postId}" not found or has no files`)
      return (await dir.getFileHandle(name)).getFile()
    },
    async listFiles(postId) {
      const dir = await dirFor(postId); if (!dir) return []
      const n: string[] = []
      // FileSystemDirectoryHandle.entries() not in all TS libs
      for await (const [name] of (dir as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>).entries()) n.push(name)
      return n.sort()
    },
    async removeFile(postId, name) {
      const dir = await dirFor(postId)
      if (!dir) return
      try { await dir.removeEntry(name) } catch { /* entry may already be deleted */ }
    },
  }
}
