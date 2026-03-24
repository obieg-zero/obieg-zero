import { Component, useState, useEffect, useRef, type ComponentType, type ReactNode, type MouseEventHandler } from 'react'
import { AlertCircle } from 'react-feather'
import { clearLog } from './plugin'
import { useHostStore } from './plugin'

type Color = 'primary' | 'secondary' | 'accent' | 'error' | 'warning' | 'info' | 'success' | 'neutral' | 'ghost'
type SemanticColor = 'primary' | 'accent' | 'error' | 'warning' | 'info' | 'success' | 'muted'

const logColor: Record<string, string> = { info: 'text-base-content/30', ok: 'text-success', error: 'text-error' }
const semColor = (c: string) => c === 'base' ? '' : c === 'muted' ? 'text-base-content/30' : `text-${c}`
const bar = 'h-9 min-h-9 shrink-0 flex items-center border-base-300 divide-x divide-base-300 bg-base-200 text-xs'

// ── Primitives ───────────────────────────────────────────────────────

export function Box({ header, body, footer, grow }: { header: ReactNode; body?: ReactNode; footer?: ReactNode; grow?: boolean }) {
  return (
    <div className={`flex flex-col min-h-0 ${grow ? 'flex-1 first:border-t-0 border-t border-base-300' : ''}`}>
      <div className={`${bar} border-b`}>{header}</div>
      {body && <div className={`${grow ? 'flex-1' : ''} min-h-0 overflow-y-auto p-2 space-y-2`}>{body}</div>}
      {footer && <div className={`${bar} border-t`}>{footer}</div>}
    </div>
  )
}

export function Cell({ children, onClick, label, padded, mobileOnly }: { children?: ReactNode; onClick?: MouseEventHandler; label?: boolean; padded?: boolean; mobileOnly?: boolean }) {
  const base = `self-stretch flex items-center ${label ? 'flex-1 px-3 text-xs uppercase tracking-wider text-base-content/60 font-medium' : padded ? 'px-3' : 'px-1'} ${mobileOnly ? 'md:hidden' : ''}`
  return <div className={base}>{onClick ? <button className="btn btn-ghost btn-sm btn-square" onClick={onClick}>{children}</button> : children}</div>
}

export const Bar = ({ children }: { children: ReactNode }) => <div className={`${bar} border-b`}>{children}</div>
export const ActionSlot = ({ children }: { children: ReactNode }) => <div className="self-stretch flex items-center">{children}</div>
export const Placeholder = ({ text, children }: { text: string; children?: ReactNode }) => <div className="hero flex-1"><div className="hero-content text-center"><div><p className="text-base-content/30 text-xs">{text}</p>{children && <div className="mt-4">{children}</div>}</div></div></div>
export const Content = ({ children }: { children: ReactNode }) => <div className="flex-1 min-h-0 flex flex-col bg-base-100">{children}</div>

export function NavButton({ icon: Icon, label, active, onClick }: { icon: ComponentType<{ size?: number }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <div className={`tooltip tooltip-bottom self-stretch flex items-center ${active ? 'text-primary' : ''}`} data-tip={label}>
      <button className={`btn btn-sm btn-square mx-1 ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick} aria-label={label}><Icon size={16} /></button>
    </div>
  )
}

// ── Columns & Layout ─────────────────────────────────────────────────

const Col = (base: string, inner = '') => ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
  <div className={`flex flex-col h-full min-h-0 bg-base-100 ${base}`}>
    <div className={`flex-1 min-h-0 flex flex-col overflow-y-auto ${inner}`}>{children}</div>
    {footer && <div className="shrink-0 border-t border-base-300">{footer}</div>}
  </div>
)

export const LeftColumn = Col('w-80 shrink-0 border-r border-base-300')
export const CenterColumn = Col('flex-1 min-w-0 max-md:min-w-screen overflow-hidden', 'overflow-x-hidden')
export const RightColumn = Col('w-80 shrink-0 border-l border-base-300')

export function Layout({ left, center, right, progress, leftOpen }: { left?: ReactNode; center: ReactNode; right?: ReactNode; progress?: boolean; leftOpen?: boolean }) {
  return (
    <div className="h-screen overflow-hidden bg-base-200 text-xs text-base-content flex flex-col">
      {progress && <progress className="progress progress-primary w-full h-1 shrink-0" />}
      <div className={`flex flex-1 min-h-0 transition-transform duration-300 ${left && !leftOpen ? 'max-md:-translate-x-80' : ''}`}>
        {left}{center}{right}
      </div>
    </div>
  )
}

// ── Components ───────────────────────────────────────────────────────

export function Button({ children, color = 'primary', size = 'sm', outline, block, disabled, onClick }: {
  children: ReactNode; color?: Color; size?: 'xs' | 'sm'; outline?: boolean; block?: boolean; disabled?: boolean; onClick?: () => void
}) { return <button className={`btn btn-${size} btn-${color} ${outline ? 'btn-outline' : ''} ${block ? 'btn-block' : ''}`} disabled={disabled} onClick={onClick}>{children}</button> }

export function Input({ value, type, placeholder, onChange, onKeyDown }: {
  value?: string; type?: string; placeholder?: string; onChange?: (e: { target: { value: string } }) => void; onKeyDown?: (e: { key: string }) => void
}) { return <input type={type} className="input input-sm w-full text-xs" value={value} placeholder={placeholder} onChange={onChange} onKeyDown={onKeyDown} /> }

export function Select({ value, options, onChange }: { value?: string; options: { value: string; label: string }[]; onChange?: (e: { target: { value: string } }) => void }) {
  return <select className="select select-sm text-xs" value={value} onChange={onChange}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
}

export const Badge = ({ children, color = 'neutral' }: { children: ReactNode; color?: Color }) =>
  <span className={`badge badge-sm badge-${color}`}>{children}</span>

export const Field = ({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) =>
  <fieldset className="fieldset"><label className="label">{label}{required && <AlertCircle size={12} className="inline ml-1 opacity-40" />}</label>{children}</fieldset>

export const Stats = ({ children, vertical }: { children: ReactNode; vertical?: boolean }) =>
  <div className={`stats ${vertical ? 'stats-vertical' : 'stats-vertical md:stats-horizontal'} w-full`}>{children}</div>

export const Stat = ({ title, value, desc, color }: { title: string; value: string; desc?: string; color?: SemanticColor }) =>
  <div className="stat"><div className="stat-title">{title}</div><div className={`stat-value tabular-nums ${semColor(color ?? 'base')}`}>{value}</div>{desc && <div className="stat-desc">{desc}</div>}</div>

export const Card = ({ title, children, color }: { title?: string; children: ReactNode; color?: Color }) =>
  <div className={`card ${color && color !== 'neutral' && color !== 'ghost' ? `bg-${color}/10` : 'bg-base-200'}`}><div className="card-body p-4 gap-2">{title && <h3 className="text-xs font-semibold text-base-content/60">{title}</h3>}{children}</div></div>

export function Tabs({ tabs, active, onChange, variant = 'border' }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void; variant?: 'border' | 'lift' | 'box' }) {
  return <div role="tablist" className={`tabs tabs-${variant}`}>{tabs.map(t => <button key={t.id} role="tab" className={`tab ${t.id === active ? 'tab-active' : ''}`} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>
}

export const Heading = ({ title, subtitle }: { title: string; subtitle?: string }) =>
  <div><h2 className="text-lg font-bold">{title}</h2>{subtitle && <p className="text-xs text-base-content/50 mt-1">{subtitle}</p>}</div>

export function ProgressBar({ label, value, total, color = 'primary' }: { label?: string; value: number; total: number; color?: 'primary' | 'error' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return <div className="space-y-1">{label && <div className="flex justify-between text-xs text-base-content/60"><span>{label}</span><span>{pct}%</span></div>}<progress className={`progress progress-${color} w-full`} value={value} max={total} /></div>
}

export const Spinner = () => <span className="loading loading-spinner loading-xs" />
export const Stack = ({ children }: { children: ReactNode }) => <div className="space-y-2">{children}</div>
export const Page = ({ children }: { children: ReactNode }) => <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
export const Row = ({ children, justify = 'start' }: { children: ReactNode; justify?: 'start' | 'between' | 'end' | 'center' }) => <div className={`flex items-center gap-2 justify-${justify}`}>{children}</div>
export const Text = ({ children, muted, size = 'xs' }: { children: ReactNode; muted?: boolean; size?: 'xs' | '2xs' }) => <p className={`text-${size} ${muted ? 'text-base-content/30' : ''}`}>{children}</p>
export const RemoveButton = ({ onClick }: { onClick: () => void }) => <button className="text-error text-xs opacity-0 group-hover:opacity-50 transition-opacity" onClick={onClick} aria-label="Usuń">×</button>

export function ListItem({ label, detail, active, onClick, action }: { label: ReactNode; detail?: ReactNode; active?: boolean; onClick?: () => void; action?: ReactNode }) {
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      className={`flex items-center px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${active ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content/60'}`}>
      <div className="flex-1 min-w-0"><div className="truncate">{label}</div>{detail && <div className="text-xs text-base-content/30 mt-0.5">{detail}</div>}</div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  )
}

export const Value = ({ children, color = 'base', size = 'xs', bold, align }: { children: ReactNode; color?: SemanticColor | 'base'; size?: 'xs' | 'sm' | 'md'; bold?: boolean; align?: 'left' | 'center' | 'right' }) =>
  <span className={`tabular-nums ${size === 'md' ? 'text-base' : `text-${size}`} ${semColor(color)} ${bold ? 'font-bold' : ''} ${align ? `text-${align}` : ''}`}>{children}</span>

export interface TableColumn { key: string; header: string; align?: 'left' | 'right' | 'center' }
export function Table({ columns, rows, pageSize, empty }: { columns: TableColumn[]; rows: Record<string, ReactNode>[]; pageSize?: number; empty?: string }) {
  const [showAll, setShowAll] = useState(!pageSize)
  if (!rows.length) return empty ? <Placeholder text={empty} /> : null
  const visible = showAll ? rows : rows.slice(0, pageSize!)
  const al = (a?: string) => a ? `text-${a}` : 'text-left'
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="table table-sm table-zebra w-full">
          <thead><tr>{columns.map(c => <th key={c.key} className={al(c.align)}>{c.header}</th>)}</tr></thead>
          <tbody>{visible.map((row, i) => <tr key={i}>{columns.map(c => <td key={c.key} className={al(c.align)}>{row[c.key] ?? ''}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {pageSize && rows.length > pageSize && <button className="btn btn-ghost btn-xs w-full" onClick={() => setShowAll(v => !v)}>{showAll ? `Pokaż ${pageSize}` : `Pokaż wszystkie (${rows.length})`}</button>}
    </div>
  )
}

// ── Log & Error ──────────────────────────────────────────────────────

export function LogBox() {
  const logs = useHostStore(s => s.logs)
  const ref = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const onScroll = () => { const el = ref.current; if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30 }
  useEffect(() => { if (pinned.current) ref.current?.scrollTo(0, ref.current.scrollHeight) }, [logs])
  if (!logs.length) return null
  return (
    <Box grow header={<><Cell label>log</Cell><Cell onClick={clearLog}><span className="text-xs">×</span></Cell></>}
      body={<div ref={ref} onScroll={onScroll} className="-m-2 p-2 space-y-0.5">{logs.map((l, i) => <div key={i} className={`text-2xs font-mono ${logColor[l.level]}`}>{l.text}</div>)}</div>} />
  )
}

export const FatalError = ({ error }: { error: unknown }) =>
  <Layout center={<CenterColumn><Content><Placeholder text={error instanceof Error ? error.message : String(error)} /></Content></CenterColumn>} />

export class PluginErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return (
      <div className="hero flex-1"><div className="hero-content text-center"><div>
        <p className="text-base-content/30 text-xs">Plugin crash: {this.state.error.message}</p>
        <button className="btn btn-ghost btn-xs mt-2" onClick={() => this.setState({ error: null })}>Spróbuj ponownie</button>
      </div></div></div>
    )
    return this.props.children
  }
}
