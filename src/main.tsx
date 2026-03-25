import './index.css'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as jsxRuntime from 'react/jsx-runtime'
import { createRoot } from 'react-dom/client'
import * as icons from 'react-feather'
import * as ui from './ui'
import { FatalError } from './ui'
import { create } from 'zustand'
import { getAllPlugins, unregisterPlugin, log, loadOne, openFileDialog, registerView, registerParser, registerAction, getViews, getParsers, getActions } from './plugin'
import { zipSync, strToU8 } from 'fflate'
import type { PluginDeps, SDK } from './plugin'
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
  const config: unknown = await fetch('./config.json').then(r => r.json()).catch(() => ({}))
  const store = createStore()
  const shared = create(() => ({} as Record<string, unknown>))
  type FormData = Record<string, unknown>
  const sdk: SDK = {
    shared, getAllPlugins, unregisterPlugin, log,
    loadPlugin: (spec: string) => loadOne(spec, deps), openFileDialog, useHostStore, create,
    // Contribution points (pluginId set to '_sdk' for direct SDK calls; bridge in loadOne sets real pluginId)
    registerView: (id, def) => registerView(id, { ...def, pluginId: '_sdk' }),
    registerParser: (id, def) => registerParser(id, { ...def, pluginId: '_sdk' }),
    registerAction: (id, def) => registerAction(id, { ...def, pluginId: '_sdk' }),
    getViews, getParsers, getActions,
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

  // Load entries: [{pluginUri, importData, defaultOptions}]
  const entries: ConfigEntry[] = Array.isArray(config) ? config : []
  useHostStore.setState({ progress: true })
  for (const entry of entries) {
    // Default options (once)
    if (entry.defaultOptions) {
      for (const [k, v] of Object.entries(entry.defaultOptions as Record<string, unknown>)) {
        if ((await store.get(`__opt:${k}`)) === undefined) {
          await store.setOption(k, v)
          await store.add('meta', { opt: k }, { id: `__opt:${k}` })
        }
      }
    }
    // Import data (once per file)
    for (const src of entry.importData ?? []) {
      const key = `__data:${src}`
      if (await store.get(key)) continue
      try {
        const nodes = await fetch(`./${src}`).then(r => r.json())
        const count = await store.importJSON(nodes)
        await store.add('meta', { src }, { id: key })
        log(`${src}: ${count} rekordów`, 'ok')
      } catch (e) { log(`${src}: ${(e as Error).message}`, 'error') }
    }
    // Load plugin
    if (entry.pluginUri) {
      const spec = typeof entry.pluginUri === 'string' ? entry.pluginUri : entry.pluginUri.spec
      const integrity = typeof entry.pluginUri === 'object' ? entry.pluginUri.integrity : undefined
      await loadOne(spec, deps, integrity).catch(err => log(`${spec}: ${(err as Error).message}`, 'error'))
    }
  }
  useHostStore.setState({ progress: false })
}

boot().catch(err => root.render(<FatalError error={err} />))
