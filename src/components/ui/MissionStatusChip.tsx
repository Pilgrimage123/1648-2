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
import { useGameStore } from "../../store/useGameStore";
import { useDraggableHud } from "./useDraggableHud";

export function MissionStatusChip() {
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
      ? "Noční liják: -10 % k zásahu, doutnáky v dešti selhávají"
      : weather === "fog"
        ? "Ranní vltavská mlha: -10 % k zásahu"
        : "Jasná noc: optimální podmínky pro střelbu";

  return (
    <aside
      aria-label="Stav mise a kolo"
      style={dragStyle}
      className="pointer-events-auto flex items-center gap-2 baroque-cartouche baroque-border rounded-xl px-2.5 py-1 text-amber-50 select-none shadow-[0_4px_20px_rgba(0,0,0,0.85)] bg-slate-950/88 border-amber-500/65 backdrop-blur-md w-fit"
    >
      {/* Přetahovatelný úchyt + Kolo & Tah */}
      <div
        onPointerDown={onPointerDown}
        title="Tažením myší můžete stužku stavu mise odsunout"
        className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing whitespace-nowrap"
      >
        <GripVertical className="w-3 h-3 text-amber-400/60 shrink-0" />
        {turn === "player" ? (
          <Swords className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
        )}
        <span className="font-cinzel font-black text-[11px] tracking-wider text-amber-200 uppercase tabular-nums">
          Kolo {round}
        </span>
        <span className="text-amber-500/70" aria-hidden="true">
          ·
        </span>
        <span
          className={`font-cinzel text-[11px] font-black uppercase tracking-wide ${
            turn === "player" ? "text-amber-300" : "text-rose-400"
          }`}
        >
          {turn === "player" ? "Obránci" : "Švédové"}
        </span>
      </div>

      {!collapsed && (
        <div className="flex items-center gap-2 text-[11px] text-amber-100/90 whitespace-nowrap tabular-nums pl-2 border-l border-amber-900/70">
          {/* Cíl mise: Pramice / Zadržení maršála */}
          <span
            title={
              isDetained
                ? `POZOR: Maršál Colloredo je zadržen Švédy (${detainedTurns}/2 kola)!`
                : `Vzdálenost maršála Colloreda k rybářské pramici na Čertovce: ${distToBoat} polí`
            }
            className={
              isDetained
                ? "font-cinzel font-black text-rose-300 animate-pulse"
                : "font-literata"
            }
          >
            {isDetained ? (
              `Maršál ZADRŽEN (${detainedTurns}/2)`
            ) : (
              <>
                Pramice{" "}
                <strong className="font-cinzel text-amber-300 font-black">
                  {distToBoat === 0 ? "ÚNIK!" : `${distToBoat}m`}
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
                ? "Švédská jízda generála Königsmarcka vtrhla severní branou do zahrady!"
                : `Švédské jízdní posily dorazí za ${roundsUntilReinforcements} kola`
            }
            className={
              reinforcementsSpawned || roundsUntilReinforcements <= 1
                ? "font-cinzel font-black text-rose-300"
                : "font-literata"
            }
          >
            {reinforcementsSpawned ? (
              "Posily v zahradě!"
            ) : (
              <>
                Posily{" "}
                <strong className="font-cinzel text-amber-300 font-black">
                  {roundsUntilReinforcements}k
                </strong>
              </>
            )}
          </span>

          <span className="text-amber-500/60" aria-hidden="true">
            ·
          </span>

          {/* Počet nepřátel */}
          <span
            title={
              fogOfWarEnabled
                ? `Zbývá ${enemiesAlive} Švédů (${spottedEnemies} v přímém dohledu)`
                : `Zbývá ${enemiesAlive} Švédů`
            }
            className="font-literata"
          >
            Švédů{" "}
            <strong className="font-cinzel text-rose-300 font-black">
              {enemiesAlive}
            </strong>
            {fogOfWarEnabled && (
              <span className="text-[10px] text-amber-300/85">
                {" "}
                ({spottedEnemies} vid.)
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
            title={`Přepnout počasí: ${weatherLabel}`}
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
              {weather === "rain"
                ? "Liják"
                : weather === "fog"
                  ? "Mlha"
                  : "Jasno"}
            </span>
          </button>
        </div>
      )}

      {hasMoved && (
        <button
          type="button"
          onClick={resetOffset}
          title="Vrátit stužku na výchozí místo"
          className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        title={collapsed ? "Rozbalit stav mise" : "Sbalit stav mise"}
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
