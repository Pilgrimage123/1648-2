/**
 * Mission Status Chip (/src/components/ui/MissionStatusChip.tsx).
 * Minimalistický plovoucí widget v levém horním rohu:
 * - Lze chytit a odsunout stranou (useDraggableHud) nebo zúžit tlačítkem sbalení
 * - Kolo a aktivní tah (Obránci Prahy vs. Švédská hlídka)
 * - Cíl mise, počet zbývajících nepřátel a přepínač počasí
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
  Users,
} from "lucide-react";
import { useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { useDraggableHud } from "./useDraggableHud";

export function MissionStatusChip() {
  const round = useGameStore((s) => s.round);
  const turn = useGameStore((s) => s.turn);
  const weather = useGameStore((s) => s.weather);
  const units = useGameStore((s) => s.units);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const cycleWeather = useGameStore((s) => s.cycleWeather);
  const reinforcementsSpawned = useGameStore((s) => s.reinforcementsSpawned);
  const reinforcementRound = useGameStore((s) => s.reinforcementRound);

  const [collapsed, setCollapsed] = useState(false);
  const { dragStyle, onPointerDown, hasMoved, resetOffset } = useDraggableHud();

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
  const isAssisted = colloredo?.movePerAp === 5;
  const detainedTurns = colloredo?.detainedTurns ?? 0;
  const isDetained = detainedTurns > 0 || (colloredo?.hp ?? 1) <= 0;
  const roundsUntilReinforcements = Math.max(0, reinforcementRound - round);

  const weatherLabel =
    weather === "rain"
      ? "Noční liják: -10 % k zásahu, doutnáky v dešti selhávají. Kolečkové zbraně fungují spolehlivě!"
      : weather === "fog"
        ? "Ranní vltavská mlha: -10 % k zásahu"
        : "Jasná noc: optimální podmínky pro střelbu";

  return (
    <aside
      aria-label="Stav mise a kolo"
      style={dragStyle}
      className="pointer-events-auto flex items-center gap-2 baroque-cartouche baroque-border rounded-xl px-2.5 py-1.5 text-amber-50 select-none shadow-[0_4px_24px_rgba(0,0,0,0.85)] bg-slate-950/95 border-amber-500/80 w-fit"
    >
      {/* Přetahovatelný úchyt + 1. Kolo & Frakce na tahu */}
      <div
        onPointerDown={onPointerDown}
        title="Tažením myší můžete panel stavu mise odsunout stranou"
        className={`flex items-center gap-2 cursor-grab active:cursor-grabbing ${
          !collapsed ? "pr-2 border-r border-amber-900/80" : ""
        }`}
      >
        <GripVertical className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
            turn === "player"
              ? "bg-amber-950/90 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              : "bg-red-950/95 border-red-500 text-rose-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]"
          }`}
        >
          {turn === "player" ? (
            <Swords className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-cinzel font-black text-xs tracking-wider text-amber-200 uppercase tabular-nums">
              Kolo {round}
            </span>
            <span className="text-[10px] text-amber-500 font-bold">·</span>
            <span
              className={`font-cinzel text-[11px] font-black uppercase tracking-wide ${
                turn === "player" ? "text-amber-300" : "text-rose-400"
              }`}
            >
              {turn === "player" ? "Obránci" : "Švédové"}
            </span>
          </div>
          {!collapsed && (
            <div className="font-literata text-[10px] text-amber-200/90 italic font-medium truncate max-w-[115px]">
              {turn === "player" ? "Eskorta maršála" : "Hlídka pálí..."}
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* 2. Cíl mise: Rybářská pramice na Čertovce / Varování při zadržení maršála */}
          <div
            title={
              isDetained
                ? `POZOR: Maršál Colloredo je zadržen Švédy (${detainedTurns}/2 kola)!`
                : distToBoat === 0
                  ? "Maršál Colloredo je u pramice!"
                  : `Dostaňte maršála Colloreda k rybářské pramici na Čertovce (zbývá ${distToBoat} polí).`
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all whitespace-nowrap ${
              isDetained
                ? "bg-red-950/95 border-red-400 text-red-200 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.5)]"
                : distToBoat === 0
                  ? "bg-emerald-950/90 border-emerald-400 text-emerald-200"
                  : isAssisted
                    ? "bg-amber-950/80 border-amber-500/70 text-amber-200"
                    : "bg-slate-900 border-amber-900/60 text-amber-100"
            }`}
          >
            <span>{isDetained ? "⛓️" : "⛵"}</span>
            {isDetained ? (
              <span className="font-cinzel text-[10px] font-bold tracking-wide">
                Maršál:{" "}
                <strong className="text-rose-300 font-black">
                  ZADRŽEN ({detainedTurns}/2)
                </strong>
              </span>
            ) : (
              <span className="font-literata text-[11px] tabular-nums">
                Pramice:{" "}
                <strong
                  className={
                    distToBoat === 0
                      ? "font-cinzel text-emerald-300 font-black"
                      : "font-cinzel text-amber-300 font-black"
                  }
                >
                  {distToBoat === 0 ? "ÚNIK!" : `${distToBoat} polí`}
                </strong>
                {isAssisted ? " (+2)" : ""}
              </span>
            )}
          </div>

          {/* 3. Taktický tlak: Odpočet do příchodu švédských posil z Mostecké ulice */}
          {reinforcementsSpawned ? (
            <div
              title="Švédská jízda generála Königsmarcka vtrhla severní branou do zahrady! Chraňte maršála a unikněte k pramici!"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/95 border border-red-500 text-rose-200 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.6)] whitespace-nowrap text-[11px]"
            >
              <span>🚨</span>
              <span className="font-cinzel text-[10px] font-black uppercase tracking-wide text-rose-300">
                Posily v zahradě!
              </span>
            </div>
          ) : (
            <div
              title={
                roundsUntilReinforcements <= 2
                  ? `ŠVÉDSKÉ POSILY SE BLÍŽÍ! Generál Königsmarck vpadne do zahrady za ${roundsUntilReinforcements} ${roundsUntilReinforcements === 1 ? "kolo" : "kola"}!`
                  : `V 5. kole dorazí švédské jízdní posily generála Königsmarcka z Mostecké ulice (zbývá ${roundsUntilReinforcements} ${roundsUntilReinforcements >= 2 && roundsUntilReinforcements <= 4 ? "kola" : "kol"}). Pospěšte k pramici!`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] whitespace-nowrap tabular-nums transition-all ${
                roundsUntilReinforcements <= 1
                  ? "bg-red-950/90 border-red-400 text-rose-200 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                  : roundsUntilReinforcements <= 2
                    ? "bg-amber-950/90 border-amber-500 text-amber-200 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : "bg-slate-900 border-amber-900/60 text-amber-200/90"
              }`}
            >
              <span>{roundsUntilReinforcements <= 1 ? "⚠️" : "🎺"}</span>
              <span className="font-literata">
                Posily:{" "}
                <strong
                  className={`font-cinzel font-black ${
                    roundsUntilReinforcements <= 1
                      ? "text-rose-300"
                      : "text-amber-300"
                  }`}
                >
                  za {roundsUntilReinforcements}{" "}
                  {roundsUntilReinforcements === 1
                    ? "kolo!"
                    : roundsUntilReinforcements <= 4
                      ? "kola"
                      : "kol"}
                </strong>
              </span>
            </div>
          )}

          {/* 4. Počet zbývajících Švédů (včetně odhalených v šerosvitu) */}
          <div
            title={
              fogOfWarEnabled
                ? `Zbývá ${enemiesAlive} Švédů, z toho ${spottedEnemies} přímo odhaleno v zorném poli čety`
                : `Zbývá ${enemiesAlive} Švédů`
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-amber-900/60 text-[11px] text-amber-100 whitespace-nowrap tabular-nums"
          >
            <Users className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-literata">
              Švédů:{" "}
              <strong className="font-cinzel text-amber-200 font-black">
                {enemiesAlive}
              </strong>
              {fogOfWarEnabled && (
                <span className="ml-1 text-[10px] font-cinzel text-amber-300/90">
                  (👁️ {spottedEnemies})
                </span>
              )}
            </span>
          </div>

          {/* 4. Počasí */}
          <button
            type="button"
            onClick={cycleWeather}
            title={`Kliknutím přepnete počasí: ${weatherLabel}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg baroque-bronze-btn text-[11px] font-medium text-amber-200 transition-all cursor-pointer whitespace-nowrap"
          >
            {weather === "rain" ? (
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            ) : weather === "fog" ? (
              <CloudFog className="w-3.5 h-3.5 text-slate-300" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline font-cinzel text-xs text-amber-300 font-black">
              {weather === "rain" ? "Liják" : weather === "fog" ? "Mlha" : "Jasno"}
            </span>
          </button>
        </>
      )}

      {hasMoved && (
        <button
          type="button"
          onClick={resetOffset}
          title="Vrátit panel na výchozí místo"
          className="p-1 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Tlačítko sbalení / rozbalení stavového čipu */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        title={collapsed ? "Rozbalit stav mise" : "Zúžit stav mise"}
        className="p-1 rounded text-amber-400 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
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
