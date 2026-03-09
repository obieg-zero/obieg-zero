# Deklaracja jakości kodu

**Data:** 2026-03-09

## Jedno źródło prawdy: task.json

Każda wartość konfiguracyjna w działającym pipeline pochodzi z task.json. Nie istnieje żadne inne źródło.

- Module settings to schema (`type` + `label`). Nie mają pola `default`. Nie generują wartości.
- `getDefaults()` zwraca pusty obiekt.
- Node'y nie mają argumentów konstruktora. Czytają wszystko przez `ctx.get()`.
- `ctx.get()` nie ma fallbacków `??` w żadnym node.
- Bez wybranego taska: panel Modules, Log, Data nie jest dostępny. Brak wartości do wyświetlenia.
- Bez `promptTemplate` w task.json: brak sekcji Query i Extract w UI.
- Bez `extractPrompt` w task.json: brak sekcji Extract w UI.

## Infrastruktura app (nie config)

Dwie wartości podawane w `flow.use()` jako overrides:

- `workerFactory` — tworzy Web Worker (wymaga `import.meta.url`, nie serializowalne do JSON)
- `wasmPaths` — ścieżki WASM wllama (wymaga `import.meta.url`, nie serializowalne do JSON)

To infrastruktura środowiska, nie parametry pipeline'u.

## Znane ograniczenia

- Brak testów jednostkowych.
- Prompt processing Bielik Q4 via WASM: minuty na słabym sprzęcie.

---

*Claude Opus 4.6, Anthropic*
