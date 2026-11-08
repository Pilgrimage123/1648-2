/**
 * Modulární kontejner postavy (/src/components/canvas/UnitActor.tsx).
 * Řeší 3D pozici na mřížce, plynulou interpolaci po A* cestě, poskakování figurky při chůzi,
 * vyklonění při střelbě, animaci zásahu (červené probliknutí + zatřesení) a plovoucí HTML štítek
 * (<Html> z @react-three/drei) s HP kostičkami, body zbroje (kyrysu) a blikajícím náhledem
 * očekávané ztráty životů a zbroje při zaměření (HP & Armor Preview).
 */

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Cloud, Eye, Shield, ShieldAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { bestTileCover } from "../../core/GridSystem";
import type { UnitData } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { UnitVisual2D } from "./UnitVisual2D";
import { UnitVisual3D } from "./UnitVisual3D";
import { gridToWorld } from "./worldCoords";

interface UnitActorProps {
  unit: UnitData;
}

export function UnitActor({ unit }: UnitActorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const figurePivotRef = useRef<THREE.Group>(null);

  const grid = useGameStore((s) => s.grid);
  const smokeVersion = useGameStore((s) => s.smokeVersion);
  const renderMode = useGameStore((s) => s.renderMode);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const actionMode = useGameStore((s) => s.actionMode);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const activeMovement = useGameStore((s) => s.activeMovement);
  const unitFx = useGameStore((s) => s.unitFx[unit.id]);
  const handleUnitClick = useGameStore((s) => s.handleUnitClick);
  const completeUnitMovement = useGameStore((s) => s.completeUnitMovement);

  const [hitFlash, setHitFlash] = useState(0);
  const moveProgressRef = useRef(0);

  const isSelected = selectedUnitId === unit.id;
  const isTargeted =
    actionMode === "shoot" &&
    selectedTargetId === unit.id &&
    unit.faction === "enemy";
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
    const pts = [activeMovement.from, ...activeMovement.path].map(
      (c) => new THREE.Vector3(...gridToWorld(c)),
    );
    return pts;
  }, [activeMovement, unit.id]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const group = groupRef.current;
    const pivot = figurePivotRef.current;
    if (!group || !pivot) return;

    const now = performance.now();

    // 1. Plynulý pohyb po A* trase + poskakování figurky (sinusoida Y + náklon)
    if (waypoints && waypoints.length >= 2) {
      const speedTilesPerSec = 5.4;
      moveProgressRef.current += dt * speedTilesPerSec;
      const totalSegments = waypoints.length - 1;

      if (moveProgressRef.current >= totalSegments) {
        const lastPt = waypoints[waypoints.length - 1]!;
        group.position.copy(lastPt);
        pivot.position.set(0, 0, 0);
        pivot.rotation.set(0, 0, 0);
        moveProgressRef.current = 0;
        completeUnitMovement();
      } else {
        const segIdx = Math.floor(moveProgressRef.current);
        const segFrac = moveProgressRef.current - segIdx;
        const p0 = waypoints[segIdx]!;
        const p1 = waypoints[segIdx + 1]!;
        group.position.lerpVectors(p0, p1, segFrac);

        const hopPhase = segFrac * Math.PI;
        const hopHeight = Math.sin(hopPhase) * 0.26;
        const waddleTilt =
          Math.sin(moveProgressRef.current * Math.PI * 2) * 0.11;
        pivot.position.set(0, hopHeight, 0);
        pivot.rotation.set(0.08, 0, waddleTilt);
      }
    } else {
      moveProgressRef.current = 0;
      const [wx, wy, wz] = gridToWorld(unit.pos);
      group.position.set(wx, wy, wz);

      const idleBob =
        Math.sin(state.clock.elapsedTime * 2.4 + unit.pos.x) * 0.025;
      pivot.position.set(0, idleBob, 0);
      pivot.rotation.set(0, 0, 0);
    }

    // 2. Vyklonění při střelbě (Attack Lunge)
    if (unitFx?.lungeTimestamp) {
      const elapsed = (now - unitFx.lungeTimestamp) / 1000;
      if (elapsed >= 0 && elapsed < 0.32) {
        const k = Math.sin((elapsed / 0.32) * Math.PI);
        const lungeOffset = k * 0.38;
        const dirVec =
          unit.facing === "N"
            ? [0, -1]
            : unit.facing === "S"
              ? [0, 1]
              : unit.facing === "E"
                ? [1, 0]
                : [-1, 0];
        pivot.position.x += dirVec[0]! * lungeOffset;
        pivot.position.z += dirVec[1]! * lungeOffset;
        pivot.rotation.x = k * 0.18;
      }
    }

    // 3. Animace zásahu (červené probliknutí + zatřesení)
    if (unitFx?.hitTimestamp) {
      const elapsed = (now - unitFx.hitTimestamp) / 1000;
      if (elapsed >= 0 && elapsed < 0.45) {
        const intensity = 1 - elapsed / 0.45;
        setHitFlash(intensity);
        pivot.position.x += Math.sin(elapsed * 85) * 0.14 * intensity;
        pivot.position.z += Math.cos(elapsed * 75) * 0.14 * intensity;
      } else if (hitFlash > 0) {
        setHitFlash(0);
      }
    } else if (hitFlash > 0) {
      setHitFlash(0);
    }
  });

  if (!unit.alive) return null;

  const isUpperCutaway = unit.pos.y > activeFloor;
  const visualOpacity = isUpperCutaway ? 0.38 : 1;

  const isPlayer = unit.faction === "player";
  const baseColor = isPlayer ? "#d97706" : "#dc2626";

  // Náhled úbytku HP a zbroje (kyrysu) při zaměření v Režimu míření
  const previewArmorLoss =
    isTargeted && targetEval ? targetEval.calculation.expectedArmorLoss : 0;
  const previewHpLossMax =
    isTargeted && targetEval ? targetEval.calculation.expectedHpLossMax : 0;
  const previewHpLossMin =
    isTargeted && targetEval ? targetEval.calculation.expectedHpLossMin : 0;

  return (
    <group
      ref={groupRef}
      position={gridToWorld(unit.pos)}
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
        <ringGeometry args={[0.48, 0.62, 28]} />
        <meshBasicMaterial
          color={
            isTargeted
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
          opacity={isSelected || isTargeted ? 0.95 : 0.55 * visualOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Vnitřní zvýraznění vybrané / zaměřené postavy */}
      {(isSelected || isTargeted) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <circleGeometry args={[0.48, 24]} />
          <meshBasicMaterial
            color={
              isTargeted
                ? targetEval?.calculation.isFlanked
                  ? "#facc15"
                  : "#ef4444"
                : "#38bdf8"
            }
            transparent
            opacity={0.24}
          />
        </mesh>
      )}

      {/* Vizuální reprezentace (okamžitá výměna 2D Sprite <-> 3D Model) */}
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

      {/* Plovoucí HTML štítek (<Html> z @react-three/drei) s blikajícím náhledem ztráty HP a zbroje */}
      <Html
        position={[0, 2.2, 0]}
        center
        distanceFactor={18}
        zIndexRange={[20, 0]}
        style={{
          pointerEvents: "none",
          opacity: isUpperCutaway ? 0.45 : 1,
          transition: "opacity 0.2s ease",
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleUnitClick(unit.id);
          }}
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          className={`select-none flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-lg border backdrop-blur-md shadow-xl transition-transform ${
            isTargeted
              ? targetEval?.calculation.isFlanked
                ? "bg-amber-950/95 border-amber-400 scale-110 ring-2 ring-amber-400/50"
                : "bg-red-950/95 border-red-400 scale-110 ring-2 ring-red-400/50"
              : isSelected
                ? "bg-slate-900/95 border-sky-400 scale-105"
                : isPlayer
                  ? "bg-slate-900/85 border-amber-500/60"
                  : "bg-slate-950/85 border-red-500/60"
          }`}
        >
          {/* Plovoucí bojový banner (Zásah / Krit / Selhání doutnáku / Overwatch) */}
          {unitFx?.floatingBanner && (
            <div
              key={unitFx.floatingBanner.id}
              className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-bounce ${
                unitFx.floatingBanner.tone === "crit"
                  ? "bg-amber-500 text-slate-950"
                  : unitFx.floatingBanner.tone === "hit"
                    ? "bg-red-600 text-white"
                    : unitFx.floatingBanner.tone === "misfire"
                      ? "bg-orange-500 text-slate-950"
                      : unitFx.floatingBanner.tone === "overwatch"
                        ? "bg-sky-500 text-slate-950"
                        : "bg-slate-700 text-slate-200"
              }`}
            >
              {unitFx.floatingBanner.text}
            </div>
          )}

          {/* Horní řádek: Ikona krytu + Kouř + Jméno + Patro + % Zásahu */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {tileMeta.cover !== "none" && (
              <span
                title={
                  tileMeta.cover === "full"
                    ? "Plný kryt (-40 %)"
                    : "Poloviční kryt (-20 %)"
                }
                className={`flex items-center justify-center rounded p-0.5 ${
                  tileMeta.cover === "full"
                    ? "bg-sky-500/30 text-sky-300"
                    : "bg-amber-500/30 text-amber-300"
                }`}
              >
                {tileMeta.cover === "full" ? (
                  <Shield className="w-3 h-3 fill-current" />
                ) : (
                  <ShieldAlert className="w-3 h-3" />
                )}
              </span>
            )}

            {tileMeta.inSmoke && (
              <span
                title="Stojí v kouři z černého prachu (-20 % k zásahu)"
                className="flex items-center justify-center rounded p-0.5 bg-slate-600/50 text-slate-200"
              >
                <Cloud className="w-3 h-3" />
              </span>
            )}

            <span className="text-[11px] font-bold tracking-wide text-slate-100">
              {unit.name}
            </span>

            {unit.pos.y > 0 && (
              <span className="text-[9px] font-bold px-1 rounded bg-amber-500/25 text-amber-300 border border-amber-400/40">
                P{unit.pos.y}
              </span>
            )}

            {unit.isOverwatch && (
              <span
                title="Overwatch aktivní"
                className="flex items-center gap-0.5 text-[9px] font-bold px-1 rounded bg-sky-500/30 text-sky-200 border border-sky-400/50"
              >
                <Eye className="w-2.5 h-2.5" />
                OW
              </span>
            )}

            {!isPlayer && targetEval && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${
                  targetEval.calculation.isFlanked
                    ? "bg-amber-500/30 text-amber-200 border-amber-400/60"
                    : "bg-red-500/30 text-red-200 border-red-400/50"
                }`}
              >
                {targetEval.calculation.hitChance}%
              </span>
            )}
          </div>

          {/* Řádek ukazatelů: Zbroj (Kyrys) + Životy (HP) s blikajícím náhledem ztráty + AP */}
          <div className="flex flex-col gap-0.5 w-full">
            {/* Ukazatel zbroje (kyrysu/přilby) — při zaměření blikají body zbroje, o které cíl přijde */}
            {unit.maxArmor > 0 && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase tracking-wider text-amber-300/90 mr-0.5">
                    ZBROJ
                  </span>
                  {Array.from({ length: unit.maxArmor }, (_, i) => {
                    const hasArmor = i < unit.armor;
                    const willLoseArmor =
                      isTargeted &&
                      hasArmor &&
                      i >= Math.max(0, unit.armor - previewArmorLoss);
                    return (
                      <span
                        key={i}
                        title={
                          willLoseArmor
                            ? "Tento bod zbroje bude výstřelem zničen (Armor Shred)"
                            : "Bod zbroje (kyrys / přilba)"
                        }
                        className={`w-2.5 h-2 rounded-[2px] border transition-colors ${
                          willLoseArmor
                            ? "bg-amber-300 border-white animate-pulse shadow-[0_0_6px_#fde047]"
                            : hasArmor
                              ? "bg-amber-400 border-amber-200"
                              : "bg-slate-800/90 border-slate-600"
                        }`}
                      />
                    );
                  })}
                </div>

                {/* AP body */}
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: unit.maxAp }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor:
                          i < unit.ap ? baseColor : "transparent",
                      }}
                      className="w-1.5 h-1.5 rounded-full border border-amber-300/80"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ukazatel zdraví (HP kostičky) — při zaměření bliká rozsah životů, o které cíl přijde */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-300 mr-0.5">
                  HP
                </span>
                {Array.from({ length: unit.maxHp }, (_, i) => {
                  const filled = i < unit.hp;
                  const guaranteedLossStart = Math.max(
                    0,
                    unit.hp - previewHpLossMin,
                  );
                  const maxLossStart = Math.max(0, unit.hp - previewHpLossMax);
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
                              : "bg-slate-800 border-slate-600"
                      }`}
                    />
                  );
                })}
              </div>

              {isTargeted && targetEval && (
                <span className="text-[9px] font-extrabold text-amber-300 animate-pulse whitespace-nowrap">
                  −{previewHpLossMin}..{previewHpLossMax} HP
                </span>
              )}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
