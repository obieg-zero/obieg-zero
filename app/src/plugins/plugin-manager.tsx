import { useState, useEffect, useCallback } from 'react'
import { Download, Trash2, RefreshCw, Package, ExternalLink } from 'react-feather'
import type { PluginFactory, PluginManifestData } from '@obieg-zero/plugin-sdk'
import { doAction, applyFilters, getAllPlugins, isPluginEnabled, setPluginEnabled, installFromGitHub, installFromZip, installFromUrl, listInstalled, uninstallPlugin } from '@obieg-zero/plugin-sdk'
import { Cell } from '../components/Box'

const pluginManagerPlugin: PluginFactory = (sdk) => {
  function ManagerCenter() {
    const [installed, setInstalled] = useState<PluginManifestData[]>([])
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
    const [, rerender] = useState(0)

    const plugins = getAllPlugins()
    const routeIds = new Set(applyFilters<{ pluginId: string }[]>('routes', []).map(r => r.pluginId))

    const refresh = useCallback(() => { listInstalled().then(setInstalled) }, [])
    useEffect(refresh, [])

    async function run(fn: () => Promise<PluginManifestData>) {
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
        // auto-enable dependencies
        const m = plugins.find(p => p.id === id)
        for (const req of m?.requires ?? []) { if (!isPluginEnabled(req)) setPluginEnabled(req, true) }
      } else {
        // auto-disable plugins that require this one
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

    async function handleReinstall(m: PluginManifestData) {
      if (!m.repo) return
      run(async () => { await uninstallPlugin(m.id); return installFromGitHub(m.repo!) })
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col"
        onDragOver={e => e.preventDefault()} onDrop={handleDrop}>

        <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-1">
          <table className="table table-sm">
            <tbody>
              {plugins.map(p => {
                const enabled = isPluginEnabled(p.id)
                const hasRoute = routeIds.has(p.id)
                return (
                  <tr key={p.id} className={enabled ? '' : 'opacity-50'}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{p.label}</span>
                        {hasRoute && enabled && (
                          <button className="btn btn-ghost btn-xs btn-square"
                            title={`Otwórz ${p.label}`} onClick={() => doAction('shell:activate', p.id)}>
                            <ExternalLink size={12} />
                          </button>
                        )}
                      </div>
                      <div className="text-2xs text-base-content/40">{p.description}</div>
                    </td>
                    <td className="w-10 align-top">
                      {p.alwaysOn
                        ? <span className="text-2xs text-base-content/30">Always on</span>
                        : <input type="checkbox" className="toggle toggle-xs toggle-primary"
                            checked={enabled} onChange={() => togglePlugin(p.id)} />
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {installed.length > 0 && <>
            <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium mt-2 pt-2 border-t border-base-300">zainstalowane</div>
            {installed.map(p => (
              <div key={p.id} className="flex items-center h-8 px-2 rounded-md hover:bg-base-200 group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-base-content/70 truncate">{p.label}</span>
                  <span className="text-2xs text-base-content/30 ml-2">{p.id}</span>
                </div>
                {p.repo && (
                  <button className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-40"
                    title="Aktualizuj z GitHub" onClick={() => handleReinstall(p)}>
                    <RefreshCw size={12} />
                  </button>
                )}
                <button className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-40"
                  title="Odinstaluj" onClick={async () => { await uninstallPlugin(p.id); refresh() }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </>}
        </div>

        <div className="p-3 border-t border-base-300 space-y-2">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleInstallUrl() }}
              placeholder="github.com/user/repo lub URL do .zip"
              className="input input-bordered input-sm text-xs flex-1" disabled={busy} />
            <button onClick={handleInstallUrl} className="btn btn-sm btn-primary" disabled={busy || !input.trim()}>
              <Download size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <label className="btn btn-sm btn-ghost gap-2 text-xs">
              <Package size={14} /> ZIP
              <input type="file" accept=".zip" className="hidden" onChange={handleFileInput} />
            </label>
            <span className="text-2xs text-base-content/30 self-center">lub upuść .zip na stronę</span>
          </div>
          {msg && <p className={`text-2xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</p>}
        </div>
      </div>
    )
  }

  sdk.registerManifest({ id: 'plugin-manager', label: 'Pluginy', description: 'Instaluj pluginy z GitHub / ZIP', alwaysOn: true })
  sdk.addFilter('shell:actions', (actions: any[]) => [...actions, {
    pluginId: 'plugin-manager',
    node: <Cell onClick={() => doAction('shell:activate', 'plugin-manager')}><Package size={16} /></Cell>
  }], 20, 'plugin-manager')
  sdk.addFilter('routes', (routes: any[]) => [...routes, {
    path: '/plugins', pluginId: 'plugin-manager',
    layout: { center: ManagerCenter }
  }])
}

export default pluginManagerPlugin
