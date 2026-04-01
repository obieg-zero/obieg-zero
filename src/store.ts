import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

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
export interface PostType { type: string; schema: SchemaField[]; label?: string; strict?: boolean }
export interface SeedNode { type: string; data: Record<string, any>; children?: SeedNode[] }

export interface Store {
  add(type: string, data: Record<string, any>, opts?: { id?: string; parentId?: string }): PostRecord
  get(id: string): PostRecord | undefined
  update(id: string, data: Record<string, any>): void
  remove(id: string): void
  usePost(id: string | null | undefined): PostRecord | undefined
  usePosts(type: string): PostRecord[]
  useChildren(parentId: string | null | undefined, type?: string): PostRecord[]
  setOption(key: string, value: unknown): void
  useOption(key: string): unknown
  importJSON(nodes: SeedNode[]): number
  registerType(type: string, schema: SchemaField[], label?: string, opts?: { strict?: boolean }): void
  getPosts(type: string): PostRecord[]
  getType(type: string): PostType | undefined
  getTypes(): PostType[]
  writeFile(postId: string, name: string, data: File | Blob): Promise<void>
  readFile(postId: string, name: string): Promise<File>
  listFiles(postId: string): Promise<string[]>
  removeFile(postId: string, name: string): Promise<void>
}

// ── IDB key-value storage for Zustand persist ────────────────────────

const DB_NAME = 'ozr-persist'
const OBJ_STORE = 'kv'
let dbInstance: IDBDatabase | null = null

function openIDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(OBJ_STORE)
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result) }
    req.onerror = () => reject(req.error)
  })
}

function idbOp<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OBJ_STORE, mode)
    const req = fn(tx.objectStore(OBJ_STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
  }))
}

const idbStorage: StateStorage = {
  getItem: (k) => idbOp('readonly', s => s.get(k)).then(v => v ?? null),
  setItem: (k, v) => idbOp('readwrite', s => s.put(v, k)).then(() => {}),
  removeItem: (k) => idbOp('readwrite', s => s.delete(k)).then(() => {}),
}

// ── Zustand data store ───────────────────────────────────────────────

interface DataState {
  posts: Record<string, PostRecord>
  options: Record<string, unknown>
}

const useDataStore = create<DataState>()(persist(
  () => ({ posts: {}, options: {} }),
  { name: 'ozr-store', storage: createJSONStorage(() => idbStorage) },
))

// ── OPFS (file attachments) ──────────────────────────────────────────

const opfsDir = async (...path: string[]) => {
  let dir = await navigator.storage.getDirectory()
  for (const seg of path) dir = await dir.getDirectoryHandle(seg, { create: true })
  return dir
}
const opfsDirSafe = async (...path: string[]) => {
  try { return await opfsDir(...path) } catch { return null }
}

/** @internal test-only: resets Zustand state */
export const _resetForTests = () => useDataStore.setState({ posts: {}, options: {} }, true)

// ── Factory ──────────────────────────────────────────────────────────

export async function createStore(): Promise<Store> {
  await new Promise<void>(resolve => {
    if (useDataStore.persist.hasHydrated()) resolve()
    else useDataStore.persist.onFinishHydration(() => resolve())
  })

  const types = new Map<string, PostType>()
  const cache = new Map<string, { key: string; result: PostRecord[] }>()
  const cached = (tag: string, items: PostRecord[]) => {
    const key = items.map(p => p.id + ':' + p.updatedAt).join(',')
    const prev = cache.get(tag)
    if (prev?.key === key) return prev.result
    cache.set(tag, { key, result: items })
    return items
  }

  const read = () => useDataStore.getState()
  const write = (fn: (s: DataState) => Partial<DataState>) => useDataStore.setState(fn)

  const enforce = (type: string, data: Record<string, any>) => {
    const t = types.get(type)
    if (!t?.strict) return
    for (const f of t.schema) {
      if (f.required && (data[f.key] === undefined || data[f.key] === null || data[f.key] === ''))
        throw new Error(`[store] Missing required: ${f.key}`)
    }
  }

  const dirFor = (postId: string, doCreate = false) => {
    const p = read().posts[postId]
    if (!p) return Promise.resolve(null)
    return doCreate ? opfsDir('posts', p.type, postId) : opfsDirSafe('posts', p.type, postId)
  }

  return {
    add(type, data, o) {
      enforce(type, data)
      const now = Date.now()
      const post: PostRecord = { id: o?.id ?? crypto.randomUUID(), type, parentId: o?.parentId ?? null, data, createdAt: now, updatedAt: now }
      write(s => ({ posts: { ...s.posts, [post.id]: post } }))
      return post
    },

    get(id) { return read().posts[id] },

    update(id, data) {
      const p = read().posts[id]
      if (!p) return
      const merged = { ...p.data, ...data }
      enforce(p.type, merged)
      write(s => ({ posts: { ...s.posts, [id]: { ...p, data: merged, updatedAt: Date.now() } } }))
    },

    remove(id) {
      const s = read()
      const ids: string[] = [], queue = [id]
      while (queue.length) {
        const cur = queue.shift()!
        if (s.posts[cur]) ids.push(cur)
        for (const c of Object.values(s.posts)) if (c.parentId === cur) queue.push(c.id)
      }
      write(prev => {
        const next = { ...prev.posts }
        for (const i of ids) delete next[i]
        return { posts: next }
      })
      for (const i of ids) {
        const p = s.posts[i]
        if (p) opfsDirSafe('posts', p.type).then(d => d?.removeEntry(i, { recursive: true }).catch(e => console.warn('OPFS cleanup:', e))).catch(e => console.warn('OPFS cleanup:', e))
      }
    },

    usePost(id) {
      return useDataStore(s => id ? s.posts[id] : undefined)
    },

    usePosts(type) {
      const posts = useDataStore(s => s.posts)
      return cached(type, Object.values(posts).filter(p => p.type === type).sort((a, b) => a.createdAt - b.createdAt))
    },

    useChildren(parentId, type?) {
      const posts = useDataStore(s => s.posts)
      if (!parentId) return []
      return cached(`ch:${parentId}:${type || '*'}`, Object.values(posts).filter(p => p.parentId === parentId && (!type || p.type === type)).sort((a, b) => a.createdAt - b.createdAt))
    },

    setOption(key, value) { write(s => ({ options: { ...s.options, [key]: value } })) },
    useOption(key) { return useDataStore(s => s.options[key]) },

    importJSON(nodes) {
      let count = 0
      const batch: Record<string, PostRecord> = {}
      const imp = (node: SeedNode, parentId?: string) => {
        const now = Date.now()
        const post: PostRecord = { id: crypto.randomUUID(), type: node.type, parentId: parentId ?? null, data: node.data, createdAt: now, updatedAt: now }
        batch[post.id] = post; count++
        if (node.children) for (const ch of node.children) imp(ch, post.id)
      }
      for (const n of nodes) imp(n)
      write(s => ({ posts: { ...s.posts, ...batch } }))
      return count
    },

    registerType(type, schema, label, opts) {
      const existing = types.get(type)
      if (existing) {
        const known = new Set(existing.schema.map(f => f.key))
        existing.schema.push(...schema.filter(f => !known.has(f.key)))
        if (label) existing.label = label
        if (opts?.strict !== undefined) existing.strict = opts.strict
      } else {
        types.set(type, { type, schema: [...schema], label, strict: opts?.strict })
      }
    },

    getPosts(type) { return Object.values(read().posts).filter(p => p.type === type).sort((a, b) => a.createdAt - b.createdAt) },
    getType(type) { return types.get(type) },
    getTypes() { return Array.from(types.values()) },

    async writeFile(postId, name, data) {
      const dir = await dirFor(postId, true); if (!dir) return
      const handle = await dir.getFileHandle(name, { create: true }) as FileSystemFileHandle & { createWritable(): Promise<{ write(d: File | Blob): Promise<void>; close(): Promise<void> }> }
      const w = await handle.createWritable()
      try { await w.write(data); await w.close() }
      catch (e) { try { await w.close() } catch { /* already closed */ }; throw e }
    },
    async readFile(postId, name) {
      const dir = await dirFor(postId)
      if (!dir) throw new Error(`readFile: post "${postId}" nie istnieje`)
      try { return await (await dir.getFileHandle(name)).getFile() }
      catch { throw new Error(`readFile: plik "${name}" nie istnieje w poście "${postId}"`) }
    },
    async listFiles(postId) {
      const dir = await dirFor(postId); if (!dir) return []
      const n: string[] = []
      for await (const [name] of (dir as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>).entries()) n.push(name)
      return n.sort()
    },
    async removeFile(postId, name) {
      const dir = await dirFor(postId); if (!dir) return
      try { await dir.removeEntry(name) } catch { /* ok */ }
    },
  }
}
