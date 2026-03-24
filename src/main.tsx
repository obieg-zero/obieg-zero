import './index.css'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as jsxRuntime from 'react/jsx-runtime'
import { createRoot } from 'react-dom/client'
import * as icons from 'react-feather'
import * as ui from './ui'
import { FatalError } from './ui'
import { create } from 'zustand'
import { getAllPlugins, unregisterPlugin, log, loadOne, openFileDialog } from './plugin'
import { zipSync, strToU8 } from 'fflate'
import type { PluginDeps } from './plugin'
import { useHostStore } from './plugin'
import { createStore } from './store'
import { Shell } from './Shell'

;(window as any).__jsx_runtime = jsxRuntime
;(window as any).__react = React
;(window as any).__react_dom = ReactDOM
const root = createRoot(document.getElementById('root')!)

async function boot() {
  const config = await fetch('./config.json').then(r => r.json()).catch(() => ({}))
  const store = createStore()
  const shared = create(() => ({} as Record<string, any>))
  const deps: PluginDeps = {
    React, ui, icons, store,
    sdk: {
      shared, getAllPlugins, unregisterPlugin, log,
      loadPlugin: (spec: string) => loadOne(spec, deps), openFileDialog, useHostStore, create,
      zip: (files: Record<string, Uint8Array | string>) => {
        const mapped: Record<string, Uint8Array> = {}
        for (const [k, v] of Object.entries(files)) mapped[k] = typeof v === 'string' ? strToU8(v) : v
        return new Blob([zipSync(mapped).buffer as ArrayBuffer], { type: 'application/zip' })
      },
      useForm: (defaults: any, opts?: { onSubmit?: (data: any) => void, isComplete?: (data: any) => boolean, sync?: any }) => {
        const [form, sf] = React.useState(defaults)
        const [editing, setEditing] = React.useState(false)
        React.useEffect(() => { if (opts?.sync) sf(opts.sync) }, [JSON.stringify(opts?.sync)])
        const bind = (key: string, transform?: (v: any) => any) => ({ value: form[key] ?? '', onChange: (e: any) => { const raw = typeof e === 'object' && e?.target ? e.target.value : e; sf((f: any) => ({ ...f, [key]: transform ? transform(raw) : raw })) } })
        const set = (kOrO: string | Record<string, any>, v?: any) => sf((f: any) => typeof kOrO === 'string' ? { ...f, [kOrO]: v } : { ...f, ...kOrO })
        const incomplete = opts?.isComplete ? !opts.isComplete(form) : false
        const showForm = editing || incomplete
        const submit = () => { if (opts?.isComplete && !opts.isComplete(form)) { log('Wypełnij wymagane pola', 'error'); return }; opts?.onSubmit?.(form); setEditing(false) }
        const toggle = () => { if (opts?.sync) sf(opts.sync); setEditing(!editing) }
        const reset = () => sf(defaults)
        return { form, bind, set, incomplete, showForm, editing, submit, toggle, reset }
      },
    },
  }
  if (import.meta.env.DEV) (window as any).__ph = deps

  root.render(<Shell />)

  // Load entries: [{pluginUri, importData, defaultOptions}]
  const entries: any[] = Array.isArray(config) ? config : []
  useHostStore.setState({ progress: true })
  for (const entry of entries) {
    // Default options (once)
    if (entry.defaultOptions) {
      for (const [k, v] of Object.entries(entry.defaultOptions)) {
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
