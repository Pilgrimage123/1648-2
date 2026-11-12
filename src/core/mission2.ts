/**
 * Mission 2, Mříž: the morning of 26 July 1648 at the Old Town Bridge Tower.
 *
 * Plan metres follow the bridge and the tower. One tile is 1.6 m.
 * Charles Bridge is 9.5 m wide, so the deck is 6 tiles (9.6 m).
 * The passage clear width is 8 m, so it is 5 tiles.
 * A harrier covers the playable near-bridge in one action: x = 1 to the
 * threshold x = 9 is 8 steps, 12.8 m, inside the longest arch (13.4 m).
 * The whole 515.8 m bridge is not on this map. In 1648 the deck is bare
 * sandstone. The baroque saint statues are later (~1700) and are absent.
 *
 * The tower (Parléř, 1370s) stands on the first pier, bridge to the west,
 * Křižovnické náměstí to the east. It is about 47 m above the deck. That
 * height is not modelled. y = 0 | 1 | 2 are the passage, the guard hall
 * over the vault (where the portcullis was lowered), and the gallery under
 * the roof. The square plan of the shell, 9×9 tiles = 14.4 m, is derived
 * so an 8 m passage keeps about 3.2 m of wall. It is not a published survey.
 *
 * East face, real programme, as pillars outside the roadway: kingfisher
 * zone is omitted; above the arch the territorial arms are omitted as
 * relief. y = 1 holds Charles IV, St Vitus on a model of the bridge, and
 * Wenceslas IV. y = 2 holds St Adalbert and St Sigismund. The glossary's
 * "Vitus, Wenceslas, Sigismund" is the shorthand; the niches follow the facade.
 * The kneel tile is the palindrome found under the roof:
 * Signate, signate, mere me tangis et angis.
 *
 * Not on this map: cellars, a fourth floor, side streets, Malá Strana's two
 * towers, the 1621 heads (gone by ~1631), Mocker's 1874 roof, the 1649 arms,
 * the 1650 memorial slab, the 1784 flood plaque, horses.
 */

import {
  checkLineOfSight3D,
  evaluateVisibleTargets,
  type EnemyAiDecision,
} from "./CombatSystem";
import {
  coordKey,
  GridSystem,
  MELEE_CATALOG,
  sameCoord,
  setRoofMask,
  WEAPON_CATALOG,
} from "./GridSystem";
import { findPathAStar } from "./Pathfinding";
import type { FloorLevel, GridCoord, UnitData, WeatherType } from "./types";

export const PLACHY_ID = "player-plachy";
export const HAVEL_ID = "player-havel";
export const ONDREJ_ID = "player-ondrej";
export const OCCULTIST_ID = "enemy-occultist";

export const THRESHOLD_X = 9;
export const PORTCULLIS_X = 10;
export const RITE_TURNS = 3;
export const WIND_HP = 18;

export const KEYSTONE: GridCoord = { x: 9, y: 0, z: 14 };
export const WINDLASS: GridCoord = { x: 11, y: 1, z: 14 };
export const INSCRIPTION: GridCoord = { x: 16, y: 2, z: 14 };
export const STAIR: GridCoord = { x: 14, y: 0, z: 17 };

const BRIDGE_X0 = 1;
const BRIDGE_X1 = 9;
const BRIDGE_Z0 = 11;
const BRIDGE_Z1 = 16;
const TOWER_X0 = 10;
const TOWER_X1 = 18;
const TOWER_Z0 = 10;
const TOWER_Z1 = 18;
const PASSAGE_Z0 = 12;
const PASSAGE_Z1 = 16;

export type Mission2Loss = "rite" | "plachy" | "wiped" | "windlass" | null;

export interface Mission2Clock {
  riteProgress: number;
  riteRequired: number;
  riteLocked: boolean;
  windlassProgress: number;
  windlassWorkerId: string | null;
  windlassArmed: boolean;
  windlassHp: number;
  seated: boolean;
  knelt: boolean;
  inscriptionNoted: boolean;
  loss: Mission2Loss;
  hpMark: Record<string, number>;
}

export interface Mission2Judgement {
  outcome: "ongoing" | "victory" | "defeat";
  victoryReason: "portcullis" | null;
  loss: Mission2Loss;
}

let readBoundClock: (() => Mission2Clock | null) | null = null;

export function bindMission2Clock(fn: () => Mission2Clock | null): void {
  readBoundClock = fn;
}

export function readMission2Clock(): Mission2Clock | null {
  return readBoundClock ? readBoundClock() : null;
}

/** Bridge side of the gate, including the threshold. The ward stops here. */
export function harrierMayStand(coord: GridCoord): boolean {
  return coord.y === 0 && coord.x <= THRESHOLD_X;
}

/**
 * Rain stays outside. The passage vault, the stair annex, and both upper
 * floors of the shell are dry. The bridge and the square are open.
 */
export function isBridgeTowerRoofed(x: number, y: number, z: number): boolean {
  const inShell = x >= TOWER_X0 && x <= TOWER_X1 && z >= TOWER_Z0 && z <= TOWER_Z1;
  if (y >= 1 && inShell) return true;
  if (y === 0 && x >= TOWER_X0 && x <= TOWER_X1 && z >= PASSAGE_Z0 && z <= PASSAGE_Z1) {
    return true;
  }
  if (x === STAIR.x && z === STAIR.z) return true;
  return false;
}

function paint(
  grid: GridSystem,
  x: number,
  y: FloorLevel,
  z: number,
  surface: "cobble" | "stone_floor" | "water",
  walkable: boolean,
): void {
  const coord: GridCoord = { x, y, z };
  grid.setFloor(coord, true, surface);
  const tile = grid.getTile(coord);
  if (!tile) return;
  tile.surface = surface;
  tile.walkable = walkable && tile.obstacle === "none";
}

export function createMission2Grid(): GridSystem {
  setRoofMask(isBridgeTowerRoofed);
  const grid = new GridSystem();

  for (let y = 0; y < 3; y++) {
    for (let z = 0; z < 28; z++) {
      for (let x = 0; x < 24; x++) {
        grid.setFloor({ x, y: y as FloorLevel, z }, false);
      }
    }
  }

  for (let z = BRIDGE_Z0; z <= BRIDGE_Z1; z++) {
    for (let x = BRIDGE_X0; x <= BRIDGE_X1; x++) {
      paint(grid, x, 0, z, "cobble", true);
    }
  }
  for (let x = BRIDGE_X0; x <= BRIDGE_X1; x++) {
    for (const z of [8, 9, 10, 17, 18, 19]) {
      paint(grid, x, 0, z, "water", false);
    }
  }

  for (let z = PASSAGE_Z0; z <= PASSAGE_Z1; z++) {
    for (let x = TOWER_X0; x <= TOWER_X1; x++) {
      paint(grid, x, 0, z, "stone_floor", true);
    }
  }
  for (let z = 11; z <= 17; z++) {
    for (let x = 19; x <= 22; x++) {
      paint(grid, x, 0, z, "cobble", true);
    }
  }

  for (const y of [1, 2] as FloorLevel[]) {
    for (let z = 11; z <= 17; z++) {
      for (let x = 11; x <= 17; x++) {
        paint(grid, x, y, z, "stone_floor", true);
      }
    }
    for (let z = PASSAGE_Z0; z <= PASSAGE_Z1; z++) {
      paint(grid, 10, y, z, "stone_floor", true);
    }
  }

  grid.setStairs(STAIR.x, STAIR.z, [0, 1, 2], "spiral_stairs", "N", "stone_floor");
  for (const y of [0, 1, 2] as FloorLevel[]) {
    const stair = grid.getTile({ x: STAIR.x, y, z: STAIR.z });
    if (stair) stair.surface = "stone_floor";
  }

  const wall = (x: number, y: FloorLevel, z: number) => {
    const coord: GridCoord = { x, y, z };
    if (!grid.getTile(coord)?.hasFloor) {
      paint(grid, x, y, z, "stone_floor", false);
    }
    grid.setObstacle(coord, "high_wall");
  };

  for (let x = TOWER_X0; x <= TOWER_X1; x++) {
    for (const z of [10, 11]) wall(x, 0, z);
    for (const z of [17, 18]) {
      if (x === STAIR.x && z === STAIR.z) continue;
      wall(x, 0, z);
    }
  }

  for (const y of [1, 2] as FloorLevel[]) {
    for (let x = TOWER_X0; x <= TOWER_X1; x++) {
      wall(x, y, 10);
      wall(x, y, 18);
    }
    for (let z = 11; z <= 17; z++) {
      if (y === 1 && z >= PASSAGE_Z0 && z <= PASSAGE_Z1) continue;
      if (y === 2 && z >= PASSAGE_Z0 && z <= PASSAGE_Z1) continue;
      wall(10, y, z);
    }
    for (let z = 11; z <= 17; z++) {
      const niche =
        (y === 1 && (z === 13 || z === 14 || z === 15)) ||
        (y === 2 && (z === 13 || z === 15));
      if (niche) {
        const coord: GridCoord = { x: 18, y, z };
        if (!grid.getTile(coord)?.hasFloor) paint(grid, 18, y, z, "stone_floor", false);
        grid.setObstacle(coord, "pillar");
      } else {
        wall(18, y, z);
      }
    }
  }

  grid.bakeCoverFromObstacles();
  for (let x = BRIDGE_X0; x <= BRIDGE_X1; x++) {
    grid.setDirectionalCover({ x, y: 0, z: BRIDGE_Z0 }, "N", "half");
    grid.setDirectionalCover({ x, y: 0, z: BRIDGE_Z1 }, "S", "half");
  }

  return grid;
}

export function createMission2Explored(grid: GridSystem): Set<string> {
  const explored = new Set<string>();
  for (const tile of grid.getAllTiles()) {
    if (!tile.hasFloor) continue;
    const { x, y, z } = tile.coord;
    const onBridge = y === 0 && x >= BRIDGE_X0 && x <= BRIDGE_X1 && z >= 8 && z <= 19;
    const inTower = x >= TOWER_X0 && x <= TOWER_X1 && z >= TOWER_Z0 && z <= TOWER_Z1;
    const onSquare = y === 0 && x >= 19 && x <= 22 && z >= 11 && z <= 17;
    if (onBridge || inTower || onSquare) explored.add(coordKey(tile.coord));
  }
  return explored;
}

function blankUnit(partial: Pick<UnitData, "id" | "name" | "roleTitle" | "faction" | "archetype" | "pos" | "facing" | "hp" | "armor" | "movePerAp"> & {
  weapon: UnitData["weapon"];
  melee?: UnitData["meleeWeapon"];
  isVip?: boolean;
}): UnitData {
  return {
    id: partial.id,
    name: partial.name,
    roleTitle: partial.roleTitle,
    faction: partial.faction,
    archetype: partial.archetype,
    isVip: partial.isVip,
    pos: partial.pos,
    facing: partial.facing,
    hp: partial.hp,
    maxHp: partial.hp,
    armor: partial.armor,
    maxArmor: partial.armor,
    ap: 2,
    maxAp: 2,
    marksmanship: partial.faction === "player" ? 70 : 48,
    movePerAp: partial.movePerAp,
    weapon: partial.weapon,
    meleeWeapon: partial.melee,
    pistolLoaded: true,
    firearmLoaded: true,
    reloadProgress: 0,
    grenades: 0,
    isOverwatch: false,
    movedThisTurn: false,
    isShaken: false,
    alive: true,
  };
}

export function createMission2Units(): UnitData[] {
  const pistol = WEAPON_CATALOG.plachy_pistol!;
  const havelGun = WEAPON_CATALOG.havel_pistol!;
  const ondrejGun = WEAPON_CATALOG.ondrej_pistol!;
  const harrierGun = WEAPON_CATALOG.harrier_pistol!;
  const occultGun = WEAPON_CATALOG.occultist_pistol!;
  const units: UnitData[] = [
    blankUnit({
      id: PLACHY_ID,
      name: "Jiří Plachý",
      roleTitle: "Jezuitský páter",
      faction: "player",
      archetype: "commander",
      isVip: true,
      pos: { x: 14, y: 2, z: 14 },
      facing: "W",
      hp: 12,
      armor: 1,
      movePerAp: 7,
      weapon: pistol,
      melee: MELEE_CATALOG.thief_knife,
    }),
    blankUnit({
      id: HAVEL_ID,
      name: "Havel Řezáč",
      roleTitle: "Řezník od brány",
      faction: "player",
      archetype: "ranger",
      pos: { x: 19, y: 0, z: 13 },
      facing: "W",
      hp: 11,
      armor: 0,
      movePerAp: 6,
      weapon: havelGun,
      melee: MELEE_CATALOG.butcher_cleaver,
    }),
    blankUnit({
      id: ONDREJ_ID,
      name: "Ondřej Štěrba",
      roleTitle: "Zloděj střech a lan",
      faction: "player",
      archetype: "sniper",
      pos: { x: 17, y: 0, z: 14 },
      facing: "W",
      hp: 8,
      armor: 0,
      movePerAp: 7,
      weapon: ondrejGun,
      melee: MELEE_CATALOG.thief_knife,
    }),
    blankUnit({
      id: OCCULTIST_ID,
      name: "Švédský okultista",
      roleTitle: "Obřad u svorníku",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 1, y: 0, z: 14 },
      facing: "E",
      hp: 10,
      armor: 0,
      movePerAp: 1,
      weapon: occultGun,
      melee: MELEE_CATALOG.harrier_blade,
    }),
  ];
  const lanes = [12, 13, 15, 16];
  lanes.forEach((z, i) => {
    units.push(
      blankUnit({
        id: `enemy-harrier-${i + 1}`,
        name: "Harcovník",
        roleTitle: "Harcovník",
        faction: "enemy",
        archetype: "ranger",
        pos: { x: 1, y: 0, z },
        facing: "E",
        hp: 6,
        armor: 0,
        movePerAp: 8,
        weapon: harrierGun,
        melee: MELEE_CATALOG.harrier_blade,
      }),
    );
  });
  return units;
}

function marksOf(units: UnitData[]): Record<string, number> {
  const hpMark: Record<string, number> = {};
  for (const unit of units) hpMark[unit.id] = unit.hp;
  return hpMark;
}

export function freshClock(units: UnitData[]): Mission2Clock {
  return {
    riteProgress: 0,
    riteRequired: RITE_TURNS,
    riteLocked: false,
    windlassProgress: 0,
    windlassWorkerId: null,
    windlassArmed: false,
    windlassHp: WIND_HP,
    seated: false,
    knelt: false,
    inscriptionNoted: false,
    loss: null,
    hpMark: marksOf(units),
  };
}

function wasHit(clock: Mission2Clock, unit: UnitData): boolean {
  const mark = clock.hpMark[unit.id];
  return mark !== undefined && unit.hp < mark;
}

function livingAt(units: UnitData[], id: string, coord: GridCoord): UnitData | undefined {
  return units.find(
    (unit) =>
      unit.id === id &&
      unit.alive &&
      unit.hp > 0 &&
      sameCoord(unit.pos, coord),
  );
}

export function windlassTurnsNeeded(unitId: string): number {
  return unitId === ONDREJ_ID ? 1 : 2;
}

/** End of the player's activation. Arms the windlass. Does not drop the grate. */
export function closePlayerTurn(clock: Mission2Clock, units: UnitData[]): Mission2Clock {
  const next: Mission2Clock = { ...clock, hpMark: { ...clock.hpMark } };
  const occultist = units.find((unit) => unit.id === OCCULTIST_ID);
  if (occultist && occultist.alive && wasHit(clock, occultist)) {
    next.riteProgress = 0;
  }

  const worker = units.find(
    (unit) =>
      unit.faction === "player" &&
      unit.alive &&
      unit.hp > 0 &&
      sameCoord(unit.pos, WINDLASS),
  );
  if (!worker || wasHit(clock, worker) || next.seated || next.windlassHp <= 0) {
    next.windlassArmed = false;
    next.windlassProgress = worker && !wasHit(clock, worker) ? next.windlassProgress : 0;
    if (!worker) next.windlassWorkerId = null;
  } else if (next.windlassWorkerId !== worker.id) {
    next.windlassArmed = true;
    next.windlassWorkerId = worker.id;
    next.windlassProgress = 0;
  } else {
    next.windlassArmed = true;
  }

  const plachy = units.find((unit) => unit.id === PLACHY_ID);
  if (
    plachy &&
    plachy.alive &&
    sameCoord(plachy.pos, INSCRIPTION) &&
    !next.knelt &&
    !next.inscriptionNoted
  ) {
    next.inscriptionNoted = true;
  }

  next.hpMark = marksOf(units);
  return next;
}

/**
 * End of the enemy activation. The grate, if it was already armed and the
 * worker was not hit, seats before the rite is allowed to finish.
 */
export function closeEnemyTurn(clock: Mission2Clock, units: UnitData[]): Mission2Clock {
  const next: Mission2Clock = { ...clock, hpMark: { ...clock.hpMark } };

  if (next.windlassArmed && !next.seated && next.windlassHp > 0 && next.windlassWorkerId) {
    const worker = livingAt(units, next.windlassWorkerId, WINDLASS);
    if (!worker || wasHit(clock, worker)) {
      next.windlassProgress = 0;
      next.windlassArmed = false;
      if (!worker) next.windlassWorkerId = null;
    } else {
      next.windlassProgress += 1;
      if (next.windlassProgress >= windlassTurnsNeeded(worker.id)) {
        next.seated = true;
      }
      next.windlassArmed = false;
    }
  }

  const occultist = units.find((unit) => unit.id === OCCULTIST_ID);
  if (!occultist || !occultist.alive || occultist.hp <= 0) {
    next.riteLocked = true;
  } else if (!next.riteLocked && sameCoord(occultist.pos, KEYSTONE)) {
    if (wasHit(clock, occultist)) next.riteProgress = 0;
    else next.riteProgress += 1;
  } else if (!next.riteLocked) {
    next.riteProgress = 0;
  }

  next.hpMark = marksOf(units);
  return next;
}

export function applyKneel(clock: Mission2Clock, plachy: UnitData): Mission2Clock | null {
  if (clock.knelt || plachy.ap < 1 || !plachy.alive || plachy.hp <= 0) return null;
  if (!sameCoord(plachy.pos, INSCRIPTION)) return null;
  return { ...clock, knelt: true, riteRequired: clock.riteRequired + 1 };
}

export function applyWindlassHit(clock: Mission2Clock, damage: number): Mission2Clock {
  if (clock.seated || damage <= 0) return clock;
  return { ...clock, windlassHp: Math.max(0, clock.windlassHp - damage) };
}

export function judgeMission2(clock: Mission2Clock, units: UnitData[]): Mission2Judgement {
  const plachy = units.find((unit) => unit.id === PLACHY_ID);
  if (!plachy || !plachy.alive || plachy.hp <= 0) {
    return { outcome: "defeat", victoryReason: null, loss: "plachy" };
  }
  const anyDefender = units.some(
    (unit) => unit.faction === "player" && unit.alive && unit.hp > 0,
  );
  if (!anyDefender) {
    return { outcome: "defeat", victoryReason: null, loss: "wiped" };
  }
  if (clock.windlassHp <= 0 && !clock.seated) {
    return { outcome: "defeat", victoryReason: null, loss: "windlass" };
  }
  if (clock.seated) {
    return { outcome: "victory", victoryReason: "portcullis", loss: null };
  }
  if (!clock.riteLocked && clock.riteProgress >= clock.riteRequired) {
    return { outcome: "defeat", victoryReason: null, loss: "rite" };
  }
  return { outcome: "ongoing", victoryReason: null, loss: null };
}

export function windlassDummy(hp: number): UnitData {
  return blankUnit({
    id: "objective-windlass",
    name: "Rumpál",
    roleTitle: "Rumpál mříže",
    faction: "player",
    archetype: "trooper",
    pos: { ...WINDLASS },
    facing: "W",
    hp: Math.max(1, hp),
    armor: 0,
    movePerAp: 1,
    weapon: WEAPON_CATALOG.plachy_pistol!,
  });
}

function trimPath(path: GridCoord[], budget: number): GridCoord[] {
  return path.slice(0, Math.max(0, budget));
}

function apForSteps(steps: number, movePerAp: number): number {
  if (steps <= 0) return 0;
  return steps <= movePerAp ? 1 : 2;
}

function thresholdTiles(): GridCoord[] {
  return [12, 13, 15, 16].map((z) => ({ x: THRESHOLD_X, y: 0 as FloorLevel, z }));
}

export function computeMission2Ai(
  grid: GridSystem,
  enemy: UnitData,
  units: UnitData[],
  _clock: Mission2Clock,
  weather: WeatherType = "rain",
): EnemyAiDecision {
  const empty: EnemyAiDecision = {
    movePath: [],
    moveApCost: 0,
    targetId: null,
    strikeWindlass: false,
  };
  if (!enemy.alive || enemy.ap <= 0) return empty;

  const budget = enemy.ap * enemy.movePerAp;
  let goal: GridCoord | null = null;

  if (enemy.id === OCCULTIST_ID) {
    goal = sameCoord(enemy.pos, KEYSTONE) ? null : KEYSTONE;
  } else if (enemy.id.startsWith("enemy-harrier")) {
    const occupied = new Set(
      units.filter((unit) => unit.alive && unit.id !== enemy.id).map((unit) => coordKey(unit.pos)),
    );
    const standing = thresholdTiles().find((tile) => sameCoord(enemy.pos, tile));
    if (!standing) {
      const sameFile = thresholdTiles().find(
        (tile) => tile.z === enemy.pos.z && !occupied.has(coordKey(tile)),
      );
      const anyFree = thresholdTiles().find((tile) => !occupied.has(coordKey(tile)));
      goal = sameFile ?? anyFree ?? null;
    }
  }

  let movePath: GridCoord[] = [];
  if (goal) {
    movePath = trimPath(
      findPathAStar(grid, enemy.pos, goal, units, enemy.id, harrierMayStand),
      budget,
    );
  }
  const dest = movePath.length > 0 ? movePath[movePath.length - 1]! : enemy.pos;
  const viewer: UnitData = { ...enemy, pos: dest };
  const people = evaluateVisibleTargets(grid, viewer, units, weather, dest);
  const person = people[0];
  let strikeWindlass = false;
  if (!person && enemy.id.startsWith("enemy-harrier") && enemy.firearmLoaded !== false) {
    strikeWindlass = checkLineOfSight3D(grid, dest, WINDLASS).clear;
  }

  return {
    movePath,
    moveApCost: apForSteps(movePath.length, enemy.movePerAp),
    targetId: person?.targetId ?? null,
    strikeWindlass,
  };
}
