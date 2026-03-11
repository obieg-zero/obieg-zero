import { ocrFile } from '@obieg-zero/ocr-v2'
import { createEmbedder, search } from '@obieg-zero/embed-v2'
import type { Chunk } from '@obieg-zero/embed-v2'
import { createLlm } from '@obieg-zero/llm-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import { opfs, db, embedder, llm, setEmbedder, setLlm } from './store'

export type Log = (msg: string) => void
export type { Chunk }

// --- Upload → OPFS + Dexie ---

export async function blockUpload(project: string, files: File[], log: Log) {
  await opfs.createProject(project).catch(() => {})
  await db.addProject({ id: project, name: project, createdAt: Date.now() }).catch(() => {})

  await db.clearProject(project)
  for (const file of files) {
    await opfs.writeFile(project, file.name, file)
    await db.addDocument({ id: `${project}:${file.name}`, projectId: project, filename: file.name, addedAt: Date.now() })
    log(`Zapisano ${file.name} → OPFS/${project}/`)
  }
  log(`Upload: ${files.length} plikow → OPFS/${project}/`)
}

// --- Parse ← OPFS → Dexie pages ---

export async function blockParse(project: string, language: string, log: Log) {
  // Dexie cache
  const docs = await db.listDocuments(project)
  if (docs.length > 0) {
    const cached: { page: number; text: string }[] = []
    for (const doc of docs) { (await db.getPages(doc.id)).forEach(p => cached.push({ page: p.page, text: p.text })) }
    if (cached.length > 0) {
      log(`Parse: ${cached.length} stron z Dexie (cache)`)
      return cached
    }
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
      const text = await file.text()
      const lines = text.split('\n')
      const header = lines[0] || ''
      for (let i = 1; i < lines.length; i += 20) {
        const chunk = [header, ...lines.slice(i, i + 20)].join('\n')
        pages.push({ page: pageNum++, text: `[${filename}] ${chunk}` })
      }
    } else {
      const file = await opfs.readFile(project, filename)
      const text = await file.text()
      pages.push({ page: pageNum++, text: `[${filename}] ${text}` })
    }

    await db.setPages(pages.map(p => ({
      id: `${docId}:p${p.page}`, projectId: project, documentId: docId, page: p.page, text: p.text,
    })))
    allPages.push(...pages)
  }

  log(`Parse: ${allPages.length} stron, ${allPages.reduce((s, p) => s + p.text.length, 0)} zn.`)
  return allPages
}

// --- Embed ← pages → Dexie chunks ---

export async function blockEmbed(project: string, pages: { page: number; text: string }[], model: string, chunkSize: number, log: Log) {
  if (!pages.length) { log('Brak stron — dodaj Parse przed Embed'); return null }

  if (!embedder) {
    setEmbedder(await createEmbedder({ model, dtype: 'q8', onProgress: m => log(`  ${m}`) }))
  }

  // Dexie cache
  const cached = await db.getChunksByProject(project)
  if (cached.length > 0) {
    log(`Embed: ${cached.length} chunków z Dexie (cache)`)
    const chunks: Chunk[] = cached.map(c => ({ text: c.text, page: c.page, embedding: c.embedding }))
    return { chunks, embedFn: (q: string) => embedder!.embed(q) }
  }
  const index = await embedder!.createIndex(pages, { chunkSize, onProgress: m => log(`  ${m}`) })
  log(`Embed: ${index.chunks.length} chunks po ~${chunkSize} zn.`)

  const pageDoc = new Map<number, string>()
  for (const p of pages) {
    const m = p.text.match(/^\[([^\]]+)\]/)
    if (m) pageDoc.set(p.page, `${project}:${m[1]}`)
  }
  await db.setChunks(index.chunks.map((c, i) => ({
    id: `${project}:chunk:${i}`, projectId: project, documentId: pageDoc.get(c.page) || project,
    page: c.page, text: c.text, embedding: Array.from(c.embedding),
  })))
  log(`Embed: zapisano ${index.chunks.length} chunków do Dexie`)

  return { chunks: index.chunks, embedFn: index.embed }
}

// --- LLM Ask ---

export async function blockLlmAsk(prompt: string, modelUrl: string, log: Log) {
  if (!llm) {
    setLlm(await createLlm({
      modelUrl,
      wasmPaths: {
        'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
        'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
      },
      nCtx: 512,
      chatTemplate: true,
      onProgress: m => log(`  ${m}`),
    }))
  }
  if (!prompt) return { text: '', tokenCount: 0, durationMs: 0 }
  return llm!.ask(prompt, { nPredict: 16, temperature: 0 })
}

// --- Extract: shared loop (question → search → ask → graph) ---

type AskFn = (prompt: string) => Promise<{ text: string; tokenCount?: number; durationMs?: number }>

async function extractLoop(
  chunks: Chunk[], embedFn: any, questions: string[], topK: number,
  askFn: AskFn, project: string, log: Log,
) {
  const graph = await createGraphDB(`mini-${project}`)
  await graph.clear()

  const totalCalls = questions.length * topK
  const pageFile = new Map<number, string>()
  for (const c of chunks) {
    const m = c.text.match(/^\[([^\]]+)\]/)
    if (m) pageFile.set(c.page, m[1])
  }

  let callsDone = 0, extracted = 0
  const t0 = Date.now()
  log(`Extract: ${questions.length} pytan × ${topK} chunkow = max ${totalCalls} wywolan`)

  for (const question of questions) {
    const results = await search(chunks, question, embedFn, { topK, minWordLength: 2 })
    log(`--- ${question} ---`)
    log(`  search: ${results.map(r => `[${r.score.toFixed(3)}] str.${r.page}`).join(', ')}`)

    for (const hit of results) {
      const prompt = `Dokoncz zdanie na podstawie tekstu.\n\nTekst: "${hit.text.slice(0, 300)}"\n\n${question}`
      callsDone++
      const avgMs = callsDone > 1 ? (Date.now() - t0) / (callsDone - 1) : 0
      const eta = callsDone > 1 ? ` | ETA: ${Math.round(avgMs * (totalCalls - callsDone) / 1000)}s` : ''
      log(`  [${callsDone}/${totalCalls}${eta}] chunk str.${hit.page} (score ${hit.score.toFixed(3)})`)

      try {
        const result = await askFn(prompt)
        const answer = result.text.trim()
        const dur = result.durationMs ? ` ${(result.durationMs / 1000).toFixed(1)}s` : ''
        const tok = result.tokenCount ? `${result.tokenCount}tok` : ''
        log(`    → ${answer} (${tok}${dur})`)

        const filename = pageFile.get(hit.page) || 'unknown'
        const docId = `doc:${filename}`
        const qType = question.replace(/[?!]/g, '').trim().toLowerCase()
        const valueId = `val:${qType}:${answer}`

        await graph.addNodes([
          { id: docId, type: 'document', label: filename, data: {} },
          { id: valueId, type: qType, label: answer, data: { source: filename, page: hit.page, score: hit.score } },
        ]).catch(() => {})
        await graph.addEdges([{
          id: `e:${docId}:${valueId}`, from: docId, to: valueId, type: qType, label: qType,
        }]).catch(() => {})
        extracted++
      } catch (e: any) { log(`    BLAD: ${e.message}`) }
    }
  }

  log(`=== PODSUMOWANIE: ${extracted}/${totalCalls} odpowiedzi, ${((Date.now() - t0) / 1000).toFixed(0)}s ===`)
  return { extracted, failed: totalCalls - extracted, total: totalCalls }
}

// --- Extract (local LLM) ---

export async function blockExtract(
  chunks: Chunk[], embedFn: any, questions: string[], modelUrl: string,
  topK: number, project: string, log: Log,
) {
  if (!llm) await blockLlmAsk('', modelUrl, log)
  return extractLoop(chunks, embedFn, questions, topK,
    p => llm!.ask(p, { nPredict: 16, temperature: 0 }), project, log)
}

// --- Extract via API ---

export async function blockExtractApi(
  chunks: Chunk[], embedFn: any, questions: string[], apiUrl: string,
  apiKey: string, model: string, topK: number, project: string, log: Log,
) {
  if (!apiKey) { log('Brak API Key'); return null }
  log(`Extract API: ${model}`)

  const askViaApi = async (prompt: string) => {
    const t = Date.now()
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, messages: [{ role: 'user', content: prompt }],
        max_tokens: 50, temperature: 0,
      }),
    })
    const json = await res.json()
    return { text: json.choices?.[0]?.message?.content || '', durationMs: Date.now() - t }
  }

  return extractLoop(chunks, embedFn, questions, topK, askViaApi, project, log)
}

// --- Graph View ---

export async function blockGraph(project: string, log: Log) {
  const graph = await createGraphDB(`mini-${project}`)
  const data = await graph.getGraph()
  const byType = new Map<string, number>()
  data.nodes.forEach(n => byType.set(n.type, (byType.get(n.type) || 0) + 1))
  log(`Graf: ${data.nodes.length} encji, ${data.edges.length} relacji`)
  for (const [type, count] of byType) log(`  ${type}: ${count}`)
  return data
}
