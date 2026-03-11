import { createOpfs, createStoreDB } from '@obieg-zero/store-v2'
import type { EmbedHandle } from '@obieg-zero/embed-v2'
import type { LlmHandle } from '@obieg-zero/llm-v2'

export const opfs = createOpfs()
export const db = createStoreDB()
export let embedder: EmbedHandle | null = null
export let llm: LlmHandle | null = null
export function setEmbedder(e: EmbedHandle) { embedder = e }
export function setLlm(l: LlmHandle) { llm = l }
