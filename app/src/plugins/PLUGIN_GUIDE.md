# Jak pisac plugin do obieg-zero

## Co to jest plugin

Plugin to funkcja `PluginFactory` ktora dostaje `sdk` (hooki) i `deps` (host API). Rejestruje manifest, dodaje UI do slotow layoutu, moze reagowac na eventy. Plugin NIE importuje niczego z `app/src/` — komunikuje sie tylko przez sdk i deps.

## Minimalny plugin (tylko akcja w navbarze)

```tsx
import type { PluginFactory } from '@obieg-zero/plugin-sdk'

const myPlugin: PluginFactory = (sdk) => {
  sdk.registerManifest({
    id: 'my-plugin',
    label: 'Moj plugin',
    description: 'Opis co robi'
  })

  // dodaj ikone do navbara
  sdk.addFilter('shell:actions', (actions: any[]) => [
    ...actions,
    { pluginId: 'my-plugin', node: <button onClick={() => alert('klik')}>X</button> }
  ], 10, 'my-plugin')
}

export default myPlugin
```

## Plugin z pelnym layoutem (left + center + footer)

```tsx
import { useState, createContext, useContext } from 'react'
import type { PluginFactory } from '@obieg-zero/plugin-sdk'
import { doAction } from '@obieg-zero/plugin-sdk'

// 1. Context — wspolny stan miedzy slotami
type Ctx = { count: number; inc: () => void }
const MyCtx = createContext<Ctx | null>(null)
const useMyCtx = () => { const c = useContext(MyCtx); if (!c) throw new Error('MyProvider missing'); return c }

const myPlugin: PluginFactory = (sdk, deps) => {
  // 2. Wrapper — React Context provider, owijka wszystkich slotow
  function MyProvider({ children }: { children: React.ReactNode }) {
    const [count, setCount] = useState(0)
    return <MyCtx.Provider value={{ count, inc: () => setCount(n => n + 1) }}>{children}</MyCtx.Provider>
  }

  // 3. Sloty — kazdy to osobny komponent, komunikuja sie przez Context
  function LeftPanel() {
    const { count } = useMyCtx()
    return <div className="p-3 text-xs">Klikniec: {count}</div>
  }

  function CenterPanel() {
    const { inc } = useMyCtx()
    return (
      <div className="flex-1 flex items-center justify-center">
        <button className="btn btn-primary btn-sm" onClick={inc}>Kliknij</button>
      </div>
    )
  }

  function FooterPanel() {
    const { count } = useMyCtx()
    return (
      <div className="h-10 min-h-10 shrink-0 flex items-center border-t border-base-300 px-3">
        <span className="text-2xs text-base-content/30">stan: {count}</span>
      </div>
    )
  }

  // 4. Rejestracja
  sdk.registerManifest({ id: 'my-plugin', label: 'Moj plugin', description: 'Opis' })

  // ikona w navbarze — klik aktywuje plugin
  sdk.addFilter('shell:actions', (actions: any[]) => [
    ...actions,
    { pluginId: 'my-plugin', node: <button onClick={() => doAction('shell:activate', 'my-plugin')}>M</button> }
  ], 10, 'my-plugin')

  // route z layout slotami
  sdk.addFilter('routes', (routes: any[]) => [
    ...routes,
    {
      path: '/my-plugin',
      pluginId: 'my-plugin',
      layout: {
        wrapper: MyProvider,  // owijka — Context provider
        left: LeftPanel,      // lewy sidebar w-72
        center: CenterPanel,  // srodkowa kolumna flex-1
        footer: FooterPanel,  // dolny pasek
      }
    }
  ])
}

export default myPlugin
```

## Layout — sloty

Shell definiuje layout. Plugin wypelnia ktore sloty potrzebuje.

```
┌────────┬───────────────────────┐
│  left  │       center          │
│  w-72  │       flex-1          │
│        │                       │
│        ├───────────────────────┤
│        │       footer          │
└────────┴───────────────────────┘
```

- `wrapper` — FC<{ children }> — React Context provider, owijka calego layoutu
- `left` — ComponentType — lewy sidebar (w-72), jezeli brak — sidebar sie nie renderuje
- `center` — ComponentType — glowna tresc (flex-1)
- `footer` — ComponentType — dolny pasek, opcjonalny
- Kazdy slot to osobny komponent. Wspolny stan przez Context (wrapper).

## SDK API — co plugin dostaje jako `sdk`

| Metoda | Co robi |
|--------|---------|
| `sdk.registerManifest(data)` | rejestruje plugin (id, label, description) |
| `sdk.addFilter(hook, fn, priority?, pluginId?)` | dodaje filtr do pipeline, zwraca cleanup fn |
| `sdk.addAction(hook, fn, priority?, pluginId?)` | rejestruje handler eventu, zwraca cleanup fn |

Dodatkowe importy z `@obieg-zero/plugin-sdk` (nie z sdk parametru):

| Funkcja | Co robi |
|---------|---------|
| `doAction(hook, ...args)` | emituje event |
| `applyFilters(hook, value)` | przepuszcza wartosc przez pipeline filtrow |

## Hooki (filtry i akcje)

### Filtry — pipeline, kazdy dostaje wartosc i zwraca zmodyfikowana

| Hook | Wartosc | Do czego |
|------|---------|----------|
| `routes` | `RouteEntry[]` | dodaj route z layout slotami |
| `shell:actions` | `{ pluginId, node }[]` | dodaj ikone/button do navbara |

### Akcje — eventy, fire-and-forget

| Hook | Argumenty | Do czego |
|------|-----------|----------|
| `shell:activate` | `(pluginId: string)` | aktywuj plugin (pokaz jego layout) |
| `shell:toggle-left` | brak | toggle lewego sidebara (mobile) |
| `shell:close-left` | brak | zamknij lewy sidebar (mobile) |

## Host API — co plugin dostaje jako `deps.host`

```ts
deps.host = {
  opfs,       // pliki w OPFS (browser filesystem)
  db,         // dane w Dexie (IndexedDB)
  embedder,   // EmbedHandle | null
  llm,        // LlmHandle | null
  createGraphDB,  // (name) => GraphDB
  search,     // semantic search w chunkach
}
```

### OPFS (pliki)

```ts
host.opfs.listProjects()                    // → string[]
host.opfs.createProject(name)               // tworzy folder
host.opfs.removeProject(name)               // usuwa folder
host.opfs.listFiles(projectId)              // → string[]
host.opfs.writeFile(projectId, name, file)  // zapisuje plik
host.opfs.readFile(projectId, name)         // → File
```

### Dexie (dane)

```ts
host.db.getPages(documentId)          // → { id, page, text }[]
host.db.setPages(pages)               // zapisuje strony
host.db.clearProject(projectId)       // czysci dane projektu
host.db.clearDocument(documentId)     // czysci dane dokumentu
```

## Komponenty UI

Plugin moze importowac z `../components/Box`:

### Box — panel z header/body/footer

```tsx
import { Box, Cell } from '../components/Box'

<Box
  header={<Cell label>tytul</Cell>}
  body={<div>tresc</div>}
  footer={<Cell label>stopka</Cell>}
/>
```

### Cell — komorka navbara/headera

```tsx
<Cell label>tekst</Cell>              // etykieta (flex-1, uppercase, muted)
<Cell onClick={fn}><Icon /></Cell>    // przycisk (btn-ghost btn-sm btn-square)
```

## Manifest — pola

```ts
{
  id: string           // unikalny identyfikator
  label: string        // nazwa wyswietlana w UI
  description: string  // krotki opis
  alwaysOn?: boolean   // nie mozna wylaczyc (np. plugin-manager)
  defaultEnabled?: boolean  // domyslnie wlaczony (default: true)
}
```

## Design system — obowiazkowe klasy

### Tekst

| Rola | Klasa |
|------|-------|
| tresc | `text-xs` (12px) |
| meta/detale | `text-2xs` (10px) |
| tytul | `text-2xl font-black` |

### Kolor tekstu

| Rola | Klasa |
|------|-------|
| ghost | `text-base-content/20` lub `/25` |
| muted | `text-base-content/30` lub `/40` |
| secondary | `text-base-content/50` |
| normal | `text-base-content/70` |
| brand | `text-primary` |
| status | `text-success` / `text-error` / `text-warning` |

### Tla i obramowania

| Rola | Klasa |
|------|-------|
| powierzchnia | `bg-base-100` |
| zaglebianie | `bg-base-200` |
| element | `bg-base-300` |
| obramowanie | `border-base-300` — zawsze |
| separator | `border-t border-base-300` |

### Spacing

| Gdzie | Klasa |
|-------|-------|
| padding | `px-3 py-2` (ciasno) / `p-3` / `p-4` |
| gap | `gap-1` (toolbar) / `gap-2` (form) |

### Wysokosci

| Element | Klasa |
|---------|-------|
| wiersz listy | `h-8` |
| navbar/toolbar | `h-10 min-h-10` |
| footer | `h-10 min-h-10` |

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
| toggle | `toggle toggle-xs toggle-primary` |
| element listy | `h-8 px-2 rounded-md hover:bg-base-200 text-xs text-base-content/70` |
| label sekcji | `text-2xs uppercase tracking-wider text-base-content/25 font-medium` |

### Zasady

- Uzywaj TYLKO klas z tabel wyzej
- Zero wlasnych px/rem — tylko Tailwind z tabeli
- Jeden border-color: `border-base-300`
- Opacity tekstu: `/20`, `/25`, `/30`, `/40`, `/50`, `/70`
- Motyw: dracula (dark) / corporate (light) — DaisyUI

## Rejestracja pluginu w aplikacji

W `main.tsx`:

```tsx
import myPlugin from './plugins/my-plugin'

myPlugin(SDK, deps)
markReady('my-plugin')
```

## Checklist przed oddaniem

- [ ] `sdk.registerManifest()` z unikalnym `id`
- [ ] `export default` funkcji `PluginFactory`
- [ ] Sloty to osobne komponenty (nie inline JSX w addFilter)
- [ ] Wspolny stan przez Context (wrapper), nie module-level variables
- [ ] Dane przez `deps.host` (opfs/db), nie wlasny localStorage (chyba ze celowo)
- [ ] Klasy CSS z design system, nie wymyslone
- [ ] Plugin nie importuje z `app/src/` — tylko sdk, deps, components/Box
