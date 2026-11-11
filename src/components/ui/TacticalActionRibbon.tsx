/**
 * Tactical Action Ribbon (/src/components/ui/TacticalActionRibbon.tsx).
 * Radikálně zeštíhlený barokní HUD ve stylu XCOM 2 (Pilíře 1 a 4):
 * 1. Kontextové vrstvení (Progressive Disclosure):
 *    - Vlevo dole: Kompaktní mikro-medailon aktivního vojáka s integrovanými mikro-tečkami čety (žádné duplicitní karty všech postav).
 *    - Uprostřed dole: Ultratenký dok čtvercových 42×42px ikon schopností [1..5, R, B, Space].
 *    - Detaily schopnosti (název, AP cena, poškození, cooldown) se vynoří v plovoucím barokním tooltipu až při hoveru.
 * 2. Stavový automat HUDu (HUD State Machine):
 *    - TACTICAL_IDLE: Zobrazuje mikro-medailon vlevo dole a tenký dok ikon uprostřed dole.
 *    - AIMING_OVER_SHOULDER: Skryje medailon střelce a promění spodní střed v nízkoprofilový zaměřovací retikul
 *      s pásem cílů (Target Ribbon) a výsuvnými matematickými křídly (tlačítko Rozpad / hover).
 *    - CINEMATIC_EXECUTION (let střely / akční kamera běhu): Skryje veškeré 2D panely pro 100% filmový výhled.
 *    - ENEMY_TURN: Minimalizuje spodní dok.
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
  GripHorizontal,
  RotateCcw,
  SkipForward,
  Skull,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import { useState } from "react";
import { bestTileCover } from "../../core/GridSystem";
import type { StatModifier } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { BaroqueCoverBadge } from "./BaroqueCoverBadge";
import { UnitPortrait } from "./UnitPortrait";
import { useDraggableHud } from "./useDraggableHud";

interface AbilityTooltipData {
  id: string;
  title: string;
  hotkey: string;
  costLabel: string;
  summary: string;
  detail?: string;
  warning?: string;
}

function ModifierRow({ item }: { item: StatModifier }) {
  const isPositive =
    item.kind === "bonus" || (item.kind === "base" && item.value > 0);
  const isPenalty = item.kind === "penalty" || item.value < 0;

  const formattedValue =
    item.unit === "%"
      ? `${item.value > 0 ? `+${item.value}` : item.value} %`
      : `${item.value > 0 ? `+${item.value}` : item.value} ${item.unit}`;

  return (
    <div className="flex items-start justify-between gap-2.5 py-1 px-2 rounded bg-slate-950/90 border border-amber-500/40 text-[10px]">
      <div className="min-w-0">
        <div className="font-cinzel font-black text-amber-100 leading-tight truncate">
          {item.label}
        </div>
        {item.detail && (
          <div className="font-literata italic text-[9px] text-amber-200/80 leading-tight">
            {item.detail}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 font-cinzel font-black px-1.5 py-0.2 rounded text-[9px] tabular-nums ${
          item.kind === "base"
            ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
            : isPositive
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/60"
              : isPenalty
                ? "bg-rose-950/90 text-rose-300 border border-rose-500/60"
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
  const breakdownOpen = useGameStore((s) => s.breakdownOpen);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const demonstratedAbilities = useGameStore((s) => s.demonstratedAbilities);

  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const activeMovement = useGameStore((s) => s.activeMovement);
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
  const executeReload = useGameStore((s) => s.executeReload);
  const executeMelee = useGameStore((s) => s.executeMelee);
  const visibleMeleeTargets = useGameStore((s) => s.visibleMeleeTargets);

  const [hoveredAbility, setHoveredAbility] =
    useState<AbilityTooltipData | null>(null);
  const [hoverBreakdownPreview, setHoverBreakdownPreview] = useState(false);

  const aimDrag = useDraggableHud();
  const dockDrag = useDraggableHud();
  const medallionDrag = useDraggableHud();

  const playerUnits = units.filter((u) => u.faction === "player");
  const selectedUnit =
    units.find((u) => u.id === selectedUnitId && u.alive) ?? null;

  // =========================================================================
  // STAVOVÝ AUTOMAT HUDu (Pillar 4)
  // =========================================================================
  const isCinematicExecution =
    activeProjectile !== null ||
    Boolean(isBusy && activeMovement?.isActionCam);
  const isAimingShoot = actionMode === "shoot" && !isBusy && !activeProjectile;
  const isAimingMelee = actionMode === "melee" && !isBusy && !activeProjectile;
  const isAimingOverShoulder = isAimingShoot || isAimingMelee;

  // Při filmové exekuci (let střely / akční sprint kamery) se 2D HUD zcela skryje
  if (isCinematicExecution) {
    return null;
  }

  const canCommand = turn === "player" && !isBusy;
  const isSelectedDetained =
    (selectedUnit?.detainedTurns ?? 0) > 0 || (selectedUnit ? !selectedUnit.alive : false);
  const hasAp = (selectedUnit?.ap ?? 0) > 0 && !isSelectedDetained;
  const anyUnitHasAp = playerUnits.some(
    (u) => u.alive && u.ap > 0 && (u.detainedTurns ?? 0) === 0,
  );
  const isColloredoDischarged =
    selectedUnit?.id === "player-colloredo" &&
    selectedUnit?.pistolLoaded === false;
  const isFirearmEmpty = selectedUnit?.firearmLoaded === false;
  const reloadProgress = selectedUnit?.reloadProgress ?? 0;
  const reloadApCost = selectedUnit?.weapon.reloadApCost ?? 2;
  const canReload =
    canCommand &&
    !isSelectedDetained &&
    isFirearmEmpty &&
    selectedUnit?.id !== "player-colloredo" &&
    (selectedUnit?.ap ?? 0) >= 1;
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
              u.weapon.maxRange,
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

  const guidedTutorial = useGameStore((s) => s.guidedTutorial);
  const isGuidedActive = guidedTutorial?.enabled && !guidedTutorial.dismissed;
  const guidedStep = guidedTutorial?.currentStep;

  const isTutorialActive = !tutorialDismissed && tutorialStep !== null;
  const isStep1Highlight = isGuidedActive
    ? guidedStep === "step_1_matej_move" || guidedStep === "step_2_colloredo_escort"
    : isTutorialActive && tutorialStep === 1;
  const isStep2Highlight = isGuidedActive
    ? guidedStep === "step_3_vaclav_aim" || guidedStep === "step_4_vaclav_shoot"
    : isTutorialActive && tutorialStep === 2;
  const isStep3Highlight = isGuidedActive
    ? guidedStep === "step_7_keg_explosion"
    : isTutorialActive && tutorialStep === 3;
  const isReloadHighlight = isGuidedActive && guidedStep === "step_6_vaclav_reload";
  const isMeleeHighlight = isGuidedActive && guidedStep === "step_8_melee_finish";

  const showBreakdownWings = breakdownOpen || hoverBreakdownPreview;

  const cycleSquadMember = (delta: 1 | -1) => {
    const activeSquad = playerUnits.filter(
      (u) =>
        u.alive &&
        u.hp > 0 &&
        u.ap > 0 &&
        (u.detainedTurns ?? 0) === 0,
    );
    if (activeSquad.length <= 1) return;
    const idx = activeSquad.findIndex((u) => u.id === selectedUnitId);
    const nextIdx =
      idx < 0
        ? 0
        : (idx + delta + activeSquad.length) % activeSquad.length;
    const next = activeSquad[nextIdx];
    if (next) selectUnit(next.id);
  };

  return (
    <>
      {/* =====================================================================
          STAV 1: TACTICAL_IDLE — LEVÝ SPODNÍ MIKRO-MEDAILON VOJÁKA (bez duplicit)
         ===================================================================== */}
      {!isAimingOverShoulder && selectedUnit && (
        <aside
          aria-label="Status vybraného vojáka"
          style={medallionDrag.dragStyle}
          className="pointer-events-auto fixed bottom-3 left-3 z-30 flex flex-col gap-1 select-none max-w-[270px]"
        >
          <div className="baroque-cartouche baroque-border rounded-xl px-2.5 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.9)] bg-slate-950/90 border-amber-500/60 backdrop-blur-md">
            {/* Horní mikro-pás přepínání čety (nahrazuje široký redundantní pás karet) */}
            <div
              onPointerDown={medallionDrag.onPointerDown}
              title="Tažením lze medailon posunout · Kliknutím nebo klávesou [Tab] přepnete vojáka"
              className="flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-amber-900/60 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-1">
                <GripHorizontal className="w-3 h-3 text-amber-400/50 shrink-0" />
                {playerUnits.map((u) => {
                  const isSel = u.id === selectedUnitId;
                  const uDetained = (u.detainedTurns ?? 0) > 0;
                  const isTurnEnded = !u.alive || u.ap === 0 || uDetained;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!u.alive || !canCommand}
                      onClick={() => selectUnit(u.id)}
                      title={`${u.name} (${u.inDeathThroes ? `V POSLEDNÍM VZEPĚTÍ: ${u.hp}/${u.maxHp}` : `${u.hp}/${u.maxHp}`} HP, ${u.ap} AP)${isTurnEnded ? " — Tah ukončen" : ""}`}
                      className={`relative w-5 h-5 rounded-md flex items-center justify-center border text-[10px] font-cinzel font-black transition-all cursor-pointer ${
                        !u.alive
                          ? "bg-slate-950/50 border-slate-800 text-slate-600 opacity-35"
                          : u.inDeathThroes
                            ? "bg-purple-950 border-rose-500 text-rose-200 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.5)]"
                            : uDetained
                              ? "bg-red-950 border-red-400 text-rose-200 animate-pulse"
                              : isSel
                                ? isTurnEnded
                                  ? "bg-stone-700 text-stone-200 border-stone-400 shadow-[0_0_6px_rgba(168,162,158,0.5)] scale-105"
                                  : "bg-amber-500 text-stone-950 border-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.6)] scale-105"
                                : isTurnEnded
                                  ? "bg-stone-900/80 border-stone-700/60 text-stone-500 opacity-50 grayscale hover:opacity-80"
                                  : "bg-slate-900/90 border-amber-700/50 text-amber-200/80 hover:border-amber-400"
                      }`}
                    >
                      <span>{u.name.charAt(0)}</span>
                      {u.alive && u.ap > 0 && !uDetained && (
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                            isSel ? "bg-sky-300" : "bg-emerald-400"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canCommand || playerUnits.filter((u) => u.alive && u.ap > 0 && (u.detainedTurns ?? 0) === 0).length <= 1}
                onClick={() => cycleSquadMember(1)}
                title="Další dostupný voják čety [Tab]"
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-700/50 hover:border-amber-400 disabled:opacity-35 text-[10px] font-cinzel font-black text-amber-300 cursor-pointer"
              >
                Tab ⇥
              </button>
            </div>

            {/* Jádro medailonu aktivního vojáka */}
            <div className="flex items-center gap-2">
              <UnitPortrait
                archetype={selectedUnit.archetype}
                faction={selectedUnit.faction}
                name={selectedUnit.name}
                size="sm"
                isVip={selectedUnit.isVip}
                alive={selectedUnit.alive}
                isDetained={isSelectedDetained}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-cinzel font-black text-xs text-amber-100 truncate">
                    {selectedUnit.name}
                  </span>
                  <BaroqueCoverBadge cover={bestCov} size="sm" showZero />
                </div>

                {/* Čistá neorámovaná metadata zbraně (Zero-Pill Discipline) */}
                <div className="font-literata text-[10px] text-amber-200/85 truncate leading-tight mt-0.5 tabular-nums">
                  <span>{selectedUnit.weapon.name}</span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {selectedUnit.weapon.minDamage}–
                    {selectedUnit.weapon.maxDamage} HP
                  </span>
                  {selectedUnit.id === "player-colloredo" ? (
                    <span className="text-amber-300">
                      {" "}
                      · {selectedUnit.pistolLoaded ? "1/1" : "Vybitá"}
                    </span>
                  ) : selectedUnit.firearmLoaded === false ? (
                    <span className="text-orange-300 font-semibold">
                      {" "}
                      · Nabití {reloadProgress}/{reloadApCost}
                    </span>
                  ) : null}
                </div>

                {/* Mikro-segmenty Zdraví, Zbroje a Akčních bodů */}
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex items-center gap-[2px]"
                      title={`Zdraví: ${selectedUnit.hp}/${selectedUnit.maxHp}`}
                    >
                      {Array.from({ length: selectedUnit.maxHp }, (_, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-[1px] ${
                            i < selectedUnit.hp
                              ? "bg-emerald-400 shadow-[0_0_3px_#34d399]"
                              : "bg-slate-800"
                          }`}
                        />
                      ))}
                    </div>

                    {selectedUnit.maxArmor > 0 && (
                      <div
                        className="flex items-center gap-[2px] pl-1 border-l border-amber-900/70"
                        title={`Zbroj: ${selectedUnit.armor}/${selectedUnit.maxArmor}`}
                      >
                        {Array.from(
                          { length: selectedUnit.maxArmor },
                          (_, i) => (
                            <span
                              key={i}
                              className={`w-2 h-1.5 rounded-[1px] ${
                                i < selectedUnit.armor
                                  ? "bg-amber-400"
                                  : "bg-slate-800"
                              }`}
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Zlaté tečky AP */}
                  <div
                    className="flex items-center gap-1"
                    title={`Akční body: ${selectedUnit.ap}/${selectedUnit.maxAp} AP`}
                  >
                    {Array.from({ length: selectedUnit.maxAp }, (_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full border ${
                          i < selectedUnit.ap
                            ? "bg-amber-300 border-amber-100 shadow-[0_0_5px_#fef08a]"
                            : "bg-transparent border-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* =====================================================================
          PRAVÝ SPODNÍ ROH: XCOM 2 IKONY HLAV VIDITELNÝCH CÍLŮ (Target Heads)
          Levým kliknutím (LKM) přepínáte mezi viditelnými cíli nebo zahájíte míření
         ===================================================================== */}
      {canCommand && visibleTargets.length > 0 && !isAimingMelee && (
        <aside
          aria-label="Viditelné cíle v dohledu"
          onContextMenu={(e) => {
            e.preventDefault();
            if (actionMode !== "move") setActionMode("move");
          }}
          className="pointer-events-auto fixed bottom-3 right-3 z-30 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-950/92 border border-red-500/60 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,0.92)] select-none"
        >
          {visibleTargets.length > 1 && (
            <button
              type="button"
              onClick={() => cycleTarget(-1)}
              title="Předchozí cíl [Shift+Tab]"
              className="p-1 rounded hover:bg-red-950/80 text-amber-300 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex items-center gap-1">
            {visibleTargets.map((ev) => {
              const enemy = units.find((u) => u.id === ev.targetId);
              if (!enemy) return null;
              const isSelTarget =
                isAimingShoot && ev.targetId === (calc?.targetId ?? selectedTargetId);
              const isFlanked = ev.calculation.isFlanked;
              return (
                <button
                  key={ev.targetId}
                  type="button"
                  onClick={() => {
                    selectTarget(ev.targetId);
                    if (actionMode !== "shoot") {
                      setActionMode("shoot");
                    }
                  }}
                  title={`${enemy.name} · ${ev.calculation.hitChance}% zásah (LKM: Zaměřit cíl)`}
                  className={`relative flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-cinzel font-black tabular-nums transition-all cursor-pointer ${
                    isSelTarget
                      ? isFlanked
                        ? "bg-amber-500/35 border-amber-300 text-amber-100 ring-2 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] scale-105"
                        : "bg-red-900/95 border-red-300 text-rose-100 ring-2 ring-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)] scale-105"
                      : isFlanked
                        ? "bg-amber-950/85 border-amber-500/70 text-amber-200 hover:border-amber-300"
                        : "bg-slate-900/90 border-red-700/60 text-rose-200/90 hover:border-red-400"
                  }`}
                >
                  <Skull
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isFlanked ? "text-amber-300" : "text-rose-400"
                    }`}
                  />
                  <span>{ev.calculation.hitChance}%</span>
                  <BaroqueCoverBadge
                    cover={isFlanked ? "none" : ev.calculation.targetCover}
                    size="sm"
                  />
                </button>
              );
            })}
          </div>

          {visibleTargets.length > 1 && (
            <button
              type="button"
              onClick={() => cycleTarget(1)}
              title="Další cíl [Tab]"
              className="p-1 rounded hover:bg-red-950/80 text-amber-300 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </aside>
      )}

      {/* =====================================================================
          SPODNÍ STŘEDOVÁ KOTVA: BUĎ ZAMĚŘOVACÍ RETIKUL (MÍŘENÍ), NEBO DOK IKON
         ===================================================================== */}
      <footer
        aria-label="Taktická akční lišta"
        onContextMenu={(e) => {
          if (actionMode !== "move") {
            e.preventDefault();
            setActionMode("move");
          }
        }}
        className="pointer-events-none fixed bottom-3 left-0 right-0 z-30 flex flex-col items-center justify-end px-3 select-none"
      >
        {/* ===================================================================
            STAV 2: AIMING_OVER_SHOULDER — NÍZKOPROFILOVÝ ZAMĚŘOVACÍ RETIKUL
           =================================================================== */}
        {isAimingShoot && selectedUnit && (
          <div
            style={aimDrag.dragStyle}
            className="w-full max-w-4xl flex flex-col items-center gap-1.5"
          >
            {visibleTargets.length === 0 || !calc || !targetUnit ? (
              <div className="pointer-events-auto flex items-center gap-3 baroque-cartouche baroque-border rounded-xl px-4 py-2 bg-slate-950/92 border-amber-500/70 text-xs shadow-2xl">
                <span className="font-cinzel text-amber-200 font-bold">
                  Žádný cíl v přímém dohledu (3D LoS)
                </span>
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  className="px-3 py-1 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
                >
                  Zpět (PKM / Esc)
                </button>
              </div>
            ) : (
              <>
                <div className="w-full flex flex-col xl:flex-row items-center xl:items-end justify-center gap-2">
                  {/* LEVÉ KŘÍDLO ROZPADU (pouze při kliknutí nebo hoveru na Rozpad) */}
                  {showBreakdownWings && (
                    <aside className="pointer-events-auto w-full xl:w-64 baroque-cartouche baroque-border rounded-xl p-2.5 text-amber-50 shadow-2xl bg-slate-950/95 border-amber-500/60 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-amber-900/70 pb-1 mb-1.5">
                        <span className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-200">
                          Rozpad zásahu
                        </span>
                        <span className="font-cinzel text-xs font-black text-emerald-400 tabular-nums">
                          {calc.hitChance} %
                        </span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                        {calc.hitModifiers.map((mod) => (
                          <ModifierRow key={mod.id} item={mod} />
                        ))}
                      </div>
                    </aside>
                  )}

                  {/* STŘEDOVÝ KOMPAKTNÍ RETIKUL (1 tenká barokní lišta) */}
                  <div className="pointer-events-auto w-full max-w-md baroque-cartouche baroque-border rounded-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.95)] text-amber-50 bg-slate-950/92 border-amber-500/80 backdrop-blur-md">
                    {/* Hlavička cíle + Rozpad */}
                    <div
                      onPointerDown={aimDrag.onPointerDown}
                      className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-amber-900/70 cursor-grab active:cursor-grabbing"
                    >
                      <button
                        type="button"
                        onClick={toggleBreakdown}
                        onMouseEnter={() => setHoverBreakdownPreview(true)}
                        onMouseLeave={() => setHoverBreakdownPreview(false)}
                        title="Zobrazit matematický rozpad bonusů a postihů"
                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-cinzel font-black uppercase tracking-wider transition-all cursor-pointer ${
                          isStep2Highlight
                            ? "bg-amber-500/30 border-amber-300 text-amber-100 ring-2 ring-amber-400 animate-pulse"
                            : showBreakdownWings
                              ? "bg-amber-600/35 border-amber-400 text-amber-100"
                              : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
                        }`}
                      >
                        <ChevronLeft className="w-3 h-3 text-amber-400" />
                        <span>Rozpad</span>
                        <ChevronRight className="w-3 h-3 text-amber-400" />
                      </button>

                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-cinzel font-black text-xs text-amber-100 truncate">
                          {targetUnit.name}
                        </span>
                        <span className="text-[10px] font-cinzel font-bold text-amber-300/90 tabular-nums">
                          · {calc.distance}m
                        </span>
                        <BaroqueCoverBadge
                          cover={calc.isFlanked ? "none" : calc.targetCover}
                          size="sm"
                          showZero
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setActionMode("move")}
                        title="Zrušit míření [Pravé tlačítko myši / Esc]"
                        className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 4 Klíčové metriky + Tlačítko Výstřelu v jednom kompaktním pásu */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="grid grid-cols-4 gap-1.5 flex-1 text-center tabular-nums">
                        <div className="bg-slate-900/90 border border-emerald-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                            Zásah
                          </div>
                          <div className="text-base font-cinzel font-black text-emerald-400 leading-none mt-0.5">
                            {calc.hitChance}%
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-amber-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                            Krit
                          </div>
                          <div className="text-base font-cinzel font-black text-amber-300 leading-none mt-0.5">
                            {calc.critChance}%
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-rose-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                            Zranění
                          </div>
                          <div className="text-sm font-cinzel font-black text-rose-300 leading-none mt-0.5">
                            {calc.minDamage}–{calc.maxDamage}
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-orange-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80 flex items-center justify-center gap-0.5">
                            <AlertTriangle className="w-2 h-2 text-orange-400" />
                            <span>Selhání</span>
                          </div>
                          <div className="text-base font-cinzel font-black text-orange-400 leading-none mt-0.5">
                            {calc.misfireChance}%
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => executeShoot(calc.targetId)}
                        className="flex flex-col items-center justify-center px-3.5 py-2 rounded-lg bg-gradient-to-r from-red-700 via-amber-600 to-amber-500 hover:from-red-600 hover:to-amber-400 border border-amber-200 text-stone-950 font-cinzel font-black text-xs uppercase tracking-wider shadow-[0_0_16px_rgba(245,158,11,0.5)] transition-all cursor-pointer shrink-0"
                      >
                        <div className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-stone-950" />
                          <span>PAL!</span>
                        </div>
                        <span className="text-[9px] font-bold opacity-90 tabular-nums">
                          {calc.fireApCost ?? 1} AP · [LKM / ⎵]
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* PRAVÉ KŘÍDLO ROZPADU (pouze při kliknutí nebo hoveru na Rozpad) */}
                  {showBreakdownWings && (
                    <aside className="pointer-events-auto w-full xl:w-64 baroque-cartouche baroque-border rounded-xl p-2.5 text-amber-50 shadow-2xl bg-slate-950/95 border-amber-500/60 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-amber-900/70 pb-1 mb-1.5">
                        <span className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-200">
                          Krit & Kyrys
                        </span>
                        <span className="font-cinzel text-xs font-black text-amber-300 tabular-nums">
                          {calc.critChance} %
                        </span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                        {calc.critModifiers.map((mod) => (
                          <ModifierRow key={mod.id} item={mod} />
                        ))}
                      </div>
                    </aside>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================================================================
            STAV 2b: AIMING_OVER_SHOULDER (MELEE) — KOMPAKTNÍ RETIKUL ZBLÍZKA
           =================================================================== */}
        {isAimingMelee && selectedUnit && (
          <div
            style={aimDrag.dragStyle}
            className="w-full max-w-xl flex flex-col items-center gap-1.5"
          >
            {visibleMeleeTargets.length === 0 ||
            !meleeCalc ||
            !meleeTargetUnit ? (
              <div className="pointer-events-auto flex items-center gap-3 baroque-cartouche baroque-border rounded-xl px-4 py-2 bg-slate-950/92 border-amber-500/70 text-xs shadow-2xl">
                <span className="font-cinzel text-amber-200 font-bold">
                  Žádný nepřítel na sousední dlaždici (1m)
                </span>
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  className="px-3 py-1 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
                >
                  Zpět (Esc)
                </button>
              </div>
            ) : (
              <div className="pointer-events-auto w-full max-w-md baroque-cartouche baroque-border rounded-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.95)] text-amber-50 bg-slate-950/92 border-amber-500/80 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-amber-900/70">
                  <span className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-300">
                    Zblízka · {meleeCalc.weaponName}
                  </span>
                  <span className="font-cinzel font-black text-xs text-amber-100 truncate">
                    {meleeTargetUnit.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActionMode("move")}
                    className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="grid grid-cols-3 gap-1.5 flex-1 text-center tabular-nums">
                    <div className="bg-slate-900/90 border border-emerald-500/50 rounded-lg py-1 px-1.5">
                      <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                        Zásah
                      </div>
                      <div className="text-base font-cinzel font-black text-emerald-400 leading-none mt-0.5">
                        {meleeCalc.hitChance}%
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-amber-500/50 rounded-lg py-1 px-1.5">
                      <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                        Krit
                      </div>
                      <div className="text-base font-cinzel font-black text-amber-300 leading-none mt-0.5">
                        {meleeCalc.critChance}%
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-rose-500/50 rounded-lg py-1 px-1.5">
                      <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                        Zranění
                      </div>
                      <div className="text-sm font-cinzel font-black text-rose-300 leading-none mt-0.5">
                        {meleeCalc.minDamage}–{meleeCalc.maxDamage}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => executeMelee(meleeCalc.targetId)}
                    className="flex flex-col items-center justify-center px-3.5 py-2 rounded-lg bg-gradient-to-r from-red-700 via-amber-600 to-amber-500 hover:from-red-600 hover:to-amber-400 border border-amber-200 text-stone-950 font-cinzel font-black text-xs uppercase tracking-wider shadow-[0_0_16px_rgba(245,158,11,0.5)] transition-all cursor-pointer shrink-0"
                  >
                    <div className="flex items-center gap-1">
                      <Swords className="w-3.5 h-3.5 text-stone-950" />
                      <span>ÚDER!</span>
                    </div>
                    <span className="text-[9px] font-bold opacity-90">
                      1 AP · [⎵]
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            STAV 1 & 4: ULTRATENKÝ XCOM 2 DOK IKON SCHOPNOSTÍ + HOVER TOOLTIP
           =================================================================== */}
        {!isAimingOverShoulder && (
          <div
            style={dockDrag.dragStyle}
            className="pointer-events-auto relative flex flex-col items-center"
          >
            {/* Kontextový barokní tooltip schopnosti (Progressive Disclosure při hoveru i pro nepoužitelné akce, text zvětšen o 20% pro špičkovou čitelnost) */}
            {hoveredAbility && (
              <div className="pointer-events-none absolute bottom-full mb-2 w-80 max-w-[90vw] baroque-cartouche baroque-border rounded-xl px-3.5 py-2.5 bg-slate-950/98 border-amber-400/90 shadow-[0_10px_32px_rgba(0,0,0,0.98)] text-amber-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2 border-b border-amber-900/80 pb-1.5 mb-1.5">
                  <span className="font-cinzel font-black text-sm text-amber-200 truncate">
                    {hoveredAbility.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                    <span className="text-[11px] font-cinzel font-bold text-amber-300">
                      {hoveredAbility.costLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/60 text-[11px] font-cinzel font-black text-amber-200">
                      [{hoveredAbility.hotkey}]
                    </span>
                  </div>
                </div>
                <p className="font-literata text-[13px] text-amber-100 leading-snug">
                  {hoveredAbility.summary}
                </p>
                {hoveredAbility.detail && (
                  <p className="font-literata italic text-[12px] text-amber-300 mt-1.5 leading-snug">
                    {hoveredAbility.detail}
                  </p>
                )}
                {hoveredAbility.warning && (
                  <div className="flex items-center gap-1 mt-1.5 px-2 py-1 rounded bg-rose-950/90 border border-rose-500/70 text-rose-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="font-cinzel font-bold text-[11px] uppercase tracking-wide">
                      {hoveredAbility.warning}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Samotná tenká lišta čtvercových ikon schopností s plnou podporou hoveru i pro nepoužitelné akce */}
            <div className="flex items-center gap-1.5 baroque-cartouche baroque-border rounded-xl px-2 py-1.5 shadow-[0_6px_28px_rgba(0,0,0,0.92)] bg-slate-950/90 border-amber-500/70 backdrop-blur-md">
              <div
                onPointerDown={dockDrag.onPointerDown}
                title="Tažením lze dok schopností odsunout"
                className="px-0.5 text-amber-400/50 hover:text-amber-300 cursor-grab active:cursor-grabbing"
              >
                <GripHorizontal className="w-3.5 h-3.5" />
              </div>

              {/* [1] Pohyb */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "move",
                    title: "Taktický přesun & Sprint",
                    hotkey: "1 / PKM",
                    costLabel: "1–2 AP",
                    summary: `Pravým tlačítkem myši (PKM) na políčko okamžitě vyšlete vojáka na cestu. Modrá zóna (1 AP): Běžný přesun (${selectedUnit?.movePerAp ?? 4} polí). Zlatá zóna (2 AP): Sprint.`,
                    detail:
                      "XCOM 2 Zteč: Pravým klikem přímo na nepřítele v dosahu provedete okamžitý přesun spojený se seknutím (+0 AP navíc)!",
                    warning: !canCommand
                      ? "Nyní nelze zadat rozkaz"
                      : !hasAp
                        ? "Voják již nemá žádné volné akční body (tah ukončen)"
                        : undefined,
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={!canCommand}
                  onClick={() => setActionMode("move")}
                  aria-label="Pohyb [1]"
                  className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    actionMode === "move" && canCommand
                      ? "bg-amber-500/35 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                      : "baroque-bronze-btn text-amber-200/90 hover:text-amber-100 disabled:opacity-35 disabled:cursor-not-allowed"
                  } ${
                    isStep1Highlight && canCommand && hasAp
                      ? "ring-2 ring-amber-400 animate-pulse"
                      : ""
                  }`}
                >
                  <Footprints className="w-4 h-4 text-amber-300" />
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                    1
                  </span>
                </button>
              </div>

              {/* [2] Střelba */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "shoot",
                    title: `Palba: ${selectedUnit?.weapon.name ?? "Střelná zbraň"}`,
                    hotkey: "2",
                    costLabel: `${selectedUnit?.weapon.fireApCost ?? 1} AP (ukončuje tah)`,
                    summary: `Výstřel z pušky/muškety ukončuje tah vojáka. Zranění ${selectedUnit?.weapon.minDamage ?? 4}–${selectedUnit?.weapon.maxDamage ?? 6} HP · Průraz zbroje ${selectedUnit?.weapon.armorPierce ?? 1} · Dostřel ${selectedUnit?.weapon.maxRange ?? 12}m.`,
                    detail:
                      "LKM na ikonu hlavy nepřítele vpravo dole přepíná cíle · PKM míření zruší.",
                    warning: !canCommand
                      ? "Nyní nelze střílet"
                      : !hasAp
                        ? "Nedostatek AP pro střelbu"
                        : isColloredoDischarged
                          ? "Kolečková bambitka maršála byla vystřelena (použijte pažbu [B])"
                          : isFirearmEmpty
                            ? `Hlaveň je prázdná — nejprve nabijte [R] (${reloadProgress}/${reloadApCost} AP)`
                            : visibleTargets.length === 0
                              ? "Žádný nepřítel není v přímé viditelnosti (3D LoS) z této dlaždice"
                              : undefined,
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand ||
                    (!anyUnitCanShoot &&
                      (isColloredoDischarged ||
                        isFirearmEmpty ||
                        visibleTargets.length === 0))
                  }
                  onClick={() =>
                    setActionMode(actionMode === "shoot" ? "move" : "shoot")
                  }
                  aria-label="Střelba [2]"
                  className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    actionMode === "shoot"
                      ? "bg-red-900/90 border-red-400 text-rose-100 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                      : "baroque-bronze-btn text-amber-200/90 hover:text-rose-200 disabled:opacity-35 disabled:cursor-not-allowed"
                  } ${
                    isStep2Highlight &&
                    canCommand &&
                    anyUnitCanShoot &&
                    !isColloredoDischarged &&
                    !isFirearmEmpty
                      ? "ring-2 ring-amber-400 animate-pulse"
                      : ""
                  }`}
                >
                  <Crosshair className="w-4 h-4 text-rose-400" />
                  {visibleTargets.length > 0 &&
                    !isFirearmEmpty &&
                    !isColloredoDischarged && (
                      <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-600 border border-amber-200 text-[10px] font-cinzel font-black text-white flex items-center justify-center tabular-nums">
                        {visibleTargets.length}
                      </span>
                    )}
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                    2
                  </span>
                </button>
              </div>

              {/* [R] Fázové přebíjení */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "reload",
                    title: "Fázové nabíjení hlavně",
                    hotkey: "R",
                    costLabel: "1 AP / krok",
                    summary:
                      selectedUnit?.id === "player-colloredo"
                        ? "Kolečkovou bambitku maršála Colloreda nelze uprostřed šarvátky znovu natáhnout."
                        : isFirearmEmpty
                          ? `Postup nabíjení: ${reloadProgress}/${reloadApCost} AP. Každý stisk investuje 1 AP a postup se přenáší do dalších kol.`
                          : `Zbraň je plně nabitá (${reloadApCost}/${reloadApCost} AP) a připravená k výstřelu.`,
                    warning: !canCommand
                      ? "Nyní nelze nabíjet"
                      : selectedUnit?.id === "player-colloredo"
                        ? "Jednoranná bambitka nelze v boji přebít"
                        : isFirearmEmpty === false
                          ? "Zbraň je již plně nabitá"
                          : (selectedUnit?.ap ?? 0) < 1
                            ? "Nedostatek AP (vyžaduje 1 AP na krok)"
                            : undefined,
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand ||
                    isSelectedDetained ||
                    isFirearmEmpty === false ||
                    selectedUnit?.id === "player-colloredo" ||
                    (selectedUnit?.ap ?? 0) < 1
                  }
                  onClick={executeReload}
                  aria-label="Nabít zbraň [R]"
                  className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    canReload || isReloadHighlight
                      ? "bg-amber-600/40 border-amber-300 text-amber-100 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse"
                      : "baroque-bronze-btn text-amber-200/80 hover:text-amber-100 disabled:opacity-35 disabled:cursor-not-allowed"
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  {isFirearmEmpty && selectedUnit?.id !== "player-colloredo" && (
                    <span className="absolute -top-1 -right-1 px-1 rounded bg-amber-500 text-stone-950 text-[9px] font-cinzel font-black tabular-nums">
                      {reloadProgress}/{reloadApCost}
                    </span>
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                    R
                  </span>
                </button>
              </div>

              {/* [B] Útok zblízka / Pažbou */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "melee",
                    title: `Boj zblízka: ${selectedUnit?.meleeWeapon?.name ?? "Pažba"}`,
                    hotkey: "B / PKM",
                    costLabel: "1 AP (0 AP při zteči)",
                    summary: `Zranění ${selectedUnit?.meleeWeapon?.minDamage ?? 2}–${selectedUnit?.meleeWeapon?.maxDamage ?? 4} HP. Pravým kliknutím (PKM) přímo na nepřítele v dosahu provedete okamžitý přesun spojený se seknutím bez další AP ceny!`,
                    detail:
                      "Tip: Klikněte pravým tlačítkem přímo na nepřítele v dosahu pohybu pro okamžitou zteč!",
                    warning: !canCommand
                      ? "Nyní nelze útočit"
                      : !hasAp
                        ? "Nedostatek AP pro úder"
                        : visibleMeleeTargets.length === 0
                          ? "Žádný nepřítel nestojí na sousední dlaždici (použijte PKM zteč z dálky)"
                          : undefined,
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand || !hasAp || visibleMeleeTargets.length === 0
                  }
                  onClick={() =>
                    setActionMode(actionMode === "melee" ? "move" : "melee")
                  }
                  aria-label="Útok zblízka [B]"
                  className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    isMeleeHighlight
                      ? "bg-rose-900/60 border-rose-400 text-rose-100 ring-2 ring-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse"
                      : visibleMeleeTargets.length > 0 && hasAp && canCommand
                        ? "bg-amber-950/90 border-amber-400 text-amber-100 ring-1 ring-amber-400/60"
                        : "baroque-bronze-btn text-amber-200/80 hover:text-amber-100 disabled:opacity-35 disabled:cursor-not-allowed"
                  }`}
                >
                  <Swords className="w-4 h-4 text-amber-400" />
                  {visibleMeleeTargets.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-stone-950 text-[10px] font-cinzel font-black flex items-center justify-center tabular-nums">
                      {visibleMeleeTargets.length}
                    </span>
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                    B
                  </span>
                </button>
              </div>

              {/* [3] Hlídka / Připravená salva */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "overwatch",
                    title:
                      selectedUnit?.weapon.overwatchMode ===
                      "prepared_volley_cone"
                        ? "Připravená salva (90° kužel)"
                        : "Hlídka — Overwatch (360°)",
                    hotkey: "3",
                    costLabel: `${selectedUnit?.weapon.fireApCost ?? 1} AP`,
                    summary:
                      selectedUnit?.weapon.overwatchMode ===
                      "prepared_volley_cone"
                        ? `Doutnáková mušketa zaměří 90° palebný sektor před střelcem (${selectedUnit?.facing}) a automaticky vypálí na prvního Švéda v pohybu.`
                        : "Kolečkový zámek umožňuje okamžitou reaktivní palbu v okruhu 360° na pohybujícího se nepřítele.",
                    warning: !canCommand
                      ? "Nyní nelze aktivovat hlídku"
                      : selectedUnit?.isOverwatch
                        ? "Hlídka je již aktivní"
                        : isFirearmEmpty || isColloredoDischarged
                          ? "Nelze držet hlídku s vybitou hlavní (nejprve nabijte [R])"
                          : (selectedUnit?.ap ?? 0) < (selectedUnit?.weapon.fireApCost ?? 1)
                            ? `Vyžaduje ${selectedUnit?.weapon.fireApCost ?? 1} AP`
                            : undefined,
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand ||
                    !hasAp ||
                    !!selectedUnit?.isOverwatch ||
                    isFirearmEmpty ||
                    isColloredoDischarged ||
                    (selectedUnit?.ap ?? 0) <
                      (selectedUnit?.weapon.fireApCost ?? 1)
                  }
                  onClick={activateOverwatch}
                  aria-label="Hlídka [3]"
                  className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    selectedUnit?.isOverwatch
                      ? "bg-sky-900/80 border-sky-400 text-sky-200"
                      : "baroque-bronze-btn text-amber-200/80 hover:text-amber-100 disabled:opacity-35 disabled:cursor-not-allowed"
                  }`}
                >
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                    3
                  </span>
                </button>
              </div>

              {/* [4] Granát / Petarda */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "grenade",
                    title: "Litinová petarda s černým prachem",
                    hotkey: "4",
                    costLabel: "1 AP",
                    summary: `Plošný výbuch 3×3 (dosah 8m): způsobí 4 HP poškození, strhne 1 bod zbroje, zničí nízké kryty a odpálí prachové sudy.`,
                    detail: `LKM: Potvrdit hod do zóny · PKM: Zrušit míření (Zbývá: ${selectedUnit?.grenades ?? 0})`,
                    warning: !canCommand
                      ? "Nyní nelze házet petardu"
                      : (selectedUnit?.grenades ?? 0) <= 0
                        ? "Voják již nemá žádné další petardy"
                        : !hasAp
                          ? "Nedostatek AP pro hod petardy"
                          : undefined,
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand || !hasAp || (selectedUnit?.grenades ?? 0) <= 0
                  }
                  onClick={() =>
                    setActionMode(actionMode === "grenade" ? "move" : "grenade")
                  }
                  aria-label="Petarda [4]"
                  className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    actionMode === "grenade"
                      ? "bg-orange-900/90 border-orange-400 text-amber-100 shadow-[0_0_12px_rgba(249,115,22,0.5)]"
                      : "baroque-bronze-btn text-amber-200/80 hover:text-orange-200 disabled:opacity-35 disabled:cursor-not-allowed"
                  } ${
                    isStep3Highlight &&
                    canCommand &&
                    hasAp &&
                    (selectedUnit?.grenades ?? 0) > 0
                      ? "ring-2 ring-amber-400 animate-pulse"
                      : ""
                  }`}
                >
                  <Bomb className="w-4 h-4 text-orange-400" />
                  {(selectedUnit?.grenades ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-orange-600 border border-amber-200 text-[10px] font-cinzel font-black text-white flex items-center justify-center tabular-nums">
                      {selectedUnit?.grenades}
                    </span>
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                    4
                  </span>
                </button>
              </div>

              {/* [5] Zvláštní schopnost hrdiny */}
              {ability && (
                <div
                  onMouseEnter={() =>
                    setHoveredAbility({
                      id: "ability",
                      title: ability.name,
                      hotkey: "5",
                      costLabel: `${ability.apCost} AP`,
                      summary: ability.description,
                      detail:
                        ability.currentCooldown > 0
                          ? `Obnovení za ${ability.currentCooldown} kola`
                          : `Obnova: ${ability.cooldownTurns} kola`,
                      warning: !canCommand
                        ? "Nyní nelze použít schopnost"
                        : ability.currentCooldown > 0
                          ? `Schopnost je v obnově (${ability.currentCooldown} kola)`
                          : (selectedUnit?.ap ?? 0) < ability.apCost
                            ? `Vyžaduje ${ability.apCost} AP`
                            : undefined,
                    })
                  }
                  onMouseLeave={() => setHoveredAbility(null)}
                >
                  <button
                    type="button"
                    disabled={!canUseAbility}
                    onClick={() => activateSpecialAbility()}
                    aria-label={`${ability.name} [5]`}
                    className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      selectedUnit?.abilityBuffActive
                        ? "bg-amber-500/40 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                        : canUseAbility
                          ? "bg-amber-950/85 border-amber-500/70 text-amber-200 hover:border-amber-300"
                          : "baroque-bronze-btn text-amber-400/40 disabled:opacity-35 disabled:cursor-not-allowed"
                    } ${
                      shouldHighlightAbility
                        ? "ring-2 ring-amber-400 animate-pulse"
                        : ""
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    {ability.currentCooldown > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-slate-900 border border-amber-400 text-[10px] font-cinzel font-black text-amber-300 flex items-center justify-center tabular-nums">
                        {ability.currentCooldown}
                      </span>
                    )}
                    <span className="absolute bottom-0.5 right-1 text-[10px] font-cinzel font-black text-amber-300/90">
                      5
                    </span>
                  </button>
                </div>
              )}

              <div className="w-px h-6 bg-amber-900/70 mx-0.5" />

              {/* [Space] Ukončit tah */}
              <div
                onMouseEnter={() =>
                  setHoveredAbility({
                    id: "endturn",
                    title: "Ukončit tah obránců",
                    hotkey: "Space",
                    costLabel: "Konec kola",
                    summary: !anyUnitHasAp
                      ? "Všichni obránci již vyčerpali své akční body. Předá iniciativu švédské hlídce."
                      : "Předá tah švédské hlídce generála Königsmarcka i se zbývajícími AP.",
                  })
                }
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <button
                  type="button"
                  disabled={!canCommand}
                  onClick={endTurn}
                  aria-label="Ukončit tah [Mezerník]"
                  className={`relative h-10 px-3 rounded-lg border flex items-center gap-1.5 font-cinzel font-black text-xs uppercase tracking-wider text-stone-950 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                    !anyUnitHasAp && canCommand
                      ? "bg-amber-400 hover:bg-amber-300 border-amber-100 ring-2 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] animate-pulse"
                      : "bg-amber-500 hover:bg-amber-400 border-amber-300 shadow-[0_2px_10px_rgba(245,158,11,0.4)]"
                  }`}
                >
                  <SkipForward className="w-4 h-4 text-stone-950 shrink-0" />
                  <span className="hidden sm:inline">Konec</span>
                  <span className="text-[10px] opacity-85">[⎵]</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </footer>
    </>
  );
}
