/**
 * Tactical Action Ribbon (/src/components/ui/TacticalActionRibbon.tsx).
 * Jednotná plovoucí velitelská lišta ve stylu XCOM ukotvená uprostřed dole:
 * 1. Levá část (Ukotvená): Pilulky rychlého přepínání čety nahoře, karta aktivního vojáka
 *    (jméno, zbraň, pips HP a kyrysu, AP tečky a kryt). Zůstává viditelná i při míření!
 * 2. Střední část v klidovém režimu: Kompaktní řada akcí ([1] Pohyb, [2] Střelba, [3] Overwatch,
 *    [4] Granát, [Space] Konec tahu).
 * 3. Střední část v režimu míření (In-Place Morphing):
 *    - Plynule se transformuje v Target Ribbon (pás viditelných nepřátel s klávesou Tab)
 *    - Nad ní se vznese panel 4 klíčových šancí (Hit %, Crit %, Poškození, Selhání)
 *    - Výsuvná postranní křídla (F1) s kompletním matematickým rozpadem
 */

import {
  AlertTriangle,
  Bomb,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Flame,
  Footprints,
  Shield,
  ShieldAlert,
  ShieldOff,
  SkipForward,
  Skull,
  Sparkles,
  Swords,
  User,
  X,
} from "lucide-react";
import { bestTileCover } from "../../core/GridSystem";
import type { StatModifier } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";

function ModifierRow({ item }: { item: StatModifier }) {
  const isPositive =
    item.kind === "bonus" || (item.kind === "base" && item.value > 0);
  const isPenalty = item.kind === "penalty" || item.value < 0;

  const formattedValue =
    item.unit === "%"
      ? `${item.value > 0 ? `+${item.value}` : item.value} %`
      : `${item.value > 0 ? `+${item.value}` : item.value} ${item.unit}`;

  return (
    <div className="flex items-start justify-between gap-3 py-1 px-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">
      <div className="min-w-0">
        <div className="font-bold text-slate-100 leading-tight">
          {item.label}
        </div>
        {item.detail && (
          <div className="text-[10px] text-slate-400 leading-tight">
            {item.detail}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 font-extrabold px-1.5 py-0.2 rounded text-[10px] ${
          item.kind === "base"
            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
            : isPositive
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : isPenalty
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "bg-slate-800 text-slate-300"
        }`}
      >
        {formattedValue}
      </span>
    </div>
  );
}

export function TacticalActionRibbon() {
  const grid = useGameStore((s) => s.grid);
  const units = useGameStore((s) => s.units);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const turn = useGameStore((s) => s.turn);
  const isBusy = useGameStore((s) => s.isBusy);
  const actionMode = useGameStore((s) => s.actionMode);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const breakdownOpen = useGameStore((s) => s.breakdownOpen);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);

  const selectUnit = useGameStore((s) => s.selectUnit);
  const setActionMode = useGameStore((s) => s.setActionMode);
  const activateOverwatch = useGameStore((s) => s.activateOverwatch);
  const endTurn = useGameStore((s) => s.endTurn);
  const selectTarget = useGameStore((s) => s.selectTarget);
  const cycleTarget = useGameStore((s) => s.cycleTarget);
  const toggleBreakdown = useGameStore((s) => s.toggleBreakdown);
  const executeShoot = useGameStore((s) => s.executeShoot);

  const playerUnits = units.filter((u) => u.faction === "player");
  const selectedUnit =
    units.find((u) => u.id === selectedUnitId && u.alive) ?? null;

  const canCommand = turn === "player" && !isBusy;
  const hasAp = (selectedUnit?.ap ?? 0) > 0;
  const currentTile = selectedUnit ? grid.getTile(selectedUnit.pos) : undefined;
  const bestCov = currentTile ? bestTileCover(currentTile.cover) : "none";

  // Data pro režim střelby
  const isAiming = actionMode === "shoot" && !isBusy;
  const activeEval =
    visibleTargets.find((t) => t.targetId === selectedTargetId) ??
    visibleTargets[0] ??
    null;
  const targetUnit = activeEval
    ? units.find((u) => u.id === activeEval.targetId)
    : null;
  const calc = activeEval?.calculation ?? null;

  // Zvýraznění doporučených akcí tutoriálu
  const isTutorialActive = !tutorialDismissed && tutorialStep !== null;
  const isStep1Highlight = isTutorialActive && tutorialStep === 1;
  const isStep2Highlight = isTutorialActive && tutorialStep === 2;
  const isStep3Highlight = isTutorialActive && tutorialStep === 3;

  return (
    <footer
      aria-label="Taktická akční lišta"
      className="pointer-events-none fixed bottom-3 left-0 right-0 z-30 flex flex-col items-center justify-end px-3 select-none"
    >
      {/* =====================================================================
          1. REŽIM MÍŘENÍ: NADŘAZENÝ PANEL 4 ŠANCÍ + VÝSUVNÁ KŘÍDLA (F1)
         ===================================================================== */}
      {isAiming && calc && targetUnit && selectedUnit && (
        <div className="w-full max-w-5xl flex flex-col xl:flex-row items-center xl:items-end justify-center gap-2 mb-2">
          {/* LEVÉ KŘÍDLO: Modifikátory zásahu (Hit Breakdown) */}
          {breakdownOpen && (
            <aside className="pointer-events-auto flex-1 xl:max-w-xs bg-slate-950/95 border border-amber-500/40 rounded-2xl p-3 text-slate-100 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-serif font-bold text-xs uppercase tracking-wider text-amber-300">
                    Rozpad zásahu
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-400">
                  {calc.hitChance} %
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {calc.hitModifiers.map((mod) => (
                  <ModifierRow key={mod.id} item={mod} />
                ))}
              </div>
            </aside>
          )}

          {/* HLAVNÍ STŘEDOVÝ PANEL: 4 METRIKY ŠANCÍ A POTVRZENÍ VÝSTŘELU */}
          <div className="pointer-events-auto w-full xl:w-[460px] shrink-0 bg-slate-950/95 border-2 border-amber-500/60 rounded-2xl p-3 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.85)] text-slate-100">
            {/* Hlavička míření + F1 tlačítko + zavřít */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
              <button
                type="button"
                onClick={toggleBreakdown}
                title="Rozbalit / sbalit detailní rozpad modifikátorů (klávesa F1)"
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  isStep2Highlight
                    ? "bg-amber-500/30 border-amber-300 text-amber-200 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-pulse"
                    : breakdownOpen
                      ? "bg-amber-500/20 border-amber-400 text-amber-200"
                      : "bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400/60"
                }`}
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Rozpad (F1)</span>
                <ChevronRight className="w-3 h-3" />
              </button>

              <div className="text-center min-w-0">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="font-serif font-black text-xs text-white truncate">
                    Cíl: {targetUnit.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    P{targetUnit.pos.y} · {calc.distance} polí
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 mt-0.5">
                  <span
                    className={
                      calc.isFlanked
                        ? "text-amber-300 font-bold"
                        : "text-sky-300 font-semibold"
                    }
                  >
                    {calc.isFlanked
                      ? "OBCHVAT (Nekrytý!)"
                      : calc.targetCover === "full"
                        ? "Plný kryt (-40 %)"
                        : "Poloviční kryt (-20 %)"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActionMode("move")}
                title="Zrušit míření (Esc)"
                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Klíčové boxy šancí */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5 text-center">
              {/* Hit % */}
              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">
                  Zásah
                </div>
                <div className="text-lg font-black text-emerald-400 leading-tight">
                  {calc.hitChance}%
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {calc.heightAdvantage ? "Výška +15%" : "Přímá"}
                </div>
              </div>

              {/* Crit % */}
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">
                  Krit
                </div>
                <div className="text-lg font-black text-amber-400 leading-tight">
                  {calc.critChance}%
                </div>
                <div className="text-[9px] text-amber-300/80 truncate">
                  +{calc.critBonusDamage} HP
                </div>
              </div>

              {/* Damage & Armor Pierce */}
              <div className="bg-slate-900/90 border border-rose-500/40 rounded-xl p-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">
                  Zranění
                </div>
                <div className="text-base font-black text-rose-300 leading-tight">
                  {calc.minDamage}–{calc.maxDamage}
                </div>
                <div className="text-[9px] text-amber-300 truncate">
                  Průraz {calc.armorPierce}
                </div>
              </div>

              {/* Misfire % */}
              <div className="bg-slate-900/90 border border-orange-500/40 rounded-xl p-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400 flex items-center justify-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5 text-orange-400" />
                  <span>Selhání</span>
                </div>
                <div className="text-lg font-black text-orange-400 leading-tight">
                  {calc.misfireChance}%
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {calc.lockType === "matchlock" ? "Doutnák" : "Kolečko"}
                </div>
              </div>
            </div>

            {/* Tlačítko Vystřelit (Space / Enter) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => executeShoot(calc.targetId)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>
                  Vystřelit · {calc.hitChance} % (Space)
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActionMode("move")}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300"
              >
                Zrušit (Esc)
              </button>
            </div>
          </div>

          {/* PRAVÉ KŘÍDLO: Modifikátory kritu a zbroje */}
          {breakdownOpen && (
            <aside className="pointer-events-auto flex-1 xl:max-w-xs bg-slate-950/95 border border-amber-500/40 rounded-2xl p-3 text-slate-100 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-serif font-bold text-xs uppercase tracking-wider text-amber-300">
                    Krit & Kyrys
                  </span>
                </div>
                <span className="text-xs font-black text-amber-400">
                  {calc.critChance} %
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {calc.critModifiers.map((mod) => (
                  <ModifierRow key={mod.id} item={mod} />
                ))}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* =====================================================================
          2. ZÁKLADNÍ SPODNÍ PÁS: KARTA VOJÁKA + (AKČNÍ LIŠTA nebo TARGET RIBBON)
         ===================================================================== */}
      <div className="pointer-events-auto flex flex-col md:flex-row items-stretch md:items-end justify-center gap-2.5 max-w-5xl w-full">
        {/* LEVÁ ČÁST: SQUAD QUICK-SWITCH + KARTA AKTIVNÍHO VOJÁKA */}
        <div className="flex flex-col gap-1 shrink-0">
          {/* Pilulky spolubojovníků čety */}
          <div className="flex items-center gap-1">
            {playerUnits.map((u) => {
              const isSel = u.id === selectedUnitId;
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={!u.alive || !canCommand}
                  onClick={() => selectUnit(u.id)}
                  title={`${u.name}: HP ${u.hp}/${u.maxHp}, AP ${u.ap}${u.isVip ? " (Klíčový maršál · VIP)" : ""}`}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    !u.alive
                      ? "bg-slate-950/50 border-slate-800 text-slate-600 line-through"
                      : isSel
                        ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow"
                        : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {u.isVip && <span className="text-amber-400 text-[10px]">★</span>}
                  <span className="truncate max-w-[80px]">{u.name}</span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] text-emerald-400 font-extrabold">
                      {u.hp}HP
                    </span>
                    <span className="text-[9px] text-amber-300 font-mono">
                      {u.ap}AP
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Karta vybraného vojáka */}
          {selectedUnit ? (
            <div className="flex items-center gap-2.5 bg-slate-950/90 border border-amber-500/40 rounded-2xl p-2.5 backdrop-blur-md shadow-2xl text-slate-100">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <User className="w-5 h-5" />
              </div>

              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-serif font-black text-xs text-white truncate max-w-[130px]">
                    {selectedUnit.name}
                  </span>
                  {selectedUnit.isVip && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                      VIP
                    </span>
                  )}
                  <span
                    className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                      bestCov === "full"
                        ? "bg-sky-950 text-sky-300 border-sky-500/40"
                        : bestCov === "half"
                          ? "bg-amber-950 text-amber-300 border-amber-500/40"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    {bestCov.toUpperCase()}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                  {selectedUnit.buffTitle ? (
                    <span className="text-emerald-300 font-semibold">
                      {selectedUnit.buffTitle} ·{" "}
                    </span>
                  ) : null}
                  {selectedUnit.weapon.name} ({selectedUnit.weapon.minDamage}–
                  {selectedUnit.weapon.maxDamage} HP)
                </div>

                {/* HP Pips & Armor Pips & AP Dots */}
                <div className="flex items-center gap-2 mt-1">
                  {/* HP pips */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: selectedUnit.maxHp }, (_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-[1px] border ${
                          i < selectedUnit.hp
                            ? "bg-emerald-400 border-emerald-300"
                            : "bg-slate-800 border-slate-700"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Armor pips */}
                  {selectedUnit.maxArmor > 0 && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: selectedUnit.maxArmor }, (_, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-[1px] border ${
                            i < selectedUnit.armor
                              ? "bg-amber-400 border-amber-300"
                              : "bg-slate-800 border-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* AP Dots */}
                  <div className="flex items-center gap-0.5 pl-1 border-l border-slate-800">
                    {Array.from({ length: selectedUnit.maxAp }, (_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full border ${
                          i < selectedUnit.ap
                            ? "bg-amber-400 border-amber-300 shadow-[0_0_5px_#fde047]"
                            : "bg-transparent border-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 text-xs text-slate-400">
              Vyberte vojáka
            </div>
          )}
        </div>

        {/* STŘEDNÍ ČÁST: MORFUJÍCÍ OBSAH (AKČNÍ TLAČÍTKA NEBO TARGET RIBBON) */}
        <div className="flex-1 bg-slate-950/90 border border-amber-500/40 rounded-2xl p-2 backdrop-blur-md shadow-2xl">
          {isAiming ? (
            visibleTargets.length === 0 || !calc || !targetUnit ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="text-amber-300 font-bold">
                  Žádný cíl není v přímé viditelnosti (3D LoS) ani v dostřelu.
                </span>
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
                >
                  Zpět k pohybu (Esc)
                </button>
              </div>
            ) : (
              /* ===============================================================
                 REŽIM MÍŘENÍ: TARGET RIBBON (Pás viditelných cílů ve stylu XCOM)
                 =============================================================== */
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => cycleTarget(-1)}
                  title="Předchozí cíl (Shift + Tab)"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto px-1">
                  {visibleTargets.map((ev, index) => {
                    const enemy = units.find((u) => u.id === ev.targetId);
                    if (!enemy) return null;
                    const isSelectedTarget = ev.targetId === calc?.targetId;
                    const cat = ev.calculation.ribbonCategory;

                    const badgePalette =
                      cat === "flanked"
                        ? isSelectedTarget
                          ? "bg-amber-500/30 border-amber-300 text-amber-100 ring-2 ring-amber-400/60"
                          : "bg-amber-950/70 border-amber-500/60 text-amber-200 hover:border-amber-300"
                        : cat === "extreme_range"
                          ? isSelectedTarget
                            ? "bg-sky-900/80 border-sky-300 text-sky-100 ring-2 ring-sky-400/60"
                            : "bg-slate-900/90 border-sky-500/40 text-slate-300 hover:border-sky-400"
                          : isSelectedTarget
                            ? "bg-red-900/85 border-red-300 text-white ring-2 ring-red-400/60"
                            : "bg-red-950/65 border-red-500/50 text-red-200 hover:border-red-400";

                    return (
                      <button
                        key={ev.targetId}
                        type="button"
                        onClick={() => selectTarget(ev.targetId)}
                        title={`${enemy.name} · ${ev.calculation.hitChance} % zásah`}
                        className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer min-w-[140px] ${badgePalette}`}
                      >
                        <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-slate-950/70 border border-current/30 shrink-0">
                          <Skull className="w-3.5 h-3.5" />
                          <span className="absolute -top-1 -right-1">
                            {cat === "flanked" ? (
                              <ShieldOff className="w-3 h-3 text-amber-300 fill-slate-950" />
                            ) : ev.calculation.targetCover === "full" ? (
                              <Shield className="w-3 h-3 text-sky-300 fill-current" />
                            ) : (
                              <ShieldAlert className="w-3 h-3 text-amber-300" />
                            )}
                          </span>
                        </div>

                        <div className="text-left min-w-0">
                          <div className="text-xs font-black truncate">
                            {enemy.name}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold">
                            <span>{ev.calculation.hitChance}% ZÁSAH</span>
                            {ev.calculation.isFlanked && (
                              <span className="text-amber-300">FLANK</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => cycleTarget(1)}
                  title="Další cíl (Tab)"
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 hover:text-white"
                >
                  <span>Tab</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )
          ) : (
            /* ===============================================================
               BĚŽNÝ REŽIM: ŘADA AKČNÍCH TLAČÍTEK ([1] - [4] a [Space])
               =============================================================== */
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex-1 grid grid-cols-4 gap-1.5">
                {/* 1. Pohyb */}
                <button
                  type="button"
                  disabled={!canCommand || !hasAp}
                  onClick={() => setActionMode("move")}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    actionMode === "move" && canCommand && hasAp
                      ? "bg-sky-600 border-sky-300 text-white shadow-lg"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 disabled:opacity-40"
                  } ${
                    isStep1Highlight && canCommand && hasAp
                      ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
                      : ""
                  }`}
                >
                  <Footprints className="w-4 h-4 mb-0.5" />
                  <div className="flex items-center gap-1">
                    <span>Pohyb</span>
                    <span className="text-[9px] font-mono opacity-80">[1]</span>
                  </div>
                </button>

                {/* 2. Střelba */}
                <button
                  type="button"
                  disabled={!canCommand || !hasAp || visibleTargets.length === 0}
                  onClick={() =>
                    setActionMode(actionMode === "shoot" ? "move" : "shoot")
                  }
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    actionMode === "shoot"
                      ? "bg-red-600 border-red-300 text-white shadow-lg"
                      : "bg-slate-900/80 border-slate-800 text-slate-200 hover:border-red-400 disabled:opacity-40"
                  } ${
                    isStep2Highlight && canCommand && hasAp && visibleTargets.length > 0
                      ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
                      : ""
                  }`}
                >
                  <Crosshair className="w-4 h-4 text-red-400 mb-0.5" />
                  <div className="flex items-center gap-1">
                    <span>Střelba ({visibleTargets.length})</span>
                    <span className="text-[9px] font-mono opacity-80">[2]</span>
                  </div>
                </button>

                {/* 3. Overwatch */}
                <button
                  type="button"
                  disabled={!canCommand || !hasAp || !!selectedUnit?.isOverwatch}
                  onClick={activateOverwatch}
                  className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border bg-slate-900/80 border-slate-800 text-slate-200 hover:border-sky-400 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-sky-400 mb-0.5" />
                  <div className="flex items-center gap-1">
                    <span>Hlídka</span>
                    <span className="text-[9px] font-mono opacity-80">[3]</span>
                  </div>
                </button>

                {/* 4. Granát */}
                <button
                  type="button"
                  disabled={
                    !canCommand || !hasAp || (selectedUnit?.grenades ?? 0) <= 0
                  }
                  onClick={() =>
                    setActionMode(actionMode === "grenade" ? "move" : "grenade")
                  }
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    actionMode === "grenade"
                      ? "bg-orange-600 border-orange-300 text-white shadow-lg"
                      : "bg-slate-900/80 border-slate-800 text-slate-200 hover:border-orange-400 disabled:opacity-40"
                  } ${
                    isStep3Highlight && canCommand && hasAp && (selectedUnit?.grenades ?? 0) > 0
                      ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
                      : ""
                  }`}
                >
                  <Bomb className="w-4 h-4 text-orange-400 mb-0.5" />
                  <div className="flex items-center gap-1">
                    <span>Granát ({selectedUnit?.grenades ?? 0})</span>
                    <span className="text-[9px] font-mono opacity-80">[4]</span>
                  </div>
                </button>
              </div>

              {/* 5. Konec tahu */}
              <button
                type="button"
                disabled={!canCommand}
                onClick={endTurn}
                className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl border bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg transition-all disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <SkipForward className="w-4 h-4 mb-0.5" />
                <div className="flex items-center gap-1">
                  <span>Konec</span>
                  <span className="text-[9px] font-mono opacity-80">[⎵]</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
