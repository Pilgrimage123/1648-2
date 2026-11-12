/**
 * Modulární kontejner postavy (/src/components/canvas/UnitActor.tsx).
 * Řeší 3D pozici na mřížce, plynulou interpolaci po A* cestě, poskakování figurky při chůzi,
 * vyklonění při střelbě, animaci zásahu a nekolizní plovoucí HTML štítek (<WorldHtml>)
 * s barokní ikonou krytu s číslem (−20 / −40), HP/Armor segmenty a blikajícím náhledem poškození.
 */

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Cloud,
  Eye,
  Flame,
  Footprints,
  Skull,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  liveMovementTelemetry,
  resolveDynamicRoofCutawayFloor,
} from "../../core/CameraDirector";
import {
  calculateMeleeAttack,
  isAdjacentForMelee,
  isUnitFighting,
} from "../../core/CombatSystem";
import { bestTileCover, isEnclosedRoofedCoord, sameCoord } from "../../core/GridSystem";
import { higherFloorUnitIgnoresClicks } from "../../core/inspectClick";
import type { UnitData } from "../../core/types";
import {
  findBestMeleeChargeTile,
  useGameStore,
} from "../../store/useGameStore";
import { formatPhrase, text, useLocale } from "../../i18n";
import { BaroqueCoverBadge } from "../ui/BaroqueCoverBadge";
import { wasRecentRightCameraPan } from "./TacticalCamera";
import { UnitVisual2D } from "./UnitVisual2D";
import { facingForward, FACING_YAW } from "./diegeticLights";
import { MatchcordCoal, UnitVisual3D } from "./UnitVisual3D";
import { WorldHtml } from "./WorldHtml";
import { FLOOR_HEIGHT, gridToWorld } from "./worldCoords";

interface UnitActorProps {
  unit: UnitData;
}

export function UnitActor({ unit }: UnitActorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const figurePivotRef = useRef<THREE.Group>(null);
  const contactRingRef = useRef<THREE.Mesh>(null);

  const grid = useGameStore((s) => s.grid);
  const smokeVersion = useGameStore((s) => s.smokeVersion);
  const renderMode = useGameStore((s) => s.renderMode);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const actionMode = useGameStore((s) => s.actionMode);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const activeMovement = useGameStore((s) => s.activeMovement);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const isCapturingAnim = useGameStore((s) => s.isCapturingAnim);
  const hoveredSpottedEnemyIds = useGameStore((s) => s.hoveredSpottedEnemyIds);
  const unitFx = useGameStore((s) => s.unitFx[unit.id]);
  const weather = useGameStore((s) => s.weather);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const units = useGameStore((s) => s.units);
  const reachableTiles = useGameStore((s) => s.reachableTiles);
  const hoveredTile = useGameStore((s) => s.hoveredTile);
  const inspectKeyHeld = useGameStore((s) => s.inspectKeyHeld);
  const handleUnitClick = useGameStore((s) => s.handleUnitClick);
  const handleUnitRightClick = useGameStore((s) => s.handleUnitRightClick);
  const previewEnemyMeleeHover = useGameStore((s) => s.previewEnemyMeleeHover);
  const completeUnitMovement = useGameStore((s) => s.completeUnitMovement);

  const [hitFlash, setHitFlash] = useState(0);
  const [lossTick, setLossTick] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const moveProgressRef = useRef(0);
  const locale = useLocale();

  const isHiddenInFog =
    unit.faction === "enemy" &&
    fogOfWarEnabled &&
    !fogSnapshot.visibleEnemyIds.has(unit.id);

  const isPreMoveTarget =
    unit.faction === "enemy" &&
    unit.alive &&
    hoveredSpottedEnemyIds.includes(unit.id);

  const soundContact = useMemo(
    () =>
      isHiddenInFog
        ? fogSnapshot.soundContacts.find((c) => c.unitId === unit.id) ?? null
        : null,
    [isHiddenInFog, fogSnapshot.soundContacts, unit.id],
  );

  const contactLabel = soundContact
    ? text(
        soundContact.kind === "matchcord_glow"
          ? "contact.matchcord"
          : soundContact.kind === "footsteps"
            ? "contact.footsteps"
            : "contact.gunfire",
        undefined,
        locale,
      )
    : text("ui.contact.fog", undefined, locale);

  const isSelected = selectedUnitId === unit.id;
  const isDetainedMarshal =
    unit.id === "player-colloredo" && (unit.detainedTurns ?? 0) > 0;
  const isTargeted =
    actionMode === "shoot" &&
    selectedTargetId === unit.id &&
    unit.faction === "enemy" &&
    !isHiddenInFog;
  const targetEval = useMemo(
    () => visibleTargets.find((t) => t.targetId === unit.id),
    [visibleTargets, unit.id],
  );

  // XCOM 2 Zteč zblízka (Run & Slash) — vyhodnocení, zda vybraný voják dosáhne na tohoto nepřítele chladnou zbraní / pažbou
  const meleeChargeInfo = useMemo(() => {
    if (unit.faction !== "enemy" || !unit.alive || isHiddenInFog) return null;
    const attacker = units.find(
      (u) =>
        u.id === selectedUnitId &&
        u.faction === "player" &&
        isUnitFighting(u) &&
        u.ap > 0 &&
        (u.detainedTurns ?? 0) === 0,
    );
    if (!attacker) return null;

    const alreadyAdjacent = isAdjacentForMelee(attacker.pos, unit.pos);
    if (alreadyAdjacent) {
      const calc = calculateMeleeAttack(grid, attacker, unit, units);
      return {
        isAdjacent: true,
        apCost: 1,
        hitChance: calc.hitChance,
        weaponId: calc.weaponId,
      };
    }

    const chargeReach = findBestMeleeChargeTile(
      grid,
      attacker,
      unit,
      reachableTiles,
      hoveredTile,
    );
    if (!chargeReach) return null;

    const simulatedAttacker: UnitData = {
      ...attacker,
      pos: chargeReach.coord,
    };
    const calc = calculateMeleeAttack(grid, simulatedAttacker, unit, units);
    return {
      isAdjacent: false,
      apCost: chargeReach.apCost,
      hitChance: calc.hitChance,
      weaponId: calc.weaponId,
    };
  }, [
    unit,
    isHiddenInFog,
    units,
    selectedUnitId,
    grid,
    reachableTiles,
    hoveredTile,
  ]);

  // Kryt a přítomnost kouře na aktuální dlaždici
  const tileMeta = useMemo(() => {
    void smokeVersion;
    const t = grid.getTile(unit.pos);
    return {
      cover: t ? bestTileCover(t.cover) : "none",
      inSmoke: (t?.smokeTurns ?? 0) > 0,
    };
  }, [grid, unit.pos, smokeVersion]);

  // Body A* trasy pro plynulou interpolaci
  const waypoints = useMemo(() => {
    if (!activeMovement || activeMovement.unitId !== unit.id) return null;
    const coords = [activeMovement.from, ...activeMovement.path];
    const pts = coords.map((c) => new THREE.Vector3(...gridToWorld(c)));
    return { coords, pts };
  }, [activeMovement, unit.id]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const group = groupRef.current;
    const pivot = figurePivotRef.current;
    if (!group || !pivot) return;

    const now = performance.now();
    const t = state.clock.elapsedTime;

    if (contactRingRef.current) {
      const pulse = 1 + Math.sin(t * 3.8 + unit.pos.x) * 0.16;
      contactRingRef.current.scale.set(pulse, pulse, 1);
    }

    if (waypoints && waypoints.pts.length >= 2) {
      const timeScale = useGameStore.getState().cameraDirector.timeScale ?? 1.0;
      const isSprintCam = !!activeMovement?.isActionCam;
      const speedTilesPerSec = (isSprintCam ? 5.65 : 5.1) * timeScale;
      moveProgressRef.current += dt * speedTilesPerSec;
      const totalSegments = waypoints.pts.length - 1;

      if (moveProgressRef.current >= totalSegments) {
        const lastPt = waypoints.pts[waypoints.pts.length - 1]!;
        group.position.copy(lastPt);
        pivot.position.set(0, 0, 0);
        pivot.rotation.set(0, 0, 0);
        moveProgressRef.current = 0;
        completeUnitMovement();
      } else {
        const segIdx = Math.floor(moveProgressRef.current);
        const segFrac = moveProgressRef.current - segIdx;
        const p0 = waypoints.pts[segIdx]!;
        const p1 = waypoints.pts[segIdx + 1]!;
        const c0 = waypoints.coords[segIdx]!;
        const c1 = waypoints.coords[segIdx + 1]!;
        group.position.lerpVectors(p0, p1, segFrac);

        // Dynamické zprůhlednění střechy / přepnutí patra, pokud je voják uvnitř budovy nebo na schodišti
        const activeStepCoord = segFrac >= 0.45 ? c1 : c0;
        const curFloor = useGameStore.getState().activeFloor;
        const desiredFloor = resolveDynamicRoofCutawayFloor(
          activeStepCoord,
          curFloor,
        );
        if (desiredFloor !== curFloor) {
          useGameStore.getState().setActiveFloor(desiredFloor);
        }

        // Automatické vyražení zavřených dřevěných dveří za běhu
        const isDoorStep = !!grid.getDoor(c1);
        if (grid.isDoorClosedAt(c1) && segFrac >= 0.16) {
          grid.setDoorState(c1, "open");
          liveMovementTelemetry.interactionImpulseTs = now;
          useGameStore.setState((s) => ({ gridVersion: s.gridVersion + 1 }));
        }

        const isVerticalStep = c0.y !== c1.y;
        const isVaultStep =
          segIdx === 0 && activeMovement?.interactionKind === "vault";
        if (isVaultStep && segFrac < 0.12 && now - liveMovementTelemetry.interactionImpulseTs > 300) {
          liveMovementTelemetry.interactionImpulseTs = now;
        }

        // Publikace živé 3D telemetrie pro TacticalCamera (nulová alokace)
        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const horizLen = Math.hypot(dx, dz);
        if (horizLen > 0.001) {
          liveMovementTelemetry.tangentXZ = [dx / horizLen, dz / horizLen];
        }
        liveMovementTelemetry.unitId = unit.id;
        liveMovementTelemetry.worldPos = [
          group.position.x,
          group.position.y,
          group.position.z,
        ];
        liveMovementTelemetry.continuousCoord = {
          x: THREE.MathUtils.lerp(c0.x, c1.x, segFrac),
          y: THREE.MathUtils.lerp(c0.y, c1.y, segFrac),
          z: THREE.MathUtils.lerp(c0.z, c1.z, segFrac),
        };
        liveMovementTelemetry.progress01 =
          moveProgressRef.current / Math.max(1, totalSegments);
        liveMovementTelemetry.segmentIndex = segIdx;
        liveMovementTelemetry.segmentFraction = segFrac;
        liveMovementTelemetry.stepInteraction = isVerticalStep
          ? "stairs"
          : isDoorStep
            ? "door_breach"
            : isVaultStep
              ? "vault"
              : "none";

        const stairTile = isVerticalStep
          ? (grid.getTile(c0) ?? grid.getTile(c1))
          : undefined;

        if (isVerticalStep && stairTile?.stairType === "spiral_stairs") {
          // Plynulý šroubovicový výstup/sestup po točitém vřetenovém schodišti
          const dirSign = c1.y > c0.y ? 1 : -1;
          const spiralAngle =
            (c1.y > c0.y ? segFrac : 1 - segFrac) * Math.PI * 1.65;
          const spiralRadius = Math.sin(segFrac * Math.PI) * 0.28;
          const stepBob = Math.abs(Math.sin(segFrac * Math.PI * 8)) * 0.05;
          pivot.position.set(
            Math.cos(spiralAngle) * spiralRadius,
            stepBob,
            Math.sin(spiralAngle) * spiralRadius,
          );
          pivot.rotation.set(0.06 * dirSign, -spiralAngle * 0.45, 0);
        } else if (isVerticalStep) {
          // Chůze po přímém barokním kamenném schodišti (8 stupňů)
          const stepBob = Math.abs(Math.sin(segFrac * Math.PI * 8)) * 0.07;
          const waddleTilt =
            Math.sin(moveProgressRef.current * Math.PI * 3) * 0.07;
          pivot.position.set(0, stepBob, 0);
          pivot.rotation.set(c1.y > c0.y ? 0.12 : -0.08, 0, waddleTilt);
        } else if (isVaultStep) {
          // Atletický přeskok nízkého krytu / šance (Vault)
          const vaultArc = Math.sin(segFrac * Math.PI);
          pivot.position.set(0, vaultArc * 0.46, 0);
          pivot.rotation.set(0.24 * vaultArc, 0, Math.sin(segFrac * Math.PI * 2) * 0.16);
        } else if (isDoorStep && segFrac < 0.45) {
          // Prudké vyražení dřevěných dveří ramenem / nohou za běhu
          const kickPulse = Math.sin((segFrac / 0.45) * Math.PI);
          pivot.position.set(0, kickPulse * 0.18, 0);
          pivot.rotation.set(0.28 * kickPulse, 0, -0.14 * kickPulse);
        } else {
          const hopPhase = segFrac * Math.PI;
          const hopHeight = Math.sin(hopPhase) * (isSprintCam ? 0.28 : 0.22);
          const waddleTilt =
            Math.sin(moveProgressRef.current * Math.PI * 2) *
            (isSprintCam ? 0.13 : 0.09);
          pivot.position.set(0, hopHeight, 0);
          pivot.rotation.set(isSprintCam ? 0.15 : 0.08, 0, waddleTilt);
        }
      }
    } else {
      moveProgressRef.current = 0;
      const [wx, wy, wz] = gridToWorld(unit.pos);
      group.position.set(wx, wy, wz);

      if (isDetainedMarshal) {
        const struggleShake =
          isCapturingAnim
            ? Math.sin(state.clock.elapsedTime * 38) * 0.1
            : Math.sin(state.clock.elapsedTime * 4) * 0.02;
        pivot.position.set(struggleShake, -0.22, 0);
        pivot.rotation.set(0.38, 0, struggleShake * 1.4);
      } else {
        // State 4: Animace zakleknutí do krytu (Cover Settle) a následný krytý postoj
        const settleTs = unitFx?.coverSettleTimestamp ?? 0;
        const settleElapsed = settleTs > 0 ? (now - settleTs) / 1000 : 999;
        const inCoverNow = tileMeta.cover !== "none";

        if (settleElapsed >= 0 && settleElapsed < 0.48) {
          const normSettle = settleElapsed / 0.48;
          const kneelCurve = Math.sin(normSettle * Math.PI);
          const dir = unitFx?.coverSettleDir;
          const leanX = dir === "E" ? 0.08 : dir === "W" ? -0.08 : 0;
          const leanZ = dir === "S" ? 0.08 : dir === "N" ? -0.08 : 0;
          pivot.position.set(
            leanX * kneelCurve,
            -0.16 * kneelCurve - (inCoverNow ? 0.05 : 0),
            leanZ * kneelCurve,
          );
          pivot.rotation.set(0.18 * kneelCurve, 0, leanX * 0.6 * kneelCurve);
        } else {
          const idleBob =
            Math.sin(state.clock.elapsedTime * 2.4 + unit.pos.x) * 0.022;
          const coverCrouchY = inCoverNow ? -0.05 : 0;
          pivot.position.set(0, idleBob + coverCrouchY, 0);
          pivot.rotation.set(inCoverNow ? 0.06 : 0, 0, 0);
        }
      }
    }

    if (unitFx?.lungeTimestamp) {
      const elapsed = (now - unitFx.lungeTimestamp) / 1000;
      if (elapsed >= 0 && elapsed < 0.78) {
        // Plynulý zpětný ráz muškety / arkebuzy při výstřelu (+90 % delší, C2-hladký návrat)
        const normT = elapsed / 0.78;
        const recoilEnvelope =
          normT < 0.14
            ? THREE.MathUtils.smootherstep(normT, 0, 0.14)
            : Math.pow(1 - (normT - 0.14) / 0.86, 2.1);
        const kickbackDist = -0.25 * recoilEnvelope;
        const [faceX, faceZ] = facingForward(unit.facing);
        pivot.position.x += faceX * kickbackDist;
        pivot.position.z += faceZ * kickbackDist;
        pivot.rotation.x = -0.22 * recoilEnvelope;
      }
    }

    if (unitFx?.hitTimestamp) {
      const elapsed = (now - unitFx.hitTimestamp) / 1000;
      if (elapsed >= 0 && elapsed < 1.05) {
        const intensity = Math.pow(1 - elapsed / 1.05, 1.5);
        setHitFlash(intensity);
        // Fyzikální zakolísání zasaženého cíle vzad s tlumeným kmitáním
        const staggerBack = Math.sin(Math.min(1, elapsed * 3.2) * Math.PI) * 0.16;
        pivot.position.x += Math.sin(elapsed * 68) * 0.14 * intensity;
        pivot.position.z +=
          Math.cos(elapsed * 62) * 0.14 * intensity + staggerBack * 0.5;
        pivot.rotation.x -= staggerBack * 0.85;
      } else if (hitFlash > 0) {
        setHitFlash(0);
      }
    } else if (hitFlash > 0) {
      setHitFlash(0);
    }

    // Pokud jednotka právě padla (alive === false), ale stále probíhá sekvence útoku / výpisu ztrát,
    // plynule ji skácíme k zemi, aby hráč viděl smrtelný zásah i kompletní odečet ztrát nad cílem!
    if (!unit.alive && unitFx?.combatLoss) {
      const lossElapsedSec = (now - unitFx.combatLoss.timestamp) / 1000;
      const lossDurSec = (unitFx.combatLoss.durationMs ?? 1550) / 1000;
      if (lossElapsedSec <= lossDurSec + 0.15) {
        const collapseT = THREE.MathUtils.smootherstep(
          Math.min(1, lossElapsedSec / 0.65),
          0,
          1,
        );
        pivot.rotation.x = -1.22 * collapseT;
        pivot.rotation.z = 0.28 * collapseT;
        pivot.position.y = -0.36 * collapseT;
      } else if (lossTick !== unitFx.combatLoss.id) {
        setLossTick(unitFx.combatLoss.id);
      }
    } else if (unitFx?.combatLoss) {
      const lossElapsedSec = (now - unitFx.combatLoss.timestamp) / 1000;
      const lossDurSec = (unitFx.combatLoss.durationMs ?? 1550) / 1000;
      if (lossElapsedSec > lossDurSec && lossTick !== unitFx.combatLoss.id) {
        setLossTick(unitFx.combatLoss.id);
      }
    }
  });

  const nowRender = performance.now();
  const activeCombatLoss =
    unitFx?.combatLoss &&
    nowRender - unitFx.combatLoss.timestamp <=
      (unitFx.combatLoss.durationMs ?? 1550)
      ? unitFx.combatLoss
      : null;

  const isAttackedByProjectile =
    activeProjectile !== null &&
    (activeProjectile.targetId === unit.id ||
      sameCoord(activeProjectile.to, unit.pos) ||
      (activeProjectile.extraTargets?.some((c) => sameCoord(c, unit.pos)) ??
        false));

  if (!unit.alive && !activeCombatLoss && !isAttackedByProjectile) return null;

  const isShootingView = actionMode === "shoot" || activeProjectile !== null;

  const isHigherFloor = unit.pos.y > activeFloor;
  const isLowerFloor = unit.pos.y < activeFloor;
  const ignoreHigherFloorClicks = higherFloorUnitIgnoresClicks(
    inspectKeyHeld,
    isHigherFloor,
    actionMode,
  );

  // Třístupňová vertikální hierarchie (ADR-0010 Ticket 04):
  // Vyšší patro: poloprůhledný duch (0.32), nižší patro: ztmavené do hloubky šerosvitu (0.72)
  const visualOpacity = isHigherFloor ? 0.32 : isLowerFloor ? 0.72 : 1.0;

  // Pokud je nepřítel ukryt v barokním šerosvitu (Fog of War), vykreslíme pouze diegetický Zvukový / Doutnákový kontakt (1648)
  if (isHiddenInFog) {
    return (
      <group
        ref={groupRef}
        position={gridToWorld(unit.pos)}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
        }}
        onPointerOut={() => setIsHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          handleUnitClick(unit.id);
        }}
      >
        <group ref={figurePivotRef}>
          {soundContact && (
            <>
              {/* Pulzující akustický kruh na dlažbě */}
              <mesh
                ref={contactRingRef}
                position={[0, 0.04, 0]}
                rotation={[-Math.PI * 0.5, 0, 0]}
              >
                <ringGeometry args={[0.3, 0.46, 24]} />
                <meshBasicMaterial
                  color={
                    soundContact.kind === "matchcord_glow"
                      ? "#f97316"
                      : "#eab308"
                  }
                  transparent
                  opacity={0.72}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>

              {/* Žhnoucí uhlík doutnáku ve tmě (pro mušketýry s doutnákovým zámkem) */}
              {soundContact.kind === "matchcord_glow" && (
                <group rotation={[0, FACING_YAW[unit.facing], 0]}>
                  <MatchcordCoal
                    weather={weather}
                    roofed={isEnclosedRoofedCoord(
                      unit.pos.x,
                      unit.pos.y,
                      unit.pos.z,
                    )}
                  />
                </group>
              )}
            </>
          )}
        </group>

        {(soundContact || unitFx?.floatingBanner) && !isShootingView && (
          <WorldHtml
            position={[0, 1.65, 0]}
            center
            distanceFactor={19}
            zIndexRange={[10, 0]}
            style={{
              pointerEvents: "none",
              opacity: 0.92,
            }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleUnitClick(unit.id);
              }}
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              title={text("ui.contact.approach", { names: contactLabel }, locale)}
              className="select-none flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-lg bg-slate-950/92 border border-amber-500/60 backdrop-blur-md shadow-[0_0_14px_rgba(249,115,22,0.35)] text-amber-200 whitespace-nowrap"
            >
              {unitFx?.floatingBanner && (
                <div className="text-[10px] font-cinzel font-black px-1.5 py-0.2 rounded bg-slate-800 text-amber-200 border border-amber-500/50 uppercase">
                  {formatPhrase(unitFx.floatingBanner.phrase, locale)}
                </div>
              )}
              {soundContact && (
                <div className="flex items-center gap-1 text-[10px] font-cinzel font-bold tracking-wide">
                  {soundContact.kind === "matchcord_glow" ? (
                    <Flame className="w-3 h-3 text-orange-400 animate-pulse shrink-0" />
                  ) : (
                    <Footprints className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                  <span className="text-amber-300 font-black">[?]</span>
                  <span>{contactLabel}</span>
                  {unit.pos.y > 0 && (
                    <span className="px-1 rounded bg-amber-500/25 text-amber-300 text-[9px]">
                      P{unit.pos.y}
                    </span>
                  )}
                </div>
              )}
            </div>
          </WorldHtml>
        )}
      </group>
    );
  }

  const isPlayer = unit.faction === "player";
  const baseColor = isPlayer ? "#d97706" : "#dc2626";

  const previewArmorLoss =
    (isTargeted || isAttackedByProjectile) && targetEval
      ? targetEval.calculation.expectedArmorLoss
      : isAttackedByProjectile
        ? activeProjectile?.armorShredded ?? 0
        : 0;
  const previewHpLossMax =
    (isTargeted || isAttackedByProjectile) && targetEval
      ? targetEval.calculation.expectedHpLossMax
      : isAttackedByProjectile
        ? activeProjectile?.damage ?? 0
        : 0;
  const previewHpLossMin =
    (isTargeted || isAttackedByProjectile) && targetEval
      ? targetEval.calculation.expectedHpLossMin
      : isAttackedByProjectile
        ? activeProjectile?.damage ?? 0
        : 0;

  // Během střelby, boje zblízka a letu projektilu skryjeme štítky spolubojovníků a nezaměřených jednotek,
  // ale VŽDY zobrazíme štítek cíle, na který míříme nebo letí střela!
  const isAimOrProjectileView =
    actionMode === "shoot" ||
    actionMode === "melee" ||
    activeProjectile !== null;

  const hideLabelDuringShooting =
    isAimOrProjectileView &&
    !isAttackedByProjectile &&
    !activeCombatLoss &&
    (isPlayer || (!isTargeted && !isHovered)) &&
    !unitFx?.floatingBanner;

  // Kontextové vrstvení (Pillar 1): Jméno a detailní hlavička se zobrazí až při hoveru, zaměření nebo zásahu
  const showDetailHeader =
    isHovered ||
    isTargeted ||
    isAttackedByProjectile ||
    !!activeCombatLoss ||
    isDetainedMarshal ||
    isPreMoveTarget ||
    !!unitFx?.floatingBanner;

  // Dynamická průhlednost (Pillar 2 - Alfa kanál):
  // Neaktivní jednotky jsou potlačeny (0.46), vybraná (0.88), najetá/zaměřená/zasažená (1.0)
  const flagAlpha =
    showDetailHeader
      ? 1.0
      : isSelected
        ? 0.88
        : isHigherFloor
          ? 0.22
          : isLowerFloor
            ? 0.36
            : 0.46;

  // Vertikální odsazení nad siluetou postavy (Pillar 2):
  // Vrchol klobouků/chocholů je v y ≈ 1.85m; kotva "bottom" na y >= 2.26m zaručí, že štítek roste pouze VZHŮRU
  const labelY =
    isAttackedByProjectile || activeCombatLoss
      ? 2.48
      : isAimOrProjectileView
        ? 2.42
        : isSelected || isTargeted || isHovered
          ? 2.36
          : 2.24 + ((unit.pos.x + unit.pos.z) % 2) * 0.14;

  const displayMaxArmor = activeCombatLoss
    ? Math.max(unit.maxArmor, activeCombatLoss.maxArmor)
    : unit.maxArmor;
  const displayMaxHp = activeCombatLoss
    ? Math.max(unit.maxHp, activeCombatLoss.maxHp)
    : unit.maxHp;

  return (
    <group
      ref={groupRef}
      position={gridToWorld(unit.pos)}
      raycast={ignoreHigherFloorClicks ? () => null : undefined}
      onPointerOver={(e) => {
        if (ignoreHigherFloorClicks) return;
        e.stopPropagation();
        setIsHovered(true);
        if (unit.faction === "enemy" && actionMode === "move") {
          previewEnemyMeleeHover(unit.id);
        }
      }}
      onPointerOut={() => {
        setIsHovered(false);
        if (unit.faction === "enemy" && actionMode === "move") {
          previewEnemyMeleeHover(null);
        }
      }}
      onClick={(e) => {
        if (ignoreHigherFloorClicks) return;
        e.stopPropagation();
        handleUnitClick(unit.id);
      }}
      onContextMenu={(e) => {
        e.nativeEvent.preventDefault();
        if (wasRecentRightCameraPan()) return;
        if (ignoreHigherFloorClicks) return;
        e.stopPropagation();
        handleUnitRightClick(unit.id);
      }}
    >
      {/* Ground Anchor Disc & Contact Shadow under feet (ADR-0010) */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.22, 0.44, 24]} />
        <meshBasicMaterial
          color={isHigherFloor ? "#94a3b8" : isPlayer ? "#d4a73f" : "#dc2626"}
          transparent
          opacity={isHigherFloor ? 0.35 : 0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Svislá kotva kurzoru / postavy (Drop Line) z vyššího patra k zemi */}
      {isHigherFloor && (
        <Line
          points={[
            [0, 0, 0],
            [0, -(unit.pos.y - activeFloor) * FLOOR_HEIGHT, 0],
          ]}
          color="#94a3b8"
          dashed
          dashScale={6}
          dashSize={0.3}
          gapSize={0.2}
          lineWidth={1.6}
          transparent
          opacity={0.45}
        />
      )}

      {/* Taktický kruh pod postavou */}
      <mesh
        position={[0, 0.03, 0]}
        rotation={[-Math.PI * 0.5, 0, 0]}
        receiveShadow
      >
        <ringGeometry args={[0.48, 0.65, 28]} />
        <meshBasicMaterial
          color={
            isDetainedMarshal
              ? "#ef4444"
              : isTargeted || isAttackedByProjectile || activeCombatLoss
                ? targetEval?.calculation.isFlanked || activeCombatLoss?.critical
                  ? "#facc15"
                  : "#ef4444"
                : isSelected
                  ? "#38bdf8"
                  : isPlayer
                    ? "#f59e0b"
                    : "#dc2626"
          }
          transparent
          opacity={
            isDetainedMarshal ||
            isSelected ||
            isTargeted ||
            isAttackedByProjectile ||
            !!activeCombatLoss
              ? 0.95
              : 0.65 * visualOpacity
          }
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Vnitřní zvýraznění vybrané / zaměřené / zasažené / zadržené postavy */}
      {(isSelected ||
        isTargeted ||
        isAttackedByProjectile ||
        !!activeCombatLoss ||
        isDetainedMarshal) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <circleGeometry args={[0.48, 24]} />
          <meshBasicMaterial
            color={
              isDetainedMarshal
                ? "#ef4444"
                : isTargeted || isAttackedByProjectile || activeCombatLoss
                  ? targetEval?.calculation.isFlanked || activeCombatLoss?.critical
                    ? "#facc15"
                    : "#ef4444"
                  : "#38bdf8"
            }
            transparent
            opacity={isDetainedMarshal || activeCombatLoss ? 0.45 : 0.32}
          />
        </mesh>
      )}

      {/* Vizuální reprezentace (2D Sprite <-> 3D Model) */}
      <group ref={figurePivotRef}>
        {renderMode === "2D_SPRITE" ? (
          <UnitVisual2D
            archetype={unit.archetype}
            faction={unit.faction}
            hitFlashIntensity={hitFlash}
            opacity={visualOpacity}
          />
        ) : (
          <UnitVisual3D
            archetype={unit.archetype}
            faction={unit.faction}
            facing={unit.facing}
            hitFlashIntensity={hitFlash}
            opacity={visualOpacity}
            lockType={unit.weapon.lockType}
            weather={weather}
            roofed={isEnclosedRoofedCoord(unit.pos.x, unit.pos.y, unit.pos.z)}
          />
        )}
      </group>

      {/* Nekolizní 3D Overhead Flag (<WorldHtml anchor="bottom">) — nikdy nepřekrývá siluetu postavy */}
      {!hideLabelDuringShooting && (
        <WorldHtml
          position={[0, labelY, 0]}
          anchor="bottom"
          distanceFactor={
            isAttackedByProjectile || activeCombatLoss
              ? 11.5
              : isAimOrProjectileView
                ? 12.5
                : 16.5
          }
          minScale={0.62}
          maxScale={1.15}
          zIndexRange={
            isAttackedByProjectile || activeCombatLoss
              ? [45, 30]
              : showDetailHeader || isSelected
                ? [30, 15]
                : [14, 0]
          }
          style={{
            pointerEvents: "none",
            opacity: flagAlpha,
            transition: "opacity 160ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            onMouseEnter={() => {
              setIsHovered(true);
              if (unit.faction === "enemy" && actionMode === "move") {
                previewEnemyMeleeHover(unit.id);
              }
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              if (unit.faction === "enemy" && actionMode === "move") {
                previewEnemyMeleeHover(null);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleUnitClick(unit.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (wasRecentRightCameraPan()) return;
              handleUnitRightClick(unit.id);
            }}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            className="select-none flex flex-col items-center gap-0.5 pb-1"
          >
            {/* Výstražný odznak zadržení maršála */}
            {isDetainedMarshal && (
              <div className="text-[9px] font-cinzel font-black px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider animate-pulse border border-amber-300 shadow-lg whitespace-nowrap">
                {(unit.detainedTurns ?? 0) >= 2 || isCapturingAnim
                  ? text("ui.loss.captured", undefined, locale)
                  : text("ui.loss.detained", { progress: unit.detainedTurns ?? 1 }, locale)}
              </div>
            )}

            {/* Fáze 1 útoku (let projektilu k cíli) */}
            {isAttackedByProjectile && !activeCombatLoss && (
              <div className="flex items-center gap-1 text-[9px] font-cinzel font-black px-1.5 py-0.5 rounded bg-red-600/95 text-amber-100 uppercase tracking-wider animate-pulse border border-amber-300 shadow-md whitespace-nowrap">
                <Target className="w-2.5 h-2.5 text-amber-300 animate-spin shrink-0" />
                <span>
                  {text(
                    "ui.loss.volley",
                    activeProjectile?.hitChance !== undefined
                      ? { chance: activeProjectile.hitChance }
                      : {},
                    locale,
                  )}
                </span>
              </div>
            )}

            {/* Prediktivní zaměřovač cílů před pohybem (Pre-Move LoS Crosshair) */}
            {isPreMoveTarget &&
              !isDetainedMarshal &&
              !isAttackedByProjectile &&
              !activeCombatLoss && (
                <div className="flex items-center gap-1 text-[9px] font-cinzel font-black px-1.5 py-0.5 rounded bg-red-950/95 text-amber-200 uppercase tracking-wider border border-amber-400 shadow-[0_0_10px_rgba(239,68,68,0.8)] whitespace-nowrap">
                  <Target className="w-2.5 h-2.5 text-amber-300 animate-spin" />
                  <span>{text("banner.inSights", undefined, locale)}</span>
                </div>
              )}

            {/* Plovoucí bojový banner */}
            {unitFx?.floatingBanner && !activeCombatLoss && (
              <div
                key={unitFx.floatingBanner.id}
                className={`text-[10px] font-cinzel font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-bounce shadow-md whitespace-nowrap ${
                  unitFx.floatingBanner.tone === "crit"
                    ? "bg-amber-400 text-slate-950 border border-white"
                    : unitFx.floatingBanner.tone === "hit"
                      ? "bg-red-600 text-white border border-red-300"
                      : unitFx.floatingBanner.tone === "misfire"
                        ? "bg-orange-500 text-slate-950 border border-white"
                        : unitFx.floatingBanner.tone === "overwatch"
                          ? "bg-sky-400 text-slate-950 border border-white"
                          : unitFx.floatingBanner.tone === "buff"
                            ? "bg-emerald-400 text-slate-950 border border-white"
                            : "bg-slate-800 text-slate-100 border border-slate-600"
                }`}
              >
                {formatPhrase(unitFx.floatingBanner.phrase, locale)}
              </div>
            )}

            {/* Fáze 2 útoku (Dopad): Záhlaví výsledku zásahu přímo nad cílem */}
            {activeCombatLoss && (
              <div
                key={`loss-hdr-${activeCombatLoss.id}`}
                className={`flex items-center gap-1 text-[9px] font-cinzel font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-md whitespace-nowrap ${
                  activeCombatLoss.killed
                    ? "bg-red-600 text-amber-200 border border-amber-300 animate-pulse"
                    : activeCombatLoss.enteredDeathThroes
                      ? "bg-purple-950 text-rose-200 border border-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                      : activeCombatLoss.critical && activeCombatLoss.hit
                        ? "bg-amber-400 text-slate-950 border border-white"
                        : activeCombatLoss.hit
                          ? activeCombatLoss.hpLost > 0 ||
                            activeCombatLoss.armorLost > 0
                            ? "bg-red-600 text-white border border-red-200"
                            : "bg-amber-500 text-slate-950 border border-amber-200"
                          : "bg-slate-800 text-slate-200 border border-slate-500"
                }`}
              >
                {activeCombatLoss.killed ? (
                  <>
                    <Skull className="w-3 h-3 text-amber-200 shrink-0" />
                    <span>
                      {activeCombatLoss.instantKilled
                        ? text("banner.instantKill", undefined, locale)
                        : text("banner.eliminated", undefined, locale)}
                    </span>
                  </>
                ) : activeCombatLoss.enteredDeathThroes ? (
                  <>
                    <Skull className="w-3 h-3 text-rose-300 shrink-0 animate-pulse" />
                    <span className="text-rose-200">{text("banner.deathThroes", undefined, locale)}</span>
                  </>
                ) : activeCombatLoss.hit ? (
                  activeCombatLoss.critical ? (
                    <>
                      <Zap className="w-3 h-3 text-slate-950 shrink-0" />
                      <span>{text("banner.criticalPierce", undefined, locale)}</span>
                    </>
                  ) : activeCombatLoss.hpLost > 0 ? (
                    <span>{text("banner.hit", undefined, locale)}</span>
                  ) : (
                    <span>{text("banner.armorBounce", undefined, locale)}</span>
                  )
                ) : (
                  <span>{text("banner.missedShot", undefined, locale)}</span>
                )}
              </div>
            )}

            {/* Kontextová hlavička (Pillar 1): Jméno a % šance se rozbalí POUZE při hoveru / míření / zásahu */}
            {showDetailHeader && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-500/50 backdrop-blur-sm whitespace-nowrap shadow-md">
                <span className="font-cinzel font-black text-[10px] tracking-wide text-amber-100">
                  {unit.name}
                </span>

                {tileMeta.inSmoke && (
                  <span
                    title={text("ui.smoke.title", undefined, locale)}
                    className="flex items-center gap-0.5 text-[8px] font-cinzel font-black text-slate-300"
                  >
                    <Cloud className="w-2.5 h-2.5" />
                    <span>−20</span>
                  </span>
                )}

                {unit.pos.y !== activeFloor && (
                  <span
                    className={`text-[8px] font-cinzel font-black px-1 rounded tabular-nums ${
                      unit.pos.y > activeFloor
                        ? "bg-amber-500/30 text-amber-300"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {unit.pos.y > activeFloor
                      ? `▲+${unit.pos.y - activeFloor}`
                      : `▼-${activeFloor - unit.pos.y}`}
                  </span>
                )}

                {!isPlayer && targetEval && !activeCombatLoss && (
                  <span
                    className={`text-[9px] font-cinzel font-black px-1 rounded tabular-nums ${
                      targetEval.calculation.isFlanked
                        ? "bg-amber-500/30 text-amber-200 border border-amber-400/70"
                        : "bg-red-500/30 text-red-200 border border-red-400/60"
                    }`}
                  >
                    {targetEval.calculation.hitChance}%
                  </span>
                )}

                {!isPlayer &&
                  isHovered &&
                  meleeChargeInfo &&
                  (actionMode === "move" || actionMode === "melee") &&
                  !activeCombatLoss && (
                    <span
                      title={
                        meleeChargeInfo.isAdjacent
                          ? text("ui.melee.now", { meleeId: meleeChargeInfo.weaponId }, locale)
                          : text(
                              "ui.melee.charge",
                              { meleeId: meleeChargeInfo.weaponId, count: meleeChargeInfo.apCost },
                              locale,
                            )
                      }
                      className="flex items-center gap-0.5 text-[9px] font-cinzel font-black px-1 rounded bg-amber-500/35 text-amber-100 border border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)] tabular-nums"
                    >
                      <Swords className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                      <span>
                        PKM {meleeChargeInfo.hitChance}%
                        {!meleeChargeInfo.isAdjacent ? " · +0 AP" : ""}
                      </span>
                    </span>
                  )}
              </div>
            )}

            {/* JÁDRO XCOM 2 OVERHEAD FLAGU: Erb krytu + Mikro-segmenty Zbroje a Zdraví (žádná čísla v klidu) */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border backdrop-blur-md shadow-lg transition-all ${
                activeCombatLoss
                  ? activeCombatLoss.hit
                    ? "bg-red-950/95 border-amber-400 ring-1 ring-amber-400/70"
                    : "bg-slate-950/95 border-slate-400"
                  : isTargeted || isAttackedByProjectile
                    ? targetEval?.calculation.isFlanked
                      ? "bg-amber-950/95 border-amber-400 ring-1 ring-amber-400/60"
                      : "bg-red-950/95 border-red-400 ring-1 ring-red-400/60"
                    : isSelected
                      ? "bg-slate-950/92 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                      : isPlayer
                        ? "bg-slate-950/82 border-amber-500/50"
                        : "bg-slate-950/82 border-red-500/50"
              }`}
            >
              {/* Kompaktní barokní erb krytu přilepený vlevo */}
              {tileMeta.cover !== "none" && (
                <BaroqueCoverBadge cover={tileMeta.cover} size="sm" />
              )}

              {/* Odznak Posledního vzepětí (agónie, ADR-0012) */}
              {unit.inDeathThroes && (
                <div
                  title={`${text("inspect.cond.throes", undefined, locale)} · ${text("inspect.cond.overkill", { hp: -(unit.maxHp + 1) }, locale)}`}
                  className="flex items-center gap-1 px-1 py-0.5 rounded bg-purple-950/95 border border-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.5)] animate-pulse"
                >
                  <Skull className="w-2.5 h-2.5 text-rose-300 shrink-0" />
                  <span className="text-[8px] font-cinzel font-black tracking-wider text-rose-200">
                    {text("ui.loss.throesBadge", { hp: unit.hp }, locale)}
                  </span>
                </div>
              )}

              {/* Dvouřadá matice mikro-segmentů (nahoře Zbroj, dole HP) */}
              <div className="flex flex-col gap-[2px] py-0.5">
                {displayMaxArmor > 0 && (
                  <div className="flex items-center gap-[1.5px]">
                    {Array.from({ length: displayMaxArmor }, (_, i) => {
                      const currentArmor = activeCombatLoss
                        ? activeCombatLoss.armorAfter
                        : unit.armor;
                      const hasArmor = i < currentArmor;
                      const justLostArmor =
                        !!activeCombatLoss &&
                        i >= activeCombatLoss.armorAfter &&
                        i < activeCombatLoss.armorBefore;
                      const willLoseArmor =
                        !activeCombatLoss &&
                        (isTargeted || isAttackedByProjectile) &&
                        hasArmor &&
                        i >= Math.max(0, currentArmor - previewArmorLoss);
                      return (
                        <span
                          key={i}
                          className={`w-2 h-1 rounded-[0.5px] transition-all ${
                            justLostArmor
                              ? "bg-white animate-ping"
                              : willLoseArmor
                                ? "bg-amber-200 animate-pulse shadow-[0_0_4px_#fde047]"
                                : hasArmor
                                  ? "bg-amber-400"
                                  : "bg-slate-800/90"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-[1.5px]">
                  {Array.from({ length: displayMaxHp }, (_, i) => {
                    const currentHp = activeCombatLoss
                      ? activeCombatLoss.hpAfter
                      : unit.hp;
                    const filled = i < currentHp;
                    const justLostHp =
                      !!activeCombatLoss &&
                      i >= activeCombatLoss.hpAfter &&
                      i < activeCombatLoss.hpBefore;
                    const guaranteedLossStart = Math.max(
                      0,
                      currentHp - previewHpLossMin,
                    );
                    const maxLossStart = Math.max(
                      0,
                      currentHp - previewHpLossMax,
                    );
                    const willLoseGuaranteed =
                      !activeCombatLoss &&
                      (isTargeted || isAttackedByProjectile) &&
                      filled &&
                      i >= guaranteedLossStart;
                    const willLoseMaxRange =
                      !activeCombatLoss &&
                      (isTargeted || isAttackedByProjectile) &&
                      filled &&
                      i >= maxLossStart &&
                      i < guaranteedLossStart;

                    return (
                      <span
                        key={i}
                        className={`w-2 h-1.5 rounded-[0.5px] transition-all ${
                          justLostHp
                            ? "bg-white animate-pulse shadow-[0_0_6px_#ef4444]"
                            : willLoseGuaranteed
                              ? "bg-white animate-pulse shadow-[0_0_5px_#ffffff]"
                              : willLoseMaxRange
                                ? "bg-amber-300 animate-pulse"
                                : filled
                                  ? isPlayer
                                    ? "bg-emerald-400"
                                    : "bg-rose-500"
                                  : "bg-slate-800/90"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Mikro-tečky AP (pouze u vybrané nebo najeté hráčovy jednotky) a ikona Hlídky */}
              {(isSelected || (isPlayer && isHovered)) && unit.maxAp > 0 && (
                <div className="flex flex-col gap-[2px] pl-1 border-l border-amber-500/30">
                  {Array.from({ length: unit.maxAp }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor:
                          i < unit.ap ? baseColor : "transparent",
                      }}
                      className="w-1.5 h-1.5 rounded-full border border-amber-300/90"
                    />
                  ))}
                </div>
              )}

              {unit.isOverwatch && (
                <span
                  title={text("ui.overwatch.active", undefined, locale)}
                  className="flex items-center justify-center pl-0.5 text-sky-300"
                >
                  <Eye className="w-2.5 h-2.5" />
                </span>
              )}
            </div>

            {/* Krátký souhrn ztrát pouze v okamžiku zásahu */}
            {activeCombatLoss && activeCombatLoss.hit && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/95 border border-red-400/70 text-[8px] font-cinzel font-black text-amber-100 whitespace-nowrap tabular-nums">
                {activeCombatLoss.hpLost > 0 && (
                  <span className="text-rose-300">
                    {text("banner.damage", { damage: activeCombatLoss.hpLost }, locale)}
                  </span>
                )}
                {activeCombatLoss.armorLost > 0 && (
                  <span className="text-amber-300">
                    {text("banner.armorLost", { shred: activeCombatLoss.armorLost }, locale)}
                  </span>
                )}
                {activeCombatLoss.armorAbsorbed > 0 && (
                  <span className="text-slate-300">
                    {text("ui.loss.cuirass", { count: activeCombatLoss.armorAbsorbed }, locale)}
                  </span>
                )}
                {activeCombatLoss.shakenApplied && (
                  <span className="text-purple-300">{text("ui.loss.shaken", undefined, locale)}</span>
                )}
              </div>
            )}
          </div>
        </WorldHtml>
      )}
    </group>
  );
}
