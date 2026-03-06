import type { ComponentType } from 'react'

export interface AppModule {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  type: 'page' | 'sheet'
  Component: ComponentType
}

export const modules: AppModule[] = []

export function registerModule(mod: AppModule) {
  modules.push(mod)
}
