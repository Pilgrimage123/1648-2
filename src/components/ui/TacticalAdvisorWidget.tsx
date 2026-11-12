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
import { text, unitName, useLocale, type MessageId } from "../../i18n";
import { useGameStore } from "../../store/useGameStore";
import { UnitPortrait } from "./UnitPortrait";
import { useDraggableHud } from "./useDraggableHud";

interface TutorialStepData {
  step: 1 | 2 | 3 | 4;
  title: MessageId;
  speakerId: string;
  role: MessageId;
  portrait: UnitArchetype;
  dialogue: MessageId;
  tactics: MessageId[];
}

const TUTORIAL_STEPS: TutorialStepData[] = [
  {
    step: 1,
    title: "ui.advisor.1.title",
    speakerId: "player-jan-matej",
    role: "tutorial.step_1_matej_move.role",
    portrait: "ranger",
    dialogue: "ui.advisor.1.dialogue",
    tactics: [
      "ui.advisor.1.t1",
      "ui.advisor.1.t2",
      "ui.advisor.1.t3",
      "ui.advisor.1.t4",
      "ui.advisor.1.t5",
    ],
  },
  {
    step: 2,
    title: "ui.advisor.2.title",
    speakerId: "player-vaclav-michalovic",
    role: "ui.sacrifice.vaclav.role",
    portrait: "sniper",
    dialogue: "ui.advisor.2.dialogue",
    tactics: ["ui.advisor.2.t1", "ui.advisor.2.t2", "ui.advisor.2.t3"],
  },
  {
    step: 3,
    title: "ui.advisor.3.title",
    speakerId: "player-bartolomej",
    role: "ui.sacrifice.bart.role",
    portrait: "ranger",
    dialogue: "ui.advisor.3.dialogue",
    tactics: ["ui.advisor.3.t1", "ui.advisor.3.t2", "ui.advisor.3.t3"],
  },
  {
    step: 4,
    title: "ui.advisor.4.title",
    speakerId: "player-bartolomej",
    role: "ui.sacrifice.bart.role",
    portrait: "ranger",
    dialogue: "ui.advisor.4.dialogue",
    tactics: ["ui.advisor.4.t1", "ui.advisor.4.t2"],
  },
];

export function TacticalAdvisorWidget() {
  const locale = useLocale();
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
  const speaker = unitName(currentData.speakerId, "nom", locale);
  const tactics = currentData.tactics.map((line) => {
    if (beacon && line === "ui.advisor.4.t2") {
      const { x, y, z } = beacon.coord;
      return text("ui.advisor.4.dock", { x, y, z }, locale);
    }
    return text(line, undefined, locale);
  });

  return (
    <aside
      aria-label={text("ui.advisor.aria", undefined, locale)}
      style={dragStyle}
      className={`pointer-events-auto flex flex-col gap-2 baroque-cartouche baroque-border rounded-xl px-2.5 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.9)] text-amber-50 select-none bg-slate-950/88 border-amber-500/65 backdrop-blur-md transition-all ${
        expanded ? "w-80 md:w-96 p-3" : "w-fit"
      }`}
    >
      {/* Kompaktní jednořádková hlavička */}
      <div
        onPointerDown={onPointerDown}
        title={text("ui.advisor.drag", undefined, locale)}
        className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
          <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-cinzel font-black text-[11px] text-amber-200 whitespace-nowrap">
            {text("ui.advisor.chip", { count: currentData.step }, locale)}
          </span>
          <span className="font-literata text-[11px] text-amber-100/90 truncate max-w-[175px]">
            {text(currentData.title, undefined, locale)}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            title={text(expanded ? "ui.advisor.collapse" : "ui.advisor.expand", undefined, locale)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded baroque-bronze-btn text-[9px] font-cinzel font-black text-amber-200 hover:text-amber-100 cursor-pointer"
          >
            <span>
              {text(expanded ? "ui.advisor.collapseLabel" : "ui.advisor.detail", undefined, locale)}
            </span>
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
              title={text("ui.advisor.reset", undefined, locale)}
              className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleTutorial}
            title={text("ui.advisor.close", undefined, locale)}
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
              name={speaker}
              size="xs"
            />
            <div className="min-w-0">
              <div className="font-cinzel font-black text-[11px] text-amber-300">
                {speaker}{" "}
                <span className="font-literata font-normal text-[10px] text-amber-400/80">
                  · {text(currentData.role, undefined, locale)}
                </span>
              </div>
              <p className="font-literata italic text-[11px] text-amber-100 mt-0.5 leading-snug">
                „{text(currentData.dialogue, undefined, locale)}“
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
                <span>
                  {text(tutorialStep < 4 ? "ui.advisor.next" : "ui.advisor.done", undefined, locale)}
                </span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
