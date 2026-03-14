import { useState, useEffect, useCallback } from 'react'
import { Download, Trash2, Package, ExternalLink } from 'react-feather'
import { doAction, getAllPlugins, isPluginEnabled, setPluginEnabled, type PluginFactory, type PluginDef } from '@obieg-zero/plugin-sdk'
import { installFromGitHub, installFromZip, installFromUrl, listInstalled, uninstallPlugin } from '../installer'
import { ListItem, Bar, Cell, Field } from '../themes'

const pluginManagerPlugin: PluginFactory = () => {
  function ManagerCenter() {
    const [installed, setInstalled] = useState<PluginDef[]>([])
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
    const [, rerender] = useState(0)

    const plugins = getAllPlugins()

    const refresh = useCallback(() => { listInstalled().then(setInstalled) }, [])
    useEffect(refresh, [])

    async function run(fn: () => Promise<PluginDef>) {
      setBusy(true); setMsg(null)
      try {
        const m = await fn()
        setMsg({ text: `Zainstalowano: ${m.label}`, ok: true })
        refresh()
      } catch (e: any) {
        setMsg({ text: e.message, ok: false })
      } finally { setBusy(false) }
    }

    function togglePlugin(id: string) {
      const enabling = !isPluginEnabled(id)
      setPluginEnabled(id, enabling)
      if (enabling) {
        const m = plugins.find(p => p.id === id)
        for (const req of m?.requires ?? []) { if (!isPluginEnabled(req)) setPluginEnabled(req, true) }
      } else {
        for (const p of plugins) { if (p.requires?.includes(id) && isPluginEnabled(p.id)) setPluginEnabled(p.id, false) }
      }
      rerender(n => n + 1)
    }

    function handleInstallUrl() {
      if (input.trim()) run(async () => { const m = await installFromUrl(input.trim()); setInput(''); return m })
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault()
      const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.zip'))
      if (!file) { setMsg({ text: 'Upuść plik .zip', ok: false }); return }
      run(() => installFromZip(file))
    }

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (file) run(() => installFromZip(file))
    }

    async function handleReinstall(m: PluginDef) {
      if (!m.repo) return
      run(async () => { await uninstallPlugin(m.id); return installFromGitHub(m.repo!) })
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col"
        onDragOver={e => e.preventDefault()} onDrop={handleDrop}>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {plugins.map(p => {
            const enabled = isPluginEnabled(p.id)
            const hasRoute = !!p.layout?.center
            return (
              <ListItem key={p.id} label={p.label} detail={p.description} separator
                aside={<>
                  {hasRoute && enabled && <button className="btn btn-ghost btn-xs btn-square" onClick={() => doAction('shell:activate', p.id)}><ExternalLink size={12} /></button>}
                  {p.alwaysOn
                    ? <span className="text-2xs text-base-content/30">always on</span>
                    : <input type="checkbox" className="toggle toggle-xs toggle-primary"
                        checked={enabled} onChange={() => togglePlugin(p.id)} />}
                </>} />
            )
          })}

          {installed.length > 0 && <>
            <Bar><Cell label>zainstalowane</Cell></Bar>
            {installed.map(p => (
              <ListItem key={p.id} label={p.label} detail={p.id}
                action={{ icon: Trash2, onClick: () => run(async () => { await uninstallPlugin(p.id); refresh(); return p }) }} />
            ))}
          </>}
        </div>

        <Field label="Instaluj">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleInstallUrl() }}
              placeholder="github.com/user/repo lub URL do .zip"
              className="input input-bordered input-sm text-xs flex-1" disabled={busy} />
            <button onClick={handleInstallUrl} className="btn btn-sm btn-primary" disabled={busy || !input.trim()}>
              <Download size={14} />
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <label className="btn btn-sm btn-ghost gap-2 text-xs">
              <Package size={14} /> ZIP
              <input type="file" accept=".zip" className="hidden" onChange={handleFileInput} />
            </label>
          </div>
          {msg && <p className={`text-2xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</p>}
        </Field>
      </div>
    )
  }

  return {
    id: 'plugin-manager',
    label: 'Pluginy',
    description: 'Instaluj pluginy z GitHub / ZIP',
    icon: Package,
    alwaysOn: true,
    layout: { center: ManagerCenter },
  }
}

export default pluginManagerPlugin
