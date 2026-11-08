/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RotateCcw, Skull, Trophy } from "lucide-react";
import { useEffect } from "react";
import { TacticalScene } from "./components/canvas/TacticalScene";
import { CombatChronicleFeed } from "./components/ui/CombatChronicleFeed";
import { MissionStatusChip } from "./components/ui/MissionStatusChip";
import { TacticalActionRibbon } from "./components/ui/TacticalActionRibbon";
import { TacticalUtilitiesCapsule } from "./components/ui/TacticalUtilitiesCapsule";
import { TurnSplashBanner } from "./components/ui/TurnSplashBanner";
import { useGameStore } from "./store/useGameStore";

export default function App() {
  const outcome = useGameStore((s) => s.outcome);
  const round = useGameStore((s) => s.round);
  const resetGame = useGameStore((s) => s.resetGame);

  // Globální klávesové zkratky pro minimalistické taktické velení (XCOM Style):
  // - 1: Režim pohybu
  // - 2: Režim střelby (pokud jsou viditelné cíle)
  // - 3: Overwatch (hlídkování)
  // - 4: Hod granátem / petardou
  // - Tab / Shift+Tab: Cyklení cílů při střelbě NEBO cyklení vojáků čety při pohybu
  // - F1: Rozbalení / sbalení postranních křídel matematického rozpisu (Breakdown Wings)
  // - Space / Enter: Potvrzení výstřelu v Režimu míření / Ukončení tahu v běžném režimu
  // - Escape: Návrat z Režimu míření nebo granátu zpět do pohybu
  // - F: Přepínání pater budov (Roof/Floor Cutaway)
  // - M: Přepínání 2D billboard spritů a 3D modelů
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

      // F: Přepínání patra (Floor Cutaway)
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        state.toggleFloor();
        return;
      }

      // M: Přepínání 2D / 3D vizuálního módu
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        state.toggleRenderMode();
        return;
      }

      // Klávesové zkratky akcí (1 = Pohyb, 2 = Střelba, 3 = Overwatch, 4 = Granát)
      if (state.turn === "player" && !state.isBusy) {
        if (e.key === "1") {
          e.preventDefault();
          state.setActionMode("move");
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          if (state.visibleTargets.length > 0) {
            state.setActionMode("shoot");
          }
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          state.activateOverwatch();
          return;
        }
        if (e.key === "4") {
          e.preventDefault();
          state.setActionMode("grenade");
          return;
        }
      }

      // Tab / Shift+Tab: Cyklení cílů (při střelbě) nebo cyklení vojáků (při pohybu)
      if (e.key === "Tab" && state.turn === "player" && !state.isBusy) {
        e.preventDefault();
        if (state.actionMode === "shoot") {
          if (state.visibleTargets.length > 0) {
            state.cycleTarget(e.shiftKey ? -1 : 1);
          }
        } else {
          // Cyklení živých vojáků hráče
          const playerUnits = state.units.filter(
            (u) => u.faction === "player" && u.alive,
          );
          if (playerUnits.length > 1) {
            const currentIdx = playerUnits.findIndex(
              (u) => u.id === state.selectedUnitId,
            );
            const delta = e.shiftKey ? -1 : 1;
            const nextIdx =
              (currentIdx + delta + playerUnits.length) % playerUnits.length;
            const nextUnit = playerUnits[nextIdx];
            if (nextUnit) state.selectUnit(nextUnit.id);
          }
        }
        return;
      }

      // Space / Enter: Potvrzení výstřelu v režimu míření, nebo ukončení tahu v klidu
      if (state.turn === "player" && !state.isBusy) {
        if (state.actionMode === "shoot" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          state.executeShoot();
          return;
        }
        if (state.actionMode !== "shoot" && e.key === " ") {
          e.preventDefault();
          state.endTurn();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-slate-950 select-none">
      {/* 1. Fullscreen 2.5D React Three Fiber Taktická scéna (100% plocha obrazovky) */}
      <div className="absolute inset-0">
        <TacticalScene />
      </div>

      {/* 2. Filmový středový banner změny tahu */}
      <TurnSplashBanner />

      {/* 3. Plovoucí periferní HUD widgety (XCOM Architecture) */}
      {/* Levý horní roh: Stav mise, kolo a počasí */}
      <div className="pointer-events-none absolute top-3 left-3 z-20">
        <MissionStatusChip />
      </div>

      {/* Pravý horní roh: Kapsle nástrojů kamery, pater a 2D/3D zobrazení */}
      <div className="pointer-events-none absolute top-3 right-3 z-20">
        <TacticalUtilitiesCapsule />
      </div>

      {/* Pravá část: Plovoucí feed kroniky boje */}
      <CombatChronicleFeed />

      {/* Spodní střed: Sjednocená taktická akční lišta (Tactical Action Ribbon & Aiming HUD) */}
      <TacticalActionRibbon />

      {/* 4. Modální okno výsledku bitvy */}
      {outcome !== "ongoing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-400 text-amber-300">
              {outcome === "victory" ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <Skull className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <h2 className="font-serif text-2xl font-black uppercase tracking-wider text-white">
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
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
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
