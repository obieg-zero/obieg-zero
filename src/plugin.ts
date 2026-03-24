import type { ComponentType, ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SchemaField } from './store'

// ── Types ────────────────────────────────────────────────────────────

export type Parser = { accept: string; parse: (text: string) => any[]; validate?: (data: any[]) => { warnings: string[] } }
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
  order?: number
  layout?: { left?: ComponentType; center?: ComponentType; right?: ComponentType; footer?: ComponentType }
  action?: ReactNode
  setup?: () => void
  types?: Record<string, { label: string; schema: SchemaField[] }>
  caseTypes?: Record<string, { label: string; badge?: ComponentType<{ caseId: string; caseData: any }> }>
  parsers?: Record<string, Parser>
}

export interface PluginDeps {
  React: typeof import('react')
  ui: Record<string, any>
  icons: Record<string, ComponentType<{ size?: number }>>
  store: any
  sdk: Record<string, any>
}

// ── Registry ─────────────────────────────────────────────────────────

const { getState, setState } = useHostStore

const registerPlugin = (def: PluginDef) =>
  setState({ plugins: [...getState().plugins.filter(p => p.id !== def.id), def] })

export const unregisterPlugin = (id: string) =>
  setState({ plugins: getState().plugins.filter(p => p.id !== id) })

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
  const known = spec.startsWith('./') ? null : await deps.store.get(key) as any
  if (known?.data?.hash && known.data.hash !== hash) throw new Error('integrity changed (TOFU)')
  if (!known && !spec.startsWith('./')) await deps.store.add('_integrity', { hash, spec }, { id: key })
  if (typeof mod.default !== 'function') throw new Error('no default export')
  const def: PluginDef = mod.default(deps)
  if (!def?.id || !def?.label) throw new Error('invalid plugin def')
  def.setup?.()
  // Auto-register types from PluginDef
  if (def.types) for (const [t, v] of Object.entries(def.types)) deps.store.registerType(t, v.schema, v.label)
  registerPlugin(def)
  log(`${spec} (${Math.round(performance.now() - t)}ms)`, 'ok')
}
