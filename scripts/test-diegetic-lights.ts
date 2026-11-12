/**
 * Headless checks for diegetic lighting (ADR-0015).
 * The muzzle tip is also checked against a Three.js Object3D using the same
 * yaw as the soldier mesh, so a swapped axis fails here.
 */
import assert from "node:assert";
import * as THREE from "three";
import {
  CANDELABRA,
  evaluateFixture,
  evaluateLantern,
  FACING_YAW,
  FIXTURES,
  LOCK_FORWARD_M,
  LOCK_HEIGHT_M,
  LOCK_RIGHT_M,
  matchcordCandidates,
  MAX_CANDELABRA_SLOTS,
  MAX_MATCHCORD_SLOTS,
  MAX_TORCH_SLOTS,
  MUZZLE_FORWARD_M,
  MUZZLE_HEIGHT_M,
  MUZZLE_RIGHT_M,
  muzzleTip,
  RAIN_GUTTER,
  rainGlintStrength,
  retainFlashes,
  selectSteadySlots,
  TORCHES,
  FOG_RADIUS_SCALE,
} from "../src/components/canvas/diegeticLights.ts";
import { gridToWorld } from "../src/components/canvas/worldCoords.ts";
import {
  createInitialGrid,
  createInitialUnits,
  isEnclosedRoofedCoord,
} from "../src/core/GridSystem.ts";
import type { CardinalDir, GridCoord } from "../src/core/types.ts";

const grid = createInitialGrid();

for (const candle of CANDELABRA.filter((fixture) => fixture.id.startsWith("candelabrum"))) {
  assert.ok(candle.coord.x >= 3 && candle.coord.x <= 7, candle.id);
  assert.ok(candle.coord.z >= 22 && candle.coord.z <= 25, candle.id);
  assert.equal(candle.coord.y, 1);
  assert.ok(
    Math.abs(candle.offset[0]) >= 0.3 || Math.abs(candle.offset[2]) >= 0.3,
    `${candle.id} must sit off the tile center`,
  );
  const tile = grid.getTile(candle.coord);
  assert.equal(tile?.hasFloor, true, candle.id);
  assert.equal(tile?.obstacle, "none", candle.id);
}

for (const sconce of CANDELABRA.filter((fixture) => fixture.id.startsWith("sconce"))) {
  assert.equal(grid.getTile(sconce.coord)?.obstacle, "pillar", sconce.id);
}

for (const torch of TORCHES) {
  assert.equal(grid.getTile(torch.coord)?.obstacle, "pillar", torch.id);
}

const bedroom = CANDELABRA[0]!;
const court = TORCHES[0]!;
assert.equal(isEnclosedRoofedCoord(court.coord.x, court.coord.y, court.coord.z), true);

const dryCandle = evaluateFixture(bedroom, "clear", 0, false);
const wetCandle = evaluateFixture(bedroom, "rain", 0, false);
const wetTorch = evaluateFixture(court, "rain", 0, false);
assert.equal(wetCandle.intensity, dryCandle.intensity);
assert.ok(Math.abs(wetTorch.intensity - court.intensity * RAIN_GUTTER) < 1e-6);

const fogCandle = evaluateFixture(bedroom, "fog", 0, false);
assert.ok(Math.abs(fogCandle.radius - bedroom.radius * FOG_RADIUS_SCALE) < 1e-6);

const snuffed = evaluateFixture(bedroom, "clear", 2, false);
assert.equal(snuffed.snuffed, true);
assert.equal(snuffed.intensity, 0);

const ducked = evaluateFixture(court, "clear", 0, true);
assert.ok(ducked.intensity < court.intensity);

function expectTip(origin: GridCoord, facing: CardinalDir, misfire: boolean) {
  const tip = muzzleTip(origin, facing, misfire);
  const [wx, wy, wz] = gridToWorld(origin);
  const soldier = new THREE.Object3D();
  soldier.position.set(wx, wy, wz);
  soldier.rotation.y = FACING_YAW[facing];
  soldier.updateMatrixWorld(true);
  const local = new THREE.Vector3(
    misfire ? LOCK_RIGHT_M : MUZZLE_RIGHT_M,
    misfire ? LOCK_HEIGHT_M : MUZZLE_HEIGHT_M,
    misfire ? LOCK_FORWARD_M : MUZZLE_FORWARD_M,
  );
  local.applyMatrix4(soldier.matrixWorld);
  assert.ok(Math.abs(local.x - tip.x) < 1e-5, `${facing} x`);
  assert.ok(Math.abs(local.y - tip.y) < 1e-5, `${facing} y`);
  assert.ok(Math.abs(local.z - tip.z) < 1e-5, `${facing} z`);
}

for (const facing of ["N", "E", "S", "W"] as const) {
  expectTip({ x: 8, y: 1, z: 12 }, facing, false);
  expectTip({ x: 8, y: 1, z: 12 }, facing, true);
}

const east = muzzleTip({ x: 10, y: 0, z: 10 }, "E", false);
const [ex, ey, ez] = gridToWorld({ x: 10, y: 0, z: 10 });
assert.ok(Math.abs(east.x - (ex + MUZZLE_FORWARD_M)) < 1e-6);
assert.ok(Math.abs(east.z - (ez - MUZZLE_RIGHT_M)) < 1e-6);
assert.ok(Math.abs(east.y - (ey + MUZZLE_HEIGHT_M)) < 1e-6);

const states = [
  ...FIXTURES.map((fixture) => evaluateFixture(fixture, "clear", 0, false)),
  evaluateLantern({ x: 3, y: 0, z: 2 }, "clear", 0, false),
];
const slots = selectSteadySlots(
  states,
  [
    {
      id: "wheel",
      position: { x: 0, y: 1, z: 0 },
      shrouded: false,
      lockType: "wheellock",
      roofed: false,
    },
    {
      id: "near",
      position: { x: 1, y: 1, z: 0 },
      shrouded: false,
      lockType: "matchlock",
      roofed: false,
    },
    {
      id: "far",
      position: { x: 40, y: 1, z: 40 },
      shrouded: true,
      lockType: "matchlock",
      roofed: true,
    },
  ],
  { x: 0, y: 2, z: 0 },
  1,
  "clear",
);
const candles = slots.filter((slot) => slot.kind === "candelabrum");
const torches = slots.filter(
  (slot) => slot.kind === "torch" || slot.kind === "lantern",
);
const cords = slots.filter((slot) => slot.kind === "matchcord");
assert.ok(candles.length <= MAX_CANDELABRA_SLOTS);
assert.equal(candles.length, CANDELABRA.length);
assert.ok(torches.length <= MAX_TORCH_SLOTS);
assert.equal(torches.length, MAX_TORCH_SLOTS);
assert.equal(cords.length, MAX_MATCHCORD_SLOTS);
assert.ok(cords.some((cord) => cord.id === "far"));
assert.ok(cords.some((cord) => cord.id === "near"));
assert.ok(!cords.some((cord) => cord.id === "wheel"));

const groundSlots = selectSteadySlots(states, [], { x: 0, y: 8, z: 0 }, 0, "clear");
assert.equal(
  groundSlots.filter((slot) => slot.kind === "candelabrum").length,
  0,
);

const units = createInitialUnits();
const visible = new Set<string>();
const enemyMatch = units.find(
  (unit) => unit.faction === "enemy" && unit.weapon.lockType === "matchlock",
)!;
const rosterCords = matchcordCandidates(units, true, visible, [
  { unitId: enemyMatch.id, kind: "matchcord_glow" },
]);
assert.ok(rosterCords.some((cord) => cord.id === "player-vaclav-michalovic"));
assert.ok(rosterCords.some((cord) => cord.id === "player-bartolomej" && !cord.shrouded));
assert.ok(!rosterCords.some((cord) => cord.id === "player-colloredo"));
assert.ok(rosterCords.some((cord) => cord.id === enemyMatch.id && cord.shrouded));

const hiddenWithoutContact = matchcordCandidates(units, true, visible, []);
assert.ok(!hiddenWithoutContact.some((cord) => cord.id === enemyMatch.id));

const now = 400;
const flashes = retainFlashes(
  [
    { kind: "blast" as const, createdAt: 100, durationMs: 500 },
    { kind: "blast" as const, createdAt: 200, durationMs: 500 },
    { kind: "muzzle" as const, createdAt: 300, durationMs: 500 },
    { kind: "blast" as const, createdAt: 0, durationMs: 50 },
  ],
  "blast",
  now,
);
assert.equal(flashes.filter((flash) => flash.kind === "blast").length, 1);
assert.equal(flashes.filter((flash) => flash.kind === "muzzle").length, 1);
const afterMuzzle = retainFlashes(flashes, "muzzle", now);
assert.equal(afterMuzzle.filter((flash) => flash.kind === "muzzle").length, 0);
assert.equal(afterMuzzle.filter((flash) => flash.kind === "blast").length, 1);

const torchPos = evaluateFixture(court, "clear", 0, false).position;
assert.equal(
  rainGlintStrength(torchPos, [{ position: torchPos, exposed: true }]),
  1,
);
assert.equal(
  rainGlintStrength(
    { x: torchPos.x + 3, y: torchPos.y, z: torchPos.z },
    [{ position: torchPos, exposed: true }],
  ),
  0,
);
assert.equal(
  rainGlintStrength(torchPos, [{ position: torchPos, exposed: false }]),
  0,
);

console.log("diegetic lights ok");
