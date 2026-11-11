/**
 * Tactical Advisor Widget (/src/components/ui/TacticalAdvisorWidget.tsx).
 * Kontextový taktický rádce (Pilíře 1 & 4):
 * - Ve výchozím stavu je sbalený do ultratenkého jednořádkového čipu (Progressive Disclosure),
 *   aby nikdy nezakrýval postavy na levé straně bojiště. Kliknutím na "Detail" se rozbalí.
 * - V režimu míření přes rameno a při letu projektilu se automaticky skryje (HUD State Machine).
 */

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GraduationCap,
  GripHorizontal,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import { getMission1TutorialBeacon } from "../../core/GridSystem";
import type { UnitArchetype } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { UnitPortrait } from "./UnitPortrait";
import { useDraggableHud } from "./useDraggableHud";

interface TutorialStepData {
  step: 1 | 2 | 3 | 4;
  title: string;
  speaker: string;
  role: string;
  portrait: UnitArchetype;
  dialogue: string;
  tactics: string[];
}

const TUTORIAL_STEPS: TutorialStepData[] = [
  {
    step: 1,
    title: "Ovládání XCOM 2: LKM Výběr · PKM Pohyb",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    portrait: "ranger",
    dialogue:
      "Vaše Excelence! Po těch sedmi střelných ranách u Lützenu těžce kulháte a sotva stojíte na nohou! Zůstanu při vás a budeme se krýt za zídkami zahradou k Čertovce!",
    tactics: [
      "Levé tlačítko (LKM): Kliknutím na vojáka jej aktivujete a ovládáte ikony schopností ve spodní liště.",
      "Pravé tlačítko (PKM — Move / Dash): Umístěte kurzor na políčko v modré (1 AP) nebo žluté (2 AP) zóně a klikněte pravým tlačítkem — voják se okamžitě vydá na cestu.",
      "Postih „Těžké kulhání“: Zraněný maršál Colloredo ujde kvůli starým zraněním z Lützenu jen 3 pole za 1 AP.",
      "Ochrana maršála & Zajetí: Švédové po hraběti nikdy nestřílí (chtějí jej živého pro výkupné), ale zajmou jej za 1 AP těsně vedle něj nebo do 3 polí s nabitou zbraní! Na družinu nebudou střílet, pokud stojí do 3 polí od hraběte a střelec hraběte vidí.",
      "Cíl eskorty: Probojujte se s maršálem Colloredem skrz zahradu plnou švédských hlídek k rybářské pramici na Čertovce!",
    ],
  },
  {
    step: 2,
    title: "Střelba, Hlavy cílů & Zteč zblízka (PKM)",
    speaker: "Václav z Michalovic",
    role: "Klementinský klerik & písař",
    portrait: "sniper",
    dialogue:
      "Pozor, pane! Švédští mušketýři mají odlehčené gustaviánské muškety M1624, zatímco naši obránci mohou nepřítele ztečovat i chladnou zbraní!",
    tactics: [
      "Výběr cíle (LKM): V režimu střelby [2] levým kliknutím na ikonu hlavy nepřítele v pravém dolním rohu přepínáte mezi viditelnými cíli.",
      "Útok zblízka (XCOM 2 — PKM): Pravým kliknutím přímo na nepřítele v dosahu provedete okamžitý přesun spojený se seknutím — samotný útok už nestojí další AP navíc!",
      "Zrušení akce (PKM): Pravé tlačítko v menu střelby či granátu akci zruší a vrátí vás na bojiště.",
    ],
  },
  {
    step: 3,
    title: "Fázové nabíjení, Petardy (LKM) & Sudy",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    portrait: "ranger",
    dialogue:
      "Moje těžká mušketa potřebuje na nabití 4 AP, švédská s papírovými patronami jen 2 AP — nabíjet však můžeme postupně po 1 AP mezi přesuny!",
    tactics: [
      "Fázové nabíjení po 1 AP [R]: Investujte 1 AP do kroku nabíjení a za druhý AP ustupte pravým tlačítkem do krytu.",
      "Házení granátů / petard [4]: Po zvolení petardy v liště zamíříte a levým kliknutím (LKM) hod potvrdíte (pravým kliknutím zrušíte).",
      "Prachové sudy: Trefa nebo petarda odpálí sud na ploše 3×3. Maják označuje nejbližší sud u paláce.",
    ],
  },
  {
    step: 4,
    title: "Schodiště, Patra paláce & Pramice",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    portrait: "ranger",
    dialogue:
      "Za zahradou teče Čertovka! Rybář čeká s pramicí u dřevěného mola. Využijte schodiště do 1. patra i na Maltézskou věž pro palebnou převahu!",
    tactics: [
      "Schodiště [V / PgUp / PgDn]: Výšková převaha z 1. a 2. patra přidává +15 % k zásahu a rozšiřuje dohled.",
      "Cíl mise: Doveďte maršála Colloreda na únikové molo k pramici na Čertovce!",
    ],
  },
];

export function TacticalAdvisorWidget() {
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const isBusy = useGameStore((s) => s.isBusy);
  const activeMovement = useGameStore((s) => s.activeMovement);

  const setTutorialStep = useGameStore((s) => s.setTutorialStep);
  const advanceTutorialStep = useGameStore((s) => s.advanceTutorialStep);
  const toggleTutorial = useGameStore((s) => s.toggleTutorial);
  const grid = useGameStore((s) => s.grid);

  // Kontextové vrstvení (Pillar 1): Ve výchozím stavu kompaktní jednořádková stužka, rozbalí se na kliknutí
  const [expanded, setExpanded] = useState(false);
  const { dragStyle, onPointerDown, hasMoved, resetOffset } = useDraggableHud();

  // Stavový automat HUDu (Pillar 4): Skrýt v akční kameře přes rameno a při střelbě
  const isHiddenInActionCam =
    actionMode === "shoot" ||
    actionMode === "melee" ||
    activeProjectile !== null ||
    Boolean(isBusy && activeMovement?.isActionCam);

  if (isHiddenInActionCam || tutorialDismissed || tutorialStep === null) {
    return null;
  }

  const currentData =
    TUTORIAL_STEPS.find((t) => t.step === tutorialStep) ?? TUTORIAL_STEPS[0]!;
  const beacon = getMission1TutorialBeacon(grid, currentData.step);
  const tactics = currentData.tactics.map((line) => {
    if (!beacon) return line;
    if (currentData.step === 4 && line.startsWith("Cíl mise:")) {
      const { x, y, z } = beacon.coord;
      return `Cíl mise: Doveďte maršála Colloreda na molo [${x}, ${y}, ${z}] k pramici na Čertovce!`;
    }
    return line;
  });

  return (
    <aside
      aria-label="Taktický rádce"
      style={dragStyle}
      className={`pointer-events-auto flex flex-col gap-2 baroque-cartouche baroque-border rounded-xl px-2.5 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.9)] text-amber-50 select-none bg-slate-950/88 border-amber-500/65 backdrop-blur-md transition-all ${
        expanded ? "w-80 md:w-96 p-3" : "w-fit"
      }`}
    >
      {/* Kompaktní jednořádková hlavička */}
      <div
        onPointerDown={onPointerDown}
        title="Tažením lze rádce posunout"
        className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
          <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-cinzel font-black text-[11px] text-amber-200 whitespace-nowrap">
            Rádce {currentData.step}/4:
          </span>
          <span className="font-literata text-[11px] text-amber-100/90 truncate max-w-[175px]">
            {currentData.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            title={expanded ? "Sbalit rádce" : "Rozbalit rady pro tento krok"}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded baroque-bronze-btn text-[9px] font-cinzel font-black text-amber-200 hover:text-amber-100 cursor-pointer"
          >
            <span>{expanded ? "Sbalit" : "Detail"}</span>
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-amber-300" />
            ) : (
              <ChevronDown className="w-3 h-3 text-amber-300" />
            )}
          </button>

          {hasMoved && (
            <button
              type="button"
              onClick={resetOffset}
              title="Vrátit na výchozí místo"
              className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleTutorial}
            title="Zavřít rádce [H]"
            className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Rozbalený detail na vyžádání */}
      {expanded && (
        <div className="space-y-2 pt-1.5 border-t border-amber-900/70 animate-in fade-in duration-150">
          <div className="flex items-start gap-2 bg-slate-900/85 rounded-lg p-2 border border-amber-900/60">
            <UnitPortrait
              archetype={currentData.portrait}
              faction="player"
              name={currentData.speaker}
              size="xs"
            />
            <div className="min-w-0">
              <div className="font-cinzel font-black text-[11px] text-amber-300">
                {currentData.speaker}{" "}
                <span className="font-literata font-normal text-[10px] text-amber-400/80">
                  · {currentData.role}
                </span>
              </div>
              <p className="font-literata italic text-[11px] text-amber-100 mt-0.5 leading-snug">
                „{currentData.dialogue}“
              </p>
            </div>
          </div>

          <ul className="space-y-1 font-literata text-[11px] text-amber-100/95 leading-snug">
            {tactics.map((point, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold shrink-0">·</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-900/60 text-[10px]">
            <div className="flex items-center gap-1">
              {TUTORIAL_STEPS.map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setTutorialStep(s.step)}
                  className={`w-5 h-5 rounded font-cinzel font-black text-[10px] cursor-pointer ${
                    s.step === tutorialStep
                      ? "bg-amber-500 text-stone-950"
                      : "bg-slate-900 text-amber-300 hover:bg-amber-950"
                  }`}
                >
                  {s.step}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={tutorialStep <= 1}
                onClick={() =>
                  setTutorialStep(Math.max(1, tutorialStep - 1) as 1 | 2 | 3 | 4)
                }
                className="p-1 rounded baroque-bronze-btn text-amber-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={advanceTutorialStep}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-cinzel font-black cursor-pointer"
              >
                <span>{tutorialStep < 4 ? "Další" : "Hotovo"}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
