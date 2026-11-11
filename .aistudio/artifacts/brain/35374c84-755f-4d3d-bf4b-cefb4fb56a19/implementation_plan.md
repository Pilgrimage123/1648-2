# Rekonstrukce a rozšíření 1. mise: Útěk z Velkopřevorského paláce (1648)

Plán komplexní architektonické a taktické revize první etapy: odstranění veškerých nelogičností v dispozici paláce, zvětšení bojiště na 24 × 28 polí, návrh skutečných vnitřních dělících zdí, vytvoření autentických honosných dvoukřídlých barokních portálů, stavba monumentálního císařského schodiště přes více polí a přesun startovních pozic hraběte Colloreda a komorníka Jana Matěje do ložnice v Piano Nobile.

---

## Uživatelská volba & Potvrzená rozhodnutí (Fáze 1)

> [!IMPORTANT]
> Na základě vašich odpovědí z dotazníku Fáze 1 je plán plně ukotven v těchto klíčových rozhodnutích:

- **Potvrzený start jednotek**: Rudolf hrabě Colloredo a jeho věrný komorník Jan Matěj **již nezačínají na dlaždicích pod schody**. Začínají v soukromé ložnici velkopřevora v 1. patře (Piano Nobile) v noční košili, odkud musí po poplachu seběhnout po monumentálním schodišti dolů do Sala Terreny a přes zahradu k Čertovce.
- **Potvrzené barokní schodiště**: Schodiště již není primitivní jednodlaždicový "žebřík". Vytvoříme monumentální císařské vícedílné schodiště (Imperial Grand Staircase) zabírající 3 až 4 pole délky i šířky, s masivními kamennými balustrádami, stupni, odpočívadlem (landing) a kardinálským běhounem.
- **Potvrzené měřítko bojiště**: Rozšíření mřížky z 20 × 24 na **24 × 28 polí**. Vznikne plnohodnotné čtyřkřídlé uspořádání Velkopřevorského paláce s uzavřenými komnatami, zbrojnicí, kapitulním sálem a čestným nádvořím (Cour d'honneur), bez jakýchkoliv dveří visících ve volném prostoru.
- **Honosné dvoukřídlé dveře a zdi**: Každé dveře v paláci i zahradě budou pevně zasazeny do nosných kamenných či štukových zdí (`high_wall`). Dveře do Sala Terreny i ložnice budou skutečnými dvoukřídlými barokními portály (Double-Leaf Grand Portals) se zdobeným kamenným ostěním a kovanými panty, nikoliv dvěma oddělenými jednoduchými rámy.

---

## 1. Přehled & Architektonický koncept

### Problémy původní mapy (odstranění nelogičností)
1. **Dveře ve vakuu ("dveře bez stěn")**: Dveře maltézské zbrojnice (`door-armory` na `x: 4, z: 18`) a dveře komnaty v Piano Nobile (`door-pianonobile-hall` na `x: 10, z: 18`) stály uprostřed otevřené podlahy bez jakýchkoliv navazujících zdí. Zbrojnice i ložnice postrádaly stěny, takže jednotky mohly dveře jednoduše obejít prázdným prostorem.
2. **Začátek pod schody**: Maršál Colloredo (`pos: { x: 10, y: 0, z: 19 }`) a Jan Matěj (`pos: { x: 9, y: 0, z: 19 }`) byli nasazeni přesně na dlaždicích přímého schodiště (`grid.setStairs(9..10, 19)`). Vznikala kolize prostorové geometrie i narativní nesmysl – velkopřevor v noční košili stál v přízemí přímo pod schodištěm.
3. **Schodiště o jednom poli**: Schody spojující přízemí a Piano Nobile fungovaly jako vertikální šachta na 1 dlaždici bez odpovídajícího barokního sklonu a architektonické elegance.
4. **Roztržené dvoukřídlé dveře**: Hlavní portál do Sala Terreny byl složen ze dvou samostatných jednoduchých dveří s masivním kamenným sloupkem uprostřed průchodu.

### Nová historická dispozice paláce Carla Luraga (24 × 28 polí, 3 patra)
- **Jižní palácový komplex (z: 16..27, x: 2..21)**:
  - **Přízemí (y = 0)**:
    - *Západní křídlo (x: 2..7, z: 17..24)*: Uzavřená Maltézská zbrojnice a prachárna ohraničená masivními zdmi (`high_wall`), přístupná těžkými kovanými dveřmi s ostěním.
    - *Střední čestné nádvoří (Cour d'honneur, x: 9..14, z: 18..21)*: Dlážděné otevřené nádvoří lemované arkádovými toskánskými pilíři.
    - *Severní Sala Terrena (x: 8..15, z: 16..17)*: Klenutá zahradní sala s trojosým průčelím, kde ústí monumentální dvoukřídlý portál do zahrady.
    - *Východní křídlo (x: 16..21, z: 17..24)*: Kapitulní knihovna a konventní cely bratří maltézského řádu.
  - **1. patro / Piano Nobile (y = 1)**:
    - *Západní apartmá (x: 3..7, z: 19..24)*: Privátní ložnice a pracovna velkopřevora Rudolfa Colloreda s krbem, barokním lůžkem a tajným vchodem na schodiště. Zde začíná maršál a Jan Matěj!
    - *Velký rytířský sál (x: 8..15, z: 22..26)*: Reprezentační sál s kardinálským brokátovým kobercem.
    - *Arkádový ochoz (x: 8..15, z: 16..17)*: Severní lodžie nad Sala Terrenou s kuželkovou balustrádou, kde hlídkuje klementinský student Václav.
  - **2. patro / Maltézská strážní věž (y = 2, x: 4..8, z: 17..19)**:
    - Zastřešený vyhlídkový ochoz s polovičním krytem a výhledem na celou Malou Stranu.
- **Velkopřevorská zahrada (z: 5..15, x: 1..22)**:
  - Barokní ornamentální partery, zahradní kamenné zídky, gabiony, vyvýšený zahradní Belveder (y = 1) a výbušné sudy střelného prachu.
- **Mlýnská stoka Čertovka a přístaviště (z: 0..4, x: 0..23)**:
  - Proudící temná voda Čertovky, dřevěné molo s rybářskou pramicí (úniková zóna mise).

---

## 2. Uživatelský zážitek & Vizuální design

### A. Monumentální císařské schodiště (Imperial Grand Staircase)
- **Půdorys & Rozsah**: Schodiště zabírá rozměr 4 × 3 pole v centrálním vestibulu paláce (`x: 10..13, z: 18..21`).
- **Architektonická anatomie**:
  - *Nástupní rameno z přízemí*: Široké kamenné stupně z pískovce stoupající k centrálnímu odpočívadlu (landing).
  - *Dvouramenné větvení*: Schodiště se na odpočívadle elegantně rozděluje do dvou ramen směřujících na východní a západní galerii Piano Nobile.
  - *Kardinálský běhoun*: Vínově červený sametový koberec se zlatým barokním lemováním probíhající středem stupňů.
  - *Plastické balustrády*: Tvarované kamenné kuželky (balustry) s leštěným madlem, zakončené čtyřbokými sloupky s pískovcovými koulemi (newel spheres).
  - *Smart traversal*: Jednotka může na schodiště plynule vstoupit z přízemí i patra; A* pathfinding a náhled pohybu zobrazují hladkou trajektorii s automatickým přepnutím řezu kamery na cílové patro.

### B. Honosné dvoukřídlé barokní portály (Grand Double-Leaf Portals)
- **Sala Terrena Portal (`x: 11..12, z: 16, y = 0`)**:
  - Masivní dvoukřídlé dveře o šířce 2 celých polí.
  - Tmavé dubové fošny s radiálními kazetami, kovanými pásy a bronzovými lvími hlavami jako klepadly.
  - Monumentální portálové ostění: profilovaný pískovcový oblouk s volutovým klenákem (keystone) a římsou s maltézským křížem.
  - Synchronizované otevírání: kliknutí na akční ikonu portálu otevře/zavře obě křídla současně (levé i pravé křídlo se vytočí ven směrem ke zdi).
- **Ložnicový portál Piano Nobile (`x: 7, z: 21, y = 1`)**:
  - Dvoukřídlé vyřezávané ořechové dveře vsazené do plné vnitřní příčky oddělující ložnici od rytířského sálu.
- **Zbrojnice (`x: 5, z: 17, y = 0`)**:
  - Jednokřídlé okované těžké dveře pevně zasazené mezi masivní kamenné zdi západního křídla.

### C. Nový dramatický start mise
- **Hrabě Colloredo**: Začíná na souřadnici `{ x: 5, y: 1, z: 22 }` v ložnici v Piano Nobile. Vedle něj je lůžko, psací stůl s mapami Malé Strany a osobní kolečková pistole.
- **Komorník Jan Matěj**: Začíná na `{ x: 6, y: 1, z: 21 }` u dveří komnaty, připraven maršála chránit a pomoci mu překonat schodiště.
- **Bratr Bartoloměj**: V Sala Terreně u zbrojnice v přízemí `{ x: 11, y: 0, z: 16 }` s těžkou mušketou.
- **Václav z Michalovic**: Na severní lodžii Piano Nobile `{ x: 15, y: 1, z: 16 }` s výhledem do zahrady.

---

## 3. Klíčová produktová & technická rozhodnutí

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARCHITEKTURA SYSTÉMU MAPY                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  GridSystem (24 × 28 × 3)                                              │
│  ├── Tiles: povrchy, dlažba, pochozí stavy, směrové kryty              │
│  ├── Walls & Pillars: masivní dělící příčky (žádné plovoucí dveře)    │
│  ├── Doors: Portály (single / double-leaf) s provázanými křídly       │
│  └── Multi-tile Stairs: Smart císařské schodiště propojující P0 <-> P1 │
│                                                                        │
│                              │                                         │
│                              ▼                                         │
│  InstancedBattlefield (Three.js / React Three Fiber)                   │
│  ├── BaroqueGrandStaircase3D: vícedílné stupně, odpočívadlo, madla    │
│  ├── BaroqueDoublePortal3D: honosné dvoukřídlé ostění s volutami      │
│  ├── InstancedMesh batched zdivo (pískovec, štuk, mramor)              │
│  └── Floor-cutaway controller: čistý pohled do přízemí i Piano Nobile  │
│                                                                        │
│                              │                                         │
│                              ▼                                         │
│  Pathfinding & FogOfWar                                                │
│  ├── A* 3D: plynulý průchod přes vícedílné schodiště                   │
│  └── LoS kalkulace: zdi blokují pohled, dveře po otevření propouští zrak│
└────────────────────────────────────────────────────────────────────────┘
```

### Přehled technických úprav
1. **Zvětšení GRID_WIDTH = 24, GRID_DEPTH = 28**:
   - Úprava konstant v `src/core/GridSystem.ts`.
   - Úprava `TacticalCamera.ts` a `worldCoords.ts` pro správné centrování mřížky a hladké rotace kamery.
2. **Datový model dvoukřídlých dveří (`DoorData`)**:
   - Rozšíření typu `DoorData` o podporu `isDoubleLeaf?: boolean`, `pairedDoorId?: string` nebo `widthTiles: 2`.
   - Metoda `toggleDoor` v `GridSystem` a `useGameStore` zajistí, že přepnutí jednoho křídla otevře/zavře celý dvoukřídlý portál a uvolní obě dlaždice pro průchod.
3. **Plnohodnotné zdi (Wall Integrity)**:
   - Doplnění chybějících vnitřních příček v přízemí i v 1. patře kolem ložnice, zbrojnice a kapitulní síně. Žádné dveře nezůstanou bez bočních zdí.
4. **Multi-Tile Staircase System**:
   - Rozšíření schodišťové logiky v `GridSystem.ts`: schodiště může mít délku přes více polí s definovaným vstupem v přízemí, odpočívadlem a výstupem v patře.
   - Plynulé prolinkování dlaždic v A* pathfindingu pro korektní výpočet AP na krok.
5. **Vizuální komponenty v `InstancedBattlefield.tsx`**:
   - `BaroqueDoublePortal3D`: Nádherně vymodelovaný barokní portál v Luragově stylu s architrávem, pilastry a otočnými křídly.
   - `BaroqueImperialStaircase3D`: Složené 3D schodiště s realistickými proporcemi, balustrádami a kobercem.

---

## 4. Ověření & Plán realizace po schválení

Po vašem schválení ("Proceed") budou provedeny tyto kroky:
1. Aktualizace rozměrů a topologie v `src/core/GridSystem.ts` (mřížka 24 × 28, zdi komnat, portály, vícepolové schodiště, nové pozice jednotek).
2. Aktualizace startovních pozic jednotek v `createInitialUnits` v `GridSystem.ts` a případných souvisejících scénářových testů.
3. Aktualizace 3D renderovacích komponent v `src/components/canvas/InstancedBattlefield.tsx` (nový `BaroqueDoublePortal3D` a `BaroqueImperialStaircase3D`).
4. Ověření kompilace a lintu (`compile_applet` + `lint_applet`) a kontrola plynulosti herního zážitku.
