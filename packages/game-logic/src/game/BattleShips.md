# BattleShips class

- phase

Gra ma kilka faz, rozpoczyna sie od "waiting", konczy na "finished".

  - waiting - brak graczy lub pierwszy gracz dolaczyl i oczekuje na przeciwnika
    - Pierwszy gracz oznaczony jest jako `owner`
    - przejscie: do `placement`, gdy drugi gracz dolaczyl
  - placement - gracze rozmieszczaja statki
    - przejscie: do `waiting`, gdy gracz opusci gre (leave_game), lub po 60s od utraty polaczenia.
    - Gdy gracz ktory opuscil gre byl `owner`em, ostatni w grze zostaje oznaczony jako `owner`
    - przejscie: do `playing`, gdy gracze rozmieszcza swoje statki
  - playing - gracze turami atakuja statki przeciwnika
    - przejscie: do `finished`, gdy ktorys z graczy straci wszystkie swoje statki
    - przejscie: do `finished` (kapitulacja), gdy ktorys z graczy wybierze opuszczenie gry
    - przejscie: do `finished` (kapitulacja), gdy ktorys z graczy utraci polaczenie i minie 60s
  - `finished` - koniec gry, przegrany gracz moze zaproponowac rewanz
    - przejscie: do `placement`, gdy zwyciezca zaakceptowal rewanz
