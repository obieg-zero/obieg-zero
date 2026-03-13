import { ocrFile } from '@obieg-zero/ocr-v2'
import { createEmbedder } from '@obieg-zero/embed-v2'
import type { Chunk } from '@obieg-zero/embed-v2'
import { createLlm } from '@obieg-zero/llm-v2'
import type { HostAPI } from '@obieg-zero/plugin-sdk'

export type Log = (msg: string) => void
export type { Chunk }

function normalizeId(text: string): string {
  return text.toLowerCase().replace(/[^a-ząćęłńóśźż0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export async function blockUpload(host: HostAPI, project: string, files: File[], log: Log) {
  const { opfs, db } = host
  await opfs.createProject(project).catch(() => {})
  await db.addProject({ id: project, name: project, createdAt: Date.now() }).catch(() => {})
  for (const file of files) {
    const docId = `${project}:${file.name}`
    await db.clearDocument?.(docId).catch(() => {})
    await opfs.writeFile(project, file.name, file)
    await db.addDocument({ id: docId, projectId: project, filename: file.name, addedAt: Date.now() })
    log(`Zapisano ${file.name} → OPFS/${project}/`)
  }
  log(`Upload: ${files.length} plikow → OPFS/${project}/`)
}

export async function blockParse(host: HostAPI, project: string, language: string, log: Log) {
  const { opfs, db } = host
  const docs = await db.listDocuments(project)
  if (docs.length > 0) {
    const cached: { page: number; text: string }[] = []
    for (const doc of docs) { (await db.getPages(doc.id)).forEach((p: any) => cached.push({ page: p.page, text: p.text })) }
    if (cached.length > 0) { log(`Parse: ${cached.length} stron z Dexie (cache)`); return cached }
  }
  const files = await opfs.listFiles(project)
  if (files.length === 0) { log('Brak plikow w projekcie'); return [] }

  const allPages: { page: number; text: string }[] = []
  let pageNum = 1
  for (const filename of files) {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const docId = `${project}:${filename}`
    log(`Parse: ${filename} (${ext})`)
    const pages: { page: number; text: string }[] = []
    if (ext === 'pdf') {
      const file = await opfs.readFile(project, filename)
      const result = await ocrFile(file, { language, onProgress: m => log(`  ${m}`) })
      for (const p of result) pages.push({ page: pageNum++, text: `[${filename}] ${p.text}` })
    } else if (ext === 'csv' || ext === 'tsv') {
      const file = await opfs.readFile(project, filename)
      const text = await file.text(), lines = text.split('\n'), header = lines[0] || ''
      for (let i = 1; i < lines.length; i += 20) pages.push({ page: pageNum++, text: `[${filename}] ${[header, ...lines.slice(i, i + 20)].join('\n')}` })
    } else {
      const file = await opfs.readFile(project, filename)
      pages.push({ page: pageNum++, text: `[${filename}] ${await file.text()}` })
    }
    await db.setPages(pages.map(p => ({ id: `${docId}:p${p.page}`, projectId: project, documentId: docId, page: p.page, text: p.text })))
    allPages.push(...pages)
  }
  log(`Parse: ${allPages.length} stron, ${allPages.reduce((s, p) => s + p.text.length, 0)} zn.`)
  return allPages
}

export async function blockEmbed(host: HostAPI, project: string, pages: { page: number; text: string }[], model: string, chunkSize: number, log: Log) {
  if (!pages.length) { log('Brak stron — dodaj Parse przed Embed'); return null }
  if (!host.embedder) host.embedder = await createEmbedder({ model, dtype: 'q8', onProgress: m => log(`  ${m}`) })

  const cached = await host.db.getChunksByProject(project)
  if (cached.length > 0) {
    log(`Embed: ${cached.length} chunków z Dexie (cache)`)
    return { chunks: cached.map((c: any) => ({ text: c.text, page: c.page, embedding: c.embedding })) as Chunk[], embedFn: (q: string) => host.embedder!.embed(q) }
  }
  const index = await host.embedder!.createIndex(pages, { chunkSize, onProgress: (m: string) => log(`  ${m}`) })
  log(`Embed: ${index.chunks.length} chunks po ~${chunkSize} zn.`)

  const pageDoc = new Map<number, string>()
  for (const p of pages) { const m = p.text.match(/^\[([^\]]+)\]/); if (m) pageDoc.set(p.page, `${project}:${m[1]}`) }
  await host.db.setChunks(index.chunks.map((c: any, i: number) => ({
    id: `${project}:chunk:${i}`, projectId: project, documentId: pageDoc.get(c.page) || project,
    page: c.page, text: c.text, embedding: Array.from(c.embedding),
  })))
  log(`Embed: zapisano ${index.chunks.length} chunków do Dexie`)
  return { chunks: index.chunks, embedFn: index.embed }
}

async function initLlm(host: HostAPI, modelUrl: string, log: Log) {
  if (!host.llm) {
    host.llm = await createLlm({
      modelUrl,
      wasmPaths: {
        'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
        'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
      },
      nCtx: 512, chatTemplate: true, onProgress: m => log(`  ${m}`),
    })
  }
  return host.llm!
}

type AskFn = (prompt: string) => Promise<{ text: string; tokenCount?: number; durationMs?: number }>

async function extractLoop(host: HostAPI, chunks: Chunk[], embedFn: any, questions: string[], topK: number, askFn: AskFn, project: string, log: Log) {
  const graph = await host.createGraphDB(`graph-${project}`)
  await graph.clear()
  const totalCalls = questions.length * topK
  const pageFile = new Map<number, string>()
  for (const c of chunks) { const m = c.text.match(/^\[([^\]]+)\]/); if (m) pageFile.set(c.page, m[1]) }

  let callsDone = 0, extracted = 0
  const t0 = Date.now()
  log(`Extract: ${questions.length} pytan × ${topK} chunkow = max ${totalCalls} wywolan`)

  for (const question of questions) {
    const results = await host.search(chunks, question, embedFn, { topK, minWordLength: 2 })
    log(`--- ${question} ---`)
    for (const hit of results) {
      const prompt = `Dokoncz zdanie na podstawie tekstu.\n\nTekst: "${hit.text.slice(0, 300)}"\n\n${question}`
      callsDone++
      const eta = callsDone > 1 ? ` | ETA: ${Math.round((Date.now() - t0) / (callsDone - 1) * (totalCalls - callsDone) / 1000)}s` : ''
      log(`  [${callsDone}/${totalCalls}${eta}] str.${hit.page} (${hit.score.toFixed(3)})`)
      try {
        const result = await askFn(prompt)
        const answer = result.text.trim()
        log(`    → ${answer}${result.durationMs ? ` ${(result.durationMs / 1000).toFixed(1)}s` : ''}`)
        const filename = pageFile.get(hit.page) || 'unknown'
        const docId = `doc:${filename}`, qType = question.replace(/[?!]/g, '').trim().toLowerCase(), valueId = `val:${normalizeId(answer)}`
        await graph.addNodes([{ id: docId, type: 'document', label: filename, data: {} }, { id: valueId, type: qType, label: answer, data: {} }]).catch(() => {})
        await graph.addEdges([{ id: `e:${docId}:${valueId}:p${hit.page}`, from: docId, to: valueId, type: qType, label: qType, data: { page: hit.page, score: hit.score } }]).catch(() => {})
        extracted++
      } catch (e: any) { log(`    BLAD: ${e.message}`) }
    }
  }
  log(`=== ${extracted}/${totalCalls} odpowiedzi, ${((Date.now() - t0) / 1000).toFixed(0)}s ===`)
  return { extracted, failed: totalCalls - extracted, total: totalCalls }
}

export async function blockExtract(host: HostAPI, chunks: Chunk[], embedFn: any, questions: string[], modelUrl: string, topK: number, project: string, log: Log) {
  const llm = await initLlm(host, modelUrl, log)
  return extractLoop(host, chunks, embedFn, questions, topK, p => llm.ask(p, { nPredict: 16, temperature: 0 }), project, log)
}

export async function blockExtractApi(host: HostAPI, chunks: Chunk[], embedFn: any, questions: string[], apiUrl: string, apiKey: string, model: string, topK: number, project: string, log: Log) {
  if (!apiKey) { log('Brak API Key'); return null }
  log(`Extract API: ${model}`)
  return extractLoop(host, chunks, embedFn, questions, topK, async (prompt) => {
    const t = Date.now()
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 50, temperature: 0 }) })
    const json = await res.json()
    return { text: json.choices?.[0]?.message?.content || '', durationMs: Date.now() - t }
  }, project, log)
}

export async function blockGraph(host: HostAPI, project: string, log: Log) {
  const graph = await host.createGraphDB(`graph-${project}`)
  const data = await graph.getGraph()
  log(`Graf: ${data.nodes.length} encji, ${data.edges.length} relacji`)
  return data
}
