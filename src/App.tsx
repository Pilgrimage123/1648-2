/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RotateCcw, Skull, Trophy } from "lucide-react";
import { useEffect } from "react";
import { TacticalScene } from "./components/canvas/TacticalScene";
import { BottomCommandPanel } from "./components/ui/BottomCommandPanel";
import { TargetingHud } from "./components/ui/TargetingHud";
import { TopBar } from "./components/ui/TopBar";
import { useGameStore } from "./store/useGameStore";

export default function App() {
  const outcome = useGameStore((s) => s.outcome);
  const round = useGameStore((s) => s.round);
  const resetGame = useGameStore((s) => s.resetGame);

  // Globální klávesové zkratky pro Režim míření (XCOM-2 Aiming HUD):
  // - Tab / Shift+Tab: Plynulé přepínání viditelných cílů v Target Ribbon
  // - F1: Rozbalení / sbalení postranních křídel matematického rozpisu (Breakdown Wings)
  // - Enter / Space: Potvrzení výstřelu v Režimu míření
  // - Escape: Návrat z Režimu míření nebo granátu zpět do pohybu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const state = useGameStore.getState();

      if (e.key === "Escape") {
        state.setActionMode("move");
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        state.toggleBreakdown();
        return;
      }

      if (e.key === "Tab" && state.turn === "player" && !state.isBusy) {
        if (state.visibleTargets.length > 0) {
          e.preventDefault();
          if (state.actionMode !== "shoot") {
            state.setActionMode("shoot");
          } else {
            state.cycleTarget(e.shiftKey ? -1 : 1);
          }
        }
        return;
      }

      if (
        (e.key === "Enter" || e.key === " ") &&
        state.actionMode === "shoot" &&
        state.turn === "player" &&
        !state.isBusy
      ) {
        e.preventDefault();
        state.executeShoot();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-slate-950 select-none">
      {/* 1. Fullscreen 2.5D React Three Fiber Taktická scéna */}
      <div className="absolute inset-0">
        <TacticalScene />
      </div>

      {/* 2. Taktické UI a XCOM-2 Aiming HUD (Target Ribbon + Breakdown Wings) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between z-10">
        <TopBar />

        {/* Střední/spodní plovoucí zóna pro Aiming HUD a Target Ribbon */}
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          <TargetingHud />
        </div>

        <BottomCommandPanel />
      </div>

      {/* 3. Modální okno výsledku mise */}
      {outcome !== "ongoing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-slate-900 border-2 border-amber-400/60 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-400 text-amber-300">
              {outcome === "victory" ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <Skull className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <h2 className="text-2xl font-extrabold uppercase tracking-wider text-white">
              {outcome === "victory"
                ? "Malostranský dům vyčištěn!"
                : "Obránci padli"}
            </h2>
            <p className="text-sm text-slate-300">
              {outcome === "victory"
                ? `Švédská hlídka byla zneškodněna v ${round}. kole. Cesta k Vltavě je volná!`
                : `Švédská přesila prolomila obranu v ${round}. kole.`}
            </p>
            <button
              type="button"
              onClick={resetGame}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Hrát znovu</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
