import './index.css'
import { createRoot } from 'react-dom/client'
import { configureProfileStore, registerPlugin } from '@obieg-zero/plugin-sdk'
import { loadInstalledPlugins } from './installer'
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
import { SEED_TEMPLATES } from './plugins/playground/templates'

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

  const db = createStoreDB()
  const deps: PluginDeps = {
    host: { opfs: createOpfs(), db, embedder: null, llm: null, createGraphDB, search }
  }

  // Seed templates on first run
  for (const t of SEED_TEMPLATES) {
    if (!await db.getPipeline(t.id)) await db.savePipeline({ ...t, projectId: null })
  }

  for (const factory of [projectsPlugin, darkmodePlugin, playgroundPlugin, notesPlugin, pluginManagerPlugin, configExportPlugin]) {
    const def = factory(deps)
    registerPlugin(def)
    if (def.setup) def.setup()
  }

  await loadInstalledPlugins(deps)
  createRoot(document.getElementById('root')!).render(<Shell />)
}

boot()
