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
import { bestTileCover, sameCoord } from "../../core/GridSystem";
import { INSCRIPTION, ROPE, WINDLASS } from "../../core/mission2";
import type { StatModifier } from "../../core/types";
import {
  formatMeasure,
  formatPhrase,
  text,
  useLocale,
  weaponLabel,
} from "../../i18n";
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
  useLocale();
  const isPositive =
    item.kind === "bonus" || (item.kind === "base" && item.value > 0);
  const isPenalty = item.kind === "penalty" || item.value < 0;
  const formattedValue = formatMeasure(item.unit, item.value);

  return (
    <div className="flex items-start justify-between gap-2.5 py-1 px-2 rounded bg-slate-950/90 border border-amber-500/40 text-[10px]">
      <div className="min-w-0">
        <div className="font-cinzel font-black text-amber-100 leading-tight truncate">
          {formatPhrase(item.label)}
        </div>
        {item.detail && (
          <div className="font-literata italic text-[9px] text-amber-200/80 leading-tight">
            {formatPhrase(item.detail)}
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
  const guidedTutorial = useGameStore((s) => s.guidedTutorial);
  const scenario = useGameStore((s) => s.scenario);
  const m2 = useGameStore((s) => s.m2);
  const kneelAtInscription = useGameStore((s) => s.kneelAtInscription);
  const unpinWindlassPawl = useGameStore((s) => s.unpinWindlassPawl);
  const severPortcullisRope = useGameStore((s) => s.severPortcullisRope);
  const douseWindlassFire = useGameStore((s) => s.douseWindlassFire);

  const [hoveredAbilityId, setHoveredAbilityId] = useState<string | null>(null);
  const locale = useLocale();
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

  const hoveredAbility: AbilityTooltipData | null = (() => {
    if (!hoveredAbilityId) return null;
    switch (hoveredAbilityId) {
      case "move":
        return {
          id: "move",
          title: text("ui.ribbon.move.title", undefined, locale),
          hotkey: "1 / PKM",
          costLabel: text("ui.ribbon.move.cost", undefined, locale),
          summary: text("ui.ribbon.move.summary", { count: selectedUnit?.movePerAp ?? 4 }, locale),
          detail: text("ui.ribbon.move.detail", undefined, locale),
          warning: !canCommand
            ? text("ui.ribbon.move.blocked", undefined, locale)
            : !hasAp
              ? text("ui.ribbon.move.noAp", undefined, locale)
              : undefined,
        };
      case "shoot":
        return {
          id: "shoot",
          title: text("ui.ribbon.fireTitle", { weaponId: selectedUnit?.weapon.id }, locale),
          hotkey: "2",
          costLabel: text("ui.ribbon.fireEnds", { count: selectedUnit?.weapon.fireApCost ?? 1 }, locale),
          summary: text(
            "ui.ribbon.shoot.summary",
            {
              damage: selectedUnit?.weapon.minDamage ?? 4,
              required: selectedUnit?.weapon.maxDamage ?? 6,
              armor: selectedUnit?.weapon.armorPierce ?? 1,
              distance: selectedUnit?.weapon.maxRange ?? 12,
            },
            locale,
          ),
          detail: text("ui.ribbon.shoot.detail", undefined, locale),
          warning: !canCommand
            ? text("ui.ribbon.shoot.blocked", undefined, locale)
            : !hasAp
              ? text("ui.ribbon.shoot.noAp", undefined, locale)
              : isColloredoDischarged
                ? text("ui.ribbon.shoot.pistolSpent", undefined, locale)
                : isFirearmEmpty
                  ? text(
                      "ui.ribbon.shoot.empty",
                      { progress: reloadProgress, required: reloadApCost },
                      locale,
                    )
                  : visibleTargets.length === 0
                    ? text("ui.ribbon.shoot.noLos", undefined, locale)
                    : undefined,
        };
      case "reload":
        return {
          id: "reload",
          title: text("ui.ribbon.reload.title", undefined, locale),
          hotkey: "R",
          costLabel: text("ui.ribbon.reload.cost", undefined, locale),
          summary:
            selectedUnit?.id === "player-colloredo"
              ? text("ui.ribbon.reload.pistol", undefined, locale)
              : isFirearmEmpty
                ? text(
                    "ui.ribbon.reload.progress",
                    { progress: reloadProgress, required: reloadApCost },
                    locale,
                  )
                : text(
                    "ui.ribbon.reload.ready",
                    { progress: reloadApCost, required: reloadApCost },
                    locale,
                  ),
          warning: !canCommand
            ? text("ui.ribbon.reload.blocked", undefined, locale)
            : selectedUnit?.id === "player-colloredo"
              ? text("ui.ribbon.reload.pistolNo", undefined, locale)
              : isFirearmEmpty === false
                ? text("ui.ribbon.reload.full", undefined, locale)
                : (selectedUnit?.ap ?? 0) < 1
                  ? text("ui.ribbon.reload.noAp", undefined, locale)
                  : undefined,
        };
      case "melee":
        return {
          id: "melee",
          title: text("ui.ribbon.meleeTitle", { meleeId: selectedUnit?.meleeWeapon?.id }, locale),
          hotkey: "B / PKM",
          costLabel: text("ui.ribbon.melee.cost", undefined, locale),
          summary: text(
            "ui.ribbon.melee.summary",
            {
              damage: selectedUnit?.meleeWeapon?.minDamage ?? 2,
              required: selectedUnit?.meleeWeapon?.maxDamage ?? 4,
            },
            locale,
          ),
          detail: text("ui.ribbon.melee.detail", undefined, locale),
          warning: !canCommand
            ? text("ui.ribbon.melee.blocked", undefined, locale)
            : !hasAp
              ? text("ui.ribbon.melee.noAp", undefined, locale)
              : visibleMeleeTargets.length === 0
                ? text("ui.ribbon.melee.none", undefined, locale)
                : undefined,
        };
      case "overwatch":
        return {
          id: "overwatch",
          title:
            selectedUnit?.weapon.overwatchMode === "prepared_volley_cone"
              ? text("ui.ribbon.overwatch.cone", undefined, locale)
              : text("ui.ribbon.overwatch.ring", undefined, locale),
          hotkey: "3",
          costLabel: `${selectedUnit?.weapon.fireApCost ?? 1} AP`,
          summary:
            selectedUnit?.weapon.overwatchMode === "prepared_volley_cone"
              ? text(
                  "ui.ribbon.overwatch.coneBody",
                  { facing: selectedUnit?.facing ?? "" },
                  locale,
                )
              : text("ui.ribbon.overwatch.ringBody", undefined, locale),
          warning: !canCommand
            ? text("ui.ribbon.overwatch.blocked", undefined, locale)
            : selectedUnit?.isOverwatch
              ? text("ui.ribbon.overwatch.active", undefined, locale)
              : isFirearmEmpty || isColloredoDischarged
                ? text("ui.ribbon.overwatch.empty", undefined, locale)
                : (selectedUnit?.ap ?? 0) < (selectedUnit?.weapon.fireApCost ?? 1)
                  ? text(
                      "ui.ribbon.overwatch.need",
                      { required: selectedUnit?.weapon.fireApCost ?? 1 },
                      locale,
                    )
                  : undefined,
        };
      case "grenade":
        return {
          id: "grenade",
          title: text("ui.ribbon.grenade.title", undefined, locale),
          hotkey: "4",
          costLabel: text("ui.ribbon.grenade.cost", undefined, locale),
          summary: text("ui.ribbon.grenade.summary", undefined, locale),
          detail: text("ui.ribbon.grenade.detail", { count: selectedUnit?.grenades ?? 0 }, locale),
          warning: !canCommand
            ? text("ui.ribbon.grenade.blocked", undefined, locale)
            : (selectedUnit?.grenades ?? 0) <= 0
              ? text("ui.ribbon.grenade.none", undefined, locale)
              : !hasAp
                ? text("ui.ribbon.grenade.noAp", undefined, locale)
                : undefined,
        };
      case "ability":
        if (!ability) return null;
        return {
          id: "ability",
          title: ability.name,
          hotkey: "5",
          costLabel: `${ability.apCost} AP`,
          summary: ability.description,
          detail:
            ability.currentCooldown > 0
              ? text("ui.ribbon.ability.renew", { count: ability.currentCooldown }, locale)
              : text("ui.ribbon.ability.ready", { count: ability.cooldownTurns }, locale),
          warning: !canCommand
            ? text("ui.ribbon.ability.blocked", undefined, locale)
            : ability.currentCooldown > 0
              ? text("ui.ribbon.ability.cooling", { count: ability.currentCooldown }, locale)
              : (selectedUnit?.ap ?? 0) < ability.apCost
                ? text("ui.ribbon.ability.need", { required: ability.apCost }, locale)
                : undefined,
        };
      case "endturn":
        return {
          id: "endturn",
          title: text("ui.ribbon.end.title", undefined, locale),
          hotkey: "Space",
          costLabel: text("ui.ribbon.end.cost", undefined, locale),
          summary: !anyUnitHasAp
            ? text("ui.ribbon.end.spent", undefined, locale)
            : text("ui.ribbon.end.open", undefined, locale),
        };
      default:
        return null;
    }
  })();

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
          aria-label={text("ui.ribbon.soldierAria", undefined, locale)}
          style={medallionDrag.dragStyle}
          className="pointer-events-auto fixed bottom-3 left-3 z-30 flex flex-col gap-1 select-none max-w-[270px]"
        >
          <div className="baroque-cartouche baroque-border rounded-xl px-2.5 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.9)] bg-slate-950/90 border-amber-500/60 backdrop-blur-md">
            {/* Horní mikro-pás přepínání čety (nahrazuje široký redundantní pás karet) */}
            <div
              onPointerDown={medallionDrag.onPointerDown}
              title={text("ui.ribbon.medallionDrag", undefined, locale)}
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
                      title={text("ui.ribbon.squadTip", {
                        names: u.name,
                        hp: u.hp,
                        required: u.maxHp,
                        count: u.ap,
                        agony: u.inDeathThroes,
                        open: !isTurnEnded,
                      }, locale)}
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
                title={text("ui.ribbon.nextSoldier", undefined, locale)}
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
                  <span>{weaponLabel(selectedUnit.weapon.id, locale)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {selectedUnit.weapon.minDamage}–
                    {selectedUnit.weapon.maxDamage} HP
                  </span>
                  {selectedUnit.id === "player-colloredo" ? (
                    <span className="text-amber-300">
                      {" "}
                      · {selectedUnit.pistolLoaded ? "1/1" : text("ui.ribbon.pistolEmpty", undefined, locale)}
                    </span>
                  ) : selectedUnit.firearmLoaded === false ? (
                    <span className="text-orange-300 font-semibold">
                      {" "}
                      · {text("ui.ribbon.reload", { progress: reloadProgress, required: reloadApCost }, locale)}
                    </span>
                  ) : null}
                </div>

                {/* Mikro-segmenty Zdraví, Zbroje a Akčních bodů */}
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex items-center gap-[2px]"
                      title={text("ui.ribbon.health", { hp: selectedUnit.hp, required: selectedUnit.maxHp }, locale)}
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
                        title={text("ui.ribbon.armor", { armor: selectedUnit.armor, required: selectedUnit.maxArmor }, locale)}
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
                    title={text("ui.ribbon.ap", { count: selectedUnit.ap, required: selectedUnit.maxAp }, locale)}
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
          aria-label={text("ui.ribbon.targetsAria", undefined, locale)}
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
              title={text("ui.ribbon.prevTarget", undefined, locale)}
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
                  title={text("ui.ribbon.targetTip", { names: enemy.name, chance: ev.calculation.hitChance }, locale)}
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
              title={text("ui.ribbon.nextTarget", undefined, locale)}
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
        aria-label={text("ui.ribbon.barAria", undefined, locale)}
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
                  {text("ui.ribbon.noLos", undefined, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  className="px-3 py-1 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
                >
                  {text("ui.ribbon.backAim", undefined, locale)}
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
                          {text("ui.ribbon.hitBreak", undefined, locale)}
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
                        title={text("ui.ribbon.breakdownTip", undefined, locale)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-cinzel font-black uppercase tracking-wider transition-all cursor-pointer ${
                          isStep2Highlight
                            ? "bg-amber-500/30 border-amber-300 text-amber-100 ring-2 ring-amber-400 animate-pulse"
                            : showBreakdownWings
                              ? "bg-amber-600/35 border-amber-400 text-amber-100"
                              : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
                        }`}
                      >
                        <ChevronLeft className="w-3 h-3 text-amber-400" />
                        <span>{text("ui.ribbon.breakdown", undefined, locale)}</span>
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
                        title={text("ui.ribbon.cancelAim", undefined, locale)}
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
                            {text("inspect.combat.hit", undefined, locale)}
                          </div>
                          <div className="text-base font-cinzel font-black text-emerald-400 leading-none mt-0.5">
                            {calc.hitChance}%
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-amber-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                            {text("inspect.combat.crit", undefined, locale)}
                          </div>
                          <div className="text-base font-cinzel font-black text-amber-300 leading-none mt-0.5">
                            {calc.critChance}%
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-rose-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80">
                            {text("inspect.combat.wound", undefined, locale)}
                          </div>
                          <div className="text-sm font-cinzel font-black text-rose-300 leading-none mt-0.5">
                            {calc.minDamage}–{calc.maxDamage}
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-orange-500/50 rounded-lg py-1 px-1.5">
                          <div className="text-[8px] font-cinzel font-bold uppercase text-amber-200/80 flex items-center justify-center gap-0.5">
                            <AlertTriangle className="w-2 h-2 text-orange-400" />
                            <span>{text("inspect.combat.misfire", undefined, locale)}</span>
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
                          <span>{text("ui.ribbon.fire", undefined, locale)}</span>
                        </div>
                        <span className="text-[9px] font-bold opacity-90 tabular-nums">
                          {text("ui.ribbon.fireCost", { count: calc.fireApCost ?? 1 }, locale)}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* PRAVÉ KŘÍDLO ROZPADU (pouze při kliknutí nebo hoveru na Rozpad) */}
                  {showBreakdownWings && (
                    <aside className="pointer-events-auto w-full xl:w-64 baroque-cartouche baroque-border rounded-xl p-2.5 text-amber-50 shadow-2xl bg-slate-950/95 border-amber-500/60 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-amber-900/70 pb-1 mb-1.5">
                        <span className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-200">
                          {text("ui.ribbon.critArmor", undefined, locale)}
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
                  {text("ui.ribbon.noMelee", undefined, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => setActionMode("move")}
                  className="px-3 py-1 rounded baroque-bronze-btn text-xs font-cinzel font-bold text-amber-200 hover:text-amber-100 cursor-pointer"
                >
                  {text("ui.ribbon.backMelee", undefined, locale)}
                </button>
              </div>
            ) : (
              <div className="pointer-events-auto w-full max-w-md baroque-cartouche baroque-border rounded-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.95)] text-amber-50 bg-slate-950/92 border-amber-500/80 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-amber-900/70">
                  <span className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-300">
                    {text("ui.ribbon.meleeHead", { meleeId: meleeCalc.weaponId }, locale)}
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
                      <span>{text("ui.ribbon.strike", undefined, locale)}</span>
                    </div>
                    <span className="text-[9px] font-bold opacity-90">
                      {text("ui.ribbon.strikeCost", undefined, locale)}
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
                title={text("ui.ribbon.dockDrag", undefined, locale)}
                className="px-0.5 text-amber-400/50 hover:text-amber-300 cursor-grab active:cursor-grabbing"
              >
                <GripHorizontal className="w-3.5 h-3.5" />
              </div>

              {/* [1] Pohyb */}
              <div
                onMouseEnter={() => setHoveredAbilityId("move")}
                onMouseLeave={() => setHoveredAbilityId(null)}
              >
                <button
                  type="button"
                  disabled={!canCommand}
                  onClick={() => setActionMode("move")}
                  aria-label={text("ui.ribbon.move.aria", undefined, locale)}
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
                onMouseEnter={() => setHoveredAbilityId("shoot")}
                onMouseLeave={() => setHoveredAbilityId(null)}
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
                  aria-label={text("ui.ribbon.shoot.aria", undefined, locale)}
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
                onMouseEnter={() => setHoveredAbilityId("reload")}
                onMouseLeave={() => setHoveredAbilityId(null)}
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
                  aria-label={text("ui.ribbon.reload.aria", undefined, locale)}
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
                onMouseEnter={() => setHoveredAbilityId("melee")}
                onMouseLeave={() => setHoveredAbilityId(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand || !hasAp || visibleMeleeTargets.length === 0
                  }
                  onClick={() =>
                    setActionMode(actionMode === "melee" ? "move" : "melee")
                  }
                  aria-label={text("ui.ribbon.melee.aria", undefined, locale)}
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
                onMouseEnter={() => setHoveredAbilityId("overwatch")}
                onMouseLeave={() => setHoveredAbilityId(null)}
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
                  aria-label={text("ui.ribbon.overwatch.aria", undefined, locale)}
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
                onMouseEnter={() => setHoveredAbilityId("grenade")}
                onMouseLeave={() => setHoveredAbilityId(null)}
              >
                <button
                  type="button"
                  disabled={
                    !canCommand || !hasAp || (selectedUnit?.grenades ?? 0) <= 0
                  }
                  onClick={() =>
                    setActionMode(actionMode === "grenade" ? "move" : "grenade")
                  }
                  aria-label={text("ui.ribbon.grenade.aria", undefined, locale)}
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
                  onMouseEnter={() => setHoveredAbilityId("ability")}
                  onMouseLeave={() => setHoveredAbilityId(null)}
                >
                  <button
                    type="button"
                    disabled={!canUseAbility}
                    onClick={() => activateSpecialAbility()}
                    aria-label={text("ui.ribbon.ability.aria", { names: ability.name }, locale)}
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

              {scenario === "mission2" &&
                m2 &&
                !m2.knelt &&
                selectedUnit?.id === "player-plachy" &&
                sameCoord(selectedUnit.pos, INSCRIPTION) && (
                  <button
                    type="button"
                    disabled={!hasAp}
                    onClick={kneelAtInscription}
                    aria-label={text("ui.ribbon.kneel.aria", undefined, locale)}
                    className="h-10 px-3 rounded-lg border border-amber-300 bg-amber-500 text-stone-950 font-cinzel text-xs font-bold cursor-pointer disabled:opacity-35"
                  >
                    {text("ui.ribbon.kneel", undefined, locale)}
                  </button>
                )}

              {scenario === "mission2" &&
                m2 &&
                !m2.pawlUnpinned &&
                selectedUnit &&
                sameCoord(selectedUnit.pos, WINDLASS) && (
                  <button
                    type="button"
                    disabled={!hasAp || m2.windlassArmed}
                    onClick={unpinWindlassPawl}
                    aria-label={text("ui.ribbon.unpin.aria", undefined, locale)}
                    className="h-10 px-3 rounded-lg border border-amber-300 bg-amber-500 hover:bg-amber-400 text-stone-950 font-cinzel text-xs font-bold cursor-pointer shadow-[0_2px_8px_rgba(245,158,11,0.4)] disabled:opacity-35"
                  >
                    {m2.windlassArmed
                      ? text("ui.mission.ropeTaut", undefined, locale)
                      : text("ui.ribbon.unpin", undefined, locale)}
                  </button>
                )}

              {scenario === "mission2" &&
                m2 &&
                m2.pawlUnpinned &&
                !m2.seated &&
                selectedUnit &&
                (sameCoord(selectedUnit.pos, ROPE) ||
                  (selectedUnit.pos.y === 1 &&
                    Math.abs(selectedUnit.pos.x - WINDLASS.x) <= 1 &&
                    Math.abs(selectedUnit.pos.z - WINDLASS.z) <= 1)) && (
                  <button
                    type="button"
                    disabled={!hasAp}
                    onClick={severPortcullisRope}
                    aria-label={text("ui.ribbon.severRope.aria", undefined, locale)}
                    className="h-10 px-3 rounded-lg border border-red-500 bg-rose-600 hover:bg-rose-500 text-amber-50 font-cinzel text-xs font-black cursor-pointer shadow-[0_0_12px_rgba(244,63,94,0.7)] animate-pulse disabled:opacity-35"
                  >
                    {text("ui.ribbon.severRope", undefined, locale)}
                  </button>
                )}

              {scenario === "mission2" &&
                m2 &&
                m2.windlassBurning &&
                selectedUnit &&
                selectedUnit.pos.y === 1 &&
                Math.abs(selectedUnit.pos.x - WINDLASS.x) <= 1 &&
                Math.abs(selectedUnit.pos.z - WINDLASS.z) <= 1 && (
                  <button
                    type="button"
                    disabled={!hasAp}
                    onClick={douseWindlassFire}
                    aria-label={text("ui.ribbon.douse.aria", undefined, locale)}
                    className="h-10 px-3 rounded-lg border border-blue-400 bg-blue-600 hover:bg-blue-500 text-white font-cinzel text-xs font-bold cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.5)] disabled:opacity-35"
                  >
                    {text("ui.ribbon.douse", undefined, locale)}
                  </button>
                )}

              <div className="w-px h-6 bg-amber-900/70 mx-0.5" />

              {/* [Space] Ukončit tah */}
              <div
                onMouseEnter={() => setHoveredAbilityId("endturn")}
                onMouseLeave={() => setHoveredAbilityId(null)}
              >
                <button
                  type="button"
                  disabled={!canCommand}
                  onClick={endTurn}
                  aria-label={text("ui.ribbon.end.aria", undefined, locale)}
                  className={`relative h-10 px-3 rounded-lg border flex items-center gap-1.5 font-cinzel font-black text-xs uppercase tracking-wider text-stone-950 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                    !anyUnitHasAp && canCommand
                      ? "bg-amber-400 hover:bg-amber-300 border-amber-100 ring-2 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] animate-pulse"
                      : "bg-amber-500 hover:bg-amber-400 border-amber-300 shadow-[0_2px_10px_rgba(245,158,11,0.4)]"
                  }`}
                >
                  <SkipForward className="w-4 h-4 text-stone-950 shrink-0" />
                  <span className="hidden sm:inline">{text("ui.ribbon.end.label", undefined, locale)}</span>
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
