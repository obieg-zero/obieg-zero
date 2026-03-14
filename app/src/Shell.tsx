import { useState, useEffect } from 'react'
import { getAllPlugins, isPluginEnabled, addAction } from '@obieg-zero/plugin-sdk'
import { Layout } from './themes'

export function Shell() {
  const [leftOpen, setLeftOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem('bp-active'))
  const [progress, setProgress] = useState(false)
  const [, rerender] = useState(0)

  const plugins = getAllPlugins().filter(p => isPluginEnabled(p.id))
  const withLayout = plugins.filter(p => p.layout?.center)
  const active = withLayout.find(p => p.id === activeId) ?? withLayout[0]

  useEffect(() => { if (activeId) localStorage.setItem('bp-active', activeId) }, [activeId])

  useEffect(() => {
    const c1 = addAction('shell:toggle-left', () => setLeftOpen(o => !o))
    const c2 = addAction('shell:close-left', () => setLeftOpen(false))
    const c3 = addAction('shell:activate', (id: string) => { setActiveId(id); rerender(n => n + 1) })
    const c4 = addAction('shell:progress', (on: boolean) => setProgress(on))
    return () => { c1(); c2(); c3(); c4() }
  }, [])

  return <Layout
    {...active?.layout}
    label={active?.label ?? 'obieg-zero'}
    progress={progress}
    leftOpen={leftOpen}
    toggleLeft={() => setLeftOpen(o => !o)}
    navItems={withLayout.map(p => ({ id: p.id, icon: p.icon, active: active?.id === p.id, onActivate: () => setActiveId(p.id) }))}
    actionSlots={plugins.filter(p => p.action).map(p => p.action!)}
  />
}
