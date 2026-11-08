import assert from "node:assert";
import {
  calculateShot,
  checkLineOfSight3D,
  computeEnemyAiDecision,
  gridDistance3D,
  rollRangedAttack,
} from "../src/core/CombatSystem.ts";
import {
  createInitialGrid,
  createInitialUnits,
  WEAPON_CATALOG,
} from "../src/core/GridSystem.ts";
import { computeReachableTiles } from "../src/core/Pathfinding.ts";
import { syncColloredoMobility, useGameStore } from "../src/store/useGameStore.ts";

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
const janMatej = units.find((u) => u.id === "player-jan-matej");
const vaclav = units.find((u) => u.id === "player-vaclav-michalovic");
const bartolomej = units.find((u) => u.id === "player-bartolomej");
const odowalsky = units.find((u) => u.id === "enemy-odowalsky");

assert(colloredo && colloredo.isVip, "Colloredo must be present and marked as VIP");
assert(colloredo.armor === 0, "Colloredo has 0 armor (in nightshirt)");
assert(colloredo.archetype === "commander", "Colloredo archetype must be commander");
assert(colloredo.weapon.id === "colloredo_wheellock_pistol", "Colloredo must wield wheellock pistol");
assert(janMatej && janMatej.movePerAp === 5, "Jan Matěj must have 5 movePerAp");
assert(bartolomej && bartolomej.grenades === 2, "Bratr Bartoloměj must carry 2 petards");
assert(vaclav && vaclav.marksmanship === 78, "Václav must have 78 marksmanship");
assert(odowalsky && odowalsky.faction === "enemy", "Odowalsky must be an enemy");

console.log("✓ Initial roster (Colloredo, Jan Matěj, Václav z Michalovic, Bratr Bartoloměj, Odowalsky) validated.");

// 3. Test Assisted Movement Mechanic (Podepření komorníkem)
// Initially Jan Matěj is at (7, 0, 14) and Colloredo is at (8, 0, 14) -> distance 1 -> Assisted!
let synced = syncColloredoMobility(units);
let syncedColloredo = synced.find((u) => u.id === "player-colloredo")!;
assert(syncedColloredo.movePerAp === 5, "Colloredo should have 5 movePerAp when assisted by Jan Matěj");
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

console.log("✓ Assisted mobility mechanic (Jan Matěj supporting Colloredo) validated.");

// 4. Test Marshal Aura in Combat
// Colloredo is alive -> allies within 7 tiles should get Marshal Aura bonus (+8 %)
const shotCalcWithMarshal = calculateShot(grid, janMatej!, odowalsky!, "rain", janMatej!.pos, units);
const auraMod = shotCalcWithMarshal.hitModifiers.find((m) => m.id === "marshal-colloredo-aura");
assert(auraMod && auraMod.value === 8, "Allies near Colloredo must receive Marshal Aura +8 %");

// If Colloredo is dead, aura must not be present
const deadColloredoUnits = units.map((u) =>
  u.id === "player-colloredo" ? { ...u, alive: false, hp: 0 } : u,
);
const shotCalcNoMarshal = calculateShot(grid, janMatej!, odowalsky!, "rain", janMatej!.pos, deadColloredoUnits);
const noAuraMod = shotCalcNoMarshal.hitModifiers.find((m) => m.id === "marshal-colloredo-aura");
assert(!noAuraMod, "When Colloredo is dead, aura bonus must not be present");

console.log("✓ Marshal Colloredo command aura validated.");

// 5. Test Weather & Misfire Mechanics in Rain
// Wheellock vs Matchlock in rain:
assert(shotCalcWithMarshal.lockType === "wheellock", "Jan Matěj carbine is wheellock");
const vaclavShotInRain = calculateShot(grid, vaclav!, odowalsky!, "rain", vaclav!.pos, units);
assert(vaclavShotInRain.lockType === "matchlock", "Václav musket is matchlock");
assert(vaclavShotInRain.misfireChance > shotCalcWithMarshal.misfireChance, "Matchlock must have higher misfire chance in rain than wheellock");

console.log(`✓ Rain mechanics validated (Wheellock misfire: ${shotCalcWithMarshal.misfireChance} % vs Matchlock misfire: ${vaclavShotInRain.misfireChance} %).`);

// 6. Test Pathfinding towards the Escape Zone
const reachTiles = computeReachableTiles(grid, colloredo!, units);
assert(reachTiles.size > 0, "Colloredo must have reachable tiles");

console.log(`✓ Reachable tiles computed: ${reachTiles.size} tiles.`);

// 7. Test Mission 1 Tutorial & Tactical Advisor Progression
const initialStore = useGameStore.getState();
assert(initialStore.tutorialStep === 1, "Tutorial must start at step 1 for Mission 1");
assert(initialStore.tutorialDismissed === false, "Tutorial must not be dismissed initially");

initialStore.advanceTutorialStep();
assert(useGameStore.getState().tutorialStep === 2, "advanceTutorialStep should advance to step 2");

initialStore.advanceTutorialStep();
assert(useGameStore.getState().tutorialStep === 3, "advanceTutorialStep should advance to step 3");

initialStore.advanceTutorialStep();
assert(useGameStore.getState().tutorialStep === 4, "advanceTutorialStep should advance to step 4");

initialStore.advanceTutorialStep();
assert(useGameStore.getState().tutorialStep === null, "advanceTutorialStep on step 4 should finish tutorial");

initialStore.setTutorialStep(1);
assert(useGameStore.getState().tutorialStep === 1, "setTutorialStep should jump directly to step 1");

initialStore.toggleTutorial();
assert(useGameStore.getState().tutorialDismissed === true, "toggleTutorial should dismiss tutorial");
initialStore.toggleTutorial();
assert(useGameStore.getState().tutorialDismissed === false, "toggleTutorial should restore tutorial");

initialStore.resetGame();
assert(useGameStore.getState().tutorialStep === 1, "resetGame must reset tutorialStep to 1");
assert(useGameStore.getState().tutorialDismissed === false, "resetGame must reset tutorialDismissed to false");

console.log("✓ Tutorial state machine (Tactical Advisor progression, toggle, reset) validated.");

// 8. Test Paradoxical Martyrdom & Clementinum Iron Vigil Induction
const store = useGameStore.getState();
assert(store.sacrificeDilemmaOpen === false, "Dilemma must be closed initially");
assert(store.sacrificedHeroId === null, "No hero sacrificed initially");
assert(store.ironVigilPerk === null, "No Iron Vigil perk awarded initially");

// Execute sacrifice choice for Bratr Bartoloměj
store.chooseSacrifice("player-bartolomej");
const stateAfterSacrifice = useGameStore.getState();
assert(stateAfterSacrifice.sacrificeDilemmaOpen === false, "Dilemma must close after selection");
assert(stateAfterSacrifice.sacrificedHeroId === "player-bartolomej", "sacrificedHeroId must match selected hero");
assert(stateAfterSacrifice.outcome === "victory", "Outcome must transition to victory");
assert(stateAfterSacrifice.victoryReason === "boat_escape", "Victory reason must be boat_escape");
assert(stateAfterSacrifice.ironVigilPerk?.name === "Maltézský pyrotechnik", "Bartoloměj must receive Maltézský pyrotechnik perk");
assert(stateAfterSacrifice.ironVigilPerk?.heroName === "Bratr Bartoloměj", "Perk heroName must be Bratr Bartoloměj");

// Test reset clears sacrifice and perk
stateAfterSacrifice.resetGame();
const stateAfterReset = useGameStore.getState();
assert(stateAfterReset.sacrificedHeroId === null, "resetGame must clear sacrificedHeroId");
assert(stateAfterReset.ironVigilPerk === null, "resetGame must clear ironVigilPerk");
assert(stateAfterReset.sacrificeDilemmaOpen === false, "resetGame must close dilemma");

console.log("✓ Paradoxical Martyrdom and Iron Vigil induction state machine validated.");

// 9. Test Swedish Capture & Ransom Directive (AI priority for Colloredo)
const testUnitsWithColloredoInSight = units.map((u) => {
  if (u.id === "enemy-odowalsky") {
    return { ...u, pos: { x: 8, y: 0 as const, z: 8 }, ap: 2 };
  }
  return u;
});
const aiDecision = computeEnemyAiDecision(
  grid,
  testUnitsWithColloredoInSight.find((u) => u.id === "enemy-odowalsky")!,
  testUnitsWithColloredoInSight,
  "clear",
);
assert(
  aiDecision.targetId === "player-colloredo",
  "Swedish AI must prioritize subduing Marshal Colloredo for ransom",
);

console.log("✓ Swedish Capture & Ransom directive validated (Colloredo targeted for high-value capture).");

console.log("=== ALL MISSION 1 TESTS PASSED SUCCESSFULLY! ===");
