# Bielik 1.5B Q4 WASM — benchmark ekstrakcji faktów

## Setup
- Model: Bielik-1.5B-v3.0-Instruct Q4_K_M GGUF
- Runtime: wllama WASM w przeglądarce (Chrome, localhost)
- nCtx: 512, nPredict: 16, temperature: 0
- Dokument: test-mini.txt (umowa kredytu hipotecznego, 1363 zn, 8 chunków po 200 zn)
- Metoda: pytanie → semantic search (top 2 chunki) → LLM na każdym chunku
- Embedding: Xenova/multilingual-e5-small (q8, WASM)

## Test 1: pytania wprost (2026-03-10)
Czas: 880s (16 wywołań, ~55s/wywołanie)

| Pytanie | Odpowiedź 1 | Odpowiedź 2 | Poprawna? |
|---|---|---|---|
| Jaki bank udzielił kredytu? | Bank udzielił kredytu hipotecznego. | Bank udzielił kredytu Janowi Kowalskiemu. | ✗ (nie podaje nazwy BGŻ) |
| Jaka jest kwota kredytu w PLN? | Kwota kredytu w PLN: 1.789,23 | **280.000 PLN** | ✓/✗ (1 z 2) |
| Jaka jest marża banku w procentach? | definicja marży | definicja marży | ✗ (nie podaje 1,85%) |
| Jaki jest WIBOR w procentach? | definicja WIBOR | definicja WIBOR | ✗ (nie podaje 4,72%) |
| Kiedy podpisano umowę kredytu? | **15 marca 2009** | **15 marca 2009** | ✓✓ |
| Na ile lat udzielono kredytu? | **30 lat** | Kredyt udzielono na 15 lat. | ✓/✗ (1 z 2) |
| Jaka jest miesięczna rata w PLN? | **1789,23 PLN** | **1.789,2** PLN | ✓✓ |
| Kto jest kredytobiorcą? | Kredytobiorca. | Kredytobiorca. | ✗ (nie podaje Jan Kowalski) |

**Wynik: 4/8 pytań poprawnych (50%)**

### Obserwacje
- Liczby (kwota, data, okres, rata) — Bielik kopiuje z tekstu, działa
- Nazwy (bank, kredytobiorca) — Bielik parafrazuje/powtarza pytanie zamiast podać nazwę
- Procenty (marża, WIBOR) — Bielik daje definicje encyklopedyczne zamiast wartości z tekstu
- Search score wysoki (0.92-0.99) — embedding trafia we właściwe chunki
- Prompt "Odpowiedz krotko" za słaby dla nazw i procentów

## Test 2: sentence starters (2026-03-10)
Czas: 841s (16 wywołań, ~53s/wywołanie)
Prompt: "Dokoncz zdanie na podstawie tekstu.\n\nTekst: \"{{chunk}}\"\n\nNazwa banku to"

| Starter | Odpowiedź 1 | Odpowiedź 2 | Poprawna? |
|---|---|---|---|
| Nazwa banku to | "Bank Millennium" | "Bank Spółdzielczy w Krakowie" | ✗✗ HALUCYNACJA |
| Kwota kredytu wynosi | 1789.23 PLN | **280.000,0** | ✓/✗ |
| Marża banku wynosi | **1,85%** | 2,5% | ✓/✗ |
| Stawka WIBOR wynosi | 1,85% | 1,85% | ✗✗ (to marża, WIBOR=4,72%) |
| Umowę podpisano dnia | 15.05.20... | **15 marca** | ✓/✗ |
| Okres kredytu to | **360 miesięcy (30 lat)** | **30 lat** | ✓✓ |
| Miesięczna rata wynosi | **1.789,23 PLN** | 1 850,00 zł | ✓/✗ |
| Kredytobiorca to | **Jan Kowalski** | definicja | ✓/✗ |

**Wynik: 6/8 pytań poprawnych (75%) — poprawa z 50%**

### Obserwacje
- Sentence starters lepsze niż pytania (6/8 vs 4/8)
- Liczby: Bielik kopiuje dobrze (kwota, rata, okres, data)
- Nazwy własne: albo trafia (Jan Kowalski) albo HALUCYNUJE (Bank Millennium — nie istnieje w tekście!)
- Myli podobne wartości: WIBOR 4,72% → podaje marżę 1,85%
- Sentence starter WYMUSZA odpowiedź — gdy nie znajdzie wartości, wymyśla (hallucination risk)
- Drugi chunk (topK=2) często gorszy — contradicts lub halucynuje

### Porównanie formatów
| Metryka | Pytania | Sentence starters |
|---|---|---|
| Poprawność | 4/8 (50%) | 6/8 (75%) |
| Halucynacje | 0 (daje definicje) | 2 (wymyśla nazwy) |
| Czas | 880s | 841s |
| Avg/call | 55s | 53s |

### Wniosek
Sentence starters wygrywają ale wprowadzają ryzyko halucynacji. Pytania są "bezpieczniejsze" (dają definicje zamiast wymyślać) ale mniej użyteczne. Optymalnym podejściem byłoby sentence starters + walidacja (sprawdzanie czy odpowiedź istnieje w tekście źródłowym).
