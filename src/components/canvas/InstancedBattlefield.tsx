/**
 * Performance-First Instanced 3D Battlefield (/src/components/canvas/InstancedBattlefield.tsx).
 * Renders floor tiles, obstacles (low walls, high walls, pillars), and Blue/Yellow
 * movement range zones using THREE.InstancedMesh with Roof/Floor Cutaway support.
 */

import { Html, Line } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { Shield, ShieldAlert, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { gridDistance3D } from "../../core/CombatSystem";
import { bestTileCover } from "../../core/GridSystem";
import type { FloorLevel, GridCoord, TileData } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { FLOOR_HEIGHT, gridToWorld, TILE_SIZE } from "./worldCoords";

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const SMOKE_PUFF_GEO = new THREE.SphereGeometry(1, 10, 10);

export function InstancedBattlefield() {
  const grid = useGameStore((s) => s.grid);
  const gridVersion = useGameStore((s) => s.gridVersion);
  const smokeVersion = useGameStore((s) => s.smokeVersion);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const reachableTiles = useGameStore((s) => s.reachableTiles);
  const hoveredTile = useGameStore((s) => s.hoveredTile);
  const hoveredPath = useGameStore((s) => s.hoveredPath);
  const actionMode = useGameStore((s) => s.actionMode);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const units = useGameStore((s) => s.units);
  const setHoveredTile = useGameStore((s) => s.setHoveredTile);
  const handleTileClick = useGameStore((s) => s.handleTileClick);

  const groundFloorTiles = useMemo(() => grid.getFloorTiles(0), [grid, gridVersion]);
  const upperFloorTiles = useMemo(() => grid.getFloorTiles(1), [grid, gridVersion]);
  const smokeTiles = useMemo(
    () => {
      void smokeVersion;
      return grid.getSmokeTiles();
    },
    [grid, smokeVersion],
  );

  // Separate obstacles by floor and type for InstancedMesh rendering + Roof Cutaway
  const obstacles = useMemo(() => {
    void gridVersion;
    const low0: TileData[] = [];
    const high0: TileData[] = [];
    const pillar0: TileData[] = [];
    const kegs0: TileData[] = [];
    const low1: TileData[] = [];
    const pillar1: TileData[] = [];
    const ladders: TileData[] = [];

    for (const t of grid.getAllTiles()) {
      if (!t.hasFloor) continue;
      if (t.coord.y === 0 && t.isLadder) ladders.push(t);
      if (t.coord.y === 0) {
        if (t.obstacle === "low_wall") low0.push(t);
        else if (t.obstacle === "high_wall") high0.push(t);
        else if (t.obstacle === "pillar") pillar0.push(t);
        else if (t.obstacle === "powder_keg") kegs0.push(t);
      } else {
        if (t.obstacle === "low_wall") low1.push(t);
        else if (t.obstacle === "pillar" || t.obstacle === "high_wall")
          pillar1.push(t);
      }
    }
    return { low0, high0, pillar0, kegs0, low1, pillar1, ladders };
  }, [grid, gridVersion]);

  // Refs for InstancedMeshes
  const groundMeshRef = useRef<THREE.InstancedMesh>(null);
  const upperMeshRef = useRef<THREE.InstancedMesh>(null);
  const low0MeshRef = useRef<THREE.InstancedMesh>(null);
  const high0MeshRef = useRef<THREE.InstancedMesh>(null);
  const pillar0MeshRef = useRef<THREE.InstancedMesh>(null);
  const kegs0MeshRef = useRef<THREE.InstancedMesh>(null);
  const low1MeshRef = useRef<THREE.InstancedMesh>(null);
  const pillar1MeshRef = useRef<THREE.InstancedMesh>(null);
  const zoneMeshRef = useRef<THREE.InstancedMesh>(null);

  // Populate Ground Floor (y = 0) InstancedMesh
  useEffect(() => {
    const mesh = groundMeshRef.current;
    if (!mesh) return;
    groundFloorTiles.forEach((tile, i) => {
      const [wx, wy, wz] = gridToWorld(tile.coord);
      const isWater = tile.surface === "water";
      _dummy.position.set(wx, wy + (isWater ? -0.22 : -0.08), wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      const checker = (tile.coord.x + tile.coord.z) % 2 === 0;
      if (tile.isLadder) {
        _color.setHex(0x92400e);
      } else if (tile.surface === "water") {
        _color.setHex(checker ? 0x0c4a6e : 0x075985);
      } else if (tile.surface === "wood_dock") {
        _color.setHex(checker ? 0xb45309 : 0x92400e);
      } else if (tile.surface === "stone_floor") {
        _color.setHex(checker ? 0x475569 : 0x3f4c5e);
      } else if (tile.surface === "rubble") {
        _color.setHex(0x57534e);
      } else {
        _color.setHex(checker ? 0x2c3440 : 0x252c37);
      }
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [groundFloorTiles]);

  // Populate Upper Floor (y = 1) InstancedMesh
  useEffect(() => {
    const mesh = upperMeshRef.current;
    if (!mesh) return;
    upperFloorTiles.forEach((tile, i) => {
      const [wx, wy, wz] = gridToWorld(tile.coord);
      _dummy.position.set(wx, wy - 0.08, wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      const checker = (tile.coord.x + tile.coord.z) % 2 === 0;
      if (tile.isLadder) {
        _color.setHex(0xb45309);
      } else {
        _color.setHex(checker ? 0x6b4c35 : 0x5c402c);
      }
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [upperFloorTiles]);

  // Populate Obstacles InstancedMeshes
  useEffect(() => {
    const populate = (
      mesh: THREE.InstancedMesh | null,
      list: TileData[],
      heightOffset: number,
    ) => {
      if (!mesh) return;
      mesh.count = list.length;
      list.forEach((tile, i) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        _dummy.position.set(wx, wy + heightOffset, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    populate(low0MeshRef.current, obstacles.low0, 0.42);
    populate(high0MeshRef.current, obstacles.high0, FLOOR_HEIGHT * 0.5);
    populate(pillar0MeshRef.current, obstacles.pillar0, FLOOR_HEIGHT * 0.5);
    populate(kegs0MeshRef.current, obstacles.kegs0, 0.36);
    populate(low1MeshRef.current, obstacles.low1, 0.42);
    populate(pillar1MeshRef.current, obstacles.pillar1, 1.0);
  }, [obstacles]);

  // Populate Reachable Movement Zones (Blue Zone = 1 AP, Yellow Zone = 2 AP Sprint)
  const reachableList = useMemo(
    () => Array.from(reachableTiles.values()),
    [reachableTiles],
  );

  useEffect(() => {
    const mesh = zoneMeshRef.current;
    if (!mesh) return;

    if (actionMode !== "move") {
      mesh.count = 0;
      return;
    }

    mesh.count = reachableList.length;
    reachableList.forEach((item, i) => {
      const [wx, wy, wz] = gridToWorld(item.coord);
      _dummy.position.set(wx, wy + 0.025, wz);
      _dummy.rotation.set(-Math.PI * 0.5, 0, 0);
      // Slightly dim upper floor highlights when viewing Floor 0
      const scale = item.coord.y > activeFloor ? 0.72 : 0.88;
      _dummy.scale.set(scale, scale, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      if (item.zone === "blue") {
        _color.setHex(0x38bdf8); // Blue 1 AP Move Zone
      } else {
        _color.setHex(0xfacc15); // Yellow 2 AP Sprint/Dash Zone
      }
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [reachableList, actionMode, activeFloor]);

  // Pointer handlers for Instanced Floor Meshes
  const onFloorPointerMove = (
    e: ThreeEvent<PointerEvent>,
    tiles: TileData[],
    floor: FloorLevel,
  ) => {
    if (floor > activeFloor) return;
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx === undefined) return;
    const tile = tiles[idx];
    if (tile) setHoveredTile(tile.coord);
  };

  const onFloorClick = (
    e: ThreeEvent<MouseEvent>,
    tiles: TileData[],
    floor: FloorLevel,
  ) => {
    if (floor > activeFloor) return;
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx === undefined) return;
    const tile = tiles[idx];
    if (tile) handleTileClick(tile.coord);
  };

  // A* Path Preview Points
  const pathPoints = useMemo(() => {
    const selectedUnit = units.find((u) => u.id === selectedUnitId);
    if (!selectedUnit || hoveredPath.length === 0) return null;
    const coords: GridCoord[] = [selectedUnit.pos, ...hoveredPath];
    return coords.map((c) => {
      const [wx, wy, wz] = gridToWorld(c);
      return [wx, wy + 0.14, wz] as [number, number, number];
    });
  }, [units, selectedUnitId, hoveredPath]);

  const hoveredReachable = useMemo(() => {
    if (!hoveredTile) return null;
    return (
      reachableTiles.get(
        `${hoveredTile.x},${hoveredTile.y},${hoveredTile.z}`,
      ) ?? null
    );
  }, [hoveredTile, reachableTiles]);

  const hoveredTileCover = useMemo(() => {
    if (!hoveredTile) return "none";
    const t = grid.getTile(hoveredTile);
    return t ? bestTileCover(t.cover) : "none";
  }, [grid, hoveredTile, gridVersion]);

  const upperCutaway = activeFloor === 0;
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const canThrowGrenadeHere =
    actionMode === "grenade" &&
    hoveredTile &&
    selectedUnit &&
    gridDistance3D(selectedUnit.pos, hoveredTile) <= 8;

  return (
    <group onPointerOut={() => setHoveredTile(null)}>
      {/* 1. Ground Floor (y = 0) Instanced Tiles */}
      <instancedMesh
        ref={groundMeshRef}
        args={[undefined, undefined, groundFloorTiles.length]}
        receiveShadow
        onPointerMove={(e) => onFloorPointerMove(e, groundFloorTiles, 0)}
        onClick={(e) => onFloorClick(e, groundFloorTiles, 0)}
      >
        <boxGeometry args={[TILE_SIZE * 0.96, 0.16, TILE_SIZE * 0.96]} />
        <meshStandardMaterial roughness={0.78} metalness={0.12} />
      </instancedMesh>

      {/* 2. Upper Floor (y = 1) Instanced Tiles with Roof Cutaway */}
      <instancedMesh
        ref={upperMeshRef}
        args={[undefined, undefined, upperFloorTiles.length]}
        castShadow={!upperCutaway}
        receiveShadow
        raycast={upperCutaway ? () => null : undefined}
        onPointerMove={(e) => onFloorPointerMove(e, upperFloorTiles, 1)}
        onClick={(e) => onFloorClick(e, upperFloorTiles, 1)}
      >
        <boxGeometry args={[TILE_SIZE * 0.96, 0.16, TILE_SIZE * 0.96]} />
        <meshStandardMaterial
          roughness={0.7}
          metalness={0.1}
          transparent={upperCutaway}
          opacity={upperCutaway ? 0.14 : 1}
          depthWrite={!upperCutaway}
        />
      </instancedMesh>

      {/* 3. Ground Floor Low Walls (Half Cover) */}
      <instancedMesh
        ref={low0MeshRef}
        args={[undefined, undefined, 64]}
        count={obstacles.low0.length}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TILE_SIZE * 0.86, 0.84, TILE_SIZE * 0.86]} />
        <meshStandardMaterial color="#78716c" roughness={0.82} metalness={0.08} />
      </instancedMesh>

      {/* 4. Ground Floor High Walls (Full Cover & LoS Blocker) */}
      <instancedMesh
        ref={high0MeshRef}
        args={[undefined, undefined, 64]}
        count={obstacles.high0.length}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TILE_SIZE * 0.96, FLOOR_HEIGHT, TILE_SIZE * 0.96]} />
        <meshStandardMaterial color="#64748b" roughness={0.75} metalness={0.12} />
      </instancedMesh>

      {/* 5. Ground Floor Stone Pillars */}
      <instancedMesh
        ref={pillar0MeshRef}
        args={[undefined, undefined, 32]}
        count={obstacles.pillar0.length}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.46, 0.54, FLOOR_HEIGHT, 12]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.2} />
      </instancedMesh>

      {/* 5b. Ground Floor Explosive Powder Kegs (Sudy s černým prachem) */}
      <instancedMesh
        ref={kegs0MeshRef}
        args={[undefined, undefined, 16]}
        count={obstacles.kegs0.length}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.34, 0.32, 0.72, 12]} />
        <meshStandardMaterial
          color="#854d0e"
          roughness={0.65}
          metalness={0.25}
        />
      </instancedMesh>

      {/* 6. Upper Floor Obstacles (Cutaway-aware) */}
      <instancedMesh
        ref={low1MeshRef}
        args={[undefined, undefined, 32]}
        count={obstacles.low1.length}
        castShadow={!upperCutaway}
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[TILE_SIZE * 0.85, 0.84, TILE_SIZE * 0.85]} />
        <meshStandardMaterial
          color="#a8a29e"
          roughness={0.75}
          transparent={upperCutaway}
          opacity={upperCutaway ? 0.14 : 1}
          depthWrite={!upperCutaway}
        />
      </instancedMesh>

      <instancedMesh
        ref={pillar1MeshRef}
        args={[undefined, undefined, 32]}
        count={obstacles.pillar1.length}
        castShadow={!upperCutaway}
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.42, 0.48, 2.0, 12]} />
        <meshStandardMaterial
          color="#94a3b8"
          roughness={0.65}
          transparent={upperCutaway}
          opacity={upperCutaway ? 0.14 : 1}
          depthWrite={!upperCutaway}
        />
      </instancedMesh>

      {/* 7. Reachable Movement Zone Tiles (Blue = 1 AP, Yellow = 2 AP Sprint) */}
      <instancedMesh
        ref={zoneMeshRef}
        args={[undefined, undefined, 512]}
        raycast={() => null}
      >
        <planeGeometry args={[TILE_SIZE * 0.88, TILE_SIZE * 0.88]} />
        <meshBasicMaterial
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 8. 3D Wooden Ladders connecting y=0 and y=1 */}
      {obstacles.ladders.map((ladderTile) => {
        const [wx, , wz] = gridToWorld(ladderTile.coord);
        return (
          <group key={`ladder-${ladderTile.coord.x}-${ladderTile.coord.z}`} position={[wx, 0, wz]}>
            {/* Left & Right Rails */}
            <mesh position={[-0.32, FLOOR_HEIGHT * 0.5, -0.35]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, FLOOR_HEIGHT + 0.3, 8]} />
              <meshStandardMaterial color="#d97706" roughness={0.6} />
            </mesh>
            <mesh position={[0.32, FLOOR_HEIGHT * 0.5, -0.35]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, FLOOR_HEIGHT + 0.3, 8]} />
              <meshStandardMaterial color="#d97706" roughness={0.6} />
            </mesh>
            {/* Rungs */}
            {[0.35, 0.75, 1.15, 1.55, 1.95, 2.35].map((ry) => (
              <mesh
                key={ry}
                position={[0, ry, -0.35]}
                rotation={[0, 0, Math.PI * 0.5]}
                castShadow
              >
                <cylinderGeometry args={[0.035, 0.035, 0.68, 8]} />
                <meshStandardMaterial color="#f59e0b" roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* 8b. 3D Rybářská pramice (Fisherman's Skiff at Čertovka - Cíl úniku) */}
      {(() => {
        const [bx, by, bz] = gridToWorld({ x: 0.75 as any, y: 0, z: 2.0 as any });
        return (
          <group position={[bx, by - 0.05, bz]} rotation={[0, 0.25, 0]}>
            {/* Wooden Boat Hull */}
            <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.42, 2.2]} />
              <meshStandardMaterial color="#5c3821" roughness={0.8} />
            </mesh>
            {/* Inner Hollow */}
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[0.74, 0.36, 1.95]} />
              <meshStandardMaterial color="#3d2414" roughness={0.9} />
            </mesh>
            {/* Wooden Benches */}
            <mesh position={[0, 0.22, 0.32]}>
              <boxGeometry args={[0.74, 0.08, 0.22]} />
              <meshStandardMaterial color="#78472a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.22, -0.42]}>
              <boxGeometry args={[0.74, 0.08, 0.22]} />
              <meshStandardMaterial color="#78472a" roughness={0.7} />
            </mesh>
            {/* Oars */}
            <mesh position={[0.44, 0.3, 0]} rotation={[0.2, 0, -0.38]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 1.7, 6]} />
              <meshStandardMaterial color="#b45309" roughness={0.6} />
            </mesh>
            {/* Bow Lantern */}
            <group position={[0, 0.42, 1.05]}>
              <mesh>
                <boxGeometry args={[0.12, 0.18, 0.12]} />
                <meshStandardMaterial color="#f59e0b" emissive="#fbbf24" emissiveIntensity={1.8} />
              </mesh>
              <pointLight color="#f59e0b" intensity={2.5} distance={4} />
            </group>
            {/* Glowing Escape Zone Beacon Ring on Water */}
            <mesh position={[0, -0.04, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
              <ringGeometry args={[1.1, 1.35, 24]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.65} side={THREE.DoubleSide} />
            </mesh>
            {/* 3D In-World Tag */}
            <Html center position={[0, 1.15, 0]} distanceFactor={18} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
              <div className="pointer-events-none select-none flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/90 border border-emerald-400 text-emerald-300 font-serif font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.5)] backdrop-blur-md whitespace-nowrap animate-pulse">
                <span>⛵</span>
                <span>Rybářská pramice (Cíl úniku)</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* 9. 3D Black Powder Smoke Clouds (Kouř z černého prachu: -20 % k zásahu) */}
      {smokeTiles.map((smokeTile) => {
        const [wx, wy, wz] = gridToWorld(smokeTile.coord);
        const dim = smokeTile.coord.y > activeFloor ? 0.12 : 0.34;
        return (
          <group
            key={`smoke-${smokeTile.coord.x}-${smokeTile.coord.y}-${smokeTile.coord.z}`}
            position={[wx, wy, wz]}
          >
            <mesh position={[-0.18, 0.55, 0.12]} scale={[0.58, 0.58, 0.58]} geometry={SMOKE_PUFF_GEO}>
              <meshStandardMaterial
                color="#cbd5e1"
                roughness={1}
                transparent
                opacity={dim}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0.24, 0.78, -0.16]} scale={[0.48, 0.48, 0.48]} geometry={SMOKE_PUFF_GEO}>
              <meshStandardMaterial
                color="#94a3b8"
                roughness={1}
                transparent
                opacity={dim * 0.9}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0.04, 1.05, 0.08]} scale={[0.4, 0.4, 0.4]} geometry={SMOKE_PUFF_GEO}>
              <meshStandardMaterial
                color="#e2e8f0"
                roughness={1}
                transparent
                opacity={dim * 0.75}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* 10. Hovered Tile Cursor & 3x3 Grenade AoE Preview & Dynamic Tile Cover Preview */}
      {hoveredTile && (
        <group position={gridToWorld(hoveredTile)}>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
            <ringGeometry args={[TILE_SIZE * 0.38, TILE_SIZE * 0.46, 4]} />
            <meshBasicMaterial
              color={
                actionMode === "grenade"
                  ? canThrowGrenadeHere
                    ? "#f97316"
                    : "#ef4444"
                  : hoveredReachable?.zone === "yellow"
                    ? "#facc15"
                    : "#38bdf8"
              }
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* In-World XCOM-style Tile Hover Indicator (Cover Shield + AP badge) */}
          {actionMode === "move" && hoveredReachable && (
            <Html
              center
              position={[0, 0.65, 0]}
              distanceFactor={18}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "none" }}
              className="pointer-events-none select-none"
            >
              <div className="pointer-events-none select-none flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-amber-500/50 backdrop-blur-md shadow-xl text-slate-100 whitespace-nowrap">
                {/* Cover Shield Icon */}
                {hoveredTileCover === "full" ? (
                  <span className="flex items-center gap-1 text-sky-400 font-extrabold text-[10px]">
                    <Shield className="w-3.5 h-3.5 fill-current" />
                    <span>PLNÝ</span>
                  </span>
                ) : hoveredTileCover === "half" ? (
                  <span className="flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>POLOVIČNÍ</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <ShieldOff className="w-3.5 h-3.5" />
                    <span>NEKRYTÝ</span>
                  </span>
                )}

                <span className="text-slate-600">·</span>

                {/* AP cost */}
                <span
                  className={`text-[10px] font-mono font-black ${
                    hoveredReachable.zone === "yellow"
                      ? "text-amber-400"
                      : "text-sky-300"
                  }`}
                >
                  {hoveredReachable.zone === "yellow" ? "2 AP SPRINT" : "1 AP"}
                </span>
              </div>
            </Html>
          )}

          {canThrowGrenadeHere && (
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
              <planeGeometry args={[TILE_SIZE * 3, TILE_SIZE * 3]} />
              <meshBasicMaterial
                color="#f97316"
                transparent
                opacity={0.28}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      )}

      {/* 10. A* Path Preview Ribbon */}
      {pathPoints && pathPoints.length >= 2 && (
        <Line
          points={pathPoints}
          color={hoveredReachable?.zone === "yellow" ? "#facc15" : "#38bdf8"}
          lineWidth={3.5}
        />
      )}
    </group>
  );
}
