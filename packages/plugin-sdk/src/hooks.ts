import { isPluginEnabled } from './profileStore.js'

type FilterFn = (value: any, ...args: any[]) => any
type ActionFn = (...args: any[]) => void | Promise<void>
type Entry<T> = { fn: T; priority: number; pluginId?: string }

const filters = new Map<string, Entry<FilterFn>[]>()
const actions = new Map<string, Entry<ActionFn>[]>()

function reg<T>(map: Map<string, Entry<T>[]>, hook: string, fn: T, priority: number, pluginId?: string): () => void {
  if (!map.has(hook)) map.set(hook, [])
  const entry: Entry<T> = { fn, priority, pluginId }
  const list = map.get(hook)!
  list.push(entry)
  list.sort((a, b) => a.priority - b.priority)
  return () => { const i = list.indexOf(entry); if (i >= 0) list.splice(i, 1) }
}

export function addFilter(hook: string, fn: FilterFn, priority = 10, pluginId?: string): () => void {
  return reg(filters, hook, fn, priority, pluginId)
}

export function applyFilters<T>(hook: string, value: T, ...args: unknown[]): T {
  const list = filters.get(hook)
  if (!list) return value
  return list.reduce((v, { fn, pluginId }) => {
    if (pluginId && !isPluginEnabled(pluginId)) return v
    return fn(v, ...args)
  }, value as any) as T
}

export function addAction(hook: string, fn: ActionFn, priority = 10, pluginId?: string): () => void {
  return reg(actions, hook, fn, priority, pluginId)
}

export function doAction(hook: string, ...args: unknown[]): void {
  const list = actions.get(hook)
  if (!list) return
  for (const { fn, pluginId } of list) {
    if (pluginId && !isPluginEnabled(pluginId)) continue
    fn(...args)
  }
}

export function resetHooks(): void {
  filters.clear()
  actions.clear()
}
