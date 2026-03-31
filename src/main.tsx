import './index.css'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as jsxRuntime from 'react/jsx-runtime'
import { createRoot } from 'react-dom/client'
import * as icons from 'react-feather'
import * as ui from './themes'
import { FatalError } from './themes'
import { create } from 'zustand'
import { getAllPlugins, unregisterPlugin, log, loadOne, openFileDialog, registerView, registerParser, registerAction, getViews, getParsers, getActions, setStoreAuth, getStoreAuth } from './plugin'
import { loadMeta, saveMeta, meta } from './opfs'
import { registerStageView, getStageView } from './stageRegistry'
import { zipSync, strToU8 } from 'fflate'
import type { PluginDeps, SDK, StoreAuth } from './plugin'
import { useHostStore } from './plugin'
import { createStore } from './store'
import { Shell } from './Shell'

;(window as any).__jsx_runtime = jsxRuntime
;(window as any).__react = React
;(window as any).__react_dom = ReactDOM
const root = createRoot(document.getElementById('root')!)

interface ConfigEntry {
  pluginUri?: string | { spec: string; integrity?: string }
  importData?: string[]
  defaultOptions?: Record<string, unknown>
}

async function boot() {
  const config: unknown = await fetch('./config.json').then(r => r.json()).catch(e => { log(`config.json: ${e.message}`, 'error'); return {} })
  const store = await createStore()
  const shared = create(() => ({} as Record<string, unknown>))
  type FormData = Record<string, unknown>
  const sdk: SDK = {
    shared, getAllPlugins, unregisterPlugin, log,
    loadPlugin: (spec: string) => loadOne(spec, deps), openFileDialog, useHostStore, create,
    // Contribution points (pluginId set to '_sdk' for direct SDK calls; bridge in loadOne sets real pluginId)
    registerView: (id, def) => registerView(id, { ...def, pluginId: '_sdk' }),
    registerParser: (id, def) => registerParser(id, { ...def, pluginId: '_sdk' }),
    registerAction: (id, def) => registerAction(id, { ...def, pluginId: '_sdk' }),
    getViews, getParsers, getActions, registerStageView, getStageView, getStoreAuth,
    setStoreAuth: (auth: StoreAuth | null) => {
      setStoreAuth(auth)
      if (auth?.licenseKey) { meta().licenseKey = auth.licenseKey; saveMeta() }
    },
    getInstalledPlugins: async () => {
      const m = meta()
      return m.specs.map(spec => ({ spec, label: m.labels[spec] ?? spec }))
    },
    installPlugin: async (spec: string, label?: string) => {
      await loadOne(spec, deps)
      const m = meta()
      if (!m.specs.includes(spec)) {
        m.specs.push(spec)
        if (label) m.labels[spec] = label
        await saveMeta()
      }
    },
    uninstallPlugin: async (spec: string) => {
      const m = meta()
      m.specs = m.specs.filter(s => s !== spec)
      delete m.labels[spec]
      await saveMeta()
    },
    uploadFile: async (parentId: string) => {
      const file = await openFileDialog('*')
      if (!file) return null
      const ev = store.add('event', { kind: 'plik', text: file.name, date: new Date().toISOString().slice(0, 10) }, { parentId })
      await store.writeFile(ev.id, file.name, file)
      log(`Dodano: ${file.name}`, 'ok')
      return ev
    },
    downloadFile: async (postId: string, filename: string) => {
      const u = URL.createObjectURL(await store.readFile(postId, filename))
      try { Object.assign(document.createElement('a'), { href: u, download: filename }).click() }
      finally { URL.revokeObjectURL(u) }
    },
    zip: (files: Record<string, Uint8Array | string>) => {
      const mapped: Record<string, Uint8Array> = {}
      for (const [k, v] of Object.entries(files)) mapped[k] = typeof v === 'string' ? strToU8(v) : v
      return new Blob([zipSync(mapped).buffer as ArrayBuffer], { type: 'application/zip' })
    },
    useForm: (defaults: FormData, opts?: { onSubmit?: (data: FormData) => void, isComplete?: (data: FormData) => boolean, sync?: FormData }) => {
      const [form, sf] = React.useState(defaults)
      const [editing, setEditing] = React.useState(false)
      React.useEffect(() => { if (opts?.sync) sf(opts.sync) }, [JSON.stringify(opts?.sync)])
      const bind = (key: string, transform?: (v: unknown) => unknown) => ({ value: form[key] ?? '', onChange: (e: unknown) => { const raw = typeof e === 'object' && e !== null && 'target' in e ? (e as { target: { value: string } }).target.value : e; sf((f: FormData) => ({ ...f, [key]: transform ? transform(raw) : raw })) } })
      const set = (kOrO: string | FormData, v?: unknown) => sf((f: FormData) => typeof kOrO === 'string' ? { ...f, [kOrO]: v } : { ...f, ...kOrO })
      const incomplete = opts?.isComplete ? !opts.isComplete(form) : false
      const showForm = editing || incomplete
      const submit = async () => { if (opts?.isComplete && !opts.isComplete(form)) { log('Wypełnij wymagane pola', 'error'); return }; await opts?.onSubmit?.(form); setEditing(false) }
      const toggle = () => { if (opts?.sync) sf(opts.sync); setEditing(!editing) }
      const reset = () => sf(defaults)
      return { form, bind, set, incomplete, showForm, editing, submit, toggle, reset }
    },
  }
  const deps: PluginDeps = { React, ui, icons, store, sdk }
  if (import.meta.env.DEV) (window as any).__ph = deps

  root.render(<Shell />)

  const entries: ConfigEntry[] = Array.isArray(config) ? config : []
  const toLoad: { spec: string; integrity?: string }[] = []
  useHostStore.setState({ progress: true })
  for (const entry of entries) {
    // Default options (once)
    if (entry.defaultOptions) {
      for (const [k, v] of Object.entries(entry.defaultOptions as Record<string, unknown>)) {
        if (store.get(`__opt:${k}`) === undefined) {
          store.setOption(k, v)
          store.add('meta', { opt: k }, { id: `__opt:${k}` })
        }
      }
    }
    // Import data (once per file)
    for (const src of entry.importData ?? []) {
      const key = `__data:${src}`
      if (store.get(key)) continue
      try {
        const nodes = await fetch(`./${src}`).then(r => r.json())
        const count = store.importJSON(nodes)
        store.add('meta', { src }, { id: key })
        log(`${src}: ${count} rekordów`, 'ok')
      } catch (e) { log(`${src}: ${(e as Error).message}`, 'error') }
    }
    // Collect plugin spec
    if (entry.pluginUri) {
      const spec = typeof entry.pluginUri === 'string' ? entry.pluginUri : entry.pluginUri.spec
      const integrity = typeof entry.pluginUri === 'object' ? entry.pluginUri.integrity : undefined
      toLoad.push({ spec, integrity })
    }
  }
  // Installed plugins + license z OPFS (przeżywa czyszczenie IndexedDB)
  const pm = await loadMeta()
  if (pm.licenseKey) setStoreAuth({ licenseKey: pm.licenseKey })
  for (const spec of pm.specs) toLoad.push({ spec })
  // Load all plugins
  for (const { spec, integrity } of toLoad) {
    await loadOne(spec, deps, integrity).catch(err => log(`${spec}: ${(err as Error).message}`, 'error'))
  }

  useHostStore.setState({ progress: false })
}

boot().catch(err => root.render(<FatalError error={err} />))
