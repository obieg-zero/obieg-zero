import { Component, useEffect, useRef, type ComponentType, type ReactNode } from 'react'
import { clearLog, useHostStore } from './plugin'
import { Box, Cell, bar } from '@obieg-zero/sdk/src/ui'

// Re-export all SDK components (plugins get these via deps.ui)
export * from '@obieg-zero/sdk/src/ui'

// ── Shell-only (not exposed to plugins) ─────────────────────────────

export const Bar = ({ children }: { children: ReactNode }) => <div className={`${bar} border-b`}>{children}</div>

const Col = (base: string, inner = '') => ({ children, footer }: { children: ReactNode; footer?: ReactNode }) =>
  <div className={`flex flex-col h-full min-h-0 bg-base-100 ${base}`}><div className={`flex-1 min-h-0 flex flex-col overflow-y-auto ${inner}`}>{children}</div>{footer && <div className="shrink-0 border-t border-base-300">{footer}</div>}</div>

export const LeftColumn = Col('w-80 shrink-0 border-r border-dashed border-base-300')
export const CenterColumn = Col('flex-1 min-w-0 max-md:min-w-screen overflow-hidden', 'overflow-x-hidden')
export const RightColumn = Col('w-80 shrink-0 border-l border-dashed border-base-300')
export const Content = ({ children }: { children: ReactNode }) => <div className="flex-1 min-h-0 flex flex-col bg-base-100">{children}</div>
export const ActionSlot = ({ children }: { children: ReactNode }) => <div className="self-stretch flex items-center">{children}</div>

export function Layout({ left, center, right, progress, leftOpen }: { left?: ReactNode; center: ReactNode; right?: ReactNode; progress?: boolean; leftOpen?: boolean }) {
  return <div className="h-screen overflow-hidden bg-base-200 text-xs text-base-content flex flex-col">
    {progress && <progress className="progress progress-primary w-full h-1 shrink-0" />}
    <div className={`flex flex-1 min-h-0 transition-transform duration-300 ${left && !leftOpen ? 'max-md:-translate-x-80' : ''}`}>{left}{center}{right}</div>
  </div>
}

export function NavButton({ icon: Icon, label, active, onClick }: { icon: ComponentType<{ size?: number }>; label: string; active: boolean; onClick: () => void }) {
  return <div className={`tooltip tooltip-bottom self-stretch flex items-center ${active ? 'text-primary' : ''}`} data-tip={label}>
    <button className={`btn btn-sm btn-square mx-1 ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick} aria-label={label}><Icon size={16} /></button>
  </div>
}

export function LogBox() {
  const logs = useHostStore(s => s.logs)
  const ref = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const onScroll = () => { const el = ref.current; if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30 }
  useEffect(() => { if (pinned.current) ref.current?.scrollTo(0, ref.current.scrollHeight) }, [logs])
  if (!logs.length) return null
  return <Box grow header={<><Cell label>log</Cell><Cell onClick={clearLog}><span className="text-xs">×</span></Cell></>}
    body={<div ref={ref} onScroll={onScroll} className="-m-2 p-2 space-y-0.5">{logs.map((l, i) => <div key={i} className={`text-2xs font-mono ${{ info: 'text-base-content/30', ok: 'text-success', error: 'text-error' }[l.level]}`}>{l.text}</div>)}</div>} />
}

export const FatalError = ({ error }: { error: unknown }) =>
  <Layout center={<CenterColumn><Content><div className="hero flex-1"><div className="hero-content text-center"><p className="text-base-content/30 text-xs">{error instanceof Error ? error.message : String(error)}</p></div></div></Content></CenterColumn>} />

export class PluginErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return <div className="hero flex-1"><div className="hero-content text-center"><div>
      <p className="text-base-content/30 text-xs">Plugin crash: {this.state.error.message}</p>
      <button className="btn btn-ghost btn-xs mt-2" onClick={() => this.setState({ error: null })}>Spróbuj ponownie</button>
    </div></div></div>
    return this.props.children
  }
}
