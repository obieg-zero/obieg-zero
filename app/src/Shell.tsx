import { useState, useEffect, type ReactNode } from 'react'
import { Menu, ChevronLeft } from 'react-feather'
import { applyFilters, getAllPlugins, isPluginEnabled, addAction } from '@obieg-zero/plugin-sdk'
import type { RouteEntry } from '@obieg-zero/plugin-sdk'
import { PluginErrorBoundary } from './components/Box'

export function Shell() {
  const [leftOpen, setLeftOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem('bp-active'))
  const [, rerender] = useState(0)

  const allRoutes = applyFilters<RouteEntry[]>('routes', [])
  const routes = allRoutes.filter(r => isPluginEnabled(r.pluginId))
  const plugins = getAllPlugins()
  const active = routes.find(r => r.pluginId === activeId) ?? routes[0]
  const actions = applyFilters<{ pluginId: string; node: ReactNode }[]>('shell:actions', [])
  const { left: Left, center: Center, footer: Footer, wrapper: Wrapper } = active?.layout ?? {}
  const hasLeft = !!Left

  useEffect(() => { if (activeId) localStorage.setItem('bp-active', activeId) }, [activeId])

  useEffect(() => {
    const c1 = addAction('shell:toggle-left', () => setLeftOpen(o => !o))
    const c2 = addAction('shell:close-left', () => setLeftOpen(false))
    const c3 = addAction('shell:activate', (id: string) => { setActiveId(id); rerender(n => n + 1) })
    return () => { c1(); c2(); c3() }
  }, [])

  const shell = (
    <div className="h-screen overflow-hidden bg-base-200 text-sm text-base-content">
      <div className={`flex h-full transition-transform duration-300 ease-in-out ${hasLeft && !leftOpen ? 'max-md:-translate-x-72' : ''}`}>
        {hasLeft && (
          <div className="w-72 shrink-0 border-r border-base-300 flex flex-col h-full min-h-0 bg-base-100">
            <PluginErrorBoundary><Left /></PluginErrorBoundary>
          </div>
        )}
        <div className="flex-1 max-md:min-w-[100vw] flex flex-col bg-base-100 min-h-0">
          <div className="h-10 min-h-10 shrink-0 flex items-center border-b border-base-300 divide-x divide-base-300">
            {hasLeft && (
              <div className="md:hidden self-stretch flex items-center px-1">
                <button className="btn btn-ghost btn-sm btn-square" onClick={() => setLeftOpen(!leftOpen)}>
                  {leftOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
                </button>
              </div>
            )}
            <div className="self-stretch flex items-center flex-1 px-3 text-2xs uppercase tracking-wider text-base-content/25 font-medium">
              {active?.layout ? plugins.find(p => p.id === active.pluginId)?.label ?? '' : 'obieg-zero'}
            </div>
            {actions.map(a => <div key={a.pluginId} className={`self-stretch flex items-center ${active?.pluginId === a.pluginId ? 'text-primary' : ''}`}>{a.node}</div>)}
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
    </div>
  )

  return Wrapper ? <Wrapper>{shell}</Wrapper> : shell
}
