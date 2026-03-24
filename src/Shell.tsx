import { useEffect } from 'react'
import { Menu, ChevronLeft } from 'react-feather'
import { useHostStore } from './plugin'
import { Layout, LeftColumn, CenterColumn, RightColumn, Bar, Cell, NavButton, ActionSlot, Content, LogBox, Placeholder, PluginErrorBoundary } from './ui'

export const Shell = () => {
  const { plugins, logs, activeId, leftOpen, progress } = useHostStore()
  const setActiveId = (id: string) => useHostStore.setState({ activeId: id })

  const routed = plugins.filter(p => p.layout?.center)
  const active = routed.find(p => p.id === activeId) ?? routed[0] ?? null

  const { left: Left, center: Center, right: Right, footer: Footer } = active?.layout ?? {}
  const hasLogs = logs.length > 0

  useEffect(() => {
    if (active && activeId !== active.id) setActiveId(active.id)
  }, [activeId, routed.length])

  return (
    <Layout progress={progress} leftOpen={leftOpen}
      left={Left ? (
        <LeftColumn><PluginErrorBoundary><Left /></PluginErrorBoundary></LeftColumn>
      ) : undefined}
      center={
        <CenterColumn footer={
          <Bar>
            <Cell label>{Footer && <PluginErrorBoundary><Footer /></PluginErrorBoundary>}</Cell>
            <Cell padded><span className="opacity-40">v2</span></Cell>
          </Bar>
        }>
          <Bar>
            {Left && <Cell onClick={() => useHostStore.setState(s => ({ leftOpen: !s.leftOpen }))} mobileOnly>{leftOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}</Cell>}
            <Cell label>{active?.label ?? 'plugin-host'}</Cell>
            {routed.map(p => p.icon && <NavButton key={p.id} icon={p.icon} label={p.label} active={p.id === active?.id} onClick={() => setActiveId(p.id)} />)}
            {plugins.filter(p => p.action).map(p => <ActionSlot key={p.id}>{p.action}</ActionSlot>)}
          </Bar>
          <Content>
            {Center ? <PluginErrorBoundary><Center /></PluginErrorBoundary> : <Placeholder text="Ładowanie pluginów…" />}
          </Content>
        </CenterColumn>
      }
      right={(Right || hasLogs) ? (
        <RightColumn>
          {Right && <PluginErrorBoundary><Right /></PluginErrorBoundary>}
          {hasLogs && <LogBox />}
        </RightColumn>
      ) : undefined}
    />
  )
}
