import { useEffect, useMemo } from 'react'
import { Menu, ChevronLeft } from 'react-feather'
import { useHostStore, getViews, getActions } from './plugin'
import { Layout, LeftColumn, CenterColumn, RightColumn, Bar, Cell, NavButton, ActionSlot, Content, LogBox, Placeholder, PluginErrorBoundary } from './ui'

export const Shell = () => {
  const plugins = useHostStore(s => s.plugins)
  const activeId = useHostStore(s => s.activeId)
  const leftOpen = useHostStore(s => s.leftOpen)
  const progress = useHostStore(s => s.progress)
  const hasLogs = useHostStore(s => s.logs.length > 0)
  const setActiveId = (id: string) => useHostStore.setState({ activeId: id })

  const allViews = useMemo(() => getViews(), [plugins])
  const allActions = useMemo(() => getActions(), [plugins])

  const routed = plugins.filter(p => allViews.some(v => v.pluginId === p.id && v.slot === 'center'))
  const active = routed.find(p => p.id === activeId) ?? routed[0] ?? null

  const viewFor = (slot: string) => allViews.find(v => v.pluginId === active?.id && v.slot === slot)?.component
  const Left = viewFor('left')
  const Center = viewFor('center')
  const Right = viewFor('right')
  const Footer = viewFor('footer')

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
            {allActions.map(a => <ActionSlot key={a.pluginId}>{a.node}</ActionSlot>)}
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
