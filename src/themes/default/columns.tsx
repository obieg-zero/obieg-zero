import type { ReactNode } from 'react'
import { bar } from '@obieg-zero/sdk/src/ui'

// Re-export SDK components (without non-component exports like `bar`)
export {
  Box, Cell, Placeholder, Stack, Row, Page, Stage, StageLayout, Divider, Spinner,
  Button, Input, Select, Field,
  Badge, Text, Value, Heading, Card, Stats, Stat, Tabs, RemoveButton,
  StepHeading, CheckItem, FileAction, ListItem, Table,
} from '@obieg-zero/sdk/src/ui'

// ── Shell-only layout (not exposed to plugins) ──────────────────────

export const Bar = ({ children }: { children: ReactNode }) =>
  <div className={`${bar} border-b`}>{children}</div>

const Col = (base: string, inner = '') =>
  ({ children, footer }: { children: ReactNode; footer?: ReactNode }) =>
    <div className={`flex flex-col h-full min-h-0 bg-base-100 ${base}`}>
      <div className={`flex-1 min-h-0 flex flex-col overflow-y-auto ${inner}`}>{children}</div>
      {footer && <div className="shrink-0 border-t border-base-300">{footer}</div>}
    </div>

export const LeftColumn = Col('w-80 shrink-0 border-r border-dashed border-base-300')
export const CenterColumn = Col('flex-1 min-w-0 max-md:min-w-screen overflow-hidden', 'overflow-x-hidden')
export const RightColumn = Col('w-80 shrink-0 border-l border-dashed border-base-300')

export const Content = ({ children }: { children: ReactNode }) =>
  <div className="flex-1 min-h-0 flex flex-col bg-base-100">{children}</div>

export const ActionSlot = ({ children }: { children: ReactNode }) =>
  <div className="self-stretch flex items-center">{children}</div>

export function Layout({ left, center, right, progress, leftOpen }: {
  left?: ReactNode; center: ReactNode; right?: ReactNode; progress?: boolean; leftOpen?: boolean
}) {
  return (
    <div className="h-screen overflow-hidden bg-base-200 text-xs text-base-content flex flex-col">
      {progress && <progress className="progress progress-primary w-full h-1 shrink-0" />}
      <div className={`flex flex-1 min-h-0 transition-transform duration-300 ${left && !leftOpen ? 'max-md:-translate-x-80' : ''}`}>
        {left}{center}{right}
      </div>
    </div>
  )
}
