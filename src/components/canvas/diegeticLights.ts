/**
 * Diegetic light census (ADR-0015).
 * Pure: no Three.js objects and no React. Fixtures, rain, muzzle tip, and
 * the steady-light budget all live here so a headless test can pin them.
 *
 * The soldier mesh faces local +Z when its yaw is 0 (facing south). Yaw is
 * the same table `UnitVisual3D` uses. A world offset is that yaw applied to
 * a local point, matching Three.js `rotation.y`:
 *   x' = x cos θ + z sin θ
 *   z' = -x sin θ + z cos θ
 * Local +X is the musket side. Local +Z is the barrel.
 */

import {
  isEnclosedRoofedCoord,
  GRID_DEPTH,
  GRID_WIDTH,
} from "../../core/GridSystem";
import type {
  CardinalDir,
  FirearmLockType,
  FloorLevel,
  GridCoord,
  UnitData,
  WeatherType,
} from "../../core/types";
import { FLOOR_HEIGHT, TILE_SIZE } from "./worldCoords";

export const RAIN_GUTTER = 0.55;
export const FOG_RADIUS_SCALE = 0.75;
export const BLAST_DUCK = 0.18;
export const RAIN_GLINT_RADIUS = 2.2;

export const MAX_CANDELABRA_SLOTS = 4;
export const MAX_TORCH_SLOTS = 3;
export const MAX_MATCHCORD_SLOTS = 2;
export const MAX_BLAST_LIGHTS = 2;
export const MAX_MUZZLE_LIGHTS = 1;

/**
 * 1. Nebeský světelný zdroj (Celestial Directional Light, ADR-0018).
 * Mission 1: Chladný půlnoční měsíc [14, 28, 13].
 * Mission 2: Ranní slunce vycházející na východě [22, 24, 8] nad Starým Městem.
 */
export const MISSION1_MOON_POSITION: readonly [number, number, number] = [14, 28, 13];
export const MISSION2_SUN_POSITION: readonly [number, number, number] = [22, 24, 8];

/** Ranní sluneční odlesk Vltavy (ADR-0018) */
export const VLTAVA_SUN_SPECULAR_COLOR = "#fef3c7";

/** Barrel tip, metres in the soldier's local frame (ADR-0007). */
export const MUZZLE_FORWARD_M = 0.58;
export const MUZZLE_RIGHT_M = 0.14;
export const MUZZLE_HEIGHT_M = 1.05;

/** Matchcord / pan, closer to the lock than the muzzle. */
export const LOCK_FORWARD_M = 0.22;
export const LOCK_RIGHT_M = 0.06;
export const LOCK_HEIGHT_M = 1.02;

export const CANDELABRUM_COLOR = "#fde68a";
export const TORCH_COLOR = "#f97316";
export const MATCHCORD_COLOR = "#ea580c";
export const LANTERN_COLOR = "#fbbf24";

export const MATCHCORD_RADIUS = 2.2;
export const MATCHCORD_INTENSITY = 1.15;

/**
 * Yaw shared with the 3D soldier. Facing south is 0 and the musket points +Z.
 * East is +π/2, which turns local +Z onto world +X.
 */
export const FACING_YAW: Record<CardinalDir, number> = {
  S: 0,
  E: Math.PI * 0.5,
  N: Math.PI,
  W: -Math.PI * 0.5,
};

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export interface FixtureDef {
  id: string;
  kind: "candelabrum" | "torch";
  coord: GridCoord;
  /** Metres from the tile origin. The flame, not the tile center, is the light. */
  offset: readonly [number, number, number];
  color: string;
  radius: number;
  intensity: number;
}

export interface FixtureState {
  id: string;
  kind: "candelabrum" | "torch" | "lantern";
  coord: GridCoord;
  position: WorldPoint;
  color: string;
  radius: number;
  intensity: number;
  roofed: boolean;
  exposed: boolean;
  snuffed: boolean;
  ducked: boolean;
}

export interface PracticalSample {
  id: string;
  kind: FixtureState["kind"] | "matchcord";
  position: WorldPoint;
  color: string;
  radius: number;
  intensity: number;
  exposed: boolean;
}

export interface MatchcordCandidate {
  id: string;
  position: WorldPoint;
  shrouded: boolean;
  lockType: FirearmLockType;
  roofed: boolean;
}

export interface FlashBudgetItem {
  kind: "blast" | "muzzle";
  createdAt: number;
  durationMs: number;
}

/**
 * Colloredo's house: two table candelabra in the bedroom and study,
 * two gilt sconces on the Knight's Hall pillars. Flames sit on the
 * tile perimeter so the grid center stays clear.
 */
export const CANDELABRA: readonly FixtureDef[] = [
  {
    id: "candelabrum-bedroom-west",
    kind: "candelabrum",
    coord: { x: 4, y: 1, z: 24 },
    offset: [-0.35, 1.15, 0],
    color: CANDELABRUM_COLOR,
    radius: 5.5,
    intensity: 3.0,
  },
  {
    id: "candelabrum-bedroom-south",
    kind: "candelabrum",
    coord: { x: 6, y: 1, z: 25 },
    offset: [0, 1.15, 0.35],
    color: "#fbbf24",
    radius: 5.5,
    intensity: 2.8,
  },
  {
    id: "sconce-hall-west",
    kind: "candelabrum",
    coord: { x: 9, y: 1, z: 22 },
    offset: [0.48, 1.72, 0],
    color: CANDELABRUM_COLOR,
    radius: 5.2,
    intensity: 2.6,
  },
  {
    id: "sconce-hall-east",
    kind: "candelabrum",
    coord: { x: 14, y: 1, z: 22 },
    offset: [-0.48, 1.72, 0],
    color: CANDELABRUM_COLOR,
    radius: 5.2,
    intensity: 2.6,
  },
];

/**
 * Wrought-iron cressets on real pillars. Courtyard brackets face the open
 * well. The pillar cell itself sits on the arcade lip, so
 * `isEnclosedRoofedCoord` would call it roofed; the flame is still in the rain.
 */
export const TORCHES: readonly FixtureDef[] = [
  {
    id: "torch-court-nw",
    kind: "torch",
    coord: { x: 9, y: 0, z: 17 },
    offset: [0.55, 1.86, 0],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 5.4,
  },
  {
    id: "torch-court-ne",
    kind: "torch",
    coord: { x: 14, y: 0, z: 17 },
    offset: [-0.55, 1.86, 0],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 5.4,
  },
  {
    id: "torch-court-sw",
    kind: "torch",
    coord: { x: 9, y: 0, z: 19 },
    offset: [0.55, 1.86, 0],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 5.2,
  },
  {
    id: "torch-court-se",
    kind: "torch",
    coord: { x: 14, y: 0, z: 19 },
    offset: [-0.55, 1.86, 0],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 5.2,
  },
  {
    id: "torch-garden-w",
    kind: "torch",
    coord: { x: 6, y: 0, z: 11 },
    offset: [0.5, 1.86, 0],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 5.0,
  },
  {
    id: "torch-garden-e",
    kind: "torch",
    coord: { x: 17, y: 0, z: 11 },
    offset: [-0.5, 1.86, 0],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 5.0,
  },
  {
    id: "torch-garden-sw",
    kind: "torch",
    coord: { x: 9, y: 0, z: 8 },
    offset: [0, 1.86, 0.5],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 4.8,
  },
  {
    id: "torch-garden-se",
    kind: "torch",
    coord: { x: 14, y: 0, z: 8 },
    offset: [0, 1.86, 0.5],
    color: TORCH_COLOR,
    radius: 7.5,
    intensity: 4.8,
  },
];

export const FIXTURES: readonly FixtureDef[] = [...CANDELABRA, ...TORCHES];

/**
 * Bridge & Old Town Bridge Tower practical fixtures (Mission 2).
 * Outdoor wrought-iron cressets ("torch") light the sandstone bridge parapets
 * and the west gate threshold; roofed tower sconces ("candelabrum") use the
 * 4 candelabrum slots to light the vaulted passage, windlass hall, and gallery.
 */
export const BRIDGE_TORCHES: readonly FixtureDef[] = [
  {
    id: "torch-bridge-mid-n",
    kind: "torch",
    coord: { x: 4, y: 0, z: 11 },
    offset: [0, 1.45, -0.42],
    color: TORCH_COLOR,
    radius: 11.5,
    intensity: 7.4,
  },
  {
    id: "torch-bridge-mid-s",
    kind: "torch",
    coord: { x: 4, y: 0, z: 16 },
    offset: [0, 1.45, 0.42],
    color: TORCH_COLOR,
    radius: 11.5,
    intensity: 7.4,
  },
  {
    id: "torch-tower-west-n",
    kind: "torch",
    coord: { x: 10, y: 0, z: 12 },
    offset: [-0.42, 1.85, -0.35],
    color: TORCH_COLOR,
    radius: 11.0,
    intensity: 7.6,
  },
  {
    id: "sconce-tower-west-s",
    kind: "candelabrum",
    coord: { x: 10, y: 0, z: 16 },
    offset: [-0.42, 1.85, 0.35],
    color: TORCH_COLOR,
    radius: 10.5,
    intensity: 6.0,
  },
  {
    id: "sconce-passage-vault",
    kind: "candelabrum",
    coord: { x: 14, y: 0, z: 12 },
    offset: [0, 1.75, -0.38],
    color: CANDELABRUM_COLOR,
    radius: 9.0,
    intensity: 5.0,
  },
  {
    id: "sconce-tower-hall",
    kind: "candelabrum",
    coord: { x: 12, y: 1, z: 12 },
    offset: [0.35, 1.7, -0.35],
    color: CANDELABRUM_COLOR,
    radius: 8.5,
    intensity: 4.8,
  },
  {
    id: "sconce-tower-gallery",
    kind: "candelabrum",
    coord: { x: 15, y: 2, z: 14 },
    offset: [0.35, 1.7, -0.35],
    color: CANDELABRUM_COLOR,
    radius: 8.5,
    intensity: 4.8,
  },
];

export function fixturesForScenario(
  scenario: "mission1" | "mission2",
): readonly FixtureDef[] {
  return scenario === "mission2" ? BRIDGE_TORCHES : FIXTURES;
}

/** Bow lantern on the Čertovka skiff. Same yaw as the boat mesh. */
export const SKIFF_YAW = 0.25;

function tileWorld(x: number, y: number, z: number): WorldPoint {
  return {
    x: (x - (GRID_WIDTH - 1) * 0.5) * TILE_SIZE,
    y: y * FLOOR_HEIGHT,
    z: (z - (GRID_DEPTH - 1) * 0.5) * TILE_SIZE,
  };
}

export function fixtureWorld(fixture: FixtureDef): WorldPoint {
  const origin = tileWorld(fixture.coord.x, fixture.coord.y, fixture.coord.z);
  return {
    x: origin.x + fixture.offset[0],
    y: origin.y + fixture.offset[1],
    z: origin.z + fixture.offset[2],
  };
}

export function skiffLanternWorld(escape: { x: number; z: number } | null): WorldPoint {
  const boatX = escape ? escape.x - 0.55 : 2.45;
  const boatZ = escape ? escape.z : 2.0;
  const boat = tileWorld(boatX, 0, boatZ);
  const localZ = 1.05;
  const sin = Math.sin(SKIFF_YAW);
  const cos = Math.cos(SKIFF_YAW);
  return {
    x: boat.x + localZ * sin,
    y: boat.y - 0.05 + 0.42,
    z: boat.z + localZ * cos,
  };
}

export function facingBasis(facing: CardinalDir): {
  forward: [number, number];
  right: [number, number];
} {
  const yaw = FACING_YAW[facing];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    forward: [sin, cos],
    right: [cos, -sin],
  };
}

/** World XZ the soldier faces. Recoil kicks the opposite way. */
export function facingForward(facing: CardinalDir): [number, number] {
  return facingBasis(facing).forward;
}

export function muzzleTip(
  origin: GridCoord,
  facing: CardinalDir,
  misfire: boolean,
): WorldPoint {
  const base = tileWorld(origin.x, origin.y, origin.z);
  const { forward, right } = facingBasis(facing);
  const ahead = misfire ? LOCK_FORWARD_M : MUZZLE_FORWARD_M;
  const side = misfire ? LOCK_RIGHT_M : MUZZLE_RIGHT_M;
  const height = misfire ? LOCK_HEIGHT_M : MUZZLE_HEIGHT_M;
  return {
    x: base.x + forward[0] * ahead + right[0] * side,
    y: base.y + height,
    z: base.z + forward[1] * ahead + right[1] * side,
  };
}

export function muzzleFlashDraft(
  origin: GridCoord,
  facing: CardinalDir,
  misfire: boolean,
): {
  kind: "muzzle";
  coord: GridCoord;
  world: WorldPoint;
  color: string;
  intensity: number;
  radius: number;
  durationMs: number;
} {
  return {
    kind: "muzzle",
    coord: origin,
    world: muzzleTip(origin, facing, misfire),
    color: misfire ? "#fb923c" : "#fde047",
    intensity: misfire ? 2.4 : 8,
    radius: misfire ? 2.6 : 6,
    durationMs: misfire ? 90 : 120,
  };
}

function applyWeather(
  baseIntensity: number,
  baseRadius: number,
  exposed: boolean,
  weather: WeatherType,
  ducked: boolean,
  snuffed: boolean,
): { intensity: number; radius: number } {
  if (snuffed) return { intensity: 0, radius: baseRadius };
  let intensity = baseIntensity;
  if (exposed && weather === "rain") intensity *= RAIN_GUTTER;
  if (ducked) intensity *= BLAST_DUCK;
  const radius = weather === "fog" ? baseRadius * FOG_RADIUS_SCALE : baseRadius;
  return { intensity, radius };
}

export function evaluateFixture(
  fixture: FixtureDef,
  weather: WeatherType,
  damageLevel: number,
  ducked: boolean,
): FixtureState {
  const snuffed = damageLevel >= 2;
  const exposed = fixture.kind === "torch";
  const roofed = !exposed;
  const lit = applyWeather(
    fixture.intensity,
    fixture.radius,
    exposed,
    weather,
    ducked,
    snuffed,
  );
  return {
    id: fixture.id,
    kind: fixture.kind,
    coord: fixture.coord,
    position: fixtureWorld(fixture),
    color: fixture.color,
    radius: lit.radius,
    intensity: lit.intensity,
    roofed,
    exposed,
    snuffed,
    ducked,
  };
}

export function evaluateLantern(
  escape: GridCoord | null,
  weather: WeatherType,
  damageLevel: number,
  ducked: boolean,
): FixtureState {
  const coord: GridCoord = escape ?? { x: 3, y: 0, z: 2 };
  const snuffed = damageLevel >= 2;
  const lit = applyWeather(4.8, 6.5, true, weather, ducked, snuffed);
  return {
    id: "skiff-lantern",
    kind: "lantern",
    coord,
    position: skiffLanternWorld(escape),
    color: LANTERN_COLOR,
    radius: lit.radius,
    intensity: lit.intensity,
    roofed: false,
    exposed: true,
    snuffed,
    ducked,
  };
}

function dist2(a: WorldPoint, b: WorldPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function selectSteadySlots(
  fixtures: readonly FixtureState[],
  matchcords: readonly MatchcordCandidate[],
  camera: WorldPoint,
  viewFloor: FloorLevel,
  weather: WeatherType,
): PracticalSample[] {
  const visible = fixtures.filter(
    (fixture) => !fixture.snuffed && fixture.coord.y <= viewFloor,
  );
  const candles = visible
    .filter((fixture) => fixture.kind === "candelabrum")
    .sort((a, b) => dist2(a.position, camera) - dist2(b.position, camera))
    .slice(0, MAX_CANDELABRA_SLOTS);
  const torches = visible
    .filter((fixture) => fixture.kind === "torch" || fixture.kind === "lantern")
    .sort((a, b) => dist2(a.position, camera) - dist2(b.position, camera))
    .slice(0, MAX_TORCH_SLOTS);

  const cords = matchcords.filter((cord) => cord.lockType === "matchlock");
  const shrouded = cords
    .filter((cord) => cord.shrouded)
    .sort((a, b) => dist2(a.position, camera) - dist2(b.position, camera));
  const open = cords
    .filter((cord) => !cord.shrouded)
    .sort((a, b) => dist2(a.position, camera) - dist2(b.position, camera));
  const pickedCords: MatchcordCandidate[] = [];
  for (const cord of [...shrouded, ...open]) {
    if (pickedCords.length >= MAX_MATCHCORD_SLOTS) break;
    pickedCords.push(cord);
  }

  const samples: PracticalSample[] = [];
  for (const fixture of [...candles, ...torches]) {
    samples.push({
      id: fixture.id,
      kind: fixture.kind,
      position: fixture.position,
      color: fixture.color,
      radius: fixture.radius,
      intensity: fixture.intensity,
      exposed: fixture.exposed,
    });
  }
  for (const cord of pickedCords) {
    const lit = applyWeather(
      MATCHCORD_INTENSITY,
      MATCHCORD_RADIUS,
      !cord.roofed,
      weather,
      false,
      false,
    );
    samples.push({
      id: cord.id,
      kind: "matchcord",
      position: cord.position,
      color: MATCHCORD_COLOR,
      radius: lit.radius,
      intensity: lit.intensity,
      exposed: !cord.roofed,
    });
  }
  return samples;
}

export function matchcordCandidates(
  units: readonly UnitData[],
  fogEnabled: boolean,
  visibleEnemyIds: ReadonlySet<string>,
  contacts: readonly { unitId: string; kind: string }[],
): MatchcordCandidate[] {
  const out: MatchcordCandidate[] = [];
  for (const unit of units) {
    if (!unit.alive || unit.weapon.lockType !== "matchlock") continue;
    const hidden =
      unit.faction === "enemy" &&
      fogEnabled &&
      !visibleEnemyIds.has(unit.id);
    if (hidden) {
      const contact = contacts.find((entry) => entry.unitId === unit.id);
      if (!contact || contact.kind !== "matchcord_glow") continue;
    }
    out.push({
      id: unit.id,
      position: muzzleTip(unit.pos, unit.facing, true),
      shrouded: hidden,
      lockType: "matchlock",
      roofed: isEnclosedRoofedCoord(unit.pos.x, unit.pos.y, unit.pos.z),
    });
  }
  return out;
}

export function isFixtureDucked(
  coord: GridCoord,
  now: number,
  flashes: readonly {
    kind: string;
    coord: GridCoord;
    createdAt: number;
    durationMs: number;
  }[],
  blasts: readonly { coord: GridCoord; createdAt: number; isExplosion: boolean }[],
): boolean {
  for (const flash of flashes) {
    if (flash.kind !== "blast") continue;
    if (now - flash.createdAt >= flash.durationMs) continue;
    if (chebyshev(coord, flash.coord) <= 1) return true;
  }
  for (const blast of blasts) {
    if (!blast.isExplosion) continue;
    if (now - blast.createdAt > 700) continue;
    if (chebyshev(coord, blast.coord) <= 1) return true;
  }
  return false;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
}

/** Drop expired flashes and keep the ADR-0011 cap (2 blasts, 1 muzzle). */
export function retainFlashes<T extends FlashBudgetItem>(
  existing: readonly T[],
  incomingKind: "blast" | "muzzle",
  now: number,
): T[] {
  const active = existing.filter((flash) => now - flash.createdAt < flash.durationMs);
  let blasts = active.filter((flash) => flash.kind === "blast");
  let muzzles = active.filter((flash) => flash.kind === "muzzle");
  if (incomingKind === "blast" && blasts.length >= MAX_BLAST_LIGHTS) {
    blasts = blasts.slice(blasts.length - (MAX_BLAST_LIGHTS - 1));
  }
  if (incomingKind === "muzzle" && muzzles.length >= MAX_MUZZLE_LIGHTS) {
    muzzles = [];
  }
  return [...blasts, ...muzzles];
}

export function rainGlintStrength(
  drop: WorldPoint,
  sources: readonly { position: WorldPoint; exposed: boolean }[],
): number {
  let strength = 0;
  for (const source of sources) {
    if (!source.exposed) continue;
    const dx = drop.x - source.position.x;
    const dy = drop.y - source.position.y;
    const dz = drop.z - source.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < RAIN_GLINT_RADIUS) {
      strength = Math.max(strength, 1 - dist / RAIN_GLINT_RADIUS);
    }
  }
  return strength;
}
