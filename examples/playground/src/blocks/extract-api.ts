// ============================================================
// DEV TOOL: Extract via API — do szybkiego testowania pipeline
// bez czekania na WASM Bielik. Usun ten blok jak nie potrzebny.
// ============================================================

import { search } from '@obieg-zero/embed-v2'
import type { Chunk } from '@obieg-zero/embed-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import type { BlockDef } from './types'

export const extractApiBlock: BlockDef = {
  type: 'extract-api',
  label: 'Extract API',
  color: '#8b5cf6',
  fields: [
    { key: 'questions', label: 'Pytania (jedno na linie)' },
    { key: 'topK', label: 'Chunkow na pytanie', default: '2' },
    { key: 'apiUrl', label: 'API URL (OpenAI-compatible)', default: 'https://api.openai.com/v1/chat/completions' },
    { key: 'apiKey', label: 'API Key (pamiec sesji, nie persisted)' },
    { key: 'model', label: 'Model', default: 'gpt-4o-mini' },
  ],
  defaults: {
    questions: 'Nazwa banku to\nKwota kredytu wynosi\nMarza banku wynosi\nStawka WIBOR wynosi\nUmowe podpisano dnia\nOkres kredytu to\nMiesieczna rata wynosi\nKredytobiorca to',
    topK: '2',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  async run(config, ctx, log) {
    if (!ctx.data.chunks?.length || !ctx.data._embedFn) { log('Brak chunks/embeddings — dodaj Embed przed Extract'); return }
    if (!config.apiKey) { log('Brak API Key'); return }

    ctx._graph = await createGraphDB(`mini-${ctx.data.project || 'default'}`)
    await ctx._graph.clear()

    const questions = config.questions.split('\n').map(q => q.trim()).filter(q => q)
    const topK = parseInt(config.topK) || 2
    const totalCalls = questions.length * topK

    const pageFile = new Map<number, string>()
    for (const c of ctx.data.chunks as Chunk[]) {
      const m = c.text.match(/^\[([^\]]+)\]/)
      if (m) pageFile.set(c.page, m[1])
    }
    let callsDone = 0, extracted = 0
    const t0 = Date.now()

    log(`Extract API: ${questions.length} pytan × ${topK} chunkow = max ${totalCalls} wywolan (${config.model})`)

    for (const question of questions) {
      const results = await search(ctx.data.chunks, question, ctx.data._embedFn, { topK, minWordLength: 2 })
      log(`--- ${question} ---`)
      log(`  search: ${results.map(r => `[${r.score.toFixed(3)}] str.${r.page}`).join(', ')}`)

      for (const hit of results) {
        callsDone++
        const avgMs = callsDone > 1 ? (Date.now() - t0) / (callsDone - 1) : 0
        const eta = callsDone > 1 ? ` | ETA: ${Math.round(avgMs * (totalCalls - callsDone) / 1000)}s` : ''
        log(`  [${callsDone}/${totalCalls}${eta}] chunk str.${hit.page} (score ${hit.score.toFixed(3)})`)

        try {
          const res = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: 'user', content: `Dokoncz zdanie na podstawie tekstu. Odpowiedz TYLKO wartoscia, max 10 slow.\n\nTekst: "${hit.text.slice(0, 300)}"\n\n${question}` }],
              max_tokens: 50,
              temperature: 0,
            }),
          })
          const json = await res.json()
          const answer = (json.choices?.[0]?.message?.content || '').trim()
          const durationMs = Date.now() - t0
          log(`    → ${answer} (${(durationMs / 1000).toFixed(1)}s)`)

          const filename = pageFile.get(hit.page) || 'unknown'
          const docId = `doc:${filename}`
          const qType = question.replace(/[?!]/g, '').trim().toLowerCase()
          const valueId = `val:${qType}:${answer}`

          await ctx._graph.addNodes([
            { id: docId, type: 'document', label: filename, data: {} },
            { id: valueId, type: qType, label: answer, data: { source: filename, page: hit.page, score: hit.score } },
          ]).catch(() => {})
          await ctx._graph.addEdges([{
            id: `e:${docId}:${valueId}`, from: docId, to: valueId, type: qType, label: qType,
          }]).catch(() => {})
          extracted++
        } catch (e: any) {
          log(`    BLAD: ${e.message}`)
        }
      }
    }

    ctx.data.extractStats = { extracted, failed: totalCalls - extracted, total: totalCalls }
    log(`=== PODSUMOWANIE: ${extracted}/${totalCalls} odpowiedzi, ${((Date.now() - t0) / 1000).toFixed(0)}s ===`)
  },
}
