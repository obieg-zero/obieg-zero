import './index.css'
import { createRoot } from 'react-dom/client'
import * as SDK from '@obieg-zero/plugin-sdk'
import { configureProfileStore, markReady } from '@obieg-zero/plugin-sdk'
import { createOpfs, createStoreDB } from '@obieg-zero/store-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import { search } from '@obieg-zero/embed-v2'
import type { PluginDeps } from '@obieg-zero/plugin-sdk'
import { loadInstalledPlugins } from '@obieg-zero/plugin-sdk'
import { Shell } from './Shell'
import projectsPlugin from './plugins/projects'
import darkmodePlugin from './plugins/darkmode'
import playgroundPlugin from './plugins/playground'
import notesPlugin from './plugins/notes'
import pluginManagerPlugin from './plugins/plugin-manager'
import configExportPlugin from './plugins/config-export'

async function boot() {
  // Load deploy config (config.json next to index.html)
  let deployConfig: { plugins?: Record<string, boolean>; defaultPlugin?: string } = {}
  try {
    const res = await fetch('./config.json')
    if (res.ok) deployConfig = await res.json()
  } catch {}

  configureProfileStore({ storageKey: 'bp-profile', defaults: deployConfig.plugins })
  if (deployConfig.defaultPlugin && !localStorage.getItem('bp-active')) {
    localStorage.setItem('bp-active', deployConfig.defaultPlugin)
  }

  const host: PluginDeps['host'] = {
    opfs: createOpfs(), db: createStoreDB(), embedder: null, llm: null, createGraphDB, search,
  }

  const deps = { host }
  const local: [string, (sdk: typeof SDK, deps: PluginDeps) => void][] = [
    ['projects', projectsPlugin],
    ['darkmode', darkmodePlugin],
    ['playground', playgroundPlugin],
    ['notes', notesPlugin],
    ['plugin-manager', pluginManagerPlugin],
    ['config-export', configExportPlugin],
  ]
  for (const [id, factory] of local) { factory(SDK, deps); markReady(id) }

  await loadInstalledPlugins(SDK, deps)
  createRoot(document.getElementById('root')!).render(<Shell />)
}

boot()
