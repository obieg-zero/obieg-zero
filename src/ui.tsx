import { Component, useState, useEffect, useRef, type ComponentType, type ReactNode, type MouseEventHandler } from 'react'
import { AlertCircle } from 'react-feather'
import { clearLog } from './plugin'
import { useHostStore } from './plugin'

type Color = 'primary' | 'secondary' | 'accent' | 'error' | 'warning' | 'info' | 'success' | 'neutral' | 'ghost'
type SemanticColor = 'primary' | 'accent' | 'error' | 'warning' | 'info' | 'success' | 'muted'

const logColor: Record<string, string> = { info: 'text-base-content/30', ok: 'text-success', error: 'text-error' }

const semColorMap: Record<SemanticColor | 'base', string> = {
  base: '', muted: 'text-base-content/30', primary: 'text-primary', accent: 'text-accent',
  error: 'text-error', warning: 'text-warning', info: 'text-info', success: 'text-success',
}

const btnSizeMap: Record<string, string> = { xs: 'btn-xs', sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' }
const btnColorMap: Record<Color, string> = {
  primary: 'btn-primary', secondary: 'btn-secondary', accent: 'btn-accent', error: 'btn-error',
  warning: 'btn-warning', info: 'btn-info', success: 'btn-success', neutral: 'btn-neutral', ghost: 'btn-ghost',
}
const badgeColorMap: Record<Color, string> = {
  primary: 'badge-primary', secondary: 'badge-secondary', accent: 'badge-accent', error: 'badge-error',
  warning: 'badge-warning', info: 'badge-info', success: 'badge-success', neutral: 'badge-neutral', ghost: 'badge-ghost',
}
const cardBgMap: Record<Color, string> = {
  primary: 'bg-primary/10', secondary: 'bg-secondary/10', accent: 'bg-accent/10', error: 'bg-error/10',
  warning: 'bg-warning/10', info: 'bg-info/10', success: 'bg-success/10', neutral: 'bg-base-200', ghost: 'bg-base-200',
}
const progressColorMap: Record<string, string> = { primary: 'progress-primary', error: 'progress-error' }
const justifyMap: Record<string, string> = { start: 'justify-start', between: 'justify-between', end: 'justify-end', center: 'justify-center' }
const textSizeMap: Record<string, string> = { xs: 'text-xs', '2xs': 'text-2xs', sm: 'text-sm', md: 'text-base' }
const textAlignMap: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }
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
export const Placeholder = ({ text, children }: { text: string; children?: ReactNode }) => <div className="hero flex-1"><div className="hero-content text-center"><div>{children && <div className="mb-3 flex justify-center text-base-content/15">{children}</div>}<p className="text-base-content/30 text-xs">{text}</p></div></div></div>
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

export const LeftColumn = Col('w-80 shrink-0 border-r border-dashed border-base-300')
export const CenterColumn = Col('flex-1 min-w-0 max-md:min-w-screen overflow-hidden', 'overflow-x-hidden')
export const RightColumn = Col('w-80 shrink-0 border-l border-dashed border-base-300')

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
  children: ReactNode; color?: Color; size?: 'xs' | 'sm' | 'md' | 'lg'; outline?: boolean; block?: boolean; disabled?: boolean; onClick?: () => void
}) { return <button className={`btn ${btnSizeMap[size]} ${btnColorMap[color]} ${outline ? 'btn-outline' : ''} ${block ? 'btn-block' : ''}`} disabled={disabled} onClick={onClick}>{children}</button> }

export function Input({ value, type, placeholder, onChange, onKeyDown }: {
  value?: string; type?: string; placeholder?: string; onChange?: (e: { target: { value: string } }) => void; onKeyDown?: (e: { key: string }) => void
}) { return <input type={type} className="input input-sm w-full text-xs" value={value} placeholder={placeholder} onChange={onChange} onKeyDown={onKeyDown} /> }

export function Select({ value, options, onChange }: { value?: string; options: { value: string; label: string }[]; onChange?: (e: { target: { value: string } }) => void }) {
  return <select className="select select-sm text-xs" value={value} onChange={onChange}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
}

export const Badge = ({ children, color = 'neutral' }: { children: ReactNode; color?: Color }) =>
  <span className={`badge badge-sm ${badgeColorMap[color]}`}>{children}</span>

export const Field = ({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) =>
  <fieldset className="fieldset"><label className="label">{label}{required && <AlertCircle size={12} className="inline ml-1 opacity-40" />}</label>{children}</fieldset>

export const Stats = ({ children, vertical }: { children: ReactNode; vertical?: boolean }) =>
  <div className={`stats ${vertical ? 'stats-vertical' : 'stats-vertical md:stats-horizontal'} w-full`}>{children}</div>

export const Stat = ({ title, value, desc, color }: { title: string; value: string; desc?: string; color?: SemanticColor }) =>
  <div className="stat"><div className="stat-title">{title}</div><div className={`stat-value tabular-nums ${semColorMap[color ?? 'base']}`}>{value}</div>{desc && <div className="stat-desc">{desc}</div>}</div>

export const Card = ({ title, children, color }: { title?: string; children: ReactNode; color?: Color }) =>
  <div className={`card ${cardBgMap[color ?? 'neutral']}`}><div className="card-body p-4 gap-2">{title && <h3 className="text-xs font-semibold text-base-content/60">{title}</h3>}{children}</div></div>

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return <div className="flex">{tabs.map(t => <button key={t.id} className={`px-3 py-2 text-xs uppercase tracking-wider font-medium border-b-2 transition-colors ${t.id === active ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/60'}`} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>
}

export const Heading = ({ title, subtitle }: { title: string; subtitle?: string }) =>
  <div className="py-2"><h2 className="text-2xl font-bold tracking-tight">{title}</h2>{subtitle && <p className="text-sm text-base-content/40 mt-2">{subtitle}</p>}</div>

export const StepHeading = ({ step, title, subtitle, subtitleBelow }: { step?: string; title: string; subtitle?: string; subtitleBelow?: boolean }) =>
  <div>
    {subtitle && !subtitleBelow && <p className="text-xs uppercase tracking-wider font-medium text-base-content/40 mb-[18px]">{subtitle}</p>}
    <h1 className="text-5xl font-black tracking-tight leading-none">{title}</h1>
    {subtitle && subtitleBelow && <><div className="border-t border-base-content/5 mt-[30px] mb-[18px]" /><p className="text-xs uppercase tracking-wider font-medium text-base-content/40">{subtitle}</p></>}
  </div>

export const CheckItem = ({ label, checked }: { label: string; checked?: boolean }) =>
  <div className="flex items-center gap-4 py-3">
    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${checked ? 'border-success bg-success' : 'border-base-content/15'}`}>
      {checked && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,5 4,7 8,3" /></svg>}
    </div>
    <span className={`text-xs tracking-wide ${checked ? 'text-base-content/70' : 'text-base-content/40'}`}>{label}</span>
  </div>

export const Divider = () => <div className="border-t border-base-content/5 my-2" />

export function ProgressBar({ label, value, total, color = 'primary' }: { label?: string; value: number; total: number; color?: 'primary' | 'error' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return <div className="space-y-1">{label && <div className="flex justify-between text-xs text-base-content/60"><span>{label}</span><span>{pct}%</span></div>}<progress className={`progress ${progressColorMap[color]} w-full`} value={value} max={total} /></div>
}

export const Spinner = () => <span className="loading loading-spinner loading-xs" />
export const Stack = ({ children, gap = 'sm' }: { children: ReactNode; gap?: 'sm' | 'md' | 'lg' }) => <div className={gap === 'lg' ? 'space-y-8' : gap === 'md' ? 'space-y-4' : 'space-y-2'}>{children}</div>
export const Page = ({ children }: { children: ReactNode }) => <div className="flex-1 overflow-y-auto md:p-4 p-2 space-y-4">{children}</div>
export const Stage = ({ children }: { children: ReactNode }) => <div className="max-w-2xl mx-auto w-full h-full rounded-xl bg-base-100 border border-base-200 p-[30px] overflow-y-auto shadow-xl">{children}</div>
export const StageLayout = ({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) =>
  <div className="flex flex-col justify-end min-h-full gap-[78px]"><div>{top}</div>{bottom && <div className="shrink-0">{bottom}</div>}</div>
export const Disclosure = ({ title, children, hint, open }: { title: string; children: ReactNode; hint?: string; open?: boolean }) =>
  <details className="collapse collapse-arrow bg-base-200 rounded-lg" open={open}><summary className="collapse-title text-xs font-semibold min-h-0 py-3 px-5">{title}</summary><div className="collapse-content px-5 pb-4 space-y-3">{children}{hint && <p className="text-2xs text-base-content/30">{hint}</p>}</div></details>
export const Dropzone = ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
  <div role="button" tabIndex={0} onClick={disabled ? undefined : onClick} onKeyDown={e => e.key === 'Enter' && !disabled && onClick?.()} className={`border-2 border-dashed border-primary/40 rounded-2xl p-8 text-center cursor-pointer transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-primary/60'}`}>{children}</div>

export const FileAction = ({ icon: Icon, title, subtitle, disabled, onClick }: { icon: ComponentType<{ size?: number }>; title: string; subtitle?: string; disabled?: boolean; onClick?: () => void }) =>
  <div role="button" tabIndex={0} onClick={disabled ? undefined : onClick} onKeyDown={e => e.key === 'Enter' && !disabled && onClick?.()}
    className={`flex items-center gap-5 py-5 px-6 rounded-xl border border-base-content/8 transition-all ${disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:border-base-content/20'}`}>
    <Icon size={18} />
    <div><p className="text-xs font-medium tracking-wide">{title}</p>{subtitle && <p className="text-xs text-base-content/25 mt-1">{subtitle}</p>}</div>
  </div>
export const Row = ({ children, justify = 'start' }: { children: ReactNode; justify?: 'start' | 'between' | 'end' | 'center' }) => <div className={`flex items-center gap-2 ${justifyMap[justify]}`}>{children}</div>
export const Text = ({ children, muted, size = 'xs' }: { children: ReactNode; muted?: boolean; size?: 'xs' | '2xs' }) => <p className={`${textSizeMap[size]} ${muted ? 'text-base-content/30' : ''}`}>{children}</p>
export const RemoveButton = ({ onClick }: { onClick: () => void }) => <button className="text-error text-xs opacity-0 group-hover:opacity-50 transition-opacity" onClick={onClick} aria-label="Usuń">×</button>

export function ListItem({ label, detail, active, onClick, action }: { label: ReactNode; detail?: ReactNode; active?: boolean; onClick?: () => void; action?: ReactNode }) {
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      className={`group flex items-center px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${active ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content/60'}`}>
      <div className="flex-1 min-w-0"><div className="truncate">{label}</div>{detail && <div className="text-xs text-base-content/30 mt-0.5">{detail}</div>}</div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  )
}

export const Value = ({ children, color = 'base', size = 'xs', bold, align }: { children: ReactNode; color?: SemanticColor | 'base'; size?: 'xs' | 'sm' | 'md'; bold?: boolean; align?: 'left' | 'center' | 'right' }) =>
  <span className={`tabular-nums ${textSizeMap[size]} ${semColorMap[color]} ${bold ? 'font-bold' : ''} ${align ? textAlignMap[align] : ''}`}>{children}</span>

export interface TableColumn { key: string; header: string; align?: 'left' | 'right' | 'center' }
export function Table({ columns, rows, pageSize, empty, activeRow, onRowClick }: {
  columns: TableColumn[]; rows: Record<string, ReactNode>[]; pageSize?: number; empty?: string
  activeRow?: number; onRowClick?: (index: number) => void
}) {
  const [showAll, setShowAll] = useState(!pageSize)
  if (!rows.length) return empty ? <Placeholder text={empty} /> : null
  const visible = showAll ? rows : rows.slice(0, pageSize!)
  const al = (a?: string) => a ? textAlignMap[a] || 'text-left' : 'text-left'
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead><tr>{columns.map(c => <th key={c.key} className={al(c.align)}>{c.header}</th>)}</tr></thead>
          <tbody>{visible.map((row, i) => <tr key={i}
            className={`${onRowClick ? 'cursor-pointer hover:bg-base-200' : ''} ${i === activeRow ? 'bg-primary/10' : ''}`}
            onClick={onRowClick ? () => onRowClick(i) : undefined}
          >{columns.map(c => <td key={c.key} className={al(c.align)}>{row[c.key] ?? ''}</td>)}</tr>)}</tbody>
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
