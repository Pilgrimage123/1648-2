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
  ShieldAlert,
  Skull,
  Target,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { bestTileCover, sameCoord } from "../../core/GridSystem";
import type { UnitData } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { BaroqueCoverBadge } from "../ui/BaroqueCoverBadge";
import { UnitVisual2D } from "./UnitVisual2D";
import { UnitVisual3D } from "./UnitVisual3D";
import { WorldHtml } from "./WorldHtml";
import { FLOOR_HEIGHT, gridToWorld } from "./worldCoords";

interface UnitActorProps {
  unit: UnitData;
}

export function UnitActor({ unit }: UnitActorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const figurePivotRef = useRef<THREE.Group>(null);
  const contactRingRef = useRef<THREE.Mesh>(null);
  const emberRef = useRef<THREE.Mesh>(null);

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
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const handleUnitClick = useGameStore((s) => s.handleUnitClick);
  const completeUnitMovement = useGameStore((s) => s.completeUnitMovement);

  const [hitFlash, setHitFlash] = useState(0);
  const [lossTick, setLossTick] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const moveProgressRef = useRef(0);

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

  const isSelected = selectedUnitId === unit.id;
  const isDetainedMarshal =
    unit.id === "player-colloredo" &&
    ((unit.detainedTurns ?? 0) > 0 || unit.hp <= 0);
  const isTargeted =
    actionMode === "shoot" &&
    selectedTargetId === unit.id &&
    unit.faction === "enemy" &&
    !isHiddenInFog;
  const targetEval = useMemo(
    () => visibleTargets.find((t) => t.targetId === unit.id),
    [visibleTargets, unit.id],
  );

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
    if (emberRef.current) {
      const flicker = 0.85 + Math.sin(t * 14 + unit.pos.z) * 0.25;
      emberRef.current.scale.setScalar(flicker);
    }

    if (waypoints && waypoints.pts.length >= 2) {
      const speedTilesPerSec = 5.2;
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

        const isVerticalStep = c0.y !== c1.y;
        if (isVerticalStep && segFrac >= 0.5) {
          const curFloor = useGameStore.getState().activeFloor;
          if (curFloor !== c1.y) {
            useGameStore.getState().setActiveFloor(c1.y);
          }
        }
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
        } else {
          const hopPhase = segFrac * Math.PI;
          const hopHeight = Math.sin(hopPhase) * 0.24;
          const waddleTilt =
            Math.sin(moveProgressRef.current * Math.PI * 2) * 0.11;
          pivot.position.set(0, hopHeight, 0);
          pivot.rotation.set(0.08, 0, waddleTilt);
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
        const idleBob =
          Math.sin(state.clock.elapsedTime * 2.4 + unit.pos.x) * 0.025;
        pivot.position.set(0, idleBob, 0);
        pivot.rotation.set(0, 0, 0);
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
        const dirVec =
          unit.facing === "N"
            ? [0, -1]
            : unit.facing === "S"
              ? [0, 1]
              : unit.facing === "E"
                ? [1, 0]
                : [-1, 0];
        pivot.position.x += dirVec[0]! * kickbackDist;
        pivot.position.z += dirVec[1]! * kickbackDist;
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
                <mesh ref={emberRef} position={[0.14, 1.08, 0.12]}>
                  <sphereGeometry args={[0.065, 8, 8]} />
                  <meshStandardMaterial
                    color="#fb923c"
                    emissive="#ea580c"
                    emissiveIntensity={3.2}
                  />
                </mesh>
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
              title={`${soundContact?.label ?? "Kontakt v šerosvitu"} — Přibližte se s jednotkou nebo vystoupejte na strážní věž pro odhalení cíle`}
              className="select-none flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-lg bg-slate-950/92 border border-amber-500/60 backdrop-blur-md shadow-[0_0_14px_rgba(249,115,22,0.35)] text-amber-200 whitespace-nowrap"
            >
              {unitFx?.floatingBanner && (
                <div className="text-[10px] font-cinzel font-black px-1.5 py-0.2 rounded bg-slate-800 text-amber-200 border border-amber-500/50 uppercase">
                  {unitFx.floatingBanner.text}
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
                  <span>{soundContact.label}</span>
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

  // Během střelby a míření skryjeme karty spolubojovníků za ramenem střelce,
  // ale VŽDY zobrazíme kartu cíle, na který letí střela nebo který právě utrpěl ztráty!
  const hideLabelDuringShooting =
    isShootingView &&
    !isAttackedByProjectile &&
    !activeCombatLoss &&
    (isPlayer || (!isTargeted && !isHovered)) &&
    !unitFx?.floatingBanner;

  // Rozbalená vs. kompaktní podoba štítku (proti překrývání sousedících postav)
  const isExpandedCard =
    (!isShootingView && isSelected) ||
    isTargeted ||
    isAttackedByProjectile ||
    !!activeCombatLoss ||
    isHovered ||
    isDetainedMarshal ||
    !!unitFx?.floatingBanner;

  // Šachovnicový výškový posun (stagger), aby se sousedící štítky nikdy nepřekrývaly
  const labelY =
    isAttackedByProjectile || activeCombatLoss
      ? 2.72
      : isShootingView
        ? 2.65
        : isSelected || isTargeted
          ? 2.45
          : 2.05 + ((unit.pos.x + unit.pos.z) % 2) * 0.28;

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
      raycast={isHigherFloor && actionMode === "move" ? () => null : undefined}
      onPointerOver={(e) => {
        if (isHigherFloor && actionMode === "move") return;
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(e) => {
        if (isHigherFloor && actionMode === "move") return;
        e.stopPropagation();
        handleUnitClick(unit.id);
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
          />
        )}
      </group>

      {/* Plovoucí HTML štítek (<WorldHtml>) — přímo při útoku ukazuje přesně co zasažený nepřítel ztrácí */}
      {!hideLabelDuringShooting && (
        <WorldHtml
          position={[0, labelY, 0]}
          center
          distanceFactor={
            isAttackedByProjectile || activeCombatLoss
              ? 11.2
              : isShootingView
                ? 12
                : 18
          }
          zIndexRange={
            isAttackedByProjectile || activeCombatLoss
              ? [45, 30]
              : isExpandedCard
                ? [30, 15]
                : [14, 0]
          }
          style={{
            pointerEvents: "none",
            opacity: 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              handleUnitClick(unit.id);
            }}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            className={`select-none flex flex-col items-center gap-1 rounded-xl border backdrop-blur-md shadow-2xl transition-all ${
              isExpandedCard ? "px-2.5 py-1.5 border-2" : "px-1.5 py-1"
            } ${
              activeCombatLoss
                ? activeCombatLoss.hit
                  ? activeCombatLoss.critical || activeCombatLoss.killed
                    ? "bg-red-950/96 border-amber-400 scale-110 ring-2 ring-amber-400/80 shadow-[0_0_26px_rgba(250,204,21,0.55)]"
                    : "bg-red-950/96 border-red-400 scale-105 ring-2 ring-red-500/75 shadow-[0_0_22px_rgba(239,68,68,0.5)]"
                  : "bg-slate-950/95 border-slate-400 scale-105 ring-1 ring-slate-400/50"
                : isDetainedMarshal
                  ? "bg-red-950/95 border-red-400 scale-105 ring-2 ring-red-500/70"
                  : isTargeted || isAttackedByProjectile
                    ? targetEval?.calculation.isFlanked
                      ? "bg-amber-950/95 border-amber-400 scale-105 ring-2 ring-amber-400/60"
                      : "bg-red-950/95 border-red-400 scale-105 ring-2 ring-red-400/60"
                    : isSelected
                      ? "bg-slate-950/95 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                      : isPlayer
                        ? "bg-slate-950/88 border-amber-500/60"
                        : "bg-slate-950/88 border-red-500/60"
            }`}
          >
            {/* Výstražný odznak zadržení maršála */}
            {isDetainedMarshal && (
              <div className="text-[10px] font-cinzel font-black px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider animate-pulse border border-amber-300 shadow-lg whitespace-nowrap">
                {(unit.detainedTurns ?? 0) >= 2 || isCapturingAnim
                  ? "ZAJAT! (2/2)"
                  : `ZADRŽEN (${unit.detainedTurns ?? 1}/2)`}
              </div>
            )}

            {/* Fáze 1 útoku (let projektilu k cíli): Indikátor blížící se střely a ohrožených životů/zbroje */}
            {isAttackedByProjectile && !activeCombatLoss && (
              <div className="flex items-center gap-1.5 text-[10px] font-cinzel font-black px-2 py-0.5 rounded bg-red-600/95 text-amber-100 uppercase tracking-wider animate-pulse border border-amber-300 shadow-md whitespace-nowrap">
                <Target className="w-3 h-3 text-amber-300 animate-spin shrink-0" />
                <span>
                  ÚTOK NA CÍL
                  {activeProjectile?.hitChance !== undefined
                    ? ` • ${activeProjectile.hitChance}%`
                    : ""}
                </span>
              </div>
            )}

            {/* Prediktivní zaměřovač cílů před pohybem (Pre-Move LoS Crosshair ADR-0010) */}
            {isPreMoveTarget &&
              !isDetainedMarshal &&
              !isAttackedByProjectile &&
              !activeCombatLoss && (
                <div className="flex items-center gap-1 text-[10px] font-cinzel font-black px-2 py-0.5 rounded-full bg-red-600 text-white uppercase tracking-wider animate-pulse border border-amber-300 shadow-[0_0_12px_rgba(239,68,68,0.9)] whitespace-nowrap">
                  <Target className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                  <span>V muškách po přesunu</span>
                </div>
              )}

            {/* Plovoucí bojový banner (zobrazíme samostatně, pokud není nahrazen detailním panelem ztrát) */}
            {unitFx?.floatingBanner && !activeCombatLoss && (
              <div
                key={unitFx.floatingBanner.id}
                className={`text-[11px] font-cinzel font-black px-2 py-0.5 rounded uppercase tracking-wider animate-bounce shadow-md whitespace-nowrap ${
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
                {unitFx.floatingBanner.text}
              </div>
            )}

            {/* Fáze 2 útoku (Dopad): Záhlaví výsledku zásahu přímo nad cílem */}
            {activeCombatLoss && (
              <div
                key={`loss-hdr-${activeCombatLoss.id}`}
                className={`flex items-center gap-1 text-[10px] font-cinzel font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-md whitespace-nowrap ${
                  activeCombatLoss.killed
                    ? "bg-red-600 text-amber-200 border border-amber-300 animate-pulse"
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
                    <Skull className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                    <span>SMRTELNÝ ZÁSAH — VYŘAZEN!</span>
                  </>
                ) : activeCombatLoss.hit ? (
                  activeCombatLoss.critical ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                      <span>KRITICKÝ PRŮSTŘEL!</span>
                    </>
                  ) : activeCombatLoss.hpLost > 0 ? (
                    <span>ZÁSAH CÍLE!</span>
                  ) : (
                    <span>ODRAŽENO KYRYSEM!</span>
                  )
                ) : (
                  <span>MINUTÍ — ODRAZ DO ZDIVA</span>
                )}
              </div>
            )}

            {/* Horní řádek: Barokní ikona krytu s číslem (−20 / −40) + Jméno + % Zásahu */}
            <div className="flex items-center gap-1 whitespace-nowrap">
              {tileMeta.cover !== "none" && (
                <BaroqueCoverBadge cover={tileMeta.cover} size="sm" />
              )}

              {tileMeta.inSmoke && (
                <span
                  title="Kouř z černého prachu (−20 % k zásahu)"
                  className="flex items-center justify-center rounded px-1 h-5 bg-slate-700/80 text-slate-200 border border-slate-400/50 text-[9px] font-cinzel font-black gap-0.5"
                >
                  <Cloud className="w-3 h-3" />
                  <span>−20</span>
                </span>
              )}

              <span className="font-cinzel font-black text-[11px] tracking-wide text-amber-100">
                {unit.name}
              </span>

              {unit.pos.y !== activeFloor && (
                <span
                  title={`Relativní výška vůči aktivnímu patru: ${unit.pos.y > activeFloor ? `+${unit.pos.y - activeFloor}` : `-${activeFloor - unit.pos.y}`} patro`}
                  className={`flex items-center gap-0.5 text-[9px] font-cinzel font-black px-1 rounded border tabular-nums ${
                    unit.pos.y > activeFloor
                      ? "bg-amber-500/30 text-amber-300 border-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                      : "bg-slate-800/90 text-slate-300 border-slate-600/60"
                  }`}
                >
                  <span>{unit.pos.y > activeFloor ? "▲" : "▼"}</span>
                  <span>
                    {unit.pos.y > activeFloor
                      ? `+${unit.pos.y - activeFloor}`
                      : `-${activeFloor - unit.pos.y}`}
                  </span>
                </span>
              )}

              {unit.isOverwatch && (
                <span
                  title="Hlídka (Overwatch) aktivní"
                  className="flex items-center gap-0.5 text-[9px] font-cinzel font-bold px-1 rounded bg-sky-500/30 text-sky-200 border border-sky-400/60"
                >
                  <Eye className="w-2.5 h-2.5" />
                </span>
              )}

              {!isPlayer && targetEval && !activeCombatLoss && (
                <span
                  className={`text-[10px] font-cinzel font-black px-1.5 py-0.2 rounded border tabular-nums ${
                    targetEval.calculation.isFlanked
                      ? "bg-amber-500/30 text-amber-200 border-amber-400/80"
                      : "bg-red-500/30 text-red-200 border-red-400/70"
                  }`}
                >
                  {targetEval.calculation.hitChance}%
                </span>
              )}
            </div>

            {/* Řádek ukazatelů: v kompaktním režimu 1 čistý řádek kostiček, v rozbaleném plný detail se zvýrazněním ztracených dílků */}
            {isExpandedCard ? (
              <div className="flex flex-col gap-0.5 w-full">
                {displayMaxArmor > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-0.5">
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
                            title={
                              justLostArmor
                                ? "Ztracený dílek zbroje (průraz kyrysu)"
                                : "Zbroj (kyrys)"
                            }
                            className={`w-2.5 h-2 rounded-[2px] border transition-all ${
                              justLostArmor
                                ? "bg-gradient-to-t from-red-600 via-amber-300 to-white border-white animate-pulse shadow-[0_0_8px_#f59e0b] scale-110"
                                : willLoseArmor
                                  ? "bg-amber-300 border-white animate-pulse shadow-[0_0_8px_#fde047]"
                                  : hasArmor
                                    ? "bg-amber-400 border-amber-200"
                                    : "bg-slate-900 border-slate-700"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {activeCombatLoss && activeCombatLoss.armorLost > 0 ? (
                      <span className="text-[9px] font-cinzel font-black text-amber-300 whitespace-nowrap tabular-nums">
                        ZBROJ {activeCombatLoss.armorBefore}→
                        {activeCombatLoss.armorAfter} (−
                        {activeCombatLoss.armorLost})
                      </span>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: unit.maxAp }, (_, i) => (
                          <span
                            key={i}
                            style={{
                              backgroundColor:
                                i < unit.ap ? baseColor : "transparent",
                            }}
                            className="w-1.5 h-1.5 rounded-full border border-amber-300"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
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
                          title={
                            justLostHp
                              ? "Právě ztracený dílek zdraví (HP)"
                              : "Zdraví (HP)"
                          }
                          className={`w-2.5 h-2.5 rounded-[1px] border transition-all ${
                            justLostHp
                              ? "bg-gradient-to-t from-red-600 via-amber-300 to-white border-white animate-pulse shadow-[0_0_9px_#ef4444] scale-110"
                              : willLoseGuaranteed
                                ? "bg-white border-amber-300 animate-pulse shadow-[0_0_8px_#ffffff]"
                                : willLoseMaxRange
                                  ? "bg-amber-300 border-amber-100 animate-pulse shadow-[0_0_6px_#fde047]"
                                  : filled
                                    ? isPlayer
                                      ? "bg-emerald-400 border-emerald-200"
                                      : "bg-rose-500 border-rose-300"
                                    : "bg-slate-900 border-slate-700"
                          }`}
                        />
                      );
                    })}
                  </div>

                  {activeCombatLoss ? (
                    <span
                      className={`text-[9px] font-cinzel font-black whitespace-nowrap tabular-nums ${
                        activeCombatLoss.hpLost > 0
                          ? "text-red-300"
                          : "text-slate-300"
                      }`}
                    >
                      HP {activeCombatLoss.hpBefore}→{activeCombatLoss.hpAfter}{" "}
                      {activeCombatLoss.hpLost > 0
                        ? `(−${activeCombatLoss.hpLost})`
                        : "(0)"}
                    </span>
                  ) : (
                    (isTargeted || isAttackedByProjectile) &&
                    previewHpLossMax > 0 && (
                      <span className="text-[9px] font-cinzel font-black text-amber-300 animate-pulse whitespace-nowrap tabular-nums">
                        −{previewHpLossMin}
                        {previewHpLossMax !== previewHpLossMin
                          ? `..${previewHpLossMax}`
                          : ""}
                      </span>
                    )
                  )}
                </div>

                {/* Přímý jmenovitý výčet všeho, co zasažený cíl ztrácí během útoku */}
                {activeCombatLoss && activeCombatLoss.hit && (
                  <div className="mt-0.5 pt-1 border-t border-red-400/40 flex flex-wrap items-center justify-center gap-1 max-w-[230px]">
                    {activeCombatLoss.hpLost > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-600/90 text-white border border-red-300 text-[9px] font-cinzel font-black tracking-wide shadow-sm whitespace-nowrap">
                        <span>−{activeCombatLoss.hpLost} HP ZDRAVÍ</span>
                      </span>
                    )}
                    {activeCombatLoss.armorLost > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 border border-amber-200 text-[9px] font-cinzel font-black tracking-wide shadow-sm whitespace-nowrap">
                        <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                        <span>−{activeCombatLoss.armorLost} ZBROJ</span>
                      </span>
                    )}
                    {activeCombatLoss.armorAbsorbed > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800/95 text-amber-200 border border-amber-400/60 text-[9px] font-cinzel font-bold tracking-wide whitespace-nowrap">
                        <span>
                          KYRYS POHLTIL {activeCombatLoss.armorAbsorbed} DMG
                        </span>
                      </span>
                    )}
                    {activeCombatLoss.apLost > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-600/90 text-white border border-orange-300 text-[9px] font-cinzel font-black tracking-wide whitespace-nowrap">
                        <span>−{activeCombatLoss.apLost} AP AKCE</span>
                      </span>
                    )}
                    {activeCombatLoss.shakenApplied && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-900/95 text-purple-100 border border-purple-400 text-[9px] font-cinzel font-black tracking-wide whitespace-nowrap">
                        <span>OTŘESEN (−15 % MÍŘENÍ)</span>
                      </span>
                    )}
                    {activeCombatLoss.overwatchLost && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-900/95 text-sky-100 border border-sky-400 text-[9px] font-cinzel font-black tracking-wide whitespace-nowrap">
                        <span>ZRUŠEN OVERWATCH</span>
                      </span>
                    )}
                    {activeCombatLoss.detainedApplied && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-700 text-amber-200 border border-amber-300 text-[9px] font-cinzel font-black tracking-wide whitespace-nowrap">
                        <span>ZADRŽEN (1/2 KOLA)</span>
                      </span>
                    )}
                    {activeCombatLoss.killed && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-950 text-amber-300 border border-amber-400 text-[9px] font-cinzel font-black tracking-wide whitespace-nowrap">
                        <Skull className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span>PADL V BOJI</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Kompaktní řádek pro nevybrané jednotky (žádné překrývání) */
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: unit.maxHp }, (_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-[1px] ${
                        i < unit.hp
                          ? isPlayer
                            ? "bg-emerald-400"
                            : "bg-rose-500"
                          : "bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
                {unit.armor > 0 && (
                  <div className="flex items-center gap-0.5 pl-0.5 border-l border-slate-700">
                    {Array.from({ length: unit.armor }, (_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-[1px] bg-amber-400"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </WorldHtml>
      )}
    </group>
  );
}
