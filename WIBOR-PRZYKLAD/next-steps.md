# Kolejne kroki: halucynacje i złe pytania

Dwa główne problemy z benchmarku (bielik-benchmark.md):
1. Złe pytania → złe odpowiedzi (50-75% accuracy)
2. Halucynacje → model wymyśla wartości których nie ma w tekście (Bank Millennium zamiast BGŻ)

## Problem 1: Złe pytania → tryb strojenia szablonu

**Obserwacja:** Nie wiemy jakie pytania (sentence starters) zadziałają na danym typie dokumentu dopóki nie spróbujemy. Pytanie "Jaki bank?" daje definicję, "Nazwa banku to" daje halucynację, a może "W tekście wymieniony bank to" da poprawną odpowiedź. Nie da się tego zgadnąć — trzeba testować.

**Pomysł:** Po etapie Embed (chunki + wektory gotowe) dodać tryb ręcznego testowania pytań:
- Użytkownik wpisuje pytanie/starter
- System robi search → pokazuje trafione chunki
- LLM odpowiada na żywo
- Użytkownik widzi: chunk (IN) → odpowiedź (OUT) → ocenia czy OK
- Jeśli OK → dodaje pytanie do szablonu
- Jeśli nie → zmienia sformułowanie i próbuje ponownie

To jest preproces strojenia szablonu ZANIM uruchomimy pełny Extract na wszystkich pytaniach. Koszt: kilka ręcznych prób (~50s każda). Zysk: szablon dostrojony do konkretnego typu dokumentu.

**Flow:**
```
Upload → Parse → Embed → [STROJENIE: ręczne pytania + podgląd] → Extract → Graph
```

Strojenie to jednorazowy koszt per typ dokumentu. Raz dostrojony szablon (lista pytań) działa na wszystkich dokumentach tego samego typu.

## Problem 2: Halucynacje → walidacja odpowiedzi przez search

**Obserwacja:** Bielik wymyślił "Bank Millennium" — ta nazwa NIE ISTNIEJE w żadnym chunku. Gdybyśmy po odpowiedzi LLM zrobili search po chunkach szukając tej odpowiedzi, score byłby niski → wiemy że to halucynacja.

**Pomysł:** Po każdej odpowiedzi LLM:
1. Weź odpowiedź (np. "Bank Millennium")
2. Zrób semantic search w tych samych chunkach
3. Sprawdź najwyższy score
4. Jeśli score < próg → oznacz jako niepewne/halucynacja
5. Jeśli score > próg → odpowiedź potwierdzona przez tekst źródłowy

```
pytanie → search → chunk → LLM → odpowiedź → search(odpowiedź) → score
                                                  ↓
                                        score > 0.8 → ✓ potwierdzone
                                        score < 0.8 → ⚠ możliwa halucynacja
```

**Kluczowe:** To NIE kosztuje dodatkowego LLM. Search jest darmowy (embedding już istnieje). Jedyny koszt to jeden dodatkowy embed() na odpowiedź — milisekundy.

**Warianty:**
- **Cichy:** oznacz halucynacje w grafie (node.data.confidence = score), pokaż w UI
- **Filtrujący:** nie dodawaj do grafu jeśli score < próg
- **Informacyjny:** pokaż użytkownikowi "⚠ odpowiedź nie znaleziona w tekście"

## Priorytet

1. **Walidacja przez search** — łatwa do implementacji (mamy search, mamy embed), zero dodatkowego kosztu LLM, natychmiastowa poprawa jakości grafu
2. **Strojenie szablonu** — wymaga UI (panel testowy), ale daje największy wpływ na jakość pytań

Oba rozwiązania się uzupełniają: strojenie poprawia pytania, walidacja łapie resztę błędów.
