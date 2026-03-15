import type { PluginDef, PluginManifest } from './types.js'

type Registrable = PluginDef | PluginManifest

const plugins: Registrable[] = []
const subs = new Set<() => void>()

export function registerPlugin(def: Registrable): void {
  const idx = plugins.findIndex(p => p.id === def.id)
  if (idx >= 0) plugins[idx] = def; else plugins.push(def)
  subs.forEach(fn => fn())
}

export function getAllPlugins(): PluginDef[] {
  return plugins as PluginDef[]
}

export function getPlugin(pluginId: string): PluginDef | undefined {
  return plugins.find(p => p.id === pluginId) as PluginDef | undefined
}

export function subscribePlugins(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}
