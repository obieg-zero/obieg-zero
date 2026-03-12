import { Component, type ReactNode, type MouseEventHandler } from 'react'

const bar = 'h-10 min-h-10 shrink-0 flex items-center border-base-300 divide-x divide-base-300'

export function Box({ header, body, footer, className = '' }: {
  header: ReactNode; body?: ReactNode; footer?: ReactNode; className?: string
}) {
  return (
    <div className={`flex flex-col h-full min-h-0 bg-base-100 ${className}`}>
      <div className={`${bar} border-b`}>{header}</div>
      <div className="flex-1 min-h-0 p-3">{body}</div>
      {footer && <div className={`${bar} border-t`}>{footer}</div>}
    </div>
  )
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
