import type { PluginDef, PluginManifest } from './types.js'

const plugins: PluginDef[] = []
const readyIds = new Set<string>()

export function registerPlugin(def: PluginDef): void {
  if (plugins.some(p => p.id === def.id)) return
  plugins.push(def)
}

export function markReady(pluginId: string): void {
  readyIds.add(pluginId)
}

export function getAllPlugins(): PluginManifest[] {
  return plugins.map(p => ({ ...p, ready: readyIds.has(p.id) }))
}

export function getPlugin(pluginId: string): PluginDef | undefined {
  return plugins.find(p => p.id === pluginId)
}

export function isReady(pluginId: string): boolean {
  return readyIds.has(pluginId)
}

export function resetRegistry(): void {
  plugins.length = 0
  readyIds.clear()
}
