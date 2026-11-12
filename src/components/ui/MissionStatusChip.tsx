/**
 * Mission Status Chip (/src/components/ui/MissionStatusChip.tsx).
 * Ultratenká jednořádková barokní stužka v levém horním rohu (Pilíře 1 & 4):
 * - Žádné vnořené rámečky ani duplicitní pilulky (čistá typografie s oddělovači ·)
 * - Automaticky se skryje při přechodu do akční kamery přes rameno (míření / výstřel)
 */

import {
  ChevronLeft,
  ChevronRight,
  CloudFog,
  CloudRain,
  GripVertical,
  RotateCcw,
  ShieldAlert,
  Sun,
  Swords,
} from "lucide-react";
import { useState } from "react";
import { text, useLocale } from "../../i18n";
import { useGameStore } from "../../store/useGameStore";
import { useDraggableHud } from "./useDraggableHud";

export function MissionStatusChip() {
  const locale = useLocale();
  const round = useGameStore((s) => s.round);
  const turn = useGameStore((s) => s.turn);
  const weather = useGameStore((s) => s.weather);
  const units = useGameStore((s) => s.units);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const isBusy = useGameStore((s) => s.isBusy);
  const activeMovement = useGameStore((s) => s.activeMovement);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const cycleWeather = useGameStore((s) => s.cycleWeather);
  const reinforcementsSpawned = useGameStore((s) => s.reinforcementsSpawned);
  const reinforcementRound = useGameStore((s) => s.reinforcementRound);
  const scenario = useGameStore((s) => s.scenario);
  const m2 = useGameStore((s) => s.m2);

  const [collapsed, setCollapsed] = useState(false);
  const { dragStyle, onPointerDown, hasMoved, resetOffset } = useDraggableHud();

  // Stavový automat HUDu (Pillar 4): V režimu míření přes rameno a při filmové akci se horní lišta skryje
  const isHiddenInActionCam =
    actionMode === "shoot" ||
    actionMode === "melee" ||
    activeProjectile !== null ||
    Boolean(isBusy && activeMovement?.isActionCam);

  if (isHiddenInActionCam) {
    return null;
  }

  const enemiesAlive = units.filter(
    (u) => u.faction === "enemy" && u.alive,
  ).length;
  const spottedEnemies = units.filter(
    (u) =>
      u.faction === "enemy" &&
      u.alive &&
      fogSnapshot.visibleEnemyIds.has(u.id),
  ).length;

  const colloredo = units.find((u) => u.id === "player-colloredo");
  const distToBoat = colloredo
    ? Math.max(
        Math.min(Math.abs(colloredo.pos.x - 2), Math.abs(colloredo.pos.x - 3)),
        Math.abs(colloredo.pos.z - 2),
      )
    : 0;
  const detainedTurns = colloredo?.detainedTurns ?? 0;
  const isDetained = detainedTurns > 0 || (colloredo?.hp ?? 1) <= 0;
  const roundsUntilReinforcements = Math.max(0, reinforcementRound - round);

  const weatherLabel =
    weather === "rain"
      ? text("ui.weather.rain", undefined, locale)
      : weather === "fog"
        ? text("ui.weather.fog", undefined, locale)
        : text("ui.weather.clear", undefined, locale);

  return (
    <aside
      aria-label={text("ui.mission.aria", undefined, locale)}
      style={dragStyle}
      className="pointer-events-auto flex items-center gap-2 baroque-cartouche baroque-border rounded-xl px-2.5 py-1 text-amber-50 select-none shadow-[0_4px_20px_rgba(0,0,0,0.85)] bg-slate-950/88 border-amber-500/65 backdrop-blur-md w-fit"
    >
      {/* Přetahovatelný úchyt + Kolo & Tah */}
      <div
        onPointerDown={onPointerDown}
        title={text("ui.mission.drag", undefined, locale)}
        className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing whitespace-nowrap"
      >
        <GripVertical className="w-3 h-3 text-amber-400/60 shrink-0" />
        {turn === "player" ? (
          <Swords className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
        )}
        <span className="font-cinzel font-black text-[11px] tracking-wider text-amber-200 uppercase tabular-nums">
          {text("ui.mission.round", { count: round }, locale)}
        </span>
        <span className="text-amber-500/70" aria-hidden="true">
          ·
        </span>
        <span
          className={`font-cinzel text-[11px] font-black uppercase tracking-wide ${
            turn === "player" ? "text-amber-300" : "text-rose-400"
          }`}
        >
          {text(turn === "player" ? "ui.mission.defenders" : "ui.mission.swedes", undefined, locale)}
        </span>
      </div>

      {!collapsed && (
        <div className="flex items-center gap-2 text-[11px] text-amber-100/90 whitespace-nowrap tabular-nums pl-2 border-l border-amber-900/70">
          {scenario === "mission2" && m2 ? (
            <>
              <span className="font-literata">
                {text(
                  "ui.mission.rite",
                  { progress: m2.riteProgress, required: m2.riteRequired },
                  locale,
                )}
              </span>
              <span className="text-amber-500/60" aria-hidden="true">
                ·
              </span>
              <span className="font-literata">
                {m2.seated
                  ? text("ui.epilogue.m2.title", undefined, locale)
                  : text(
                      "ui.mission.windlass",
                      {
                        progress: m2.windlassProgress,
                        required: m2.windlassWorkerId === "player-ondrej" ? 1 : 2,
                      },
                      locale,
                    )}
              </span>
              <span className="text-amber-500/60" aria-hidden="true">
                ·
              </span>
              <span className="font-literata">
                {text("ui.mission.windlassHp", { hp: m2.windlassHp }, locale)}
              </span>
            </>
          ) : (
          <>
          <span
            title={
              isDetained
                ? text("ui.mission.detainedTip", { progress: detainedTurns }, locale)
                : text("ui.mission.boatTip", { distance: distToBoat }, locale)
            }
            className={
              isDetained
                ? "font-cinzel font-black text-rose-300 animate-pulse"
                : "font-literata"
            }
          >
            {isDetained ? (
              text("ui.mission.detained", { progress: detainedTurns }, locale)
            ) : (
              <>
                {text("ui.mission.boat", undefined, locale)}{" "}
                <strong className="font-cinzel text-amber-300 font-black">
                  {distToBoat === 0
                    ? text("ui.mission.escape", undefined, locale)
                    : `${distToBoat}m`}
                </strong>
              </>
            )}
          </span>

          <span className="text-amber-500/60" aria-hidden="true">
            ·
          </span>

          {/* Odpočet posil */}
          <span
            title={
              reinforcementsSpawned
                ? text("ui.mission.reinforcementHere", undefined, locale)
                : text("ui.mission.reinforcementIn", { count: roundsUntilReinforcements }, locale)
            }
            className={
              reinforcementsSpawned || roundsUntilReinforcements <= 1
                ? "font-cinzel font-black text-rose-300"
                : "font-literata"
            }
          >
            {reinforcementsSpawned ? (
              text("ui.mission.reinforcementGarden", undefined, locale)
            ) : (
              <>
                {text("ui.mission.reinforcement", undefined, locale)}{" "}
                <strong className="font-cinzel text-amber-300 font-black">
                  {roundsUntilReinforcements}k
                </strong>
              </>
            )}
          </span>
          </>
          )}

          <span className="text-amber-500/60" aria-hidden="true">
            ·
          </span>

          {/* Počet nepřátel */}
          <span
            title={
              fogOfWarEnabled
                ? text(
                    "ui.mission.enemyTipSeen",
                    { count: enemiesAlive, required: spottedEnemies },
                    locale,
                  )
                : text("ui.mission.enemyTip", { count: enemiesAlive }, locale)
            }
            className="font-literata"
          >
            {text("ui.mission.enemies", undefined, locale)}{" "}
            <strong className="font-cinzel text-rose-300 font-black">
              {enemiesAlive}
            </strong>
            {fogOfWarEnabled && (
              <span className="text-[10px] text-amber-300/85">
                {" "}
                {text("ui.mission.seen", { count: spottedEnemies }, locale)}
              </span>
            )}
          </span>

          <span className="text-amber-500/60" aria-hidden="true">
            ·
          </span>

          {/* Přepínač počasí */}
          <button
            type="button"
            onClick={cycleWeather}
            title={text("ui.mission.weatherCycle", { names: weatherLabel }, locale)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-amber-950/80 text-amber-200 hover:text-amber-100 transition-colors cursor-pointer"
          >
            {weather === "rain" ? (
              <CloudRain className="w-3 h-3 text-sky-400" />
            ) : weather === "fog" ? (
              <CloudFog className="w-3 h-3 text-slate-300" />
            ) : (
              <Sun className="w-3 h-3 text-amber-400" />
            )}
            <span className="hidden sm:inline font-cinzel text-[10px] font-bold text-amber-300">
              {text(
                weather === "rain"
                  ? "ui.weather.rain.short"
                  : weather === "fog"
                    ? "ui.weather.fog.short"
                    : "ui.weather.clear.short",
                undefined,
                locale,
              )}
            </span>
          </button>
        </div>
      )}

      {hasMoved && (
        <button
          type="button"
          onClick={resetOffset}
          title={text("ui.mission.reset", undefined, locale)}
          className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        title={text(
          collapsed ? "ui.mission.expand" : "ui.mission.collapse",
          undefined,
          locale,
        )}
        className="p-0.5 rounded text-amber-400 hover:text-amber-100 transition-colors cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
