import assert from "node:assert";
import {
  calculateShot,
  checkLineOfSight3D,
  gridDistance3D,
  rollRangedAttack,
} from "../src/core/CombatSystem.ts";
import {
  createInitialGrid,
  createInitialUnits,
  WEAPON_CATALOG,
} from "../src/core/GridSystem.ts";
import { computeReachableTiles } from "../src/core/Pathfinding.ts";
import { syncColloredoMobility } from "../src/store/useGameStore.ts";

console.log("=== TEST MISSION 1: ESCAPE OF MARSHAL COLLOREDO ===");

// 1. Test Grid & Map Setup
const grid = createInitialGrid();
assert(grid.width === 16 && grid.depth === 16, "Grid dimensions must be 16x16");

// Check water tiles
const waterTile = grid.getTile({ x: 0, y: 0, z: 0 });
assert(waterTile && waterTile.surface === "water" && !waterTile.walkable, "Čertovka water must not be walkable");

// Check dock & escape zone
const dockTile1 = grid.getTile({ x: 1, y: 0, z: 2 });
const dockTile2 = grid.getTile({ x: 2, y: 0, z: 2 });
assert(dockTile1 && dockTile1.surface === "wood_dock" && dockTile1.walkable, "Dock tile 1 must be walkable wood dock");
assert(dockTile1.isEscapeZone === true, "Dock tile 1 must be marked as escape zone");
assert(dockTile2 && dockTile2.isEscapeZone === true, "Dock tile 2 must be marked as escape zone");

// Check powder kegs
const keg1 = grid.getTile({ x: 5, y: 0, z: 8 });
const keg2 = grid.getTile({ x: 10, y: 0, z: 5 });
assert(keg1 && keg1.obstacle === "powder_keg", "Powder keg 1 must be placed at (5, 0, 8)");
assert(keg2 && keg2.obstacle === "powder_keg", "Powder keg 2 must be placed at (10, 0, 5)");

console.log("✓ Map, Čertovka canal, dock, escape zone, and powder kegs validated.");

// 2. Test Units Setup
const units = createInitialUnits();
const colloredo = units.find((u) => u.id === "player-colloredo");
const martin = units.find((u) => u.id === "player-martin");
const vaclav = units.find((u) => u.id === "player-vaclav");
const jakub = units.find((u) => u.id === "player-jakub");
const odowalsky = units.find((u) => u.id === "enemy-odowalsky");

assert(colloredo && colloredo.isVip, "Colloredo must be present and marked as VIP");
assert(colloredo.armor === 0, "Colloredo has 0 armor (in nightshirt)");
assert(colloredo.archetype === "commander", "Colloredo archetype must be commander");
assert(colloredo.weapon.id === "colloredo_wheellock_pistol", "Colloredo must wield wheellock pistol");
assert(martin && martin.movePerAp === 5, "Martin must have 5 movePerAp");
assert(odowalsky && odowalsky.faction === "enemy", "Odowalsky must be an enemy");

console.log("✓ Initial roster (Colloredo, Martin, Václav, Jakub, Odowalsky) validated.");

// 3. Test Assisted Movement Mechanic (Podepření komorníkem)
// Initially Martin is at (7, 0, 14) and Colloredo is at (8, 0, 14) -> distance 1 -> Assisted!
let synced = syncColloredoMobility(units);
let syncedColloredo = synced.find((u) => u.id === "player-colloredo")!;
assert(syncedColloredo.movePerAp === 5, "Colloredo should have 5 movePerAp when assisted by Martin");
assert(syncedColloredo.buffTitle?.includes("Podepřen"), "Colloredo should have assisted buff title");

// Move ALL allies far away to (2, 0, 8)
const separatedUnits = units.map((u) =>
  u.faction === "player" && u.id !== "player-colloredo"
    ? { ...u, pos: { x: 2, y: 0 as const, z: 8 } }
    : u,
);
synced = syncColloredoMobility(separatedUnits);
syncedColloredo = synced.find((u) => u.id === "player-colloredo")!;
assert(syncedColloredo.movePerAp === 3, "Colloredo must have only 3 movePerAp when limping alone");
assert(syncedColloredo.buffTitle?.includes("kulhání"), "Colloredo should have limping title when alone");

console.log("✓ Assisted mobility mechanic (Martin supporting Colloredo) validated.");

// 4. Test Marshal Aura in Combat
// Colloredo is alive -> allies within 7 tiles should get Marshal Aura bonus (+8 %)
const shotCalcWithMarshal = calculateShot(grid, martin!, odowalsky!, "rain", martin!.pos, units);
const auraMod = shotCalcWithMarshal.hitModifiers.find((m) => m.id === "marshal-colloredo-aura");
assert(auraMod && auraMod.value === 8, "Allies near Colloredo must receive Marshal Aura +8 %");

// If Colloredo is dead, aura must not be present
const deadColloredoUnits = units.map((u) =>
  u.id === "player-colloredo" ? { ...u, alive: false, hp: 0 } : u,
);
const shotCalcNoMarshal = calculateShot(grid, martin!, odowalsky!, "rain", martin!.pos, deadColloredoUnits);
const noAuraMod = shotCalcNoMarshal.hitModifiers.find((m) => m.id === "marshal-colloredo-aura");
assert(!noAuraMod, "When Colloredo is dead, aura bonus must not be present");

console.log("✓ Marshal Colloredo command aura validated.");

// 5. Test Weather & Misfire Mechanics in Rain
// Wheellock vs Matchlock in rain:
assert(shotCalcWithMarshal.lockType === "wheellock", "Martin carbine is wheellock");
const vaclavShotInRain = calculateShot(grid, vaclav!, odowalsky!, "rain", vaclav!.pos, units);
assert(vaclavShotInRain.lockType === "matchlock", "Václav musket is matchlock");
assert(vaclavShotInRain.misfireChance > shotCalcWithMarshal.misfireChance, "Matchlock must have higher misfire chance in rain than wheellock");

console.log(`✓ Rain mechanics validated (Wheellock misfire: ${shotCalcWithMarshal.misfireChance} % vs Matchlock misfire: ${vaclavShotInRain.misfireChance} %).`);

// 6. Test Pathfinding towards the Escape Zone
const reachTiles = computeReachableTiles(grid, colloredo!, units);
assert(reachTiles.size > 0, "Colloredo must have reachable tiles");

console.log(`✓ Reachable tiles computed: ${reachTiles.size} tiles.`);

console.log("=== ALL MISSION 1 TESTS PASSED SUCCESSFULLY! ===");
