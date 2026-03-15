# Obieg-Zero

Lokalny RAG builder. Vibe developer sklada bloki w pipeline dopasowany do konkretnego typu dokumentow, testuje jakosc, pakuje w plugin dla klienta.

## Status: PROTOTYP → v1.0

Projekt jest w fazie prototypu. Cel: zamknac v1.0 i dostarczyc pierwszego klienta.

### Co jest GOTOWE

- [x] Pakiety (store, ocr, embed, llm, graph) — pure functions, handle pattern, dzialaja
- [x] Plugin SDK — micro-framework, lifecycle, layout sloty, hooki
- [x] Shell — layout (2 tematy: sidebar + stack), error boundary, plugin switching
- [x] UIKit (themes/) — Box, Cell, Bar, ListItem, Field, Tabs — wspolny dla pluginow
- [x] Playground canvas — React Flow, DAG, topoSort, drag & drop blokow
- [x] Bloki: Upload, Parse, Embed, Filter, Extract (WASM + API), Graph
- [x] Pipeline execution — snapshot config, topological sort, async loop
- [x] Pipeline persistence — auto-save/load do Dexie per projekt
- [x] Pipeline export — `exportPipeline()` pobiera JSON (nodes + edges + config)
- [x] DAG branching — rozne pipeline per typ dokumentu (WIBOR use case)
- [x] Templates — 4 seed templates (wibor, wibor-full, wibor-filter, faktura-gaz)
- [x] Config-export — eksport config.json (ktore pluginy + defaultPlugin)
- [x] Config-import — main.tsx czyta config.json przy starcie → ustawia profil
- [x] Installer — instalacja pluginow z GitHub/ZIP do OPFS + auto-load przy starcie
- [x] Plugin manager — UI do wlaczania/wylaczania/instalacji pluginow
- [x] Benchmark — 8 pytan, prawidlowe odpowiedzi, Bielik 75% vs GPT-4o-mini 88% (`samples-docs/wibor/benchmark.md`)
- [x] Prawdziwe dokumenty testowe — Umowa kredytu.pdf, umowa BGŻ.pdf, Plan splat.pdf, wibor3m.csv
- [x] Analiza bledow — halucynacje nazw wlasnych, mylenie podobnych wartosci (`samples-docs/wibor/next-steps.md`)
- [x] Blok Validate — walidacja halucynacji przez search. Config: minConfidence, onFail (mark|skip|log). Wszystkie templates zaktualizowane: Extract → Validate → Graph.

### Co BRAKUJE do v1.0 (w kolejnosci priorytetow)

1. **Optymalizacja promptow** — z 75% na 90%+. Benchmark juz jest (`samples-docs/wibor/benchmark.md`, 6/8 na test-mini.txt). Iteracja: wieksze chunki, lepsze starters, topK tuning. Testowac na prawdziwych PDF-ach (`Umowa kredytu.pdf`, `umowa BGŻ.pdf`). Teraz z blokiem Validate mozna mierzyc confidence per odpowiedz.
2. **Pierwszy plugin kliencki** — "Kalkulator WIBOR". Claude Code generuje go z `exportPipeline()` JSON. Uproszczony UI, batch processing, eksport wynikow.
3. **Batch processing + eksport w pluginie** — wrzuc folder dokumentow, odpal pipeline na wszystkich, eksportuj wyniki (CSV/JSON).

### Definicja DONE dla v1.0

- Kalkulator WIBOR dziala na prawdziwych dokumentach prawnika
- Poprawnosc extractu >= 90% na benchmarku
- Klient wrzuca pliki → dostaje graf + eksport, bez wiedzy o Playground
- Zero cloud, zero API keys, dziala offline na laptopie

## Model

```
Vibe dev → Playground (blokowy RAG builder) → testuje na dokumentach → Claude Code → plugin → config-export → klient
```

- **Playground** — narzedzie deva. Blokowy canvas (React Flow) gdzie dev sklada pipeline z rozgalezieniami per typ dokumentu. Kazdy typ ma inny chunkSize, inne pytania, inny topK — bo Bielik wymaga customizacji per typ.
- **Plugin** — produkt dla klienta. Uproszczony UI, batch processing, eksport. Klient nigdy nie widzi Playground.
- **Config-export** — dev wlacza tylko pluginy klienckie (np. WIBOR), wylacza Playground, eksportuje `config.json`. Apka klienta startuje z tym configiem i widzi tylko swoj plugin.
- **Lokalnie** — Bielik 1.5B Q4 WASM, zero cloud. Argument dla klientow z wrazliwymi danymi.

### Flow dostarczenia pluginu klientowi

```
1. Dev buduje pipeline w Playground (bloki, polaczenia, parametry)
2. Dev eksportuje pipeline jako JSON (exportPipeline — JUZ DZIALA)
3. Claude Code generuje plugin kliencki z tego JSON
4. Dev testuje plugin w plugin-manager (instalacja z GitHub/ZIP — JUZ DZIALA)
5. Dev wlacza plugin kliencki, wylacza Playground/notes/plugin-manager
6. Dev eksportuje config.json (config-export — JUZ DZIALA)
7. Apka klienta = ten sam kod + config.json → widzi tylko plugin WIBOR
```

Caly tooling dostarczenia (eksport pipeline, installer, config-export, config-import) JUZ ISTNIEJE.
Benchmark istnieje (`samples-docs/wibor/benchmark.md`), wynik: 75% na test-mini.txt.
Brakuje: optymalizacja promptow (75%→90%) + sam plugin kliencki.

## Ograniczenia modelu

- nCtx: 512 tokenow, rozumie jeden akapit
- ~50s/wywolanie
- Sentence starters zamiast pytan ("stawka WIBOR wynosi" nie "jaka jest stawka WIBOR?")
- 75% poprawnosci na pierwszy strzal, do 95% po iteracji promptow
- DLATEGO customizacja per typ dokumentu jest konieczna — jeden pipeline dla wszystkiego nie dziala

## Przyklad: Kalkulator WIBOR

Prawnik przynosi 7 typow dokumentow:

```
Upload (Umowa kredytu)     → Embed(200) → Extract(bank, WIBOR, marza, kwota, data)
Upload (Aneksy)            → Embed(150) → Extract(nowa stawka, data zmiany)
Upload (Zaswiadczenie)     → Embed(300) → Extract(saldo, historia oprocentowania)
Upload (ESIS)              → Embed(200) → Extract(RRSO, calkowity koszt)
Upload (Wezwanie)          → Embed(200) → Extract(kwota roszczenia, data)
Upload (Potwierdzenie)     → Embed(150) → Extract(data nadania, adresat)
Upload (Historia splat)    → Embed(500) → Extract(raty, daty, saldo)
                                    ↓ wszystko
                                  Validate(0.8)
                                    ↓
                                  Graph
```

Kazdy typ dokumentu ma inny chunkSize, inne pytania, inny topK — bo umowa kredytu to inny tekst niz tabela splat. Dev sklada to w Playground, testuje pytania na przykladowych dokumentach, iteruje az jakosc jest OK. Potem Claude Code pisze plugin "Kalkulator WIBOR" z tym pipeline.

## Co bloki musza robic

- **Upload** — wrzuca pliki i taguje je typem dokumentu (np. "umowa", "aneks", "historia splat")
- **Parse** — PDF/CSV/TXT → strony tekstu. Operuje na grupie dokumentow (po tagu), nie na calym projekcie.
- **Embed** — strony → chunki + wektory. Customizacja: chunkSize, model, overlap. Per grupa.
- **Extract** — pytania (sentence starters) → search → LLM → odpowiedzi. Customizacja: pytania, topK, nPredict, temperature. Per grupa. Dev musi widziec: chunk, prompt, odpowiedz, czas.
- **Graph** — zbiera wyniki ze wszystkich galezi w jeden graf wiedzy.

## Co dev musi widziec w Playground

1. **Canvas** — rozgaleziony pipeline (DAG), nie linia. React Flow juz to obsluguje (topoSort).
2. **Per blok** — co blok wyprodukował (chunki, wyniki extractu, graf)
3. **W Extract** — jaki chunk search wybral, jaki prompt poszedl do LLM, jaka odpowiedz, ile sekund
4. **Szybka iteracja** — odpal 1 pytanie na 1 dokumencie w 50s, nie caly pipeline w 13 min
5. **Historia** — porownaj wynik przed i po zmianie pytania/chunkSize

## Pakiety (klocki)

```
store-v2  — OPFS pliki + Dexie dane (szyna)
ocr-v2    — PDF → strony tekstu
embed-v2  — tekst → chunki + wektory + search
llm-v2    — prompt → odpowiedz (lokalny GGUF)
graph-v2  — encje + relacje (graf na Dexie)
```

Pakiety sa OK — pure functions + handle pattern. Bloki w Playground uzywaja ich przez deps.host.

## Zasady zamykania projektu

1. **Nie dodawaj nowych ficzerow** — zamykaj istniejace. Kazda nowa funkcja oddala od v1.0.
2. **Benchmark first** — zanim optymalizujesz, zmierz. Zanim zmienisz prompt, odpal benchmark.
3. **Jeden plugin, nie framework** — cel to "Kalkulator WIBOR", nie "uniwersalny system pluginow". Framework juz jest, teraz produkt.
4. **Prawdziwe dokumenty** — testuj na dokumentach prawnika, nie na test-mini.txt.
5. **Shipping > perfect** — 90% poprawnosci wystarczy. 95% to iteracja po v1.0.
