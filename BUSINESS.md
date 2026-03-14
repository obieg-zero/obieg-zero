# Obieg-Zero

Lokalny RAG builder. Vibe developer sklada bloki w pipeline dopasowany do konkretnego typu dokumentow, testuje jakosc, pakuje w plugin dla klienta.

## Model

```
Vibe dev → Playground (blokowy RAG builder) → testuje na dokumentach → Claude Code → plugin → klient
```

- **Playground** — narzedzie deva. Blokowy canvas (React Flow) gdzie dev sklada pipeline z rozgalezieniami per typ dokumentu. Kazdy typ ma inny chunkSize, inne pytania, inny topK — bo Bielik wymaga customizacji per typ.
- **Plugin** — produkt dla klienta. Uproszczony UI, batch processing, eksport. Klient nigdy nie widzi Playground.
- **Lokalnie** — Bielik 1.5B Q4 WASM, zero cloud. Argument dla klientow z wrazliwymi danymi.

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
