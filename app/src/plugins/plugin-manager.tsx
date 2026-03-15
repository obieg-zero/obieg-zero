import { useState, useEffect, useCallback } from 'react'
import { Download, Trash2, Package, Lock, RefreshCw, Key, X } from 'react-feather'
import { getAllPlugins, isPluginEnabled, setPluginEnabled, type PluginFactory, type PluginDef, type RegistryEntry, type InstalledPlugin, type RegistryIndex } from '@obieg-zero/plugin-sdk'
import { fetchRegistry, installFromGitHub, installFromZip, installFromUrl, listInstalled, uninstallPlugin, updatePlugin, checkUpdates, getToken, setToken } from '../installer'
import type { UpdateInfo } from '@obieg-zero/plugin-sdk'
import { Box, ListItem, Bar, Cell, Field, Tabs } from '../themes'

const pluginManagerPlugin: PluginFactory = () => {
  function ManagerCenter() {
    const [tab, setTab] = useState<'catalog' | 'installed'>('catalog')
    const [registry, setRegistry] = useState<RegistryIndex | null>(null)
    const [installed, setInstalled] = useState<InstalledPlugin[]>([])
    const [updates, setUpdates] = useState<UpdateInfo[]>([])
    const [busy, setBusy] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
    const [filter, setFilter] = useState('')
    const [tokenInput, setTokenInput] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [, rerender] = useState(0)

    const token = getToken()
    const plugins = getAllPlugins()

    const refresh = useCallback(async (force?: boolean) => {
      const inst = await listInstalled()
      setInstalled(inst)
      try {
        const reg = await fetchRegistry(force ? { force: true } : undefined)
        setRegistry(reg)
        // If cache returned empty, force refresh once
        if (!force && reg.plugins.length === 0) {
          const fresh = await fetchRegistry({ force: true })
          setRegistry(fresh)
        }
        const upd = await checkUpdates()
        setUpdates(upd)
      } catch { /* offline or no registry yet */ }
    }, [])

    useEffect(() => { refresh() }, [])

    async function run(id: string, fn: () => Promise<unknown>) {
      setBusy(id); setMsg(null)
      try {
        await fn()
        await refresh()
        setMsg({ text: 'OK', ok: true })
      } catch (e: any) {
        setMsg({ text: e.message, ok: false })
      } finally { setBusy(null) }
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

    function handleInstall(entry: RegistryEntry) {
      if (entry.private && !token) { setShowToken(true); return }
      run(entry.id, () => installFromGitHub(entry.repo, entry.private ? (token || undefined) : undefined))
    }

    function handleUpdate(pluginId: string) {
      run(pluginId, () => updatePlugin(pluginId, token || undefined))
    }

    function handleSaveToken() {
      setToken(tokenInput.trim() || null)
      setTokenInput('')
      setShowToken(false)
    }

    // --- Catalog tab ---
    function CatalogView() {
      if (!registry) return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-xs text-base-content/40">Ladowanie katalogu...</p>
            <button onClick={() => fetchRegistry({ force: true }).then(setRegistry)} className="btn btn-ghost btn-xs">Sprobuj ponownie</button>
          </div>
        </div>
      )

      const term = filter.toLowerCase()
      const filtered = registry.plugins.filter(p =>
        !term || p.label.toLowerCase().includes(term) || p.description.toLowerCase().includes(term) || p.tags?.some(t => t.includes(term))
      )

      return (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-4 space-y-2">
            <p className="text-xs text-base-content/30">Brak pluginow w katalogu.</p>
            <button onClick={() => refresh(true)}
              className="btn btn-ghost btn-xs">Odswiez katalog</button>
          </div>}
          {filtered.map(entry => {
            const inst = installed.find(i => i.id === entry.id)
            const upd = updates.find(u => u.pluginId === entry.id)
            const loading = busy === entry.id

            return (
              <ListItem key={entry.id} separator
                label={<span className="flex items-center gap-1.5">
                  {entry.private && <Lock size={10} className="text-warning shrink-0" />}
                  {entry.label}
                </span>}
                detail={entry.description}
                aside={<div className="flex items-center gap-1">
                  <span className="badge badge-ghost badge-sm text-2xs">{entry.version}</span>
                  {loading
                    ? <span className="loading loading-spinner loading-xs" />
                    : upd
                      ? <button className="btn btn-warning btn-xs" onClick={() => handleUpdate(entry.id)}>{upd.registryVersion}</button>
                      : inst
                        ? <span className="text-2xs text-success">zainstalowany</span>
                        : <button className="btn btn-primary btn-xs" onClick={() => handleInstall(entry)}>Instaluj</button>
                  }
                </div>}
              />
            )
          })}
        </div>
      )
    }

    // --- Installed tab ---
    function InstalledView() {
      return (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {plugins.map(p => {
            const inst = installed.find(i => i.id === p.id)
            const enabled = isPluginEnabled(p.id)
            return (
              <ListItem key={p.id} label={p.label} detail={p.description} separator
                aside={<div className="flex items-center gap-1">
                  {inst && <span className="badge badge-ghost badge-sm text-2xs">{inst.version}</span>}
                  {!inst && <span className="text-2xs text-base-content/20">wbudowany</span>}
                  {inst && <button className="btn btn-ghost btn-xs btn-square"
                    onClick={() => run(p.id, async () => { await uninstallPlugin(p.id); await refresh() })}><Trash2 size={12} /></button>}
                  {!p.alwaysOn && <input type="checkbox" className="toggle toggle-xs toggle-primary"
                    checked={enabled} onChange={() => togglePlugin(p.id)} />}
                </div>}
              />
            )
          })}
        </div>
      )
    }

    // --- Token prompt ---
    function TokenPrompt() {
      if (!showToken) return null
      return (
        <div className="px-3 py-2 bg-warning/10 border-b border-warning/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs text-warning font-medium">Token GitHub (repo read)</span>
            <button className="btn btn-ghost btn-xs btn-square" onClick={() => setShowToken(false)}><X size={12} /></button>
          </div>
          <div className="flex gap-2">
            <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveToken() }}
              placeholder="ghp_..." className="input input-bordered input-sm text-xs flex-1" />
            <button onClick={handleSaveToken} className="btn btn-sm btn-warning" disabled={!tokenInput.trim()}>Zapisz</button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <TokenPrompt />

        <Box header={<>
          <Cell label>
            <Tabs active={tab} onSelect={id => setTab(id as 'catalog' | 'installed')}
              items={[
                { id: 'catalog', label: `Katalog${registry ? ` (${registry.plugins.length})` : ''}` },
                { id: 'installed', label: `Zainstalowane (${installed.length})` },
              ]} />
          </Cell>
          {tab === 'catalog' && <>
            <Cell><input value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="szukaj..." className="input input-bordered input-xs text-xs w-28" /></Cell>
            <Cell onClick={() => refresh(true)}><RefreshCw size={14} /></Cell>
          </>}
        </>} body={tab === 'catalog' ? <CatalogView /> : <InstalledView />} />

        <div className="shrink-0 border-t border-base-300 px-3 py-2 flex items-center justify-between">
          {token
            ? <span className="flex items-center gap-1 text-2xs text-success"><Key size={10} /> Token aktywny
              <button className="text-2xs text-base-content/30 hover:text-error ml-1" onClick={() => setToken(null)}>usun</button>
            </span>
            : <button className="flex items-center gap-1 text-2xs text-base-content/30 hover:text-base-content/50" onClick={() => setShowToken(true)}>
              <Key size={10} /> Dodaj token GitHub
            </button>
          }
          {msg && <span className={`text-2xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</span>}
        </div>
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
