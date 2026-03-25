import { useEffect, useMemo } from 'react'
import { useHostStore, getViews, getActions, clearLog } from './plugin'
import { ShellLayout } from './themes'

export const Shell = () => {
  const plugins = useHostStore(s => s.plugins)
  const activeId = useHostStore(s => s.activeId)
  const leftOpen = useHostStore(s => s.leftOpen)
  const progress = useHostStore(s => s.progress)
  const logs = useHostStore(s => s.logs)
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
    <ShellLayout
      plugins={routed}
      activeId={active?.id ?? null}
      leftOpen={leftOpen}
      progress={progress}
      logs={logs}
      Left={Left}
      Center={Center}
      Right={Right}
      Footer={Footer}
      actions={allActions}
      hasLeft={!!Left}
      onToggleLeft={() => useHostStore.setState(s => ({ leftOpen: !s.leftOpen }))}
      onSetActive={setActiveId}
      onClearLog={clearLog}
    />
  )
}
