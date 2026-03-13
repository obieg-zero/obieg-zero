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

## Architektura

```
@obieg-zero/plugin-sdk (287 LOC)     — micro-framework pluginowy
app/src/Shell.tsx (87 LOC)           — layout + error boundary + router
app/src/main.tsx (22 LOC)            — bootstrap: host API + load plugins + render
app/src/plugins/playground/ (651 LOC) — pierwszy plugin (React Flow workbench)
packages/ (store, ocr, embed, llm, graph) — niezalezne klocki
```

### Szyna danych: OPFS + Dexie

```
OPFS (pliki)                    Dexie (dane)
─────────────                   ────────────────────
sprawa-1/                       projekty, strony, chunki,
  umowa.pdf                     embeddingi, encje, graf
  aneks.pdf
sprawa-2/
  rachunek.pdf

Upload → OPFS + Dexie
Parse  ← OPFS → Dexie pages
Embed  ← pages → Dexie chunks
Extract: pytanie → search → LLM → graf (Dexie)
Graf   ← Dexie → podglad encji + relacji
```

**OPFS = pliki. Dexie = dane. To jest szyna pracy.**

## Plugin SDK (`@obieg-zero/plugin-sdk`)

Micro-framework pluginowy. 287 LOC, 7 plikow. Wzorowany na BrainQuest (brain-edu-play).

### Moduly SDK

| Modul | Co robi |
|-------|---------|
| `hooks.ts` | `addFilter/applyFilters` (pipeline), `addAction/doAction` (events). Oba zwracaja cleanup fn. Priority-based sort. |
| `registry.ts` | 2-fazowy: `registerManifest()` (deklaracja, widoczny w UI) + `markReady()` (po zaladowaniu factory). `getAllPlugins()` zwraca manifest + ready flag. |
| `profileStore.ts` | `isPluginEnabled()`, `setPluginEnabled()`, `useProfile()` hook. `configureProfileStore({ storageKey })` — persist w localStorage. |
| `contracts.ts` | `registerProvider<T>(name, provider)` + `getProvider<T>(name)` — komunikacja miedzy pluginami. |
| `loader.ts` | `loadPlugins({ indexUrl, sdk, deps })` — fetch index.json z GitHub, dynamic import .mjs przez blob URL, factory(sdk, deps). |
| `types.ts` | `PluginManifestData`, `PluginManifest`, `ExternalPluginEntry`, `PluginFactory`, `LayoutSlots`, `RouteEntry`, `NavItem`, `HostAPI`, `PluginDeps` |

### Lifecycle pluginu

```
1. DISCOVERY   loader fetches index.json → registerManifest() (widoczny w UI)
2. FILTER      isPluginEnabled() — filtruje wg profilu (toggle w prawym panelu)
3. LOAD        importFromUrl(url) → factory(sdk, deps) → markReady(id)
4. INTEGRATE   Shell: applyFilters('routes', []) → layout slots → Error Boundary
5. RUNTIME     Plugin: doAction('shell:toggle-left'), Shell: addAction(...)
```

### Layout — sloty

Shell definiuje layout z 5 slotami. Plugin wypelnia ktore potrzebuje.

```
┌────────┬───────────────────────┐
│  left  │       center          │
│  w-72  │       flex-1          │
│        │                       │
│        ├───────────────────────┤
│        │       footer          │
└────────┴───────────────────────┘
+ wrapper (React Context provider owijajacy wszystkie sloty)
+ right (zadeklarowany w typach, prawy panel shella to lista pluginow)
```

Plugin deklaruje co idzie w ktory slot:

```ts
sdk.registerManifest({ id: 'playground', label: 'Playground', description: '...' })
sdk.addFilter('routes', routes => [...routes, {
  path: '/*',
  pluginId: 'playground',
  layout: {
    wrapper: PlaygroundProvider,  // React Context — wspolny stan miedzy slotami
    left: LeftSidebar,
    center: CenterCanvas,
    footer: FooterPanel,
  }
}])
```

### Shell (app/src/Shell.tsx)

- Renderuje layout ze slotami
- `applyFilters('routes', [])` + `isPluginEnabled()` filtruje routes
- `getAllPlugins()` → prawy panel z lista pluginow + toggle on/off
- `PluginErrorBoundary` — crash pluginu nie zabija shella
- Mobile: `max-md:-translate-x-72` sliding pattern
- Shell NIGDY nie importuje kodu pluginu

### Plugin nie wie nic o shellu

- Plugin dostaje SDK (hooki) + deps.host
- Plugin rejestruje route z layout slots
- Plugin uzywa `doAction('shell:toggle-left')` do komunikacji
- Plugin NIGDY nie importuje z app/src/

### Host API — co plugin dostaje

```ts
deps.host = {
  opfs,           // OpfsHandle — pliki w OPFS
  db,             // StoreDB — dane w Dexie (+ clearDocument per-plik)
  embedder,       // EmbedHandle | null (lazy)
  llm,            // LlmHandle | null (lazy)
  createGraphDB,  // (name) → GraphDB
  search,         // semantic search w chunkach
}
```

### Ladowanie pluginow

```ts
// main.tsx
configureProfileStore({ storageKey: 'oz-profile' })

// Lokalne (dev)
playgroundPlugin(SDK, { host })
markReady('playground')

// Zdalne (prod) — jeszcze nie aktywne, SDK gotowe
// await loadPlugins({ indexUrl: '...plugin-index/index.json', sdk: SDK, deps: { host } })
```

### ZASADA: bloki MUSZA uzywac pakietow przez deps.host

Plugin importuje i uzywa pakietow z `packages/` przez deps.host.
Kazdy blok czyta/pisze przez szyne OPFS + Dexie.

**NIGDY nie omijaj szyny.** Nowy blok = deps.host, zapis do Dexie/OPFS.

## Pakiety (klocki)

Kazdy pakiet to niezalezny klocek. Czyta z szyny, pisze do szyny.

```
packages/
├── plugin-sdk/ # @obieg-zero/plugin-sdk — micro-framework pluginowy (287 LOC)
├── store-v2/   # @obieg-zero/store-v2   — OPFS pliki + Dexie dane (szyna)
├── ocr-v2/     # @obieg-zero/ocr-v2     — PDF → strony tekstu
├── embed-v2/   # @obieg-zero/embed-v2   — tekst → chunki + wektory + search
├── llm-v2/     # @obieg-zero/llm-v2     — prompt → odpowiedz (lokalny GGUF)
└── graph-v2/   # @obieg-zero/graph-v2   — encje + relacje (graf na Dexie)
```

Kazdy klocek to pure functions + handle pattern:
- `createOpfs() → OpfsHandle` → `listProjects()`, `writeFile()`, `readFile()`
- `createStoreDB() → StoreDB` → projekty, dokumenty, strony, chunki, clearDocument (Dexie)
- `ocrFile(file, opts) → Page[]`
- `createEmbedder(opts) → EmbedHandle` → `handle.createIndex(pages) → EmbedIndex`
- `search(chunks, query, embedFn, opts) → SearchResult[]`
- `createLlm(opts) → LlmHandle` → `handle.ask(prompt) → AskResult { text, tokenCount, durationMs }`
- `createGraphDB(name) → GraphDB` → `addNodes()`, `getContext(id, hops)`, `queryNodes()`

## Playground = pierwszy plugin

React Flow canvas z sidebar. Drag & drop blokow, wizualne laczenie, wyniki wewnatrz nodow.

### Architektura wewnetrzna

```
PlaygroundProvider (wrapper slot — React Context, wspolny stan)
├── LeftSidebar (left slot — projekty, szablony, bloki drag&drop)
├── CenterCanvas (center slot — navbar + ReactFlow canvas + hero)
└── FooterPanel (footer slot — log + przycisk Analizuj)
```

Stan wspoldzielony przez Context (`Ctx`), nie module-level variables.
`store.ts` (6 LOC) — bridge do host API: `initHost(host)` / `getHost()`.

### Bloki (blocks.ts)

- **Upload** — multi-file (PDF, CSV, TXT, JSON) → OPFS + Dexie documents. `clearDocument` per-plik (nie clearProject).
- **Parse** — OPFS pliki → OCR/chunk → Dexie pages. Cache z Dexie.
- **Embed** — pages → chunki + embeddingi → Dexie chunks. Cache z Dexie.
- **Extract** — pytanie → search → LLM (WASM Bielik) → graf (Dexie)
- **Extract API** — to samo co Extract ale przez OpenAI-compatible API
- **Graph** — podglad grafu z Dexie: encje + relacje

### Pipeline execution

`runPipeline()` robi snapshot konfiguracji node'ow (`snap`) przed async loop — unika stale closures.
`topoSort()` sortuje topologicznie. Wyniki dodawane jako data/entity/doc nodes na canvas.

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

### Kierunki optymalizacji
- **Prompt format**: chatTemplate=true vs raw prompt
- **Ciecie chunka**: ciac na granicy zdania, nie na 300 zn
- **topK**: testowac topK=1 vs topK=2
- **Embedding model**: sprawdzic mniejsze modele (e5-xsmall, gte-small)
- **nCtx**: jesli prompt miesci sie w 256, nCtx=256 moze przyspieszyc
- **Benchmark powtarzalny**: zestaw dokumentow + pytania + oczekiwane odpowiedzi

## Design system

Tailwind + DaisyUI (dracula/corporate). Nie wymyslaj nowych klas — uzywaj ponizszych.

### Tekst

| Rola | Klasa | Kiedy |
|------|-------|-------|
| base | `text-sm` (14px) | root div, domyslny rozmiar |
| tresc | `text-xs` (12px) | etykiety, wartosci, nazwy, buttony |
| meta | `text-2xs` (10px) | podpisy, detale, sekcje, logi |
| tytul | `text-2xl font-black` | tylko hero |

### Kolor tekstu

| Rola | Klasa |
|------|-------|
| ghost | `text-base-content/20` lub `/25` |
| muted | `text-base-content/30` lub `/40` |
| secondary | `text-base-content/50` |
| normal | `text-base-content/70` |
| full | brak modyfikatora |
| brand | `text-primary` |
| status | `text-success`, `text-error`, `text-warning` |

### Tla i obramowania

| Rola | Klasa |
|------|-------|
| powierzchnia | `bg-base-100` |
| zaglebianie | `bg-base-200` |
| element | `bg-base-300` |
| obramowanie | `border-base-300` — zawsze to samo |
| separator | `border-t border-base-300` lub `border-r`/`border-b`/`border-l` |

### Spacing

| Gdzie | Klasa |
|-------|-------|
| padding wewn. | `px-3 py-2` (ciasno), `px-4 py-3` (luznie), `p-3`, `p-4` |
| gap | `gap-1` (toolbar), `gap-2` (form/grid) |
| margin sekcji | `mt-1` (inline), `mt-2` (blok), `mb-2`/`mb-3` |

### Wysokosci

| Element | Klasa |
|---------|-------|
| wiersz listy | `h-8` |
| navbar/toolbar | `h-10` z `min-h-10` |
| kafelek | `h-16` |
| footer | `h-[56px]` |

### Ikony (react-feather)

| Kontekst | Rozmiar |
|----------|---------|
| inline/detail | `size={12}` |
| button/label | `size={14}` |
| navbar | `size={16}` |

### Komponenty DaisyUI

| Element | Klasy |
|---------|-------|
| button toolbar | `btn btn-ghost btn-xs btn-square` |
| button action | `btn btn-primary btn-sm` |
| input | `input input-bordered input-sm text-xs` |
| badge | `badge badge-ghost badge-sm text-2xs` |
| toggle | `toggle toggle-xs toggle-primary` |
| karta | `rounded-lg bg-base-200 p-3` lub `p-4` |
| element listy | `rounded-md` + hover `hover:bg-base-200` |
| label sekcji | `text-2xs uppercase tracking-wider text-base-content/25 font-medium` |
| card header | `h-10 border-b border-base-300` z label sekcji |

### Panele

| Panel | Szerokosc | Klasy |
|-------|-----------|-------|
| lewy sidebar | `w-72` | `shrink-0 bg-base-100 border-r border-base-300` |
| prawy panel | `w-72` | `shrink-0 bg-base-100 border-l border-base-300 absolute right-0 z-40 shadow-lg` |
| center | `flex-1` | `bg-base-100 min-h-0 max-md:min-w-[100vw]` |

### Zasady

1. **Nie wymyslaj klas** — uzywaj TYLKO powyzszych tokenow
2. **Kazdy nowy komponent** — sprawdz tabele wyzej i zastosuj odpowiedni wzorzec
3. **Zero px/rem w kodzie** — tylko klasy Tailwind z tabeli
4. **Opacity tekstu** — uzywaj `/20`, `/25`, `/30`, `/40`, `/50`, `/70` — nie wymyslaj nowych
5. **Jeden border-color** — `border-base-300`, nigdy inny

## Konwencje

- TypeScript, ESM, published as `.ts` source (no build step)
- Pakiety to pure functions + handle pattern — zero frameworka, zero klas
- Ciezkie zaleznosci (pdfjs, tesseract, wllama, transformers) to peer deps, ladowane dynamicznie przez `await import()`
- OPFS wymaga secure context (HTTPS lub localhost)
- SharedArrayBuffer (wllama multi-thread) wymaga COOP/COEP headers
- Faza eksploracyjna — bez testow, kierunek moze sie zmienic

## Struktura repo

```
app/                           — shell + plugins
  src/Shell.tsx                — layout + error boundary + router (87 LOC)
  src/main.tsx                 — bootstrap (22 LOC)
  src/plugins/playground/      — pierwszy plugin (651 LOC)
    index.tsx                  — UI: provider + 3 sloty + factory
    blocks.ts                  — logika blokow pipeline
    nodes.tsx                  — React Flow node types
    store.ts                   — bridge do host API
    templates.ts               — predefiniowane pipeline'y
  public/samples/              — przykladowe dokumenty
packages/
  plugin-sdk/                  — micro-framework pluginowy (287 LOC)
  store-v2/                    — OPFS + Dexie
  ocr-v2/                      — PDF → tekst
  embed-v2/                    — embeddingi + search
  llm-v2/                      — lokalny LLM (WASM)
  graph-v2/                    — graf wiedzy
```

## Workflow

```bash
# Dev
cd app && yarn dev

# Publish zmian w pakietach
cd packages/<name> && npm version patch --no-git-tag-version && npm publish --access public
```
