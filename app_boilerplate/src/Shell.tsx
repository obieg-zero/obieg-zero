import { useState, useEffect, type ReactNode } from 'react'
import { Menu, ChevronLeft, Sidebar, X } from 'react-feather'
import { applyFilters, getAllPlugins, isPluginEnabled, setPluginEnabled, addAction } from '@obieg-zero/plugin-sdk'
import type { RouteEntry } from '@obieg-zero/plugin-sdk'
import { Box, Cell, PluginErrorBoundary } from './components/Box'

export function Shell() {
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem('bp-active'))
  const [, rerender] = useState(0)

  const allRoutes = applyFilters<RouteEntry[]>('routes', [])
  const routes = allRoutes.filter(r => isPluginEnabled(r.pluginId))
  const plugins = getAllPlugins()
  const active = routes.find(r => r.pluginId === activeId) ?? routes[0]
  const actions = applyFilters<{ pluginId: string; node: ReactNode }[]>('shell:actions', [])
  const hasRoute = (id: string) => allRoutes.some(r => r.pluginId === id)

  useEffect(() => { if (activeId) localStorage.setItem('bp-active', activeId) }, [activeId])

  useEffect(() => {
    const c1 = addAction('shell:toggle-left', () => setLeftOpen(o => !o))
    const c2 = addAction('shell:close-left', () => setLeftOpen(false))
    const c3 = addAction('shell:toggle-right', () => setRightOpen(o => !o))
    const c4 = addAction('shell:activate', (id: string) => setActiveId(id))
    return () => { c1(); c2(); c3(); c4() }
  }, [])

  function togglePlugin(id: string) {
    const enabled = isPluginEnabled(id)
    setPluginEnabled(id, !enabled)
    if (!enabled) setActiveId(id)
    else if (activeId === id) setActiveId(null)
    rerender(n => n + 1)
  }

  const { left: Left, center: Center, footer: Footer, wrapper: Wrapper } = active?.layout ?? {}

  const shell = (
    <div className="h-screen overflow-hidden bg-base-200 text-sm text-base-content">
      <div className={`flex h-full transition-transform duration-300 ease-in-out ${leftOpen ? '' : 'max-md:-translate-x-72'}`}>
        <div className="w-72 shrink-0 border-r border-base-300 flex flex-col h-full min-h-0 bg-base-100">
          {Left ? <PluginErrorBoundary><Left /></PluginErrorBoundary> : <Box header={<Cell label>sidebar</Cell>} />}
        </div>
        <div className="flex-1 max-md:min-w-[100vw] flex flex-col bg-base-100 min-h-0">
          <div className="h-10 min-h-10 shrink-0 flex items-center border-b border-base-300 divide-x divide-base-300">
            <Cell className="md:hidden" onClick={() => { setLeftOpen(!leftOpen); if (!leftOpen) setRightOpen(false) }}>
              {leftOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
            </Cell>
            <Cell label>{active?.layout ? plugins.find(p => p.id === active.pluginId)?.label ?? '' : 'obieg-zero'}</Cell>
            {actions.map(a => <div key={a.pluginId} className={`self-stretch flex items-center ${active?.pluginId === a.pluginId ? 'text-primary' : ''}`}>{a.node}</div>)}
            <Cell onClick={() => setRightOpen(!rightOpen)}><Sidebar size={16} /></Cell>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {Center ? <PluginErrorBoundary><Center /></PluginErrorBoundary> : (
              <div className="hero flex-1"><div className="hero-content text-center">
                <p className="text-xs text-base-content/30">Wybierz plugin.</p>
              </div></div>
            )}
          </div>
          {Footer && <PluginErrorBoundary><Footer /></PluginErrorBoundary>}
        </div>
      </div>
      {rightOpen && (
        <Box className="w-72 shrink-0 border-l border-base-300 absolute right-0 top-0 bottom-0 z-40 shadow-lg"
          header={<><Cell label>pluginy</Cell><Cell onClick={() => setRightOpen(false)}><X size={16} /></Cell></>}
          body={<div className="space-y-1">
            {plugins.map(p => {
              const enabled = isPluginEnabled(p.id)
              const isActive = active?.pluginId === p.id
              return (
                <div key={p.id} onClick={() => { if (!enabled) { setPluginEnabled(p.id, true); rerender(n => n + 1) } if (hasRoute(p.id)) setActiveId(p.id) }}
                  className={`flex items-center px-2 py-2 rounded-md hover:bg-base-200 cursor-pointer ${isActive ? 'bg-primary/10' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${isActive ? 'text-primary' : ''}`}>{p.label}</div>
                    <div className="text-2xs text-base-content/30 mt-1">{p.description}</div>
                  </div>
                  <input type="checkbox" className="toggle toggle-xs toggle-primary ml-2"
                    checked={enabled} onChange={e => { e.stopPropagation(); togglePlugin(p.id) }} />
                </div>
              )
            })}
          </div>}
        />
      )}
    </div>
  )

  return Wrapper ? <Wrapper>{shell}</Wrapper> : shell
}
