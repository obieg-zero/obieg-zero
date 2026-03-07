import type { ComponentType } from 'react'

export interface AppModule {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  type: 'page' | 'sheet'
  Component: ComponentType
}

const registry = new Map<string, AppModule>()

export function registerModule(mod: AppModule) {
  registry.set(mod.id, mod) // dedup by id — safe for HMR
}

export function modules(): AppModule[] {
  return [...registry.values()]
}
