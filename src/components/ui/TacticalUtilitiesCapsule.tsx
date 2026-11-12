/**
 * Tactical Utilities Capsule (/src/components/ui/TacticalUtilitiesCapsule.tsx).
 * Ultratenká horní lišta nástrojů kamery a pater (Pilíře 1 & 4):
 * - Architektonický průřez pater je ve výchozím stavu sbalený (Progressive Disclosure), aby nezakrýval pravou stranu bojiště.
 * - V režimu míření přes rameno a při letu projektilu se kapsle automaticky skryje (HUD State Machine).
 */

import {
  ArrowUpDown,
  Box,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  EyeOff,
  Film,
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
import { listLocales, setLocale, text, useLocale, type MessageId } from "../../i18n";
import { useGameStore } from "../../store/useGameStore";

const PALACE_FLOORS: {
  floor: FloorLevel;
  code: string;
  title: MessageId;
  subtitle: MessageId;
}[] = [
  {
    floor: 2,
    code: "P2",
    title: "ui.floor.2.title",
    subtitle: "ui.floor.2.sub",
  },
  {
    floor: 1,
    code: "P1",
    title: "ui.floor.1.title",
    subtitle: "ui.floor.1.sub",
  },
  {
    floor: 0,
    code: "P0",
    title: "ui.floor.0.title",
    subtitle: "ui.floor.0.sub",
  },
];

const TOWER_FLOORS: typeof PALACE_FLOORS = [
  {
    floor: 2,
    code: "P2",
    title: "ui.floor.m2.2.title",
    subtitle: "ui.floor.m2.2.sub",
  },
  {
    floor: 1,
    code: "P1",
    title: "ui.floor.m2.1.title",
    subtitle: "ui.floor.m2.1.sub",
  },
  {
    floor: 0,
    code: "P0",
    title: "ui.floor.m2.0.title",
    subtitle: "ui.floor.m2.0.sub",
  },
];

export function TacticalUtilitiesCapsule() {
  const activeFloor = useGameStore((s) => s.activeFloor);
  const scenario = useGameStore((s) => s.scenario);
  const floorMeta = scenario === "mission2" ? TOWER_FLOORS : PALACE_FLOORS;
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const units = useGameStore((s) => s.units);
  const reachableTiles = useGameStore((s) => s.reachableTiles);
  const renderMode = useGameStore((s) => s.renderMode);
  const isFullscreen = useGameStore((s) => s.isFullscreen);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const isBusy = useGameStore((s) => s.isBusy);
  const activeMovement = useGameStore((s) => s.activeMovement);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const actionCamEnabled = useGameStore((s) => s.actionCamEnabled);

  const setActiveFloor = useGameStore((s) => s.setActiveFloor);
  const toggleFloor = useGameStore((s) => s.toggleFloor);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const handleUnitClick = useGameStore((s) => s.handleUnitClick);
  const toggleRenderMode = useGameStore((s) => s.toggleRenderMode);
  const toggleFogOfWar = useGameStore((s) => s.toggleFogOfWar);
  const toggleActionCam = useGameStore((s) => s.toggleActionCam);
  const toggleFullscreen = useGameStore((s) => s.toggleFullscreen);
  const toggleTutorial = useGameStore((s) => s.toggleTutorial);
  const rotateCamera = useGameStore((s) => s.rotateCamera);
  const resetGame = useGameStore((s) => s.resetGame);
  const locale = useLocale();
  const locales = listLocales();

  // Kontextové vrstvení (Pillar 1): Průřez pater je ve výchozím stavu sbalený, rozbalí se na vyžádání
  const [stackExpanded, setStackExpanded] = useState(false);

  // Stavový automat HUDu (Pillar 4): Skrýt při akční kameře přes rameno a střelbě
  const isHiddenInActionCam =
    actionMode === "shoot" ||
    actionMode === "melee" ||
    activeProjectile !== null ||
    Boolean(isBusy && activeMovement?.isActionCam);

  if (isHiddenInActionCam) {
    return null;
  }

  const selectedUnit = units.find((u) => u.id === selectedUnitId && u.alive);
  const selectedSightRadius = selectedUnit
    ? fogSnapshot.unitSightRadii[selectedUnit.id]
    : undefined;

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
    <div className="pointer-events-none flex flex-col items-end gap-1.5 select-none">
      {/* 1. Kompaktní jednořádková lišta nástrojů */}
      <nav
        aria-label={text("ui.tools.aria", undefined, locale)}
        className="pointer-events-auto flex items-center gap-1 baroque-cartouche baroque-border rounded-xl px-2 py-1 shadow-[0_4px_20px_rgba(0,0,0,0.85)] text-amber-100 bg-slate-950/88 border-amber-500/65 backdrop-blur-md"
      >
        {/* Rotace kamery (Q / E) */}
        <div className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-amber-900/70">
          <button
            type="button"
            onClick={() => rotateCamera(-1)}
            title={text("ui.camera.left", undefined, locale)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-cinzel font-black text-amber-200 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Q</span>
          </button>
          <button
            type="button"
            onClick={() => rotateCamera(1)}
            title={text("ui.camera.right", undefined, locale)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-cinzel font-black text-amber-200 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
          >
            <span>E</span>
            <RotateCw className="w-3 h-3 text-amber-400" />
          </button>
        </div>

        {/* Rychlá přímá tlačítka pater P0 / P1 / P2 */}
        <div
          role="group"
          aria-label={text("ui.floors.aria", undefined, locale)}
          className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-amber-900/70"
        >
          {([0, 1, 2] as const).map((floor) => {
            const isActive = activeFloor === floor;
            return (
              <button
                key={floor}
                type="button"
                onClick={() => setActiveFloor(floor)}
                title={text("ui.floors.switch", { floor }, locale)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-cinzel font-black transition-all cursor-pointer ${
                  isActive
                    ? "bg-amber-400 text-slate-950 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                    : "text-amber-300/80 hover:text-amber-100"
                }`}
              >
                P{floor}
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label={text("ui.locale.switch", { names: locales.map((pack) => pack.endonym).join(", ") }, locale)}
          className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-amber-900/70"
        >
          {locales.map((pack) => (
            <button
              key={pack.id}
              type="button"
              title={text("ui.locale.switch", { names: pack.endonym }, locale)}
              aria-pressed={locale === pack.id}
              onClick={() => setLocale(pack.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-cinzel font-black transition-all cursor-pointer ${
                locale === pack.id
                  ? "bg-amber-400 text-slate-950 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                  : "text-amber-300/80 hover:text-amber-100"
              }`}
            >
              {pack.endonym}
            </button>
          ))}
        </div>

        {/* Tlačítko rozbalení / sbalení průřezu pater */}
        <button
          type="button"
          onClick={() => setStackExpanded((p) => !p)}
          title={text("ui.floors.stack", undefined, locale)}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-cinzel font-black transition-all cursor-pointer ${
            stackExpanded
              ? "bg-amber-950/90 border-amber-400 text-amber-100"
              : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
          }`}
        >
          <Layers className="w-3 h-3 text-amber-400" />
          <span className="hidden md:inline">{text("ui.floors.word", undefined, locale)}</span>
          {stackExpanded ? (
            <ChevronUp className="w-2.5 h-2.5 text-amber-300" />
          ) : (
            <ChevronDown className="w-2.5 h-2.5 text-amber-300" />
          )}
        </button>

        {/* Mlha války / Šerosvit [G] */}
        <button
          type="button"
          onClick={toggleFogOfWar}
          title={text("ui.fog.title", undefined, locale)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            fogOfWarEnabled
              ? "bg-amber-600/35 border-amber-400 text-amber-200"
              : "baroque-bronze-btn text-slate-400 hover:text-amber-100"
          }`}
        >
          {fogOfWarEnabled ? (
            <Eye className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Akční kamera [C] */}
        <button
          type="button"
          onClick={toggleActionCam}
          title={text("ui.camera.action", undefined, locale)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            actionCamEnabled
              ? "bg-amber-600/35 border-amber-400 text-amber-200"
              : "baroque-bronze-btn text-amber-200/50 hover:text-amber-100"
          }`}
        >
          <Film className="w-3.5 h-3.5 text-amber-300" />
        </button>

        {/* 2D / 3D [M] */}
        <button
          type="button"
          onClick={toggleRenderMode}
          title={text("ui.render.mode", undefined, locale)}
          className="flex items-center gap-1 px-1.5 py-1 rounded-lg baroque-bronze-btn text-[10px] font-cinzel font-black text-amber-200 hover:text-amber-100 cursor-pointer"
        >
          {renderMode === "2D_SPRITE" ? (
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Box className="w-3.5 h-3.5 text-amber-300" />
          )}
          <span>{renderMode === "2D_SPRITE" ? "2D" : "3D"}</span>
        </button>

        {/* Fullscreen [F] */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={text("ui.fullscreen", undefined, locale)}
          className="p-1.5 rounded-lg baroque-bronze-btn text-amber-300 hover:text-amber-100 cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Rádce [H] */}
        <button
          type="button"
          onClick={toggleTutorial}
          title={text("ui.advisor.toggle", undefined, locale)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            !tutorialDismissed && tutorialStep !== null
              ? "bg-amber-600/35 border-amber-400 text-amber-200"
              : "baroque-bronze-btn text-amber-300 hover:text-amber-100"
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
        </button>

        {/* Restart */}
        <button
          type="button"
          onClick={resetGame}
          title={text("ui.battle.restart", undefined, locale)}
          className="p-1.5 rounded-lg baroque-bronze-btn text-amber-300 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* 2. Na vyžádání rozbalitelný Průřez pater (Progressive Disclosure) */}
      {stackExpanded && (
        <aside
          aria-label={text("ui.floors.sectionAria", undefined, locale)}
          className="pointer-events-auto w-72 baroque-cartouche baroque-border rounded-xl p-2 shadow-[0_8px_28px_rgba(0,0,0,0.9)] bg-slate-950/92 border-amber-500/70 backdrop-blur-md flex flex-col gap-1.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between px-1 pb-1 border-b border-amber-900/70">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-200">
                {text("ui.floors.section", undefined, locale)}
              </span>
              {fogOfWarEnabled && selectedSightRadius !== undefined && (
                <span className="text-[9px] font-cinzel font-bold text-amber-300 tabular-nums">
                  {text("ui.floors.sight", { distance: selectedSightRadius }, locale)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleFloor}
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-800/80 hover:border-amber-400 text-[9px] font-cinzel font-black text-amber-300 cursor-pointer"
            >
              {text("ui.floors.cycle", undefined, locale)}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {floorMeta.map(({ floor, code, title, subtitle }) => {
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
                  className={`flex flex-col gap-1 rounded-lg px-2 py-1 border transition-all cursor-pointer ${
                    isCurrentView
                      ? "bg-amber-950/60 border-amber-400"
                      : "bg-slate-900/85 border-slate-800 hover:border-amber-700/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-cinzel font-black tabular-nums border ${
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
                        <div className="font-cinzel font-bold text-[11px] text-amber-100 truncate leading-tight">
                          {text(title, undefined, locale)}
                        </div>
                        <div className="font-literata text-[9px] text-amber-300/75 truncate leading-tight">
                          {text(subtitle, undefined, locale)}
                        </div>
                      </div>
                    </div>

                    {reachAp !== null && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-cinzel font-black bg-sky-950/90 text-sky-300 border border-sky-400/70 shrink-0">
                        <ArrowUpDown className="w-2.5 h-2.5" />
                        <span>{reachAp} AP</span>
                      </span>
                    )}
                  </div>

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
                            className={`px-1.5 py-0.5 rounded text-[8px] font-cinzel font-bold border transition-all cursor-pointer ${
                              isSel
                                ? "bg-sky-500/35 border-sky-300 text-white"
                                : "bg-slate-950/90 border-amber-500/50 text-amber-200"
                            }`}
                          >
                            {ally.name}
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

                        return (
                          <button
                            key={enemy.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFloor(floor);
                              handleUnitClick(enemy.id);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-rose-500/70 bg-rose-950/90 text-[8px] font-cinzel font-bold text-rose-200 cursor-pointer"
                          >
                            {isSpotted ? (
                              <Crosshair className="w-2.5 h-2.5 text-rose-400" />
                            ) : (
                              <Flame className="w-2.5 h-2.5 text-orange-400" />
                            )}
                            <span>{isSpotted ? enemy.name : text("ui.contact.mark", undefined, locale)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}
