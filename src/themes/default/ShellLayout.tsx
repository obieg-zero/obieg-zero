import type { ComponentType, ReactNode } from 'react'
import { Menu, ChevronLeft } from 'react-feather'
import { Layout, LeftColumn, CenterColumn, RightColumn, Bar, Content, ActionSlot } from './columns'
import { Cell, Placeholder } from '@obieg-zero/sdk/src/ui'
import { NavButton, LogBox, PluginErrorBoundary, type LogEntry } from './chrome'
import { version } from '../../../package.json'

export interface PluginNav {
  id: string
  label: string
  icon?: ComponentType<{ size?: number }>
}

export interface ActionEntry {
  pluginId: string
  node: ReactNode
}

export interface ShellLayoutProps {
  plugins: PluginNav[]
  activeId: string | null
  leftOpen: boolean
  progress: boolean
  logs: LogEntry[]
  Left?: ComponentType
  Center?: ComponentType
  Right?: ComponentType
  Footer?: ComponentType
  actions: ActionEntry[]
  hasLeft: boolean
  onToggleLeft: () => void
  onSetActive: (id: string) => void
  onClearLog: () => void
}

export function ShellLayout({
  plugins, activeId, leftOpen, progress, logs,
  Left, Center, Right, Footer, actions,
  hasLeft, onToggleLeft, onSetActive, onClearLog,
}: ShellLayoutProps) {
  const active = plugins.find(p => p.id === activeId) ?? plugins[0] ?? null
  const hasLogs = logs.length > 0

  return (
    <Layout progress={progress} leftOpen={leftOpen}
      left={Left ? (
        <LeftColumn><PluginErrorBoundary><Left /></PluginErrorBoundary></LeftColumn>
      ) : undefined}
      center={
        <CenterColumn footer={
          <Bar>
            <Cell label>{Footer && <PluginErrorBoundary><Footer /></PluginErrorBoundary>}</Cell>
            <Cell padded><span className="opacity-40">v{version}</span></Cell>
          </Bar>
        }>
          <Bar>
            {hasLeft && <Cell onClick={onToggleLeft} mobileOnly>{leftOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}</Cell>}
            <Cell label>{active?.label ?? 'plugin-host'}</Cell>
            {[...plugins].reverse().map(p => p.icon && (
              <NavButton key={p.id} icon={p.icon} label={p.label} active={p.id === active?.id} onClick={() => onSetActive(p.id)} />
            ))}
            {actions.map(a => <ActionSlot key={a.pluginId}>{a.node}</ActionSlot>)}
          </Bar>
          <Content>
            {Center ? <PluginErrorBoundary><Center /></PluginErrorBoundary> : <Placeholder text="Ładowanie pluginów…" />}
          </Content>
        </CenterColumn>
      }
      right={(Right || hasLogs) ? (
        <RightColumn>
          {Right && <PluginErrorBoundary><Right /></PluginErrorBoundary>}
          {hasLogs && <LogBox logs={logs} onClear={onClearLog} />}
        </RightColumn>
      ) : undefined}
    />
  )
}
