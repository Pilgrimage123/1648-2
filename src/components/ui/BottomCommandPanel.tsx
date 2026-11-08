/**
 * Bottom Tactical Command Panel (/src/components/ui/BottomCommandPanel.tsx).
 * Displays selected soldier details (Name, HP, AP, Cover, Floor), action buttons
 * (Střelba, Overwatch, Granát, Konec tahu), and the scrollable combat log.
 */

import {
  Bomb,
  Crosshair,
  Eye,
  Footprints,
  SkipForward,
  User,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { bestTileCover } from "../../core/GridSystem";
import { useGameStore } from "../../store/useGameStore";

export function BottomCommandPanel() {
  const grid = useGameStore((s) => s.grid);
  const units = useGameStore((s) => s.units);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const turn = useGameStore((s) => s.turn);
  const isBusy = useGameStore((s) => s.isBusy);
  const actionMode = useGameStore((s) => s.actionMode);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const combatLog = useGameStore((s) => s.combatLog);

  const selectUnit = useGameStore((s) => s.selectUnit);
  const setActionMode = useGameStore((s) => s.setActionMode);
  const activateOverwatch = useGameStore((s) => s.activateOverwatch);
  const endTurn = useGameStore((s) => s.endTurn);

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [combatLog]);

  const playerUnits = units.filter((u) => u.faction === "player");
  const selectedUnit =
    units.find((u) => u.id === selectedUnitId && u.alive) ?? null;

  const canCommand = turn === "player" && !isBusy;
  const hasAp = (selectedUnit?.ap ?? 0) > 0;
  const currentTile = selectedUnit ? grid.getTile(selectedUnit.pos) : undefined;
  const bestCov = currentTile ? bestTileCover(currentTile.cover) : "none";

  return (
    <footer className="pointer-events-auto grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 py-3 bg-slate-950/90 border-t border-amber-500/30 backdrop-blur-md text-slate-100 shadow-2xl">
      {/* Left Column (4 cols): Squad Roster & Selected Soldier Details */}
      <div className="lg:col-span-4 flex flex-col justify-between gap-2 bg-slate-900/80 rounded-xl p-3 border border-slate-800">
        {/* Squad Quick-Select Tabs */}
        <div className="flex items-center gap-1.5">
          {playerUnits.map((u) => {
            const isSel = u.id === selectedUnitId;
            return (
              <button
                key={u.id}
                type="button"
                disabled={!u.alive || !canCommand}
                onClick={() => selectUnit(u.id)}
                className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  !u.alive
                    ? "bg-slate-950/50 border-slate-800 text-slate-600 line-through"
                    : isSel
                      ? "bg-sky-950/90 border-sky-400 text-white shadow"
                      : "bg-slate-950/80 border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span className="truncate">{u.name}</span>
                <span className="flex items-center gap-1 ml-1">
                  <span className="text-[10px] text-emerald-400">
                    {u.hp}/{u.maxHp}
                  </span>
                  <span className="text-[10px] text-amber-400">
                    ({u.ap}AP)
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Unit Card */}
        {selectedUnit ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white">
                    {selectedUnit.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    Patro {selectedUnit.pos.y}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      bestCov === "full"
                        ? "bg-sky-950 text-sky-300 border-sky-500/40"
                        : bestCov === "half"
                          ? "bg-amber-950 text-amber-300 border-amber-500/40"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Kryt: {bestCov.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedUnit.roleTitle} · {selectedUnit.weapon.name} (
                  {selectedUnit.weapon.minDamage}–{selectedUnit.weapon.maxDamage}{" "}
                  HP)
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-emerald-400">
                HP {selectedUnit.hp} / {selectedUnit.maxHp} · Kyrys{" "}
                <span className="text-amber-300">
                  {selectedUnit.armor}/{selectedUnit.maxArmor}
                </span>
              </div>
              <div className="text-xs font-extrabold text-amber-400">
                AP {selectedUnit.ap} / {selectedUnit.maxAp} · Přesnost{" "}
                {selectedUnit.marksmanship}%
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">
            Vyberte vojáka kliknutím na figurku nebo v seznamu výše.
          </p>
        )}
      </div>

      {/* Center Column (5 cols): Tactical Action Buttons */}
      <div className="lg:col-span-5 flex flex-col justify-between gap-2 bg-slate-900/80 rounded-xl p-3 border border-slate-800">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Modrá zóna = <strong>1 AP (pohyb + střelba)</strong> · Žlutá zóna ={" "}
            <strong>2 AP (sprint)</strong>
          </span>
          {actionMode === "grenade" && (
            <span className="text-orange-400 font-bold animate-pulse">
              Klikněte na dlaždici v dosahu pro hod granátem (3×3)!
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {/* 1. Move Mode */}
          <button
            type="button"
            disabled={!canCommand || !hasAp}
            onClick={() => setActionMode("move")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
              actionMode === "move" && canCommand && hasAp
                ? "bg-sky-600 border-sky-300 text-white shadow-lg"
                : "bg-slate-950/80 border-slate-700 text-slate-300 hover:border-slate-500 disabled:opacity-40"
            }`}
          >
            <Footprints className="w-4 h-4" />
            <span>Pohyb</span>
          </button>

          {/* 2. Shoot / Targeting HUD */}
          <button
            type="button"
            disabled={!canCommand || !hasAp || visibleTargets.length === 0}
            onClick={() =>
              setActionMode(actionMode === "shoot" ? "move" : "shoot")
            }
            className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
              actionMode === "shoot"
                ? "bg-red-600 border-red-300 text-white shadow-lg"
                : "bg-slate-950/80 border-slate-700 text-slate-200 hover:border-red-400 disabled:opacity-40"
            }`}
          >
            <Crosshair className="w-4 h-4 text-red-400" />
            <span>Střelba ({visibleTargets.length})</span>
          </button>

          {/* 3. Overwatch */}
          <button
            type="button"
            disabled={!canCommand || !hasAp || !!selectedUnit?.isOverwatch}
            onClick={activateOverwatch}
            className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border bg-slate-950/80 border-slate-700 text-slate-200 hover:border-sky-400 text-xs font-bold transition-all disabled:opacity-40"
          >
            <Eye className="w-4 h-4 text-sky-400" />
            <span>Overwatch</span>
          </button>

          {/* 4. Grenade */}
          <button
            type="button"
            disabled={
              !canCommand || !hasAp || (selectedUnit?.grenades ?? 0) <= 0
            }
            onClick={() =>
              setActionMode(actionMode === "grenade" ? "move" : "grenade")
            }
            className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
              actionMode === "grenade"
                ? "bg-orange-600 border-orange-300 text-white shadow-lg"
                : "bg-slate-950/80 border-slate-700 text-slate-200 hover:border-orange-400 disabled:opacity-40"
            }`}
          >
            <Bomb className="w-4 h-4 text-orange-400" />
            <span>Granát ({selectedUnit?.grenades ?? 0})</span>
          </button>

          {/* 5. End Turn */}
          <button
            type="button"
            disabled={!canCommand}
            onClick={endTurn}
            className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-lg transition-all disabled:opacity-40"
          >
            <SkipForward className="w-4 h-4" />
            <span>Konec tahu</span>
          </button>
        </div>
      </div>

      {/* Right Column (3 cols): Combat Chronicle Log */}
      <div className="lg:col-span-3 flex flex-col bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 h-28">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          <span>Kronika boje</span>
          <span>WASD: posun · Q/E: 90° rotace</span>
        </div>
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto space-y-1 pr-1 text-[11px]"
        >
          {combatLog.map((entry) => (
            <div
              key={entry.id}
              className={`leading-snug ${
                entry.tone === "crit"
                  ? "text-amber-300 font-semibold"
                  : entry.tone === "misfire"
                    ? "text-orange-400 font-semibold"
                    : entry.tone === "hit"
                      ? "text-rose-300"
                      : entry.tone === "overwatch"
                        ? "text-sky-300"
                        : entry.tone === "alert"
                          ? "text-red-400 font-bold"
                          : "text-slate-300"
              }`}
            >
              {entry.text}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
