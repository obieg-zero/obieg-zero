import type { ComponentType, ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store } from './store'

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
  // Contribution points
  registerView(id: string, def: Omit<ViewDef, 'pluginId'>): void
  registerParser(id: string, def: Omit<ParserDef, 'pluginId'>): void
  registerAction(id: string, def: Omit<ActionDef, 'pluginId'>): void
  getViews(pluginId?: string): ViewDef[]
  getParsers(targetType?: string): ParserDef[]
  getActions(): ActionDef[]
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

// ── Loader ───────────────────────────────────────────────────────────

const makeShim = (global: string) =>
  'data:text/javascript,' + `const _=window.${global};export default _;` +
  Object.keys((window as any)[global] ?? {}).filter(k => k !== 'default').map(k => `export const ${k}=_.${k};`).join('')

let JSX_SHIM: string, REACT_SHIM: string, REACT_DOM_SHIM: string
const shims = () => { JSX_SHIM ??= makeShim('__jsx_runtime'); REACT_SHIM ??= makeShim('__react'); REACT_DOM_SHIM ??= makeShim('__react_dom') }

const resolveUrl = (spec: string) =>
  spec.startsWith('./') ? new URL(`${spec}/index.mjs`, document.baseURI).href
    : `https://raw.githubusercontent.com/${spec.split('@')[0]}/${spec.split('@')[1] ?? 'main'}/index.mjs`

const sha256 = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

const fetchModule = async (spec: string) => {
  shims()
  const res = await fetch(resolveUrl(spec))
  if (!res.ok) throw new Error(`${res.status}`)
  const raw = await res.text()
  const hash = await sha256(raw)
  const code = raw
    .replace(/["']react\/jsx-(?:dev-)?runtime["']/g, `"${JSX_SHIM}"`)
    .replace(/["']react-dom["']/g, `"${REACT_DOM_SHIM}"`)
    .replace(/["']react["']/g, `"${REACT_SHIM}"`)
  const blob = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try { return { mod: await import(/* @vite-ignore */ blob), hash } }
  finally { URL.revokeObjectURL(blob) }
}

export const loadOne = async (spec: string, deps: PluginDeps, expectedHash?: string) => {
  const t = performance.now()
  const { mod, hash } = await fetchModule(spec)
  if (expectedHash && expectedHash !== hash) throw new Error('integrity mismatch')
  // TOFU
  const key = `integrity:${spec}`
  const known = spec.startsWith('./') ? undefined : await deps.store.get(key)
  if (known?.data?.hash && known.data.hash !== hash) throw new Error('integrity changed (TOFU)')
  if (!known && !spec.startsWith('./')) await deps.store.add('_integrity', { hash, spec }, { id: key })
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
  log(`${spec} (${Math.round(performance.now() - t)}ms)`, 'ok')
}
