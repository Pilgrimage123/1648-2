/**
 * Tactical Utilities Capsule & Architectural Floor Cross-Section Stack (/src/components/ui/TacticalUtilitiesCapsule.tsx).
 * Poskytuje:
 * 1. Horní lištu nástrojů kamery (Q / E), přepínač 2D/3D (M), Fullscreen (F), Rádce (H) a Restart.
 * 2. Přehledný vertikální průřez 3 pater budovy (P2 Maltézská věž / P1 Piano Nobile & Belveder / P0 Přízemí & Zahrada):
 *    - Okamžitě ukazuje, ve kterém patře stojí vybraný hrdina, ostatní spojenci i nepřátelé.
 *    - Kliknutím na jméno/ikonu jednotky v daném patře ji rovnou vybere a přepne řez patra.
 *    - Zvýrazňuje symbol schodiště `↑ 1 AP` / `↑ 2 AP`, pokud vybraná postava může do daného patra v tomto tahu vystoupat/sestoupit.
 */

import {
  ArrowUpDown,
  Box,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import type { FloorLevel } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";

const FLOOR_META: {
  floor: FloorLevel;
  code: string;
  title: string;
  subtitle: string;
}[] = [
  {
    floor: 2,
    code: "P2",
    title: "Maltézská věž",
    subtitle: "Střešní ochoz (+15 % zásah, +5.5 dohled)",
  },
  {
    floor: 1,
    code: "P1",
    title: "Piano Nobile & Belveder",
    subtitle: "1. patro paláce a terasa (+2.2 dohled)",
  },
  {
    floor: 0,
    code: "P0",
    title: "Přízemí & Zahrada",
    subtitle: "Nádvoří, Sala Terrena, Čertovka",
  },
];

export function TacticalUtilitiesCapsule() {
  const activeFloor = useGameStore((s) => s.activeFloor);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const units = useGameStore((s) => s.units);
  const reachableTiles = useGameStore((s) => s.reachableTiles);
  const renderMode = useGameStore((s) => s.renderMode);
  const isFullscreen = useGameStore((s) => s.isFullscreen);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);

  const setActiveFloor = useGameStore((s) => s.setActiveFloor);
  const toggleFloor = useGameStore((s) => s.toggleFloor);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const handleUnitClick = useGameStore((s) => s.handleUnitClick);
  const toggleRenderMode = useGameStore((s) => s.toggleRenderMode);
  const toggleFogOfWar = useGameStore((s) => s.toggleFogOfWar);
  const toggleFullscreen = useGameStore((s) => s.toggleFullscreen);
  const toggleTutorial = useGameStore((s) => s.toggleTutorial);
  const rotateCamera = useGameStore((s) => s.rotateCamera);
  const resetGame = useGameStore((s) => s.resetGame);

  const [stackExpanded, setStackExpanded] = useState(true);

  const selectedUnit = units.find((u) => u.id === selectedUnitId && u.alive);
  const isShootingView = actionMode === "shoot" || activeProjectile !== null;
  const selectedSightRadius = selectedUnit
    ? fogSnapshot.unitSightRadii[selectedUnit.id]
    : undefined;

  // Zjistíme pro každé patro, zda do něj vybraná jednotka může v tomto tahu dojít po schodišti (a za kolik AP)
  const floorReachability = (floor: FloorLevel): 1 | 2 | null => {
    if (!selectedUnit || selectedUnit.pos.y === floor) return null;
    let bestAp: 1 | 2 | null = null;
    for (const r of reachableTiles.values()) {
      if (r.coord.y === floor) {
        if (r.apCost === 1) return 1;
        bestAp = 2;
      }
    }
    return bestAp;
  };

  return (
    <div className="pointer-events-none flex flex-col items-end gap-2 select-none">
      {/* 1. Horní kompaktní lišta nástrojů kamery a zobrazení */}
      <nav
        aria-label="Taktické nástroje a kamera"
        className="pointer-events-auto flex flex-wrap items-center gap-1.5 baroque-cartouche baroque-border rounded-xl p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.85)] text-amber-100 bg-slate-950/95 border-amber-500/80"
      >
        {/* Rotace kamery (Q / E) */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-amber-900/80">
          <button
            type="button"
            onClick={() => rotateCamera(-1)}
            title="Otočit pohled o 90° vlevo (klávesa Q)"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-cinzel font-black text-amber-200 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-amber-300 font-cinzel font-black">
              Q
            </span>
          </button>
          <button
            type="button"
            onClick={() => rotateCamera(1)}
            title="Otočit pohled o 90° vpravo (klávesa E)"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-cinzel font-black text-amber-200 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
          >
            <span className="text-[10px] text-amber-300 font-cinzel font-black">
              E
            </span>
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>

        {/* Rychlý přepínač průřezu pater */}
        <button
          type="button"
          onClick={() => setStackExpanded((p) => !p)}
          title="Rozbalit / sbalit vertikální průřez pater paláce (klávesy V / PageUp / PageDown / Alt+Kolečko)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900/80 border border-amber-400/80 text-xs font-cinzel font-black text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Patro P{activeFloor}</span>
          {stackExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-amber-300" />
          )}
        </button>

        {/* Barokní šerosvit / Mlha války (klávesa G) */}
        <button
          type="button"
          onClick={toggleFogOfWar}
          title={
            fogOfWarEnabled
              ? "Barokní šerosvit (Mlha války) aktivní — kliknutím vypnout (klávesa G)"
              : "Zapnout barokní šerosvit / Mlhu války (klávesa G)"
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-cinzel font-black transition-all cursor-pointer ${
            fogOfWarEnabled
              ? "bg-amber-600/40 border-amber-400 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
              : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
          }`}
        >
          {fogOfWarEnabled ? (
            <Eye className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="hidden sm:inline">Šerosvit</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-amber-300 font-cinzel font-black border border-amber-900/80">
            G
          </span>
        </button>

        {/* 2D Billboard Sprity / 3D Modely (M) */}
        <button
          type="button"
          onClick={toggleRenderMode}
          title="Přepnout zobrazení jednotek: 2D sprity / 3D modely (klávesa M)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg baroque-bronze-btn text-xs font-cinzel font-black text-amber-200 hover:text-amber-100 transition-all cursor-pointer"
        >
          {renderMode === "2D_SPRITE" ? (
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Box className="w-3.5 h-3.5 text-amber-300" />
          )}
          <span>{renderMode === "2D_SPRITE" ? "2D" : "3D"}</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-amber-300 font-cinzel font-black border border-amber-900/80">
            M
          </span>
        </button>

        {/* Celá obrazovka / Fullscreen (klávesa F) */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Přepnout režim celé obrazovky — Fullscreen (klávesa F)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-cinzel font-black transition-all cursor-pointer ${
            isFullscreen
              ? "bg-amber-600/40 border-amber-400 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
              : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
          }`}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="hidden md:inline">Fullscreen</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-amber-300 font-cinzel font-black border border-amber-900/80">
            F
          </span>
        </button>

        {/* Taktický rádce / Tutoriál (klávesa H) */}
        <button
          type="button"
          onClick={toggleTutorial}
          title={
            tutorialDismissed
              ? "Otevřít taktického rádce (klávesa H)"
              : "Skrýt taktického rádce (klávesa H)"
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-cinzel font-black transition-all cursor-pointer ${
            !tutorialDismissed && tutorialStep !== null
              ? "bg-amber-600/40 border-amber-400 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
              : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Rádce</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-amber-300 font-cinzel font-black border border-amber-900/80">
            H
          </span>
        </button>

        {/* Restart mise */}
        <button
          type="button"
          onClick={resetGame}
          title="Restartovat aktuální bitvu"
          className="p-1.5 rounded-lg baroque-bronze-btn text-amber-300 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* 2. Vertikální architektonický průřez pater Velkopřevorského paláce (P2 -> P1 -> P0) */}
      {stackExpanded && !isShootingView && (
        <aside
          aria-label="Průřez pater Velkopřevorského paláce"
          className="pointer-events-auto w-72 sm:w-80 baroque-cartouche baroque-border rounded-xl p-2 shadow-[0_8px_28px_rgba(0,0,0,0.9)] bg-slate-950/95 border-amber-500/80 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between px-1 pb-1 border-b border-amber-900/70">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-cinzel font-black text-[11px] uppercase tracking-wider text-amber-200">
                Průřez pater paláce
              </span>
              {fogOfWarEnabled && selectedSightRadius !== undefined && (
                <span
                  title="Aktuální dosah zraku vybraného vojáka (ovlivněn výškou patra, počasím a kouřem)"
                  className="px-1.5 py-0.2 rounded bg-amber-950/90 border border-amber-500/60 text-[9px] font-cinzel font-black text-amber-300 tabular-nums"
                >
                  👁️ {selectedSightRadius}m
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedUnit && selectedUnit.pos.y !== activeFloor && (
                <button
                  type="button"
                  onClick={() => setActiveFloor(selectedUnit.pos.y)}
                  title="Přepnout pohled do patra aktuálně vybraného vojáka"
                  className="px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-400 text-[9px] font-cinzel font-black text-sky-200 hover:bg-sky-900 transition-colors cursor-pointer"
                >
                  K vojákovi (P{selectedUnit.pos.y})
                </button>
              )}
              <button
                type="button"
                onClick={toggleFloor}
                title="Cyklicky přepnout patro [Klávesa V / PageUp / PageDown / Alt+Kolečko]"
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-800/80 hover:border-amber-400 text-[9px] font-cinzel font-black text-amber-300 cursor-pointer"
              >
                [V] Další
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {FLOOR_META.map(({ floor, code, title, subtitle }) => {
              const isCurrentView = activeFloor === floor;
              const isSelectedUnitHere = selectedUnit?.pos.y === floor;
              const reachAp = floorReachability(floor);
              const alliesOnFloor = units.filter(
                (u) => u.alive && u.faction === "player" && u.pos.y === floor,
              );
              const enemiesOnFloor = units.filter(
                (u) => u.alive && u.faction === "enemy" && u.pos.y === floor,
              );

              return (
                <div
                  key={floor}
                  onClick={() => setActiveFloor(floor)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveFloor(floor);
                    }
                  }}
                  className={`group flex flex-col gap-1 rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer ${
                    isCurrentView
                      ? "bg-amber-950/65 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.3)]"
                      : "bg-slate-900/85 border-slate-800 hover:border-amber-700/70 hover:bg-slate-900"
                  }`}
                >
                  {/* Horní řádek patra: Označení P2/P1/P0 + Název + Indikátor schodiště */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-cinzel font-black tabular-nums border ${
                          isCurrentView
                            ? "bg-amber-400 text-slate-950 border-amber-200"
                            : isSelectedUnitHere
                              ? "bg-sky-500/30 text-sky-200 border-sky-400"
                              : "bg-slate-950 text-amber-300/90 border-amber-900/70"
                        }`}
                      >
                        {code}
                      </span>
                      <div className="min-w-0">
                        <div className="font-cinzel font-bold text-xs text-amber-100 truncate leading-tight">
                          {title}
                        </div>
                        <div className="font-literata text-[9px] text-amber-300/75 truncate leading-tight">
                          {subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Odznak dosažitelnosti patra po schodišti pro vybraného vojáka */}
                      {reachAp !== null && (
                        <span
                          title={`Vybraný voják (${selectedUnit?.name}) může do tohoto patra dojít po schodišti za ${reachAp} AP!`}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-cinzel font-black border ${
                            reachAp === 1
                              ? "bg-sky-950/95 text-sky-300 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]"
                              : "bg-amber-950/95 text-amber-300 border-amber-400"
                          }`}
                        >
                          <ArrowUpDown className="w-2.5 h-2.5" />
                          <span>{reachAp} AP</span>
                        </span>
                      )}

                      {isCurrentView && (
                        <span
                          title="Právě zobrazené patro kamery"
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/70 text-[9px] font-cinzel font-black text-amber-200"
                        >
                          <Eye className="w-2.5 h-2.5 text-amber-300" />
                          <span>Pohled</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Spodní řádek patra: Interaktivní štítky jednotek stojících v tomto patře */}
                  {(alliesOnFloor.length > 0 || enemiesOnFloor.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5 border-t border-amber-900/40">
                      {alliesOnFloor.map((ally) => {
                        const isSel = ally.id === selectedUnitId;
                        return (
                          <button
                            key={ally.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectUnit(ally.id);
                            }}
                            title={`Vybrat: ${ally.name} (patro P${floor}, ${ally.ap} AP)`}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-cinzel font-bold border transition-all cursor-pointer ${
                              isSel
                                ? "bg-sky-500/35 border-sky-300 text-white shadow-[0_0_8px_rgba(56,189,248,0.45)]"
                                : "bg-slate-950/90 border-amber-500/50 text-amber-200 hover:border-amber-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                ally.ap > 0 ? "bg-emerald-400" : "bg-slate-500"
                              }`}
                            />
                            <span>{ally.name}</span>
                          </button>
                        );
                      })}

                      {enemiesOnFloor.map((enemy) => {
                        const isSpotted =
                          !fogOfWarEnabled ||
                          fogSnapshot.visibleEnemyIds.has(enemy.id);
                        const contact = fogSnapshot.soundContacts.find(
                          (c) => c.unitId === enemy.id,
                        );
                        if (!isSpotted && !contact) return null;

                        const enemyLabel = !isSpotted
                          ? contact?.kind === "matchcord_glow"
                            ? "[?] Žhnoucí doutnák"
                            : "[?] Šramot kroků"
                          : enemy.name;

                        return (
                          <button
                            key={enemy.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFloor(floor);
                              handleUnitClick(enemy.id);
                            }}
                            title={
                              isSpotted
                                ? `Nepřítel v patře P${floor}: ${enemy.name} (${enemy.hp}/${enemy.maxHp} HP) — kliknutím zaměřit nebo zobrazit patro`
                                : `Nepřátelský kontakt v šerosvitu (P${floor}): ${contact?.label} — přibližte se pro odhalení`
                            }
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-cinzel font-bold transition-all cursor-pointer ${
                              isSpotted
                                ? "bg-rose-950/90 border-rose-500/70 hover:border-rose-300 text-rose-200"
                                : "bg-slate-950/90 border-amber-500/50 hover:border-amber-300 text-amber-300/90"
                            }`}
                          >
                            {isSpotted ? (
                              <Crosshair className="w-2.5 h-2.5 text-rose-400" />
                            ) : (
                              <Flame className="w-2.5 h-2.5 text-orange-400 animate-pulse" />
                            )}
                            <span>{enemyLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-1 pt-0.5 text-[9px] font-literata text-amber-300/80">
            <span>Tip: Klikněte přímo na 3D schodiště pro chůzi mezi patry</span>
            <span className="font-cinzel font-bold text-amber-300">
              PgUp / PgDn
            </span>
          </div>
        </aside>
      )}
    </div>
  );
}
