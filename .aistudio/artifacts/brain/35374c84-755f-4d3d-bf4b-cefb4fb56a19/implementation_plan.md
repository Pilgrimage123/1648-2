# Revize zvláštních schopností a mechaniky 2 AP přebíjení zbraní

Kompletní revize zvláštních schopností hráčových postav (maršál Colloredo, komorník Jan Matěj, písař Václav z Michalovic, zbrojmistr Bartoloměj) a zavedení dobové mechaniky vybíjení a přebíjení palných zbraní (2 AP akce Přebití).

## User Review & Critical Decisions

> [!IMPORTANT]
> Na základě vašich odpovědí v dotazníku byly potvrzeny následující změny v mechanice a vlastnostech postav:

- **Mechanika vybíjení a 2 AP přebíjení zbraní**: Po každém výstřelu z palné zbraně (mušketa, karabina, arkebuza) se hlaveň vybije (`isLoaded = false`). Pro další výstřel je nutné provést akci **Přebití (2 AP)**. U postav s maximálně 2 AP tak přebití spotřebuje celý tah. Maršál Colloredo má jednorázový výstřel z pistole bez možnosti přebití v boji.
- **Odstranění zvláštní schopnosti maršála Colloreda**: Maršál Colloredo nemá v 1. misi žádnou zvláštní schopnost (`ability = undefined`), jelikož vyskočil z postele v noční košili, těžce kulhá po 7 zraněních z Lützenu a je příliš rozespalý na udílení velitelských rozkazů.
- **Úprava schopnosti komorníka Jana Matěje ("Přísaha komorníka")**: Schopnost již nedává žádné osobní bonusy Janu Matějovi samotnému (původní +1 Zbroj a +1 AP pro Jana se ruší). Schopnost se plně soustředí na záchranu, přiskok, kouřovou clonu a ochranný plášť (+2 Zbroj, +3 HP, +1 AP) pro maršála Colloreda.
- **Zachování schopností ostatních hrdinů**: Václav z Michalovic (Svatováclavské soustředění) a Bratr Bartoloměj (Maltézská pekelná salva) si ponechávají své taktické schopnosti přizpůsobené mechanice přebíjení.

---

## 1. Overview & Core Concept

- **Co úprava přináší**: Autentickou taktickou hloubku bojů 17. století. Hráč musí plánovat salvy, krytí a 2 AP přebíjení černoprchových zbraní v součinnosti s chladnými zbraněmi (sek šavlí / úder pažbou) a podpůrnými schopnostmi komorníka a zbrojmistra.
- **Cílový zážitek**: XCOM taktický systém adaptovaný na pražské události roku 1648, kde výstřel z muškety znamená významný okamžik a vybitá hlaveň nutí k manévrování nebo souboji zblízka.

---

## 2. User Experience & Visual Design

- **Taktická lišta akcí (Tactical Action Ribbon)**:
  - **Akce Přebití (2 AP) [Klávesa 4]**: Zobrazí se jako dostupná akce, pokud má vybraná jednotka vybitou palnou zbraň (`isLoaded === false`) a má dostatek AP ($\ge 2$). Pokud má vybraná jednotka jen 1 AP, tlačítko zobrazí varování "Vyžaduje 2 AP".
  - **Indikátor stavu zbraně v HUD**: Pod názvem zbraně v taktickém rozhraní se zobrazí stav `[NABITO]` (zelená/zlatá) nebo `[VYBITO - 2 AP PŘEBITÍ]` (varovná červeno-oranžová).
  - **Schopnost [Klávesa 5]**: U maršála Colloreda je slot pro schopnost skryt / neaktivní. U komorníka Jan Matěje text jasně vysvětluje pomoc maršálovi bez nepravdivých osobních bonusů.

- **Audio-vizuální zpětná vazba**:
  - **Zvuk přebíjení**: Při stisku akce Přebití zazní autentický zvuk nasypání prachu na pánvičku a nabíjení kule nabijákem.
  - **Vizuální banner**: Zobrazení plovoucího textu `"PŘEBITO! [NABITA HLAVEŇ]"` nad jednotkou po dokončení přebíjení.

---

## 3. Key Product Decisions & Trade-Offs

- **Rozhodnutí 1: 2 AP akce Přebití místo 1 AP**:
  - *Zvolený přístup*: Přebití stojí 2 AP.
  - *Proč*: Historická věrnost (nabíjení předovky trvalo dlouho) a taktická volba mezi výstřelem v prvním tahu, přebíjením ve druhém tahu nebo přechodem na boj zblízka.
- **Rozhodnutí 2: Úplné odstranění schopnosti Colloreda**:
  - *Zvolený přístup*: `ability = undefined`.
  - *Proč*: Zvýrazňuje roli Colloreda jako zranitelného VIP, kterého musí družina bránit a eskortovat, místo aby sám rozdával plošné buffy.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Headless Tactical Core                          │
│                                                                        │
│  src/core/types.ts ──► UnitData { firearmLoaded: boolean, ... }       │
│  src/core/CombatSystem.ts ──► rollRangedAttack / reloadFirearmAction    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Zustand State Store                           │
│                                                                        │
│  src/store/useGameStore.ts                                             │
│    ├── executeShoot() ──► sets firearmLoaded = false                   │
│    ├── executeReload() ──► consumes 2 AP, sets firearmLoaded = true    │
│    └── activateSpecialAbility() ──► updated logic for Jan / Vaclav     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           UI Layer (React)                             │
│                                                                        │
│  TacticalActionRibbon.tsx ──► [4] Přebít (2 AP) & Ability [5] updates  │
│  Aiming HUD & Target Ribbon ──► Loaded / Discharged state badges       │
└────────────────────────────────────────────────────────────────────────┘
```

### Datový model & Stavové změny
1. **Types (`src/core/types.ts`)**:
   - Přidání příznaku `firearmLoaded?: boolean` do rozhraní `UnitData` pro sledování stavu palné zbraně (muškety, karabiny, arkebuzy).
   - Aktualizace `SpecialAbilityId` bez `marshal_command`.
2. **Game Store (`src/store/useGameStore.ts`)**:
   - Rozšíření `ActionMode` o `"reload"`.
   - Přidání metody `executeReload: () => void`, která u vybrané jednotky odečte 2 AP, nastaví `firearmLoaded = true`, přehraje zvuk nabíjení a zapíše událost do bojového deníku.
   - Úprava `executeShoot`: Po výstřelu z jakékoliv palné zbraně nastaví `firearmLoaded = false`.
   - Úprava `activateSpecialAbility`: Zrušení logiky pro `marshal_command`, odstranění osobních bonusů Jana Matěje (+1 AP, +1 Zbroj) v `protector_oath`.
3. **UI komponenty (`TacticalActionRibbon.tsx`, HUD)**:
   - Přidání dedikovaného tlačítka Přebít [4] s ikonou náboje/prachovnice a cenou 2 AP.
   - Dynamické zakázání střelby [2], pokud je `firearmLoaded === false`.

---

## Plan Verification & Next Steps

Po schválení plánu proběhne implementace změn v kódové základně, kontrola překladu pomocí `compile_applet` a `lint_applet` a ověření funkčnosti hry.
