# Obieg Zero — core-host

Platforma pluginowa w przeglądarce. Zustand + IndexedDB (dane), OPFS (pluginy), sandbox, zero backendu.

## Zasady

- Polskie znaki diakrytyczne w UI i tekstach
- Nie uruchamiaj dev servera bez pytania
- Przed zmianą pluginu: config na local → praca → build → user potwierdza → push → config na GitHub
- Sprawdź czy WSZYSTKIE typy z seed data mają `store.registerType()`
- Operacje na repozytoriach GitHub (tworzenie, usuwanie) wykonuj przez `gh` CLI
- **NIGDY** ręcznie `git add/commit/push` ani `npm publish` — TYLKO skrypty z `scripts/`

## Store — synchroniczny CRUD (IndexedDB)

```ts
store.add(type, data, opts?)     // zwraca PostRecord, NIE Promise
store.get(id)                    // sync
store.update(id, data)           // sync, merge
store.remove(id)                 // sync, cascade children
store.usePosts(type)             // React hook
store.usePost(id)                // React hook
store.useChildren(parentId)      // React hook
store.registerType(type, schema, label, { strict? })
```

Relacje: `parentId` dla parent-child, `data.opponentId` jako foreign key.

## OPFS — stan pluginów (przeżywa czyszczenie IndexedDB)

Plik `plugin-cache/meta.json` — single source of truth:
```json
{ "specs": ["store://prod_abc"], "labels": {"store://prod_abc": "Nazwa"}, "licenseKey": "ch_xyz" }
```

API w `src/opfs.ts`: `loadMeta()`, `saveMeta()`, `meta()`, `readCode()`, `writeCode()`.

SDK metody dla pluginów: `sdk.installPlugin(spec, label?)`, `sdk.uninstallPlugin(spec)`, `sdk.getInstalledPlugins()`.

## Integralność pluginów

- **SRI** (Subresource Integrity): pole `integrity` w `config.json` — deployer pinuje hash, loader weryfikuje.
- Tagowane wersje `@vX.Y.Z` — immutable na GitHubie, cachowane w OPFS.
- `store://` — serwowane przez kontrolowany worker z prywatnych repo.

## Plugin — sandbox

```tsx
import type { PluginFactory } from '@obieg-zero/sdk'

const plugin: PluginFactory = ({ store, sdk, ui, icons }) => {
  store.registerType('task', [{ key: 'title', label: 'Tytuł', required: true }], 'Zadania')
  sdk.registerView('tasks.center', { slot: 'center', component: () =>
    <ui.Page><ui.Button onClick={() => store.add('task', { title: 'X' })}>+</ui.Button></ui.Page>
  })
  return { id: 'tasks', label: 'Zadania', icon: icons.CheckSquare }
}
export default plugin
```

**ZAKAZANE:** `fetch`, `className`, `import()`, `localStorage`, `await` na store.

Pełne API: `@obieg-zero/sdk` README (`node_modules/@obieg-zero/sdk/README.md`).

## Architektura src/

```
src/
├── main.tsx           → bootstrap, SDK, ładowanie pluginów, SDK methods (OPFS)
├── store.ts           → Zustand store, synchroniczny CRUD (IndexedDB)
├── opfs.ts            → OPFS cache + meta.json (stan pluginów)
├── plugin.ts          → host store, registries, loader, SRI
├── Shell.tsx          → hooki na store → przekazuje dane do ShellLayout
├── types.ts           → typy stage views, StageViewProps
├── stageRegistry.ts   → rejestr stage views
└── themes/
    └── default/
        ├── columns.tsx     → Layout, Columns, Bar, Content
        ├── chrome.tsx      → NavButton, LogBox, FatalError, PluginErrorBoundary
        ├── stageViews.tsx  → FormView, TimelineView, DecisionView, GenericView
        └── ShellLayout.tsx → czysty JSX shell, dane tylko z props
```

**Zasada:** `themes/` = czyste JSX komponenty. Dane (store, hooki) zostają w `Shell.tsx`, `plugin.ts`, `main.tsx` i są przekazywane przez props.

## NPM packages (w pluginach `../plugins/node_modules/`)

- `@obieg-zero/sdk` — typy + UI komponenty. Każdy plugin importuje `type { PluginFactory }` stąd. Źródło: `../packages/sdk/`, publish: `scripts/deploy-package-to-npm.sh sdk`.
- `@obieg-zero/workflow-engine` — graph nodes, buildWorkflow. Stage views w `src/themes/default/stageViews.tsx`.
- `@obieg-zero/doc-pipeline` — OCR + AI extraction pipeline.
- `@obieg-zero/doc-reader` — PDF text + Tesseract OCR.
- `@obieg-zero/doc-search` — embeddings + semantic search.

Czytaj README każdego package'u przed użyciem.

## Deploy — TYLKO przez skrypty

```
scripts/push-core-host.sh [msg]                    — commit + push CORE-HOST
scripts/deploy-plugin-to-dev.sh [name]             — build + push plugin na @dev
scripts/deploy-plugin-from-dev-to-prod.sh [name]   — promote @dev → @main + tag
scripts/deploy-app-to-dev.sh                       — build + deploy app na dev
scripts/deploy-app-from-dev-to-prod.sh             — build + deploy app na prod
scripts/deploy-package-to-npm.sh [name]            — publish package na npm
```

## Cykl pracy z pluginem

1. `public/config.json`: zamień `"obieg-zero/plugin-X@main"` → `"./plugin-X"`
2. Edytuj, builduj: `cd ../plugins && npm run build`
3. User potwierdza → `scripts/deploy-plugin-to-dev.sh plugin-X` → przywróć config na GitHub
