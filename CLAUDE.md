# obieg-zero

Browser-native document analysis workbench. Zero backend, zero API, zero cloud.

## Kluczowe ograniczenie

LLM dziala jako Q4 GGUF przez WASM na slabym laptopie. Rozumie JEDEN akapit. Kazdy token kosztuje sekundy (~50s/wywolanie). Projektuj wszystko tak, zeby LLM dostal minimum inputu i odpowiedzial raz. Search jest darmowy, LLM jest drogi.

## FUNDAMENTALNA ZASADA: LLM nie produkuje struktur danych

LLM (1.5B Q4 WASM) NIGDY nie generuje JSON, XML, ani zadnych struktur. Nie narzucamy formatu odpowiedzi. Pytanie = sentence starter, odpowiedz = cokolwiek model powie. Typ to pytanie ktore MY zadajemy, wartosc to CALA odpowiedz.

Przyklad:
- Prompt: `Dokoncz zdanie na podstawie tekstu.\n\nTekst: "..."\n\nNazwa banku to`
- LLM odpowiada: `Bank Gospodarki Zywnosciowej S.A.`
- Typ w grafie = "nazwa banku to", wartosc = cala odpowiedz

Zero parsowania, zero regexow, zero JSON.parse. Ta zasada jest niepodwazalna.

## Stan projektu: walidacja

Benchmark w `WIBOR-PRZYKLAD/bielik-benchmark.md`. Kluczowe wyniki:
- Sentence starters: 6/8 poprawnych (75%), pytania wprost: 4/8 (50%)
- ~53s/wywolanie w WASM (nCtx=512, nPredict=16, temp=0)
- Bielik dobrze kopiuje liczby, halucynuje nazwy wlasne
- Myli podobne wartosci (WIBOR vs marza)

## Architektura: szyna OPFS + Dexie

```
OPFS (pliki)                    Dexie (dane)
─────────────                   ────────────────────
sprawa-1/                       projekty, strony, chunki,
  umowa.pdf                     embeddingi, encje, graf,
  aneks.pdf                     trace, konfiguracje
  dane.csv
sprawa-2/
  rachunek.pdf

Upload → OPFS (PDF, CSV, TXT, JSON)
Parse  ← OPFS  → ctx.pages (PDF→OCR, CSV→chunk wierszy, TXT→tekst)
Embed  ← pages → ctx.chunks (chunki + wektory)
Extract: pytanie → search w chunkach → LLM na trafieniach → graf
Graf   ← Dexie → podglad encji + relacji
```

**OPFS = pliki. Dexie = dane. To jest szyna pracy.**

## Pakiety (klocki)

Kazdy pakiet to niezalezny klocek. Czyta z szyny, pisze do szyny.

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

## Playground = aktywny workbench

3-kolumnowy layout: projekty + OPFS | pipeline nodes | wyniki

```
examples/playground/
├── App.tsx        — 3 kolumny, projekt=OPFS, pipeline edytowalny
├── blocks.tsx     — Upload, Parse, Embed, Search, LLM, Extract, Graph
├── templates.ts   — szablony: Graph RAG, Analiza WIBOR
└── main.tsx
```

Flow tworzenia: Nowy projekt → wybierz szablon → pipeline gotowy → edytuj configi → uruchom.

Bloki:
- **Upload** — multi-file (PDF, CSV, TXT, JSON) → OPFS
- **Parse** — iteruje WSZYSTKIE pliki w OPFS projektu, routuje po rozszerzeniu (PDF→OCR, CSV→chunk wierszy, TXT→tekst)
- **Embed** — chunki + wektory (Xenova/multilingual-e5-small, WASM)
- **Search** — semantyczne wyszukiwanie w chunkach
- **LLM** — pojedyncze zapytanie (klasyczny RAG)
- **Extract** — pytanie → semantic search → LLM na trafionych chunkach → graf. Serce GraphRAG.
- **Graph** — podglad grafu: encje pogrupowane po typie + relacje

Extract flow:
1. Lista pytan (sentence starters) z configu
2. Dla kazdego pytania → semantic search w chunkach → top K trafien
3. LLM dostaje: "Dokoncz zdanie...\n\nTekst: chunk\n\nNazwa banku to"
4. Cala odpowiedz = wartosc, pytanie = typ
5. Graf: document --typ--> wartosc (kierunkowy edge)

## Graf wiedzy — dokument-centryczny

```
test-mini.txt --nazwa banku to-----> BGZ S.A.
test-mini.txt --kwota kredytu wynosi-> 280.000 PLN
test-mini.txt --kredytobiorca to----> Jan Kowalski
```

- Node-dokument = plik (filename z OPFS)
- Node-wartosc = odpowiedz LLM
- Edge = pytanie/typ, kierunkowy: dokument → wartosc
- Gdy wiele dokumentow wskazuje na te sama wartosc — graf laczy sprawy

## Optymalizacja LLM (Bielik 1.5B Q4 WASM)

- nCtx: 512 (nie 2048 — chunki maja 200 zn)
- nPredict: 16 (krotkie odpowiedzi)
- temperature: 0 (deterministyczny)
- Chunk w prompcie: max 300 zn
- Multi-thread: COOP/COEP headers wlaczone
- Sentence starters zamiast pytan (75% vs 50% poprawnosci)

## Konwencje

- TypeScript, ESM, published as `.ts` source (no build step)
- Pakiety to pure functions + handle pattern — zero frameworka, zero klas
- Ciezkie zaleznosci (pdfjs, tesseract, wllama, transformers) to peer deps, ladowane dynamicznie przez `await import()`
- OPFS wymaga secure context (HTTPS lub localhost)
- SharedArrayBuffer (wllama multi-thread) wymaga COOP/COEP headers
- Faza eksploracyjna — bez testow, kierunek moze sie zmienic

## Projekty w repo

```
examples/
├── playground/        — AKTYWNY workbench (3 kolumny, szablony, Extract+Graph)
├── old-playground/    — starszy playground (OPFS+Dexie, hardcoded pipeline)
├── doc-analyzer/      — LEGACY, nie rozwijac, lamie zasade plain-text
WIBOR-PRZYKLAD/        — testowe dokumenty + benchmark Bielika
```

## Workflow

```bash
# Dev
cd examples/playground && npm run dev

# Publish zmian w pakietach
cd packages/<name> && npm version patch --no-git-tag-version && npm publish --access public
```
