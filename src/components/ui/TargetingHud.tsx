/**
 * XCOM-2 Aiming HUD & Shot Breakdown System (/src/components/ui/TargetingHud.tsx).
 * Adaptováno na reálie třicetileté války (1618–1648):
 * 1. Spodní horizontální Seznam cílů (Target Ribbon) s dobovými ikonami (Žlutá = Obchvat/Flanked,
 *    Červená = V krytu, Šedá/Modrá = Extrémní dostřel) a přepínáním přes Tab / Shift+Tab.
 * 2. Hlavní středový panel (Okamžitý přehled): Hit %, Crit %, Rozptyl poškození + Průraz/Zničení
 *    kyrysu, a Šance na selhání výstřelu (Misfire %).
 * 3. Rozkládací postranní panely (Breakdown Wings, klávesa F1 nebo postranní šipky):
 *    - Levý panel: Modifikátory šance na zásah (Hit Modifiers)
 *    - Pravý panel: Modifikátory kritického zásahu a průrazu zbroje (Crit & Armor Modifiers)
 */

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flame,
  Shield,
  ShieldAlert,
  ShieldOff,
  Skull,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import type { StatModifier } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";

function ModifierRow({ item }: { item: StatModifier }) {
  const isPositive = item.kind === "bonus" || (item.kind === "base" && item.value > 0);
  const isPenalty = item.kind === "penalty" || item.value < 0;

  const formattedValue =
    item.unit === "%"
      ? `${item.value > 0 ? `+${item.value}` : item.value} %`
      : `${item.value > 0 ? `+${item.value}` : item.value} ${item.unit}`;

  return (
    <div className="flex items-start justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90">
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-100 leading-tight">
          {item.label}
        </div>
        {item.detail && (
          <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
            {item.detail}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 text-xs font-extrabold px-1.5 py-0.5 rounded ${
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

export function TargetingHud() {
  const actionMode = useGameStore((s) => s.actionMode);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const breakdownOpen = useGameStore((s) => s.breakdownOpen);
  const units = useGameStore((s) => s.units);
  const isBusy = useGameStore((s) => s.isBusy);

  const selectTarget = useGameStore((s) => s.selectTarget);
  const cycleTarget = useGameStore((s) => s.cycleTarget);
  const toggleBreakdown = useGameStore((s) => s.toggleBreakdown);
  const executeShoot = useGameStore((s) => s.executeShoot);
  const setActionMode = useGameStore((s) => s.setActionMode);

  if (actionMode !== "shoot" || isBusy) return null;

  const shooter = units.find((u) => u.id === selectedUnitId && u.alive);
  const activeEval =
    visibleTargets.find((t) => t.targetId === selectedTargetId) ??
    visibleTargets[0] ??
    null;
  const targetUnit = activeEval
    ? units.find((u) => u.id === activeEval.targetId)
    : null;
  const calc = activeEval?.calculation ?? null;

  return (
    <section
      aria-label="Režim míření a okamžitý přehled šancí"
      className="pointer-events-none w-full flex flex-col items-center justify-end pb-1 px-3 select-none"
    >
      {visibleTargets.length === 0 || !calc || !targetUnit || !shooter ? (
        <div className="pointer-events-auto max-w-md w-full bg-slate-950/95 border border-red-500/60 rounded-2xl p-4 text-center text-slate-100 shadow-2xl backdrop-blur-md">
          <p className="text-xs text-slate-300 mb-3">
            Žádný nepřítel není v dostřelu nebo v přímé viditelnosti (3D Bresenham LoS).
          </p>
          <button
            type="button"
            onClick={() => setActionMode("move")}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-600"
          >
            Zrušit míření (Esc)
          </button>
        </div>
      ) : (
        <div className="w-full max-w-6xl flex flex-col items-center gap-2.5">
          {/* =================================================================
              HORNÍ ČÁST: LEVÉ KŘÍDLO + HLAVNÍ STŘEDOVÝ PANEL + PRAVÉ KŘÍDLO
             ================================================================= */}
          <div className="w-full flex flex-col xl:flex-row items-stretch xl:items-end justify-center gap-2.5">
            {/* LEVÝ PANEL: MODIFIKÁTORY ŠANCE NA ZÁSAH (Hit Modifiers) */}
            {breakdownOpen && (
              <aside className="pointer-events-auto flex-1 xl:max-w-sm bg-slate-950/92 border border-amber-500/40 rounded-2xl p-3.5 text-slate-100 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                        Modifikátory šance na zásah
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Levý panel · Hit Breakdown ({calc.weaponName})
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-400">
                    {calc.hitChance} %
                  </span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {calc.hitModifiers.map((mod) => (
                    <ModifierRow key={mod.id} item={mod} />
                  ))}
                </div>
              </aside>
            )}

            {/* HLAVNÍ STŘEDOVÝ PANEL (Okamžitý přehled šancí nad lištou cílů) */}
            <div className="pointer-events-auto w-full xl:w-[490px] shrink-0 bg-slate-950/95 border-2 border-amber-500/60 rounded-2xl p-4 text-slate-100 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.85)]">
              {/* Hlavička cíle + přepínač rozkládacích křídel (F1) */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
                <button
                  type="button"
                  onClick={toggleBreakdown}
                  title="Rozbalit / sbalit matematický rozpis modifikátorů (klávesa F1)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                    breakdownOpen
                      ? "bg-amber-500/20 border-amber-400 text-amber-200"
                      : "bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400/60"
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Rozpis (F1)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <div className="text-center min-w-0">
                  <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider mb-0.5 truncate">
                    Střelec: {shooter.name} ({shooter.weapon.name})
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-black tracking-wide text-white truncate">
                      Cíl: {targetUnit.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                      P{targetUnit.pos.y} · {calc.distance} polí
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-center gap-2 mt-0.5">
                    <span>
                      HP:{" "}
                      <strong className="text-rose-300">
                        {targetUnit.hp}/{targetUnit.maxHp}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Kyrys:{" "}
                      <strong className="text-amber-300">
                        {targetUnit.armor}/{targetUnit.maxArmor}
                      </strong>
                    </span>
                    <span>·</span>
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
                  title="Opustit režim míření (Esc)"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 4 KLÍČOVÉ METRIKY (Hit %, Crit %, Poškození + Průraz, Selhání doutnáku %) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
                {/* 1. Šance na zásah (Hit %) */}
                <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Zásah (Hit)
                  </div>
                  <div className="text-2xl font-black text-emerald-400 leading-tight mt-0.5">
                    {calc.hitChance}%
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {calc.heightAdvantage ? "Výšková převaha" : "Přímá střelba"}
                  </div>
                </div>

                {/* 2. Šance na kritický zásah / průstřel (Crit %) */}
                <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Krit / Průstřel
                  </div>
                  <div className="text-2xl font-black text-amber-400 leading-tight mt-0.5">
                    {calc.critChance}%
                  </div>
                  <div className="text-[10px] text-amber-300/90 truncate">
                    {calc.isFlanked ? "Flank bonus +40 %" : `+${calc.critBonusDamage} HP krit`}
                  </div>
                </div>

                {/* 3. Rozptyl poškození + Průraz/Zničení zbroje */}
                <div className="bg-slate-900/90 border border-rose-500/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Poškození
                  </div>
                  <div className="text-xl font-black text-rose-300 leading-tight mt-0.5">
                    {calc.minDamage}–{calc.maxDamage}{" "}
                    <span className="text-xs font-bold">HP</span>
                  </div>
                  <div className="text-[10px] font-semibold text-amber-300 truncate">
                    Průraz {calc.armorPierce} · Shred −{calc.armorShred}
                  </div>
                </div>

                {/* 4. Šance na selhání výstřelu (Misfire % — 17. století) */}
                <div className="bg-slate-900/90 border border-orange-500/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-orange-400" />
                    <span>Selhání</span>
                  </div>
                  <div className="text-2xl font-black text-orange-400 leading-tight mt-0.5">
                    {calc.misfireChance}%
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {calc.lockType === "matchlock"
                      ? "Doutnákový zámek"
                      : "Kolečkový zámek"}
                  </div>
                </div>
              </div>

              {/* Tlačítka akce: VYSTŘELIT (Enter / Space) & ZRUŠIT (Esc) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeShoot(calc.targetId)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-950/70 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>
                    Vystřelit — {shooter.weapon.name} ({calc.hitChance} %)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300"
                >
                  Zrušit (Esc)
                </button>
              </div>
            </div>

            {/* PRAVÝ PANEL: MODIFIKÁTORY KRITICKÉHO ZÁSAHU A PRŮRAZU ZBROJE */}
            {breakdownOpen && (
              <aside className="pointer-events-auto flex-1 xl:max-w-sm bg-slate-950/92 border border-amber-500/40 rounded-2xl p-3.5 text-slate-100 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-amber-400" />
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                        Kritický zásah & Průraz kyrysu
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Pravý panel · Crit & Armor Breakdown
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-400">
                    {calc.critChance} %
                  </span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {calc.critModifiers.map((mod) => (
                    <ModifierRow key={mod.id} item={mod} />
                  ))}
                </div>
              </aside>
            )}
          </div>

          {/* =================================================================
              SPODNÍ LIŠTA CÍLŮ (Target Ribbon — XCOM 2 horizontální pás nepřátel)
             ================================================================= */}
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/95 border border-amber-500/40 rounded-2xl px-3.5 py-2 backdrop-blur-md shadow-2xl">
            <button
              type="button"
              onClick={() => cycleTarget(-1)}
              title="Předchozí cíl (Shift + Tab)"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {visibleTargets.map((ev, index) => {
                const enemy = units.find((u) => u.id === ev.targetId);
                if (!enemy) return null;
                const isSelectedTarget = ev.targetId === calc.targetId;
                const cat = ev.calculation.ribbonCategory;

                // Barevná kategorie ikony podle zadání:
                // - Žlutá ('flanked'): Cíl je v obchvatu (Flanked) nebo na nekrytém prostranství
                // - Červená ('covered'): Cíl je v krytu nebo standardní pozici
                // - Šedá/Modrá ('extreme_range'): Cíl je v extrémním dostřelu s penalizací
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
                    title={`${enemy.name} — ${ev.calculation.hitChance} % zásah (${
                      cat === "flanked"
                        ? "Obchvat / Nekrytý cíl"
                        : cat === "extreme_range"
                          ? "Extrémní dostřel"
                          : "Cíl v krytu"
                    })`}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${badgePalette}`}
                  >
                    {/* Ikona dobové přilby / lebky + indikátor krytu */}
                    <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950/70 border border-current/30">
                      <Skull className="w-4 h-4" />
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

                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold opacity-75">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-extrabold whitespace-nowrap">
                          {enemy.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span>{ev.calculation.hitChance}% ZÁSAH</span>
                        {ev.calculation.isFlanked && (
                          <span className="flex items-center gap-0.5 text-amber-300">
                            <Sparkles className="w-2.5 h-2.5" />
                            FLANK
                          </span>
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-colors"
            >
              <span>Tab</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
