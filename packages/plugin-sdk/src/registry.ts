import type { PluginDef } from './types.js'

const plugins: PluginDef[] = []
const subs = new Set<() => void>()

export function registerPlugin(def: PluginDef): void {
  const idx = plugins.findIndex(p => p.id === def.id)
  if (idx >= 0) plugins[idx] = def; else plugins.push(def)
  subs.forEach(fn => fn())
}

export function getAllPlugins(): PluginDef[] {
  return plugins
}

export function getPlugin(pluginId: string): PluginDef | undefined {
  return plugins.find(p => p.id === pluginId)
}

export function subscribePlugins(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}
