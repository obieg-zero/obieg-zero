import './index.css'
import { createRoot } from 'react-dom/client'
import * as SDK from '@obieg-zero/plugin-sdk'
import { configureProfileStore, markReady } from '@obieg-zero/plugin-sdk'
import { createOpfs, createStoreDB } from '@obieg-zero/store-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import { search } from '@obieg-zero/embed-v2'
import type { PluginDeps } from '@obieg-zero/plugin-sdk'
import { Shell } from './Shell'
import darkmodePlugin from './plugins/darkmode'
import demoPlugin from './plugins/demo'
import notesPlugin from './plugins/notes'

configureProfileStore({ storageKey: 'bp-profile' })

const host: PluginDeps['host'] = {
  opfs: createOpfs(), db: createStoreDB(), embedder: null, llm: null, createGraphDB, search,
}

darkmodePlugin(SDK, { host })
markReady('darkmode')

demoPlugin(SDK, { host })
markReady('demo')

notesPlugin(SDK, { host })
markReady('notes')

createRoot(document.getElementById('root')!).render(<Shell />)
