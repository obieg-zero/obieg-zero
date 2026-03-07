import { createFlow, templateNode, extractNode } from '@obieg-zero/core'
import { storageModule } from '@obieg-zero/storage'
import { ocrModule } from '@obieg-zero/ocr'
import { embedModule } from '@obieg-zero/embed'
import { llmModule } from '@obieg-zero/llm'

export const flow = createFlow()

flow.use(storageModule)
flow.use(ocrModule)
flow.use(embedModule, {
  topK: 1, chunkSize: 200,
  workerFactory: () => new Worker(
    new URL('@obieg-zero/embed/src/embedding-worker.ts', import.meta.url),
    { type: 'module' },
  ),
})
flow.use(llmModule, { nPredict: 150, temperature: 0.1 })

// --- field patterns per document type ---
export const FIELD_MAP: Record<string, string[]> = {
  faktura: ['numer faktury', 'data wystawienia', 'sprzedawca', 'nabywca', 'NIP sprzedawcy', 'NIP nabywcy', 'kwota netto', 'kwota brutto', 'waluta'],
  umowa: ['typ umowy', 'strona pierwsza', 'strona druga', 'data zawarcia', 'przedmiot umowy', 'wartość', 'okres obowiązywania'],
  zaswiadczenie: ['wystawca', 'dotyczy kogo', 'data wydania', 'cel wydania', 'treść zaświadczenia'],
  akt_notarialny: ['notariusz', 'numer repertorium', 'strony aktu', 'przedmiot', 'data aktu'],
  decyzja: ['organ wydający', 'sygnatura', 'adresat', 'data decyzji', 'rozstrzygnięcie'],
  pismo: ['nadawca', 'adresat', 'data pisma', 'temat', 'treść'],
  inne: ['typ dokumentu', 'data', 'strony', 'treść'],
}

// classify queries — search for these, highest score wins
export const CLASSIFY_QUERIES: Record<string, string> = {
  faktura: 'faktura VAT numer faktury sprzedawca nabywca kwota brutto netto',
  umowa: 'umowa strony umowy zawarta pomiędzy przedmiot umowy',
  zaswiadczenie: 'zaświadczenie zaświadcza się wydaje się niniejszym',
  akt_notarialny: 'akt notarialny repertorium notariusz kancelaria notarialna',
  decyzja: 'decyzja postanawia organ administracyjny na podstawie art',
  pismo: 'szanowni państwo w odpowiedzi na pismo informuję',
}

// --- pipelines ---
export const PIPELINE_INGEST = ['upload', 'ocr', 'embed', 'save'] as const
