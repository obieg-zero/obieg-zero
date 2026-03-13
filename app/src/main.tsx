import './index.css'
import { createRoot } from 'react-dom/client'
import { configureProfileStore, registerPlugin, markReady, loadInstalledPlugins } from '@obieg-zero/plugin-sdk'
import { createOpfs, createStoreDB } from '@obieg-zero/store-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import { search } from '@obieg-zero/embed-v2'
import type { PluginDeps } from '@obieg-zero/plugin-sdk'
import { Shell } from './Shell'
import projectsPlugin from './plugins/projects'
import darkmodePlugin from './plugins/darkmode'
import playgroundPlugin from './plugins/playground'
import notesPlugin from './plugins/notes'
import pluginManagerPlugin from './plugins/plugin-manager'
import configExportPlugin from './plugins/config-export'

async function boot() {
  let deployConfig: { plugins?: Record<string, boolean>; defaultPlugin?: string } = {}
  try {
    const res = await fetch('./config.json')
    if (res.ok) deployConfig = await res.json()
  } catch {}

  configureProfileStore({ storageKey: 'bp-profile', defaults: deployConfig.plugins })
  if (deployConfig.defaultPlugin && !localStorage.getItem('bp-active')) {
    localStorage.setItem('bp-active', deployConfig.defaultPlugin)
  }

  const deps: PluginDeps = {
    host: { opfs: createOpfs(), db: createStoreDB(), embedder: null, llm: null, createGraphDB, search }
  }

  const factories = [projectsPlugin, darkmodePlugin, playgroundPlugin, notesPlugin, pluginManagerPlugin, configExportPlugin]
  for (const factory of factories) {
    const def = factory(deps)
    registerPlugin(def)
    if (def.setup) def.setup()
    markReady(def.id)
  }

  await loadInstalledPlugins(deps)
  createRoot(document.getElementById('root')!).render(<Shell />)
}

boot()
