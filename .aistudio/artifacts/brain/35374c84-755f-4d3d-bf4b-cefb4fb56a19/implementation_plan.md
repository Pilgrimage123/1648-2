# Prioritizace pohybu ve vybraném patře (P0/P1/P2) a oprava ovládání v 1. patře

Tento plán řeší problém, kdy hra při ovládání Václava z Michalovic (nebo jiné jednotky ve vyšším patře) nabízela sestup do přízemí (P0) místo plynulého pohybu po právě vybraném 1. patře (P1). Zahrnuje opravu 3D detekce kurzoru na patrech, uzamčení vizuálního řezu aktivního patra a zavedení přísné preference pohybu ve vybraném podlaží.

## User Review & Critical Decisions

> [!IMPORTANT]
> Níže jsou zapracovány vaše potvrzené volby z dotazníku, které definují přesné chování kamery, pater a schodišť:

- **Potvrzená volba 1 — Stabilita vizuálního řezu patra**: **Pevně držet vybrané patro, neměnit řez při přejetí myší**. Pokud má hráč v menu zvolené patro `P1`, přejetí kurzorem nad otevřený dvůr nebo zahradu v přízemí nikdy nezpůsobí samovolné skrytí 1. patra ani přepnutí mřížky do `P0`.
- **Potvrzená volba 2 — Ovládání schodišť vs. podlahy**: **Podlaha pohne v aktivním patře, portál schodiště změní patro**. Kliknutí na dlaždici v aktivním patře (včetně horní podesty schodiště) přesune vojáka v rámci téhož patra; k sestupu nebo výstupu do jiného patra slouží interaktivní portálový štítek schodiště (`P1↔P0`, `P1↔P2`) nebo ruční přepnutí cílového patra.

---

## 1. Přehled a hlavní koncept

- **Příčina dosavadní chyby**:
  1. **Zablokovaný 3D raycasting horních pater po startu hry**: Protože hra začíná s pohledem v přízemí (`P0`), 3D vrstvy podlah `P1` a `P2` měly při prvním vykreslení vypnutou detekci myši (`raycast = () => null`). Při následném přepnutí do `P1` však vykreslovací jádro neobnovilo původní metodu detekce paprsku, takže klikání i pohyb myši procházely skrz podlahu 1. patra rovnou do přízemí (`P0`).
  2. **Automatické shazování řezu patra při přejetí myší**: Jakmile paprsek myši zachytil dlaždici v `P0` (kam mohl Václav seběhnout po blízkých schodech), hra okamžitě přepnula efektivní zobrazované patro (`effectiveViewFloor`) na `0`, čímž zprůhlednila celé 1. patro a skryla modré/žluté zóny pohybu v `P1`.
  3. **Předčasný skok na schodiště v algoritmu hledání cesty**: Sousední dlaždice u schodiště nabízely přímý skok do jiného patra i tehdy, když podesta ve stejném patře byla volná.
- **Cílový stav**:
  - Hra vždy s nejvyšší prioritou vyhodnocuje a nabízí pohyb v **aktuálně vybraném patře (`activeFloor`: P0 / P1 / P2)**.
  - Pohyb do jiného patra nabídne pouze tehdy, když na dané souřadnici `[X, Z]` vybrané patro vůbec neexistuje (např. jednopatrová část zahrady nebo otevřený dvůr) nebo když hráč výslovně použije portál schodiště (`P1↔P0`).

---

## 2. Uživatelský zážitek a vizuální design

### A. Pohyb a výběr cíle s prioritou aktivního patra (`P0 / P1 / P2`)
- **Stoprocentní odezva podlahy v P1 a P2**: Po přepnutí do `P1` (nebo výběru Václava v 1. patře) celá plocha Piano Nobile, severní lodžie i zahradního belvederu okamžitě reaguje na kurzor myši a zobrazuje modré (1 AP) a žluté (2 AP) dlaždice pohybu v 1. patře.
- **Inteligentní vyhodnocení souřadnice pod kurzorem**:
  1. Pokud na souřadnici `[X, Z]` pod kurzorem existuje pochozí dlaždice ve **vybraném patře (`activeFloor`)**, kurzor se vždy přichytí k této dlaždici v `activeFloor`.
  2. Teprve pokud ve vybraném patře na daném `[X, Z]` žádná podlaha není (např. jednopatrová zahrada mimo belveder nebo světlík nádvoří), nabídne se existující dlaždice v nižším patře.

### B. Stabilní zobrazení patra bez blikání
- **Pevný řez budovy (`effectiveViewFloor === activeFloor`)**: Vizuální řez paláce a viditelnost pohybových zón v aktivním patře zůstávají pevně ukotvené podle volby hráče (`P0`, `P1`, `P2`). Přejetí myší nad zahradu či dvůr už nikdy nezpůsobí zmizení podlahy 1. patra.
- **Čitelné zóny pohybu**: Při vybraném patře `P1` vidí hráč jasně zvýrazněné všechny dosažitelné dlaždice přímo v `P1`, a v jednopatrových částech zahrady (kde `P1` neexistuje) vidí dosažitelné dlaždice v přízemí, aniž by se narušilo zobrazení 1. patra.

### C. Jednoznačné ovládání schodišť
- **Chůze po podestě v aktivním patře**: Najetí a kliknutí na samotnou dlaždici podlahy v aktivním patře (i v místě schodiště) udrží pohyb vojáka v aktivním patře.
- **Změna patra přes portál schodiště**: Kliknutí na plovoucí štítek portálu schodiště (`P1↔P0` nebo `P1↔P2`) naplánuje cestu po schodech do sousedního patra a po dokončení přesunu plynule přepne aktivní patro na nové podlaží.

---

## 3. Klíčová produktová rozhodnutí a kompromisy

- **Rozhodnutí 1: Obnovení nativní 3D detekce paprsku (`InstancedMesh.prototype.raycast`) pro P1 a P2**
  - *Zvolený přístup*: Explicitně předávat platnou referenci na metodu `THREE.InstancedMesh.prototype.raycast`, když je patro aktivní, místo hodnoty `undefined`.
  - *Proč*: Zajišťuje, že po přepnutí z `P0` na `P1` nebo `P2` 3D engine okamžitě a spolehlivě detekuje podlahu vyššího patra.
  - *Zvažované alternativy*: Výpočet průsečíku s matematickou rovinou v prostoru — zamítnuto, protože `InstancedMesh` raycasting přesně respektuje reálný tvar balkónů, arkád a výřezů nádvoří.
- **Rozhodnutí 2: Striktní hierarchie výběru patra na souřadnici `[X, Z]`**
  - *Zvolený přístup*: Při jakémkoliv zachycení kurzoru na `[X, Z]` nejprve ověřit existenci podlahy v `activeFloor`. Pouze pokud tam podlaha vůbec neexistuje, použít nižší patro.
  - *Proč*: Zabraňuje nechtěnému propadnutí kurzoru mezerou mezi dlaždicemi nebo přes 3D modely zábradlí do přízemí, pokud nad místem existuje podlaha vybraného patra.

---

## 4. Technická architektura a tok dat

### Schéma vyhodnocení pohybu a prioritizace patra

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Vstup hráče (Kurzor myši / Kliknutí)                 │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│           3D Raycasting vrstev podlah (P2 -> P1 -> P0)                   │
│  • P2 aktivní při activeFloor >= 2 (jinak raycast vypnut)                │
│  • P1 aktivní při activeFloor >= 1 (jinak raycast vypnut)                │
│  • P0 vždy připraveno jako záchytná vrstva pro jednopatrovou zahradu     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        Prioritní filtr aktivního patra (resolvePreferredFloorCoord)      │
│                                                                          │
│   Existuje na souřadnici [X, Z] pochozí dlaždice v activeFloor?          │
│     ├── ANO ──► Vyber cíl [X, activeFloor, Z] (Pohyb ve vybraném patře)  │
│     └── NE  ──► Jednopatrové místo (zahrada / dvůr):                     │
│                 Vyber dostupnou dlaždici [X, hitFloor, Z]                │
│                 (Řez budovy zůstává pevně na activeFloor!)               │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  3D A* Pathfinding & Zóny dosahu                         │
│  • Preferuje kroky v rámci stejného patra                                │
│  • Schodišťový "ramp step-on" do jiného patra se aktivuje jen tehdy,     │
│    když je podesta ve vlastním patře obsazena jinou jednotkou            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mapování stavu a interakcí
- **Správa `effectiveViewFloor`**: Hodnota `effectiveViewFloor` je pevně svázána s `activeFloor`, takže pohyb kurzoru nad nižším patrem nikdy nespustí nechtěný cutaway ořez aktivního patra.
- **Vykreslení zón dosahu (`zoneMeshRef`)**: Zobrazuje plné modré/žluté zóny pro všechny dosažitelné dlaždice v `activeFloor` a současně zobrazuje dosažitelné dlaždice v nižších patrech pouze na těch souřadnicích `[X, Z]`, kde v `activeFloor` není žádná podlaha (např. otevřená zahrada).
- **Interakce se schodištěm**: Samotné 3D stupně schodiště při pohybu v `activeFloor` směrují na podestu v `activeFloor` (pokud na ní jednotka ještě nestojí), zatímco kliknutí na portálový odznak `P1↔P0` cílí přímo na opačné podlaží schodiště.
