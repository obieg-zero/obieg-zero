import { useState, useEffect, useCallback } from 'react'
import { Download, Trash2, Package, RefreshCw } from 'react-feather'
import { getAllPlugins, isPluginEnabled, setPluginEnabled, type PluginFactory, type PluginManifest } from '@obieg-zero/plugin-sdk'
import { fetchRegistry, install, installFromZip, uninstall, listInstalled } from '../installer'
import { ListItem, Box, Bar, Cell, Tabs } from '../themes'

const pluginManagerPlugin: PluginFactory = () => {
  function ManagerCenter() {
    const [tab, setTab] = useState<'catalog' | 'installed'>('catalog')
    const [registry, setRegistry] = useState<PluginManifest[] | null>(null)
    const [installed, setInstalled] = useState<PluginManifest[]>([])
    const [busy, setBusy] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
    const [, rerender] = useState(0)

    const plugins = getAllPlugins()

    const refresh = useCallback(async () => {
      setInstalled(await listInstalled())
      try { setRegistry(await fetchRegistry()) } catch {}
    }, [])

    useEffect(() => { refresh() }, [])

    async function run(id: string, fn: () => Promise<unknown>) {
      setBusy(id); setMsg(null)
      try { await fn(); await refresh(); setMsg({ text: 'OK', ok: true }) }
      catch (e: any) { setMsg({ text: e.message, ok: false }) }
      finally { setBusy(null) }
    }

    function togglePlugin(id: string) {
      const enabling = !isPluginEnabled(id)
      setPluginEnabled(id, enabling)
      if (enabling) for (const req of plugins.find(p => p.id === id)?.requires ?? []) if (!isPluginEnabled(req)) setPluginEnabled(req, true)
      if (!enabling) for (const p of plugins) if (p.requires?.includes(id) && isPluginEnabled(p.id)) setPluginEnabled(p.id, false)
      rerender(n => n + 1)
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <Box header={<>
          <Cell label>
            <Tabs active={tab} onSelect={id => setTab(id as 'catalog' | 'installed')}
              items={[{ id: 'catalog', label: 'Katalog' }, { id: 'installed', label: 'Zainstalowane' }]} />
          </Cell>
          {tab === 'catalog' && <Cell onClick={refresh}><RefreshCw size={14} /></Cell>}
        </>} body={
          tab === 'catalog' ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {!registry && <p className="text-xs text-base-content/40 px-3 py-4">Ladowanie...</p>}
              {registry?.length === 0 && <p className="text-xs text-base-content/30 px-3 py-4">Katalog pusty.</p>}
              {registry?.map(entry => {
                const isInstalled = installed.some(i => i.id === entry.id)
                return (
                  <ListItem key={entry.id} separator label={entry.label} detail={entry.description}
                    aside={<div className="flex items-center gap-1">
                      <span className="badge badge-ghost badge-sm text-2xs">{entry.version}</span>
                      {busy === entry.id
                        ? <span className="loading loading-spinner loading-xs" />
                        : isInstalled
                          ? <span className="text-2xs text-success">zainstalowany</span>
                          : <button className="btn btn-primary btn-xs" onClick={() => run(entry.id, () => install(entry.repo!))}>Instaluj</button>
                      }
                    </div>}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {plugins.map(p => {
                const inst = installed.find(i => i.id === p.id)
                return (
                  <ListItem key={p.id} label={p.label} detail={p.description} separator
                    aside={<div className="flex items-center gap-1">
                      {inst ? <span className="badge badge-ghost badge-sm text-2xs">{inst.version}</span>
                        : <span className="text-2xs text-base-content/20">wbudowany</span>}
                      {inst && <button className="btn btn-ghost btn-xs btn-square"
                        onClick={() => run(p.id, () => uninstall(p.id))}><Trash2 size={12} /></button>}
                      {!p.alwaysOn && <input type="checkbox" className="toggle toggle-xs toggle-primary"
                        checked={isPluginEnabled(p.id)} onChange={() => togglePlugin(p.id)} />}
                    </div>}
                  />
                )
              })}
            </div>
          )
        } />
        {msg && <div className="shrink-0 border-t border-base-300 px-3 py-2">
          <span className={`text-2xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</span>
        </div>}
      </div>
    )
  }

  return {
    id: 'plugin-manager',
    label: 'Pluginy',
    description: 'Katalog i instalacja pluginow',
    icon: Package,
    alwaysOn: true,
    layout: { center: ManagerCenter },
  }
}

export default pluginManagerPlugin
