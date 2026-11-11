# 0012. Poslední vzepětí (Death Throes) a prahy záporného zdraví

Date: 2026-11-11
Status: Accepted

## Context

Bojový systém Malé Strany 1648 původně uplatňoval klasické pravidlo okamžité smrti na 0 HP (alpha-strike), kdy úspěšný zásah okamžitě vyřadil nepřítele ze hry. Švédští mušketýři měli 12 HP a Arnošt Odowalsky 15 HP. Hráč tak mohl eliminovat hrozbu dříve, než nepřítel stačil reagovat, což oslabovalo historickou atmosféru zoufalého nočního boje v dešti a snižovalo význam krytí kouřem z černého prachu.

## Rozhodnutí

1. **Úprava základního zdraví nepřátel**:
   - Řadový švédský mušketýr má **8 HP** (+1 kyrys).
   - Velitel Arnošt Odowalsky má **10 HP** (+2 kyrys).
   - Zbraně obránců (těžká mušketa 12–16 HP, odlehčená mušketa 8–12 HP, karabina 7–10 HP) tak spolehlivě způsobují smrtelný zásah na 1–2 rány.

2. **Univerzální mechanika Posledního vzepětí (*Death Throes*)**:
   - Jakákoliv jednotka (švédský nepřítel i hrdina obrany Prahy), jejíž HP klesne na $\le 0$, nepadá okamžitě mrtva, nýbrž vstupuje do stavu *Poslední vzepětí*.
   - V tomto stavu má jednotka přesně **jeden dodatečný tah** plné akceschopnosti (pohyb, střelba bez postihu, overwatch, či zoufalý úder pažbou při vybití).
   - **Jediné omezení**: Umírající nepřítel má přísně zakázáno zajmout maršála Colloreda.

3. **Práh okamžité smrti (*Instant Overkill Threshold*)**:
   - Jednotka padne okamžitě mrtev bez Posledního vzepětí pouze tehdy, pokud její zdraví klesne na hodnotu rovnou zápornému maximálnímu zdraví a nižší: `hp <= -(maxHp + 1)`.
     - Švédský mušketýr (max 8 HP): $\le -9$ HP.
     - Arnošt Odowalsky (max 10 HP): $\le -11$ HP.
     - Václav z Michalovic (max 12 HP): $\le -13$ HP.
     - Jan Matěj a hrabě Colloredo (max 14 HP): $\le -15$ HP.
     - Bratr Bartoloměj (max 16 HP): $\le -17$ HP.
   - Poškození se kumuluje do záporných hodnot i při dalších zásazích do již umírající jednotky.

4. **Časování a zánik**:
   - Jednotka v Posledním vzepětí padne mrtev a její model zmizí ze scény okamžitě po vyčerpání AP na konci své vlastní aktivace.
   - V Misi 1 neexistuje polní léčení ze záporných HP; smrt je neodvratná.

5. **Dopady na maršála a vítězství**:
   - Maršál Colloredo v Posledním vzepětí má 1 tah na to, aby dospěl do rybářské pramice na Čertovce `(3, 0, 2)` / `(4, 0, 2)`; pokud nedorazí, na konci tahu nastává porážka.
   - Společník v Posledním vzepětí je po dobu svého tahu aktivním záchrancem maršála.
   - Padlý společník je vyřazen z finální volby Paradoxní oběti (ADR-0006).
   - Vojenské vítězství zničením nastane až po doznění posledního tahu umírajících nepřátel.

## Důsledky

- Ruší bezpečný „alpha-strike“: po zasažení nepřítele musí hráč i nadále aktivně hledat plný kryt nebo klást clonu kouře z černého prachu.
- Zvyšuje dramatičnost a hrdinský patos: padající obránci i útočníci před smrtí ještě vystřelí svou poslední kuli.
- Přesně matematicky definuje prahy popravy a dorážení (Coup de Grâce) pro těžké muškety a výbušniny.
