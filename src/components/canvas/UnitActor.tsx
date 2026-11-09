/**
 * Modulární kontejner postavy (/src/components/canvas/UnitActor.tsx).
 * Řeší 3D pozici na mřížce, plynulou interpolaci po A* cestě, poskakování figurky při chůzi,
 * vyklonění při střelbě, animaci zásahu a nekolizní plovoucí HTML štítek (<WorldHtml>)
 * s barokní ikonou krytu s číslem (−20 / −40), HP/Armor segmenty a blikajícím náhledem poškození.
 */

import { useFrame } from "@react-three/fiber";
import { Cloud, Eye, Flame, Footprints } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { bestTileCover } from "../../core/GridSystem";
import type { UnitData } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { BaroqueCoverBadge } from "../ui/BaroqueCoverBadge";
import { UnitVisual2D } from "./UnitVisual2D";
import { UnitVisual3D } from "./UnitVisual3D";
import { WorldHtml } from "./WorldHtml";
import { gridToWorld } from "./worldCoords";

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
  const unitFx = useGameStore((s) => s.unitFx[unit.id]);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const handleUnitClick = useGameStore((s) => s.handleUnitClick);
  const completeUnitMovement = useGameStore((s) => s.completeUnitMovement);

  const [hitFlash, setHitFlash] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const moveProgressRef = useRef(0);

  const isHiddenInFog =
    unit.faction === "enemy" &&
    fogOfWarEnabled &&
    !fogSnapshot.visibleEnemyIds.has(unit.id);

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
      if (elapsed >= 0 && elapsed < 0.44) {
        // Realistický zpětný ráz muškety / arkebuzy při výstřelu (prudké kopnutí vzad a zdvih hlavně s tlumeným návratem)
        const normT = elapsed / 0.44;
        const recoilEnvelope =
          normT < 0.18
            ? normT / 0.18
            : Math.pow(1 - (normT - 0.18) / 0.82, 1.8);
        const kickbackDist = -0.24 * recoilEnvelope;
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
      if (elapsed >= 0 && elapsed < 0.55) {
        const intensity = 1 - elapsed / 0.55;
        setHitFlash(intensity);
        pivot.position.x += Math.sin(elapsed * 95) * 0.18 * intensity;
        pivot.position.z += Math.cos(elapsed * 85) * 0.18 * intensity;
      } else if (hitFlash > 0) {
        setHitFlash(0);
      }
    } else if (hitFlash > 0) {
      setHitFlash(0);
    }
  });

  if (!unit.alive) return null;

  const isShootingView = actionMode === "shoot" || activeProjectile !== null;
  const isMovingThisUnit = activeMovement?.unitId === unit.id;
  
  // Postavy nesmí být vidět skrze patra:
  // Postava se vykreslí pouze tehdy, pokud stojí na právě aktivním patře (activeFloor),
  // nebo pokud je přímo cílem střelby v shooting view, nebo pokud se zrovna pohybuje.
  const isOnActiveFloor = unit.pos.y === activeFloor;
  if (!isOnActiveFloor && !isTargeted && !isMovingThisUnit) {
    return null;
  }

  const visualOpacity = 1;

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
    isTargeted && targetEval ? targetEval.calculation.expectedArmorLoss : 0;
  const previewHpLossMax =
    isTargeted && targetEval ? targetEval.calculation.expectedHpLossMax : 0;
  const previewHpLossMin =
    isTargeted && targetEval ? targetEval.calculation.expectedHpLossMin : 0;

  // Během střelby a míření skryjeme všechny karty a štítky spolubojovníků,
  // aby nezakrývaly výhled kamery za ramenem střelce!
  const hideLabelDuringShooting =
    isShootingView &&
    (isPlayer || (!isTargeted && !isHovered)) &&
    !unitFx?.floatingBanner;

  // Rozbalená vs. kompaktní podoba štítku (proti překrývání sousedících postav)
  const isExpandedCard =
    (!isShootingView && isSelected) ||
    isTargeted ||
    isHovered ||
    isDetainedMarshal ||
    !!unitFx?.floatingBanner;

  // Šachovnicový výškový posun (stagger), aby se sousedící štítky nikdy nepřekrývaly
  const labelY = isShootingView
    ? 2.65
    : isSelected || isTargeted
      ? 2.45
      : 2.05 + ((unit.pos.x + unit.pos.z) % 2) * 0.28;

  const shortName = unit.name.split(" ")[0] ?? unit.name;

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
              : isTargeted
                ? targetEval?.calculation.isFlanked
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
            isDetainedMarshal || isSelected || isTargeted
              ? 0.95
              : 0.65 * visualOpacity
          }
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Vnitřní zvýraznění vybrané / zaměřené / zadržené postavy */}
      {(isSelected || isTargeted || isDetainedMarshal) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <circleGeometry args={[0.48, 24]} />
          <meshBasicMaterial
            color={
              isDetainedMarshal
                ? "#ef4444"
                : isTargeted
                  ? targetEval?.calculation.isFlanked
                    ? "#facc15"
                    : "#ef4444"
                  : "#38bdf8"
            }
            transparent
            opacity={isDetainedMarshal ? 0.4 : 0.3}
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

      {/* Plovoucí HTML štítek (<WorldHtml>) — skrytý pro spolubojovníky během střelby */}
      {!hideLabelDuringShooting && (
        <WorldHtml
          position={[0, labelY, 0]}
          center
          distanceFactor={isShootingView ? 12 : 18}
          zIndexRange={isExpandedCard ? [30, 15] : [14, 0]}
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
              isDetainedMarshal
                ? "bg-red-950/95 border-red-400 scale-105 ring-2 ring-red-500/70"
                : isTargeted
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

          {/* Plovoucí bojový banner */}
          {unitFx?.floatingBanner && (
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

            {unit.pos.y > 0 && (
              <span className="text-[9px] font-cinzel font-bold px-1 rounded bg-amber-500/30 text-amber-300 border border-amber-400/60">
                P{unit.pos.y}
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

            {!isPlayer && targetEval && (
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

          {/* Řádek ukazatelů: v kompaktním režimu 1 čistý řádek kostiček, v rozbaleném plný detail */}
          {isExpandedCard ? (
            <div className="flex flex-col gap-0.5 w-full">
              {unit.maxArmor > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: unit.maxArmor }, (_, i) => {
                      const hasArmor = i < unit.armor;
                      const willLoseArmor =
                        isTargeted &&
                        hasArmor &&
                        i >= Math.max(0, unit.armor - previewArmorLoss);
                      return (
                        <span
                          key={i}
                          title="Zbroj (kyrys)"
                          className={`w-2.5 h-2 rounded-[2px] border transition-colors ${
                            willLoseArmor
                              ? "bg-amber-300 border-white animate-pulse shadow-[0_0_8px_#fde047]"
                              : hasArmor
                                ? "bg-amber-400 border-amber-200"
                                : "bg-slate-900 border-slate-700"
                          }`}
                        />
                      );
                    })}
                  </div>

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
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: unit.maxHp }, (_, i) => {
                    const filled = i < unit.hp;
                    const guaranteedLossStart = Math.max(
                      0,
                      unit.hp - previewHpLossMin,
                    );
                    const maxLossStart = Math.max(
                      0,
                      unit.hp - previewHpLossMax,
                    );
                    const willLoseGuaranteed =
                      isTargeted && filled && i >= guaranteedLossStart;
                    const willLoseMaxRange =
                      isTargeted &&
                      filled &&
                      i >= maxLossStart &&
                      i < guaranteedLossStart;

                    return (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-[1px] border transition-all ${
                          willLoseGuaranteed
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

                {isTargeted && targetEval && (
                  <span className="text-[9px] font-cinzel font-black text-amber-300 animate-pulse whitespace-nowrap tabular-nums">
                    −{previewHpLossMin}..{previewHpLossMax}
                  </span>
                )}
              </div>
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
