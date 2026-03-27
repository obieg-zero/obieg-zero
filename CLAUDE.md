# Obieg Zero — core-host

WordPress w przeglądarce. Zustand + IndexedDB, sandbox pluginów, zero backendu.

## Zasady

- Polskie znaki diakrytyczne w UI i tekstach
- Nie uruchamiaj dev servera bez pytania
- Przed zmianą pluginu: config na local → praca → build → user potwierdza → push → config na GitHub
- Sprawdź czy WSZYSTKIE typy z seed data mają `store.registerType()`
- Operacje na repozytoriach GitHub (tworzenie, usuwanie) wykonuj przez `gh` CLI

## Store — synchroniczny CRUD

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
├── main.tsx           → bootstrap, SDK, ładowanie pluginów
├── store.ts           → Zustand store, synchroniczny CRUD
├── plugin.ts          → host store, registries, loader (dane)
├── Shell.tsx          → hooki na store → przekazuje dane do ShellLayout (dane)
├── views.tsx          → typy stage views, submitStageData, registry (dane)
├── ui.tsx             → re-export z themes (proxy)
└── themes/
    └── default/
        ├── columns.tsx     → Layout, Columns, Bar, Content + re-export SDK
        ├── chrome.tsx      → NavButton, LogBox, FatalError, PluginErrorBoundary
        ├── stageViews.tsx  → FormView, TimelineView, DecisionView, GenericView
        └── ShellLayout.tsx → czysty JSX shell, dane tylko z props
```

**Zasada:** `themes/` = czyste JSX komponenty. Dane (store, hooki) zostają w `Shell.tsx`, `plugin.ts`, `views.tsx` i są przekazywane przez props.

## NPM packages (w pluginach `../plugins/node_modules/`)

- `@obieg-zero/sdk` — typy + UI komponenty. Każdy plugin importuje `type { PluginFactory }` stąd. Źródło: `../packages/sdk/`, publish: `npm publish` z tego katalogu.
- `@obieg-zero/workflow-engine` — graph nodes, buildWorkflow. Stage views (FormView, TimelineView, DecisionView, GenericView) są teraz w `src/themes/default/stageViews.tsx`, logika w `src/views.tsx`.
- `@obieg-zero/doc-pipeline` — OCR + AI extraction pipeline. Użyj gdy plugin przetwarza dokumenty.
- `@obieg-zero/doc-reader` — PDF text + Tesseract OCR.
- `@obieg-zero/doc-search` — embeddings + semantic search.

Czytaj README każdego package'u przed użyciem.

## Cykl pracy z pluginem

1. `public/config.json`: zamień `"obieg-zero/plugin-X@main"` → `"./plugin-X"`
2. Edytuj, builduj: `cd ../plugins && npm run build`
3. User potwierdza → git push → przywróć config na GitHub
