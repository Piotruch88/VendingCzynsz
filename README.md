# Kalkulator czynszu – automaty vendingowe w szkołach

Aplikacja na Windows (Electron), która na podstawie liczby uczniów wylicza minimalną i maksymalną
miesięczną stawkę czynszu (netto) za automaty vendingowe w szkole.

## Co liczy

- czynsz minimalny i maksymalny oraz stawkę wyjściową do przetargu,
- czynsz na 1 automat, za 1 m², za rok szkolny i jako 12 równych rat,
- ryczałt za energię elektryczną (rozliczany osobno),
- sugerowaną liczbę automatów (limit wydajności),
- udział czynszu w marży operatora (ostrzeżenie, gdy stawka jest zbyt wysoka dla operatorów).

Zakładka **Tabela stawek** pokazuje stawki dla szkół od 50 do 2000 uczniów, **Założenia** pozwala
zmieniać parametry modelu (zapisują się automatycznie), a **Źródła** zawiera 21 źródeł danych z linkami.

## Model

```
osoby      = uczniowie × (1 + personel %)
transakcje = min(osoby × współczynnik typu szkoły × % kupujących, automaty × wydajność)
obrót netto/mies. = transakcje × średni koszyk × dni nauki / (1 + VAT)
czynsz     = max(obrót netto × % dla szkoły, próg minimalny × automaty), zaokrąglony do 10 zł
```

Scenariusz MIN i MAX różnią się udziałem kupujących (4–7%), średnim koszykiem (5–6 zł)
i udziałem szkoły w obrocie (10–15%). Logika jest identyczna z arkuszem
[excel/Model_czynsz_vending_szkoly.xlsx](excel/Model_czynsz_vending_szkoly.xlsx); testy sprawdzają
zgodność wyników z Excelem.

## Uruchomienie

```bash
npm install
npm start          # uruchom aplikację
npm test           # testy modelu
npm run dist       # instalator + wersja portable w dist/
```

## Struktura

| Ścieżka | Zawartość |
|---|---|
| `src/model.js` | logika obliczeń i założenia domyślne |
| `src/sources.js` | lista źródeł |
| `src/main.js` | proces główny Electron |
| `src/renderer/` | interfejs (HTML, CSS, JS) |
| `test/` | testy modelu (`node --test`) |
| `excel/` | model w Excelu i skrypt Python, który go generuje |
| `build/` | ikona aplikacji |

## Uwagi

Część założeń to szacunki (udział kupujących, wydajność automatu, współczynniki typu szkoły) –
patrz zakładka Źródła. Najlepiej skalibrować je na danych z własnych automatów lub na wylicytowanych
stawkach z przetargów w regionie.
