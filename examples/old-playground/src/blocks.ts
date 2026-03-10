// Pipeline blocks — each reads from bus (OPFS/Dexie), writes to bus
// User composes them in any order in the playground

import { opfs, db } from './store.ts'
import { ocrFile } from '@obieg-zero/ocr-v2'
import { createEmbedder, search } from '@obieg-zero/embed-v2'
import type { EmbedHandle, EmbedIndex, Chunk } from '@obieg-zero/embed-v2'
import { createLlm } from '@obieg-zero/llm-v2'
import type { LlmHandle } from '@obieg-zero/llm-v2'

type Log = (msg: string) => void

// --- singletons (heavy resources, init once) ---

let embedder: EmbedHandle | null = null
let llm: LlmHandle | null = null

// --- BLOCK: OCR ---
// Reads file from OPFS, writes pages to Dexie

export async function blockOcr(projectId: string, documentId: string, filename: string, log: Log) {
  const db = db

  if (await db.hasPages(documentId)) {
    log(`OCR: ${filename} — already done, skipping`)
    return
  }

  log(`OCR: ${filename}`)
  const file = await opfs.readFile(projectId, filename)
  const pages = await ocrFile(file, { language: 'pol', onProgress: msg => log(`  ${msg}`) })

  const pageRecords = pages.map(p => ({
    id: `${documentId}:p${p.page}`,
    projectId,
    documentId,
    page: p.page,
    text: p.text,
  }))
  await db.setPages(pageRecords)
  await db.addDocument({
    id: documentId,
    projectId,
    filename,
    pageCount: pages.length,
    addedAt: Date.now(),
  })

  log(`OCR: ${pages.length} stron, ${pages.reduce((s, p) => s + p.text.length, 0)} zn.`)
}

// --- BLOCK: Embed ---
// Reads pages from Dexie, writes chunks+embeddings to Dexie

export interface EmbedConfig {
  model: string
  dtype: string
  chunkSize: number
}

export async function blockEmbed(projectId: string, documentId: string, config: EmbedConfig, log: Log) {
  const db = db

  if (await db.hasChunks(documentId)) {
    log(`Embed: ${documentId} — already done, skipping`)
    return
  }

  const pages = await db.getPages(documentId)
  if (pages.length === 0) {
    log(`Embed: no pages for ${documentId}, run OCR first`)
    return
  }

  if (!embedder) {
    log('Loading embedding model...')
    embedder = await createEmbedder({
      model: config.model,
      dtype: config.dtype,
      onProgress: msg => log(`  ${msg}`),
    })
  }

  log(`Embedding ${documentId}...`)
  const index = await embedder.createIndex(
    pages.map(p => ({ page: p.page, text: p.text })),
    { chunkSize: config.chunkSize, onProgress: msg => log(`  ${msg}`) },
  )

  const chunkRecords = index.chunks.map((c, i) => ({
    id: `${documentId}:c${i}`,
    projectId,
    documentId,
    page: c.page,
    text: c.text,
    embedding: c.embedding,
  }))
  await db.setChunks(chunkRecords)

  log(`Embed: ${chunkRecords.length} chunks`)
}

// --- BLOCK: Search ---
// Reads chunks from Dexie, returns results (does not write to bus, returns to UI)

export async function blockSearch(projectId: string, query: string, topK: number, log: Log) {
  const db = db
  const chunkRecords = await db.getChunksByProject(projectId)

  if (chunkRecords.length === 0) {
    log('Search: no chunks, run Embed first')
    return []
  }

  if (!embedder) {
    log('Search: embedder not loaded, run Embed first')
    return []
  }

  const chunks: Chunk[] = chunkRecords.map(c => ({
    text: c.text,
    page: c.page,
    embedding: c.embedding,
  }))

  log(`Search: "${query}" in ${chunks.length} chunks`)
  const results = await search(chunks, query, embedder.embed, { topK, minWordLength: 2 })
  log(`Search: ${results.length} hits`)
  return results
}

// --- BLOCK: LLM Ask ---
// Takes a prompt string, returns answer (stateless relative to bus)

export interface LlmConfig {
  modelUrl: string
  nCtx: number
  chatTemplate: boolean
  wasmPaths: Record<string, string>
}

export async function blockLlmAsk(prompt: string, config: LlmConfig, log: Log) {
  if (!llm) {
    log('Loading LLM...')
    llm = await createLlm({
      modelUrl: config.modelUrl,
      nCtx: config.nCtx,
      chatTemplate: config.chatTemplate,
      wasmPaths: config.wasmPaths,
      onProgress: msg => log(`  ${msg}`),
    })
    log('LLM ready')
  }

  const result = await llm.ask(prompt, {
    nPredict: 64,
    temperature: 0.1,
  })

  log(`LLM: ${result.tokenCount} tok, ${(result.durationMs / 1000).toFixed(1)}s`)
  return result
}

// --- BLOCK: RAG (search + ask) ---
// Combines search + LLM in one step

export async function blockRag(
  projectId: string, question: string,
  embedConfig: EmbedConfig, llmConfig: LlmConfig,
  log: Log,
) {
  const results = await blockSearch(projectId, question, 3, log)
  if (results.length === 0) return null

  const context = results.map(r => r.text).join('\n\n').slice(0, 500)
  const prompt = `Na podstawie tekstu odpowiedz na pytanie. Odpowiedz TYLKO wartością.\n\nTekst: "${context}"\n\nPytanie: ${question}\n\nOdpowiedź:`
  const answer = await blockLlmAsk(prompt, llmConfig, log)
  return { context, answer, hits: results }
}

