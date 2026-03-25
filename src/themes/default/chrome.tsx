import { Component, useEffect, useRef, type ComponentType, type ReactNode } from 'react'
import { Box, Cell } from '@obieg-zero/sdk/src/ui'
import { Layout, CenterColumn, Content } from './columns'

// ── Types ────────────────────────────────────────────────────────────

export type LogEntry = { text: string; level: 'info' | 'ok' | 'error'; ts: number }

// ── NavButton ────────────────────────────────────────────────────────

export function NavButton({ icon: Icon, label, active, onClick }: {
  icon: ComponentType<{ size?: number }>; label: string; active: boolean; onClick: () => void
}) {
  return (
    <div className={`tooltip tooltip-bottom self-stretch flex items-center ${active ? 'text-primary' : ''}`} data-tip={label}>
      <button className={`btn btn-sm btn-square mx-1 ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick} aria-label={label}>
        <Icon size={16} />
      </button>
    </div>
  )
}

// ── LogBox (pure — receives data via props) ──────────────────────────

export function LogBox({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const onScroll = () => {
    const el = ref.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30
  }
  useEffect(() => { if (pinned.current) ref.current?.scrollTo(0, ref.current.scrollHeight) }, [logs])
  if (!logs.length) return null
  return (
    <Box grow
      header={<><Cell label>log</Cell><Cell onClick={onClear}><span className="text-xs">×</span></Cell></>}
      body={
        <div ref={ref} onScroll={onScroll} className="-m-2 p-2 space-y-0.5">
          {logs.map((l, i) => (
            <div key={i} className={`text-2xs font-mono ${{ info: 'text-base-content/30', ok: 'text-success', error: 'text-error' }[l.level]}`}>
              {l.text}
            </div>
          ))}
        </div>
      }
    />
  )
}

// ── FatalError ───────────────────────────────────────────────────────

export const FatalError = ({ error }: { error: unknown }) =>
  <Layout center={
    <CenterColumn>
      <Content>
        <div className="hero flex-1">
          <div className="hero-content text-center">
            <p className="text-base-content/30 text-xs">{error instanceof Error ? error.message : String(error)}</p>
          </div>
        </div>
      </Content>
    </CenterColumn>
  } />

// ── PluginErrorBoundary ──────────────────────────────────────────────

export class PluginErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return (
      <div className="hero flex-1">
        <div className="hero-content text-center">
          <div>
            <p className="text-base-content/30 text-xs">Plugin crash: {this.state.error.message}</p>
            <button className="btn btn-ghost btn-xs mt-2" onClick={() => this.setState({ error: null })}>Spróbuj ponownie</button>
          </div>
        </div>
      </div>
    )
    return this.props.children
  }
}
