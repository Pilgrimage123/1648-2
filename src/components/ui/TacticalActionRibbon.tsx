/**
 * Tactical Action Ribbon (/src/components/ui/TacticalActionRibbon.tsx).
 * Jednotná plovoucí velitelská lišta ve stylu XCOM ukotvená uprostřed dole:
 * - Používá srozumitelnou barokní ikonu krytu s číslem (<BaroqueCoverBadge />) místo textových nápisů
 * - Panel míření i spodní lištu lze odsunout stranou přetažením za úchyt nebo sbalit,
 *   aby nikdy nezakrývaly důležité dlaždice na spodním okraji bojiště
 */

import {
  AlertTriangle,
  Bomb,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Eye,
  Flame,
  Footprints,
  GripHorizontal,
  RotateCcw,
  SkipForward,
  Skull,
  Sparkles,
  Swords,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { bestTileCover } from "../../core/GridSystem";
import type { StatModifier } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { BaroqueCoverBadge } from "./BaroqueCoverBadge";
import { useDraggableHud } from "./useDraggableHud";

function ModifierRow({ item }: { item: StatModifier }) {
  const isPositive =
    item.kind === "bonus" || (item.kind === "base" && item.value > 0);
  const isPenalty = item.kind === "penalty" || item.value < 0;

  const formattedValue =
    item.unit === "%"
      ? `${item.value > 0 ? `+${item.value}` : item.value} %`
      : `${item.value > 0 ? `+${item.value}` : item.value} ${item.unit}`;

  return (
    <div className="flex items-start justify-between gap-3 py-1 px-2.5 rounded bg-slate-950/90 border border-amber-500/50 text-[11px]">
      <div className="min-w-0">
        <div className="font-cinzel font-black text-amber-100 leading-tight">
          {item.label}
        </div>
        {item.detail && (
          <div className="font-literata italic text-[10px] text-amber-200/90 leading-tight">
            {item.detail}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 font-cinzel font-black px-1.5 py-0.2 rounded text-[10px] tabular-nums ${
          item.kind === "base"
            ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
            : isPositive
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/70"
              : isPenalty
                ? "bg-rose-950/90 text-rose-300 border border-rose-500/70"
                : "bg-black/70 text-amber-300 border border-amber-900/60"
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
  const hoveredSpottedEnemyIds = useGameStore((s) => s.hoveredSpottedEnemyIds);
  const breakdownOpen = useGameStore((s) => s.breakdownOpen);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const demonstratedAbilities = useGameStore((s) => s.demonstratedAbilities);

  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const weather = useGameStore((s) => s.weather);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);

  const selectUnit = useGameStore((s) => s.selectUnit);
  const setActionMode = useGameStore((s) => s.setActionMode);
  const activateOverwatch = useGameStore((s) => s.activateOverwatch);
  const activateSpecialAbility = useGameStore((s) => s.activateSpecialAbility);
  const endTurn = useGameStore((s) => s.endTurn);
  const selectTarget = useGameStore((s) => s.selectTarget);
  const cycleTarget = useGameStore((s) => s.cycleTarget);
  const toggleBreakdown = useGameStore((s) => s.toggleBreakdown);
  const executeShoot = useGameStore((s) => s.executeShoot);
  const executeMelee = useGameStore((s) => s.executeMelee);
  const visibleMeleeTargets = useGameStore((s) => s.visibleMeleeTargets);

  const [ribbonMinimized, setRibbonMinimized] = useState(false);
  const aimDrag = useDraggableHud();
  const ribbonDrag = useDraggableHud();

  const playerUnits = units.filter((u) => u.faction === "player");
  const selectedUnit =
    units.find((u) => u.id === selectedUnitId && u.alive) ?? null;

  const canCommand = turn === "player" && !isBusy;
  const isSelectedDetained =
    (selectedUnit?.detainedTurns ?? 0) > 0 || (selectedUnit?.hp ?? 1) <= 0;
  const hasAp = (selectedUnit?.ap ?? 0) > 0 && !isSelectedDetained;
  const anyUnitHasAp = playerUnits.some(
    (u) => u.alive && u.hp > 0 && u.ap > 0 && (u.detainedTurns ?? 0) === 0,
  );
  const isColloredoDischarged =
    selectedUnit?.id === "player-colloredo" && selectedUnit?.pistolLoaded === false;
  const ability = selectedUnit?.ability;
  const canUseAbility =
    canCommand &&
    !isSelectedDetained &&
    !!ability &&
    ability.currentCooldown === 0 &&
    (selectedUnit?.ap ?? 0) >= ability.apCost;
  const shouldHighlightAbility =
    canUseAbility &&
    !!selectedUnit &&
    !selectedUnit.isVip &&
    !demonstratedAbilities[selectedUnit.id];
  const currentTile = selectedUnit ? grid.getTile(selectedUnit.pos) : undefined;
  const bestCov = currentTile ? bestTileCover(currentTile.cover) : "none";

  // Data pro režim střelby a chladných zbraní (Aiming HUD)
  const isAiming = actionMode === "shoot" && !isBusy;
  const isMeleeAiming = actionMode === "melee" && !isBusy;
  const isShootingView =
    actionMode === "shoot" ||
    actionMode === "melee" ||
    activeProjectile !== null;

  // Zda má aktuální voják nebo kterýkoliv bojeschopný spolubojovník cíl v dostřelu (a odhalený v šerosvitu)
  const anyUnitCanShoot =
    visibleTargets.length > 0 ||
    playerUnits.some(
      (u) =>
        u.alive &&
        u.hp > 0 &&
        u.ap > 0 &&
        (u.detainedTurns ?? 0) === 0 &&
        units.some(
          (e) =>
            e.faction === "enemy" &&
            e.alive &&
            (!fogOfWarEnabled || fogSnapshot.visibleEnemyIds.has(e.id)) &&
            Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z) <=
              u.weapon.maxRange + (weather ? 0 : 0),
        ),
    );

  const activeEval =
    visibleTargets.find((t) => t.targetId === selectedTargetId) ??
    visibleTargets[0] ??
    null;
  const targetUnit = activeEval
    ? units.find((u) => u.id === activeEval.targetId)
    : null;
  const calc = activeEval?.calculation ?? null;

  const activeMeleeEval =
    visibleMeleeTargets.find((t) => t.targetId === selectedTargetId) ??
    visibleMeleeTargets[0] ??
    null;
  const meleeTargetUnit = activeMeleeEval
    ? units.find((u) => u.id === activeMeleeEval.targetId)
    : null;
  const meleeCalc = activeMeleeEval?.calculation ?? null;

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
        <div
          style={aimDrag.dragStyle}
          className="w-full max-w-5xl flex flex-col xl:flex-row items-center xl:items-end justify-center gap-2 mb-2"
        >
          {/* LEVÉ KŘÍDLO: Modifikátory zásahu (Hit Breakdown) */}
          {breakdownOpen && (
            <aside className="pointer-events-auto flex-1 xl:max-w-xs baroque-cartouche baroque-border rounded-xl p-3 text-amber-50 shadow-[0_8px_32px_rgba(0,0,0,0.95)] bg-slate-950/95 border-amber-500/70">
              <div className="flex items-center justify-between border-b border-amber-900/80 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-cinzel font-black text-xs uppercase tracking-wider text-amber-200">
                    Rozpad zásahu
                  </span>
                </div>
                <span className="font-cinzel text-sm font-black text-emerald-400 tabular-nums">
                  {calc.hitChance} %
                </span>
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {calc.hitModifiers.map((mod) => (
                  <ModifierRow key={mod.id} item={mod} />
                ))}
              </div>
            </aside>
          )}

          {/* HLAVNÍ STŘEDOVÝ PANEL: 4 METRIKY ŠANCÍ A POTVRZENÍ VÝSTŘELU */}
          <div className="pointer-events-auto w-full xl:w-[490px] shrink-0 baroque-cartouche baroque-border rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.95)] text-amber-50 bg-slate-950/95 border-amber-500/80">
            {/* Přetahovatelná hlavička míření + F1 tlačítko + barokní ikona krytu s číslem + zavřít */}
            <div
              onPointerDown={aimDrag.onPointerDown}
              title="Tažením myší můžete panel míření odsunout stranou"
              className="flex items-center justify-between border-b border-amber-900/80 pb-2 mb-2.5 cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={toggleBreakdown}
                title="Rozbalit / sbalit detailní rozpad modifikátorů (klávesa F1)"
                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-cinzel font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isStep2Highlight
                    ? "bg-amber-500/30 border-amber-300 text-amber-100 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-pulse"
                    : breakdownOpen
                      ? "bg-amber-600/35 border-amber-400 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                      : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Rozpad (F1)</span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
                <span className="font-cinzel font-black text-xs text-amber-200 truncate">
                  {targetUnit.name}
                </span>
                <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/50 tabular-nums">
                  {calc.distance}m
                </span>
                {/* Barokní ikona krytu s číslem místo slovního popisu */}
                <BaroqueCoverBadge
                  cover={calc.isFlanked ? "none" : calc.targetCover}
                  size="sm"
                  showZero
                  showPercentSign
                />
              </div>

              <div className="flex items-center gap-1">
                {aimDrag.hasMoved && (
                  <button
                    type="button"
                    onClick={aimDrag.resetOffset}
                    title="Vrátit panel míření na výchozí místo"
                    className="p-1 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  title="Zrušit míření (Esc)"
                  className="p-1 rounded baroque-bronze-btn text-amber-400 hover:text-amber-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4 Klíčové boxy šancí */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5 text-center">
              <div className="bg-slate-900/90 border border-emerald-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(16,185,129,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90">
                  Zásah
                </div>
                <div className="text-xl font-cinzel font-black text-emerald-400 leading-tight tabular-nums">
                  {calc.hitChance}%
                </div>
                <div className="text-[9px] font-literata text-amber-300/90 truncate font-medium">
                  {calc.heightAdvantage ? "Výška +15%" : "Přímý"}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-amber-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(245,158,11,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90">
                  Krit
                </div>
                <div className="text-xl font-cinzel font-black text-amber-300 leading-tight tabular-nums">
                  {calc.critChance}%
                </div>
                <div className="text-[9px] font-literata text-amber-300/90 truncate font-medium tabular-nums">
                  +{calc.critBonusDamage} HP
                </div>
              </div>

              <div className="bg-slate-900/90 border border-rose-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(244,63,94,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90">
                  Zranění
                </div>
                <div className="text-lg font-cinzel font-black text-rose-300 leading-tight tabular-nums">
                  {calc.minDamage}–{calc.maxDamage}
                </div>
                <div className="text-[9px] font-literata text-amber-300 truncate font-medium tabular-nums">
                  Průraz {calc.armorPierce}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-orange-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(249,115,22,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90 flex items-center justify-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5 text-orange-400" />
                  <span>Selhání</span>
                </div>
                <div className="text-xl font-cinzel font-black text-orange-400 leading-tight tabular-nums">
                  {calc.misfireChance}%
                </div>
                <div className="text-[9px] font-literata text-amber-300/80 truncate font-medium">
                  {calc.lockType === "matchlock" ? "Doutnák" : "Kolečko"}
                </div>
              </div>
            </div>

            {/* Tlačítko Vystřelit (Space / Enter) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => executeShoot(calc.targetId)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-gradient-to-r from-red-700 via-amber-600 to-amber-500 hover:from-red-600 hover:to-amber-400 border border-amber-300 text-stone-950 font-cinzel font-black text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(245,158,11,0.5)] transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4 text-stone-950" />
                <span>Vystřelit · {calc.hitChance} % (Space)</span>
              </button>
              <button
                type="button"
                onClick={() => setActionMode("move")}
                className="px-3.5 py-2.5 rounded-lg baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
              >
                Zrušit (Esc)
              </button>
            </div>
          </div>

          {/* PRAVÉ KŘÍDLO: Modifikátory kritu a zbroje */}
          {breakdownOpen && (
            <aside className="pointer-events-auto flex-1 xl:max-w-xs baroque-cartouche baroque-border rounded-xl p-3 text-amber-50 shadow-[0_8px_32px_rgba(0,0,0,0.95)] bg-slate-950/95 border-amber-500/70">
              <div className="flex items-center justify-between border-b border-amber-900/80 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-cinzel font-black text-xs uppercase tracking-wider text-amber-200">
                    Krit & Kyrys
                  </span>
                </div>
                <span className="font-cinzel text-sm font-black text-amber-300 tabular-nums">
                  {calc.critChance} %
                </span>
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {calc.critModifiers.map((mod) => (
                  <ModifierRow key={mod.id} item={mod} />
                ))}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* =====================================================================
          1b. REŽIM BOJE ZBLÍZKA: MELEE AIMING PANEL (CHLADNÁ ZBRAŇ / PAŽBA)
         ===================================================================== */}
      {isMeleeAiming && meleeCalc && meleeTargetUnit && selectedUnit && (
        <div
          style={aimDrag.dragStyle}
          className="w-full max-w-5xl flex flex-col xl:flex-row items-center xl:items-end justify-center gap-2 mb-2"
        >
          {/* LEVÉ KŘÍDLO: Modifikátory zásahu zblízka */}
          {breakdownOpen && (
            <aside className="pointer-events-auto flex-1 xl:max-w-xs baroque-cartouche baroque-border rounded-xl p-3 text-amber-50 shadow-[0_8px_32px_rgba(0,0,0,0.95)] bg-slate-950/95 border-amber-500/70">
              <div className="flex items-center justify-between border-b border-amber-900/80 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-cinzel font-black text-xs uppercase tracking-wider text-amber-200">
                    Útok zblízka
                  </span>
                </div>
                <span className="font-cinzel text-sm font-black text-emerald-400 tabular-nums">
                  {meleeCalc.hitChance} %
                </span>
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {meleeCalc.hitModifiers.map((mod) => (
                  <ModifierRow key={mod.id} item={mod} />
                ))}
              </div>
            </aside>
          )}

          {/* HLAVNÍ STŘEDOVÝ PANEL: 4 METRIKY CHLADNÉ ZBRANĚ */}
          <div className="pointer-events-auto w-full xl:w-[490px] shrink-0 baroque-cartouche baroque-border rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.95)] text-amber-50 bg-slate-950/95 border-amber-500/80">
            <div
              onPointerDown={aimDrag.onPointerDown}
              title="Tažením myší můžete panel odsunout stranou"
              className="flex items-center justify-between border-b border-amber-900/80 pb-2 mb-2.5 cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={toggleBreakdown}
                title="Rozbalit / sbalit detailní rozpad modifikátorů (klávesa F1)"
                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-cinzel font-black uppercase tracking-wider transition-all cursor-pointer ${
                  breakdownOpen
                    ? "bg-amber-600/35 border-amber-400 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                    : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Rozpad (F1)</span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
                <span className="font-cinzel font-black text-xs text-amber-200 truncate">
                  {meleeTargetUnit.name}
                </span>
                <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/50 tabular-nums">
                  1m kontakt
                </span>
              </div>

              <div className="flex items-center gap-1">
                {aimDrag.hasMoved && (
                  <button
                    type="button"
                    onClick={aimDrag.resetOffset}
                    title="Vrátit panel míření na výchozí místo"
                    className="p-1 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  title="Zrušit útok zblízka (Esc)"
                  className="p-1 rounded baroque-bronze-btn text-amber-400 hover:text-amber-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4 Boxy šancí pro chladné zbraně */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5 text-center">
              <div className="bg-slate-900/90 border border-emerald-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(16,185,129,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90">
                  Zásah
                </div>
                <div className="text-xl font-cinzel font-black text-emerald-400 leading-tight tabular-nums">
                  {meleeCalc.hitChance}%
                </div>
                <div className="text-[9px] font-literata text-amber-300/90 truncate font-medium">
                  {meleeCalc.heightAdvantage ? "Výška +15%" : "Tělo na tělo"}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-amber-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(245,158,11,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90">
                  Krit
                </div>
                <div className="text-xl font-cinzel font-black text-amber-300 leading-tight tabular-nums">
                  {meleeCalc.critChance}%
                </div>
                <div className="text-[9px] font-literata text-amber-300/90 truncate font-medium tabular-nums">
                  +{meleeCalc.critBonusDamage} HP
                </div>
              </div>

              <div className="bg-slate-900/90 border border-rose-500/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(244,63,94,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90">
                  Zranění
                </div>
                <div className="text-lg font-cinzel font-black text-rose-300 leading-tight tabular-nums">
                  {meleeCalc.minDamage}–{meleeCalc.maxDamage}
                </div>
                <div className="text-[9px] font-literata text-amber-300 truncate font-medium tabular-nums">
                  Průraz {meleeCalc.armorPierce}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-amber-600/60 rounded-lg p-1.5 shadow-[inset_0_1px_0_rgba(217,119,6,0.3)]">
                <div className="text-[9px] font-cinzel font-bold uppercase text-amber-200/90 flex items-center justify-center gap-0.5">
                  <Swords className="w-2.5 h-2.5 text-amber-400" />
                  <span>Zbraň</span>
                </div>
                <div className="text-xs font-cinzel font-black text-amber-300 leading-tight truncate">
                  {selectedUnit.id === "player-colloredo" ? "Pažba" : meleeCalc.weaponName}
                </div>
                <div className="text-[9px] font-literata text-amber-300/80 truncate font-medium">
                  {selectedUnit.id === "player-colloredo" ? "Nouzový úder" : "Chladná ocel"}
                </div>
              </div>
            </div>

            {/* Tlačítko Útok zblízka (Space / Enter) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => executeMelee(meleeCalc.targetId)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-gradient-to-r from-red-700 via-amber-600 to-amber-500 hover:from-red-600 hover:to-amber-400 border border-amber-300 text-stone-950 font-cinzel font-black text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(245,158,11,0.5)] transition-all cursor-pointer"
              >
                <Swords className="w-4 h-4 text-stone-950" />
                <span>
                  {selectedUnit.id === "player-colloredo" ? "Udeřit pažbou" : "Zaútočit zblízka"} · {meleeCalc.hitChance} % (Space)
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActionMode("move")}
                className="px-3.5 py-2.5 rounded-lg baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
              >
                Zrušit (Esc)
              </button>
            </div>
          </div>

          {/* PRAVÉ KŘÍDLO: Modifikátory kritu a zbroje */}
          {breakdownOpen && (
            <aside className="pointer-events-auto flex-1 xl:max-w-xs baroque-cartouche baroque-border rounded-xl p-3 text-amber-50 shadow-[0_8px_32px_rgba(0,0,0,0.95)] bg-slate-950/95 border-amber-500/70">
              <div className="flex items-center justify-between border-b border-amber-900/80 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-cinzel font-black text-xs uppercase tracking-wider text-amber-200">
                    Krit & Kyrys
                  </span>
                </div>
                <span className="font-cinzel text-sm font-black text-amber-300 tabular-nums">
                  {meleeCalc.critChance} %
                </span>
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {meleeCalc.critModifiers.map((mod) => (
                  <ModifierRow key={mod.id} item={mod} />
                ))}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* =====================================================================
          2. ZÁKLADNÍ SPODNÍ PÁS: PŘETAHOVATELNÝ & MINIMALIZOVATELNÝ
         ===================================================================== */}
      <div
        style={ribbonDrag.dragStyle}
        className="pointer-events-auto flex flex-col items-center max-w-5xl w-full gap-1"
      >
        {/* Horní lišta čety + úchyt pro odsunutí + tlačítko sbalení spodní lišty (skryto při střelbě pro čistý výhled) */}
        {!isShootingView && (
          <div className="flex items-center justify-between w-full gap-2 px-1">
            <div className="flex items-center gap-1 overflow-x-auto">
              {playerUnits.map((u) => {
                const isSel = u.id === selectedUnitId;
                const uDetained = (u.detainedTurns ?? 0) > 0;
                const uTile = grid.getTile(u.pos);
                const uCov = uTile ? bestTileCover(uTile.cover) : "none";
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!u.alive || !canCommand}
                    onClick={() => selectUnit(u.id)}
                    title={`${u.name}: HP ${u.hp}/${u.maxHp}, AP ${u.ap}`}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-cinzel font-bold transition-all cursor-pointer whitespace-nowrap ${
                      !u.alive
                        ? "bg-slate-950/70 border-amber-950 text-amber-900/60 line-through"
                        : uDetained
                          ? "bg-red-950/90 border-red-500 text-rose-200 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                          : isSel
                            ? "bg-amber-600/40 border-amber-400 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                            : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
                    }`}
                  >
                    {u.isVip && <span className="text-amber-400 text-[10px]">★</span>}
                    <span className="truncate max-w-[130px]">{u.name}</span>
                    {uCov !== "none" && u.alive && (
                      <BaroqueCoverBadge cover={uCov} size="sm" />
                    )}
                    {uDetained ? (
                      <span className="text-[9px] text-rose-300 font-black">
                        {u.detainedTurns}/2
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 tabular-nums">
                        <span className="text-[9px] text-emerald-400 font-black font-cinzel">
                          {u.hp}HP
                        </span>
                        <span className="text-[9px] text-amber-300 font-black font-cinzel">
                          {u.ap}AP
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Ovládání pozice a sbalení spodní lišty */}
            <div
              onPointerDown={ribbonDrag.onPointerDown}
              title="Tažením myší můžete spodní lištu odsunout stranou"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/95 border border-amber-500/70 text-amber-300 cursor-grab active:cursor-grabbing shrink-0"
            >
              <GripHorizontal className="w-3.5 h-3.5 text-amber-400/70" />
              {ribbonDrag.hasMoved && (
                <button
                  type="button"
                  onClick={ribbonDrag.resetOffset}
                  title="Vrátit spodní lištu na výchozí místo"
                  className="p-0.5 rounded hover:text-amber-100 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setRibbonMinimized((prev) => !prev)}
                title={
                  ribbonMinimized
                    ? "Rozbalit akční lištu"
                    : "Minimalizovat akční lištu pro volný výhled na spodek mapy"
                }
                className="flex items-center gap-1 text-[10px] font-cinzel font-black px-1 hover:text-amber-100 cursor-pointer"
              >
                <span>{ribbonMinimized ? "Rozbalit HUD" : "Sbalit"}</span>
                {ribbonMinimized ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {!ribbonMinimized && (
          <div className="flex flex-col md:flex-row items-stretch md:items-end justify-center gap-2.5 w-full">
            {/* Karta vybraného vojáka (skryta během míření/střelby pro nezakrytý výhled) */}
            {!isShootingView &&
              (selectedUnit ? (
              <div className="flex items-center gap-2.5 baroque-cartouche baroque-border rounded-xl p-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.85)] text-amber-50 bg-slate-950/95 border-amber-500/80 shrink-0">
                <div className="w-10 h-10 rounded-lg bg-amber-950/80 border border-amber-500/70 flex items-center justify-center text-amber-300 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                  <User className="w-5 h-5" />
                </div>

                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-cinzel font-black text-xs text-amber-100 truncate max-w-[135px]">
                      {selectedUnit.name}
                    </span>
                    {selectedUnit.isVip && (
                      <span className="text-[9px] font-cinzel font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/60">
                        VIP
                      </span>
                    )}
                    {/* Srozumitelná barokní ikona krytu s číslem (−20 / −40 / 0) */}
                    <BaroqueCoverBadge
                      cover={bestCov}
                      size="sm"
                      showZero
                      showPercentSign
                    />
                  </div>

                  <div className="font-literata text-[10px] text-amber-200/90 truncate max-w-[195px] font-medium">
                    {selectedUnit.buffTitle ? (
                      <span
                        className={
                          isSelectedDetained
                            ? "text-rose-400 font-bold"
                            : "text-amber-300 font-semibold"
                        }
                      >
                        {selectedUnit.buffTitle} ·{" "}
                      </span>
                    ) : null}
                    {selectedUnit.id === "player-colloredo" ? (
                      <span>
                        {selectedUnit.weapon.name} {selectedUnit.pistolLoaded ? "(1/1)" : "(0/1 vybitá)"} · Pažba (1–2 HP)
                      </span>
                    ) : (
                      <span>
                        {selectedUnit.weapon.name} ({selectedUnit.weapon.minDamage}–{selectedUnit.weapon.maxDamage} HP)
                        {selectedUnit.meleeWeapon && (
                          <span className="text-amber-300/80"> · {selectedUnit.meleeWeapon.name}</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* HP Pips & Armor Pips & AP Dots */}
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="flex items-center gap-0.5"
                      title={`Zdraví: ${selectedUnit.hp} / ${selectedUnit.maxHp}`}
                    >
                      {Array.from({ length: selectedUnit.maxHp }, (_, i) => (
                        <span
                          key={i}
                          className={`w-2.5 h-2.5 rounded-[1px] border ${
                            i < selectedUnit.hp
                              ? "bg-rose-500 border-rose-300 shadow-[0_0_4px_#f43f5e]"
                              : "bg-slate-900 border-slate-700"
                          }`}
                        />
                      ))}
                    </div>

                    {selectedUnit.maxArmor > 0 && (
                      <div
                        className="flex items-center gap-0.5"
                        title={`Zbroj: ${selectedUnit.armor} / ${selectedUnit.maxArmor}`}
                      >
                        {Array.from({ length: selectedUnit.maxArmor }, (_, i) => (
                          <span
                            key={i}
                            className={`w-2.5 h-2.5 rounded-[1px] border ${
                              i < selectedUnit.armor
                                ? "bg-amber-400 border-amber-200 shadow-[0_0_4px_#fbbf24]"
                                : "bg-slate-900 border-slate-700"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    <div
                      className="flex items-center gap-0.5 pl-1.5 border-l border-amber-900/80"
                      title={`Akční body: ${selectedUnit.ap} / ${selectedUnit.maxAp}`}
                    >
                      {Array.from({ length: selectedUnit.maxAp }, (_, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full border ${
                            i < selectedUnit.ap
                              ? "bg-amber-300 border-amber-200 shadow-[0_0_5px_#fef08a]"
                              : "bg-transparent border-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                <div className="baroque-cartouche baroque-border rounded-xl p-2.5 text-xs font-literata italic text-amber-300/80 bg-slate-950/95 border-amber-500/70">
                  Vyberte vojáka
                </div>
              ))}

            {/* STŘEDNÍ ČÁST: MORFUJÍCÍ OBSAH (AKČNÍ TLAČÍTKA NEBO TARGET RIBBON) */}
            <div className="flex-1 baroque-cartouche baroque-border rounded-xl p-2 shadow-[0_4px_24px_rgba(0,0,0,0.85)] bg-slate-950/95 border-amber-500/80">
              {isAiming ? (
                visibleTargets.length === 0 || !calc || !targetUnit ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-cinzel text-amber-300 font-bold">
                      Žádný cíl není v přímé viditelnosti (3D LoS) ani v dostřelu.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActionMode("move")}
                      className="px-3.5 py-1.5 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 transition-colors cursor-pointer"
                    >
                      Zpět k pohybu (Esc)
                    </button>
                  </div>
                ) : (
                  /* REŽIM MÍŘENÍ: TARGET RIBBON s barokními ikonami krytu s číslem */
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    <button
                      type="button"
                      onClick={() => setActionMode("move")}
                      title="Návrat do režimu pohybu (Esc)"
                      className="flex items-center gap-1 px-2.5 py-2 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Zpět (Esc)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cycleTarget(-1)}
                      title="Předchozí cíl (Shift + Tab)"
                      className="p-2 rounded baroque-bronze-btn text-amber-300 hover:text-amber-100 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto px-1">
                      {visibleTargets.map((ev) => {
                        const enemy = units.find((u) => u.id === ev.targetId);
                        if (!enemy) return null;
                        const isSelectedTarget = ev.targetId === calc?.targetId;
                        const isPreMoveTarget = hoveredSpottedEnemyIds.includes(ev.targetId);
                        const cat = ev.calculation.ribbonCategory;

                        const badgePalette =
                          isPreMoveTarget
                            ? "bg-red-950/95 border-amber-400 text-amber-100 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]"
                            : cat === "flanked"
                            ? isSelectedTarget
                              ? "bg-amber-600/40 border-amber-300 text-amber-100 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                              : "bg-amber-950/80 border-amber-500/70 text-amber-200 hover:border-amber-300"
                            : cat === "extreme_range"
                              ? isSelectedTarget
                                ? "bg-sky-950/90 border-sky-400 text-sky-100 ring-2 ring-sky-400/60"
                                : "bg-slate-900 border-slate-700 text-amber-200/90 hover:border-slate-500"
                              : isSelectedTarget
                                ? "bg-red-950/95 border-red-400 text-rose-100 ring-2 ring-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                                : "bg-red-950/70 border-red-600/60 text-rose-200 hover:border-red-400";

                        return (
                          <button
                            key={ev.targetId}
                            type="button"
                            onClick={() => selectTarget(ev.targetId)}
                            title={`${enemy.name} · ${ev.calculation.hitChance} % zásah`}
                            className={`flex-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border transition-all cursor-pointer min-w-[155px] ${badgePalette}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-950 border border-amber-500/50 shrink-0">
                                <Skull className="w-3.5 h-3.5 text-rose-400" />
                              </div>

                              <div className="text-left min-w-0">
                                <div className="text-xs font-cinzel font-black truncate text-amber-100">
                                  {enemy.name}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-cinzel font-bold tabular-nums">
                                  <span className="text-amber-300">
                                    {ev.calculation.hitChance}% ZÁSAH
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Barokní ikona krytu s číslem (−40 / −20 / 0) */}
                            <BaroqueCoverBadge
                              cover={
                                ev.calculation.isFlanked
                                  ? "none"
                                  : ev.calculation.targetCover
                              }
                              size="sm"
                              showZero
                            />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => cycleTarget(1)}
                      title="Další cíl (Tab)"
                      className="flex items-center gap-1 px-2.5 py-2 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-300 hover:text-amber-100 cursor-pointer"
                    >
                      <span>Tab</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              ) : isMeleeAiming ? (
                visibleMeleeTargets.length === 0 || !meleeCalc || !meleeTargetUnit ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-cinzel text-amber-300 font-bold">
                      Žádný nepřítel není na sousední dlaždici (kontakt 1 pole).
                    </span>
                    <button
                      type="button"
                      onClick={() => setActionMode("move")}
                      className="px-3.5 py-1.5 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 transition-colors cursor-pointer"
                    >
                      Zpět k pohybu (Esc)
                    </button>
                  </div>
                ) : (
                  /* REŽIM BOJE ZBLÍZKA: TARGET RIBBON */
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    <button
                      type="button"
                      onClick={() => setActionMode("move")}
                      title="Návrat do režimu pohybu (Esc)"
                      className="flex items-center gap-1 px-2.5 py-2 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Zpět (Esc)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cycleTarget(-1)}
                      title="Předchozí cíl (Shift + Tab)"
                      className="p-2 rounded baroque-bronze-btn text-amber-300 hover:text-amber-100 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto px-1">
                      {visibleMeleeTargets.map((ev) => {
                        const enemy = units.find((u) => u.id === ev.targetId);
                        if (!enemy) return null;
                        const isSelectedTarget = ev.targetId === meleeCalc?.targetId;

                        return (
                          <button
                            key={ev.targetId}
                            type="button"
                            onClick={() => selectTarget(ev.targetId)}
                            title={`${enemy.name} · ${ev.calculation.hitChance} % zásah zblízka`}
                            className={`flex-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border transition-all cursor-pointer min-w-[155px] ${
                              isSelectedTarget
                                ? "bg-amber-600/40 border-amber-300 text-amber-100 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                                : "bg-amber-950/80 border-amber-500/70 text-amber-200 hover:border-amber-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-950 border border-amber-500/50 shrink-0">
                                <Swords className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                              <div className="text-left min-w-0">
                                <div className="text-xs font-cinzel font-black truncate text-amber-100">
                                  {enemy.name}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-cinzel font-bold tabular-nums">
                                  <span className="text-amber-300">
                                    {ev.calculation.hitChance}% ZÁSAH
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/50">
                              1m
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => cycleTarget(1)}
                      title="Další cíl (Tab)"
                      className="flex items-center gap-1 px-2.5 py-2 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-300 hover:text-amber-100 cursor-pointer"
                    >
                      <span>Tab</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              ) : (
                /* BĚŽNÝ REŽIM: ŘADA AKČNÍCH TLAČÍTEK ([1] - [5], [B] a [Space]) */
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex-1 grid grid-cols-6 gap-1.5">
                    <button
                      type="button"
                      disabled={!canCommand}
                      onClick={() => setActionMode("move")}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-xs font-cinzel font-black transition-all cursor-pointer ${
                        actionMode === "move" && canCommand
                          ? "bg-amber-600/40 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                          : "baroque-bronze-btn text-amber-200/90 hover:text-amber-100 disabled:opacity-40"
                      } ${
                        isStep1Highlight && canCommand && hasAp
                          ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
                          : ""
                      }`}
                    >
                      <Footprints className="w-4 h-4 mb-0.5 text-amber-400" />
                      <div className="flex items-center gap-1">
                        <span>Pohyb</span>
                        <span className="text-[9px] text-amber-300 font-bold">[1]</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canCommand || !anyUnitCanShoot || isColloredoDischarged}
                      onClick={() =>
                        setActionMode(actionMode === "shoot" ? "move" : "shoot")
                      }
                      title={
                        isColloredoDischarged
                          ? "Kolečková bambitka byla vystřelena a v boji ji nelze znovu nabít! Použijte úder pažbou [B]."
                          : undefined
                      }
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-xs font-cinzel font-black transition-all cursor-pointer ${
                        actionMode === "shoot"
                          ? "bg-red-900/90 border-red-400 text-rose-100 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                          : isColloredoDischarged
                            ? "bg-stone-900/80 border-stone-700 text-stone-500 cursor-not-allowed opacity-60"
                            : "baroque-bronze-btn text-amber-200/90 hover:text-rose-200 disabled:opacity-40"
                      } ${
                        isStep2Highlight && canCommand && anyUnitCanShoot && !isColloredoDischarged
                          ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
                          : ""
                      }`}
                    >
                      <Crosshair className="w-4 h-4 text-rose-400 mb-0.5" />
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[85px]">
                          {isColloredoDischarged
                            ? "Vybitá (0/1)"
                            : `Střelba (${visibleTargets.length > 0 ? visibleTargets.length : "✓"})`}
                        </span>
                        <span className="text-[9px] text-amber-300 font-bold">[2]</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canCommand || !hasAp || visibleMeleeTargets.length === 0}
                      onClick={() =>
                        setActionMode(actionMode === "melee" ? "move" : "melee")
                      }
                      title={
                        selectedUnit?.id === "player-colloredo"
                          ? "Úder těžkou ořechovou pažbou vybité bambitky (1–2 HP zranění, nouzový boj zblízka)"
                          : `Útok chladnou zbraní: ${selectedUnit?.meleeWeapon?.name ?? "Dýka"} (${selectedUnit?.meleeWeapon?.minDamage}–${selectedUnit?.meleeWeapon?.maxDamage} HP)`
                      }
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-xs font-cinzel font-black transition-all cursor-pointer ${
                        actionMode === "melee"
                          ? "bg-amber-700/90 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                          : visibleMeleeTargets.length > 0 && hasAp && canCommand
                            ? "bg-amber-950/90 border-amber-500/80 text-amber-200 hover:text-amber-100 ring-1 ring-amber-400/50"
                            : "baroque-bronze-btn text-amber-200/90 hover:text-amber-100 disabled:opacity-40"
                      }`}
                    >
                      <Swords className="w-4 h-4 text-amber-400 mb-0.5" />
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[85px]">
                          {selectedUnit?.id === "player-colloredo"
                            ? "Pažba"
                            : `Zblízka (${visibleMeleeTargets.length})`}
                        </span>
                        <span className="text-[9px] text-amber-300 font-bold">[B]</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canCommand || !hasAp || !!selectedUnit?.isOverwatch}
                      onClick={activateOverwatch}
                      className="flex flex-col items-center justify-center py-1.5 px-1 rounded border baroque-bronze-btn text-amber-200/90 hover:text-amber-100 text-xs font-cinzel font-black transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-amber-400 mb-0.5" />
                      <div className="flex items-center gap-1">
                        <span>Hlídka</span>
                        <span className="text-[9px] text-amber-300 font-bold">[3]</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={
                        !canCommand || !hasAp || (selectedUnit?.grenades ?? 0) <= 0
                      }
                      onClick={() =>
                        setActionMode(actionMode === "grenade" ? "move" : "grenade")
                      }
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-xs font-cinzel font-black transition-all cursor-pointer ${
                        actionMode === "grenade"
                          ? "bg-orange-900/90 border-orange-400 text-amber-100 shadow-[0_0_12px_rgba(249,115,22,0.5)]"
                          : "baroque-bronze-btn text-amber-200/90 hover:text-orange-200 disabled:opacity-40"
                      } ${
                        isStep3Highlight && canCommand && hasAp && (selectedUnit?.grenades ?? 0) > 0
                          ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
                          : ""
                      }`}
                    >
                      <Bomb className="w-4 h-4 text-orange-400 mb-0.5" />
                      <div className="flex items-center gap-1">
                        <span>Granát ({selectedUnit?.grenades ?? 0})</span>
                        <span className="text-[9px] text-amber-300 font-bold">[4]</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canUseAbility}
                      onClick={() => activateSpecialAbility()}
                      title={
                        ability
                          ? `${ability.name} (${ability.apCost} AP, obnova ${ability.cooldownTurns} kola): ${ability.description}`
                          : "Zvláštní schopnost"
                      }
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-xs font-cinzel font-black transition-all cursor-pointer ${
                        selectedUnit?.abilityBuffActive
                          ? "bg-amber-600/40 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                          : canUseAbility
                            ? "bg-amber-950/80 border-amber-500/70 text-amber-200 hover:border-amber-300 hover:bg-amber-900/80"
                            : "baroque-bronze-btn text-amber-400/50 disabled:opacity-40"
                      } ${
                        shouldHighlightAbility
                          ? "ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.65)] animate-pulse"
                          : ""
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-400 mb-0.5" />
                      <div className="flex items-center gap-1 max-w-full">
                        <span className="truncate">
                          {ability && ability.currentCooldown > 0
                            ? `Schopnost (CD ${ability.currentCooldown})`
                            : ability
                              ? `Schopnost (${ability.apCost} AP)`
                              : "Schopnost"}
                        </span>
                        <span className="text-[9px] text-amber-300 font-bold">[5]</span>
                      </div>
                    </button>
                  </div>

                  {/* 6. Konec tahu */}
                  <button
                    type="button"
                    disabled={!canCommand}
                    onClick={endTurn}
                    title={
                      !anyUnitHasAp && canCommand
                        ? "Všichni vojáci vyčerpali své akční body (0 AP). Stiskněte pro ukončení tahu!"
                        : "Ukončit tah hráče (Mezerník)"
                    }
                    className={`flex flex-col items-center justify-center py-1.5 px-3.5 rounded border text-stone-950 text-xs font-cinzel font-black uppercase tracking-wider transition-all disabled:opacity-40 shrink-0 cursor-pointer ${
                      !anyUnitHasAp && canCommand
                        ? "bg-amber-400 hover:bg-amber-300 border-amber-200 ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.85)] animate-pulse"
                        : "bg-amber-500 hover:bg-amber-400 border-amber-300 shadow-[0_2px_12px_rgba(245,158,11,0.5)]"
                    }`}
                  >
                    <SkipForward className="w-4 h-4 mb-0.5 text-stone-950" />
                    <div className="flex items-center gap-1">
                      <span>Konec</span>
                      <span className="text-[9px] opacity-90">[⎵]</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
