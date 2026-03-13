import { useState, useEffect, type ReactNode } from 'react'
import { Menu, ChevronLeft } from 'react-feather'
import { getAllPlugins, isPluginEnabled, addAction } from '@obieg-zero/plugin-sdk'
import type { PluginManifest } from '@obieg-zero/plugin-sdk'
import { PluginErrorBoundary } from './components/Box'

export function Shell() {
  const [leftOpen, setLeftOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem('bp-active'))
  const [, rerender] = useState(0)

  const plugins = getAllPlugins().filter(p => isPluginEnabled(p.id))
  const withLayout = plugins.filter(p => p.layout?.center)
  const active = withLayout.find(p => p.id === activeId) ?? withLayout[0]
  const { left: Left, center: Center, footer: Footer, wrapper: Wrapper } = active?.layout ?? {}
  const hasLeft = !!Left

  // Collect action nodes from plugins that have them
  const actionPlugins = plugins.filter(p => p.action)

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
              {active ? plugins.find(p => p.id === active.id)?.label ?? '' : 'obieg-zero'}
            </div>
            {/* Plugin actions in navbar */}
            {actionPlugins.map(p => (
              <div key={p.id} className={`self-stretch flex items-center ${active?.id === p.id ? 'text-primary' : ''}`}>{p.action}</div>
            ))}
            {/* Activity bar: icons for plugins with layout */}
            {withLayout.map(p => {
              const Icon = p.icon
              if (!Icon) return null
              return (
                <div key={p.id} className={`self-stretch flex items-center ${active?.id === p.id ? 'text-primary' : ''}`}>
                  <button className="btn btn-ghost btn-sm btn-square mx-1" onClick={() => setActiveId(p.id)}>
                    <Icon size={16} />
                  </button>
                </div>
              )
            })}
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
