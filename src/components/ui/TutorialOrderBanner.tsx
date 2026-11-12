/**
 * Tutorial Order Banner (/src/components/ui/TutorialOrderBanner.tsx).
 * Filmový rozkazový pruh ve stylu XCOM 2 (Operation Gatecrasher):
 * - Zobrazuje se v horním středu obrazovky pod filmovým bannerem.
 * - Barokní kartuše (Chiaroscuro & Royal Gold), portrét mluvčího, imperativní vojenský rozkaz.
 * - Zobrazuje okamžitou diegetickou odezvu při neplatném pokusu o tah.
 * - Tlačítko pro přeskočení výcviku [Shift+H] pro zkušené veterány.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Flame,
  GraduationCap,
  Shield,
  Ship,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getGuidedStepData } from "../../core/GuidedTutorialSystem";
import type { GuidedTutorialStep } from "../../core/types";
import { formatPhrase, text, useLocale, type MessageId } from "../../i18n";
import { useGameStore } from "../../store/useGameStore";
import { UnitPortrait } from "./UnitPortrait";

const STEP_COPY: Record<
  GuidedTutorialStep,
  { speaker: MessageId; role: MessageId; title: MessageId; order: MessageId; tip: MessageId }
> = {
  step_1_matej_move: {
    speaker: "tutorial.step_1_matej_move.speaker",
    role: "tutorial.step_1_matej_move.role",
    title: "tutorial.step_1_matej_move.title",
    order: "tutorial.step_1_matej_move.order",
    tip: "tutorial.step_1_matej_move.tip",
  },
  step_2_colloredo_escort: {
    speaker: "tutorial.step_2_colloredo_escort.speaker",
    role: "tutorial.step_2_colloredo_escort.role",
    title: "tutorial.step_2_colloredo_escort.title",
    order: "tutorial.step_2_colloredo_escort.order",
    tip: "tutorial.step_2_colloredo_escort.tip",
  },
  step_3_vaclav_aim: {
    speaker: "tutorial.step_3_vaclav_aim.speaker",
    role: "tutorial.step_3_vaclav_aim.role",
    title: "tutorial.step_3_vaclav_aim.title",
    order: "tutorial.step_3_vaclav_aim.order",
    tip: "tutorial.step_3_vaclav_aim.tip",
  },
  step_4_vaclav_shoot: {
    speaker: "tutorial.step_4_vaclav_shoot.speaker",
    role: "tutorial.step_4_vaclav_shoot.role",
    title: "tutorial.step_4_vaclav_shoot.title",
    order: "tutorial.step_4_vaclav_shoot.order",
    tip: "tutorial.step_4_vaclav_shoot.tip",
  },
  step_5_enemy_turn_react: {
    speaker: "tutorial.step_5_enemy_turn_react.speaker",
    role: "tutorial.step_5_enemy_turn_react.role",
    title: "tutorial.step_5_enemy_turn_react.title",
    order: "tutorial.step_5_enemy_turn_react.order",
    tip: "tutorial.step_5_enemy_turn_react.tip",
  },
  step_6_vaclav_reload: {
    speaker: "tutorial.step_6_vaclav_reload.speaker",
    role: "tutorial.step_6_vaclav_reload.role",
    title: "tutorial.step_6_vaclav_reload.title",
    order: "tutorial.step_6_vaclav_reload.order",
    tip: "tutorial.step_6_vaclav_reload.tip",
  },
  step_7_keg_explosion: {
    speaker: "tutorial.step_7_keg_explosion.speaker",
    role: "tutorial.step_7_keg_explosion.role",
    title: "tutorial.step_7_keg_explosion.title",
    order: "tutorial.step_7_keg_explosion.order",
    tip: "tutorial.step_7_keg_explosion.tip",
  },
  step_8_melee_finish: {
    speaker: "tutorial.step_8_melee_finish.speaker",
    role: "tutorial.step_8_melee_finish.role",
    title: "tutorial.step_8_melee_finish.title",
    order: "tutorial.step_8_melee_finish.order",
    tip: "tutorial.step_8_melee_finish.tip",
  },
  step_9_free_combat: {
    speaker: "tutorial.step_9_free_combat.speaker",
    role: "tutorial.step_9_free_combat.role",
    title: "tutorial.step_9_free_combat.title",
    order: "tutorial.step_9_free_combat.order",
    tip: "tutorial.step_9_free_combat.tip",
  },
};

export function TutorialOrderBanner() {
  const locale = useLocale();
  const guidedTutorial = useGameStore((s) => s.guidedTutorial);
  const skipGuidedTutorial = useGameStore((s) => s.skipGuidedTutorial);
  const toggleGuidedTutorial = useGameStore((s) => s.toggleGuidedTutorial);
  const outcome = useGameStore((s) => s.outcome);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const isBusy = useGameStore((s) => s.isBusy);
  const activeMovement = useGameStore((s) => s.activeMovement);
  const turn = useGameStore((s) => s.turn);

  const [expanded, setExpanded] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  // Zobrazit varovnou hlášku při chybném kliknutí na 3,5 sekundy
  useEffect(() => {
    if (!guidedTutorial.rejectFeedback) {
      setFeedbackVisible(false);
      return;
    }
    setFeedbackVisible(true);
    const timer = setTimeout(() => {
      setFeedbackVisible(false);
    }, 3800);
    return () => clearTimeout(timer);
  }, [guidedTutorial.rejectFeedback, guidedTutorial.rejectTimestamp]);

  // Skrýt během letu střely, filmové akční kamery a po skončení mise
  if (
    !guidedTutorial.enabled ||
    guidedTutorial.dismissed ||
    outcome !== "ongoing" ||
    activeProjectile !== null ||
    Boolean(isBusy && activeMovement?.isActionCam)
  ) {
    return null;
  }

  const stepData = getGuidedStepData(guidedTutorial.currentStep);
  const copy = STEP_COPY[guidedTutorial.currentStep];
  const isFreeCombat = guidedTutorial.currentStep === "step_9_free_combat";

  const getStepIcon = () => {
    switch (stepData.beacon?.icon) {
      case "shield":
        return <Shield className="w-4 h-4 text-amber-400" />;
      case "crosshair":
        return <Crosshair className="w-4 h-4 text-rose-400" />;
      case "keg":
        return <Flame className="w-4 h-4 text-orange-400" />;
      case "melee":
        return <Swords className="w-4 h-4 text-red-500" />;
      case "dock":
        return <Ship className="w-4 h-4 text-sky-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-300" />;
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex flex-col items-center px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Hlavní rozkazová barokní kartuše */}
      <aside
        aria-label={text("ui.tutorial.aria", undefined, locale)}
        className="pointer-events-auto max-w-2xl w-full baroque-cartouche baroque-border rounded-xl px-3.5 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.95)] bg-slate-950/92 border-amber-500/70 backdrop-blur-md flex flex-col gap-1.5 transition-all"
      >
        {/* Horní řádek: Portrét mluvčího, krok a tlačítka ovládání */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <UnitPortrait
              archetype={stepData.portrait}
              faction="player"
              name={text(copy.speaker, undefined, locale)}
              size="xs"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-cinzel font-black text-xs text-amber-200 uppercase tracking-wider">
                  {text(copy.speaker, undefined, locale)}
                </span>
                <span className="font-literata text-[10px] text-amber-400/80 italic">
                  · {text(copy.role, undefined, locale)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-400 font-cinzel font-bold">
                {getStepIcon()}
                <span>{text(copy.title, undefined, locale)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tlačítko pro detailní taktický tip */}
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              title={text(
                expanded ? "ui.tutorial.tip.collapse" : "ui.tutorial.tip.expand",
                undefined,
                locale,
              )}
              className="flex items-center gap-1 px-2 py-0.5 rounded baroque-bronze-btn text-[10px] font-cinzel font-black text-amber-200 hover:text-amber-100 cursor-pointer"
            >
              <span>
                {text(expanded ? "ui.tutorial.tip.hide" : "ui.tutorial.tip.show", undefined, locale)}
              </span>
              {expanded ? (
                <ChevronUp className="w-3 h-3 text-amber-300" />
              ) : (
                <ChevronDown className="w-3 h-3 text-amber-300" />
              )}
            </button>

            {/* Přeskočit výcvik (pro veterány) */}
            {!isFreeCombat && (
              <button
                type="button"
                onClick={skipGuidedTutorial}
                title={text("ui.tutorial.skip", undefined, locale)}
                className="px-2 py-0.5 rounded bg-slate-900/90 border border-amber-800/80 hover:border-amber-400 text-[10px] font-cinzel font-semibold text-amber-300 hover:text-amber-100 cursor-pointer transition-colors"
              >
                {text("ui.tutorial.skipLabel", undefined, locale)}
              </button>
            )}

            {/* Zavřít / minimalizovat banner */}
            <button
              type="button"
              onClick={toggleGuidedTutorial}
              title={text("ui.tutorial.minimize", undefined, locale)}
              className="p-1 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Střední řádek: Jasný imperativní rozkaz (XCOM 2 Objective Banner) */}
        <div className="bg-black/60 rounded-lg px-3 py-1.5 border border-amber-900/70 flex items-center justify-between gap-2">
          <div className="font-cinzel font-black text-xs md:text-sm text-amber-100 leading-snug tracking-wide">
            {text(copy.order, undefined, locale)}
          </div>
          {turn === "enemy" && (
            <span className="text-[10px] font-cinzel font-bold text-rose-400 uppercase tracking-widest animate-pulse shrink-0">
              {text("ui.tutorial.enemyTurn", undefined, locale)}
            </span>
          )}
        </div>

        {/* Diegetická chybová hláška při nepovoleném kliku */}
        {feedbackVisible && guidedTutorial.rejectFeedback && (
          <div className="bg-rose-950/90 border border-rose-500/80 rounded-lg px-2.5 py-1 text-[11px] font-literata text-rose-100 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span className="leading-tight">
              {formatPhrase(guidedTutorial.rejectFeedback, locale)}
            </span>
          </div>
        )}

        {/* Rozbalená podrobná taktická nápověda */}
        {expanded && (
          <div className="pt-1.5 border-t border-amber-900/60 font-literata text-xs text-amber-200/95 leading-relaxed bg-amber-950/20 p-2 rounded-lg">
            <div className="flex items-start gap-1.5">
              <GraduationCap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-cinzel text-amber-300 font-bold block mb-0.5">
                  {text("ui.tutorial.lesson", undefined, locale)}
                </strong>
                {text(copy.tip, undefined, locale)}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
