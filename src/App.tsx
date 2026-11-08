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
import { TacticalAdvisorWidget } from "./components/ui/TacticalAdvisorWidget";
import { TacticalUtilitiesCapsule } from "./components/ui/TacticalUtilitiesCapsule";
import { TurnSplashBanner } from "./components/ui/TurnSplashBanner";
import { useGameStore } from "./store/useGameStore";

export default function App() {
  const outcome = useGameStore((s) => s.outcome);
  const victoryReason = useGameStore((s) => s.victoryReason);
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

      // H: Přepínání Taktického rádce (Tutoriál)
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        state.toggleTutorial();
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
      {/* Levý horní roh: Stav mise, kolo, počasí a Taktický rádce (Tutorial) */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col gap-2.5">
        <MissionStatusChip />
        <TacticalAdvisorWidget />
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
          <div className="max-w-lg w-full bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-400 text-amber-300">
              {outcome === "victory" ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <Skull className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl font-black uppercase tracking-wider text-white">
                {outcome === "victory"
                  ? victoryReason === "boat_escape"
                    ? "Útěk na Vltavě dokonán!"
                    : "Přepadový oddíl zničen!"
                  : "Vrchní velitel padl do zajetí"}
              </h2>
              <div className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mt-1">
                {outcome === "victory"
                  ? `Mise splněna v ${round}. kole · 26. července 1648`
                  : `Katastrofa v ${round}. kole · Praha padla`}
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed text-left bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {outcome === "victory" ? (
                victoryReason === "boat_escape" ? (
                  <>
                    <strong className="text-amber-300 block mb-1">
                      Husarský kousek maršála Colloreda:
                    </strong>
                    Třiašedesátiletý kulhající polní maršál v noční košili překonal
                    zahradu velkopřevorství a rybář jej na vratké pramici převezl
                    přes rozvodněnou noční Vltavu na Staré Město! Zatímco na Malé
                    Straně padlo do zajetí přes 200 šlechticů včetně kardinála Harracha
                    a zraněného purkrabího Martinice, Colloredo včas zalarmoval
                    posádku Staroměstské mostecké věže. Ta spustila železnou mříž
                    doslova před nosem švédských dragounů!
                  </>
                ) : (
                  <>
                    <strong className="text-amber-300 block mb-1">
                      Odowalského zrada odražena:
                    </strong>
                    Švédský přepadový oddíl byl v zahradě Velkopřevorství do jednoho
                    pobit! Cesta k rybářské pramici na Čertovce je zcela volná. Maršál
                    Colloredo bezpečně přeplouvá rozvodněnou Vltavu, aby na pravém
                    břehu zorganizoval legendární obranu Prahy.
                  </>
                )
              ) : (
                <>
                  <strong className="text-rose-400 block mb-1">
                    Tragický pád vrchního velitele:
                  </strong>
                  Polní maršál Rudolf Colloredo byl švédskými dragouny dopaden v noční
                  košili dříve, než stačil dosáhnout loďky. Bez vrchního velitele
                  nikdo nezorganizoval posádku na Karlově mostě včas — švédská jízda
                  překonala řeku a celá Praha padla do rukou generála Königsmarcka.
                </>
              )}
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
