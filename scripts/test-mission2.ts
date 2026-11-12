/**
 * Mission 2, headless. The plan is in metres: bridge 6 tiles (9.6 m),
 * passage 5 tiles (8 m), one arch of 8 steps (12.8 m) to the threshold.
 */
import assert from "node:assert/strict";
import { checkLineOfSight3D } from "../src/core/CombatSystem.ts";
import { computeFogOfWar, getTileVisibility } from "../src/core/FogOfWar.ts";
import {
  coordKey,
  createInitialGrid,
  isEnclosedRoofedCoord,
} from "../src/core/GridSystem.ts";
import { computeReachableTiles, findPathAStar } from "../src/core/Pathfinding.ts";
import {
  applyKneel,
  applyWindlassHit,
  closeEnemyTurn,
  closePlayerTurn,
  computeMission2Ai,
  createMission2Grid,
  createMission2Units,
  freshClock,
  harrierMayStand,
  HAVEL_ID,
  INSCRIPTION,
  judgeMission2,
  KEYSTONE,
  OCCULTIST_ID,
  ONDREJ_ID,
  PLACHY_ID,
  THRESHOLD_X,
  WINDLASS,
  type Mission2Clock,
} from "../src/core/mission2.ts";
import type { GridCoord, UnitData } from "../src/core/types.ts";

const grid = createMission2Grid();
const units = createMission2Units();

function tile(x: number, y: 0 | 1 | 2, z: number) {
  const found = grid.getTile({ x, y, z });
  assert.ok(found, `missing tile ${x},${y},${z}`);
  return found;
}

const bridgeWidth = [11, 12, 13, 14, 15, 16].filter(
  (z) => tile(5, 0, z).walkable && tile(5, 0, z).surface === "cobble",
);
assert.equal(bridgeWidth.length, 6, "bridge deck is 6 tiles, 9.6 m");
assert.equal(tile(5, 0, 10).surface, "water");
assert.equal(tile(5, 0, 17).surface, "water");
assert.equal(tile(5, 0, 10).walkable, false);

const passage = [12, 13, 14, 15, 16].filter((z) => tile(14, 0, z).walkable);
assert.equal(passage.length, 5, "passage clear width is 5 tiles, 8 m");
assert.equal(tile(14, 0, 11).walkable, false);
assert.equal(tile(14, 0, 11).obstacle, "high_wall");

assert.equal(tile(KEYSTONE.x, 0, KEYSTONE.z).walkable, true);
assert.ok(KEYSTONE.x <= THRESHOLD_X);

const stair = tile(14, 0, 17);
assert.equal(stair.stairType, "spiral_stairs");
assert.equal(tile(14, 1, 17).isLadder, true);
assert.equal(tile(14, 2, 17).isLadder, true);
assert.equal(tile(11, 1, 14).walkable, true);
assert.equal(tile(16, 2, 14).walkable, true);

const plachyUnit = units.find((unit) => unit.id === PLACHY_ID);
assert.ok(plachyUnit, "Father Jiří Plachý must be present");
assert.equal(plachyUnit.isVip, true, "Father Jiří Plachý must be VIP");

const ids = units.map((unit) => unit.id);
for (const banned of [
  "player-colloredo",
  "player-jan-matej",
  "player-vaclav-michalovic",
  "player-bartolomej",
  "enemy-odowalsky",
]) {
  assert.equal(ids.includes(banned), false, banned);
}

const harrier = units.find((unit) => unit.id === "enemy-harrier-1")!;
const harrierReach = computeReachableTiles(grid, harrier, units, harrierMayStand);
const threshold = harrierReach.get(coordKey({ x: 9, y: 0, z: harrier.pos.z }));
assert.ok(threshold, "harrier reaches his threshold file");
assert.equal(threshold!.apCost, 1);
assert.ok(threshold!.costSteps <= harrier.movePerAp);
assert.equal(
  harrierReach.has(coordKey({ x: 10, y: 0, z: harrier.pos.z })),
  false,
  "the ward stops the harrier on the threshold",
);

const occultist = units.find((unit) => unit.id === OCCULTIST_ID)!;
let occultPos: GridCoord = occultist.pos;
for (let turn = 0; turn < 3; turn++) {
  const path = findPathAStar(
    grid,
    occultPos,
    KEYSTONE,
    units,
    occultist.id,
    harrierMayStand,
  ).slice(0, occultist.ap * occultist.movePerAp);
  assert.ok(path.length > 0);
  occultPos = path[path.length - 1]!;
}
assert.notEqual(occultPos.x, KEYSTONE.x, "the occultist is still behind after three turns");
const lastLeg = findPathAStar(
  grid,
  occultPos,
  KEYSTONE,
  units,
  occultist.id,
  harrierMayStand,
);
assert.ok(lastLeg.length > 0 && lastLeg.length <= occultist.ap * occultist.movePerAp);
assert.equal(lastLeg[lastLeg.length - 1]!.x, KEYSTONE.x);

const ondrej = units.find((unit) => unit.id === ONDREJ_ID)!;
const ondrejReach = computeReachableTiles(grid, ondrej, units);
const windlassReach = ondrejReach.get(coordKey(WINDLASS));
assert.ok(windlassReach, "Ondřej can reach the windlass");
assert.equal(windlassReach!.apCost, 2, "the arrival spends both AP");
assert.ok(windlassReach!.costSteps > ondrej.movePerAp);
assert.ok(windlassReach!.costSteps <= ondrej.movePerAp * 2);

assert.equal(
  checkLineOfSight3D(grid, { x: 9, y: 0, z: 14 }, WINDLASS).clear,
  true,
  "a man on the keystone can see the windlass",
);

assert.equal(isEnclosedRoofedCoord(5, 0, 14), false, "rain on the bridge");
assert.equal(isEnclosedRoofedCoord(20, 0, 14), false, "rain on the square");
assert.equal(isEnclosedRoofedCoord(14, 0, 14), true, "dry under the vault");
assert.equal(isEnclosedRoofedCoord(11, 1, 14), true);
assert.equal(isEnclosedRoofedCoord(16, 2, 14), true);

function withPos(unit: UnitData, pos: GridCoord, hp = unit.hp): UnitData {
  return { ...unit, pos, hp, alive: hp > 0 };
}

let clock = freshClock(units);
const onWindlass = units.map((unit) =>
  unit.id === ONDREJ_ID ? withPos(unit, WINDLASS) : unit,
);
clock = closePlayerTurn(clock, onWindlass);
assert.equal(clock.windlassArmed, true);
assert.equal(clock.windlassProgress, 0);
assert.equal(clock.seated, false);
clock = closeEnemyTurn(clock, onWindlass);
assert.equal(clock.seated, true);
assert.equal(judgeMission2(clock, onWindlass).victoryReason, "portcullis");

clock = freshClock(units);
const havelThere = units.map((unit) =>
  unit.id === HAVEL_ID ? withPos(unit, WINDLASS) : unit,
);
clock = closePlayerTurn(clock, havelThere);
clock = closeEnemyTurn(clock, havelThere);
assert.equal(clock.seated, false);
assert.equal(clock.windlassProgress, 1);
clock = closePlayerTurn(clock, havelThere);
clock = closeEnemyTurn(clock, havelThere);
assert.equal(clock.seated, true);

clock = freshClock(units);
clock = closePlayerTurn(clock, onWindlass);
const shot = onWindlass.map((unit) =>
  unit.id === ONDREJ_ID ? { ...unit, hp: unit.hp - 3 } : unit,
);
clock = closeEnemyTurn(clock, shot);
assert.equal(clock.seated, false);
assert.equal(clock.windlassProgress, 0);

clock = freshClock(units);
clock = applyWindlassHit(clock, 18);
assert.equal(judgeMission2(clock, units).loss, "windlass");

clock = freshClock(units);
const plachy = units.find((unit) => unit.id === PLACHY_ID)!;
const kneeling = applyKneel(clock, { ...plachy, pos: INSCRIPTION });
assert.ok(kneeling);
assert.equal(kneeling!.riteRequired, 4);
assert.equal(applyKneel(clock, plachy), null);

function placeOccultist(pos: GridCoord, hp = 10): UnitData[] {
  return units.map((unit) =>
    unit.id === OCCULTIST_ID ? withPos(unit, pos, hp) : unit,
  );
}

clock = freshClock(units);
for (let i = 0; i < 3; i++) {
  clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE));
}
assert.equal(judgeMission2(clock, placeOccultist(KEYSTONE)).loss, "rite");

clock = freshClock(units);
clock = applyKneel(clock, { ...plachy, pos: INSCRIPTION })!;
for (let i = 0; i < 3; i++) {
  clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE));
}
assert.equal(judgeMission2(clock, placeOccultist(KEYSTONE)).outcome, "ongoing");
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE));
assert.equal(judgeMission2(clock, placeOccultist(KEYSTONE)).loss, "rite");

clock = freshClock(units);
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE));
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE, 4));
assert.equal(clock.riteProgress, 0);

clock = freshClock(units);
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE));
clock = closeEnemyTurn(clock, placeOccultist({ x: 8, y: 0, z: 14 }));
assert.equal(clock.riteProgress, 0);

clock = freshClock(units);
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE, 0));
assert.equal(clock.riteLocked, true);
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE, 0));
clock = closeEnemyTurn(clock, placeOccultist(KEYSTONE, 0));
assert.equal(judgeMission2(clock, placeOccultist(KEYSTONE, 0)).outcome, "ongoing");
const withoutPlachyHp = units.map((unit) =>
  unit.id === PLACHY_ID ? { ...unit, alive: true, hp: 12 } : unit,
);
const occultDead = withoutPlachyHp.map((unit) =>
  unit.id === OCCULTIST_ID ? { ...unit, alive: false, hp: 0, pos: KEYSTONE } : unit,
);
clock = { ...freshClock(occultDead), riteLocked: true, riteProgress: 3 };
assert.equal(judgeMission2(clock, occultDead).outcome, "ongoing");

clock = freshClock(onWindlass);
clock = closePlayerTurn(clock, onWindlass);
const both = closeEnemyTurn(
  { ...clock, riteProgress: 2, riteRequired: 3 },
  placeOccultist(KEYSTONE).map((unit) =>
    unit.id === ONDREJ_ID ? withPos(unit, WINDLASS) : unit,
  ),
);
assert.equal(both.seated, true);
assert.equal(
  judgeMission2(
    both,
    placeOccultist(KEYSTONE).map((unit) =>
      unit.id === ONDREJ_ID ? withPos(unit, WINDLASS) : unit,
    ),
  ).victoryReason,
  "portcullis",
);

const fallen = units.map((unit) =>
  unit.id === PLACHY_ID ? { ...unit, hp: 0, alive: false } : unit,
);
assert.equal(judgeMission2(freshClock(fallen), fallen).loss, "plachy");

const plan = computeMission2Ai(grid, harrier, units, freshClock(units));
assert.ok(plan.movePath.length > 0);
assert.ok(plan.movePath.every((step) => step.x <= THRESHOLD_X && step.y === 0));
assert.equal(plan.movePath[plan.movePath.length - 1]!.z, harrier.pos.z);

const palace = createInitialGrid();
assert.equal(isEnclosedRoofedCoord(5, 1, 23), true, "palace bedroom stays roofed");
assert.equal(isEnclosedRoofedCoord(11, 1, 14), false, "tower mask does not leak");
assert.ok(palace.getTile({ x: 5, y: 1, z: 23 })?.hasFloor);

// Morning daylight visibility on Charles Bridge (x: 1..9, y: 0, z: 11..16)
const m2Fog = computeFogOfWar(grid, units, "rain", new Set());
for (let x = 1; x <= 9; x++) {
  for (let z = 11; z <= 16; z++) {
    assert.equal(
      getTileVisibility({ x, y: 0, z }, m2Fog, true),
      "visible",
      `Charles Bridge tile (${x},0,${z}) is visible in morning daylight`,
    );
  }
}
for (const enemy of units.filter((u) => u.faction === "enemy")) {
  assert.equal(
    m2Fog.visibleEnemyIds.has(enemy.id),
    true,
    `Enemy ${enemy.id} on open morning Charles Bridge is visible at Mission 2 start`,
  );
}

void (null as Mission2Clock | null);
console.log("mission 2 ok");
