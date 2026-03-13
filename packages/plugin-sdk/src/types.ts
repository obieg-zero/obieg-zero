import type { ComponentType, FC, ReactNode } from 'react'

// --- SDK API — what plugins receive as first argument ---

export interface SdkAPI {
  registerManifest(data: PluginManifestData): void
  markReady(pluginId: string): void
  addFilter(hook: string, fn: (...args: any[]) => any, priority?: number, pluginId?: string): () => void
  applyFilters<T>(hook: string, value: T, ...args: unknown[]): T
  addAction(hook: string, fn: (...args: any[]) => void | Promise<void>, priority?: number, pluginId?: string): () => void
  doAction(hook: string, ...args: unknown[]): void
}

// --- Plugin manifest & factory ---

export interface PluginManifestData {
  id: string
  label: string
  description: string
  icon?: string
  group?: string
  alwaysOn?: boolean
  requires?: string[]
  defaultEnabled?: boolean
  repo?: string
  entry?: string   // entry file name, default 'index.mjs'
}

export interface PluginManifest extends PluginManifestData {
  ready: boolean
}

export interface ExternalPluginEntry {
  id: string
  url: string
  manifest: PluginManifestData
}

export type PluginFactory = (sdk: SdkAPI, deps: PluginDeps) => void | Promise<void>

// --- Layout & routing ---

export interface LayoutSlots {
  wrapper?: FC<{ children: ReactNode }>
  left?: ComponentType
  center?: ComponentType
  right?: ComponentType
  footer?: ComponentType
}

export interface RouteEntry {
  path: string
  pluginId: string
  layout: LayoutSlots
}

export interface NavItem {
  path: string
  label: string
  pluginId: string
}

// --- Host API — what plugins receive via deps.host ---

export interface HostAPI {
  opfs: any
  db: any
  embedder: any
  llm: any
  createGraphDB: (name: string) => any
  search: (...args: any[]) => any
}

export type PluginDeps = { host: HostAPI }
