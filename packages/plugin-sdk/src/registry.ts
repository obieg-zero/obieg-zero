import type { PluginDef } from './types.js'

const plugins: PluginDef[] = []

export function registerPlugin(def: PluginDef): void {
  if (plugins.some(p => p.id === def.id)) return
  plugins.push(def)
}

export function getAllPlugins(): PluginDef[] {
  return plugins
}

export function getPlugin(pluginId: string): PluginDef | undefined {
  return plugins.find(p => p.id === pluginId)
}
