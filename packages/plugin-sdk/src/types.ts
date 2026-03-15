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

export type PluginDeps = { host: HostAPI }

export type PluginFactory = (deps: PluginDeps) => PluginDef

// --- Distribution types (JSON-serializable, no React) ---

/** What a plugin repo's manifest.json must contain */
export interface PluginManifest {
  id: string
  label: string
  description: string
  version: string
  author: string
  entry?: string
  icon?: string
  requires?: string[]
  defaultEnabled?: boolean
  private?: boolean
  minSdkVersion?: string
}

/** Registry entry — manifest + repo location */
export interface RegistryEntry extends PluginManifest {
  repo: string
  tags?: string[]
}

/** Installed plugin metadata stored in OPFS */
export interface InstalledPlugin extends PluginManifest {
  repo?: string
  installedAt: string
  installedFrom: 'github' | 'zip' | 'url'
}

/** Registry index.json format */
export interface RegistryIndex {
  schemaVersion: number
  updatedAt: string
  plugins: RegistryEntry[]
}

/** Update check result */
export interface UpdateInfo {
  pluginId: string
  installedVersion: string
  registryVersion: string
}
