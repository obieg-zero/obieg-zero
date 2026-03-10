import { search } from '@obieg-zero/embed-v2'
import type { Chunk } from '@obieg-zero/embed-v2'
import { createLlm } from '@obieg-zero/llm-v2'
import { createGraphDB } from '@obieg-zero/graph-v2'
import type { BlockDef } from './types'

export const extractBlock: BlockDef = {
  type: 'extract',
  label: 'Extract',
  color: '#f59e0b',
  fields: [
    { key: 'questions', label: 'Pytania (jedno na linie)' },
    { key: 'topK', label: 'Chunkow na pytanie', default: '2' },
    { key: 'modelUrl', label: 'Model URL', default: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf' },
  ],
  defaults: {
    questions: 'Jaki bank udzielil kredytu?\nJaka jest kwota kredytu?\nJaka jest marza banku?\nJaki jest WIBOR?\nKiedy zawarto umowe?\nNa ile lat jest kredyt?\nJaka jest rata?\nJaka jest waluta kredytu?',
    topK: '2',
    modelUrl: 'https://huggingface.co/obieg-zero/Bielik-1.5B-v3.0-Instruct-GGUF/resolve/main/Bielik-1.5B-v3.0-Instruct.Q4_K_M.gguf',
  },
  async run(config, ctx, log) {
    if (!ctx.data.chunks?.length || !ctx.data._embedFn) { log('Brak chunks/embeddings — dodaj Embed przed Extract'); return }

    if (!ctx._llm) {
      ctx._llm = await createLlm({
        modelUrl: config.modelUrl,
        wasmPaths: {
          'single-thread/wllama.wasm': new URL('@wllama/wllama/esm/single-thread/wllama.wasm', import.meta.url).href,
          'multi-thread/wllama.wasm': new URL('@wllama/wllama/esm/multi-thread/wllama.wasm', import.meta.url).href,
        },
        nCtx: 512,
        chatTemplate: true,
        onProgress: m => log(`  ${m}`),
      })
    }

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

    log(`Extract: ${questions.length} pytan × ${topK} chunkow = max ${totalCalls} wywolan`)

    for (const question of questions) {
      const results = await search(ctx.data.chunks, question, ctx.data._embedFn, { topK, minWordLength: 2 })
      log(`--- ${question} ---`)
      log(`  search: ${results.map(r => `[${r.score.toFixed(3)}] str.${r.page}`).join(', ')}`)

      for (const hit of results) {
        const prompt = `Dokoncz zdanie na podstawie tekstu.\n\nTekst: "${hit.text.slice(0, 300)}"\n\n${question}`
        callsDone++
        const avgMs = callsDone > 1 ? (Date.now() - t0) / (callsDone - 1) : 0
        const eta = callsDone > 1 ? ` | ETA: ${Math.round(avgMs * (totalCalls - callsDone) / 1000)}s` : ''
        log(`  [${callsDone}/${totalCalls}${eta}] chunk str.${hit.page} (score ${hit.score.toFixed(3)})`)

        try {
          const result = await ctx._llm.ask(prompt, { nPredict: 16, temperature: 0 })
          const answer = result.text.trim()
          log(`    → ${answer} (${result.tokenCount}tok ${(result.durationMs / 1000).toFixed(1)}s)`)

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
