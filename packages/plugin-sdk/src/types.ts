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
    leftFooter?: ComponentType
    center?: ComponentType
    footer?: ComponentType
    right?: ComponentType
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

export type PluginDeps = { host: HostAPI; React?: any; ui?: any; icons?: any }

export type PluginFactory = (deps: PluginDeps) => PluginDef

/** JSON-serializable plugin metadata. Used in: manifest.json, registry index.json, OPFS. */
export interface PluginManifest {
  id: string
  label: string
  description: string
  version: string
  author: string
  repo?: string
  entry?: string
  icon?: string
  requires?: string[]
  private?: boolean
  tags?: string[]
}
