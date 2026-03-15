import './index.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { configureProfileStore, registerPlugin } from '@obieg-zero/plugin-sdk'
import { loadInstalledPlugins, initInstaller } from './installer'
import { createOpfs, createStoreDB } from '@obieg-zero/store-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import { search } from '@obieg-zero/embed-v2'
import * as ui from './themes'
import * as icons from 'react-feather'
import type { PluginDeps } from '@obieg-zero/plugin-sdk'
import { Shell } from './Shell'
import projectsPlugin from './plugins/projects'
import darkmodePlugin from './plugins/darkmode'
import playgroundPlugin from './plugins/playground'
import pluginManagerPlugin from './plugins/plugin-manager'

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
    host: { opfs: createOpfs(), db, embedder: null, llm: null, createGraphDB, search },
    React, ui, icons,
  }

  // Sync templates: delete stale, seed missing
  try {
    const res = await fetch('./templates/index.json')
    if (res.ok) {
      const entries = await res.json()
      const validIds = new Set(entries.map((e: any) => e.id))
      const existing = await db.listTemplates()
      for (const t of existing) { if (!validIds.has(t.id)) await db.deletePipeline(t.id) }
      for (const entry of entries) {
        if (!await db.getPipeline(entry.id)) {
          const r = await fetch(`./templates/${entry.file}`)
          if (r.ok) await db.savePipeline({ ...await r.json(), projectId: null })
        }
      }
    }
  } catch {}

  initInstaller(deps)

  for (const factory of [projectsPlugin, darkmodePlugin, playgroundPlugin, pluginManagerPlugin]) {
    const def = factory(deps)
    registerPlugin(def)
    if (def.setup) def.setup()
  }

  await loadInstalledPlugins(deps)
  createRoot(document.getElementById('root')!).render(<Shell />)
}

boot()
