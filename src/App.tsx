/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Flame,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useEffect } from "react";
import { TacticalScene } from "./components/canvas/TacticalScene";
import { CombatChronicleFeed } from "./components/ui/CombatChronicleFeed";
import { MissionStatusChip } from "./components/ui/MissionStatusChip";
import { TacticalActionRibbon } from "./components/ui/TacticalActionRibbon";
import { TacticalAdvisorWidget } from "./components/ui/TacticalAdvisorWidget";
import { InspectDossier } from "./components/ui/InspectDossier";
import { TacticalUtilitiesCapsule } from "./components/ui/TacticalUtilitiesCapsule";
import { TurnSplashBanner } from "./components/ui/TurnSplashBanner";
import { TutorialOrderBanner } from "./components/ui/TutorialOrderBanner";
import { perkCopy, text, unitName, useLocale } from "./i18n";
import { useGameStore } from "./store/useGameStore";

const SACRIFICE_CLAUSE =
  "Jeden z vašich věrných společníků musí zůstat u palácové branky a odpálit sudy s prachem";
const VIGIL_QUOTE =
  "„Tvá oběť z tebe smyla strach. Od této chvíle jsi mečem Železné vigilie.“";

function splitAround(source: string, mark: string) {
  const at = source.indexOf(mark);
  if (at < 0) return null;
  return {
    before: source.slice(0, at),
    mark,
    after: source.slice(at + mark.length),
  };
}

function isInspectKey(e: KeyboardEvent): boolean {
  return e.key === "F1" || e.code === "Digit0" || e.code === "Numpad0" || e.key === "0";
}

export default function App() {
  const outcome = useGameStore((s) => s.outcome);
  const victoryReason = useGameStore((s) => s.victoryReason);
  const defeatReason = useGameStore((s) => s.defeatReason);
  const isCapturingAnim = useGameStore((s) => s.isCapturingAnim);
  const round = useGameStore((s) => s.round);
  const resetGame = useGameStore((s) => s.resetGame);
  const units = useGameStore((s) => s.units);
  const sacrificeDilemmaOpen = useGameStore((s) => s.sacrificeDilemmaOpen);
  const ironVigilPerk = useGameStore((s) => s.ironVigilPerk);
  const chooseSacrifice = useGameStore((s) => s.chooseSacrifice);
  const locale = useLocale();
  const sacrificeBody = text("ui.sacrifice.body", undefined, locale);
  const sacrificeParts = splitAround(sacrificeBody, SACRIFICE_CLAUSE);
  const boat3 = text("ui.epilogue.boat.3.body", undefined, locale);
  const boat3Parts = splitAround(boat3, VIGIL_QUOTE);
  const vigilPerk = ironVigilPerk ? perkCopy(ironVigilPerk.perkId, locale) : null;

  // Globální klávesové zkratky pro minimalistické taktické velení (XCOM Style):
  // - 1: Režim pohybu
  // - 2: Režim střelby (automaticky vybere střelce s cílem v dohledu)
  // - 3: Overwatch (hlídkování)
  // - 4: Hod granátem / petardou
  // - 5: Zvláštní schopnost hrdiny
  // - Q / E: Rotace kamery o 90° (vlevo / vpravo)
  // - Tab / Shift+Tab: Cyklení cílů při střelbě NEBO cyklení vojáků čety při pohybu
  // - F1 / 0: Úplný přehled vybrané postavy, nebo při podržení a kliknutí přehled kliknuté postavy či terénu
  // - Space / Enter: Potvrzení výstřelu v Režimu míření / Ukončení tahu v běžném režimu
  // - Escape: Návrat z Režimu míření nebo granátu zpět do pohybu
  // - F: Přepínání celé obrazovky (Fullscreen)
  // - V / PageUp / PageDown: Snadné přepínání pater budovy (Přízemí P0 <-> 1. Patro P1)
  // - M: Přepínání 2D billboard spritů a 3D modelů
  // - C: Akční kinematická kamera
  // - G: Barokní šerosvit (Mlha války)
  // - H: Taktický rádce (Tutoriál)
  useEffect(() => {
    const onFullscreenChange = () => {
      useGameStore
        .getState()
        .setFullscreenState(Boolean(document.fullscreenElement));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const state = useGameStore.getState();

      // F: Přepnutí na celou obrazovku (Fullscreen) funguje kdykoliv
      if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        state.toggleFullscreen();
        return;
      }

      // F1 / 0: úplný přehled. Krátký stisk přepne list vybrané postavy.
      // Podržení a klik prohlédne to, na co hráč klepl, a neprovede rozkaz.
      if (isInspectKey(e) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) state.beginInspectHold();
        return;
      }

      if (e.key === "Escape" && state.inspectOpen) {
        e.preventDefault();
        state.closeInspect();
        return;
      }

      if (state.sacrificeDilemmaOpen || state.outcome !== "ongoing") {
        return;
      }

      if (e.key === "Escape") {
        state.setActionMode("move");
        return;
      }

      // V / PageUp / PageDown: Snadné přepínání pater budovy (Roof/Floor Cutaway)
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        state.toggleFloor();
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        state.setActiveFloor(Math.min(2, state.activeFloor + 1) as 0 | 1 | 2);
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        state.setActiveFloor(Math.max(0, state.activeFloor - 1) as 0 | 1 | 2);
        return;
      }

      // C: Přepínání Akční kinematické kamery (XCOM Action Cam)
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        state.toggleActionCam();
        return;
      }

      // M: Přepínání 2D / 3D vizuálního módu
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        state.toggleRenderMode();
        return;
      }

      // G: Přepínání Barokního šerosvitu (Mlha války / Fog of War)
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        state.toggleFogOfWar();
        return;
      }

      // H / Shift+H: Přepínání rádce a přeskočení výcviku
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        if (e.shiftKey) {
          state.skipGuidedTutorial();
        } else {
          state.toggleTutorial();
          state.toggleGuidedTutorial();
        }
        return;
      }

      // Klávesové zkratky akcí (1 = Pohyb, 2 = Střelba, R = Přebít, B/6 = Zblízka, 3 = Overwatch, 4 = Granát, 5 = Zvláštní schopnost)
      if (state.turn === "player" && !state.isBusy) {
        if (e.key === "1") {
          e.preventDefault();
          state.setActionMode("move");
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          state.setActionMode(state.actionMode === "shoot" ? "move" : "shoot");
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          state.executeReload();
          return;
        }
        if (e.key === "b" || e.key === "B" || e.key === "6") {
          e.preventDefault();
          state.setActionMode(state.actionMode === "melee" ? "move" : "melee");
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
        if (e.key === "5") {
          e.preventDefault();
          state.activateSpecialAbility();
          return;
        }
      }

      // Tab / Shift+Tab: Cyklení cílů (při střelbě a boji zblízka) nebo cyklení vojáků (při pohybu)
      if (e.key === "Tab" && state.turn === "player" && !state.isBusy) {
        e.preventDefault();
        if (state.actionMode === "shoot") {
          if (state.visibleTargets.length > 0) {
            state.cycleTarget(e.shiftKey ? -1 : 1);
          }
        } else if (state.actionMode === "melee") {
          if (state.visibleMeleeTargets.length > 0) {
            state.cycleTarget(e.shiftKey ? -1 : 1);
          }
        } else {
          // Cyklení živých vojáků hráče, kteří ještě neukončili tah (ap > 0 a nejsou zadrženi)
          const activeSquad = state.units.filter(
            (u) =>
              u.faction === "player" &&
              u.alive &&
              u.hp > 0 &&
              u.ap > 0 &&
              (u.detainedTurns ?? 0) === 0,
          );
          if (activeSquad.length > 0) {
            const currentIdx = activeSquad.findIndex(
              (u) => u.id === state.selectedUnitId,
            );
            const delta = e.shiftKey ? -1 : 1;
            const nextIdx =
              currentIdx < 0
                ? 0
                : (currentIdx + delta + activeSquad.length) % activeSquad.length;
            const nextUnit = activeSquad[nextIdx];
            if (nextUnit) state.selectUnit(nextUnit.id);
          }
        }
        return;
      }

      // Space / Enter: Potvrzení výstřelu/úderu zblízka v režimu míření, nebo ukončení tahu v klidu
      if (state.turn === "player" && !state.isBusy) {
        if (state.actionMode === "shoot" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          state.executeShoot();
          return;
        }
        if (state.actionMode === "melee" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          state.executeMelee();
          return;
        }
        if (state.actionMode !== "shoot" && state.actionMode !== "melee" && e.key === " ") {
          e.preventDefault();
          state.endTurn();
          return;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isInspectKey(e)) return;
      useGameStore.getState().endInspectHold();
    };

    const onBlur = () => {
      useGameStore.getState().cancelInspectHold();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-slate-950 select-none">
      {/* 1. Fullscreen 2.5D React Three Fiber Taktická scéna (100% plocha obrazovky) */}
      <div className="absolute inset-0">
        <TacticalScene />
      </div>

      {/* 2. Filmový středový banner změny tahu */}
      <TurnSplashBanner />

      {/* 2c. Horní rozkazový pruh skriptovaného tutoriálu (XCOM 2 Style) */}
      <TutorialOrderBanner />

      {/* 2b. Krátká dramatická animace na mapě v okamžiku dokonání zajetí maršála (2/2 kola) */}
      {isCapturingAnim && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4">
          <div className="baroque-crimson-cartouche baroque-border rounded-xl px-7 py-3.5 shadow-[0_0_50px_rgba(239,68,68,0.7)] text-center animate-bounce">
            <div className="font-cinzel text-xs font-bold uppercase tracking-widest text-amber-300">
              {text("ui.capture.done", undefined, locale)}
            </div>
            <div className="font-cinzel text-lg md:text-xl font-black uppercase tracking-wider text-rose-100 mt-0.5">
              {text("ui.capture.shackled", undefined, locale)}
            </div>
          </div>
        </div>
      )}

      <InspectDossier />

      {/* 3. Plovoucí periferní HUD widgety (XCOM Architecture) */}
      {/* Levý horní roh: Stav mise, kolo, počasí a Taktický rádce (Tutorial) */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col gap-2.5">
        <MissionStatusChip />
        <TacticalAdvisorWidget />
      </div>

      {/* Pravý horní roh: Kapsle nástrojů kamery, průřez pater a feed kroniky boje (uspořádáno v přirozeném vertikálním toku bez překrývání) */}
      <div className="pointer-events-none absolute top-3 right-3 z-20 flex flex-col items-end gap-2 max-w-xs sm:max-w-sm">
        <TacticalUtilitiesCapsule />
        <CombatChronicleFeed />
      </div>

      {/* Spodní střed: Sjednocená taktická akční lišta (Tactical Action Ribbon & Aiming HUD) */}
      <TacticalActionRibbon />

      {/* 4. Dilema oběti u pramice na Čertovce (Paradoxní oběť) */}
      {sacrificeDilemmaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="max-w-2xl w-full baroque-cartouche baroque-border rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.95)] space-y-5 text-amber-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-amber-900/60 pb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/60 flex items-center justify-center text-amber-300 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <Flame className="w-6 h-6 animate-pulse text-amber-400" />
              </div>
              <div>
                <h2 className="font-cinzel text-xl md:text-2xl font-black uppercase tracking-wider text-amber-200">
                  {text("ui.sacrifice.title", undefined, locale)}
                </h2>
                <div className="font-literata italic text-xs text-amber-400/90 mt-0.5">
                  {text("ui.sacrifice.when", undefined, locale)}
                </div>
              </div>
            </div>

            <p className="font-literata text-sm text-amber-100/90 leading-relaxed bg-black/60 p-4 rounded-xl border border-amber-900/60">
              {sacrificeParts ? (
                <>
                  {sacrificeParts.before}
                  <strong className="font-cinzel text-amber-300 font-bold">
                    {sacrificeParts.mark}
                  </strong>
                  {sacrificeParts.after}
                </>
              ) : (
                sacrificeBody
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Možnost 1: Jan Matěj */}
              {units.some((u) => u.id === "player-jan-matej" && u.alive && u.hp > 0) && (
                <button
                  type="button"
                  onClick={() => chooseSacrifice("player-jan-matej")}
                  className="flex flex-col justify-between p-4 rounded-xl baroque-bronze-btn text-left transition-all group cursor-pointer border border-amber-700/60 hover:border-amber-400"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      <span className="font-cinzel font-bold text-sm text-amber-100 group-hover:text-amber-200">
                        {unitName("player-jan-matej", "nom", locale)}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400/70 font-literata uppercase tracking-wider font-bold block mb-2">
                      {text("ui.sacrifice.matej.role", undefined, locale)}
                    </span>
                    <p className="text-xs text-amber-200/90 italic font-literata leading-snug mb-3">
                      {text("ui.sacrifice.matej.line", undefined, locale)}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-amber-900/60 text-[11px] text-amber-300 font-cinzel font-bold">
                    {text("ui.sacrifice.perkLabel", {
                      names: text("ui.sacrifice.matej.perkName", undefined, locale),
                    }, locale)}
                    <span className="block text-[10px] text-amber-200/70 font-literata font-normal">
                      {text("ui.sacrifice.matej.perk", undefined, locale)}
                    </span>
                  </div>
                </button>
              )}

              {/* Možnost 2: Bratr Bartoloměj */}
              {units.some((u) => u.id === "player-bartolomej" && u.alive && u.hp > 0) && (
                <button
                  type="button"
                  onClick={() => chooseSacrifice("player-bartolomej")}
                  className="flex flex-col justify-between p-4 rounded-xl baroque-bronze-btn text-left transition-all group cursor-pointer border border-amber-700/60 hover:border-amber-400"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      <span className="font-cinzel font-bold text-sm text-amber-100 group-hover:text-amber-200">
                        {unitName("player-bartolomej", "nom", locale)}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400/70 font-literata uppercase tracking-wider font-bold block mb-2">
                      {text("ui.sacrifice.bart.role", undefined, locale)}
                    </span>
                    <p className="text-xs text-amber-200/90 italic font-literata leading-snug mb-3">
                      {text("ui.sacrifice.bart.line", undefined, locale)}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-amber-900/60 text-[11px] text-amber-300 font-cinzel font-bold">
                    {text("ui.sacrifice.perkLabel", {
                      names: text("ui.sacrifice.bart.perkName", undefined, locale),
                    }, locale)}
                    <span className="block text-[10px] text-amber-200/70 font-literata font-normal">
                      {text("ui.sacrifice.bart.perk", undefined, locale)}
                    </span>
                  </div>
                </button>
              )}

              {/* Možnost 3: Václav z Michalovic */}
              {units.some(
                (u) => u.id === "player-vaclav-michalovic" && u.alive && u.hp > 0,
              ) && (
                <button
                  type="button"
                  onClick={() => chooseSacrifice("player-vaclav-michalovic")}
                  className="flex flex-col justify-between p-4 rounded-xl baroque-bronze-btn text-left transition-all group cursor-pointer border border-amber-700/60 hover:border-amber-400"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-cinzel font-bold text-sm text-amber-100 group-hover:text-amber-200">
                        {unitName("player-vaclav-michalovic", "nom", locale)}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400/70 font-literata uppercase tracking-wider font-bold block mb-2">
                      {text("ui.sacrifice.vaclav.role", undefined, locale)}
                    </span>
                    <p className="text-xs text-amber-200/90 italic font-literata leading-snug mb-3">
                      {text("ui.sacrifice.vaclav.line", undefined, locale)}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-amber-900/60 text-[11px] text-amber-300 font-cinzel font-bold">
                    {text("ui.sacrifice.perkLabel", {
                      names: text("ui.sacrifice.vaclav.perkName", undefined, locale),
                    }, locale)}
                    <span className="block text-[10px] text-amber-200/70 font-literata font-normal">
                      {text("ui.sacrifice.vaclav.perk", undefined, locale)}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Modální okno výsledku bitvy */}
      {outcome !== "ongoing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="max-w-xl w-full baroque-cartouche baroque-border rounded-2xl p-6 text-center shadow-[0_0_70px_rgba(0,0,0,0.95)] space-y-4 text-amber-50">
            <div className="mx-auto w-14 h-14 rounded-xl flex items-center justify-center bg-amber-950/80 border border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.35)]">
              {outcome === "victory" ? (
                <Trophy className="w-7 h-7 text-amber-300" />
              ) : (
                <Skull className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <div>
              <h2 className="font-cinzel text-2xl font-black uppercase tracking-wider text-amber-200">
                {outcome === "victory"
                  ? victoryReason === "boat_escape"
                    ? text("ui.epilogue.boatTitle", undefined, locale)
                    : text("ui.epilogue.wipeTitle", undefined, locale)
                  : text("ui.epilogue.defeatTitle", undefined, locale)}
              </h2>
              <div className="font-cinzel text-xs uppercase tracking-widest text-amber-400 mt-1">
                {outcome === "victory"
                  ? text("ui.epilogue.victoryMeta", { count: round }, locale)
                  : text("ui.epilogue.defeatMeta", { count: round }, locale)}
              </div>
            </div>

            <div className="font-literata text-sm text-amber-100/90 leading-relaxed text-left bg-black/60 p-4 rounded-xl border border-amber-900/60 space-y-3">
              {outcome === "victory" ? (
                victoryReason === "boat_escape" ? (
                  <>
                    <div>
                      <strong className="font-cinzel text-amber-300 block mb-0.5">
                        {text("ui.epilogue.boat.1.title", undefined, locale)}
                      </strong>
                      {text("ui.epilogue.boat.1.body", undefined, locale)}
                    </div>

                    <div>
                      <strong className="font-cinzel text-amber-400 block mb-0.5">
                        {text("ui.epilogue.boat.2.title", undefined, locale)}
                      </strong>
                      {text("ui.epilogue.boat.2.body", { heroId: ironVigilPerk?.heroId }, locale)}
                    </div>

                    <div>
                      <strong className="font-cinzel text-amber-200 block mb-0.5">
                        {text("ui.epilogue.boat.3.title", undefined, locale)}
                      </strong>
                      {boat3Parts ? (
                        <>
                          {boat3Parts.before}
                          <em>{boat3Parts.mark}</em>
                          {boat3Parts.after}
                        </>
                      ) : (
                        boat3
                      )}
                    </div>

                    {ironVigilPerk && vigilPerk && (
                      <div className="bg-amber-950/70 border border-amber-500/60 rounded-xl p-3 flex items-start gap-3 mt-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-cinzel text-xs font-bold uppercase tracking-wider text-amber-300">
                            {text("ui.epilogue.perk.member", { heroId: ironVigilPerk.heroId }, locale)}
                          </div>
                          <div className="font-cinzel text-xs font-bold text-amber-100 mt-0.5">
                            {text("ui.epilogue.perk.name", { names: vigilPerk.name }, locale)}
                          </div>
                          <div className="font-literata text-[11px] text-amber-200/80 mt-0.5">
                            {vigilPerk.desc}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <strong className="font-cinzel text-amber-300 block mb-1">
                      {text("ui.epilogue.wipe.heading", undefined, locale)}
                    </strong>
                    {text("ui.epilogue.wipe.body", undefined, locale)}
                  </>
                )
              ) : (
                <>
                  <strong className="font-cinzel text-rose-300 block mb-1">
                    {defeatReason === "surrounded_unprotected"
                      ? text("ui.epilogue.defeat.surrounded", undefined, locale)
                      : defeatReason === "all_companions_fallen"
                        ? text("ui.epilogue.defeat.fallen", undefined, locale)
                        : text("ui.epilogue.defeat.down", undefined, locale)}
                  </strong>
                  {defeatReason === "surrounded_unprotected"
                    ? text("ui.epilogue.defeat.surroundedBody", undefined, locale)
                    : defeatReason === "all_companions_fallen"
                      ? text("ui.epilogue.defeat.fallenBody", undefined, locale)
                      : text("ui.epilogue.defeat.downBody", undefined, locale)}{" "}
                  {text("ui.epilogue.defeat.coda", undefined, locale)}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={resetGame}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-300 text-stone-950 font-cinzel font-bold text-sm uppercase tracking-wider shadow-[0_4px_16px_rgba(245,158,11,0.5)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{text("ui.epilogue.again", undefined, locale)}</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
