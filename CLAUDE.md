# obieg-zero

Browser-native document analysis workbench. Zero backend, zero API, zero cloud.

## Kluczowe ograniczenie

LLM dziala jako Q4 GGUF przez WASM na slabym laptopie. Rozumie JEDEN akapit. Kazdy token kosztuje sekundy. Projektuj wszystko tak, zeby LLM dostal minimum inputu i odpowiedzial raz. Search jest darmowy, LLM jest drogi.

## Stan projektu: walidacja

System wymaga walidacji na prawdziwych danych. Kluczowe pytanie: **czy Bielik 1.5B Q4 potrafi wyciagnac fakty (plain text `TYP: wartosc`) z polskiego tekstu prawniczego?** Jesli nie — caly GraphRAG pipeline jest bezwartosciowy. Testuj na WIBOR-PRZYKLAD/ (umowy kredytowe + harmonogram + CSV WIBOR).

Kryteria walidacji:
- % chunkow dajacych parsowalne linie TYP: wartosc (>50% = warto rozwijac, <20% = zmien model lub podejscie)
- Jakosc wyciagnietych faktow (czy "kwota", "marza", "bank" sa poprawne)
- Czas na chunk (akceptowalne: <10s, problematyczne: >30s)
- Odpornosc na smieci (nieistotne chunki powinny dawac "brak" lub linie bez sensu — obie ignorowane)

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
Extract← chunks→ Graf (LLM na KAZDYM chunku = mrowki)
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

## mini-playground = workbench z szablonami

3-kolumnowy layout: projekty + OPFS | pipeline nodes | wyniki

```
examples/mini-playground/
├── App.tsx        — 3 kolumny, projekt=OPFS, pipeline edytowalny
├── blocks.tsx     — Upload, Parse, Embed, Search, LLM, Extract, Graph
├── templates.ts   — szablony: OCR+Search, Graph RAG, Analiza WIBOR
└── main.tsx
```

Flow tworzenia: Nowy projekt → wybierz szablon → pipeline gotowy → edytuj configi → uruchom.

Bloki:
- **Upload** — multi-file (PDF, CSV, TXT, JSON) → OPFS
- **Parse** — iteruje WSZYSTKIE pliki w OPFS projektu, routuje po rozszerzeniu (PDF→OCR, CSV→chunk wierszy, TXT→tekst)
- **Embed** — chunki + wektory (HuggingFace transformers w WASM)
- **Search** — semantyczne wyszukiwanie w chunkach
- **LLM** — pojedyncze zapytanie (klasyczny RAG)
- **Extract** — MROWKI: LLM na KAZDYM chunku → plain text `TYP: wartosc` → nodes+edges do grafu. To jest serce GraphRAG.
- **Graph** — podglad grafu: encje pogrupowane po typie + relacje

## Graph RAG — mrowki

LLM jest slaby — rozumie jeden akapit. Ale potrafi z jednego akapitu wyciagnac: "bank: PKO", "kwota: 200000", "waluta: CHF".

**Graf zbiera drobne fakty w calosc.** Setki malych ekstrakcji (kazda = jedno zapytanie do LLM na jednym chunku) skladaja sie w wiedze o sprawie. Traversal po grafie daje odpowiedzi, ktorych LLM sam nigdy by nie dal.

System jest odporny na smieci — niewlasciwy dokument lub nieistotny chunk daje "brak" i nic nie dodaje do grafu. Mrowki ignoruja to czego nie rozumieja.

Use case'y (rozne szablony, ten sam pipeline):
- **Analiza WIBOR** — umowa kredytu + harmonogram + dane WIBOR → fakty → nadplata
- **SIWZ vs firma** — specyfikacja zamowienia + dokumenty firmy → wymogi vs kwalifikacje
- **Dowolna analiza dokumentow** — uzytkownik definiuje typy encji i prompt

## FUNDAMENTALNA ZASADA: LLM nie produkuje struktur danych

LLM (1.5B Q4 WASM) NIGDY nie generuje JSON, XML, ani zadnych struktur. Model odpowiada PLAIN TEXT w najprostszym mozliwym formacie:
```
TYP: wartosc
TYP: wartosc
```
Parsing po stronie JS: split po `\n`, split po pierwszym `:`. Jesli linia nie pasuje — ignoruj. Jesli model zwroci smieci — ignoruj. Zero regexow na JSON, zero JSON.parse na odpowiedzi LLM. Ta zasada jest niepodwazalna.

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
├── mini-playground/   — aktywny workbench (3 kolumny, szablony, Extract+Graph)
├── playground/        — starszy playground (OPFS+Dexie, hardcoded pipeline)
├── doc-analyzer/      — LEGACY, nie rozwijac, lamie zasade plain-text (oczekuje JSON od LLM)
WIBOR-PRZYKLAD/        — testowe dokumenty (umowy kredytowe, harmonogram, CSV WIBOR)
```

## Workflow

```bash
# Dev (mini-playground)
cd examples/mini-playground && npm run dev

# Dev (playground)
cd examples/playground && npm run dev

# Publish zmian w pakietach
cd packages/<name> && npm version patch --no-git-tag-version && npm publish --access public
```

## LOC budget

Caly projekt: ~1841 LOC. Packages: 674, mini-playground: 631, playground: 536. Utrzymuj minimalizm.
