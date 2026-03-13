import type { ComponentType, FC, ReactNode } from 'react'

export interface PluginDef {
  id: string
  label: string
  description: string
  icon?: ComponentType<{ size?: number }>
  group?: string
  alwaysOn?: boolean
  requires?: string[]
  defaultEnabled?: boolean
  repo?: string
  entry?: string

  layout?: {
    wrapper?: FC<{ children: ReactNode }>
    left?: ComponentType
    center?: ComponentType
    footer?: ComponentType
  }

  action?: ReactNode

  setup?: () => void | (() => void)
}

export interface HostAPI {
  opfs: any
  db: any
  embedder: any
  llm: any
  createGraphDB: (name: string) => any
  search: (...args: any[]) => any
}

export type PluginDeps = { host: HostAPI }

export type PluginFactory = (deps: PluginDeps) => PluginDef
