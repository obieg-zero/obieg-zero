import { Component, type ComponentType, type ReactNode, type MouseEventHandler } from 'react'
import { Menu, ChevronLeft } from 'react-feather'

// --- Primitives ---

const bar = 'h-10 min-h-10 shrink-0 flex items-center border-base-300 divide-x divide-base-300'

export function Box({ header, body, footer }: {
  header: ReactNode; body?: ReactNode; footer?: ReactNode
}) {
  return <div className="flex flex-col min-h-0">
    <div className={`${bar} border-b`}>{header}</div>
    {body && <div className="flex-1 min-h-0 overflow-y-auto">{body}</div>}
    {footer && <div className={`${bar} border-t`}>{footer}</div>}
  </div>
}

export function Cell({ children, onClick, label, className = '' }: {
  children?: ReactNode; onClick?: MouseEventHandler; label?: boolean; className?: string
}) {
  const base = `self-stretch flex items-center ${label ? 'flex-1 px-3 text-2xs uppercase tracking-wider text-base-content/25 font-medium' : 'px-1'} ${className}`
  return <div className={base}>{onClick ? <button className="btn btn-ghost btn-sm btn-square" onClick={onClick}>{children}</button> : children}</div>
}

export class PluginErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; retries: number }> {
  state: { error: Error | null; retries: number } = { error: null, retries: 0 }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-xs font-semibold text-base-content/70 mb-1">Plugin crash</p>
          <p className="text-2xs text-base-content/40 mb-3">{this.state.error.message}</p>
          {this.state.retries < 3
            ? <button className="text-2xs text-primary hover:underline" onClick={() => this.setState(s => ({ error: null, retries: s.retries + 1 }))}>Spróbuj ponownie ({3 - this.state.retries})</button>
            : <p className="text-2xs text-base-content/30">Przeładuj stronę.</p>}
        </div>
      </div>
    )
    return this.props.children
  }
}

export function ListItem({ label, detail, active, onClick, action, aside, separator }: {
  label: ReactNode; detail?: ReactNode; active?: boolean; onClick?: () => void
  action?: { icon: ComponentType<{ size?: number }>; onClick: () => void }
  aside?: ReactNode; separator?: boolean
}) {
  return (
    <div onClick={onClick} className={`group flex items-center mx-2 px-2 ${detail ? 'py-2' : 'h-8'} rounded-md text-xs cursor-pointer transition-colors ${active ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content/70'} ${separator ? 'border-b border-base-300/50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="truncate">{label}</div>
        {detail && <div className="text-2xs text-base-content/30 truncate mt-0.5">{detail}</div>}
      </div>
      {aside && <div className="shrink-0 ml-1" onClick={e => e.stopPropagation()}>{aside}</div>}
      {action && <button className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 btn btn-ghost btn-xs btn-square ml-1"
        onClick={e => { e.stopPropagation(); action.onClick() }}><action.icon size={12} /></button>}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-3 py-1.5">
      <div className="text-2xs text-base-content/30 mb-1">{label}</div>
      {children}
    </div>
  )
}

export function Bar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${bar} border-b ${className}`}>{children}</div>
}

export function Tabs({ items, active, onSelect }: {
  items: { id: string; label: ReactNode }[]; active: string; onSelect: (id: string) => void
}) {
  return (
    <div role="tablist" className="tabs tabs-boxed tabs-xs mx-2 my-2">
      {items.map(t => <button key={t.id} role="tab" className={`tab ${active === t.id ? 'tab-active' : ''}`} onClick={() => onSelect(t.id)}>{t.label}</button>)}
    </div>
  )
}

// --- Column ---

function Column({ children, footer, className = '' }: { children?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col h-full min-h-0 bg-base-100 ${className}`}>
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0 border-t border-base-300">{footer}</div>}
    </div>
  )
}

// --- Layout ---

export type ThemeProps = {
  left?: ComponentType; leftFooter?: ComponentType
  center?: ComponentType; footer?: ComponentType
  right?: ComponentType
  wrapper?: ComponentType<{ children: ReactNode }>
  label: string; progress: boolean
  leftOpen: boolean; toggleLeft: () => void
  navItems: { id: string; icon?: ComponentType<{ size?: number }>; active: boolean; onActivate: () => void }[]
  actionSlots: ReactNode[]
}

export function SidebarLayout({ left: Left, leftFooter: LeftFooter, center: Center, footer: Footer, right: Right, wrapper: Wrapper, label, progress, leftOpen, toggleLeft, navItems, actionSlots }: ThemeProps) {
  const hasLeft = !!Left
  const shell = (
    <div className="h-screen overflow-hidden bg-base-200 text-sm text-base-content flex flex-col">
      {progress && <progress className="progress progress-primary w-full h-0.5 shrink-0" />}
      <div className={`flex flex-1 min-h-0 transition-transform duration-300 ease-in-out ${hasLeft && !leftOpen ? 'max-md:-translate-x-72' : ''}`}>
        {hasLeft && (
          <Column className="w-72 shrink-0 border-r border-base-300" footer={LeftFooter && <LeftFooter />}>
            <PluginErrorBoundary><Left /></PluginErrorBoundary>
          </Column>
        )}
        <Column className="flex-1 max-md:min-w-[100vw]" footer={Footer && <PluginErrorBoundary><Footer /></PluginErrorBoundary>}>
          <div className={`${bar} border-b`}>
            {hasLeft && <div className="md:hidden self-stretch flex items-center px-1">
              <button className="btn btn-ghost btn-sm btn-square" onClick={toggleLeft}>{leftOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}</button>
            </div>}
            <div className="self-stretch flex items-center flex-1 px-3 text-2xs uppercase tracking-wider text-base-content/25 font-medium">{label}</div>
            {actionSlots.map((slot, i) => <div key={i} className="self-stretch flex items-center">{slot}</div>)}
            {navItems.map(n => {
              const I = n.icon; if (!I) return null
              return <div key={n.id} className={`self-stretch flex items-center ${n.active ? 'text-primary' : ''}`}>
                <button className="btn btn-ghost btn-sm btn-square mx-1" onClick={n.onActivate}><I size={16} /></button>
              </div>
            })}
          </div>
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-h-0 flex flex-col">
              {Center ? <PluginErrorBoundary><Center /></PluginErrorBoundary> : <div className="hero flex-1"><div className="hero-content text-center"><p className="text-xs text-base-content/30">Wybierz plugin.</p></div></div>}
            </div>
            {Right && <div className="w-72 shrink-0 border-l border-base-300 flex-col h-full min-h-0 bg-base-100 empty:hidden has-[>*]:flex">
              <PluginErrorBoundary><Right /></PluginErrorBoundary>
            </div>}
          </div>
        </Column>
      </div>
    </div>
  )
  return Wrapper ? <Wrapper>{shell}</Wrapper> : shell
}
