import type { ComponentType, ReactNode } from 'react'
import { shouldCache, readCode, writeCode } from './opfs'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store, PostRecord } from './store'

// ── Types ────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'ok' | 'error'
export type LogEntry = { text: string; level: LogLevel; ts: number }

export interface HostState {
  plugins: PluginDef[]
  logs: LogEntry[]
  activeId: string | null
  leftOpen: boolean
  progress: boolean
}

export const useHostStore = create<HostState>()(
  persist(
    (): HostState => ({ plugins: [], logs: [], activeId: null, leftOpen: false, progress: false }),
    { name: 'ozr-host', partialize: (s) => ({ activeId: s.activeId }) }
  )
)

export interface PluginDef {
  id: string
  label: string
  description?: string
  version?: string
  icon?: ComponentType<{ size?: number }>
}

export interface PluginDeps {
  React: typeof import('react')
  ui: Record<string, ComponentType<any>>
  icons: Record<string, ComponentType<{ size?: number }>>
  store: Store
  sdk: SDK
}

export interface SDK {
  shared: { (): Record<string, unknown>; <U>(selector: (s: Record<string, unknown>) => U): U; setState(partial: Record<string, unknown>): void; getState(): Record<string, unknown> }
  getAllPlugins(): PluginDef[]
  unregisterPlugin(id: string): void
  log(text: string, level?: LogLevel): void
  loadPlugin(spec: string): Promise<void>
  openFileDialog(accept: string): Promise<File | null>
  useHostStore: typeof useHostStore
  create<T>(initializer: () => T): { (): T; <U>(selector: (s: T) => U): U; setState(partial: Partial<T>): void; getState(): T }
  useForm(defaults: Record<string, unknown>, opts?: {
    onSubmit?: (data: Record<string, unknown>) => void
    isComplete?: (data: Record<string, unknown>) => boolean
    sync?: Record<string, unknown>
  }): {
    form: Record<string, unknown>
    bind: (key: string, transform?: (v: unknown) => unknown) => { value: unknown; onChange: (e: unknown) => void }
    set: (kOrO: string | Record<string, unknown>, v?: unknown) => void
    incomplete: boolean; showForm: boolean; editing: boolean
    submit: () => Promise<void>; toggle: () => void; reset: () => void
  }
  zip(files: Record<string, Uint8Array | string>): Blob
  uploadFile(parentId: string): Promise<PostRecord | null>
  downloadFile(postId: string, filename: string): Promise<void>
  // Contribution points
  registerView(id: string, def: Omit<ViewDef, 'pluginId'>): void
  registerParser(id: string, def: Omit<ParserDef, 'pluginId'>): void
  registerAction(id: string, def: Omit<ActionDef, 'pluginId'>): void
  getViews(pluginId?: string): ViewDef[]
  getParsers(targetType?: string): ParserDef[]
  getActions(): ActionDef[]
  registerStageView(name: string, component: ComponentType<any>): void
  getStageView(node: any): ComponentType<any>
  setStoreAuth(auth: StoreAuth | null): void
  getStoreAuth(): StoreAuth | null
  // Plugin persistence (OPFS)
  getInstalledPlugins(): Promise<{ spec: string; label: string }[]>
  installPlugin(spec: string, label?: string): Promise<void>
  uninstallPlugin(spec: string): Promise<void>
}

// ── Contribution Point Types ─────────────────────────────────────────

export type ViewSlot = 'left' | 'center' | 'right' | 'footer'
export interface ViewDef { pluginId: string; slot: ViewSlot; component: ComponentType }
export interface ParserDef { pluginId: string; accept: string; targetType: string; parse: (text: string) => Record<string, unknown>[] }
export interface ActionDef { pluginId: string; node: ReactNode }

// ── Registries ───────────────────────────────────────────────────────

const { getState, setState } = useHostStore

const views = new Map<string, ViewDef>()
const parsers = new Map<string, ParserDef>()
const actions = new Map<string, ActionDef>()

/** @internal test-only */
export const _resetRegistries = () => { views.clear(); parsers.clear(); actions.clear() }

export const registerView = (id: string, def: ViewDef) => { views.set(id, def) }
export const registerParser = (id: string, def: ParserDef) => { parsers.set(id, def) }
export const registerAction = (id: string, def: ActionDef) => { actions.set(id, def) }

export const getViews = (pluginId?: string): ViewDef[] => {
  const all = Array.from(views.values())
  return pluginId ? all.filter(v => v.pluginId === pluginId) : all
}
export const getParsers = (targetType?: string): ParserDef[] => {
  const all = Array.from(parsers.values())
  return targetType ? all.filter(p => p.targetType === targetType) : all
}
export const getActions = (): ActionDef[] => Array.from(actions.values())

// ── Plugin Registry ──────────────────────────────────────────────────

const registerPlugin = (def: PluginDef) =>
  setState({ plugins: [...getState().plugins.filter(p => p.id !== def.id), def] })

export const unregisterPlugin = (id: string) => {
  setState({ plugins: getState().plugins.filter(p => p.id !== id) })
  // Clean up contribution points
  for (const [k, v] of views) if (v.pluginId === id) views.delete(k)
  for (const [k, v] of parsers) if (v.pluginId === id) parsers.delete(k)
  for (const [k, v] of actions) if (v.pluginId === id) actions.delete(k)
}

export const getAllPlugins = () => getState().plugins

// ── Log ──────────────────────────────────────────────────────────────

export const log = (text: string, level: LogLevel = 'info') =>
  setState({ logs: [...getState().logs.slice(-199), { text, level, ts: Date.now() }] })

export const clearLog = () => setState({ logs: [] })

// ── File dialog ──────────────────────────────────────────────────────

export const openFileDialog = (accept: string): Promise<File | null> =>
  new Promise(resolve => {
    const el = Object.assign(document.createElement('input'), { type: 'file', accept })
    el.onchange = () => resolve(el.files?.[0] ?? null)
    el.click()
  })

// ── Store auth ──────────────────────────────────────────────────────

export type StoreAuth = { licenseKey: string }

let _storeAuth: StoreAuth | null = null
export const setStoreAuth = (auth: StoreAuth | null) => { _storeAuth = auth }
export const getStoreAuth = () => _storeAuth

const STORE_BASE = 'https://obieg-zero-store.gotoreadyai.workers.dev'

// ── Loader ───────────────────────────────────────────────────────────

const makeShim = (global: string) =>
  'data:text/javascript,' + `const _=window.${global};export default _;` +
  Object.keys((window as any)[global] ?? {}).filter(k => k !== 'default').map(k => `export const ${k}=_.${k};`).join('')

let JSX_SHIM: string, REACT_SHIM: string, REACT_DOM_SHIM: string
const shims = () => { JSX_SHIM ??= makeShim('__jsx_runtime'); REACT_SHIM ??= makeShim('__react'); REACT_DOM_SHIM ??= makeShim('__react_dom') }

const resolveUrl = (spec: string) =>
  spec.startsWith('./') ? new URL(`${spec}/index.mjs`, document.baseURI).href
    : spec.startsWith('store://') ? `${STORE_BASE}/plugin/${spec.slice(8)}`
    : `https://raw.githubusercontent.com/${spec.split('@')[0]}/${spec.split('@')[1] ?? 'main'}/index.mjs`

const sha256 = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

const shimCode = (raw: string) => raw
  .replace(/["']react\/jsx-(?:dev-)?runtime["']/g, `"${JSX_SHIM}"`)
  .replace(/["']react-dom["']/g, `"${REACT_DOM_SHIM}"`)
  .replace(/["']react["']/g, `"${REACT_SHIM}"`)

const evalModule = async (code: string) => {
  const blob = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try { return await import(/* @vite-ignore */ blob) }
  finally { URL.revokeObjectURL(blob) }
}

const fetchModule = async (spec: string) => {
  shims()
  const useCache = shouldCache(spec)

  // OPFS cache hit
  if (useCache) {
    const cached = await readCode(spec)
    if (cached) {
      const code = shimCode(cached)
      return { mod: await evalModule(code), hash: await sha256(cached), fromCache: true }
    }
  }

  // Fetch from network
  const headers: Record<string, string> = {}
  if (spec.startsWith('store://')) {
    const auth = getStoreAuth()
    if (auth?.licenseKey) headers['Authorization'] = `Bearer ${auth.licenseKey}`
  }
  const res = await fetch(resolveUrl(spec), { headers })
  if (res.status === 429) throw new Error('429 — zbyt wiele żądań do GitHub, spróbuj ponownie za chwilę lub użyj lokalnej wersji pluginu')
  if (!res.ok) throw new Error(`${res.status}`)
  const raw = await res.text()
  const hash = await sha256(raw)

  if (useCache) {
    await writeCode(spec, raw).catch(e => console.warn('OPFS cache write:', e))
  }

  const code = shimCode(raw)
  return { mod: await evalModule(code), hash, fromCache: false }
}

export const loadOne = async (spec: string, deps: PluginDeps, expectedHash?: string) => {
  const t = performance.now()
  const { mod, hash, fromCache } = await fetchModule(spec)
  if (expectedHash && expectedHash !== hash) throw new Error('integrity mismatch')
  // TOFU
  const key = `integrity:${spec}`
  const skipIntegrity = spec.startsWith('./') || spec.startsWith('store://')
  const known = skipIntegrity ? undefined : await deps.store.get(key)
  if (known?.data?.hash && known.data.hash !== hash) throw new Error(`Plugin "${spec}" został zmodyfikowany — kod pluginu zmienił się od ostatniego użycia. Wyczyść dane przeglądarki aby zaakceptować nową wersję.`)
  if (!known && !skipIntegrity) await deps.store.add('_integrity', { hash, spec }, { id: key })
  if (typeof mod.default !== 'function') throw new Error('no default export')
  // Deferred SDK: captures registrations, binds pluginId after factory returns
  const deferred: { views: [string, Omit<ViewDef, 'pluginId'>][]; parsers: [string, Omit<ParserDef, 'pluginId'>][]; actions: [string, Omit<ActionDef, 'pluginId'>][] } = { views: [], parsers: [], actions: [] }
  const scopedSdk: SDK = { ...deps.sdk,
    registerView: (id, def) => deferred.views.push([id, def]),
    registerParser: (id, def) => deferred.parsers.push([id, def]),
    registerAction: (id, def) => deferred.actions.push([id, def]),
  }
  const def: PluginDef = mod.default({ ...deps, sdk: scopedSdk })
  if (!def?.id || !def?.label) throw new Error('invalid plugin def')
  // Flush deferred registrations with real pluginId
  for (const [id, v] of deferred.views) registerView(id, { ...v, pluginId: def.id })
  for (const [id, p] of deferred.parsers) registerParser(id, { ...p, pluginId: def.id })
  for (const [id, a] of deferred.actions) registerAction(id, { ...a, pluginId: def.id })
  registerPlugin(def)
  const src = fromCache ? 'OPFS' : 'sieć'
  log(`Plugin "${def.label}" zaladowany z ${src} (${Math.round(performance.now() - t)}ms)`, 'ok')
}
