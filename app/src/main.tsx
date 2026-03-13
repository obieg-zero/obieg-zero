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
import notesPlugin from './plugins/notes'
import pluginManagerPlugin from './plugins/plugin-manager'
import playgroundPlugin from './plugins/playground'

configureProfileStore({ storageKey: 'bp-profile' })

const host: PluginDeps['host'] = {
  opfs: createOpfs(), db: createStoreDB(), embedder: null, llm: null, createGraphDB, search,
}

const deps = { host }
const local: [string, (sdk: typeof SDK, deps: PluginDeps) => void][] = [
  ['projects', projectsPlugin],
  ['darkmode', darkmodePlugin],
  ['notes', notesPlugin],
  ['plugin-manager', pluginManagerPlugin],
  ['playground', playgroundPlugin],
]
for (const [id, factory] of local) { factory(SDK, deps); markReady(id) }

loadInstalledPlugins(SDK, deps).then(() => {
  createRoot(document.getElementById('root')!).render(<Shell />)
})
