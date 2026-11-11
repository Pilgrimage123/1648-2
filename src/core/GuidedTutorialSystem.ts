/**
 * Guided Tutorial System (/src/core/GuidedTutorialSystem.ts).
 * Skriptovaný taktický tutoriál ve stylu XCOM 2 (Operation Gatecrasher) pro 1. misi:
 * - Pevné vedení hráče (Input Guard) během prvních dvou kol.
 * - Postupné uvolňování (Progressive Freedom): od striktního vedení ke svobodné taktice.
 * - Barokní diegetický dabing a imperativní rozkazy.
 */

import { GridSystem, sameCoord } from "./GridSystem";
import type {
  ActionMode,
  GridCoord,
  GuidedTutorialInstruction,
  GuidedTutorialStep,
  UnitData,
} from "./types";

export const GUIDED_TUTORIAL_STEPS: Record<
  GuidedTutorialStep,
  GuidedTutorialInstruction
> = {
  step_1_matej_move: {
    step: "step_1_matej_move",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    portrait: "ranger",
    title: "KROK 1/8 · ZÁKLADNÍ POHYB A KRYT",
    orderText:
      "Pohněte Janem Matějem za mramorovou balustrádu [Pravé tlačítko myši na označené pole]",
    tacticalTip:
      "Modrá zóna (1 AP) vám zachová akci pro střelbu či kryt. Balustráda (−20 % šance na zásah) zachraňuje životy!",
    allowedUnitId: "player-jan-matej",
    allowedTileCoords: [
      { x: 6, y: 1, z: 20 },
      { x: 5, y: 1, z: 20 },
    ],
    allowedActionMode: "move",
    beacon: {
      coord: { x: 6, y: 1, z: 20 },
      label: "Kryt za balustrádou [PKM Pohyb]",
      color: "#fbbf24",
      icon: "shield",
    },
  },

  step_2_colloredo_escort: {
    step: "step_2_colloredo_escort",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    portrait: "ranger",
    title: "KROK 2/8 · TĚŽKÉ KULHÁNÍ & PRAVIDLO ZAJETÍ",
    orderText:
      "Přesuňte maršála Colloreda do chráněné pozice za Janem Matějem [Pravé tlačítko myši]",
    tacticalTip:
      "Maršál ujde kvůli 7 ranám z Lützenu jen 3 pole/AP. Švédové po něm nestřílí (chtějí výkupné 50 000 tolarů), ale zajmou jej při kontaktu na 1 AP!",
    allowedUnitId: "player-colloredo",
    allowedTileCoords: [
      { x: 5, y: 1, z: 21 },
      { x: 6, y: 1, z: 21 },
      { x: 5, y: 1, z: 22 },
    ],
    allowedActionMode: "move",
    beacon: {
      coord: { x: 5, y: 1, z: 21 },
      label: "Chráněná pozice maršála [PKM Pohyb]",
      color: "#38bdf8",
      icon: "shield",
    },
  },

  step_3_vaclav_aim: {
    step: "step_3_vaclav_aim",
    speaker: "Václav z Michalovic",
    role: "Klementinský student & písař",
    portrait: "sniper",
    title: "KROK 3/8 · VÝŠKOVÁ PŘEVAHA A KŘÍDLENÍ (FLANK)",
    orderText:
      "Přepněte na střelbu [Klávesa 2 nebo klik na terč] a zaměřte švédského zvěda na terase",
    tacticalTip:
      "Střelba z 1. patra přidává +15 % k zásahu. Švéd nemá kryt ze strany arkády — žlutý štít značí Křídlení (Flank) a +40 % k šanci na kritický zásah!",
    allowedUnitId: "player-vaclav-michalovic",
    allowedTileCoords: null,
    allowedActionMode: "shoot",
    beacon: {
      coord: { x: 12, y: 1, z: 10 },
      label: "Nekrytý švédský střelec (Křídlení +40 % Crit)",
      color: "#ef4444",
      icon: "crosshair",
    },
  },

  step_4_vaclav_shoot: {
    step: "step_4_vaclav_shoot",
    speaker: "Václav z Michalovic",
    role: "Klementinský student & písař",
    portrait: "sniper",
    title: "KROK 4/8 · MÍŘENÍ, ROZPAD ŠANCE A VÝSTŘEL",
    orderText:
      "Vystřelte na zaměřeného nepřítele [Klávesa Mezerník / Enter]",
    tacticalTip:
      "Křídla rozpadu šance v liště ukazují transparentní výpočet: základní přesnost + výška − kryt. Výstřel spustí filmovou kameru přes rameno.",
    allowedUnitId: "player-vaclav-michalovic",
    allowedTileCoords: null,
    allowedActionMode: "shoot",
    beacon: {
      coord: { x: 12, y: 1, z: 10 },
      label: "Cíl střelby [Potvrdit výstřel Mezerníkem]",
      color: "#ef4444",
      icon: "crosshair",
    },
  },

  step_5_enemy_turn_react: {
    step: "step_5_enemy_turn_react",
    speaker: "Arnošt Odowalsky",
    role: "Velitel švédských mušketýrů",
    portrait: "trooper",
    title: "KROK 5/8 · ŠVÉDSKÁ ODVETA & ZÁCHRANA KRYTEM",
    orderText: "Sledujte odvetnou palbu Švédů z krytu za balustrádou",
    tacticalTip:
      "Švédský výstřel zasáhl balustrádu a odrazil se! Kamenný kryt zachránil Václavovi život. Na otevřeném poli by byl mrtvý.",
    allowedUnitId: null,
    allowedTileCoords: null,
    allowedActionMode: null,
    beacon: null,
  },

  step_6_vaclav_reload: {
    step: "step_6_vaclav_reload",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    portrait: "ranger",
    title: "KROK 6/8 · FÁZOVÉ NABÍJENÍ PO 1 AP",
    orderText:
      "Zbraň je prázdná! Investujte 1 AP do nasypání prachu a nabití [Klávesa R]",
    tacticalTip:
      "Palné zbraně 17. století se nabíjejí po krocích (M1624 na 2 AP, těžká mušketa na 4 AP). Můžete nabít 1 AP a za zbývající 1 AP ustoupit do bezpečí!",
    allowedUnitId: "player-vaclav-michalovic",
    allowedTileCoords: null,
    allowedActionMode: "reload",
    beacon: null,
  },

  step_7_keg_explosion: {
    step: "step_7_keg_explosion",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    portrait: "ranger",
    title: "KROK 7/8 · PRACHOVÝ SUD & ZNIČENÍ KRYTU",
    orderText:
      "Zvolte petardu [4] nebo střelu a zaměřte prachový sud vedle barikády",
    tacticalTip:
      "Nepřátelé za těžkým krytem mají vysokou obranu. Výbuch sudu na ploše 3×3 zničí zídky, zapálí terén a vytvoří hustý černoprachý dým!",
    allowedUnitId: "player-bartolomej",
    allowedTileCoords: null,
    allowedActionMode: "grenade",
    beacon: {
      coord: { x: 7, y: 0, z: 13 },
      label: "Prachový sud (Odpálit výbuchem 3×3!)",
      color: "#f97316",
      icon: "keg",
    },
  },

  step_8_melee_finish: {
    step: "step_8_melee_finish",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    portrait: "ranger",
    title: "KROK 8/8 · ZTEČ ZBLÍZKA (MELEE RUSH)",
    orderText:
      "Klikněte pravým tlačítkem (PKM) přímo na zraněného nepřítele pro zteč chladnou zbraní",
    tacticalTip:
      "Zteč kordem či tesákem nevyžaduje žádný drahocenný střelný prach a útok je zdarma součástí pohybu k nepříteli!",
    allowedUnitId: null,
    allowedTileCoords: null,
    allowedActionMode: null,
    beacon: null,
  },

  step_9_free_combat: {
    step: "step_9_free_combat",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    portrait: "ranger",
    title: "VOLNÁ TAKTIKA · ÚNIK K ČERTOVCE",
    orderText:
      "ÚKOL MISE: Doveďte maršála Colloreda k rybářské pramici na Čertovce! [Přepínání pater V]",
    tacticalTip:
      "Základní výcvik je u konce, Vaše Excelence! Využijte schodiště a patra [V / PageDown], kryjte ústup maršála a probijte se k lodi.",
    allowedUnitId: null,
    allowedTileCoords: null,
    allowedActionMode: null,
    beacon: {
      coord: { x: 3, y: 0, z: 2 },
      label: "Rybářská pramice (Cíl mise)",
      color: "#38bdf8",
      icon: "dock",
    },
  },
};

export function getGuidedStepData(
  step: GuidedTutorialStep,
): GuidedTutorialInstruction {
  return GUIDED_TUTORIAL_STEPS[step] ?? GUIDED_TUTORIAL_STEPS.step_1_matej_move;
}

export function isTileAllowedForGuidedMove(
  step: GuidedTutorialStep,
  coord: GridCoord,
): boolean {
  const data = GUIDED_TUTORIAL_STEPS[step];
  if (!data || !data.allowedTileCoords || data.allowedTileCoords.length === 0) {
    return true;
  }
  return data.allowedTileCoords.some((c) => sameCoord(c, coord));
}

export function isActionAllowedForGuidedStep(
  step: GuidedTutorialStep,
  mode: ActionMode,
): boolean {
  const data = GUIDED_TUTORIAL_STEPS[step];
  if (!data || !data.allowedActionMode) {
    return true;
  }
  return data.allowedActionMode === mode;
}

export function getGuidedRejectFeedback(
  step: GuidedTutorialStep,
  reason: "unit" | "tile" | "action",
): string {
  switch (step) {
    case "step_1_matej_move":
      if (reason === "unit") {
        return "Jan Matěj: „Vaše Excelence, teď musím zajistit cestu já! Pohněte se mnou za balustrádu.“";
      }
      if (reason === "tile") {
        return "Jan Matěj: „Tam ne, Vaše Excelence! Na volném prostranství bych byl snadným terčem. Kryjme se za balustrádou!“";
      }
      return "Jan Matěj: „Nejprve se musíme přesunout do krytu!“";

    case "step_2_colloredo_escort":
      if (reason === "unit") {
        return "Jan Matěj: „Pomohu vám, milostivý pane! Nyní musíme vyvést maršála.“";
      }
      if (reason === "tile") {
        return "Jan Matěj: „Držte se těsně v mém závěsu za zdí, pane! Švédové nesmí maršála obklíčit.“";
      }
      return "Jan Matěj: „Musíme maršála dostat do bezpečí!“";

    case "step_3_vaclav_aim":
    case "step_4_vaclav_shoot":
      if (reason === "unit") {
        return "Václav z Michalovic: „Mám výbornou pozici na arkádě, nechte mě zamířit!“";
      }
      return "Václav z Michalovic: „Stiskněte [2] pro míření a [Mezerník] pro výstřel!“";

    case "step_6_vaclav_reload":
      return "Bratr Bartoloměj: „Prázdná hlaveň nestřílí! Stiskněte [R] a nabijte prach.“";

    case "step_7_keg_explosion":
      return "Bratr Bartoloměj: „Ten Švéd je v plném krytu! Odpalte petardou [4] prachový sud!“";

    default:
      return "Rádce: „Soustřeďte se na rozkaz velení.“";
  }
}

export function getGuidedTutorialBeacon(
  grid: GridSystem,
  step: GuidedTutorialStep,
  units: UnitData[],
): {
  coord: GridCoord;
  label: string;
  color: string;
  icon?: "shield" | "crosshair" | "keg" | "melee" | "dock";
} | null {
  const data = GUIDED_TUTORIAL_STEPS[step];
  if (!data) return null;

  // Speciální dynamický beacon pro krok 8 (Zteč zblízka)
  if (step === "step_8_melee_finish") {
    const woundedEnemy = units
      .filter((u) => u.faction === "enemy" && u.alive && u.hp > 0 && u.pos.y === 0)
      .sort((a, b) => a.hp - b.hp)[0];
    if (woundedEnemy) {
      return {
        coord: { ...woundedEnemy.pos },
        label: `Zteč chladnou zbraní na ${woundedEnemy.name} [PKM]`,
        color: "#dc2626",
        icon: "melee",
      };
    }
  }

  return data.beacon;
}
