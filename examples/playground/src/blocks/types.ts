import type { EmbedHandle } from '@obieg-zero/embed-v2'
import type { LlmHandle } from '@obieg-zero/llm-v2'
import type { GraphDB } from '@obieg-zero/graph-v2'
import { createOpfs } from '@obieg-zero/store-v2'

export interface RunContext {
  data: Record<string, any>
  _embedder?: EmbedHandle
  _llm?: LlmHandle
  _graph?: GraphDB
}

export interface Block {
  id: string
  type: string
  config: Record<string, string>
}

export type Log = (msg: string) => void

export interface BlockDef {
  type: string
  label: string
  color: string
  fields: { key: string; label: string; default?: string }[]
  defaults: Record<string, string>
  run: (config: Record<string, string>, ctx: RunContext, log: Log) => Promise<void>
}

export const opfs = createOpfs()
