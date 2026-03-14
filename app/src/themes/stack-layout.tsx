import { type ComponentType, type ReactNode, type MouseEventHandler } from 'react'
import { PluginErrorBoundary, type ThemeProps } from './sidebar-layout'

// --- Primitives (stack-themed variants) ---

export function Box({ header, body, footer, className = '' }: {
  header?: ReactNode; body?: ReactNode; footer?: ReactNode; className?: string
}) {
  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body gap-4">
        {header && <div className="flex items-center justify-between">{header}</div>}
        <div className="flex-1 min-h-0">{body}</div>
        {footer && <div className="border-t border-base-300 pt-3 mt-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Cell({ children, onClick, label, className = '' }: {
  children?: ReactNode; onClick?: MouseEventHandler; label?: boolean; className?: string
}) {
  if (label) return <div className={`flex-1 text-lg font-bold ${className}`}>{children}</div>
  if (onClick) return <button className={`btn btn-ghost btn-sm btn-circle ${className}`} onClick={onClick}>{children}</button>
  return <div className={`flex items-center ${className}`}>{children}</div>
}

export function Bar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between px-5 py-3 border-b border-base-200 ${className}`}>{children}</div>
}

export function ListItem({ label, detail, active, onClick, action, aside, separator }: {
  label: ReactNode; detail?: ReactNode; active?: boolean; onClick?: () => void
  action?: { icon: ComponentType<{ size?: number }>; onClick: () => void }
  aside?: ReactNode; separator?: boolean
}) {
  return (
    <div onClick={onClick} className={`group flex items-center px-5 py-3 cursor-pointer transition-colors ${active ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-base-200 border-l-2 border-l-transparent'} ${separator ? 'border-b border-base-200' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        {detail && <div className="text-xs opacity-40 truncate mt-0.5">{detail}</div>}
      </div>
      {aside && <div className="shrink-0 ml-2" onClick={e => e.stopPropagation()}>{aside}</div>}
      {action && <button className="opacity-0 group-hover:opacity-40 hover:!opacity-100 btn btn-ghost btn-sm btn-circle ml-2"
        onClick={e => { e.stopPropagation(); action.onClick() }}><action.icon size={16} /></button>}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="fieldset px-5 py-2">
      <legend className="fieldset-legend">{label}</legend>
      {children}
    </fieldset>
  )
}

export function Tabs({ items, active, onSelect }: {
  items: { id: string; label: ReactNode }[]; active: string; onSelect: (id: string) => void
}) {
  return (
    <div role="tablist" className="tabs tabs-boxed tabs-sm px-5 py-3">
      {items.map(t => <button key={t.id} role="tab" className={`tab ${active === t.id ? 'tab-active' : ''}`} onClick={() => onSelect(t.id)}>{t.label}</button>)}
    </div>
  )
}

export { PluginErrorBoundary }

// --- Layout ---

export function StackLayout({ left: Left, leftFooter: LeftFooter, center: Center, right: Right, footer: Footer, wrapper: Wrapper, label, progress, navItems, actionSlots }: ThemeProps) {
  const shell = (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {progress && <progress className="progress progress-primary w-full h-1 shrink-0" />}
      <header className="bg-neutral text-neutral-content">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-bold tracking-tight">{label}</h1>
            <span className="hidden sm:inline label-caps">obieg-zero</span>
          </div>
          <div className="flex items-center gap-1">
            {actionSlots.map((slot, i) => <div key={i}>{slot}</div>)}
            <div className="divider divider-horizontal mx-0" />
            {navItems.map(n => {
              const I = n.icon; if (!I) return null
              return <button key={n.id} onClick={n.onActivate} title={n.id}
                className={`btn btn-ghost btn-sm btn-circle ${n.active ? '' : 'opacity-40'}`}><I size={20} /></button>
            })}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {Left && <div className="lg:col-span-4"><div className="card bg-base-100 shadow-xl sticky top-6 overflow-hidden">
            <PluginErrorBoundary><Left /></PluginErrorBoundary>
            {LeftFooter && <div className="border-t border-base-300 px-5 py-3"><LeftFooter /></div>}
          </div></div>}
          <div className={`${Left ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col gap-6 min-w-0`}>
            {Center ? <PluginErrorBoundary><Center /></PluginErrorBoundary> : <div className="card bg-base-100 shadow-xl p-12 text-center"><p className="label-caps">Wybierz plugin</p></div>}
            {Right && <PluginErrorBoundary><Right /></PluginErrorBoundary>}
          </div>
        </div>
      </main>
      {Footer && <footer className="bg-neutral text-neutral-content mt-auto"><div className="max-w-7xl mx-auto px-6 py-8"><PluginErrorBoundary><Footer /></PluginErrorBoundary></div></footer>}
    </div>
  )
  return Wrapper ? <Wrapper>{shell}</Wrapper> : shell
}
