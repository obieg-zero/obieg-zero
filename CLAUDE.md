# obieg-zero

Browser-native document analysis workbench. Zero backend, zero API, zero cloud.

## Kluczowe ograniczenie

LLM dziala jako Q4 GGUF przez WASM na slabym laptopie. Rozumie JEDEN akapit. Kazdy token kosztuje sekundy. Projektuj wszystko tak, zeby LLM dostal minimum inputu i odpowiedzial raz. Search jest darmowy, LLM jest drogi.

## Architektura: szyna OPFS + Dexie

```
OPFS (pliki)                    Dexie (dane)
─────────────                   ────────────────────
sprawa-1/                       projekty, strony, chunki,
  umowa.pdf                     embeddingi, encje, graf,
  aneks.pdf                     trace, konfiguracje
sprawa-2/
  rachunek.pdf

Upload → OPFS
OCR    ← OPFS  → Dexie (strony, tekst)
Embed  ← Dexie → Dexie (chunki, wektory)
LLM    ← Dexie → Dexie (fakty, ekstrakcje)
Graf   ← Dexie → Dexie (encje, relacje)
```

**OPFS = pliki. Dexie = dane. To jest szyna pracy.**

Sprawa (case) = folder w OPFS + dane w Dexie. Upload wrzuca plik do OPFS. OCR czyta z OPFS. Wszystkie dane strukturalne (tekst, chunki, embeddingi, graf) ida do Dexie.

## Pakiety (klockI)

Kazdy pakiet to niezalezny klocek. Czyta z szyny, pisze do szyny. Playground NIE narzuca pipeline'u — uzytkownik go komponuje.

```
packages/
├── store-v2/   # @obieg-zero/store-v2  — OPFS pliki + Dexie dane (szyna)
├── ocr-v2/     # @obieg-zero/ocr-v2    — PDF → strony tekstu
├── embed-v2/   # @obieg-zero/embed-v2  — tekst → chunki + wektory + search
├── llm-v2/     # @obieg-zero/llm-v2    — prompt → odpowiedz (lokalny GGUF)
└── graph-v2/   # @obieg-zero/graph-v2  — encje + relacje (graf na Dexie)
```

Kazdy klocek to pure functions + handle pattern:
- `createOpfs() → OpfsHandle` → `listProjects()`, `writeFile()`, `readFile()`
- `createStoreDB() → StoreDB` → projekty, dokumenty, strony, chunki (Dexie)
- `ocrFile(file, opts) → Page[]`
- `createEmbedder(opts) → EmbedHandle` → `handle.createIndex(pages) → EmbedIndex`
- `search(chunks, query, embedFn, opts) → SearchResult[]`
- `createLlm(opts) → LlmHandle` → `handle.ask(prompt) → AskResult { text, tokenCount, durationMs }`
- `createGraphDB(name) → GraphDB` → `addNodes()`, `getContext(id, hops)`, `queryNodes()`

## Playground = modularny workbench

Playground to narzedzie do budowania systemow analizy dokumentow. Uzytkownik sam sklada pipeline z klockow:

- **Tylko OCR** → przegladam tekst z PDF
- **OCR → Embed** → szukam semantycznie po dokumentach
- **OCR → LLM** → paragraf po paragrafie wyciagam fakty (bez embeddingu)
- **OCR → Embed → LLM** → klasyczny RAG
- **OCR → Embed → LLM → Graf** → Graph RAG z akumulacja wiedzy
- **OPFS browser** → pracuje na plikach juz zapisanych, bez uploadu
- Dowolna inna kombinacja

Playground obsluguje DOWOLNE dokumenty: kredyty, rachunki za prad, mandaty, umowy najmu. Uzytkownik definiuje scenariusz (schemat encji, prompty) i iteruje.

## Graph RAG — po co graf

LLM jest slaby — rozumie jeden akapit. Ale potrafi z jednego akapitu wyciagnac: "bank: PKO", "kwota: 200000", "waluta: CHF".

**Graf zbiera drobne fakty w calosc.** Setki malych ekstrakcji (kazda = jedno zapytanie do LLM na jednym akapicie) skladaja sie w wiedze o sprawie. Traversal po grafie daje odpowiedzi, ktorych LLM sam nigdy by nie dal.

To jak mrowki budujace mrowisko — kazda mrowka (jedno zapytanie) niesie jeden fakt, ale razem powstaje struktura.

## Konwencje

- TypeScript, ESM, published as `.ts` source (no build step)
- Pakiety to pure functions + handle pattern — zero frameworka, zero klas
- Ciezkie zaleznosci (pdfjs, tesseract, wllama, transformers) to peer deps, ladowane dynamicznie przez `await import()`
- OPFS wymaga secure context (HTTPS lub localhost)
- SharedArrayBuffer (wllama multi-thread) wymaga COOP/COEP headers

## Workflow

```bash
# Dev
cd examples/playground && npm run dev

# Publish zmian w pakietach
cd packages/<name> && npm version patch --no-git-tag-version && npm publish --access public
```
