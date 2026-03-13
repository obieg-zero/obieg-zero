import type { PluginManifestData, PluginManifest } from './types.js'

const manifests: PluginManifestData[] = []
const readyIds = new Set<string>()

/** Phase 1: register manifest (light — visible even when plugin disabled) */
export function registerManifest(data: PluginManifestData): void {
  if (manifests.some(m => m.id === data.id)) return
  manifests.push(data)
}

/** Phase 2: mark plugin as loaded and ready */
export function markReady(pluginId: string): void {
  readyIds.add(pluginId)
}

/** All known manifests (even disabled plugins) */
export function getAllManifests(): PluginManifestData[] {
  return [...manifests]
}

/** Single manifest by id */
export function getManifest(id: string): PluginManifestData | undefined {
  return manifests.find(m => m.id === id)
}

/** All plugins with ready flag */
export function getAllPlugins(): PluginManifest[] {
  return manifests.map(m => ({ ...m, ready: readyIds.has(m.id) }))
}

/** Check if specific plugin is loaded */
export function isReady(pluginId: string): boolean {
  return readyIds.has(pluginId)
}

export function resetRegistry(): void {
  manifests.length = 0
  readyIds.clear()
}
