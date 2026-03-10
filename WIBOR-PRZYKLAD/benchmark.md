# Benchmark: ekstrakcja faktów z umowy kredytowej w przeglądarce

## O projekcie

[obieg-zero](https://github.com/obieg-zero/obieg-zero) — browser-native document analysis workbench. Zero backend, zero API, zero cloud. Cały pipeline (OCR, embedding, LLM, graf wiedzy) działa w przeglądarce przez WASM.

## Setup

- **Dokument testowy:** symulowana umowa kredytu hipotecznego (1363 znaków, 5 paragrafów)
- **Pipeline:** Upload → Parse → Embed → Extract → Graph
- **Embedding:** Xenova/multilingual-e5-small (q8, WASM) — semantic search po chunkach
- **Metoda Extract:** lista pytań (sentence starters) → semantic search → LLM na najlepszych chunkach → graf wiedzy
- **Chunking:** 200 znaków, 8 chunków z dokumentu
- **topK:** 2 chunki na pytanie = 16 wywołań LLM

## Modele

| Model | Runtime | nCtx | nPredict | temp |
|---|---|---|---|---|
| **Bielik-1.5B-v3.0-Instruct Q4_K_M** | wllama WASM (przeglądarka) | 512 | 16 | 0 |
| GPT-4o-mini (referencja) | OpenAI API | — | 50 | 0 |

## Pytania (sentence starters)

```
Nazwa banku to
Kwota kredytu wynosi
Marża banku wynosi
Stawka WIBOR wynosi
Umowę podpisano dnia
Okres kredytu to
Miesięczna rata wynosi
Kredytobiorca to
```

Prompt: `Dokoncz zdanie na podstawie tekstu.\n\nTekst: "{{chunk}}"\n\n{{starter}}`

## Prawidłowe odpowiedzi (z dokumentu)

| Fakt | Wartość |
|---|---|
| Bank | Bank Gospodarki Żywnościowej S.A. |
| Kwota | 280.000,00 PLN |
| Marża | 1,85% |
| WIBOR 3M | 4,72% |
| Data umowy | 15 marca 2009 |
| Okres | 360 miesięcy (30 lat) |
| Rata | 1.789,23 PLN |
| Kredytobiorca | Jan Kowalski |

## Wyniki

### Bielik 1.5B — pytania wprost ("Jaki bank udzielił kredytu?")

| Pytanie | Najlepsza odpowiedź | ✓/✗ |
|---|---|---|
| Bank | "Bank udzielił kredytu hipotecznego." | ✗ nie podaje nazwy |
| Kwota | **280.000 PLN** | ✓ |
| Marża | definicja marży | ✗ |
| WIBOR | definicja WIBOR | ✗ |
| Data | **15 marca 2009** | ✓ |
| Okres | **30 lat** | ✓ |
| Rata | **1.789,23 PLN** | ✓ |
| Kredytobiorca | "Kredytobiorca." | ✗ |

**4/8 (50%) · 880s · 55s/wywołanie**

### Bielik 1.5B — sentence starters ("Nazwa banku to")

| Starter | Najlepsza odpowiedź | ✓/✗ |
|---|---|---|
| Bank | "Bank Millennium" | ✗ HALUCYNACJA |
| Kwota | **280.000,0** | ✓ |
| Marża | **1,85%** | ✓ |
| WIBOR | 1,85% (myli z marżą) | ✗ |
| Data | **15 marca** | ✓ |
| Okres | **360 miesięcy (30 lat)** | ✓ |
| Rata | **1.789,23 PLN** | ✓ |
| Kredytobiorca | **Jan Kowalski** | ✓ |

**6/8 (75%) · 841s · 53s/wywołanie**

### GPT-4o-mini (referencja API)

| Starter | Najlepsza odpowiedź | ✓/✗ |
|---|---|---|
| Bank | "nie została podana w tekście" | ✗ uczciwa odmowa |
| Kwota | **280.000,00 PLN** | ✓ |
| Marża | **1,85%** | ✓ |
| WIBOR | **4,72%** | ✓ |
| Data | **15 marca 2009 roku** | ✓ |
| Okres | **30 lat** | ✓ |
| Rata | **1.789,23 PLN** | ✓ |
| Kredytobiorca | **Jan Kowalski, zamieszkały w Krakowie** | ✓ |

**7/8 (88%) · 18s · 1.1s/wywołanie**

## Porównanie

| Metryka | Bielik pytania | Bielik starters | GPT-4o-mini |
|---|---|---|---|
| **Poprawność** | 4/8 (50%) | 6/8 (75%) | 7/8 (88%) |
| **Halucynacje** | 0 | 2 | 0 |
| **Czas total** | 880s | 841s | 18s |
| **Czas/wywołanie** | 55s | 53s | 1.1s |
| **Koszt** | 0 (lokalnie) | 0 (lokalnie) | ~$0.001 |

## Obserwacje o Bieliku 1.5B

### Co działa dobrze
- **Liczby:** kwota (280k), rata (1789), okres (30 lat), data (15 marca 2009) — Bielik dobrze kopiuje wartości liczbowe z tekstu
- **Sentence starters** znacząco poprawiają wyniki (75% vs 50%) — model lepiej dokańcza zdanie niż odpowiada na pytanie
- **Embedding search** trafia we właściwe chunki (score 0.92-0.99) — infrastruktura RAG działa poprawnie

### Co nie działa
- **Nazwy własne:** nie potrafi wyciągnąć "Bank Gospodarki Żywnościowej" — halucynuje inne nazwy banków
- **Podobne wartości:** myli WIBOR (4,72%) z marżą (1,85%) — oba są procentami w tym samym paragrafie
- **Pytania wprost:** na "Jaki bank?" odpowiada definicją lub parafrazą zamiast podać nazwę

### Wnioski
1. Bielik 1.5B Q4 w WASM nadaje się do ekstrakcji wartości liczbowych z polskich dokumentów prawnych
2. Sentence starters > pytania — ale wprowadzają ryzyko halucynacji nazw własnych
3. Problem "bank" to nie wina modelu — chunk z pełną nazwą banku nie został trafiony przez search (problem chunkingu/embeddingu)
4. Przy ~53s/wywołanie i 16 wywołaniach na dokument — pipeline trwa ~14 minut. Akceptowalne dla analizy jednorazowej, za wolne do iteracyjnej pracy
5. GPT-4o-mini jako referencja potwierdza że pipeline RAG jest poprawny (7/8) — wąskie gardło to model, nie architektura

## Pomysły na poprawę

1. **Walidacja odpowiedzi przez search** — po odpowiedzi LLM, szukamy jej w chunkach. Niski score = halucynacja. Koszt: zero LLM, jeden embed.
2. **Strojenie szablonu** — tryb ręcznego testowania pytań przed pełnym Extract. Jednorazowy koszt per typ dokumentu.
3. **Większe chunki** — 400 zn zamiast 200 — więcej kontekstu, mniej ryzyka że nazwa banku jest w innym chunku niż reszta danych.

Szczegóły w [next-steps.md](./next-steps.md).
