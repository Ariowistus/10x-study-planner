# Weryfikacja projektu do certyfikatu Builder

Data audytu: **13 września 2026**. Projekt: **10x Study Planner**.

Wydanie z 13 września obejmuje opisane poniżej poprawki. Publikacja odbywa się
przez osobny workflow po pozytywnym CI. Aktualny stan i identyfikator wdrożonego
commitu są dostępne w [historii wdrożeń](https://github.com/Ariowistus/10x-study-planner/actions/workflows/deploy.yml).

## Aktualizacja produktu: dwa widoki

Na życzenie użytkownika przygotowano zmianę na **Realizacja + Kalendarz**.
Nowy scenariusz zaliczeniowy: dodaj Angielski o 09:00 i 14:00 w kalendarzu,
edytuj godzinę/czas, odhacz jeden wpis w Realizacji (50%), cofnij ukończenie
i usuń wpis. Pokaż odrzucenie kolizji godzin oraz brak danych innego konta.

CRUD dotyczy teraz zajęć kalendarza. Logika biznesowa obejmuje atomową realizację,
postęp liczony z rzeczywistych wpisów i blokowanie nakładających się godzin,
także przy równoczesnym zapisie. Oryginalny algorytm pozostaje w kodzie i testach.
Wymagania kontroli dostępu, artefaktów oraz CI nie zmieniają się.

Zmiana wymaga migracji 20260913150000_calendar_times.sql przed publikacją.
Stan weryfikacji i wdrożenia tej aktualizacji: [raport zmiany](../context/changes/calendar-first/change.md).

Dalsza część tego dokumentu to audyt poprzedniego wydania 7199712; jego liczby
testów, opis ekranów i przykłady prezentacji są historyczne.

## Wniosek

Projekt spełnia **sześć wymagań technicznych Buildera opisanych w dostępnych
materiałach kursu**. Istnienie funkcji sprawdzono w kodzie, a kluczowe przepływy
uruchomiono w testach na prawdziwej bazie Supabase.

To ocena techniczna, nie decyzja certyfikacyjna organizatorów. Nie udostępniono
końcowego formularza zgłoszeniowego, więc jego dodatkowych pól, oświadczeń,
wymogu nagrania ani dokładnej godziny zamknięcia nie zweryfikowano.
Odznaki Architect i Champion nie są objęte tym audytem i nie są wymagane do
podstawowego Buildera według lekcji modułu 4.

## Źródła wymagań

- Lokalny eksport materiałów Przeprogramowani.pl, lekcja **[4.2] Dobry i zły
  projekt kursowy**, sekcja „Co musi mieć projekt zaliczeniowy”, wyeksportowana
  10 września 2026. Plik znajduje się obok repozytorium w katalogu
  `10xdevs3 kurs/00_Prework/42-dobry-i-zly-projekt-kursowy.md`.
- Lekcja **Skalowanie kontekstu dla AI w dużych projektach**, moduł 4: Builder
  opiera się na modułach 1–3; CRUD, logika biznesowa i zestaw testów pokrywający
  ryzyko z test planu. Moduły 4–5 są opcjonalne dla tej ścieżki.
- Prework podaje trzeci termin zgłoszeń: **14 września 2026**, informacja zwrotna
  do **30 września 2026**. Nie podaje godziny zamknięcia.

Materiały kursowe nie są dołączane do publicznego repozytorium.

## Kryteria i dowody

| Kryterium                                        | Ocena     | Dowód                                                                                                                                                                                                             |
| ------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kontrola dostępu                                 | Spełnione | Rejestracja, logowanie i wylogowanie; middleware chroni Plan, Tematy i Kalendarz. API sprawdza użytkownika. Cztery tabele mają RLS z polityką właściciela. Testy ochrony tras i oddzielenia kont przechodzą.      |
| Tworzenie, odczyt, aktualizacja, usuwanie danych | Spełnione | Tematy mają pełny CRUD: tytuł, szacowany czas, priorytet, termin. Nowy test edycji potwierdza zapis po odświeżeniu; dotychczasowy test potwierdza usunięcie.                                                      |
| Logika biznesowa                                 | Spełnione | Algorytm rozdziela czas według ważności, pozostałej pracy i terminu, respektując budżet dnia. Dzieli duże tematy, pomija dni bez czasu i uwzględnia ukończoną pracę przy ponownym generowaniu.                    |
| Artefakty projektowe i kontekst dla AI           | Spełnione | PRD, stack, infrastruktura, roadmapa, test plan, lessons, AGENTS.md, CLAUDE.md oraz plan i review zmiany S-02 znajdują się w repozytorium.                                                                        |
| Test przepływu użytkownika / test ryzyka         | Spełnione | 27 scenariuszy E2E na prawdziwym Supabase. Główny przepływ: rejestracja → dostępność → temat → plan → ukończenie → postęp. 58 testów jednostkowych obejmuje planowanie i daty oraz nowe zabezpieczenia i eksport. |
| CI/CD budujące aplikację i uruchamiające testy   | Spełnione | `.github/workflows/ci.yml`: lint, typy, coverage, build Node i Cloudflare oraz Playwright z lokalnym Supabase. Osobny workflow wdrażający i działający publiczny adres.                                           |

Najważniejsze pliki dowodowe:

- [PRD](../context/foundation/prd.md), [test plan](../context/foundation/test-plan.md),
  [roadmapa](../context/foundation/roadmap.md).
- [Algorytm planowania](../src/domain/scheduler.ts),
  [testy algorytmu](../src/domain/scheduler.test.ts).
- [Główne E2E](../e2e/planner.spec.ts), [edycja tematu](../e2e/seed.spec.ts),
  [skupienie i eksport](../e2e/focus-session.spec.ts),
  [spójność postępu](../e2e/completed-session.spec.ts).
- [Polityki dostępu i atomowa aktualizacja postępu](../supabase/migrations/20260910120000_initial_schema.sql).
- [CI](../.github/workflows/ci.yml), [deploy](../.github/workflows/deploy.yml).

## Weryfikacja wykonana 13 września

| Sprawdzenie                             | Wynik                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Istniejący zestaw przed zmianami        | 51 unit, 24 E2E, lint: pozytywny                                                                                                    |
| Testy jednostkowe po zmianach           | 58/58 pozytywnych                                                                                                                   |
| Pokrycie kodu domeny                    | 99,09% instrukcji; 92,3% gałęzi; 100% funkcji; 99,02% linii                                                                         |
| Pełny przebieg na świeżym buildzie Node | 27/27 testów funkcjonalnych; dodatkowo dwa przebiegi do zrzutów ekranu                                                              |
| Kontrola celowego uszkodzenia           | Wyłączenie zapisu edycji, błędny czas minutnika i usunięcie ochrony kasowania: 3/3 testów wykryło właściwe usterki; kod przywrócono |
| Build Node                              | Pozytywny                                                                                                                           |
| Build Cloudflare                        | Pozytywny lokalnie, bez publikacji                                                                                                  |
| Kontrola typów                          | 0 błędów, 0 ostrzeżeń; 8 wskazówek z konfiguracji ESLint i wygenerowanego raportu coverage                                          |
| Środowisko lokalne                      | Windows, Node 24.19.0; repozytorium i CI deklarują Node 22                                                                          |

Pokrycie dotyczy `src/domain/`, nie całej aplikacji. Testy nie stanowią pełnego
audytu bezpieczeństwa ani testu obciążeniowego.

Końcowy lint zakończył się pozytywnie. Komunikaty parsera Astro są informacyjne.
Przejrzano zrzuty ekranu przy szerokości 1280 i 390 pikseli, w jasnym i ciemnym
motywie. Kalendarz miesięczny na telefonie przewija się wewnątrz swojego panelu.

Wydanie kodu aplikacji: `71997128775f43ecb7af1c45774b4c5d3033e5e5`.
[CI tego wydania](https://github.com/Ariowistus/10x-study-planner/actions/runs/34760786381)
zakończyło się pozytywnie na Linux i Node 22: lint, typy, 58 testów jednostkowych,
27 testów E2E oraz oba buildy. Testy E2E korzystały z osobnej bazy uruchomionej
w GitHub Actions ze wszystkimi migracjami repozytorium.
[Przebieg wdrożenia tego samego commitu](https://github.com/Ariowistus/10x-study-planner/actions/runs/34761001144).

## Ulepszenia przygotowane do oddania

- Panel następnej sesji, minutnik skupienia z pauzą/resetem i podsumowanie nauki.
- Eksport zapisanych sesji tygodnia do `.ics`, bez ujawniania danych innych kont.
  Format na podstawie [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html):
  daty całodniowe, CRLF, escaping i zawijanie do 75 bajtów UTF-8.
- Wyszukiwanie tematów i filtrowanie: wszystkie, do nauki, ukończone.
- Pełna nawigacja, szerszy plan, lepszy kontrast i układ na małym ekranie.
- Odrzucanie nieistniejących dat, np. 29 lutego 2026; błędne daty w URL nie
  powodują już awarii widoku.
- Ręcznie wpisana sesja rezerwuje także pracę tematu, aby algorytm nie planował
  tych samych minut ponownie.
- Ukończoną sesję trzeba najpierw cofnąć, zanim zostanie usunięta. Cofnięcie
  przechodzi przez atomową funkcję bazy, więc nie zostają fikcyjne postępy.
- README wskazuje teraz wszystkie migracje potrzebne do uruchomienia kalendarza.

## Granice działania istotne podczas prezentacji

- Plan przeliczasz przyciskiem „Przelicz plan”. Zmiana statusu zapisuje postęp,
  ale nie przelicza automatycznie wszystkich przyszłych tygodni.
- Minutnik jest lokalny i resetuje się przy zmianie strony. Zakończenie
  odliczania nie zalicza nauki; osobny przycisk zapisuje całą sesję.
- Eksport jest jednorazowym plikiem; nie synchronizuje kalendarzy. Wydarzenia
  są całodniowe, z czasem nauki w tytule, bo aplikacja nie przechowuje godzin.
- Ręczne sesje można dodawać ponad budżet. Automatyczny generator respektuje
  pozostałą po nich dostępność.
- Dzień bieżący wyznacza zegar serwera, nie strefa użytkownika.
- Regeneracja tygodnia składa się z kilku operacji bazy i nie jest jedną
  transakcją. Testy obejmują zwykły przebieg, nie awarie pomiędzy zapisami ani
  równoczesne generowanie w wielu kartach.
- Potwierdzanie e-maili jest wyłączone w projekcie demonstracyjnym zgodnie z PRD.

## Scenariusz demonstracji, około 3 minut

1. Utwórz osobne konto demonstracyjne i zaloguj się.
2. Wejdź w „Tematy”: ustaw 60 minut w poniedziałek i wtorek, pozostałe dni 0.
3. Dodaj „Powtórka sieci”, 120 minut, priorytet 4. Zmień nazwę, zapisz i odśwież,
   żeby pokazać rzeczywistą aktualizację danych.
4. Otwórz „Plan”, przejdź do przyszłego tygodnia i wygeneruj plan. Powinny być
   dwie sesje po 60 minut, a dni bez dostępności pozostaną wolne.
5. Uruchom, zatrzymaj i zresetuj minutnik. Pobierz eksport `.ics`.
6. Oznacz jedną sesję jako zrobioną: zobacz godzinę ukończonej nauki i 50% postępu.
7. Przelicz plan: ukończona sesja zostaje. W kalendarzu można dodać ręczny blok.
8. W „Tematach” wyszukaj temat, a na końcu usuń demonstracyjny temat, pokazując
   ostatnią operację CRUD. Wyloguj się.

## Dane do formularza

- Nazwa: **10x Study Planner**.
- Repozytorium: [Ariowistus/10x-study-planner](https://github.com/Ariowistus/10x-study-planner).
- Aplikacja: [10x Study Planner](https://10x-study-planner.ariowistus.workers.dev).
- Logika biznesowa: „Aplikacja rozdziela dostępne minuty nauki pomiędzy tematy
  według priorytetu, pozostałej pracy i terminu, a przy ponownym generowaniu
  uwzględnia ukończone i ręcznie zaplanowane sesje”.
- Opis: „Planer nauki dla osób przygotowujących się do egzaminu. Użytkownik
  zarządza tematami, określa dostępność, generuje plan tygodnia i zapisuje postęp.
  Projekt zawiera dokumentację procesu pracy z AI, testy jednostkowe i E2E oraz
  pipeline budowania i testowania”.

Przed wysłaniem sprawdź, że zgłaszasz właściwą wersję repozytorium, że publiczna
aplikacja zawiera funkcje opisane w zgłoszeniu, i uzupełnij rzeczywiste pola
formularza organizatorów. Ten audyt nie wysyła zgłoszenia.
