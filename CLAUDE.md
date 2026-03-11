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

## Stan projektu: optymalizacja Bielika

Architektura RAG dziala. Waskie gardlo to jakosc i szybkosc modelu.

### Znane wyniki (benchmark WIBOR)
- Bielik sentence starters: 6/8 (75%), Bielik pytania: 4/8 (50%), GPT-4o-mini: 7/8 (88%)
- Bielik ~53s/wywolanie w WASM, GPT-4o-mini ~1s/wywolanie
- Bielik dobrze kopiuje liczby, halucynuje nazwy wlasne, myli WIBOR z marza
- Pipeline RAG jest poprawny — waskie gardlo to model, nie architektura

### Kierunki optymalizacji jakosci
- **Prompt format**: chatTemplate=true vs raw prompt — chat template dodaje tokeny overhead, sprawdzic co daje lepsze wyniki
- **Ciecie chunka w prompcie**: `hit.text.slice(0, 300)` tnie na 300 zn, moze ciac w pol slowa/liczby — lepiej ciac na granicy zdania
- **topK**: topK=2 = 2 wywolania LLM na pytanie. Jesli pierwszy chunk jest dobry, drugi moze mylic. Testowac topK=1
- **Sentence starters**: dobierac do konkretnego dokumentu — inne dla faktury gazowej, inne dla umowy kredytowej

### Kierunki optymalizacji szybkosci
- **Embedding model**: `Xenova/multilingual-e5-small` (q8) — sprawdzic mniejsze modele (e5-xsmall, gte-small) pod katem quality vs speed
- **nCtx**: 512 — jesli prompt+odpowiedz miesci sie w 256, nCtx=256 moze przyspieszyc
- **Quantization**: Q4_K_M to dobry balans. Q4_0 szybszy ale gorszy. Nie schodzic nizej
- **nPredict**: 16 tokenow — dla liczb/dat wystarczy, dla nazw wlasnych moze za malo

### Czego potrzebujemy
- **Benchmark powtarzalny**: zestaw dokumentow + pytania + oczekiwane odpowiedzi, uruchamiany automatycznie
- **Metryki**: trafnosc (% poprawnych), czas/wywolanie, rozmiar paczek (MB)
- **Porownanie**: kazda zmiana (prompt, model, parametry) mierzona tym samym benchmarkiem

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

Upload → OPFS + Dexie (PDF, CSV, TXT, JSON)
Parse  ← OPFS  → Dexie pages (PDF→OCR, CSV→chunk wierszy, TXT→tekst)
Embed  ← pages → Dexie chunks (chunki + wektory + embeddingi)
Extract: pytanie → search w chunkach → LLM na trafieniach → graf (Dexie)
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

React Flow canvas z sidebar. Drag & drop blokow, wizualne laczenie, wyniki wewnatrz nodow.

```
app/
├── src/
│   ├── App.tsx        — React Flow canvas + sidebar + runner (topoSort)
│   ├── blocks.ts      — pure functions: Upload, Parse, Embed, Extract, Graph
│   ├── nodes.tsx      — custom React Flow nodes (Shell, UploadNode, DataNode)
│   ├── store.ts       — singletony: opfs, db (StoreDB), embedder, llm
│   ├── templates.ts   — szablony: Analiza WIBOR, Faktura za gaz, WIBOR (API)
│   ├── main.tsx       — entry point
│   └── index.css      — tailwind + daisyui + xyflow
└── public/
    └── samples/       — przykladowe dokumenty do testow (faktura gazowa etc.)
```

### ZASADA: bloki MUSZA uzywac pakietow

Playground importuje i uzywa pakietow z `packages/`. Kazdy blok czyta/pisze przez szyne:
- `opfs` (z store.ts) — pliki w OPFS
- `db` (z store.ts) — dane w Dexie (StoreDB)
- `createGraphDB` — graf wiedzy w Dexie

**NIGDY nie omijaj szyny.** Nowy blok = import z packages, zapis do Dexie/OPFS.
Jesli dodajesz nowy blok, wzoruj sie na istniejacych w `blocks.ts`.

### Przyklad: jak blok uzywa szyny

```ts
// blocks.ts — blockUpload zapisuje do OPFS + Dexie
import { opfs, db } from './store'

await opfs.writeFile(project, file.name, file)           // plik → OPFS
await db.addDocument({ id, projectId, filename, ... })    // metadane → Dexie

// blockParse czyta z OPFS, pisze pages do Dexie
const file = await opfs.readFile(project, filename)       // OPFS → plik
await db.setPages(pages)                                  // strony → Dexie

// blockEmbed pisze chunki z embeddingami do Dexie
await db.setChunks(chunks)                                // chunki + wektory → Dexie
```

### Flow

Nowy projekt → wybierz szablon → pipeline na canvas → edytuj configi → uruchom.
Pipeline state (nodes/edges) persystowany w localStorage per projekt.

### Bloki

- **Upload** — multi-file (PDF, CSV, TXT, JSON) → OPFS + Dexie documents
- **Parse** — OPFS pliki → OCR/chunk → Dexie pages
- **Embed** — pages → chunki + embeddingi → Dexie chunks
- **Extract** — pytanie → search → LLM (WASM Bielik) → graf (Dexie)
- **Extract API** — to samo co Extract ale przez OpenAI-compatible API
- **Graph** — podglad grafu z Dexie: encje + relacje

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

## Struktura repo

```
app/                   — workbench (React Flow, packages, Dexie szyna)
app/public/samples/    — przykladowe dokumenty do testow
packages/              — niezalezne klocki (store, ocr, embed, llm, graph)
```

## Workflow

```bash
# Dev
cd app && yarn dev

# Publish zmian w pakietach
cd packages/<name> && npm version patch --no-git-tag-version && npm publish --access public
```
