# 9. Čtyřstavový kamerový systém ve stylu XCOM 2 (Cinematic Action Cam & Event Interrupts)

Datum: 2026-11-10

## Stav

Přijato (revidováno v `/grill-with-docs` na plnohodnotný 4-stavový kamerový automat ve stylu XCOM 2)

## Kontext

V původní verzi ADR-0009 kamera během pohybu pouze přiblížila izometrický pohled o ~28 % a přesunula střed otáčení (`orbitCenterRef`) rovnou na konečnou dlaždici trasy (`path[path.length - 1]`). Zároveň se reakční střelba z hlídky (**Overwatch**) i odhalení nepřátel v šerosvitu (**Pod Reveal**) vyhodnocovaly až *poté*, co voják vcelku doběhl na konec své trasy.

Pro dosažení filmového tempa a čitelnosti ve stylu *XCOM 2* zasazeného do třicetileté války (1618–1648) potřebujeme, aby kamerový systém fungoval jako deterministický **State Machine** s plynulými přechody mezi 4 hlavními stavy a krokovým vyhodnocováním trasy v reálném čase:
1. **Tactical Isometric View**: Sledování 1 AP pohybu (`Blue Zone`) a tahů nepřátel z ptačí perspektivy v reálném čase podél interpolované pozice vojáka, včetně automatického zprůhlednění střech a vyšších pater (`Floor Cutaway`), pokud je jednotka uvnitř budovy (`isEnclosedRoofedCoord`).
2. **Action Cam (Over-the-Shoulder Sprint & Interaction)**: Při 2 AP sprintu (`Yellow Zone`) hráčova hrdiny nebo interakci s prostředím (vyražení dřevěných dveří za běhu, přeskok nízkého krytu `vault`, výstup po schodišti) kamera sletí do nízkého úhlu za rameno vojáka, sleduje tečnu jeho pohybu s jemným krokovým otřesem (`camera shake`) a dynamicky se vyhýbá zdem a pilířům.
3. **Event Interrupts (Přerušení pohybu v bodě události)**:
   - **Pod Reveal & Scramble**: Jakmile pohybující se voják na některém kroku trasy poprvé odhalí dosud neaktivovanou skupinu (pod) švédských mušketýrů/pikenýrů, pohyb se v daném bodě pozastaví, kamera provede rychlý přelet a zoom (`Pan & Zoom`) na odhalené nepřátele, ti provedou krátký **Scramble** (rozprchnutí o 1–2 dlaždice do nejbližšího krytu + bojový pokřik) a kamera se vrátí zpět k vojákovi, který dokončí svůj pohyb.
   - **Overwatch Slow-Mo**: Jakmile voják vstoupí na dlaždici v zorném poli hlídkujícího střelce mimo plný kryt, pohyb se přepne do zpomaleného času (`timeScale = 0.25`), kamera zabere střelce v oblaku střelného prachu při výstřelu a následně zblízka sleduje běžícího vojáka při průletu/dopadu kulky. Pokud voják přežije, dokončí v normálním tempu zbytek své trasy.
4. **Cover Settle & Reset**: Po doběhu na cílovou dlaždici přehraje `UnitActor` krátkou animaci zakleknutí / přitisknutí ke krytu (~380 ms), během níž kamera podrží záběr a následně se C2-hladce vrátí do **Tactical Isometric View**.

## Rozhodnutí

1. **Stavový automat kamery (`CameraDirectorState` & `CameraMode`)**:
   - Zavádíme explicitní stavy kamery:
     - `TACTICAL_ISO`: Ptačí perspektiva, sledování 1 AP přesunů v reálném čase (`activeMovementWorldPos`) a automatický `Floor Cutaway` při vstupu do krytého interiéru.
     - `ACTION_OTS_FOLLOW`: Nízký Over-the-Shoulder průlet za ramenem běžícího hrdiny při 2 AP sprintu (`apCost === 2` / `zone === "yellow"`), vyražení dveří (`doorBreach`), přeskoku nízké překážky (`vault`) nebo běhu po schodišti, doplněný o harmonický krokový `camera shake` a detekci kolizí se zdivem.
     - `INTERRUPT_POD_REVEAL`: Rychlý přelet a přiblížení na nově odhalenou skupinu nepřátel během jejich *Scramble* přesunu do krytu.
     - `INTERRUPT_OVERWATCH_SLOWMO`: Zpomalení času (`timeScale = 0.25`), záběr na střílejícího mušketýra v dýmu a následný blízký průlet s kulkou k běžícímu vojákovi.
     - `COVER_SETTLE_RESET`: Záběr na zakleknutí vojáka do krytu v cíli a plynulý návrat do `TACTICAL_ISO`.
     - `AIM_OTS` a `PROJECTILE_TRACK`: Stávající 3-fázová střelecká kamera.
2. **Rozdělení pohybu po A* trase v bodě přerušení (`useGameStore.ts` + `Pathfinding.ts`)**:
   - A* pathfinding povoluje průchod zavřenými dveřmi (hrdina je za běhu automaticky vyrazí s prostorovým zvukem a třískami/prachem).
   - Před spuštěním segmentu pohybu se vyhodnotí první bod na trase, kde dochází k **Pod Reveal** nebo **Overwatch** přepadu; pohyb se animuje po tento bod, vykoná se příslušný *Event Interrupt* (se *Scramble* nepřátel nebo *Overwatch Slow-Mo*) a pokud je hrdina naživu a nezadržen, plynule pokračuje dalším segmentem trasy.
3. **Sdílená interpolovaná pozice v reálném čase (`activeMovementProgress`)**:
   - `UnitActor` respektuje `timeScale` ze storu a publikuje aktuální 3D pozici a směr běhu v reálném čase, takže `TacticalCamera` letí přímo za běžícím hrdinou místo skoku na konečnou dlaždici.

## Důsledky

### Pozitivní
- Dlouhé 2 AP přesuny a interakce s prostředím mají autentický filmový pocit z *XCOM 2* (kamera letí nízko za ramenem běžícího hrdiny).
- *Pod Reveal* a *Overwatch Slow-Mo* probíhají přesně v tom bodě trasy, kde k události skutečně došlo, nikoliv až po doběhnutí na konec cesty.
- Hráč si může kameru kdykoliv přepnout klávesou `C` (`actionCamEnabled`).

### Negativní / Rizika
- Přechody mezi tečnami pravotočivých/levotočivých zatáček na A* mřížce vyžadují silné vyhlazení směrového vektoru (`THREE.MathUtils.damp`), aby se kamera v rozích prudce netočila.
