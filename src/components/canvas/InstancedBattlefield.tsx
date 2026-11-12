/**
 * Performance-First Instanced 3D Battlefield (/src/components/canvas/InstancedBattlefield.tsx).
 * Enforces the Baroque Art Direction Constitution (ADR 0007) & Multi-Floor Clarity:
 * 1. Calm, low-contrast ground tiles (slate, mud, palace limestone parquet, royal carpet, dark river water)
 *    so the tactical grid and movement zones remain 100% legible across all 3 floors (P0, P1, P2).
 * 2. Floor-Focused Cutaway & Depth Separation:
 *    - Viewing P0 hides upper floor slabs (opacity 0.04) so ground interiors are 100% unobstructed.
 *    - Viewing P1 or P2 dims lower floors (68% brightness) so elevated galleries and watchtowers pop out.
 *    - Movement zones (Blue 1 AP / Gold 2 AP) only render in full on the active/previewed floor (`effectiveViewFloor`),
 *      preventing double-layered parallax grid clutter.
 * 3. Interactive 3D Staircase Portals (`BaroqueStraightStaircase`, `BaroqueSpiralStaircase` + diegetic badges):
 *    - Hovering a staircase previews the A* path AND temporarily reveals the target floor (`effectiveViewFloor`)!
 *    - Clicking a reachable staircase walks the unit directly up/down; clicking its eye icon switches camera floor.
 */

import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { ArrowDown, ArrowUp, DoorClosed, DoorOpen, Eye, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { text, useLocale } from "../../i18n";
import * as THREE from "three";
import { gridDistance3D } from "../../core/CombatSystem";
import {
  getTileVisibility,
  previewReconFromTile,
} from "../../core/FogOfWar";
import {
  coordKey,
  getMission1EscapeTile,
  getMission1TutorialBeacon,
  resolvePreferredFloorCoord,
  sameCoord,
} from "../../core/GridSystem";
import { getGuidedTutorialBeacon } from "../../core/GuidedTutorialSystem";
import {
  doorMeshForwardsClick,
  stairClickChangesFloor,
} from "../../core/inspectClick";
import type {
  CardinalDir,
  DoorData,
  FloorLevel,
  FogVisibilityState,
  GridCoord,
  StairType,
  TileData,
} from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { BaroqueCoverBadge } from "../ui/BaroqueCoverBadge";
import { wasRecentRightCameraPan } from "./TacticalCamera";
import { WorldHtml } from "./WorldHtml";
import { continuousGridToWorld, FLOOR_HEIGHT, gridToWorld, TILE_SIZE } from "./worldCoords";

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _shroudTint = new THREE.Color(0x161d29);
const _unexploredTint = new THREE.Color(0x06090f);
const SMOKE_PUFF_GEO = new THREE.SphereGeometry(1, 12, 10);

interface StairSpan {
  x: number;
  z: number;
  fromFloor: FloorLevel;
  toFloor: FloorLevel;
  stairType: StairType;
  stairDir: CardinalDir;
  inPalace: boolean;
}

function stairDirRotationY(dir: CardinalDir): number {
  switch (dir) {
    case "N":
      return 0;
    case "S":
      return Math.PI;
    case "E":
      return -Math.PI * 0.5;
    case "W":
      return Math.PI * 0.5;
  }
}

function TutorialWaypointBeacon({
  coord,
  label,
  accentColor = "#fbbf24",
}: {
  coord: GridCoord;
  label: string;
  accentColor?: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 3.5) * 0.12;
      ringRef.current.scale.set(s, s, 1);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.65 + Math.sin(t * 3.5) * 0.25;
    }
    if (outerRingRef.current) {
      const s = 1 + Math.cos(t * 2) * 0.18;
      outerRingRef.current.scale.set(s, s, 1);
    }
  });

  const [wx, wy, wz] = gridToWorld(coord);

  return (
    <group position={[wx, wy, wz]}>
      <mesh
        ref={ringRef}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI * 0.5, 0, 0]}
      >
        <ringGeometry args={[TILE_SIZE * 0.32, TILE_SIZE * 0.44, 24]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={outerRingRef}
        position={[0, 0.045, 0]}
        rotation={[-Math.PI * 0.5, 0, 0]}
      >
        <ringGeometry args={[TILE_SIZE * 0.48, TILE_SIZE * 0.52, 24]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <WorldHtml
        center
        position={[0, 1.35, 0]}
        distanceFactor={18}
        zIndexRange={[15, 0]}
        style={{ pointerEvents: "none" }}
        className="pointer-events-none select-none"
      >
        <div className="pointer-events-none select-none flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/95 border border-amber-400 backdrop-blur-md shadow-[0_0_15px_rgba(251,191,36,0.5)] text-slate-100 whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-black text-amber-300 tracking-wide uppercase font-cinzel">
            {label}
          </span>
        </div>
      </WorldHtml>
    </group>
  );
}



/**
 * 3D Monumentální císařské schodiště (Imperial Grand Staircase - `grand_stairs`)
 * Zabírá více polí (x: 11..12, z: 22..24) a propojuje P0 s Piano Nobile (P1).
 * Obsahuje 14 pískovcových stupňů, kardinálský sametový běhoun se zlatým kováním,
 * masivní boční poprsnice a profilované balustrády s kuželkami a zlacenými koulemi na patkách.
 */
function BaroqueImperialGrandStaircase({
  span,
  opacity,
  isHighlighted,
  onHover,
  onClick,
  onContextMenu,
}: {
  span: StairSpan;
  opacity: number;
  isHighlighted: boolean;
  onHover: (e: ThreeEvent<PointerEvent>, span: StairSpan) => void;
  onClick: (e: ThreeEvent<MouseEvent>, span: StairSpan) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>, span: StairSpan) => void;
}) {
  const [wx1, wy] = gridToWorld({ x: 11, y: span.fromFloor, z: 22 });
  const [wx2, , wz2] = gridToWorld({ x: 12, y: span.fromFloor, z: 23 });
  const centerX = (wx1 + wx2) * 0.5;
  const centerZ = wz2;
  const isTransparent = opacity < 0.99;
  const stepCount = 14;
  const stairWidth = TILE_SIZE * 2.15;
  const stairLength = TILE_SIZE * 2.2;
  const stoneColor = isHighlighted ? "#a89882" : "#7d7267";
  const railColor = "#9c8b7a";
  const accentColor = isHighlighted ? "#facc15" : "#d4a73f";

  return (
    <group
      position={[centerX, wy, centerZ]}
      onPointerMove={(e) => onHover(e, span)}
      onClick={(e) => onClick(e, span)}
      onContextMenu={(e) => onContextMenu(e, span)}
    >
      {/* Masivní pískovcový sokl pod schodištěm */}
      <mesh position={[0, 0.04, 0]} castShadow={!isTransparent} receiveShadow raycast={() => null}>
        <boxGeometry args={[stairWidth + 0.3, 0.08, stairLength + 0.25]} />
        <meshStandardMaterial color="#5e554d" roughness={0.78} transparent={isTransparent} opacity={opacity} />
      </mesh>

      {/* Boční pískovcové poprsnice s balustrádami a patkami */}
      {[-stairWidth * 0.51, stairWidth * 0.51].map((sx, idx) => (
        <group key={`imp-stringer-${idx}`}>
          <mesh
            position={[sx, FLOOR_HEIGHT * 0.48, 0]}
            rotation={[Math.PI * 0.34, 0, 0]}
            castShadow={!isTransparent}
            raycast={() => null}
          >
            <boxGeometry args={[0.18, 0.28, FLOOR_HEIGHT * 1.25]} />
            <meshStandardMaterial color={railColor} roughness={0.65} transparent={isTransparent} opacity={opacity} />
          </mesh>
          <mesh
            position={[sx, FLOOR_HEIGHT * 0.72, 0]}
            rotation={[Math.PI * 0.34, 0, 0]}
            castShadow={!isTransparent}
            raycast={() => null}
          >
            <boxGeometry args={[0.16, 0.12, FLOOR_HEIGHT * 1.25]} />
            <meshStandardMaterial
              color={accentColor}
              metalness={0.55}
              roughness={0.4}
              transparent={isTransparent}
              opacity={opacity}
            />
          </mesh>

          {/* Sloupek u nástupu v přízemí */}
          <mesh position={[sx, 0.48, stairLength * 0.48]} castShadow={!isTransparent} raycast={() => null}>
            <boxGeometry args={[0.26, 0.88, 0.26]} />
            <meshStandardMaterial color={railColor} roughness={0.6} transparent={isTransparent} opacity={opacity} />
          </mesh>
          <mesh position={[sx, 0.98, stairLength * 0.48]} castShadow={!isTransparent} raycast={() => null}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color={accentColor} metalness={0.7} roughness={0.28} transparent={isTransparent} opacity={opacity} />
          </mesh>

          {/* Sloupek u výstupu v Piano Nobile */}
          <mesh position={[sx, FLOOR_HEIGHT + 0.45, -stairLength * 0.48]} castShadow={!isTransparent} raycast={() => null}>
            <boxGeometry args={[0.24, 0.82, 0.24]} />
            <meshStandardMaterial color={railColor} roughness={0.6} transparent={isTransparent} opacity={opacity} />
          </mesh>
          <mesh position={[sx, FLOOR_HEIGHT + 0.92, -stairLength * 0.48]} castShadow={!isTransparent} raycast={() => null}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={accentColor} metalness={0.7} roughness={0.28} transparent={isTransparent} opacity={opacity} />
          </mesh>
        </group>
      ))}

      {/* 14 pískovcových stupňů stoupajících z přízemí nahoru */}
      {Array.from({ length: stepCount }, (_, i) => {
        const frac = (i + 0.5) / stepCount;
        const sy = frac * (FLOOR_HEIGHT - 0.1) + 0.08;
        const sz = stairLength * 0.48 - frac * (stairLength * 0.96);
        return (
          <group key={`imp-step-${i}`} position={[0, sy, sz]}>
            {/* Kamenný stupeň */}
            <mesh castShadow={!isTransparent} receiveShadow raycast={() => null}>
              <boxGeometry args={[stairWidth, 0.16, stairLength / stepCount + 0.05]} />
              <meshStandardMaterial color={stoneColor} roughness={0.7} transparent={isTransparent} opacity={opacity} />
            </mesh>

            {/* Královský kardinálský sametový běhoun */}
            <mesh position={[0, 0.085, 0]} raycast={() => null}>
              <boxGeometry args={[stairWidth * 0.62, 0.025, stairLength / stepCount + 0.06]} />
              <meshStandardMaterial color="#6b1d24" roughness={0.85} transparent={isTransparent} opacity={opacity} />
            </mesh>

            {/* Zlacená mosazná kobercová tyč */}
            <mesh position={[0, 0.092, (stairLength / stepCount) * 0.42]} rotation={[0, 0, Math.PI * 0.5]} raycast={() => null}>
              <cylinderGeometry args={[0.016, 0.016, stairWidth * 0.65, 8]} />
              <meshStandardMaterial color="#d4a73f" metalness={0.85} roughness={0.22} transparent={isTransparent} opacity={opacity} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * 3D Baroque Straight Staircase (`straight_stairs`) with 8 carved stone steps,
 * twin diagonal stringer beams, side balustrades, newel spheres, and cardinal carpet runner in the palace.
 */
function BaroqueStraightStaircase({
  span,
  opacity,
  isHighlighted,
  onHover,
  onClick,
  onContextMenu,
}: {
  span: StairSpan;
  opacity: number;
  isHighlighted: boolean;
  onHover: (e: ThreeEvent<PointerEvent>, span: StairSpan) => void;
  onClick: (e: ThreeEvent<MouseEvent>, span: StairSpan) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>, span: StairSpan) => void;
}) {
  const [wx, wy, wz] = gridToWorld({
    x: span.x,
    y: span.fromFloor,
    z: span.z,
  });
  const rotY = stairDirRotationY(span.stairDir);
  const isTransparent = opacity < 0.99;
  const stepCount = 8;
  const stoneColor = isHighlighted
    ? "#a89882"
    : span.inPalace
      ? "#7d7267"
      : "#696158";
  const railColor = span.inPalace ? "#9c8b7a" : "#787067";
  const accentColor = isHighlighted
    ? "#facc15"
    : span.inPalace
      ? "#d4a73f"
      : "#91867a";

  return (
    <group
      position={[wx, wy, wz]}
      rotation={[0, rotY, 0]}
      onPointerMove={(e) => onHover(e, span)}
      onClick={(e) => onClick(e, span)}
      onContextMenu={(e) => onContextMenu(e, span)}
    >
      {/* Twin diagonal stone stringers */}
      {[-0.44, 0.44].map((sx, idx) => (
        <group key={`stringer-${idx}`}>
          <mesh
            position={[sx, FLOOR_HEIGHT * 0.48, 0]}
            rotation={[Math.PI * 0.33, 0, 0]}
            castShadow={!isTransparent}
          >
            <boxGeometry args={[0.09, 0.18, FLOOR_HEIGHT * 1.12]} />
            <meshStandardMaterial
              color={railColor}
              roughness={0.68}
              transparent={isTransparent}
              opacity={opacity}
            />
          </mesh>
          <mesh
            position={[sx, FLOOR_HEIGHT * 0.64, 0]}
            rotation={[Math.PI * 0.33, 0, 0]}
            castShadow={!isTransparent}
          >
            <boxGeometry args={[0.08, 0.08, FLOOR_HEIGHT * 1.12]} />
            <meshStandardMaterial
              color={accentColor}
              metalness={span.inPalace || isHighlighted ? 0.55 : 0.2}
              roughness={0.42}
              transparent={isTransparent}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[sx, 0.36, 0.52]} castShadow={!isTransparent}>
            <boxGeometry args={[0.13, 0.64, 0.13]} />
            <meshStandardMaterial
              color={railColor}
              roughness={0.6}
              transparent={isTransparent}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[sx, 0.74, 0.52]} castShadow={!isTransparent}>
            <sphereGeometry args={[0.085, 10, 10]} />
            <meshStandardMaterial
              color={accentColor}
              metalness={0.65}
              roughness={0.32}
              transparent={isTransparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      ))}

      {/* 8 carved stone steps ascending from +Z to -Z */}
      {Array.from({ length: stepCount }, (_, i) => {
        const frac = (i + 0.5) / stepCount;
        const sy = frac * (FLOOR_HEIGHT - 0.12) + 0.08;
        const sz = 0.52 - frac * 1.04;
        return (
          <group key={`step-${i}`} position={[0, sy, sz]}>
            <mesh castShadow={!isTransparent} receiveShadow raycast={() => null}>
              <boxGeometry args={[0.82, 0.14, 0.18]} />
              <meshStandardMaterial
                color={stoneColor}
                roughness={0.72}
                transparent={isTransparent}
                opacity={opacity}
              />
            </mesh>
            {span.inPalace && (
              <>
                <mesh position={[0, 0.075, 0]} raycast={() => null}>
                  <boxGeometry args={[0.48, 0.02, 0.185]} />
                  <meshStandardMaterial
                    color="#6b1d24"
                    roughness={0.82}
                    transparent={isTransparent}
                    opacity={opacity}
                  />
                </mesh>
                <mesh
                  position={[0, 0.082, 0.07]}
                  rotation={[0, 0, Math.PI * 0.5]}
                  raycast={() => null}
                >
                  <cylinderGeometry args={[0.012, 0.012, 0.52, 6]} />
                  <meshStandardMaterial
                    color="#d4a73f"
                    metalness={0.8}
                    roughness={0.25}
                    transparent={isTransparent}
                    opacity={opacity}
                  />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * 3D Baroque Spiral Staircase (`spiral_stairs`) with a central stone newel column,
 * 10 helical wedge treads spiraling 297°, and wrought-iron outer balusters.
 */
function BaroqueSpiralStaircase({
  span,
  opacity,
  isHighlighted,
  onHover,
  onClick,
  onContextMenu,
}: {
  span: StairSpan;
  opacity: number;
  isHighlighted: boolean;
  onHover: (e: ThreeEvent<PointerEvent>, span: StairSpan) => void;
  onClick: (e: ThreeEvent<MouseEvent>, span: StairSpan) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>, span: StairSpan) => void;
}) {
  const [wx, wy, wz] = gridToWorld({
    x: span.x,
    y: span.fromFloor,
    z: span.z,
  });
  const baseRotY = stairDirRotationY(span.stairDir);
  const isTransparent = opacity < 0.99;
  const stepCount = 10;
  const stoneColor = isHighlighted
    ? "#a89882"
    : span.inPalace
      ? "#85786c"
      : "#6e655c";
  const columnColor = span.inPalace ? "#695e54" : "#575049";
  const goldColor = isHighlighted
    ? "#facc15"
    : span.inPalace
      ? "#d4a73f"
      : "#a89882";

  return (
    <group
      position={[wx, wy, wz]}
      rotation={[0, baseRotY, 0]}
      onPointerMove={(e) => onHover(e, span)}
      onClick={(e) => onClick(e, span)}
      onContextMenu={(e) => onContextMenu(e, span)}
    >
      <mesh position={[0, FLOOR_HEIGHT * 0.52, 0]} castShadow={!isTransparent}>
        <cylinderGeometry args={[0.13, 0.16, FLOOR_HEIGHT + 0.18, 12]} />
        <meshStandardMaterial
          color={columnColor}
          roughness={0.62}
          transparent={isTransparent}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, FLOOR_HEIGHT + 0.16, 0]} castShadow={!isTransparent}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial
          color={goldColor}
          metalness={0.72}
          roughness={0.28}
          transparent={isTransparent}
          opacity={opacity}
        />
      </mesh>

      {Array.from({ length: stepCount }, (_, i) => {
        const frac = (i + 0.5) / stepCount;
        const angle = frac * Math.PI * 1.65;
        const sy = frac * (FLOOR_HEIGHT - 0.12) + 0.1;
        const radius = 0.34;
        const sx = Math.cos(angle) * radius;
        const sz = Math.sin(angle) * radius;
        const outerX = Math.cos(angle) * 0.56;
        const outerZ = Math.sin(angle) * 0.56;

        return (
          <group key={`spiral-step-${i}`}>
            <mesh
              position={[sx, sy, sz]}
              rotation={[0, -angle, 0]}
              castShadow={!isTransparent}
              receiveShadow
              raycast={() => null}
            >
              <boxGeometry args={[0.52, 0.11, 0.26]} />
              <meshStandardMaterial
                color={stoneColor}
                roughness={0.7}
                transparent={isTransparent}
                opacity={opacity}
              />
            </mesh>
            <mesh
              position={[outerX, sy + 0.28, outerZ]}
              castShadow={!isTransparent}
              raycast={() => null}
            >
              <cylinderGeometry args={[0.022, 0.022, 0.54, 6]} />
              <meshStandardMaterial
                color="#1c1917"
                metalness={0.75}
                roughness={0.35}
                transparent={isTransparent}
                opacity={opacity}
              />
            </mesh>
            <mesh position={[outerX, sy + 0.56, outerZ]} raycast={() => null}>
              <sphereGeometry args={[0.036, 8, 8]} />
              <meshStandardMaterial
                color={goldColor}
                metalness={0.75}
                roughness={0.28}
                transparent={isTransparent}
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * 3D Honosný dvoukřídlý barokní portál (`isDoubleLeaf`)
 * Spojuje dvě dlaždice do jednoho monumentálního portálu se zdobeným kamenným ostěním (Luragův styl),
 * rozeklaným štítem (frontonem) se zlaceným maltézským křížem a dvěma protiběžně otevíratelnými dubovými křídly.
 */
function BaroqueGrandDoublePortal3D({
  door,
  pairedDoor,
  isAdjacent,
  opacity,
  onToggle,
}: {
  door: DoorData;
  pairedDoor?: DoorData;
  isAdjacent: boolean;
  opacity: number;
  onToggle: (coord: GridCoord) => void;
}) {
  const locale = useLocale();
  const [wx1, wy, wz1] = gridToWorld(door.coord);
  const [wx2, , wz2] = pairedDoor ? gridToWorld(pairedDoor.coord) : [wx1, wy, wz1];
  const centerX = (wx1 + wx2) * 0.5;
  const centerZ = (wz1 + wz2) * 0.5;
  const isOpen = door.state === "open";
  const isTransparent = opacity < 0.99;
  const isEW = door.axis === "E_W";

  const openAngle = isOpen ? 1.4 : 0;
  const portalWidth = TILE_SIZE * 2;
  const doorHeight = FLOOR_HEIGHT * 0.88;
  const leafWidth = TILE_SIZE * 0.94;
  const leafThickness = 0.09;

  return (
    <group position={[centerX, wy, centerZ]} rotation={[0, isEW ? 0 : Math.PI * 0.5, 0]}>
      {/* Profilované kamenné ostění portálu */}
      <mesh position={[-portalWidth * 0.51, doorHeight * 0.5, 0]} castShadow={!isTransparent}>
        <boxGeometry args={[0.24, doorHeight + 0.16, 0.34]} />
        <meshStandardMaterial color="#575049" roughness={0.8} transparent={isTransparent} opacity={opacity} />
      </mesh>
      <mesh position={[portalWidth * 0.51, doorHeight * 0.5, 0]} castShadow={!isTransparent}>
        <boxGeometry args={[0.24, doorHeight + 0.16, 0.34]} />
        <meshStandardMaterial color="#575049" roughness={0.8} transparent={isTransparent} opacity={opacity} />
      </mesh>
      {/* Masivní profilovaný kamenný překlad */}
      <mesh position={[0, doorHeight + 0.08, 0]} castShadow={!isTransparent}>
        <boxGeometry args={[portalWidth + 0.48, 0.22, 0.36]} />
        <meshStandardMaterial color="#695e54" roughness={0.75} transparent={isTransparent} opacity={opacity} />
      </mesh>

      {/* Rozeklaný barokní fronton s maltézským erbem */}
      <group position={[0, doorHeight + 0.28, 0]}>
        <mesh position={[-portalWidth * 0.28, 0.06, 0]} rotation={[0, 0, 0.16]} castShadow={!isTransparent}>
          <boxGeometry args={[portalWidth * 0.52, 0.12, 0.34]} />
          <meshStandardMaterial color="#786c62" roughness={0.7} transparent={isTransparent} opacity={opacity} />
        </mesh>
        <mesh position={[portalWidth * 0.28, 0.06, 0]} rotation={[0, 0, -0.16]} castShadow={!isTransparent}>
          <boxGeometry args={[portalWidth * 0.52, 0.12, 0.34]} />
          <meshStandardMaterial color="#786c62" roughness={0.7} transparent={isTransparent} opacity={opacity} />
        </mesh>
        {/* Kamenná kartuše */}
        <mesh position={[0, 0.08, 0.04]} castShadow={!isTransparent}>
          <boxGeometry args={[0.44, 0.38, 0.12]} />
          <meshStandardMaterial color="#8a7c70" roughness={0.65} transparent={isTransparent} opacity={opacity} />
        </mesh>
        {/* Zlacený maltézský kříž */}
        <mesh position={[0, 0.08, 0.11]}>
          <boxGeometry args={[0.22, 0.22, 0.04]} />
          <meshStandardMaterial color="#d4a73f" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Levé otočné křídlo (pant u levého pilíře) */}
      <group position={[-portalWidth * 0.48, 0, 0]} rotation={[0, openAngle, 0]}>
        <mesh
          position={[leafWidth * 0.5, doorHeight * 0.5, 0]}
          castShadow={!isTransparent}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            if (
              doorMeshForwardsClick(
                useGameStore.getState().inspectKeyHeld,
                isAdjacent,
              )
            ) {
              onToggle(door.coord);
            }
          }}
        >
          <boxGeometry args={[leafWidth, doorHeight * 0.96, leafThickness]} />
          <meshStandardMaterial color={isOpen ? "#453229" : "#38271e"} roughness={0.85} transparent={isTransparent} opacity={opacity} />
        </mesh>
        {/* Kované pásy pantů */}
        <mesh position={[leafWidth * 0.5, doorHeight * 0.25, leafThickness * 0.52]}>
          <boxGeometry args={[leafWidth * 0.85, 0.05, 0.02]} />
          <meshStandardMaterial color="#1c1917" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[leafWidth * 0.5, doorHeight * 0.75, leafThickness * 0.52]}>
          <boxGeometry args={[leafWidth * 0.85, 0.05, 0.02]} />
          <meshStandardMaterial color="#1c1917" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Mosazné lví klepadlo */}
        <mesh position={[leafWidth * 0.82, doorHeight * 0.52, leafThickness * 0.55]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#d4a73f" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Pravé otočné křídlo (pant u pravého pilíře) */}
      <group position={[portalWidth * 0.48, 0, 0]} rotation={[0, -openAngle, 0]}>
        <mesh
          position={[-leafWidth * 0.5, doorHeight * 0.5, 0]}
          castShadow={!isTransparent}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            if (
              doorMeshForwardsClick(
                useGameStore.getState().inspectKeyHeld,
                isAdjacent,
              )
            ) {
              onToggle(door.coord);
            }
          }}
        >
          <boxGeometry args={[leafWidth, doorHeight * 0.96, leafThickness]} />
          <meshStandardMaterial color={isOpen ? "#453229" : "#38271e"} roughness={0.85} transparent={isTransparent} opacity={opacity} />
        </mesh>
        {/* Kované pásy pantů */}
        <mesh position={[-leafWidth * 0.5, doorHeight * 0.25, leafThickness * 0.52]}>
          <boxGeometry args={[leafWidth * 0.85, 0.05, 0.02]} />
          <meshStandardMaterial color="#1c1917" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[-leafWidth * 0.5, doorHeight * 0.75, leafThickness * 0.52]}>
          <boxGeometry args={[leafWidth * 0.85, 0.05, 0.02]} />
          <meshStandardMaterial color="#1c1917" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Mosazné lví klepadlo */}
        <mesh position={[-leafWidth * 0.82, doorHeight * 0.52, leafThickness * 0.55]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#d4a73f" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Plovoucí interaktivní štítek portálu */}
      {isAdjacent && (
        <WorldHtml center position={[0, doorHeight + 0.65, 0]} distanceFactor={18} zIndexRange={[12, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(door.coord);
            }}
            title={text("ui.door.double", { doorId: door.id, open: isOpen }, locale)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-md shadow-xl border text-[10px] font-cinzel font-black tracking-wide cursor-pointer transition-all uppercase ${
              isOpen
                ? "bg-slate-950/90 border-amber-500/70 text-amber-200 hover:bg-amber-950/80 hover:border-amber-300"
                : "bg-amber-500/95 border-amber-300 text-slate-950 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.7)]"
            }`}
          >
            {isOpen ? (
              <>
                <DoorOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{text("ui.door.closePortal", undefined, locale)}</span>
              </>
            ) : (
              <>
                <DoorClosed className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>{text("ui.door.openPortal", undefined, locale)}</span>
              </>
            )}
          </button>
        </WorldHtml>
      )}
    </group>
  );
}

/**
 * 3D Baroque Double/Single Door with carved oak planks, wrought-iron strap hinges,
 * stone lintel archway, and animated open/closed pivot rotation.
 */
function BaroqueDoor3D({
  door,
  isAdjacent,
  opacity,
  onToggle,
}: {
  door: DoorData;
  isAdjacent: boolean;
  opacity: number;
  onToggle: (coord: GridCoord) => void;
}) {
  const locale = useLocale();
  const [wx, wy, wz] = gridToWorld(door.coord);
  const isOpen = door.state === "open";
  const isTransparent = opacity < 0.99;
  const isEW = door.axis === "E_W";

  // Úhel otevření: v zavřeném stavu 0 rad, v otevřeném stavu vytočeno o ~75° (1.3 rad)
  const openAngle = isOpen ? 1.35 : 0;
  const doorThickness = 0.08;
  const doorWidth = TILE_SIZE * 0.88;
  const doorHeight = FLOOR_HEIGHT * 0.82;

  return (
    <group position={[wx, wy, wz]} rotation={[0, isEW ? 0 : Math.PI * 0.5, 0]}>
      {/* Kamenná zárubeň (Ostění) */}
      <mesh position={[-doorWidth * 0.52, doorHeight * 0.5, 0]} castShadow={!isTransparent}>
        <boxGeometry args={[0.12, doorHeight + 0.1, 0.22]} />
        <meshStandardMaterial
          color="#575049"
          roughness={0.8}
          transparent={isTransparent}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[doorWidth * 0.52, doorHeight * 0.5, 0]} castShadow={!isTransparent}>
        <boxGeometry args={[0.12, doorHeight + 0.1, 0.22]} />
        <meshStandardMaterial
          color="#575049"
          roughness={0.8}
          transparent={isTransparent}
          opacity={opacity}
        />
      </mesh>
      {/* Vrchní kamenný překlad */}
      <mesh position={[0, doorHeight + 0.05, 0]} castShadow={!isTransparent}>
        <boxGeometry args={[doorWidth + 0.24, 0.14, 0.24]} />
        <meshStandardMaterial
          color="#695e54"
          roughness={0.75}
          transparent={isTransparent}
          opacity={opacity}
        />
      </mesh>

      {/* Otočné křídlo dveří (pant na levé straně zárubně) */}
      <group position={[-doorWidth * 0.46, 0, 0]} rotation={[0, openAngle, 0]}>
        <mesh
          position={[doorWidth * 0.46, doorHeight * 0.5, 0]}
          castShadow={!isTransparent}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            if (
              doorMeshForwardsClick(
                useGameStore.getState().inspectKeyHeld,
                isAdjacent,
              )
            ) {
              onToggle(door.coord);
            }
          }}
        >
          <boxGeometry args={[doorWidth * 0.92, doorHeight * 0.95, doorThickness]} />
          <meshStandardMaterial
            color={isOpen ? "#453229" : "#38271e"}
            roughness={0.85}
            transparent={isTransparent}
            opacity={opacity}
          />
        </mesh>

        {/* Kované železné kování (pásy pantů) */}
        <mesh position={[doorWidth * 0.46, doorHeight * 0.25, doorThickness * 0.52]}>
          <boxGeometry args={[doorWidth * 0.82, 0.05, 0.02]} />
          <meshStandardMaterial color="#1c1917" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[doorWidth * 0.46, doorHeight * 0.75, doorThickness * 0.52]}>
          <boxGeometry args={[doorWidth * 0.82, 0.05, 0.02]} />
          <meshStandardMaterial color="#1c1917" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Mosazná klika / kruhové klepadlo */}
        <mesh position={[doorWidth * 0.8, doorHeight * 0.5, doorThickness * 0.54]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#d4a73f" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Plovoucí interaktivní štítek dveří (Free Action 0 AP při stání vedle) */}
      {isAdjacent && (
        <WorldHtml
          center
          position={[0, doorHeight + 0.45, 0]}
          distanceFactor={18}
          zIndexRange={[12, 0]}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(door.coord);
            }}
            title={text("ui.door.single", { doorId: door.id, open: isOpen }, locale)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md shadow-lg border text-[10px] font-cinzel font-black tracking-wide cursor-pointer transition-all uppercase ${
              isOpen
                ? "bg-slate-950/90 border-amber-500/70 text-amber-200 hover:bg-amber-950/80 hover:border-amber-300"
                : "bg-amber-500/90 border-amber-300 text-slate-950 hover:bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
            }`}
          >
            {isOpen ? (
              <>
                <DoorOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{text("ui.door.close", undefined, locale)}</span>
              </>
            ) : (
              <>
                <DoorClosed className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>{text("ui.door.open", undefined, locale)}</span>
              </>
            )}
          </button>
        </WorldHtml>
      )}
    </group>
  );
}

/**
 * Living Battlefield Props (Pillar 4)
 */
function BaroqueLivingDecor({
  pillars,
  lowWalls,
  highWalls,
  kegs,
  groundTiles,
  upperTiles,
}: {
  pillars: TileData[];
  lowWalls: TileData[];
  highWalls: TileData[];
  kegs: TileData[];
  groundTiles: TileData[];
  upperTiles: TileData[];
}) {
  const blastZones = useGameStore((s) => s.blastZones);
  const flameRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bannerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const mistRefs = useRef<(THREE.Mesh | null)[]>([]);

  const decoratedPillars = useMemo(() => pillars.slice(0, 6), [pillars]);
  const candleWalls = useMemo(
    () => lowWalls.filter((_, idx) => idx % 3 === 0).slice(0, 6),
    [lowWalls],
  );

  const palacePictureWalls = useMemo(
    () =>
      highWalls.filter(
        (t) =>
          t.coord.z === 15 &&
          (t.coord.x === 3 ||
            t.coord.x === 5 ||
            t.coord.x === 15 ||
            t.coord.x === 16),
      ),
    [highWalls],
  );

  const pristineCarpetTiles = useMemo(
    () =>
      [...groundTiles, ...upperTiles].filter(
        (t) =>
          t.surface === "palace_carpet" &&
          (t.damageLevel ?? 0) === 0 &&
          !t.isLadder,
      ),
    [groundTiles, upperTiles],
  );

  const devastatedTiles = useMemo(
    () =>
      groundTiles.filter(
        (t) =>
          (t.damageLevel ?? 0) >= 1 ||
          t.surface === "scorched_ruin" ||
          (t.surface === "rubble" && t.obstacle === "none"),
      ),
    [groundTiles],
  );

  const mistPatches = useMemo(() => {
    const patches: {
      x: number;
      y: number;
      z: number;
      phase: number;
      baseScale: number;
      maxScale: number;
      createdAt: number;
      opacity: number;
    }[] = [
      {
        x: 3.2,
        y: 0,
        z: 1.8,
        phase: 0.7,
        baseScale: 1.45,
        maxScale: 1.45,
        createdAt: 0,
        opacity: 0.11,
      },
      {
        x: 9.5,
        y: 0,
        z: 1.5,
        phase: 2.4,
        baseScale: 1.55,
        maxScale: 1.55,
        createdAt: 0,
        opacity: 0.11,
      },
    ];

    blastZones.slice(-10).forEach((bz, idx) => {
      patches.push({
        x: bz.coord.x,
        y: bz.coord.y,
        z: bz.coord.z,
        phase: (idx * 1.7 + bz.coord.x) % (Math.PI * 2),
        baseScale: bz.isExplosion ? 1.15 : 0.75,
        maxScale: bz.isExplosion ? 2.65 : 1.65,
        createdAt: bz.createdAt,
        opacity: bz.isExplosion ? 0.24 : 0.16,
      });
    });

    return patches;
  }, [blastZones]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const nowMs = performance.now();

    flameRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const flicker =
        0.85 +
        Math.sin(t * 11.5 + i * 1.9) * 0.18 +
        Math.cos(t * 19.3 + i * 0.7) * 0.1;
      mesh.scale.set(flicker, flicker * 1.15, flicker);
    });

    bannerRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.rotation.y = Math.sin(t * 2.8 + i * 1.4) * 0.24;
      mesh.rotation.z = Math.cos(t * 2.1 + i * 0.9) * 0.08;
    });

    mistRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = mistPatches[i];
      if (!p) return;
      const ageSec =
        p.createdAt > 0 ? Math.max(0, (nowMs - p.createdAt) / 1000) : 10;
      const currentScale = Math.min(
        p.maxScale,
        p.baseScale + ageSec * 0.28,
      );
      mesh.scale.set(currentScale, 0.16, currentScale);
      mesh.position.x = Math.sin(t * 0.35 + p.phase) * 0.38;
      mesh.position.z = Math.cos(t * 0.28 + p.phase) * 0.32;
    });
  });

  let flameIdx = 0;

  return (
    <group>
      {decoratedPillars.map((tile, i) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const isImperial = i % 2 === 0;
        const fIdx = flameIdx++;
        return (
          <group
            key={`pillar-decor-${tile.coord.x}-${tile.coord.y}-${tile.coord.z}`}
            position={[wx, wy, wz]}
          >
            <mesh position={[0, 1.65, 0.52]} rotation={[0.35, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.025, 0.38, 6]} />
              <meshStandardMaterial
                color="#1c1917"
                roughness={0.6}
                metalness={0.7}
              />
            </mesh>
            <mesh
              ref={(el) => {
                flameRefs.current[fIdx] = el;
              }}
              position={[0, 1.86, 0.58]}
            >
              <coneGeometry args={[0.09, 0.26, 8]} />
              <meshStandardMaterial
                color="#f97316"
                emissive="#fbbf24"
                emissiveIntensity={2.6}
              />
            </mesh>

            <group position={[0.48, 1.95, 0]}>
              <mesh rotation={[0, 0, Math.PI * 0.5]}>
                <cylinderGeometry args={[0.02, 0.02, 0.48, 6]} />
                <meshStandardMaterial
                  color="#eab308"
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              <mesh
                ref={(el) => {
                  bannerRefs.current[i] = el;
                }}
                position={[0.06, -0.46, 0]}
                castShadow
              >
                <planeGeometry args={[0.36, 0.88]} />
                <meshStandardMaterial
                  color={isImperial ? "#b91c1c" : "#1d4ed8"}
                  emissive={isImperial ? "#450a0a" : "#172554"}
                  emissiveIntensity={0.35}
                  roughness={0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </group>
        );
      })}

      {candleWalls.map((tile) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const fIdx = flameIdx++;
        return (
          <group
            key={`candle-wall-${tile.coord.x}-${tile.coord.y}-${tile.coord.z}`}
            position={[wx, wy + 0.88, wz]}
          >
            <mesh position={[-0.14, 0.08, 0]}>
              <cylinderGeometry args={[0.03, 0.035, 0.16, 8]} />
              <meshStandardMaterial color="#fef3c7" roughness={0.5} />
            </mesh>
            <mesh position={[0.12, 0.06, 0.08]}>
              <cylinderGeometry args={[0.028, 0.032, 0.12, 8]} />
              <meshStandardMaterial color="#fef3c7" roughness={0.5} />
            </mesh>
            <mesh
              ref={(el) => {
                flameRefs.current[fIdx] = el;
              }}
              position={[-0.14, 0.19, 0]}
            >
              <sphereGeometry args={[0.038, 8, 8]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#f59e0b"
                emissiveIntensity={2.8}
              />
            </mesh>
          </group>
        );
      })}

      {kegs.map((tile) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const fIdx = flameIdx++;
        return (
          <group
            key={`keg-spark-${tile.coord.x}-${tile.coord.z}`}
            position={[wx, wy + 0.74, wz]}
          >
            <mesh position={[0, -0.18, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.06, 12]} />
              <meshStandardMaterial
                color="#eab308"
                metalness={0.75}
                roughness={0.3}
              />
            </mesh>
            <mesh
              ref={(el) => {
                flameRefs.current[fIdx] = el;
              }}
              position={[0, 0.06, 0]}
            >
              <octahedronGeometry args={[0.075, 0]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#fb923c"
                emissiveIntensity={3.0}
              />
            </mesh>
          </group>
        );
      })}

      {mistPatches.map((patch, i) => {
        const [wx, wy, wz] = continuousGridToWorld(patch.x, patch.y, patch.z);
        return (
          <group
            key={`mist-${i}-${patch.x}-${patch.z}`}
            position={[wx, wy + 0.12, wz]}
          >
            <mesh
              ref={(el) => {
                mistRefs.current[i] = el;
              }}
              scale={[patch.baseScale, 0.16, patch.baseScale]}
              geometry={SMOKE_PUFF_GEO}
              raycast={() => null}
            >
              <meshStandardMaterial
                color="#94a3b8"
                roughness={1}
                transparent
                opacity={patch.opacity}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {pristineCarpetTiles.map((tile) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const isLeftEdge = tile.coord.x === 9;
        const borderX = isLeftEdge ? -TILE_SIZE * 0.44 : TILE_SIZE * 0.44;
        return (
          <group
            key={`carpet-trim-${tile.coord.x}-${tile.coord.y}-${tile.coord.z}`}
            position={[wx, wy + 0.008, wz]}
          >
            <mesh
              position={[borderX, 0, 0]}
              rotation={[-Math.PI * 0.5, 0, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[0.055, TILE_SIZE * 0.96]} />
              <meshStandardMaterial
                color="#c89d3c"
                metalness={0.65}
                roughness={0.35}
              />
            </mesh>
          </group>
        );
      })}

      {palacePictureWalls.map((tile) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const isDamaged = (tile.damageLevel ?? 0) >= 1;
        const tiltZ = isDamaged ? 0.22 : 0;
        return (
          <group
            key={`palace-art-${tile.coord.x}-${tile.coord.z}`}
            position={[wx, wy + 1.55, wz + TILE_SIZE * 0.49]}
            rotation={[0, 0, tiltZ]}
          >
            <mesh castShadow raycast={() => null}>
              <boxGeometry args={[0.78, 0.58, 0.04]} />
              <meshStandardMaterial
                color={isDamaged ? "#57482e" : "#c89d3c"}
                metalness={0.72}
                roughness={0.32}
              />
            </mesh>
            <mesh position={[0, 0, 0.024]} raycast={() => null}>
              <planeGeometry args={[0.64, 0.44]} />
              <meshStandardMaterial
                color={isDamaged ? "#1f1916" : "#2e1d18"}
                roughness={0.6}
              />
            </mesh>
          </group>
        );
      })}

      {devastatedTiles.map((tile) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const isScorched =
          (tile.damageLevel ?? 0) >= 2 || tile.surface === "scorched_ruin";
        const seed = (tile.coord.x * 7 + tile.coord.z * 13) % 4;
        const rotY = seed * (Math.PI * 0.5) + 0.3;

        return (
          <group
            key={`ruin-debris-${tile.coord.x}-${tile.coord.z}`}
            position={[wx, wy + 0.01, wz]}
            rotation={[0, rotY, 0]}
          >
            {isScorched ? (
              <>
                <mesh
                  position={[0, 0.005, 0]}
                  rotation={[-Math.PI * 0.5, 0, 0]}
                  raycast={() => null}
                >
                  <ringGeometry
                    args={[TILE_SIZE * 0.28, TILE_SIZE * 0.44, 16]}
                  />
                  <meshBasicMaterial
                    color="#140f0d"
                    transparent
                    opacity={0.75}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
                <mesh
                  position={[0.28, 0.02, -0.26]}
                  rotation={[-Math.PI * 0.5, 0, 0.4]}
                  raycast={() => null}
                >
                  <planeGeometry args={[0.22, 0.05]} />
                  <meshBasicMaterial color="#ea580c" />
                </mesh>
                <mesh
                  position={[-0.36, 0.045, 0.34]}
                  rotation={[0.08, 0.5, 0.12]}
                  castShadow
                  raycast={() => null}
                >
                  <boxGeometry args={[0.38, 0.06, 0.09]} />
                  <meshStandardMaterial color="#1f1612" roughness={0.95} />
                </mesh>
                <mesh
                  position={[0.36, 0.05, 0.32]}
                  rotation={[0.2, 0.8, 0.1]}
                  castShadow
                  raycast={() => null}
                >
                  <dodecahedronGeometry args={[0.085, 0]} />
                  <meshStandardMaterial color="#38302b" roughness={0.9} />
                </mesh>
              </>
            ) : (
              <>
                <mesh
                  position={[-0.37, 0.03, -0.35]}
                  rotation={[0.1, 0.6, 0]}
                  raycast={() => null}
                >
                  <dodecahedronGeometry args={[0.06, 0]} />
                  <meshStandardMaterial
                    color={tile.coord.z >= 15 ? "#9c9083" : "#575049"}
                    roughness={0.88}
                  />
                </mesh>
                <mesh
                  position={[0.35, 0.025, 0.36]}
                  rotation={[0.2, 1.1, 0.1]}
                  raycast={() => null}
                >
                  <boxGeometry args={[0.14, 0.035, 0.1]} />
                  <meshStandardMaterial
                    color={tile.coord.z >= 15 ? "#8a7e72" : "#4a443e"}
                    roughness={0.88}
                  />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function InstancedBattlefield() {
  const grid = useGameStore((s) => s.grid);
  const gridVersion = useGameStore((s) => s.gridVersion);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const cameraStep = useGameStore((s) => s.cameraStep);
  const reachableTiles = useGameStore((s) => s.reachableTiles);
  const hoveredTile = useGameStore((s) => s.hoveredTile);
  const hoveredPath = useGameStore((s) => s.hoveredPath);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const units = useGameStore((s) => s.units);
  const setHoveredTile = useGameStore((s) => s.setHoveredTile);
  const handleTileClick = useGameStore((s) => s.handleTileClick);
  const handleTileRightClick = useGameStore((s) => s.handleTileRightClick);
  const setActiveFloor = useGameStore((s) => s.setActiveFloor);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const toggleDoor = useGameStore((s) => s.toggleDoor);
  const weather = useGameStore((s) => s.weather);
  const locale = useLocale();

  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const selectedTargetUnit = units.find((u) => u.id === selectedTargetId);
  const isShootingView = actionMode === "shoot" || activeProjectile !== null;

  const hoveredReachable = useMemo(() => {
    if (!hoveredTile) return null;
    return (
      reachableTiles.get(
        `${hoveredTile.x},${hoveredTile.y},${hoveredTile.z}`,
      ) ?? null
    );
  }, [hoveredTile, reachableTiles]);

  // Pevně držíme vybrané patro (P0 / P1 / P2): přejetí myší nad dvůr či zahradu nikdy neshodí řez aktivního patra
  const effectiveViewFloor: FloorLevel = activeFloor;

  const guidedTutorial = useGameStore((s) => s.guidedTutorial);

  const waypoint = useMemo(() => {
    if (isShootingView || tutorialDismissed) return null;
    if (guidedTutorial?.enabled && !guidedTutorial.dismissed) {
      const guidedBeacon = getGuidedTutorialBeacon(
        grid,
        guidedTutorial.currentStep,
        units,
      );
      if (guidedBeacon) return guidedBeacon;
    }
    if (tutorialStep === null) return null;
    return getMission1TutorialBeacon(grid, tutorialStep);
  }, [
    isShootingView,
    tutorialDismissed,
    tutorialStep,
    guidedTutorial,
    grid,
    gridVersion,
    units,
    locale,
  ]);

  const groundFloorTiles = useMemo(
    () => grid.getFloorTiles(0),
    [grid, gridVersion],
  );
  const escapeTile = useMemo(
    () => getMission1EscapeTile(grid),
    [grid, gridVersion],
  );
  const upperFloorTiles = useMemo(
    () => grid.getFloorTiles(1),
    [grid, gridVersion],
  );
  const watchtowerFloorTiles = useMemo(
    () => grid.getFloorTiles(2),
    [grid, gridVersion],
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
    const low2: TileData[] = [];
    const pillar2: TileData[] = [];
    const stairs: StairSpan[] = [];

    for (const t of grid.getAllTiles()) {
      if (!t.hasFloor) continue;

      if (t.isLadder || (t.stairType && t.stairType !== "none")) {
        const conns =
          t.stairConnections && t.stairConnections.length > 0
            ? t.stairConnections
            : t.coord.y === 0
              ? ([1] as FloorLevel[])
              : [];
        for (const nextF of conns) {
          if (nextF === t.coord.y + 1) {
            stairs.push({
              x: t.coord.x,
              z: t.coord.z,
              fromFloor: t.coord.y,
              toFloor: nextF,
              stairType:
                t.stairType && t.stairType !== "none"
                  ? t.stairType
                  : "straight_stairs",
              stairDir: t.stairDir ?? "N",
              inPalace: t.coord.z >= 15,
            });
          }
        }
      }

      if (t.coord.y === 0) {
        if (t.obstacle === "low_wall") low0.push(t);
        else if (t.obstacle === "high_wall") high0.push(t);
        else if (t.obstacle === "pillar") pillar0.push(t);
        else if (t.obstacle === "powder_keg") kegs0.push(t);
      } else if (t.coord.y === 1) {
        if (t.obstacle === "low_wall") low1.push(t);
        else if (t.obstacle === "pillar" || t.obstacle === "high_wall")
          pillar1.push(t);
      } else if (t.coord.y === 2) {
        if (t.obstacle === "low_wall") low2.push(t);
        else if (t.obstacle === "pillar" || t.obstacle === "high_wall")
          pillar2.push(t);
      }
    }
    const doors = grid.getAllDoors();
    return {
      low0,
      high0,
      pillar0,
      kegs0,
      low1,
      pillar1,
      low2,
      pillar2,
      stairs,
      doors,
    };
  }, [grid, gridVersion]);

  // Diegetické ikony krytu přilepené přímo na stěnách a překážkách (Pillar 3 - XCOM 2 Wall Shields)
  const contextualCoverObstacles = useMemo(() => {
    const list: {
      key: string;
      worldPos: [number, number, number];
      type: "full" | "half";
      isHoveredFocus: boolean;
    }[] = [];
    if (isShootingView) return list;

    const addTileWallCovers = (coord: GridCoord, isHoveredFocus: boolean) => {
      if (coord.y > effectiveViewFloor) return;
      const t = grid.getTile(coord);
      if (!t || !t.hasFloor) return;
      const [wx, wy, wz] = gridToWorld(coord);
      const dirs: { dir: CardinalDir; dx: number; dz: number }[] = [
        { dir: "N", dx: 0, dz: -0.42 },
        { dir: "S", dx: 0, dz: 0.42 },
        { dir: "E", dx: 0.42, dz: 0 },
        { dir: "W", dx: -0.42, dz: 0 },
      ];
      for (const { dir, dx, dz } of dirs) {
        const cov = t.cover[dir];
        if (cov === "half" || cov === "full") {
          const key = `${coord.x},${coord.y},${coord.z}-${dir}`;
          if (!list.some((item) => item.key === key)) {
            list.push({
              key,
              worldPos: [wx + dx, wy + 0.56, wz + dz],
              type: cov,
              isHoveredFocus,
            });
          }
        }
      }
    };

    if (hoveredTile && hoveredReachable) {
      addTileWallCovers(hoveredTile, true);
    }
    if (selectedUnit?.alive) {
      addTileWallCovers(selectedUnit.pos, false);
    }
    return list;
  }, [
    grid,
    gridVersion,
    hoveredTile,
    hoveredReachable,
    selectedUnit,
    effectiveViewFloor,
    isShootingView,
  ]);

  // Refs for InstancedMeshes
  const groundMeshRef = useRef<THREE.InstancedMesh>(null);
  const upperMeshRef = useRef<THREE.InstancedMesh>(null);
  const watchtowerMeshRef = useRef<THREE.InstancedMesh>(null);
  const low0MeshRef = useRef<THREE.InstancedMesh>(null);
  const low0CapMeshRef = useRef<THREE.InstancedMesh>(null);
  const high0MeshRef = useRef<THREE.InstancedMesh>(null);
  const pillar0MeshRef = useRef<THREE.InstancedMesh>(null);
  const pillar0CapMeshRef = useRef<THREE.InstancedMesh>(null);
  const kegs0MeshRef = useRef<THREE.InstancedMesh>(null);
  const low1MeshRef = useRef<THREE.InstancedMesh>(null);
  const pillar1MeshRef = useRef<THREE.InstancedMesh>(null);
  const low2MeshRef = useRef<THREE.InstancedMesh>(null);
  const pillar2MeshRef = useRef<THREE.InstancedMesh>(null);
  const zoneMeshRef = useRef<THREE.InstancedMesh>(null);
  const fogVeilMeshRef = useRef<THREE.InstancedMesh>(null);
  const frontierRimMeshRef = useRef<THREE.InstancedMesh>(null);

  const assignFloorTileColor = (
    tile: TileData,
    dimFactor = 1.0,
    fogVis: FogVisibilityState = "visible",
  ) => {
    const checker = (tile.coord.x + tile.coord.z) % 2 === 0;
    const dmg = tile.damageLevel ?? 0;
    const inPalace =
      tile.coord.z >= 15 && tile.coord.x >= 2 && tile.coord.x <= 17;

    if (tile.isLadder || (tile.stairType && tHasStair(tile))) {
      _color.setHex(inPalace ? 0x6e563f : 0x78563c);
    } else if (tile.surface === "water") {
      _color.setHex(checker ? 0x0c3547 : 0x092c3b);
    } else if (tile.surface === "wood_dock") {
      _color.setHex(checker ? 0x4a3321 : 0x412c1c);
    } else if (tile.surface === "scorched_ruin" || dmg >= 2) {
      _color.setHex(checker ? 0x221a17 : 0x1a1311);
    } else if (tile.surface === "rubble" || dmg === 1) {
      if (inPalace) {
        _color.setHex(checker ? 0x453d37 : 0x3c352f);
      } else {
        _color.setHex(checker ? 0x38332f : 0x302b28);
      }
    } else if (tile.surface === "palace_carpet") {
      _color.setHex(checker ? 0x4a2226 : 0x3f1d20);
    } else if (tile.surface === "stone_floor") {
      _color.setHex(checker ? 0x3d342e : 0x342c27);
    } else if (tile.surface === "wood_roof") {
      _color.setHex(checker ? 0x4f3928 : 0x453122);
    } else {
      const isCarriagePath = tile.coord.x >= 8 && tile.coord.x <= 11;
      if (isCarriagePath) {
        _color.setHex(checker ? 0x242a33 : 0x1f242c);
      } else {
        _color.setHex(checker ? 0x1c222a : 0x171c23);
      }
    }

    if (dimFactor < 0.99) {
      _color.multiplyScalar(dimFactor);
    }

    if (fogVis === "shrouded") {
      _color.lerp(_shroudTint, 0.34);
      _color.multiplyScalar(0.5);
    } else if (fogVis === "unexplored") {
      if (tile.coord.y > 0) {
        // Floor Cutaway Fog Blackout (ADR-0010): Neprozkoumaná horní patra jsou černočerná Terra Incognita
        _color.setHex(0x020305);
      } else {
        _color.lerp(_unexploredTint, 0.58);
        _color.multiplyScalar(0.26);
      }
    }
  };

  function tHasStair(tile: TileData): boolean {
    return Boolean(tile.stairType && tile.stairType !== "none");
  }

  // Populate Ground Floor (y = 0) InstancedMesh (dims slightly when viewing P1 or P2 for clear depth separation + Chiaroscuro Fog of War)
  useEffect(() => {
    const mesh = groundMeshRef.current;
    if (!mesh) return;
    const dim0 = effectiveViewFloor > 0 ? 0.68 : 1.0;
    groundFloorTiles.forEach((tile, i) => {
      const [wx, wy, wz] = gridToWorld(tile.coord);
      const isWater = tile.surface === "water";
      _dummy.position.set(wx, wy + (isWater ? -0.22 : -0.08), wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      const fogVis = getTileVisibility(tile.coord, fogSnapshot, fogOfWarEnabled);
      assignFloorTileColor(tile, dim0, fogVis);
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [groundFloorTiles, gridVersion, effectiveViewFloor, fogSnapshot, fogOfWarEnabled]);

  // Populate 1st Floor (y = 1: Piano Nobile & Garden Belvedere) InstancedMesh
  useEffect(() => {
    const mesh = upperMeshRef.current;
    if (!mesh) return;
    const dim1 = effectiveViewFloor > 1 ? 0.74 : 1.0;
    upperFloorTiles.forEach((tile, i) => {
      const [wx, wy, wz] = gridToWorld(tile.coord);
      _dummy.position.set(wx, wy - 0.08, wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      const fogVis = getTileVisibility(tile.coord, fogSnapshot, fogOfWarEnabled);
      assignFloorTileColor(tile, dim1, fogVis);
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (upperFloorTiles.length > 0) mesh.computeBoundingSphere();
  }, [upperFloorTiles, gridVersion, effectiveViewFloor, fogSnapshot, fogOfWarEnabled]);

  // Populate 2nd Floor (y = 2: Maltese Watchtower) InstancedMesh
  useEffect(() => {
    const mesh = watchtowerMeshRef.current;
    if (!mesh) return;
    watchtowerFloorTiles.forEach((tile, i) => {
      const [wx, wy, wz] = gridToWorld(tile.coord);
      _dummy.position.set(wx, wy - 0.08, wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      const fogVis = getTileVisibility(tile.coord, fogSnapshot, fogOfWarEnabled);
      assignFloorTileColor(tile, 1.0, fogVis);
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (watchtowerFloorTiles.length > 0) mesh.computeBoundingSphere();
  }, [watchtowerFloorTiles, gridVersion, fogSnapshot, fogOfWarEnabled]);

  // Populate Obstacles InstancedMeshes across P0, P1, P2 with Chiaroscuro Fog of War shading
  useEffect(() => {
    const hasNeighborBlast = (c: GridCoord): number => {
      let maxDmg = grid.getTile(c)?.damageLevel ?? 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const n = grid.getTile({ x: c.x + dx, y: c.y, z: c.z + dz });
          if (n && (n.damageLevel ?? 0) > maxDmg) {
            maxDmg = n.damageLevel ?? 0;
          }
        }
      }
      return maxDmg;
    };

    const populateWithColor = (
      mesh: THREE.InstancedMesh | null,
      list: TileData[],
      heightOffset: number,
      colorFn: (tile: TileData, dmg: number) => number,
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

        const dmg = hasNeighborBlast(tile.coord);
        _color.setHex(colorFn(tile, dmg));
        const fogVis = getTileVisibility(tile.coord, fogSnapshot, fogOfWarEnabled);
        if (fogVis === "shrouded") {
          _color.lerp(_shroudTint, 0.32);
          _color.multiplyScalar(0.5);
        } else if (fogVis === "unexplored") {
          if (tile.coord.y > 0) {
            _color.setHex(0x020305);
          } else {
            _color.lerp(_unexploredTint, 0.55);
            _color.multiplyScalar(0.24);
          }
        }
        mesh.setColorAt(i, _color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (list.length > 0) mesh.computeBoundingSphere();
    };

    // Smart Wall Culling & Wall Stubs (ADR-0010 Ticket 06 + Action Camera Corridor Culling)
    const angle = Math.PI * 0.25 + cameraStep * (Math.PI * 0.5);
    const camDirX = Math.sin(angle);
    const camDirZ = Math.cos(angle);
    const focusCoord =
      activeProjectile?.to ??
      selectedUnit?.pos ??
      hoveredTile ?? { x: 10, y: 0, z: 18 };

    const shotFrom =
      activeProjectile?.from ??
      (actionMode === "shoot" ? selectedUnit?.pos : undefined);
    const shotTo =
      activeProjectile?.to ??
      (actionMode === "shoot" ? selectedTargetUnit?.pos : undefined);
    const missImpact =
      activeProjectile?.hit === false
        ? activeProjectile.missImpactCoord
        : undefined;

    const isFrontWall = (c: GridCoord): boolean => {
      // Pokud jde o zeď, do které právě narazila zbloudilá kulka při minutí, ponecháme ji v plné výšce,
      // aby bylo jasně vidět roztříštění omítky a odraz střely od zdiva!
      if (
        missImpact &&
        c.x === missImpact.x &&
        c.y === missImpact.y &&
        c.z === missImpact.z
      ) {
        return false;
      }

      // Během míření nebo letu projektilu snížíme na sokl (Wall Stub) každou zeď v koridoru mezi střelcem,
      // dráhou střely, cílem a boční akční kamerou
      if (shotFrom && shotTo) {
        const segX = shotTo.x - shotFrom.x;
        const segZ = shotTo.z - shotFrom.z;
        const segLenSq = Math.max(0.001, segX * segX + segZ * segZ);
        const tProj = Math.max(
          -0.25,
          Math.min(
            1.25,
            ((c.x - shotFrom.x) * segX + (c.z - shotFrom.z) * segZ) / segLenSq,
          ),
        );
        const closestX = shotFrom.x + tProj * segX;
        const closestZ = shotFrom.z + tProj * segZ;
        const distToShotLine = Math.hypot(c.x - closestX, c.z - closestZ);
        if (distToShotLine <= 2.65) {
          return true;
        }
      }

      if (c.y !== effectiveViewFloor) return false;
      const dx = c.x - focusCoord.x;
      const dz = c.z - focusCoord.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 9.5) return false;
      const dot = camDirX * dx + camDirZ * dz;
      return dot < -0.38;
    };

    const populateHighWalls = (
      mesh: THREE.InstancedMesh | null,
      list: TileData[],
    ) => {
      if (!mesh) return;
      mesh.count = list.length;
      list.forEach((tile, i) => {
        const [wx, wy, wz] = gridToWorld(tile.coord);
        const front = isFrontWall(tile.coord);
        if (front) {
          // Wall Stub (0.35m výška s pískovcovou římsou)
          _dummy.position.set(wx, wy + 0.175, wz);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 0.35 / FLOOR_HEIGHT, 1);
        } else {
          // Zadní / boční zeď v plné výšce
          _dummy.position.set(wx, wy + FLOOR_HEIGHT * 0.5, wz);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 1, 1);
        }
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);

        const dmg = hasNeighborBlast(tile.coord);
        if (front) {
          _color.setHex(dmg >= 2 ? 0x2b231f : 0x8c7b6b);
        } else {
          if (dmg >= 2) _color.setHex(0x2b231f);
          else if (tile.coord.z >= 15) _color.setHex(dmg === 1 ? 0x5e554d : 0x7d7267);
          else _color.setHex(dmg === 1 ? 0x3d3833 : 0x4e4841);
        }

        const fogVis = getTileVisibility(tile.coord, fogSnapshot, fogOfWarEnabled);
        if (fogVis === "shrouded") {
          _color.lerp(_shroudTint, 0.32);
          _color.multiplyScalar(0.5);
        } else if (fogVis === "unexplored") {
          if (tile.coord.y > 0) {
            _color.setHex(0x020305);
          } else {
            _color.lerp(_unexploredTint, 0.55);
            _color.multiplyScalar(0.24);
          }
        }
        mesh.setColorAt(i, _color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (list.length > 0) mesh.computeBoundingSphere();
    };

    populateWithColor(low0MeshRef.current, obstacles.low0, 0.42, (t, dmg) => {
      if (dmg >= 2) return 0x29211d;
      if (t.coord.z >= 15) return dmg === 1 ? 0x4a3525 : 0x5c3a21;
      return dmg === 1 ? 0x4d463f : 0x61584f;
    });
    populateWithColor(low0CapMeshRef.current, obstacles.low0, 0.85, (t, dmg) => {
      if (dmg >= 2) return 0x382e29;
      if (t.coord.z >= 15) return dmg === 1 ? 0x8c734b : 0xc89d3c;
      return dmg === 1 ? 0x6b6259 : 0x857b70;
    });

    populateHighWalls(high0MeshRef.current, obstacles.high0);

    populateWithColor(
      pillar0MeshRef.current,
      obstacles.pillar0,
      FLOOR_HEIGHT * 0.5,
      (t, dmg) => {
        if (dmg >= 2) return 0x2e2622;
        if (t.coord.z >= 15) return dmg === 1 ? 0x695e54 : 0x8c7b6b;
        return dmg === 1 ? 0x4f4943 : 0x696158;
      },
    );
    populateWithColor(
      pillar0CapMeshRef.current,
      obstacles.pillar0,
      FLOOR_HEIGHT - 0.14,
      (t, dmg) => {
        if (dmg >= 2) return 0x3d332c;
        if (t.coord.z >= 15) return dmg === 1 ? 0x94793b : 0xd4a73f;
        return dmg === 1 ? 0x6e655c : 0x91867a;
      },
    );

    populateWithColor(kegs0MeshRef.current, obstacles.kegs0, 0.36, () => 0x991b1b);
    populateWithColor(low1MeshRef.current, obstacles.low1, 0.42, (t, dmg) =>
      dmg >= 2 ? 0x2e2520 : t.coord.z >= 15 ? 0x5c3a21 : 0x787067,
    );
    populateWithColor(pillar1MeshRef.current, obstacles.pillar1, 1.0, (t, dmg) =>
      dmg >= 2 ? 0x362c26 : t.coord.z >= 15 ? 0x8c7b6b : 0x8c8277,
    );
    populateWithColor(low2MeshRef.current, obstacles.low2, 0.42, (_, dmg) =>
      dmg >= 2 ? 0x2e2520 : 0x787067,
    );
    populateWithColor(pillar2MeshRef.current, obstacles.pillar2, 1.0, (_, dmg) =>
      dmg >= 2 ? 0x362c26 : 0x8c7b6b,
    );
  }, [
    obstacles,
    grid,
    gridVersion,
    fogSnapshot,
    fogOfWarEnabled,
    cameraStep,
    actionMode,
    activeProjectile,
    selectedUnit?.pos,
    selectedTargetUnit?.pos,
    hoveredTile,
    effectiveViewFloor,
  ]);

  // Populate Nocturnal Fog of War Shroud Veil & Chiaroscuro Torchlight Frontier Rim
  useEffect(() => {
    const veilMesh = fogVeilMeshRef.current;
    const rimMesh = frontierRimMeshRef.current;
    if (!veilMesh || !rimMesh) return;

    if (!fogOfWarEnabled) {
      veilMesh.count = 0;
      rimMesh.count = 0;
      return;
    }

    const activeTiles = [
      ...groundFloorTiles,
      ...(effectiveViewFloor >= 1 ? upperFloorTiles : []),
      ...(effectiveViewFloor >= 2 ? watchtowerFloorTiles : []),
    ];

    let veilIdx = 0;
    let rimIdx = 0;

    for (const tile of activeTiles) {
      const vis = getTileVisibility(tile.coord, fogSnapshot, fogOfWarEnabled);
      const [wx, wy, wz] = gridToWorld(tile.coord);

      if (vis === "unexplored" || vis === "shrouded") {
        // Nevykreslujeme mlžný závoj přímo na poli, které je v aktivní pohybové zóně (Blue/Yellow),
        // aby taktická mřížka pohybu (Pillar 1) zůstala 100% křišťálově čitelná!
        const isReachableOnViewFloor =
          actionMode === "move" &&
          tile.coord.y === effectiveViewFloor &&
          reachableTiles.has(coordKey(tile.coord));

        if (!isReachableOnViewFloor || vis === "unexplored") {
          _dummy.position.set(
            wx,
            wy + (vis === "unexplored" ? 0.08 : 0.045),
            wz,
          );
          _dummy.rotation.set(-Math.PI * 0.5, 0, 0);
          const scale =
            vis === "unexplored"
              ? isReachableOnViewFloor
                ? 0.42
                : 0.98
              : 0.88;
          _dummy.scale.set(scale, scale, 1);
          _dummy.updateMatrix();
          veilMesh.setMatrixAt(veilIdx, _dummy.matrix);

          if (vis === "unexplored") {
            _color.setHex(0x04070d);
          } else {
            _color.setHex(0x0f172a);
          }
          veilMesh.setColorAt(veilIdx, _color);
          veilIdx++;
        }
      } else if (vis === "visible" && tile.coord.y === effectiveViewFloor) {
        // Zkontrolujeme, zda toto nasvícené pole sousedí s šerosvitem — pokud ano, vykreslíme jemný jantarový lem pochodně
        const neighbors = [
          { x: tile.coord.x + 1, y: tile.coord.y, z: tile.coord.z },
          { x: tile.coord.x - 1, y: tile.coord.y, z: tile.coord.z },
          { x: tile.coord.x, y: tile.coord.y, z: tile.coord.z + 1 },
          { x: tile.coord.x, y: tile.coord.y, z: tile.coord.z - 1 },
        ];
        const bordersShadow = neighbors.some((nc) => {
          const nt = grid.getTile(nc);
          if (!nt || !nt.hasFloor) return false;
          return !fogSnapshot.visibleCoords.has(coordKey(nc));
        });

        if (bordersShadow) {
          _dummy.position.set(wx, wy + 0.022, wz);
          _dummy.rotation.set(-Math.PI * 0.5, 0, 0);
          _dummy.scale.set(0.96, 0.96, 1);
          _dummy.updateMatrix();
          rimMesh.setMatrixAt(rimIdx, _dummy.matrix);
          _color.setHex(0xd97706);
          rimMesh.setColorAt(rimIdx, _color);
          rimIdx++;
        }
      }
    }

    veilMesh.count = veilIdx;
    veilMesh.instanceMatrix.needsUpdate = true;
    if (veilMesh.instanceColor) veilMesh.instanceColor.needsUpdate = true;
    if (veilIdx > 0) veilMesh.computeBoundingSphere();

    rimMesh.count = rimIdx;
    rimMesh.instanceMatrix.needsUpdate = true;
    if (rimMesh.instanceColor) rimMesh.instanceColor.needsUpdate = true;
    if (rimIdx > 0) rimMesh.computeBoundingSphere();
  }, [
    groundFloorTiles,
    upperFloorTiles,
    watchtowerFloorTiles,
    effectiveViewFloor,
    fogSnapshot,
    fogOfWarEnabled,
    actionMode,
    reachableTiles,
    grid,
  ]);

  // Populate Reachable Movement Zones — Filtered by `effectiveViewFloor` so upper/lower floors don't create double-grid clutter!
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

    const filtered = reachableList.filter((item) => {
      if (item.coord.y === effectiveViewFloor) return true;
      // Pokud ve vybraném patře (effectiveViewFloor) na této [X, Z] souřadnici vůbec není podlaha
      // (např. jednopatrová část zahrady nebo otevřený dvůr), zobrazíme dosažitelnou dlaždici v nižším patře
      const activeTileAtXZ = grid.getTile({
        x: item.coord.x,
        y: effectiveViewFloor,
        z: item.coord.z,
      });
      if (!activeTileAtXZ || !activeTileAtXZ.hasFloor) {
        return item.coord.y < effectiveViewFloor;
      }
      // Tam, kde podlaha v effectiveViewFloor existuje, na jiných patrech zvýrazníme jen podesty schodišť
      const t = grid.getTile(item.coord);
      return Boolean(t?.isLadder || (t?.stairType && t.stairType !== "none"));
    });

    mesh.count = filtered.length;
    filtered.forEach((item, i) => {
      const [wx, wy, wz] = gridToWorld(item.coord);
      _dummy.position.set(wx, wy + 0.028, wz);
      _dummy.rotation.set(-Math.PI * 0.5, 0, 0);
      const isCurrentViewFloor = item.coord.y === effectiveViewFloor;
      const activeTileAtXZ = grid.getTile({
        x: item.coord.x,
        y: effectiveViewFloor,
        z: item.coord.z,
      });
      const isSingleStoryFallback =
        !isCurrentViewFloor && (!activeTileAtXZ || !activeTileAtXZ.hasFloor);
      const scale = isCurrentViewFloor
        ? 0.92
        : isSingleStoryFallback
          ? 0.86
          : 0.58;
      _dummy.scale.set(scale, scale, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      if (item.zone === "blue") {
        _color.setHex(0x38bdf8);
      } else {
        _color.setHex(0xfacc15);
      }
      mesh.setColorAt(i, _color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (filtered.length > 0) mesh.computeBoundingSphere();
  }, [reachableList, actionMode, effectiveViewFloor, grid]);

  // Pointer handlers for Instanced Floor Meshes — s vysokou preferencí aktivního patra (activeFloor)
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
    if (tile) {
      const preferredCoord = resolvePreferredFloorCoord(
        grid,
        tile.coord,
        activeFloor,
      );
      setHoveredTile(preferredCoord);
    }
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
    if (tile) {
      const preferredCoord = resolvePreferredFloorCoord(
        grid,
        tile.coord,
        activeFloor,
      );
      handleTileClick(preferredCoord);
    }
  };

  const onFloorContextMenu = (
    e: ThreeEvent<MouseEvent>,
    tiles: TileData[],
    floor: FloorLevel,
  ) => {
    e.nativeEvent.preventDefault();
    if (wasRecentRightCameraPan()) return;
    if (floor > activeFloor) return;
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx === undefined) return;
    const tile = tiles[idx];
    if (tile) {
      const preferredCoord = resolvePreferredFloorCoord(
        grid,
        tile.coord,
        activeFloor,
      );
      handleTileRightClick(preferredCoord);
    }
  };

  // Cíl pro portálový štítek schodiště (P0↔P1 / P1↔P2): explicitně přepíná / přesouvá do sousedního patra
  const resolveStairPortalTargetCoord = (span: StairSpan): GridCoord => {
    const unitFloor = selectedUnit?.pos.y ?? activeFloor;
    const preferredFloor: FloorLevel =
      unitFloor === span.fromFloor
        ? span.toFloor
        : unitFloor === span.toFloor
          ? span.fromFloor
          : activeFloor === span.fromFloor
            ? span.toFloor
            : span.fromFloor;
    const alternateFloor: FloorLevel =
      preferredFloor === span.toFloor ? span.fromFloor : span.toFloor;

    const prefKey = `${span.x},${preferredFloor},${span.z}`;
    const altKey = `${span.x},${alternateFloor},${span.z}`;
    if (reachableTiles.has(prefKey)) {
      return { x: span.x, y: preferredFloor, z: span.z };
    }
    if (reachableTiles.has(altKey)) {
      return { x: span.x, y: alternateFloor, z: span.z };
    }
    return { x: span.x, y: preferredFloor, z: span.z };
  };

  // Cíl pro samotnou 3D podlahu/stupně schodiště: drží pohyb v aktivním patře (pokud jednotka už nestojí přímo na této podestě)
  const resolveStairFloorCoord = (span: StairSpan): GridCoord => {
    const isSpanOnActive =
      span.fromFloor === activeFloor || span.toFloor === activeFloor;
    const isUnitStandingHereOnActive =
      selectedUnit?.pos.x === span.x &&
      selectedUnit?.pos.z === span.z &&
      selectedUnit?.pos.y === activeFloor;

    if (isSpanOnActive && !isUnitStandingHereOnActive) {
      const sameFloorCoord: GridCoord = {
        x: span.x,
        y: activeFloor,
        z: span.z,
      };
      const sameFloorTile = grid.getTile(sameFloorCoord);
      if (sameFloorTile && sameFloorTile.hasFloor) {
        return sameFloorCoord;
      }
    }
    return resolveStairPortalTargetCoord(span);
  };

  const onStairPointerMove = (
    e: ThreeEvent<PointerEvent>,
    span: StairSpan,
  ) => {
    e.stopPropagation();
    const targetCoord = resolveStairFloorCoord(span);
    setHoveredTile(targetCoord);
  };

  const commandOrInspectStair = (targetCoord: GridCoord) => {
    const reachKey = `${targetCoord.x},${targetCoord.y},${targetCoord.z}`;
    const changesFloor = stairClickChangesFloor(
      useGameStore.getState().inspectKeyHeld,
      actionMode,
      actionMode === "move" && reachableTiles.has(reachKey),
    );
    if (changesFloor) {
      setActiveFloor(targetCoord.y);
      return;
    }
    handleTileClick(targetCoord);
  };

  const onStairClick = (e: ThreeEvent<MouseEvent>, span: StairSpan) => {
    e.stopPropagation();
    commandOrInspectStair(resolveStairFloorCoord(span));
  };

  const onStairContextMenu = (e: ThreeEvent<MouseEvent>, span: StairSpan) => {
    e.nativeEvent.preventDefault();
    if (wasRecentRightCameraPan()) return;
    e.stopPropagation();
    const targetCoord = resolveStairFloorCoord(span);
    handleTileRightClick(targetCoord);
  };

  // A* Path Preview Points se zalomením podél schodišť (ADR-0010 Ticket 05)
  const pathPoints = useMemo(() => {
    if (!selectedUnit || hoveredPath.length === 0) return null;
    const coords: GridCoord[] = [selectedUnit.pos, ...hoveredPath];
    const pts: [number, number, number][] = [];

    for (let i = 0; i < coords.length; i++) {
      const c = coords[i]!;
      const [wx, wy, wz] = gridToWorld(c);
      if (i > 0) {
        const prev = coords[i - 1]!;
        if (prev.y !== c.y) {
          const [pwx, pwy, pwz] = gridToWorld(prev);
          // Přidáme mezilehlé zalomení podél tělesa schodiště
          pts.push([(pwx + wx) * 0.5, (pwy + wy) * 0.5 + 0.14, (pwz + wz) * 0.5]);
        }
      }
      pts.push([wx, wy + 0.14, wz]);
    }
    return pts;
  }, [selectedUnit, hoveredPath]);

  const hoveredReconPreview = useMemo(() => {
    if (
      actionMode !== "move" ||
      !hoveredTile ||
      !hoveredReachable ||
      !selectedUnit ||
      !selectedUnit.alive
    ) {
      return null;
    }
    return previewReconFromTile(
      grid,
      selectedUnit,
      hoveredTile,
      units,
      weather,
      fogSnapshot.visibleEnemyIds,
    );
  }, [
    actionMode,
    hoveredTile,
    hoveredReachable,
    selectedUnit,
    grid,
    units,
    weather,
    fogSnapshot.visibleEnemyIds,
  ]);

  const upperCutaway = effectiveViewFloor < 1;
  const watchtowerCutaway = effectiveViewFloor < 2;
  const canThrowGrenadeHere =
    actionMode === "grenade" &&
    hoveredTile &&
    selectedUnit &&
    gridDistance3D(selectedUnit.pos, hoveredTile) <= 8;

  const isBeaconOnSkiff = Boolean(
    waypoint && escapeTile && sameCoord(waypoint.coord, escapeTile.coord),
  );

  return (
    <group onPointerOut={() => setHoveredTile(null)}>
      {/* 1. Ground Floor (y = 0) Calm Desaturated Tiles (60% Palette) */}
      <instancedMesh
        ref={groundMeshRef}
        args={[undefined, undefined, groundFloorTiles.length]}
        receiveShadow
        onPointerMove={(e) => onFloorPointerMove(e, groundFloorTiles, 0)}
        onClick={(e) => onFloorClick(e, groundFloorTiles, 0)}
        onContextMenu={(e) => onFloorContextMenu(e, groundFloorTiles, 0)}
      >
        <boxGeometry args={[TILE_SIZE * 0.96, 0.16, TILE_SIZE * 0.96]} />
        <meshStandardMaterial roughness={0.86} metalness={0.08} />
      </instancedMesh>

      {/* 2. 1st Floor (y = 1: Piano Nobile & Garden Belvedere) with Clean Cutaway */}
      <instancedMesh
        ref={upperMeshRef}
        args={[undefined, undefined, upperFloorTiles.length]}
        castShadow={!upperCutaway}
        receiveShadow
        raycast={
          activeFloor < 1 ? () => null : THREE.InstancedMesh.prototype.raycast
        }
        onPointerMove={(e) => onFloorPointerMove(e, upperFloorTiles, 1)}
        onClick={(e) => onFloorClick(e, upperFloorTiles, 1)}
        onContextMenu={(e) => onFloorContextMenu(e, upperFloorTiles, 1)}
      >
        <boxGeometry args={[TILE_SIZE * 0.96, 0.16, TILE_SIZE * 0.96]} />
        <meshStandardMaterial
          roughness={0.78}
          metalness={0.08}
          transparent={upperCutaway}
          opacity={upperCutaway ? 0.04 : 1}
          depthWrite={!upperCutaway}
        />
      </instancedMesh>

      {/* 2b. 2nd Floor (y = 2: Maltese Watchtower) with Clean Cutaway */}
      <instancedMesh
        ref={watchtowerMeshRef}
        args={[undefined, undefined, Math.max(1, watchtowerFloorTiles.length)]}
        count={watchtowerFloorTiles.length}
        castShadow={!watchtowerCutaway}
        receiveShadow
        raycast={
          activeFloor < 2 ? () => null : THREE.InstancedMesh.prototype.raycast
        }
        onPointerMove={(e) => onFloorPointerMove(e, watchtowerFloorTiles, 2)}
        onClick={(e) => onFloorClick(e, watchtowerFloorTiles, 2)}
        onContextMenu={(e) => onFloorContextMenu(e, watchtowerFloorTiles, 2)}
      >
        <boxGeometry args={[TILE_SIZE * 0.96, 0.16, TILE_SIZE * 0.96]} />
        <meshStandardMaterial
          roughness={0.78}
          metalness={0.08}
          transparent={watchtowerCutaway}
          opacity={watchtowerCutaway ? 0.04 : 1}
          depthWrite={!watchtowerCutaway}
        />
      </instancedMesh>

      {/* 3. Ground Floor Baroque Low Walls + Sculpted Sandstone / Gilded Coping Ledge */}
      <instancedMesh
        ref={low0MeshRef}
        args={[undefined, undefined, 128]}
        count={obstacles.low0.length}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[TILE_SIZE * 0.84, 0.82, TILE_SIZE * 0.84]} />
        <meshStandardMaterial roughness={0.72} metalness={0.14} />
      </instancedMesh>
      <instancedMesh
        ref={low0CapMeshRef}
        args={[undefined, undefined, 128]}
        count={obstacles.low0.length}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[TILE_SIZE * 0.92, 0.09, TILE_SIZE * 0.92]} />
        <meshStandardMaterial roughness={0.55} metalness={0.28} />
      </instancedMesh>

      {/* 4. Ground Floor High Baroque Masonry Walls */}
      <instancedMesh
        ref={high0MeshRef}
        args={[undefined, undefined, 128]}
        count={obstacles.high0.length}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[TILE_SIZE * 0.96, FLOOR_HEIGHT, TILE_SIZE * 0.96]} />
        <meshStandardMaterial roughness={0.75} metalness={0.14} />
      </instancedMesh>

      {/* 5. Ground Floor Baroque Pillars + Gilded Corinthian Capitals */}
      <instancedMesh
        ref={pillar0MeshRef}
        args={[undefined, undefined, 64]}
        count={obstacles.pillar0.length}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.44, 0.54, FLOOR_HEIGHT, 14]} />
        <meshStandardMaterial roughness={0.58} metalness={0.2} />
      </instancedMesh>
      <instancedMesh
        ref={pillar0CapMeshRef}
        args={[undefined, undefined, 64]}
        count={obstacles.pillar0.length}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[1.12, 0.24, 1.12]} />
        <meshStandardMaterial roughness={0.45} metalness={0.38} />
      </instancedMesh>

      {/* 5b. Ground Floor Explosive Powder Kegs */}
      <instancedMesh
        ref={kegs0MeshRef}
        args={[undefined, undefined, 16]}
        count={obstacles.kegs0.length}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.35, 0.32, 0.72, 14]} />
        <meshStandardMaterial roughness={0.5} metalness={0.35} />
      </instancedMesh>

      {/* 6. 1st Floor (Piano Nobile) Obstacles */}
      <instancedMesh
        ref={low1MeshRef}
        args={[undefined, undefined, 64]}
        count={obstacles.low1.length}
        castShadow={!upperCutaway}
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[TILE_SIZE * 0.85, 0.84, TILE_SIZE * 0.85]} />
        <meshStandardMaterial
          roughness={0.75}
          transparent={upperCutaway}
          opacity={upperCutaway ? 0.04 : 1}
          depthWrite={!upperCutaway}
        />
      </instancedMesh>

      <instancedMesh
        ref={pillar1MeshRef}
        args={[undefined, undefined, 64]}
        count={obstacles.pillar1.length}
        castShadow={!upperCutaway}
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.42, 0.48, 2.0, 12]} />
        <meshStandardMaterial
          roughness={0.65}
          transparent={upperCutaway}
          opacity={upperCutaway ? 0.04 : 1}
          depthWrite={!upperCutaway}
        />
      </instancedMesh>

      {/* 6a. 2nd Floor (Maltese Watchtower) Obstacles */}
      <instancedMesh
        ref={low2MeshRef}
        args={[undefined, undefined, 32]}
        count={obstacles.low2.length}
        castShadow={!watchtowerCutaway}
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[TILE_SIZE * 0.85, 0.84, TILE_SIZE * 0.85]} />
        <meshStandardMaterial
          roughness={0.75}
          transparent={watchtowerCutaway}
          opacity={watchtowerCutaway ? 0.04 : 1}
          depthWrite={!watchtowerCutaway}
        />
      </instancedMesh>

      <instancedMesh
        ref={pillar2MeshRef}
        args={[undefined, undefined, 32]}
        count={obstacles.pillar2.length}
        castShadow={!watchtowerCutaway}
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.42, 0.48, 2.0, 12]} />
        <meshStandardMaterial
          roughness={0.65}
          transparent={watchtowerCutaway}
          opacity={watchtowerCutaway ? 0.04 : 1}
          depthWrite={!watchtowerCutaway}
        />
      </instancedMesh>

      {/* 6b. Living Battlefield Props & Biome Details */}
      <BaroqueLivingDecor
        pillars={obstacles.pillar0}
        lowWalls={obstacles.low0}
        highWalls={obstacles.high0}
        kegs={obstacles.kegs0}
        groundTiles={groundFloorTiles}
        upperTiles={upperFloorTiles}
      />

      {/* 6c. Nocturnal Fog of War Shroud Veil & Chiaroscuro Torchlight Frontier Rim */}
      <instancedMesh
        ref={fogVeilMeshRef}
        args={[undefined, undefined, 1024]}
        raycast={() => null}
      >
        <planeGeometry args={[TILE_SIZE * 0.98, TILE_SIZE * 0.98]} />
        <meshBasicMaterial
          transparent
          opacity={0.44}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={frontierRimMeshRef}
        args={[undefined, undefined, 512]}
        raycast={() => null}
      >
        <ringGeometry args={[TILE_SIZE * 0.43, TILE_SIZE * 0.49, 4]} />
        <meshBasicMaterial
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 7. Reachable Movement Zone Tiles (Floor-Filtered for Clarity) */}
      <instancedMesh
        ref={zoneMeshRef}
        args={[undefined, undefined, 1024]}
        raycast={() => null}
      >
        <planeGeometry args={[TILE_SIZE * 0.9, TILE_SIZE * 0.9]} />
        <meshBasicMaterial
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 7b. Diegetické barokní štíty krytu přilepené přímo na zdech a překážkách (Pillar 3) */}
      {contextualCoverObstacles.map(({ key, worldPos, type, isHoveredFocus }) => (
        <WorldHtml
          key={`wall-cover-${key}`}
          position={worldPos}
          center
          distanceFactor={16.5}
          minScale={0.6}
          maxScale={1.1}
          zIndexRange={[8, 0]}
          style={{
            pointerEvents: "none",
            opacity: isHoveredFocus ? 0.96 : 0.72,
          }}
        >
          <div
            className={`rounded-md p-0.5 backdrop-blur-sm shadow-lg transition-transform ${
              isHoveredFocus
                ? "bg-slate-950/85 ring-1 ring-amber-400/70 scale-105"
                : "bg-slate-950/65"
            }`}
          >
            <BaroqueCoverBadge cover={type} size="sm" />
          </div>
        </WorldHtml>
      ))}

      {/* 8. 3D Baroque Straight & Spiral Staircases + Interactive Diegetic Staircase Portal Badges */}
      {obstacles.stairs.map((span) => {
        const spanOpacity =
          span.fromFloor > effectiveViewFloor ? 0.22 : 1.0;
        const targetCoord = resolveStairPortalTargetCoord(span);
        const reachInfo = reachableTiles.get(
          `${targetCoord.x},${targetCoord.y},${targetCoord.z}`,
        );
        const isHoveredStair =
          hoveredTile?.x === span.x && hoveredTile?.z === span.z;
        const isGoingUp = targetCoord.y > (selectedUnit?.pos.y ?? activeFloor);

        // Zobrazíme přehledný interaktivní štítek schodiště (vynecháme duplicitní štítek na 10,19 vedle 9,19, aby se nepřekrývaly)
        const showPortalBadge =
          !isShootingView &&
          !(span.x === 10 && span.z === 19) &&
          (span.fromFloor === activeFloor ||
            span.toFloor === activeFloor ||
            Boolean(reachInfo));

        const [sx, sy, sz] = gridToWorld({
          x: span.x,
          y: span.fromFloor,
          z: span.z,
        });
        const badgeX =
          span.stairType === "grand_stairs"
            ? sx + TILE_SIZE * 0.5
            : span.x === 9 && span.z === 19
              ? sx + TILE_SIZE * 0.5
              : sx;

        return (
          <group
            key={`stair-group-${span.x}-${span.z}-${span.fromFloor}-${span.toFloor}`}
          >
            {span.stairType === "spiral_stairs" ? (
              <BaroqueSpiralStaircase
                span={span}
                opacity={spanOpacity}
                isHighlighted={isHoveredStair || Boolean(reachInfo)}
                onHover={onStairPointerMove}
                onClick={onStairClick}
                onContextMenu={onStairContextMenu}
              />
            ) : span.stairType === "grand_stairs" ? (
              span.x === 11 && span.z === 22 ? (
                <BaroqueImperialGrandStaircase
                  span={span}
                  opacity={spanOpacity}
                  isHighlighted={isHoveredStair || Boolean(reachInfo)}
                  onHover={onStairPointerMove}
                  onClick={onStairClick}
                  onContextMenu={onStairContextMenu}
                />
              ) : null
            ) : (
              <BaroqueStraightStaircase
                span={span}
                opacity={spanOpacity}
                isHighlighted={isHoveredStair || Boolean(reachInfo)}
                onHover={onStairPointerMove}
                onClick={onStairClick}
                onContextMenu={onStairContextMenu}
              />
            )}

            {showPortalBadge && (span.stairType !== "grand_stairs" || (span.x === 11 && span.z === 22)) && (
              <WorldHtml
                position={[badgeX, sy + FLOOR_HEIGHT * 0.58, sz]}
                center
                distanceFactor={19}
                zIndexRange={[12, 0]}
                style={{ pointerEvents: "none" }}
              >
                <div
                  onMouseEnter={() => setHoveredTile(targetCoord)}
                  onMouseLeave={() => setHoveredTile(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    commandOrInspectStair(targetCoord);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (wasRecentRightCameraPan()) return;
                    handleTileRightClick(targetCoord);
                  }}
                  style={{ pointerEvents: "auto", cursor: "pointer" }}
                  title={
                    reachInfo
                      ? text("ui.stair.climb", { floor: targetCoord.y, count: reachInfo.apCost }, locale)
                      : text("ui.stair.look", { floor: targetCoord.y }, locale)
                  }
                  className={`select-none flex items-center gap-1 px-2 py-0.5 rounded-lg border backdrop-blur-md shadow-xl transition-all whitespace-nowrap ${
                    isHoveredStair
                      ? "bg-amber-950/95 border-amber-300 scale-110 shadow-[0_0_16px_rgba(251,191,36,0.55)]"
                      : reachInfo
                        ? reachInfo.zone === "blue"
                          ? "bg-slate-950/95 border-sky-400/90 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                          : "bg-slate-950/95 border-amber-400/90 text-amber-200 shadow-[0_0_12px_rgba(250,204,21,0.35)]"
                        : "bg-slate-950/85 border-amber-800/80 text-amber-200/90 hover:border-amber-400"
                  }`}
                >
                  {isGoingUp ? (
                    <ArrowUp className="w-3 h-3 text-amber-400 shrink-0" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-sky-400 shrink-0" />
                  )}
                  <span className="font-cinzel font-black text-[10px] tracking-wide">
                    P{span.fromFloor}↔P{span.toFloor}
                  </span>
                  {reachInfo ? (
                    <span
                      className={`px-1 py-0.2 rounded text-[9px] font-cinzel font-black tabular-nums ${
                        reachInfo.zone === "blue"
                          ? "bg-sky-500/30 text-sky-200"
                          : "bg-amber-500/30 text-amber-200"
                      }`}
                    >
                      {reachInfo.apCost} AP
                    </span>
                  ) : (
                    <Eye className="w-2.5 h-2.5 text-amber-400/80 ml-0.5" />
                  )}
                </div>
              </WorldHtml>
            )}
          </group>
        );
      })}

      {/* 8a. 3D Barokní dveře a kované brány (Free Action 0 AP) */}
      {obstacles.doors.map((door) => {
        // U dvoukřídlých dveří vykreslí pravé křídlo přímo levé křídlo (BaroqueGrandDoublePortal3D),
        // takže přeskočíme samostatné renderování pro leafRole === 'right'
        if (door.isDoubleLeaf && door.leafRole === "right") {
          return null;
        }

        const doorOpacity = door.coord.y > effectiveViewFloor ? 0.08 : 1.0;
        const isAdjacentToSelected =
          selectedUnit &&
          selectedUnit.alive &&
          selectedUnit.pos.y === door.coord.y &&
          ((Math.abs(selectedUnit.pos.x - door.coord.x) <= 1 &&
            Math.abs(selectedUnit.pos.z - door.coord.z) <= 1) ||
            (door.pairedCoord &&
              Math.abs(selectedUnit.pos.x - door.pairedCoord.x) <= 1 &&
              Math.abs(selectedUnit.pos.z - door.pairedCoord.z) <= 1));

        if (door.isDoubleLeaf && door.pairedCoord) {
          const pairedDoor = grid.getDoor(door.pairedCoord);
          return (
            <BaroqueGrandDoublePortal3D
              key={`double-door-${door.id}`}
              door={door}
              pairedDoor={pairedDoor}
              isAdjacent={Boolean(isAdjacentToSelected && !isShootingView)}
              opacity={doorOpacity}
              onToggle={toggleDoor}
            />
          );
        }

        return (
          <BaroqueDoor3D
            key={`door-${door.id}`}
            door={door}
            isAdjacent={Boolean(isAdjacentToSelected && !isShootingView)}
            opacity={doorOpacity}
            onToggle={toggleDoor}
          />
        );
      })}

      {/* 8b. 3D Rybářská pramice (Fisherman's Skiff at Čertovka - bound to escape zone tile) */}
      {(() => {
        const boatX = escapeTile ? escapeTile.coord.x - 0.55 : 2.45;
        const boatZ = escapeTile ? escapeTile.coord.z : 2.0;
        const [bx, by, bz] = continuousGridToWorld(boatX, 0, boatZ);
        return (
          <group position={[bx, by - 0.05, bz]} rotation={[0, 0.25, 0]}>
            <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.42, 2.2]} />
              <meshStandardMaterial color="#5c3821" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[0.74, 0.36, 1.95]} />
              <meshStandardMaterial color="#3d2414" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.22, 0.32]}>
              <boxGeometry args={[0.74, 0.08, 0.22]} />
              <meshStandardMaterial color="#78472a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.22, -0.42]}>
              <boxGeometry args={[0.74, 0.08, 0.22]} />
              <meshStandardMaterial color="#78472a" roughness={0.7} />
            </mesh>
            <mesh position={[0.44, 0.3, 0]} rotation={[0.2, 0, -0.38]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 1.7, 6]} />
              <meshStandardMaterial color="#b45309" roughness={0.6} />
            </mesh>
            <group position={[0, 0.42, 1.05]}>
              <mesh>
                <boxGeometry args={[0.14, 0.2, 0.14]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  emissive="#fbbf24"
                  emissiveIntensity={2.4}
                />
              </mesh>
              <pointLight color="#fbbf24" intensity={4.5} distance={6.5} />
            </group>
            <mesh position={[0, -0.04, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
              <ringGeometry args={[1.1, 1.35, 24]} />
              <meshBasicMaterial
                color="#facc15"
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
            {!isBeaconOnSkiff && (
              <WorldHtml
                center
                position={[0, 1.15, 0]}
                distanceFactor={18}
                zIndexRange={[8, 0]}
                style={{ pointerEvents: "none" }}
              >
                <div className="pointer-events-none select-none flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/95 border border-amber-400 text-amber-300 font-cinzel font-black text-[11px] uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.5)] backdrop-blur-md whitespace-nowrap">
                  <span>⛵</span>
                  <span>{text("ui.boat.certovka", undefined, locale)}</span>
                </div>
              </WorldHtml>
            )}
          </group>
        );
      })()}

      {/* 10. Hovered Tile Cursor & 3x3 Grenade AoE Preview & Dynamic Tile Cover Preview */}
      {hoveredTile && (
        <group position={gridToWorld(hoveredTile)}>
          {/* Svislá kotva kurzoru (Cursor Drop Line) k zemi (ADR-0010 Ticket 05) */}
          {hoveredTile.y > 0 && (
            <>
              <Line
                points={[
                  [0, 0, 0],
                  [0, -(hoveredTile.y * FLOOR_HEIGHT), 0],
                ]}
                color="#facc15"
                dashed
                dashScale={8}
                dashSize={0.25}
                gapSize={0.15}
                lineWidth={2.2}
                transparent
                opacity={0.7}
              />
              <mesh
                position={[0, -(hoveredTile.y * FLOOR_HEIGHT) + 0.02, 0]}
                rotation={[-Math.PI * 0.5, 0, 0]}
              >
                <ringGeometry args={[TILE_SIZE * 0.22, TILE_SIZE * 0.28, 16]} />
                <meshBasicMaterial
                  color="#facc15"
                  transparent
                  opacity={0.65}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </>
          )}

          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
            <ringGeometry args={[TILE_SIZE * 0.38, TILE_SIZE * 0.48, 4]} />
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

          {actionMode === "move" && hoveredReachable && (
            <WorldHtml
              anchor="bottom"
              position={[0, 0.38, 0]}
              distanceFactor={16}
              minScale={0.68}
              maxScale={1.1}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "none" }}
              className="pointer-events-none select-none"
            >
              <div className="pointer-events-none select-none flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-amber-400/70 backdrop-blur-md shadow-xl text-slate-100 whitespace-nowrap">
                {selectedUnit && hoveredTile.y !== selectedUnit.pos.y && (
                  <span className="px-1 rounded bg-amber-500/30 text-[9px] font-cinzel font-black text-amber-200 tabular-nums">
                    {hoveredTile.y > selectedUnit.pos.y
                      ? `↑P${hoveredTile.y}`
                      : `↓P${hoveredTile.y}`}
                  </span>
                )}

                <span
                  className={`text-[10px] font-cinzel font-black tabular-nums ${
                    hoveredReachable.zone === "yellow"
                      ? "text-amber-300"
                      : "text-sky-300"
                  }`}
                >
                  {hoveredReachable.zone === "yellow" ? "2 AP" : "1 AP"}
                </span>

                <span className="text-[8px] font-cinzel font-bold text-amber-200/75 uppercase tracking-tight">
                  [PKM]
                </span>

                {hoveredReconPreview &&
                  hoveredReconPreview.spottedEnemyIds.length > 0 && (
                    <span
                      title={text("ui.recon.los", undefined, locale)}
                      className="flex items-center gap-0.5 pl-1 border-l border-amber-500/30 text-[9px] font-cinzel font-black text-rose-300 tabular-nums"
                    >
                      <span>🎯</span>
                      <span>{hoveredReconPreview.spottedEnemyIds.length}</span>
                    </span>
                  )}

                {fogOfWarEnabled &&
                  hoveredReconPreview &&
                  hoveredReconPreview.newlyRevealedCount > 0 && (
                    <span
                      title={text("ui.recon.revealed", undefined, locale)}
                      className="flex items-center gap-0.5 pl-1 border-l border-amber-500/30 text-[9px] font-cinzel font-black text-amber-300 tabular-nums"
                    >
                      <span>👁️</span>
                      <span>+{hoveredReconPreview.newlyRevealedCount}</span>
                    </span>
                  )}
              </div>
            </WorldHtml>
          )}

          {actionMode === "grenade" && (
            <WorldHtml
              anchor="bottom"
              position={[0, 0.38, 0]}
              distanceFactor={16}
              minScale={0.68}
              maxScale={1.1}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "none" }}
              className="pointer-events-none select-none"
            >
              <div
                className={`pointer-events-none select-none flex items-center gap-1 px-1.5 py-0.5 rounded-md border backdrop-blur-md shadow-xl text-[9px] font-cinzel font-black whitespace-nowrap ${
                  canThrowGrenadeHere
                    ? "bg-orange-950/90 border-orange-400 text-amber-100"
                    : "bg-red-950/90 border-red-400 text-rose-200"
                }`}
              >
                <span>
                  {canThrowGrenadeHere
                    ? text("ui.grenade.throw", undefined, locale)
                    : text("ui.grenade.out", undefined, locale)}
                </span>
                <span className="text-amber-300/80 pl-1 border-l border-amber-500/30">
                  {text("ui.grenade.back", undefined, locale)}
                </span>
              </div>
            </WorldHtml>
          )}

          {canThrowGrenadeHere && (
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
              <planeGeometry args={[TILE_SIZE * 3, TILE_SIZE * 3]} />
              <meshBasicMaterial
                color="#f97316"
                transparent
                opacity={0.32}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      )}

      {/* 11. A* Path Preview Ribbon */}
      {pathPoints && pathPoints.length >= 2 && (
        <Line
          points={pathPoints}
          color={hoveredReachable?.zone === "yellow" ? "#facc15" : "#38bdf8"}
          lineWidth={4.0}
        />
      )}

      {/* 12. Tutorial Waypoint Beacon */}
      {waypoint && (
        <TutorialWaypointBeacon
          coord={waypoint.coord}
          label={waypoint.label}
          accentColor={waypoint.color}
        />
      )}
    </group>
  );
}
