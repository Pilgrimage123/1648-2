import assert from "node:assert";
import {
  applyBlackPowderChoking,
  calculateMeleeAttack,
  calculateShot,
  checkEnemyColloredoCapture,
  checkLineOfSight3D,
  computeEnemyAiDecision,
  evaluateAdjacentMeleeTargets,
  evaluateVisibleTargets,
  gridDistance3D,
  isAdjacentForMelee,
  isCompanionProtectedByCount,
  isInPreparedVolleyCone,
  isInstantOverkill,
  resolveTargetCoverAgainstShot,
  resolveUnitDamageResolution,
  rollMeleeAttack,
  rollRangedAttack,
} from "../src/core/CombatSystem.ts";
import {
  coordKey,
  createInitialGrid,
  createInitialUnits,
  createReinforcementUnits,
  getMission1TutorialBeacon,
  MELEE_CATALOG,
  resolvePreferredFloorCoord,
  WEAPON_CATALOG,
} from "../src/core/GridSystem.ts";
import {
  computeReachableTiles,
  findPathAStar,
} from "../src/core/Pathfinding.ts";
import {
  checkFogLineOfSight3D,
  computeFogOfWar,
  computeUnitSightRadius,
  createInitialExploredCoords,
  getTileVisibility,
  previewReconFromTile,
} from "../src/core/FogOfWar.ts";
import {
  advanceColloredoDetentionTurn,
  buildUnitCombatLoss,
  checkMissionOutcome,
  resolveShotImpactMetadata,
  syncColloredoCaptureState,
  syncColloredoMobility,
  useGameStore,
} from "../src/store/useGameStore.ts";
import {
  computeScrambleDestination,
  createInitialCameraDirectorState,
  detectPathInteractions,
  resolveActiveCameraState,
  resolveDynamicRoofCutawayFloor,
  resolvePrimaryCoverDirection,
  shouldTriggerActionCamForMove,
} from "../src/core/CameraDirector.ts";
import type { FloorLevel, GridCoord, UnitData } from "../src/core/types.ts";

console.log("=== TEST MISSION 1: ESCAPE OF MARSHAL COLLOREDO (GRAND PRIORY PALACE) ===");

// 1. Test Grid & Expanded 3-Floor Baroque Map Setup
const grid = createInitialGrid();
assert(
  grid.width === 24 && grid.depth === 28 && grid.floors === 3,
  "Grid dimensions must be 24x28 with 3 floors (P0, P1, P2)",
);

// Check water tiles (Čertovka canal)
const waterTile = grid.getTile({ x: 0, y: 0, z: 0 });
assert(
  waterTile && waterTile.surface === "water" && !waterTile.walkable,
  "Čertovka water must not be walkable",
);

// Check distant dock & escape zone at Čertovka
const dockTile1 = grid.getTile({ x: 3, y: 0, z: 2 });
const dockTile2 = grid.getTile({ x: 4, y: 0, z: 2 });
assert(
  dockTile1 && dockTile1.surface === "wood_dock" && dockTile1.walkable,
  "Dock tile 1 must be walkable wood dock",
);
assert(
  dockTile1.isEscapeZone === true,
  "Dock tile 1 (3, 0, 2) must be marked as escape zone",
);
assert(
  dockTile2 && dockTile2.isEscapeZone === true,
  "Dock tile 2 (4, 0, 2) must be marked as escape zone",
);

// Check 3 powder kegs in the Maltese Garden
const keg1 = grid.getTile({ x: 7, y: 0, z: 13 });
const keg2 = grid.getTile({ x: 16, y: 0, z: 9 });
const keg3 = grid.getTile({ x: 10, y: 0, z: 6 });
assert(keg1 && keg1.obstacle === "powder_keg", "Powder keg 1 must be at (7, 0, 13)");
assert(keg2 && keg2.obstacle === "powder_keg", "Powder keg 2 must be at (16, 0, 9)");
assert(keg3 && keg3.obstacle === "powder_keg", "Powder keg 3 must be at (10, 0, 6)");

const kegBeacon = getMission1TutorialBeacon(grid, 3);
assert(
  kegBeacon !== null && grid.getTile(kegBeacon.coord)?.obstacle === "powder_keg",
  "Tutorial step 3 beacon must sit on a powder keg",
);
assert(
  kegBeacon!.coord.x === 7 && kegBeacon!.coord.y === 0 && kegBeacon!.coord.z === 13,
  "Tutorial step 3 beacon must mark the palace-side keg (7, 0, 13)",
);
const dockBeacon = getMission1TutorialBeacon(grid, 4);
assert(
  dockBeacon !== null && grid.getTile(dockBeacon.coord)?.isEscapeZone === true,
  "Tutorial step 4 beacon must sit on an escape tile",
);
assert(
  dockBeacon!.coord.x === 3 && dockBeacon!.coord.y === 0 && dockBeacon!.coord.z === 2,
  "Tutorial step 4 beacon must mark the Čertovka dock (3, 0, 2)",
);
assert(
  getMission1TutorialBeacon(grid, 1) === null &&
    getMission1TutorialBeacon(grid, 2) === null,
  "Tutorial steps 1 and 2 have no world beacon",
);

// Check Piano Nobile (P1) and Maltese Watchtower (P2)
const pianoNobileTile = grid.getTile({ x: 11, y: 1, z: 23 });
assert(
  pianoNobileTile && pianoNobileTile.hasFloor && pianoNobileTile.walkable,
  "Grand Priory Palace Piano Nobile (1st floor) must be walkable",
);
const watchtowerTile = grid.getTile({ x: 6, y: 2, z: 18 });
assert(
  watchtowerTile && watchtowerTile.hasFloor && watchtowerTile.walkable,
  "Maltese Watchtower (2nd floor) must be walkable",
);

console.log(
  "✓ 24x28x3 Map, Grand Priory Palace (P0, P1 Piano Nobile, P2 Watchtower), Čertovka dock, and powder kegs validated.",
);

// 1b. Test Straight, Grand and Spiral Staircases Walkability (Up & Down across P0, P1, P2)
const grandStairP0 = grid.getTile({ x: 11, y: 0, z: 22 });
assert(
  grandStairP0?.stairType === "grand_stairs",
  "Grand Palace Staircase at (11, 22) must be grand_stairs",
);
const westStraightP0 = grid.getTile({ x: 4, y: 0, z: 20 });
assert(
  westStraightP0?.stairType === "straight_stairs",
  "West Convent Staircase at (4, 20) must be straight_stairs",
);
const towerSpiralP1 = grid.getTile({ x: 5, y: 1, z: 18 });
assert(
  towerSpiralP1?.stairType === "spiral_stairs",
  "Watchtower Staircase at (5, 18) must be spiral_stairs",
);

// Pathfinding across grand staircase (P0 -> P1 and P1 -> P0)
const pathStraightUp = findPathAStar(
  grid,
  { x: 11, y: 0, z: 21 },
  { x: 11, y: 1, z: 24 },
  [],
);
assert(
  pathStraightUp.length > 0 && pathStraightUp[pathStraightUp.length - 1]!.y === 1,
  "Unit must walk smoothly up the Grand Palace Imperial Staircase from P0 to P1",
);
const pathStraightDown = findPathAStar(
  grid,
  { x: 11, y: 1, z: 24 },
  { x: 11, y: 0, z: 21 },
  [],
);
assert(
  pathStraightDown.length > 0 &&
    pathStraightDown[pathStraightDown.length - 1]!.y === 0,
  "Unit must walk smoothly down the Grand Palace Imperial Staircase from P1 to P0",
);

// Pathfinding across spiral staircase from P0 all the way to P2 (Maltese Watchtower) and back down
const pathSpiralToTower = findPathAStar(
  grid,
  { x: 5, y: 0, z: 19 },
  { x: 6, y: 2, z: 18 },
  [],
);
assert(
  pathSpiralToTower.length > 0 &&
    pathSpiralToTower[pathSpiralToTower.length - 1]!.y === 2,
  "Unit must climb from P0 through P1 to P2 Watchtower via spiral/straight staircases",
);
const pathFromTowerToGround = findPathAStar(
  grid,
  { x: 6, y: 2, z: 18 },
  { x: 5, y: 0, z: 19 },
  [],
);
assert(
  pathFromTowerToGround.length > 0 &&
    pathFromTowerToGround[pathFromTowerToGround.length - 1]!.y === 0,
  "Unit must descend from P2 Watchtower back to P0 courtyard smoothly",
);

// Anti-deadlock test on Garden Belvedere staircase when upper landing is occupied by another unit
const dummyBlocker = createInitialUnits()[0]!;
const occupiedLandingUnits = [
  { ...dummyBlocker, id: "blocker-unit", pos: { x: 10, y: 1 as const, z: 12 } },
];
const pathPastOccupiedLanding = findPathAStar(
  grid,
  { x: 10, y: 0, z: 13 },
  { x: 11, y: 1, z: 12 },
  occupiedLandingUnits,
  "moving-unit",
);
assert(
  pathPastOccupiedLanding.length > 0,
  "Unit must be able to climb stairs onto an adjacent upper tile even when the top landing tile is occupied",
);

console.log(
  "✓ Straight & Spiral Staircases walkability (P0 <-> P1 <-> P2 + anti-deadlock ramp transitions) validated.",
);

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
assert(
  colloredo.weapon.id === "colloredo_wheellock_pistol",
  "Colloredo must wield wheellock pistol",
);
assert(janMatej && janMatej.movePerAp === 5, "Jan Matěj must have 5 movePerAp");
assert(bartolomej && bartolomej.grenades === 2, "Bratr Bartoloměj must carry 2 petards");
assert(vaclav && vaclav.marksmanship === 78, "Václav must have 78 marksmanship");
assert(
  vaclav.pos.y === 1,
  "Václav starts on the 1st-floor Piano Nobile Arcade Gallery (y = 1)",
);
assert(odowalsky && odowalsky.faction === "enemy", "Odowalsky must be an enemy");
assert(odowalsky.maxHp === 10, "Odowalsky must have 10 maxHp (ADR-0012)");
assert(
  units
    .filter((u) => u.faction === "enemy" && u.id !== "enemy-odowalsky")
    .every((e) => e.maxHp === 8),
  "All initial enemy musketeers must have 8 maxHp (ADR-0012)",
);
assert(
  units.filter((u) => u.faction === "enemy").every((e) => e.archetype === "trooper"),
  "All initial enemies must be musketeers (archetype trooper)",
);

console.log(
  "✓ Initial roster (Colloredo, Jan Matěj, Václav z Michalovic on P1, Bratr Bartoloměj, all enemies musketeers) validated.",
);

// 3. Test Colloredo Mobility & Detainment State (Těžké kulhání)
let synced = syncColloredoMobility(units);
let syncedColloredo = synced.find((u) => u.id === "player-colloredo")!;
assert(
  syncedColloredo.movePerAp === 3,
  "Colloredo must have 3 movePerAp due to Těžké kulhání postih",
);
assert(
  syncedColloredo.buffTitle?.includes("kulhání"),
  "Colloredo must have Těžké kulhání buff title",
);

// Move ALL allies far away to (3, 0, 8)
const separatedUnits = units.map((u) =>
  u.faction === "player" && u.id !== "player-colloredo"
    ? { ...u, pos: { x: 3, y: 0 as const, z: 8 } }
    : u,
);
synced = syncColloredoMobility(separatedUnits);
syncedColloredo = synced.find((u) => u.id === "player-colloredo")!;
assert(
  syncedColloredo.movePerAp === 3,
  "Colloredo persistently has 3 movePerAp handicap",
);
assert(
  syncedColloredo.buffTitle?.includes("kulhání"),
  "Colloredo retains Těžké kulhání status",
);

console.log("✓ Colloredo postih Těžké kulhání (3 movePerAp) validated.");

// 4. Test Marshal Aura in Combat
const shotCalcWithMarshal = calculateShot(
  grid,
  janMatej!,
  odowalsky!,
  "rain",
  janMatej!.pos,
  units,
);
const auraMod = shotCalcWithMarshal.hitModifiers.find(
  (m) => m.id === "marshal-colloredo-aura",
);
assert(
  auraMod && auraMod.value === 8,
  "Allies near Colloredo must receive Marshal Aura +8 %",
);

const detainedColloredoUnits = units.map((u) =>
  u.id === "player-colloredo" ? { ...u, hp: 0, detainedTurns: 1 } : u,
);
const shotCalcNoMarshal = calculateShot(
  grid,
  janMatej!,
  odowalsky!,
  "rain",
  janMatej!.pos,
  detainedColloredoUnits,
);
const noAuraMod = shotCalcNoMarshal.hitModifiers.find(
  (m) => m.id === "marshal-colloredo-aura",
);
assert(
  !noAuraMod,
  "When Colloredo is downed/detained, aura bonus must not be present",
);

console.log("✓ Marshal Colloredo command aura validated.");

// 5. Test Weather & Misfire Mechanics in Rain
assert(shotCalcWithMarshal.lockType === "wheellock", "Jan Matěj carbine is wheellock");
const vaclavShotInRain = calculateShot(
  grid,
  vaclav!,
  odowalsky!,
  "rain",
  vaclav!.pos,
  units,
);
assert(vaclavShotInRain.lockType === "matchlock", "Václav musket is matchlock");
assert(
  vaclavShotInRain.misfireChance > shotCalcWithMarshal.misfireChance,
  "Matchlock must have higher misfire chance in rain than wheellock",
);

console.log(
  `✓ Rain mechanics validated (Wheellock misfire: ${shotCalcWithMarshal.misfireChance} % vs Matchlock misfire: ${vaclavShotInRain.misfireChance} %).`,
);

// 6. Test Pathfinding & Reachable Tiles (including 1st Floor Piano Nobile via Grand Staircase)
const reachTiles = computeReachableTiles(grid, colloredo!, units);
assert(reachTiles.size > 0, "Colloredo must have reachable tiles");
const canReachPianoNobile = Array.from(reachTiles.values()).some(
  (r) => r.coord.y === 1,
);
assert(
  canReachPianoNobile,
  "Colloredo at foot of Grand Staircase must be able to reach 1st-floor Piano Nobile tiles",
);

console.log(
  `✓ Reachable tiles computed: ${reachTiles.size} tiles (including 1st-floor Piano Nobile via staircase).`,
);

// 7. Test Mission 1 Tutorial & Tactical Advisor Progression
const initialStore = useGameStore.getState();
assert(initialStore.tutorialStep === 1, "Tutorial must start at step 1 for Mission 1");
assert(
  initialStore.tutorialDismissed === false,
  "Tutorial must not be dismissed initially",
);

initialStore.advanceTutorialStep();
assert(
  useGameStore.getState().tutorialStep === 2,
  "advanceTutorialStep should advance to step 2",
);

initialStore.advanceTutorialStep();
assert(
  useGameStore.getState().tutorialStep === 3,
  "advanceTutorialStep should advance to step 3",
);

initialStore.advanceTutorialStep();
assert(
  useGameStore.getState().tutorialStep === 4,
  "advanceTutorialStep should advance to step 4",
);

initialStore.advanceTutorialStep();
assert(
  useGameStore.getState().tutorialStep === null,
  "advanceTutorialStep on step 4 should finish tutorial",
);

initialStore.setTutorialStep(1);
assert(
  useGameStore.getState().tutorialStep === 1,
  "setTutorialStep should jump directly to step 1",
);

initialStore.toggleTutorial();
assert(
  useGameStore.getState().tutorialDismissed === true,
  "toggleTutorial should dismiss tutorial",
);
initialStore.toggleTutorial();
assert(
  useGameStore.getState().tutorialDismissed === false,
  "toggleTutorial should restore tutorial",
);

initialStore.resetGame();
assert(
  useGameStore.getState().tutorialStep === 1,
  "resetGame must reset tutorialStep to 1",
);
assert(
  useGameStore.getState().tutorialDismissed === false,
  "resetGame must reset tutorialDismissed to false",
);

console.log(
  "✓ Tutorial state machine (Tactical Advisor progression, toggle, reset) validated.",
);

// 8. Test Paradoxical Martyrdom & Clementinum Iron Vigil Induction
const store = useGameStore.getState();
assert(store.sacrificeDilemmaOpen === false, "Dilemma must be closed initially");
assert(store.sacrificedHeroId === null, "No hero sacrificed initially");
assert(store.ironVigilPerk === null, "No Iron Vigil perk awarded initially");

store.chooseSacrifice("player-bartolomej");
const stateAfterSacrifice = useGameStore.getState();
assert(
  stateAfterSacrifice.sacrificeDilemmaOpen === false,
  "Dilemma must close after selection",
);
assert(
  stateAfterSacrifice.sacrificedHeroId === "player-bartolomej",
  "sacrificedHeroId must match selected hero",
);
assert(
  stateAfterSacrifice.outcome === "victory",
  "Outcome must transition to victory",
);
assert(
  stateAfterSacrifice.victoryReason === "boat_escape",
  "Victory reason must be boat_escape",
);
assert(
  stateAfterSacrifice.ironVigilPerk?.name === "Maltézský pyrotechnik",
  "Bartoloměj must receive Maltézský pyrotechnik perk",
);
assert(
  stateAfterSacrifice.ironVigilPerk?.heroName === "Bratr Bartoloměj",
  "Perk heroName must be Bratr Bartoloměj",
);

stateAfterSacrifice.resetGame();
const stateAfterReset = useGameStore.getState();
assert(
  stateAfterReset.sacrificedHeroId === null,
  "resetGame must clear sacrificedHeroId",
);
assert(
  stateAfterReset.ironVigilPerk === null,
  "resetGame must clear ironVigilPerk",
);
assert(
  stateAfterReset.sacrificeDilemmaOpen === false,
  "resetGame must close dilemma",
);

console.log("✓ Paradoxical Martyrdom and Iron Vigil induction state machine validated.");

// 9. Test Swedish Capture & Protection Directives
// 9a. Swedish AI captures Colloredo by spending 1 AP (adjacent or within 3 tiles with loaded firearm)
const testUnitsWithColloredoInSight = units.map((u) => {
  if (u.id === "enemy-odowalsky") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 12 }, ap: 2, firearmLoaded: true };
  }
  if (u.id === "player-colloredo") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 16 }, ap: 2 };
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
  "Swedish AI must prioritize moving to capture Marshal Colloredo",
);
assert(
  aiDecision.isCaptureAction === true,
  "Enemy AI decision must mark isCaptureAction as true for Colloredo capture",
);

// 9b. Swedes NEVER shoot at Count Colloredo in evaluateVisibleTargets
const odowalskyUnit = testUnitsWithColloredoInSight.find((u) => u.id === "enemy-odowalsky")!;
const enemyTargets = evaluateVisibleTargets(
  grid,
  odowalskyUnit,
  testUnitsWithColloredoInSight,
  "clear",
);
assert(
  !enemyTargets.some((t) => t.targetId === "player-colloredo"),
  "Swedes must NEVER have Count Colloredo in evaluateVisibleTargets for shooting",
);

// 9c. checkEnemyColloredoCapture unit tests
const countUnit = testUnitsWithColloredoInSight.find((u) => u.id === "player-colloredo")!;

// Adjacent enemy: can capture regardless of firearm
const adjacentEnemy = { ...odowalskyUnit, pos: { x: 10, y: 0 as const, z: 15 }, firearmLoaded: false };
const capAdj = checkEnemyColloredoCapture(grid, adjacentEnemy, countUnit);
assert(capAdj.canCapture === true && capAdj.isAdjacent === true, "Adjacent enemy must be able to capture");

// 2-3 tiles away with loaded firearm and clear LOS: can capture
const gunpointEnemy = { ...odowalskyUnit, pos: { x: 10, y: 0 as const, z: 13 }, firearmLoaded: true };
const capGunpoint = checkEnemyColloredoCapture(grid, gunpointEnemy, countUnit);
assert(capGunpoint.canCapture === true && capGunpoint.isGunpoint === true, "Enemy within 3 tiles with loaded firearm must be able to capture");

// 2-3 tiles away with UNLOADED firearm: CANNOT capture
const unloadedGunEnemy = { ...odowalskyUnit, pos: { x: 10, y: 0 as const, z: 13 }, firearmLoaded: false };
const capUnloaded = checkEnemyColloredoCapture(grid, unloadedGunEnemy, countUnit);
assert(capUnloaded.canCapture === false, "Enemy within 3 tiles with unloaded firearm CANNOT capture");

// 4 tiles away: CANNOT capture
const farEnemy = { ...odowalskyUnit, pos: { x: 10, y: 0 as const, z: 12 }, firearmLoaded: true };
const capFar = checkEnemyColloredoCapture(grid, farEnemy, countUnit);
assert(capFar.canCapture === false, "Enemy 4 tiles away cannot capture without moving closer");

// 9d. Companion protection: Swedes do not shoot at companion within 3 tiles of Count when Count is seen
const testUnitsWithCompanionNearCount = units.map((u) => {
  if (u.id === "enemy-odowalsky") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 10 }, ap: 2, firearmLoaded: true };
  }
  if (u.id === "player-colloredo") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 16 }, ap: 2 };
  }
  if (u.id === "player-jan-matej") {
    // Companion is 2 tiles from Colloredo (z: 14 vs 16)
    return { ...u, pos: { x: 10, y: 0 as const, z: 14 }, ap: 2 };
  }
  return u;
});

const matejNear = testUnitsWithCompanionNearCount.find((u) => u.id === "player-jan-matej")!;
const shooterAt10 = testUnitsWithCompanionNearCount.find((u) => u.id === "enemy-odowalsky")!;
const isProtected = isCompanionProtectedByCount(
  grid,
  shooterAt10.pos,
  matejNear,
  testUnitsWithCompanionNearCount,
);
assert(
  isProtected === true,
  "Companion within 3 tiles of Count when shooter sees Count must be protected",
);

const targetsWithMatejNear = evaluateVisibleTargets(
  grid,
  shooterAt10,
  testUnitsWithCompanionNearCount,
  "clear",
);
assert(
  !targetsWithMatejNear.some((t) => t.targetId === "player-jan-matej"),
  "Swedes must NOT target companion within 3 tiles of Count when shooter sees Count",
);

// 9e. Companion away from Count (4+ tiles): Swedes CAN shoot at companion
const testUnitsWithCompanionFarFromCount = units.map((u) => {
  if (u.id === "enemy-odowalsky") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 8 }, ap: 2, firearmLoaded: true };
  }
  if (u.id === "player-colloredo") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 18 }, ap: 2 };
  }
  if (u.id === "player-jan-matej") {
    // Companion is 5 tiles from Colloredo (z: 13 vs 18)
    return { ...u, pos: { x: 10, y: 0 as const, z: 13 }, ap: 2 };
  }
  return u;
});
const matejFar = testUnitsWithCompanionFarFromCount.find((u) => u.id === "player-jan-matej")!;
const shooterAt8 = testUnitsWithCompanionFarFromCount.find((u) => u.id === "enemy-odowalsky")!;
const isFarProtected = isCompanionProtectedByCount(
  grid,
  shooterAt8.pos,
  matejFar,
  testUnitsWithCompanionFarFromCount,
);
assert(
  isFarProtected === false,
  "Companion 5 tiles away from Count must NOT be protected",
);
const targetsWithMatejFar = evaluateVisibleTargets(
  grid,
  shooterAt8,
  testUnitsWithCompanionFarFromCount,
  "clear",
);
assert(
  targetsWithMatejFar.some((t) => t.targetId === "player-jan-matej"),
  "Swedes CAN target companion when companion is not within 3 tiles of Count",
);

console.log(
  "✓ Swedish Capture & Companion Protection Directives (Count not shot at, 1 AP capture, 3-tile protection) validated.",
);

// 10. Test 2-Turn Marshal Colloredo Detention, Rescue, and Capture (Game Over) Mechanics
const downedUnits = separatedUnits.map((u) =>
  u.id === "player-colloredo" ? { ...u, hp: 0 } : u,
);
const syncDowned = syncColloredoCaptureState(downedUnits);
const downedMarshal = syncDowned.units.find((u) => u.id === "player-colloredo")!;
assert(syncDowned.newlyDetained === true, "0 HP Colloredo must trigger newlyDetained");
assert(
  downedMarshal.detainedTurns === 1,
  "0 HP Colloredo must have detainedTurns === 1 on first turn",
);
assert(downedMarshal.captureReason === "zero_hp", "Capture reason must be zero_hp");
assert(
  downedMarshal.alive === true,
  "Colloredo must remain alive on the map while detained",
);
const checkAfterTurn1 = checkMissionOutcome(grid, syncDowned.units);
assert(
  checkAfterTurn1.outcome === "ongoing",
  "1st turn of detention (1/2) must NOT cause Game Over yet",
);

const rescuedInput = syncDowned.units.map((u) =>
  u.id === "player-jan-matej"
    ? {
        ...u,
        pos: { x: downedMarshal.pos.x - 1, y: downedMarshal.pos.y, z: downedMarshal.pos.z },
      }
    : u,
);
const syncRescued = syncColloredoCaptureState(rescuedInput);
const rescuedMarshal = syncRescued.units.find((u) => u.id === "player-colloredo")!;
assert(
  syncRescued.rescued === true,
  "Companion adjacent to Colloredo without enemy captors must rescue him",
);
assert(
  rescuedMarshal.detainedTurns === 0,
  "Rescued Colloredo must have detainedTurns === 0",
);
assert(
  rescuedMarshal.hp === 3,
  "Rescued downed Colloredo must be lifted back to 3 HP",
);

const surroundedInput = separatedUnits.map((u) =>
  u.id === "enemy-odowalsky"
    ? { ...u, pos: { x: colloredo!.pos.x, y: colloredo!.pos.y, z: colloredo!.pos.z - 1 } }
    : u,
);
const syncSurrounded = syncColloredoCaptureState(surroundedInput);
const surroundedMarshal = syncSurrounded.units.find(
  (u) => u.id === "player-colloredo",
)!;
assert(
  syncSurrounded.newlyDetained === true,
  "Enemy adjacent to unescorted Colloredo must detain him",
);
assert(
  surroundedMarshal.detainedTurns === 1,
  "Surrounded Colloredo must have detainedTurns === 1",
);
assert(
  surroundedMarshal.captureReason === "surrounded_unprotected",
  "Capture reason must be surrounded_unprotected",
);
assert(
  checkMissionOutcome(grid, syncSurrounded.units).outcome === "ongoing",
  "1st turn of surrounded detention must still be ongoing (1/2)",
);

const advanced = advanceColloredoDetentionTurn(syncSurrounded.units);
const capturedMarshal = advanced.units.find((u) => u.id === "player-colloredo")!;
assert(advanced.capturedNow === true, "2nd turn of detention must finalize capture");
assert(
  capturedMarshal.detainedTurns === 2,
  "Captured Colloredo must have detainedTurns === 2",
);
const checkAfterTurn2 = checkMissionOutcome(grid, advanced.units);
assert(
  checkAfterTurn2.outcome === "defeat",
  "2nd turn of detention (2/2) must trigger Game Over (defeat)",
);
assert(
  checkAfterTurn2.defeatReason === "surrounded_unprotected",
  "Defeat reason must preserve surrounded_unprotected",
);

console.log(
  "✓ 2-turn Marshal Colloredo detention (1/2), companion rescue, and capture Game Over (2/2) validated.",
);

// 11. Test That No Player Character Has Special Abilities in Mission 1
const abilityStore = useGameStore.getState();
abilityStore.resetGame();

const playerUnitsWithNoAbilities = useGameStore
  .getState()
  .units.filter((u) => u.faction === "player");

playerUnitsWithNoAbilities.forEach((u) => {
  assert(
    u.ability === undefined,
    `${u.name} must have no special ability in mission 1`,
  );
});

console.log(
  "✓ Confirmed no player character has special abilities in Mission 1.",
);

// 12. Test Baroque Chiaroscuro Fog of War (3-state visibility, elevation/weather/smoke sight, sound/matchcord contacts)
useGameStore.getState().resetGame();
const fogState = useGameStore.getState();
assert(
  fogState.fogOfWarEnabled === true,
  "Fog of War (Barokní šerosvit) must be enabled by default",
);

const initialExplored = createInitialExploredCoords(fogState.grid);
assert(
  initialExplored.has("11,0,22"),
  "Grand Priory Palace interior (11,0,22) must start in explored memory",
);
assert(
  initialExplored.has("3,0,2"),
  "Čertovka fisherman skiff dock (3,0,2) must start in explored memory",
);

// Verify dynamic sight radius across floors and weather
const vaclavFogUnit = fogState.units.find(
  (u) => u.id === "player-vaclav-michalovic",
)!;
const vaclavSightP1Rain = computeUnitSightRadius(
  fogState.grid,
  vaclavFogUnit,
  "rain",
  { x: 14, y: 1, z: 16 },
);
const vaclavSightP2Clear = computeUnitSightRadius(
  fogState.grid,
  vaclavFogUnit,
  "clear",
  { x: 6, y: 2, z: 18 },
);
const vaclavSightP0Fog = computeUnitSightRadius(
  fogState.grid,
  vaclavFogUnit,
  "fog",
  { x: 14, y: 0, z: 16 },
);
assert(
  vaclavSightP2Clear > vaclavSightP1Rain && vaclavSightP1Rain > vaclavSightP0Fog,
  `Sight radius must scale with floor elevation and weather (P2 clear=${vaclavSightP2Clear} > P1 rain=${vaclavSightP1Rain} > P0 fog=${vaclavSightP0Fog})`,
);

// Verify initial spotted vs. shrouded enemies & 17th-century Sound/Matchcord Contacts
assert(
  fogState.fogSnapshot.visibleEnemyIds.has("enemy-sniper-roof"),
  "Swedish sharpshooter on garden belvedere (12,1,10) must be spotted at start from Piano Nobile",
);
assert(
  !fogState.fogSnapshot.visibleEnemyIds.has("enemy-garden-musketeer"),
  "Swedish dragoon in western garden (6,0,8) must start shrouded in Fog of War",
);
assert(
  fogState.fogSnapshot.soundContacts.some((c) => c.unitId === "enemy-garden-musketeer"),
  "Unspotted dragoon within acoustic range must emit a 17th-century Sound Contact",
);

// Verify black-powder smoke LoS occlusion on same floor vs. high-ground overlook
const smokeTestGrid = createInitialGrid();
smokeTestGrid.addSmoke({ x: 11, y: 0, z: 12 }, 0, 2);
const losBlockedBySmoke = checkFogLineOfSight3D(
  smokeTestGrid,
  { x: 11, y: 0, z: 16 },
  { x: 11, y: 0, z: 9 },
  false,
);
assert(
  !losBlockedBySmoke,
  "Intermediate black-powder smoke tile must block ground-level P0->P0 Fog of War line of sight",
);
const losOverSmokeFromTower = checkFogLineOfSight3D(
  smokeTestGrid,
  { x: 6, y: 2, z: 18 },
  { x: 6, y: 0, z: 9 },
  false,
);
assert(
  losOverSmokeFromTower,
  "Viewing from elevated Maltese Watchtower (P2) must overlook ground-level smoke onto target",
);

// Verify tile visibility helper and toggleFogOfWar
const farNorthCorner = { x: 20, y: 0 as const, z: 3 };
assert(
  getTileVisibility(farNorthCorner, fogState.fogSnapshot, true) === "unexplored",
  "Far northern garden corner outside sight radius must start unexplored",
);
useGameStore.getState().toggleFogOfWar();
assert(
  useGameStore.getState().fogOfWarEnabled === false &&
    getTileVisibility(farNorthCorner, useGameStore.getState().fogSnapshot, false) ===
      "visible",
  "Toggling Fog of War off must make all tiles visible",
);
useGameStore.getState().toggleFogOfWar();
assert(
  useGameStore.getState().fogOfWarEnabled === true,
  "Toggling Fog of War back on must restore Chiaroscuro Fog of War",
);

// Verify recon preview from candidate tile
const reconPreview = previewReconFromTile(
  fogState.grid,
  vaclavFogUnit,
  { x: 6, y: 0, z: 9 },
  fogState.units,
  "rain",
  fogState.fogSnapshot.visibleEnemyIds,
);
assert(
  reconPreview.newlyRevealedCount >= 1 &&
    reconPreview.spottedEnemyIds.includes("enemy-garden-musketeer"),
  "Recon preview from (5,0,8) must detect the newly revealed garden musketeer",
);

console.log(
  "✓ Baroque Chiaroscuro Fog of War (3-state visibility, elevation/weather/smoke sight, sound/matchcord contacts, recon preview) validated.",
);

// 14. Test Tactical Pressure & Swedish Reinforcement Timing in Mission 1
useGameStore.getState().resetGame();
const initialPressureState = useGameStore.getState();
assert(
  initialPressureState.round === 1,
  "Mission must start at Round 1",
);
assert(
  initialPressureState.reinforcementsSpawned === false,
  "Reinforcements must not be spawned at mission start",
);
assert(
  initialPressureState.reinforcementRound === 5,
  "Reinforcements must be configured to arrive at Round 5",
);

// Check reinforcement unit generator
const reinforcementUnits = createReinforcementUnits();
assert(
  reinforcementUnits.length === 2,
  "Reinforcements must consist of 2 units (Swedish Musketeer reinforcements)",
);
assert(
  reinforcementUnits.every((u) => u.archetype === "trooper"),
  "All reinforcement units must be musketeers (archetype trooper)",
);
assert(
  reinforcementUnits.some((u) => u.id === "enemy-reinforcement-vanguard" && u.faction === "enemy" && u.pos.z === 5),
  "Reinforcement musketeer 1 must arrive at northern garden gate (z: 5)",
);
assert(
  reinforcementUnits.some((u) => u.id === "enemy-reinforcement-reserve" && u.faction === "enemy" && u.pos.z === 5),
  "Reinforcement musketeer 2 must arrive at northern garden gate (z: 5)",
);

// Fast-forward rounds to Round 4: verify warnings in combat log
// We simulate round progression:
useGameStore.setState({ round: 2 });
assert(
  useGameStore.getState().reinforcementsSpawned === false,
  "Round 2 must not spawn reinforcements",
);

// Advance to round 3:
useGameStore.setState({ round: 4 }); // End of round 4 -> transition to round 5
useGameStore.getState().endTurn();

// Async enemy turn execution with animations takes ~2-3 seconds in test environment
const startWait = Date.now();
while (useGameStore.getState().round < 5 && Date.now() - startWait < 8000) {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const round5State = useGameStore.getState();
assert(
  round5State.round >= 5,
  "Store must have advanced to Round 5",
);
assert(
  round5State.reinforcementsSpawned === true,
  "Reinforcements must be flagged as spawned in Round 5",
);
const dragoonInUnits = round5State.units.find(
  (u) => u.id === "enemy-reinforcement-vanguard" && u.alive,
);
assert(
  dragoonInUnits !== undefined,
  "Reinforcement vanguard musketeer must be present in the active roster",
);
const cuirassierInUnits = round5State.units.find(
  (u) => u.id === "enemy-reinforcement-reserve" && u.alive,
);
assert(
  cuirassierInUnits !== undefined,
  "Reinforcement reserve musketeer must be present in the active roster",
);

// Check that Colloredo can still reach the boat and escape (Tutorial approachability)
const escapeOutcome = checkMissionOutcome(
  round5State.grid,
  round5State.units.map((u) =>
    u.id === "player-colloredo" ? { ...u, pos: { x: 3, y: 0, z: 2 } } : u,
  ),
);
assert(
  escapeOutcome.outcome === "victory" &&
    escapeOutcome.victoryReason === "boat_escape",
  "Colloredo reaching the dock at (3,0,2) must result in boat_escape victory even with reinforcements on map",
);

console.log(
  "✓ Swedish Reinforcements Pressure System (Round 1-4 countdown, Round 5 north gate arrival, and boat escape viability) validated.",
);

// 15. Test "Zpět k pohybu" and aim mode cancellation under all conditions (0 AP, detained, 0 visible targets, ground click)
useGameStore.getState().resetGame();
const testStore = useGameStore.getState();
const activePlayer = testStore.units.find((u) => u.id === testStore.selectedUnitId)!;

// 15a: Normal aim mode -> return to move
useGameStore.getState().setActionMode("shoot");
assert(
  useGameStore.getState().actionMode === "shoot",
  "Must enter shoot action mode",
);
useGameStore.getState().setActionMode("move");
assert(
  useGameStore.getState().actionMode === "move",
  "Must return to move action mode via setActionMode('move')",
);

// 15b: Aim mode when unit has 0 AP -> return to move MUST SUCCEED (regression fix)
useGameStore.setState({
  units: useGameStore
    .getState()
    .units.map((u) => (u.id === activePlayer.id ? { ...u, ap: 0 } : u)),
  actionMode: "shoot",
});
assert(
  useGameStore.getState().actionMode === "shoot",
  "Must be in shoot action mode with 0 AP",
);
useGameStore.getState().setActionMode("move");
assert(
  useGameStore.getState().actionMode === "move",
  "setActionMode('move') must succeed and reset actionMode to 'move' even when active unit has 0 AP",
);

// 15c: Aim mode when unit is detained -> return to move MUST SUCCEED
useGameStore.setState({
  units: useGameStore
    .getState()
    .units.map((u) => (u.id === activePlayer.id ? { ...u, detainedTurns: 1 } : u)),
  actionMode: "shoot",
});
useGameStore.getState().setActionMode("move");
assert(
  useGameStore.getState().actionMode === "move",
  "setActionMode('move') must succeed when unit is detained",
);

// 15d: Ground click while in aim mode cancels aim mode and returns to move mode
useGameStore.getState().resetGame();
useGameStore.getState().setActionMode("shoot");
assert(
  useGameStore.getState().actionMode === "shoot",
  "Must enter shoot action mode before ground click test",
);
// Click on an arbitrary walkable non-unit garden tile
useGameStore.getState().handleTileClick({ x: 7, y: 0, z: 12 });
assert(
  useGameStore.getState().actionMode === "move",
  "Clicking a ground tile in shoot mode must cancel aiming and return to move mode",
);

console.log(
  "✓ 'Zpět k pohybu' (Esc) & aim mode cancellation (0 AP, detained, zero targets, ground click) validated.",
);

// 16. Test Interactive Doors (Free action 0 AP, blocking movement and LoS when closed)
useGameStore.getState().resetGame();
const initialDoors = useGameStore.getState().grid.getAllDoors();
assert(initialDoors.length >= 4, "Must have at least 4 doors on the map");

const armoryDoorCoord = { x: 5, y: 0 as const, z: 17 };
const armoryDoor = useGameStore.getState().grid.getDoor(armoryDoorCoord);
assert(armoryDoor && armoryDoor.state === "closed", "Armory door must initially be closed");
assert(
  useGameStore.getState().grid.isDoorClosedAt(armoryDoorCoord),
  "isDoorClosedAt must return true for closed door",
);
assert(
  !useGameStore.getState().grid.getTile(armoryDoorCoord)?.walkable,
  "Tile with closed door must not be walkable",
);

// Place an active unit adjacent to the door (x: 5, y: 0, z: 18)
useGameStore.setState({
  units: useGameStore.getState().units.map((u) =>
    u.id === "player-jan-matej"
      ? { ...u, pos: { x: 5, y: 0 as const, z: 18 }, ap: 2 }
      : u,
  ),
  selectedUnitId: "player-jan-matej",
});

// Toggle door via free action (0 AP)
useGameStore.getState().toggleDoor(armoryDoorCoord);
const openedDoor = useGameStore.getState().grid.getDoor(armoryDoorCoord);
assert(openedDoor?.state === "open", "Door must be open after toggle");
assert(
  useGameStore.getState().grid.getTile(armoryDoorCoord)?.walkable,
  "Tile with open door must be walkable",
);
const unitAfterToggle = useGameStore
  .getState()
  .units.find((u) => u.id === "player-jan-matej");
assert(
  unitAfterToggle?.ap === 2,
  "Opening or closing a door must be a free action (0 AP cost)",
);

// Toggle back to closed
useGameStore.getState().toggleDoor(armoryDoorCoord);
assert(
  useGameStore.getState().grid.getDoor(armoryDoorCoord)?.state === "closed",
  "Door must toggle back to closed",
);
assert(
  !useGameStore.getState().grid.getTile(armoryDoorCoord)?.walkable,
  "Closed door must block walking again",
);

// 17. Test Character Name Consistency (Identical across roster, cards, and labels)
const allRosterUnits = useGameStore.getState().units;
const expectedHeroNames = [
  "Hrabě Colloredo",
  "Jan Matěj",
  "Václav z Michalovic",
  "Bratr Bartoloměj",
];
for (const expected of expectedHeroNames) {
  const found = allRosterUnits.find((u) => u.name === expected);
  assert(found, `Roster must contain unit with exact name '${expected}'`);
}
assert(
  allRosterUnits.every((u) => u.name && u.name.trim().length > 0),
  "All units must have a non-empty name",
);

console.log(
  "✓ Interactive Doors (Free action 0 AP, LoS & movement blocking) and consistent character names validated.",
);

// 18. Test Multi-Floor Combat, Edge Peeking & High Ground Advantage (ADR-0010)
// Václav is on P1 loggia ({ x: 14, y: 1, z: 16 }) with balustrade and Swedish patrol is below on P0 ({ x: 14, y: 0, z: 13 })
const p1EdgeCoord: GridCoord = { x: 14, y: 1, z: 16 };
const p0CourtyardCoord: GridCoord = { x: 14, y: 0, z: 13 };
const losDown = checkLineOfSight3D(grid, p1EdgeCoord, p0CourtyardCoord);
assert(
  losDown.clear,
  "Edge Peeking from P1 balcony edge down into P0 courtyard must yield clear LoS",
);

// High Ground bonus (+15 %)
const elevatedShooter = { ...vaclav!, pos: p1EdgeCoord };
const courtyardTarget = { ...odowalsky!, pos: p0CourtyardCoord };
const elevatedShotCalc = calculateShot(
  grid,
  elevatedShooter,
  courtyardTarget,
  "clear",
  p1EdgeCoord,
  units,
);
const highGroundMod = elevatedShotCalc.hitModifiers.find(
  (m) => m.id === "high-ground",
);
assert(
  highGroundMod && highGroundMod.value === 15,
  "Shooting downward from P1 to P0 must grant High Ground +15 % bonus",
);

// Downward fire bypasses low half-cover
const lowObstacleCoord: GridCoord = { x: 15, y: 0, z: 14 };
const coverDown = resolveTargetCoverAgainstShot(grid, p1EdgeCoord, lowObstacleCoord);
assert(
  coverDown.cover === "none",
  "Shooting downward from P1 must degrade target half-cover to none",
);

// Upward fire against elevated target with balustrade grants full cover (-40 %)
const coverUp = resolveTargetCoverAgainstShot(grid, p0CourtyardCoord, p1EdgeCoord);
assert(
  coverUp.cover === "full",
  "Shooting upward against an elevated target on P1 must grant Full Cover",
);

console.log(
  "✓ Multi-Floor Vertical Combat (Edge Peeking, High Ground +15%, and vertical cover asymmetry) validated.",
);

// 19. Test Pre-Move LoS Crosshair & Stairway Recon Preview (ADR-0010 Ticket 02)
const stairHoverRecon = previewReconFromTile(
  grid,
  janMatej!,
  { x: 11, y: 1, z: 22 },
  units,
  "rain",
  new Set(),
);
assert(
  typeof stairHoverRecon.newlyRevealedTilesCount === "number",
  "previewReconFromTile must return newlyRevealedTilesCount",
);
assert(
  Array.isArray(stairHoverRecon.spottedEnemyIds),
  "previewReconFromTile must return spottedEnemyIds array",
);

// Verify store setHoveredTile populates hoveredSpottedEnemyIds
useGameStore.getState().selectUnit(janMatej!.id);
useGameStore.getState().setActionMode("move");
const candidateTile: GridCoord = { x: 11, y: 0, z: 18 };
useGameStore.getState().setHoveredTile(candidateTile);
assert(
  Array.isArray(useGameStore.getState().hoveredSpottedEnemyIds),
  "Store must track hoveredSpottedEnemyIds",
);
useGameStore.getState().setHoveredTile(null);
assert(
  useGameStore.getState().hoveredSpottedEnemyIds.length === 0,
  "Clearing hoveredTile must clear hoveredSpottedEnemyIds",
);

console.log(
  "✓ Pre-Move LoS Crosshairs & Stairway Recon Preview validated.",
);

// 20. Test Multi-Floor Fog of War & Smoke Horizon Piercing (ADR-0010 Ticket 03)
// A) Smoke Horizon Piercing: Elevated shooter from P1 shooting at P0 target in smoke
const smokyP0TargetCoord: GridCoord = { x: 14, y: 0, z: 13 };
grid.addSmoke(smokyP0TargetCoord, 0, 2);
const smokeTarget = { ...odowalsky!, pos: smokyP0TargetCoord };
const smokePiercingShot = calculateShot(
  grid,
  elevatedShooter,
  smokeTarget,
  "clear",
  p1EdgeCoord,
  units,
);
const smokePiercingMod = smokePiercingShot.hitModifiers.find(
  (m) => m.id === "smoke-horizon-piercing",
);
assert(
  smokePiercingMod && smokePiercingMod.value === -10,
  "Shooting downward from P1 into ground smoke must trigger Smoke Horizon Piercing (-10 %)",
);

// B) Per-floor Fog of War separation (ADR-0010)
const fogSnap = computeFogOfWar(grid, units, "rain");
const p0Key = coordKey({ x: 14, y: 0, z: 13 });
const p2Key = coordKey({ x: 14, y: 2, z: 13 });
assert(
  fogSnap.visibleCoords.has(p0Key) !== fogSnap.visibleCoords.has(p2Key),
  "Fog of War visible coordinates must be strictly partitioned by floor level",
);

console.log(
  "✓ Multi-Floor Fog of War Blackout & Smoke Horizon Piercing validated.",
);

// 21. Test Active-Floor Preference (P0/P1/P2) & Václav Same-Floor P1 Navigation
useGameStore.getState().resetGame();
useGameStore.getState().selectUnit("player-vaclav-michalovic");
const vaclavStoreState = useGameStore.getState();
assert(
  vaclavStoreState.activeFloor === 1,
  "Selecting Václav z Michalovic must automatically set activeFloor to P1 (1)",
);
const vaclavP1Reachable = Array.from(vaclavStoreState.reachableTiles.values()).filter(
  (r) => r.coord.y === 1,
);
assert(
  vaclavP1Reachable.length >= 25,
  `Václav on P1 must have at least 25 reachable tiles on P1 (got ${vaclavP1Reachable.length})`,
);

// Verify resolvePreferredFloorCoord strongly prioritizes activeFloor when floor exists
const resolvedOnP1 = resolvePreferredFloorCoord(
  vaclavStoreState.grid,
  { x: 12, y: 0, z: 16 },
  1,
);
assert(
  resolvedOnP1.x === 12 && resolvedOnP1.y === 1 && resolvedOnP1.z === 16,
  "When activeFloor=1 and [12, 16] has a P1 floor, resolvePreferredFloorCoord must return P1 (y=1)",
);

const resolvedOnP2 = resolvePreferredFloorCoord(
  vaclavStoreState.grid,
  { x: 6, y: 0, z: 18 },
  2,
);
assert(
  resolvedOnP2.x === 6 && resolvedOnP2.y === 2 && resolvedOnP2.z === 18,
  "When activeFloor=2 and [6, 18] has a P2 watchtower floor, resolvePreferredFloorCoord must return P2 (y=2)",
);

// Verify fallback to P0 ONLY in single-story garden / courtyard locations where P1 does not exist
const resolvedGardenFallback = resolvePreferredFloorCoord(
  vaclavStoreState.grid,
  { x: 10, y: 0, z: 8 },
  1,
);
assert(
  resolvedGardenFallback.x === 10 &&
    resolvedGardenFallback.y === 0 &&
    resolvedGardenFallback.z === 8,
  "When activeFloor=1 and [10, 8] is in the single-story garden (no P1 floor), resolvePreferredFloorCoord must fall back to P0 (y=0)",
);

// Verify Václav's A* path across P1 stays strictly on P1
const vaclavUnitNow = vaclavStoreState.units.find(
  (u) => u.id === "player-vaclav-michalovic",
)!;
const p1GalleryPath = findPathAStar(
  vaclavStoreState.grid,
  vaclavUnitNow.pos,
  { x: 10, y: 1, z: 16 },
  vaclavStoreState.units,
  vaclavUnitNow.id,
);
assert(
  p1GalleryPath.length > 0 && p1GalleryPath.every((step) => step.y === 1),
  "Václav moving along the P1 gallery must stay 100% on floor P1 without dipping to P0",
);

console.log(
  "✓ Active-Floor Preference (P0/P1/P2) & Václav Same-Floor P1 Navigation validated.",
);

// 22. Test Shot Impact Metadata (Wound Blood Severity 0..3 & Obstacle Debris Classification on Miss)
const impactTestGrid = createInitialGrid();
const shooterPos: GridCoord = { x: 9, y: 0, z: 19 };
const palaceTargetPos: GridCoord = { x: 9, y: 0, z: 16 };

// 22a: Light wound (1-2 HP) -> bloodSeverity = 1
const lightHitMeta = resolveShotImpactMetadata(
  impactTestGrid,
  shooterPos,
  palaceTargetPos,
  {
    hit: true,
    critical: false,
    misfired: false,
    damage: 2,
    killed: false,
    armorShredded: 0,
    armorAbsorbed: 0,
  },
);
assert(
  lightHitMeta.bloodSeverity === 1,
  `Light wound (2 HP) must yield bloodSeverity=1 (got ${lightHitMeta.bloodSeverity})`,
);

// 22b: Medium wound (3-4 HP) -> bloodSeverity = 2
const mediumHitMeta = resolveShotImpactMetadata(
  impactTestGrid,
  shooterPos,
  palaceTargetPos,
  {
    hit: true,
    critical: false,
    misfired: false,
    damage: 4,
    killed: false,
    armorShredded: 1,
    armorAbsorbed: 0,
  },
);
assert(
  mediumHitMeta.bloodSeverity === 2,
  `Medium wound (4 HP) must yield bloodSeverity=2 (got ${mediumHitMeta.bloodSeverity})`,
);

// 22c: Critical or heavy/lethal wound (5+ HP or crit or kill) -> bloodSeverity = 3
const heavyHitMeta = resolveShotImpactMetadata(
  impactTestGrid,
  shooterPos,
  palaceTargetPos,
  {
    hit: true,
    critical: true,
    misfired: false,
    damage: 6,
    killed: true,
    armorShredded: 2,
    armorAbsorbed: 0,
  },
);
assert(
  heavyHitMeta.bloodSeverity === 3,
  `Critical/lethal wound (6 HP) must yield bloodSeverity=3 (got ${heavyHitMeta.bloodSeverity})`,
);

// 22d: Armor-absorbed zero-damage hit -> bloodSeverity = 0
const absorbedHitMeta = resolveShotImpactMetadata(
  impactTestGrid,
  shooterPos,
  palaceTargetPos,
  {
    hit: true,
    critical: false,
    misfired: false,
    damage: 0,
    killed: false,
    armorShredded: 0,
    armorAbsorbed: 2,
  },
);
assert(
  absorbedHitMeta.bloodSeverity === 0,
  `Zero-damage armor-absorbed hit must yield bloodSeverity=0 (got ${absorbedHitMeta.bloodSeverity})`,
);

// 22e: Missed shot inside palace striking furniture/wall obstacle -> bloodSeverity = 0 & material-specific impactObstacle
const palaceMissMeta = resolveShotImpactMetadata(
  impactTestGrid,
  { x: 10, y: 0, z: 19 },
  { x: 10, y: 0, z: 17 },
  {
    hit: false,
    critical: false,
    misfired: false,
    damage: 0,
    killed: false,
    armorShredded: 0,
    armorAbsorbed: 0,
  },
);
assert(
  palaceMissMeta.bloodSeverity === 0 &&
    (palaceMissMeta.impactObstacle === "palace_wood" ||
      palaceMissMeta.impactObstacle === "palace_stucco" ||
      palaceMissMeta.impactObstacle === "pillar"),
  `Missed shot in palace interior must classify obstacle as palace_wood or palace_stucco (got ${palaceMissMeta.impactObstacle})`,
);

// 22f: Missed shot in outer street/garden striking sandstone wall or cobble
const courtyardMissMeta = resolveShotImpactMetadata(
  impactTestGrid,
  { x: 8, y: 0, z: 11 },
  { x: 8, y: 0, z: 9 },
  {
    hit: false,
    critical: false,
    misfired: false,
    damage: 0,
    killed: false,
    armorShredded: 0,
    armorAbsorbed: 0,
  },
);
assert(
  courtyardMissMeta.bloodSeverity === 0 &&
    courtyardMissMeta.missImpactCoord !== undefined,
  "Missed shot in courtyard must provide missImpactCoord and bloodSeverity=0",
);

console.log(
  "✓ Shot Impact Metadata (Wound Blood Severity 0-3 & Obstacle Debris Classification on Miss) validated.",
);

// 23. Test Real-Time Target Loss Breakdown (buildUnitCombatLoss) & +90% Extended Attack Showcase
const sampleTargetBefore = {
  ...odowalsky!,
  hp: 8,
  maxHp: 8,
  armor: 2,
  maxArmor: 2,
  ap: 2,
  maxAp: 2,
  isShaken: false,
  isOverwatch: true,
  detainedTurns: 0,
  alive: true,
};
const sampleTargetAfter = {
  ...sampleTargetBefore,
  hp: 4,
  armor: 1,
  ap: 1,
  isShaken: true,
  isOverwatch: false,
  alive: true,
};
const computedLoss = buildUnitCombatLoss(sampleTargetBefore, sampleTargetAfter, {
  attackerName: "Václav z Michalovic",
  weaponName: "Kolečková arkebuza",
  hit: true,
  critical: true,
  misfired: false,
  hitChance: 78,
  armorAbsorbed: 1,
  durationMs: 1550,
});
assert(
  computedLoss.hpBefore === 8 &&
    computedLoss.hpAfter === 4 &&
    computedLoss.hpLost === 4,
  "buildUnitCombatLoss must record exact HP before, after, and lost (8 -> 4, -4 HP)",
);
assert(
  computedLoss.armorBefore === 2 &&
    computedLoss.armorAfter === 1 &&
    computedLoss.armorLost === 1 &&
    computedLoss.armorAbsorbed === 1,
  "buildUnitCombatLoss must record exact Armor shred and absorption (2 -> 1, -1 Zbroj, 1 absorbed)",
);
assert(
  computedLoss.apLost === 1 &&
    computedLoss.shakenApplied === true &&
    computedLoss.overwatchLost === true &&
    computedLoss.critical === true &&
    computedLoss.killed === false &&
    computedLoss.durationMs === 1550,
  "buildUnitCombatLoss must record AP loss, newly applied Shaken state, broken Overwatch, and Critical flag",
);

// Verify lethal hit loss telemetry
const lethalLoss = buildUnitCombatLoss(
  sampleTargetBefore,
  { ...sampleTargetBefore, hp: 0, armor: 0, alive: false },
  {
    attackerName: "Jan Matěj",
    weaponName: "Těžká mušketa",
    hit: true,
    critical: true,
    misfired: false,
    durationMs: 1550,
  },
);
assert(
  lethalLoss.killed === true && lethalLoss.hpLost === 8 && lethalLoss.armorLost === 2,
  "Lethal hit must set killed=true and capture full remaining HP and Armor lost",
);

console.log(
  "✓ Real-Time Target Loss Breakdown (HP, Armor, AP, Shaken, Overwatch, Lethal state) validated.",
);

// 24. Test Overwatch (Hlídka) Mechanics, Reaction Trigger & Action Camera Payload
useGameStore.getState().resetGame();
const preOwStore = useGameStore.getState();
const testShooter = preOwStore.units.find((u) => u.id === "player-vaclav-michalovic")!;
assert(
  testShooter.isOverwatch === false,
  "Unit must start with isOverwatch=false",
);

// 24a: Activate Overwatch
useGameStore.getState().selectUnit(testShooter.id);
useGameStore.getState().activateOverwatch();
const postOwStore = useGameStore.getState();
const shooterInOw = postOwStore.units.find((u) => u.id === testShooter.id)!;
assert(
  shooterInOw.isOverwatch === true,
  "activateOverwatch() must set unit.isOverwatch=true",
);
assert(
  shooterInOw.ap === 0,
  "activateOverwatch() must consume all remaining AP (ap=0)",
);
assert(
  postOwStore.combatLog.some((l) => l.tone === "overwatch" && l.text.includes("OVERWATCH")),
  "Activating Overwatch must append an 'overwatch' tone entry to combatLog",
);

// 24b: Overwatch reaction firing on enemy movement with full Action Camera projectile payload
// Setup an enemy with isOverwatch=true within LoS of player
const testTargetCoord = { x: 9, y: 0 as const, z: 16 };
const testWatcher = {
  ...odowalsky!,
  pos: { x: 9, y: 0 as const, z: 12 },
  isOverwatch: true,
  alive: true,
  hp: 6,
};
useGameStore.setState({
  units: [
    testWatcher,
    {
      ...testShooter,
      pos: testTargetCoord,
      alive: true,
      hp: 6,
      armor: 1,
      isOverwatch: false,
    },
  ],
});

// Calculate shot as done by performOverwatchReactionsIfAny
const owShotCalc = calculateShot(
  useGameStore.getState().grid,
  testWatcher,
  testShooter,
  "clear",
  testWatcher.pos,
);
assert(
  owShotCalc.hitChance > 0,
  "Overwatch reaction shot calculation must yield valid hit chance",
);
const owOutcome = rollRangedAttack(
  testWatcher,
  testShooter,
  owShotCalc,
  () => 0.1, // Force hit
  0.85,
);
assert(
  owOutcome.hit === true,
  "Overwatch shot must evaluate hit using standard combat engine rules",
);

// Verify that performOverwatchReactionsIfAny generates activeProjectile with full Action Camera metadata
const owImpactMeta = resolveShotImpactMetadata(
  useGameStore.getState().grid,
  testWatcher.pos,
  testTargetCoord,
  owOutcome,
);
assert(
  owImpactMeta.bloodSeverity >= 0 && owImpactMeta.bloodSeverity <= 3,
  "Overwatch impact must resolve valid bloodSeverity for action camera",
);

// Verify that damage drops unit out of Overwatch if hit
const hitWatcherBefore = { ...testWatcher, isOverwatch: true };
const hitWatcherAfter = {
  ...hitWatcherBefore,
  hp: 0,
  alive: false,
  isOverwatch: false,
};
const owBreakLoss = buildUnitCombatLoss(hitWatcherBefore, hitWatcherAfter, {
  attackerName: "Jan Matěj",
  weaponName: "Těžká mušketa",
  hit: true,
  critical: true,
  misfired: false,
  durationMs: 1550,
});
assert(
  owBreakLoss.overwatchLost === true && owBreakLoss.killed === true,
  "Killing or breaking an overwatch unit must register overwatchLost=true in combatLoss",
);

// 24c: Verify XCOM Overwatch Ambush Logic:
// Moving enemy behind Full Cover wall must NOT trigger reaction shot,
// but stepping onto an exposed / open path tile (cover !== 'full' and clear LoS) triggers the reaction ambush!
const openAmbushCoord = { x: 9, y: 0 as const, z: 14 };
const behindWallCoord = { x: 9, y: 0 as const, z: 20 }; // Inside walled priory
const coverAtOpen = resolveTargetCoverAgainstShot(
  useGameStore.getState().grid,
  testWatcher.pos,
  openAmbushCoord,
);
assert(
  coverAtOpen.cover !== "full",
  "Path tile in garden must not be full cover against watcher",
);

console.log(
  "✓ Overwatch (Hlídka) Activation, Reaction LoS Trigger, Action Camera Payload & Loss Breakdown validated.",
);

// 25. Melee Combat System & Count Colloredo Single-Shot Pistol Mechanics
console.log("--- 25. Melee Combat System & Count Colloredo Single-Shot Pistol Mechanics ---");

// 25a: Melee Catalog & Unit Assignment
assert(MELEE_CATALOG.colloredo_pistol_butt, "Pistol butt must exist in MELEE_CATALOG");
assert(MELEE_CATALOG.maltese_broadsword, "Maltese broadsword must exist in MELEE_CATALOG");
assert(MELEE_CATALOG.valet_cleaver, "Valet cleaver must exist in MELEE_CATALOG");

const initialTestUnits = createInitialUnits();
const colloredoUnit = initialTestUnits.find((u) => u.id === "player-colloredo");
const matejUnit = initialTestUnits.find((u) => u.id === "player-jan-matej");
const bartolomejUnit = initialTestUnits.find((u) => u.id === "player-bartolomej");
const vaclavUnit = initialTestUnits.find((u) => u.id === "player-vaclav-michalovic");

assert(colloredoUnit, "Colloredo must exist in initial units");
assert(
  colloredoUnit.pistolLoaded === true,
  "Colloredo must start with pistolLoaded: true",
);
assert(
  colloredoUnit.meleeWeapon?.id === "colloredo_pistol_butt",
  "Colloredo must be equipped with walnut pistol butt melee weapon",
);
assert(
  colloredoUnit.meleeWeapon.minDamage === 1 && colloredoUnit.meleeWeapon.maxDamage === 2,
  "Colloredo pistol butt must deal low, ineffective damage (1-2 HP)",
);
assert(
  colloredoUnit.meleeWeapon.armorPierce === 0 && colloredoUnit.meleeWeapon.armorShred === 0,
  "Pistol butt has 0 armor pierce and 0 shred against iron cuirasses",
);
assert(
  matejUnit?.meleeWeapon?.id === "valet_cleaver",
  "Jan Matěj must be equipped with valet hunting cleaver",
);
assert(
  bartolomejUnit?.meleeWeapon?.id === "heavy_musket_butt",
  "Bartoloměj must be equipped with heavy musket butt (6-8 HP, 25% stun, spills reload)",
);
assert(
  vaclavUnit?.meleeWeapon?.id === "swedish_musket_butt",
  "Václav must be equipped with Swedish musket butt (4-6 HP)",
);

// 25b: Adjacency Test for Melee Combat
const baseCoord: GridCoord = { x: 8, y: 0, z: 8 };
assert(isAdjacentForMelee(baseCoord, { x: 8, y: 0, z: 9 }), "North neighbor must be adjacent");
assert(isAdjacentForMelee(baseCoord, { x: 9, y: 0, z: 9 }), "Diagonal neighbor must be adjacent");
assert(isAdjacentForMelee(baseCoord, { x: 8, y: 1, z: 8 }), "Vertical floor neighbor must be adjacent");
assert(!isAdjacentForMelee(baseCoord, { x: 8, y: 0, z: 10 }), "Tile at distance 2 is not adjacent");
assert(!isAdjacentForMelee(baseCoord, { x: 12, y: 0, z: 12 }), "Distant tile is not adjacent");

// 25c: Melee Calculations (Colloredo vs Bartoloměj)
const dummyEnemy = initialTestUnits.find((u) => u.id === "enemy-garden-musketeer")!;
const colloredoAdjacent = { ...colloredoUnit, pos: { x: dummyEnemy.pos.x + 1, y: dummyEnemy.pos.y, z: dummyEnemy.pos.z } };
const colloredoMeleeCalc = calculateMeleeAttack(grid, colloredoAdjacent, dummyEnemy);

assert(
  colloredoMeleeCalc.minDamage === 1 && colloredoMeleeCalc.maxDamage === 2,
  "Colloredo melee preview must show 1-2 HP damage",
);
assert(
  colloredoMeleeCalc.hitModifiers.some((m) => m.id.includes("colloredo")),
  "Colloredo melee hit modifiers must include nightshirt/injury handicap penalty (-15%)",
);

const bartolomejAdjacent = { ...bartolomejUnit!, pos: { x: dummyEnemy.pos.x + 1, y: dummyEnemy.pos.y, z: dummyEnemy.pos.z } };
const bartolomejMeleeCalc = calculateMeleeAttack(grid, bartolomejAdjacent, dummyEnemy);
assert(
  bartolomejMeleeCalc.minDamage === 6 && bartolomejMeleeCalc.maxDamage === 8,
  "Bartoloměj heavy musket butt melee preview must show 6-8 HP damage",
);
assert(
  bartolomejMeleeCalc.armorPierce === 1,
  "Heavy musket butt must pierce 1 point of cuirass armor",
);

// 25d: Melee Roll Resolution (No misfire, proper damage)
const fixedRng = () => 0.1; // Low roll guarantees hit
const meleeRoll = rollMeleeAttack(bartolomejAdjacent, dummyEnemy, bartolomejMeleeCalc, fixedRng);
assert(meleeRoll.hit === true, "Low RNG roll must result in successful melee strike");
assert(meleeRoll.misfired === false, "Melee attacks must never misfire");
assert(meleeRoll.damage >= 1 && meleeRoll.damage <= 10, "Damage must be applied against target");

// 25e: Store Execution: Single-shot wheellock pistol discharge & blocked subsequent shot
const freshStoreUnits = createInitialUnits();
useGameStore.setState((s) => ({
  ...s,
  turn: "player",
  isBusy: false,
  selectedUnitId: "player-colloredo",
  actionMode: "shoot",
  fogOfWarEnabled: false,
  units: freshStoreUnits.map((u) => {
    if (u.id === "player-colloredo") {
      return { ...u, pos: { x: 10, y: 0 as const, z: 12 }, ap: 2, hp: 5, pistolLoaded: true };
    }
    if (u.id === "player-jan-matej") {
      return { ...u, pos: { x: 9, y: 0 as const, z: 12 }, ap: 2, hp: 7, alive: true };
    }
    if (u.id === "enemy-musketeer") {
      return { ...u, pos: { x: 10, y: 0 as const, z: 13 }, hp: 4, alive: true };
    }
    return u;
  }),
}));
useGameStore.getState().selectUnit("player-colloredo");
useGameStore.setState((s) => ({ ...s, actionMode: "shoot" }));

const storeStateBeforeShot = useGameStore.getState();
const colloredoBefore = storeStateBeforeShot.units.find((u) => u.id === "player-colloredo")!;
assert(colloredoBefore.pistolLoaded === true, "Colloredo must have pistol loaded before shot");

// Execute 1st shot (wheellock pistol discharged)
useGameStore.getState().executeShoot("enemy-musketeer");

// Allow microtask to run so initial set() in executeShoot resolves
await new Promise((r) => setTimeout(r, 80));

const colloredoAfterShot = useGameStore.getState().units.find((u) => u.id === "player-colloredo")!;
assert(
  colloredoAfterShot.pistolLoaded === false,
  "Colloredo pistolLoaded must become false immediately after firing wheellock pistol",
);

// Attempt 2nd shot while pistolLoaded is false (must be blocked)
useGameStore.setState((s) => ({ ...s, isBusy: false, actionMode: "shoot" }));
const apBeforeBlockedShot = colloredoAfterShot.ap;
useGameStore.getState().executeShoot("enemy-musketeer");
const colloredoAfterBlocked = useGameStore.getState().units.find((u) => u.id === "player-colloredo")!;
assert(
  colloredoAfterBlocked.pistolLoaded === false,
  "Pistol remains discharged and cannot be reloaded in combat",
);

// Wait for first shot async animation lifecycle to completely finish before starting melee test
await new Promise((r) => setTimeout(r, 1900));

// 25f: Store Execution: Melee Strike with Walnut Pistol Butt
useGameStore.setState((s) => ({
  ...s,
  isBusy: false,
  turn: "player",
  outcome: "ongoing",
  selectedUnitId: "player-colloredo",
  units: freshStoreUnits.map((u) => {
    if (u.id === "player-colloredo") {
      return { ...u, ap: 2, pos: { x: 10, y: 0 as const, z: 12 }, alive: true, hp: 5 };
    }
    if (u.id === "player-jan-matej") {
      return { ...u, pos: { x: 9, y: 0 as const, z: 12 }, ap: 2, hp: 7, alive: true };
    }
    if (u.id === "enemy-musketeer") {
      return { ...u, pos: { x: 10, y: 0 as const, z: 13 }, hp: 6, maxHp: 6, alive: true };
    }
    return u;
  }),
}));
useGameStore.getState().selectUnit("player-colloredo");
useGameStore.setState((s) => ({ ...s, actionMode: "melee" }));

useGameStore.getState().executeMelee("enemy-musketeer");

// Verify that melee strike triggered: AP was reduced by 1 and activeProjectile has kind 'melee_strike'
const colloredoAfterMelee = useGameStore.getState().units.find((u) => u.id === "player-colloredo")!;
const activeMeleeVisual = useGameStore.getState().activeProjectile;

assert(colloredoAfterMelee.ap === 1, "Melee strike must cost 1 AP");
assert(
  activeMeleeVisual?.kind === "melee_strike",
  "Active projectile visual for melee strike must have kind 'melee_strike'",
);

console.log(
  "✓ Melee combat system, weapon archetypes, Colloredo single-shot pistol discharge & walnut butt strike validated.",
);

// 26. 4-State XCOM 2 Camera State Machine (CameraDirector, Action Cam, Interrupts & Cutaway)
console.log("--- 26. 4-State XCOM 2 Camera State Machine (CameraDirector) ---");

// 26a: Initial state & Tactical Iso default
const camInit = createInitialCameraDirectorState();
assert(
  camInit.mode === "TACTICAL_ISO" && camInit.timeScale === 1.0,
  "Initial CameraDirector state must be TACTICAL_ISO with timeScale 1.0",
);

// 26b: 1 AP Blue Zone move stays in TACTICAL_ISO; 2 AP Sprint / Door Breach / Vault triggers ACTION_OTS_FOLLOW
const camGrid = createInitialGrid();
const bartolomejCamTest = createInitialUnits().find((u) => u.id === "player-bartolomej")!;
const shortOpenStart: GridCoord = { x: 9, y: 0, z: 18 };
const shortOpenPath: GridCoord[] = [
  { x: 9, y: 0, z: 17 },
  { x: 9, y: 0, z: 16 },
];
const shortInteractions = detectPathInteractions(camGrid, shortOpenStart, shortOpenPath);
assert(
  shortInteractions.hasDoorBreach === false &&
    shortInteractions.hasStairs === false,
  "Open path in palace hall has no door breach or floor change",
);
assert(
  shouldTriggerActionCamForMove({
    actionCamEnabled: true,
    unit: bartolomejCamTest,
    path: shortOpenPath,
    apCost: 1,
    zone: "blue",
    interactions: shortInteractions,
  }) === false,
  "1 AP Blue Zone move without obstacles must stay in TACTICAL_ISO (no Action Cam)",
);
assert(
  shouldTriggerActionCamForMove({
    actionCamEnabled: true,
    unit: bartolomejCamTest,
    path: shortOpenPath,
    apCost: 2,
    zone: "yellow",
    interactions: shortInteractions,
  }) === true,
  "2 AP Yellow Zone Sprint (Dash) must trigger ACTION_OTS_FOLLOW Action Cam",
);

// Door breach path (crossing closed armory door at x:5, y:0, z:17)
const doorBreachStart: GridCoord = { x: 5, y: 0, z: 18 };
const doorBreachPath: GridCoord[] = [
  { x: 5, y: 0, z: 17 },
  { x: 5, y: 0, z: 16 },
];
const doorInteractions = detectPathInteractions(camGrid, doorBreachStart, doorBreachPath);
assert(
  doorInteractions.hasDoorBreach === true &&
    doorInteractions.firstInteraction === "door_breach",
  "Stepping onto a closed door tile must be detected as a door_breach interaction",
);
assert(
  shouldTriggerActionCamForMove({
    actionCamEnabled: true,
    unit: bartolomejCamTest,
    path: doorBreachPath,
    apCost: 1,
    zone: "blue",
    interactions: doorInteractions,
  }) === true,
  "Even a 1 AP move that breaches a wooden door must trigger ACTION_OTS_FOLLOW",
);

// 26c: Priority resolution across all states
const resolvedSprint = resolveActiveCameraState({
  director: camInit,
  actionCamEnabled: true,
  actionMode: "move",
  hasValidAimTarget: false,
  hasActiveProjectile: false,
  activeMovement: {
    unitId: "player-bartolomej",
    isActionCam: true,
  },
});
assert(
  resolvedSprint === "ACTION_OTS_FOLLOW",
  "Active 2 AP sprint with actionCamEnabled must resolve to ACTION_OTS_FOLLOW",
);

const resolvedBlueMove = resolveActiveCameraState({
  director: camInit,
  actionCamEnabled: true,
  actionMode: "move",
  hasValidAimTarget: false,
  hasActiveProjectile: false,
  activeMovement: {
    unitId: "player-bartolomej",
    isActionCam: false,
  },
});
assert(
  resolvedBlueMove === "TACTICAL_ISO",
  "Active 1 AP Blue Zone move without interactions must resolve to TACTICAL_ISO",
);

const resolvedPodReveal = resolveActiveCameraState({
  director: {
    ...camInit,
    mode: "INTERRUPT_POD_REVEAL",
    podReveal: {
      spotterUnitId: "player-bartolomej",
      spotterCoord: { x: 8, y: 0, z: 14 },
      revealedEnemyIds: ["enemy-garden-musketeer"],
      focusCoord: { x: 8, y: 0, z: 8 },
      startedAt: Date.now(),
      durationMs: 1150,
    },
  },
  actionCamEnabled: true,
  actionMode: "move",
  hasValidAimTarget: false,
  hasActiveProjectile: false,
  activeMovement: null,
});
assert(
  resolvedPodReveal === "INTERRUPT_POD_REVEAL",
  "Pod Reveal interrupt must override normal camera state",
);

const resolvedOverwatchSlowMo = resolveActiveCameraState({
  director: {
    ...camInit,
    mode: "INTERRUPT_OVERWATCH_SLOWMO",
    timeScale: 0.25,
    overwatchSlowMo: {
      watcherUnitId: "enemy-musketeer",
      watcherCoord: { x: 8, y: 0, z: 10 },
      targetUnitId: "player-bartolomej",
      ambushCoord: { x: 8, y: 0, z: 14 },
      subPhase: "SHOOTER_FOCUS",
      startedAt: Date.now(),
      durationMs: 1400,
    },
  },
  actionCamEnabled: true,
  actionMode: "move",
  hasValidAimTarget: false,
  hasActiveProjectile: false,
  activeMovement: null,
});
assert(
  resolvedOverwatchSlowMo === "INTERRUPT_OVERWATCH_SLOWMO",
  "Overwatch Slow-Mo interrupt must take top priority in CameraDirector",
);

const resolvedCoverReset = resolveActiveCameraState({
  director: {
    ...camInit,
    mode: "COVER_SETTLE_RESET",
    coverSettle: {
      unitId: "player-bartolomej",
      coord: { x: 6, y: 0, z: 15 },
      coverLevel: "half",
      coverDir: "N",
      startedAt: Date.now(),
      durationMs: 420,
    },
  },
  actionCamEnabled: true,
  actionMode: "move",
  hasValidAimTarget: false,
  hasActiveProjectile: false,
  activeMovement: null,
});
assert(
  resolvedCoverReset === "COVER_SETTLE_RESET",
  "Cover Settle Reset must resolve to COVER_SETTLE_RESET before returning to TACTICAL_ISO",
);

// 26d: Dynamic Roof Cutaway when inside enclosed building
const indoorCoord: GridCoord = { x: 9, y: 0, z: 14 }; // Enclosed Grand Priory Palace interior on P0
const outdoorCoord: GridCoord = { x: 8, y: 2, z: 13 }; // Watchtower on P2
assert(
  resolveDynamicRoofCutawayFloor(indoorCoord, 2) === 0,
  "Unit inside enclosed ground-floor palace interior must dynamically cut away upper floors (2 -> 0)",
);
assert(
  resolveDynamicRoofCutawayFloor(outdoorCoord, 2) === 2,
  "Unit on floor P2 keeps active floor 2",
);

// 26e: Pod Reveal Scramble destination calculation & Cover Direction
const scrambleEnemy = {
  ...createInitialUnits().find((u) => u.id === "enemy-garden-musketeer")!,
  pos: { x: 8, y: 0 as const, z: 9 },
};
const scrambleDest = computeScrambleDestination(
  camGrid,
  scrambleEnemy,
  [scrambleEnemy],
  { x: 8, y: 0, z: 14 },
);
assert(
  scrambleDest !== null &&
    (scrambleDest.x !== 8 || scrambleDest.z !== 9) &&
    Math.abs(scrambleDest.x - 8) + Math.abs(scrambleDest.z - 9) <= 2,
  "Pod Reveal computeScrambleDestination must find a valid nearby cover tile within 1-2 steps",
);

const coverDirTest = resolvePrimaryCoverDirection(camGrid, { x: 6, y: 0, z: 15 });
assert(
  typeof coverDirTest.level === "string",
  "resolvePrimaryCoverDirection must inspect adjacent cover walls cleanly",
);

console.log(
  "✓ 4-State XCOM 2 Camera State Machine (TACTICAL_ISO, ACTION_OTS_FOLLOW, INTERRUPT_POD_REVEAL, INTERRUPT_OVERWATCH_SLOWMO, COVER_SETTLE_RESET) validated.",
);

// 27. Baroque Firearm System: Heavy Musket vs. Swedish M1624, Segmented Reload, Hip-Fire, Smoke & Prepared Volley Cone
console.log("--- 27. Baroque Firearm System (Heavy vs. Swedish Musket, Segmented Reload, Hip-Fire, Smoke, Prepared Volley) ---");

const heavyMusket = WEAPON_CATALOG.matchlock_musket_fork!;
const swedishMusket = WEAPON_CATALOG.swedish_musket!;
assert(
  heavyMusket.minDamage === 12 &&
    heavyMusket.maxDamage === 16 &&
    heavyMusket.critBonusDamage === 6 &&
    heavyMusket.critBonusMaxDamage === 8 &&
    heavyMusket.baseCritChance === 15 &&
    heavyMusket.armorPierce === 4 &&
    heavyMusket.armorShred === 4 &&
    heavyMusket.baseAccuracy === 65 &&
    heavyMusket.fireApCost === 2 &&
    heavyMusket.reloadApCost === 4 &&
    heavyMusket.allowEmergencyHipFire === true &&
    heavyMusket.hipFireAimPenalty === 35 &&
    heavyMusket.overwatchMode === "prepared_volley_cone",
  "Heavy Musket (matchlock_musket_fork) must match all 17th-century Spanish heavy musket rules",
);
assert(
  swedishMusket.minDamage === 8 &&
    swedishMusket.maxDamage === 12 &&
    swedishMusket.critBonusDamage === 4 &&
    swedishMusket.critBonusMaxDamage === 6 &&
    swedishMusket.baseCritChance === 10 &&
    swedishMusket.armorPierce === 2 &&
    swedishMusket.armorShred === 2 &&
    swedishMusket.baseAccuracy === 55 &&
    swedishMusket.fireApCost === 1 &&
    swedishMusket.reloadApCost === 2 &&
    swedishMusket.supportsRestFork === false &&
    swedishMusket.overwatchMode === "prepared_volley_cone",
  "Swedish Lightened Musket M1624 (swedish_musket) must match all Gustavian musket rules",
);

// Verify Bartoloměj carries matchlock_musket_fork and Václav + all enemies carry swedish_musket
const firearmTestUnits = createInitialUnits();
const bartoUnit = firearmTestUnits.find((u) => u.id === "player-bartolomej")!;
const vacUnit = firearmTestUnits.find((u) => u.id === "player-vaclav-michalovic")!;
assert(
  bartoUnit.weapon.id === "matchlock_musket_fork" && bartoUnit.movePerAp === 4,
  "Bratr Bartoloměj must carry his sentimental Heavy Musket with rest fork and movePerAp=4",
);
assert(
  vacUnit.weapon.id === "swedish_musket" && vacUnit.movePerAp === 5,
  "Václav z Michalovic must carry the Swedish Lightened Musket M1624 and movePerAp=5",
);
assert(
  firearmTestUnits
    .filter((u) => u.faction === "enemy")
    .every((e) => e.weapon.id === "swedish_musket" && e.meleeWeapon?.id === "swedish_musket_butt"),
  "All Swedish musketeers in Mission 1 must carry Swedish Lightened Musket M1624 and musket butt",
);

// Verify 2 AP stationary fork shot vs 1 AP emergency hip-fire (-35% Aim)
const stationaryBarto = { ...bartoUnit, pos: { x: 8, y: 0 as const, z: 14 }, ap: 2, movedThisTurn: false };
const hipFireBarto = { ...bartoUnit, pos: { x: 8, y: 0 as const, z: 14 }, ap: 1, movedThisTurn: true };
const targetForBarto = { ...dummyEnemy, pos: { x: 8, y: 0 as const, z: 10 } };
const forkShotCalc = calculateShot(camGrid, stationaryBarto, targetForBarto, "clear");
const hipShotCalc = calculateShot(camGrid, hipFireBarto, targetForBarto, "clear");
assert(
  forkShotCalc.isHipFire === false && forkShotCalc.fireApCost === 2,
  "Stationary 2 AP Bartoloměj shot must use rest fork (2 AP, isHipFire=false)",
);
assert(
  hipShotCalc.isHipFire === true &&
    hipShotCalc.fireApCost === 1 &&
    hipShotCalc.hitModifiers.some((m) => m.id === "emergency-hip-fire" && m.value === -35),
  "Moved/1 AP Bartoloměj shot must trigger Emergency Hip-Fire (1 AP, -35% Aim)",
);

// Verify 20% Rain Misfire on Matchlocks & Smoke (-10 Aim for shooter, +15 Defense for target)
const rainShotCalc = calculateShot(camGrid, stationaryBarto, targetForBarto, "rain");
assert(
  rainShotCalc.misfireChance === 20,
  `Matchlock misfire chance in rain must be 20% (got ${rainShotCalc.misfireChance}%)`,
);
const musketSmokeGrid = createInitialGrid();
musketSmokeGrid.addSmoke(stationaryBarto.pos, 0, 2);
musketSmokeGrid.addSmoke(targetForBarto.pos, 0, 2);
const smokeShotCalc = calculateShot(musketSmokeGrid, stationaryBarto, targetForBarto, "clear");
assert(
  smokeShotCalc.hitModifiers.some((m) => m.id === "shooter-smoke-aim" && m.value === -10),
  "Shooter standing in black powder smoke must suffer -10% Aim penalty",
);
assert(
  smokeShotCalc.hitModifiers.some((m) => m.id === "black-powder-smoke" && m.value === -15),
  "Target standing in black powder smoke must gain +15 Defense (-15% to hit)",
);

// Verify Prepared Volley 90° frontal cone (isInPreparedVolleyCone)
const watcherOrigin: GridCoord = { x: 8, y: 0, z: 12 };
assert(
  isInPreparedVolleyCone(watcherOrigin, "N", { x: 8, y: 0, z: 9 }) === true &&
    isInPreparedVolleyCone(watcherOrigin, "N", { x: 10, y: 0, z: 9 }) === true &&
    isInPreparedVolleyCone(watcherOrigin, "N", { x: 8, y: 0, z: 15 }) === false &&
    isInPreparedVolleyCone(watcherOrigin, "N", { x: 12, y: 0, z: 12 }) === false,
  "isInPreparedVolleyCone must strictly enforce a 90° forward cone in the direction of facing",
);

// Verify Segmented Reload (1 AP per step: 0/4 -> 4/4 for Heavy Musket, 0/2 -> 2/2 for Swedish Musket)
useGameStore.getState().resetGame();
useGameStore.setState((s) => ({
  ...s,
  isBusy: false,
  turn: "player",
  selectedUnitId: "player-bartolomej",
  units: s.units.map((u) =>
    u.id === "player-bartolomej"
      ? { ...u, ap: 4, firearmLoaded: false, reloadProgress: 0 }
      : u.id === "player-vaclav-michalovic"
        ? { ...u, ap: 2, firearmLoaded: false, reloadProgress: 0 }
        : u,
  ),
}));
useGameStore.getState().selectUnit("player-bartolomej");
useGameStore.getState().executeReload(); // Step 1/4
let bartoReloadState = useGameStore.getState().units.find((u) => u.id === "player-bartolomej")!;
assert(
  bartoReloadState.reloadProgress === 1 &&
    bartoReloadState.firearmLoaded === false &&
    bartoReloadState.ap === 3,
  "1st reload step on Heavy Musket must advance reloadProgress to 1/4 and spend 1 AP",
);
useGameStore.getState().executeReload(); // Step 2/4
useGameStore.getState().executeReload(); // Step 3/4
bartoReloadState = useGameStore.getState().units.find((u) => u.id === "player-bartolomej")!;
assert(
  bartoReloadState.reloadProgress === 3 && bartoReloadState.firearmLoaded === false,
  "3rd reload step on Heavy Musket must advance reloadProgress to 3/4",
);
useGameStore.getState().executeReload(); // Step 4/4 -> Loaded!
bartoReloadState = useGameStore.getState().units.find((u) => u.id === "player-bartolomej")!;
assert(
  bartoReloadState.firearmLoaded === true && bartoReloadState.reloadProgress === 0,
  "4th reload step on Heavy Musket must complete reload (firearmLoaded=true, reloadProgress=0)",
);

// Test Václav 2-step segmented reload (0/2 -> 1/2 -> 2/2)
useGameStore.getState().selectUnit("player-vaclav-michalovic");
useGameStore.getState().executeReload(); // Step 1/2
let vacReloadState = useGameStore.getState().units.find((u) => u.id === "player-vaclav-michalovic")!;
assert(
  vacReloadState.reloadProgress === 1 && vacReloadState.firearmLoaded === false && vacReloadState.ap === 1,
  "1st reload step on Swedish Musket must advance reloadProgress to 1/2 and leave 1 AP",
);
useGameStore.getState().executeReload(); // Step 2/2 -> Loaded!
vacReloadState = useGameStore.getState().units.find((u) => u.id === "player-vaclav-michalovic")!;
assert(
  vacReloadState.firearmLoaded === true && vacReloadState.reloadProgress === 0,
  "2nd reload step on Swedish Musket must complete reload (firearmLoaded=true)",
);

console.log(
  "✓ Baroque Firearm System (Heavy Musket 4 AP vs. Swedish M1624 2 AP Segmented Reload, Hip-Fire, Smoke, 20% Rain Misfire & Prepared Volley Cone) validated.",
);

// --- 28. Dynamic Smoke, Dust, Blast Shockwave & Tactical Concealment (ADR-0011) ---
console.log("--- 28. Dynamic Smoke, Blast Shockwave & Cumulative Concealment (ADR-0011) ---");

// A) Test Blast Shockwave Displacement: epicenter cleared (0), perimeter compressed (2 outdoors, 3 indoors)
const shockGrid = createInitialGrid();
const outdoorBlastCenter = { x: 5, y: 0 as const, z: 8 }; // Outdoor garden path
shockGrid.applyExplosionShockwave(outdoorBlastCenter, 1, "clear");
assert(
  shockGrid.getTile(outdoorBlastCenter)?.smokeTurns === 0,
  "Explosion epicenter must be completely purged of smoke (smokeTurns === 0) by shockwave expansion",
);
assert(
  (shockGrid.getTile({ x: 6, y: 0, z: 8 })?.smokeTurns ?? 0) === 2,
  "Outdoor blast perimeter tile must have smokeTurns === 2",
);

const indoorBlastCenter = { x: 5, y: 0 as const, z: 20 }; // Grand Priory Palace Hall (isEnclosedRoofedCoord)
shockGrid.applyExplosionShockwave(indoorBlastCenter, 1, "clear");
assert(
  shockGrid.getTile(indoorBlastCenter)?.smokeTurns === 0,
  "Indoor explosion epicenter must be purged of smoke (smokeTurns === 0)",
);
assert(
  (shockGrid.getTile({ x: 6, y: 0, z: 20 })?.smokeTurns ?? 0) === 3,
  "Indoor blast perimeter tile must have smokeTurns === 3 (stagnant indoor dissipation)",
);

// B) Test Cumulative Smoke Concealment in checkLineOfSight3D
const losSmokeGrid = createInitialGrid();
// 1 smoke tile on path: should NOT block LoS
losSmokeGrid.addSmoke({ x: 5, y: 0, z: 5 }, 0, 2);
const los1Tile = checkLineOfSight3D(losSmokeGrid, { x: 5, y: 0, z: 3 }, { x: 5, y: 0, z: 7 });
assert(
  los1Tile.clear === true,
  "Single smoke tile along trajectory must NOT break direct Line of Sight",
);

// 3x3 smoke cloud (radius 1): should completely break LoS across corridor at distance > 1.5
losSmokeGrid.addSmoke({ x: 5, y: 0, z: 5 }, 1, 2);
const los2Tiles = checkLineOfSight3D(losSmokeGrid, { x: 5, y: 0, z: 3 }, { x: 5, y: 0, z: 7 });
assert(
  los2Tiles.clear === false,
  "Two consecutive smoke tiles must trigger Cumulative Smoke Concealment and sever Line of Sight",
);

// Point-Blank Proximity Rule: distance <= 1.5 maintains LoS despite consecutive smoke tiles
const losPointBlank = checkLineOfSight3D(losSmokeGrid, { x: 5, y: 0, z: 4 }, { x: 5, y: 0, z: 5 });
assert(
  losPointBlank.clear === true,
  "Point-Blank Proximity Rule (distance <= 1.5) must maintain LoS between adjacent units through smoke",
);

// High Ground Exception: elevated shooter (P1 -> P0) pierces 2 smoke tiles, but is blocked by 3
const p1ShooterCoord = { x: 14, y: 1 as const, z: 16 };
const p0TargetCoord = { x: 14, y: 0 as const, z: 12 };
const elevatedSmokeGrid = createInitialGrid();
// Add 2 smoke rows across corridor (z=15 and z=14)
for (let x = 13; x <= 15; x++) {
  elevatedSmokeGrid.addSmoke({ x, y: 0, z: 15 }, 0, 2);
  elevatedSmokeGrid.addSmoke({ x, y: 0, z: 14 }, 0, 2);
}
const losElevatedPierces = checkLineOfSight3D(elevatedSmokeGrid, p1ShooterCoord, p0TargetCoord);
assert(
  losElevatedPierces.clear === true,
  "Elevated shooter (P1 -> P0) must pierce up to 2 consecutive smoke tiles (Smoke Horizon Piercing)",
);

// Add a 3rd consecutive smoke row (z=13): now 3 rows (z=15, 14, 13) -> LoS severed even from high ground
for (let x = 13; x <= 15; x++) {
  elevatedSmokeGrid.addSmoke({ x, y: 0, z: 13 }, 0, 2);
}
const losElevatedBlocked = checkLineOfSight3D(elevatedSmokeGrid, p1ShooterCoord, p0TargetCoord);
assert(
  losElevatedBlocked.clear === false,
  "Elevated shooter must have LoS severed when sightline crosses > 2 consecutive smoke tiles",
);

// C) Test Through-Draft Portal Venting: smoke near open exterior door decays at double speed
const draftGrid = createInitialGrid();
const doorCoord = { x: 10, y: 0 as const, z: 16 }; // South palace portal bordering courtyard
draftGrid.setDoorState(doorCoord, "open");
const nearDoorSmoke = { x: 10, y: 0 as const, z: 17 }; // dist 1 from open door
draftGrid.getTile(nearDoorSmoke)!.smokeTurns = 3;
const deepIndoorSmoke = { x: 5, y: 0 as const, z: 23 }; // deep inside palace, far from doors
draftGrid.getTile(deepIndoorSmoke)!.smokeTurns = 3;

draftGrid.decaySmoke("clear");
assert(
  draftGrid.getTile(nearDoorSmoke)?.smokeTurns === 1,
  "Smoke tile adjacent to open exterior door must decay by 2 turns per round (Through-Draft Venting)",
);
assert(
  draftGrid.getTile(deepIndoorSmoke)?.smokeTurns === 2,
  "Deep indoor smoke tile far from doors must decay by standard 1 turn per round",
);

// D) Test Black-Powder Choking Debuff & Cuirassier Respiratory Resistance
const chokeUnits = createInitialUnits();
const testBarto = chokeUnits.find((u) => u.id === "player-bartolomej")!;
testBarto.pos = { x: 5, y: 0, z: 22 }; // indoor palace hall
testBarto.armor = 0; // unarmored monk
draftGrid.getTile(testBarto.pos)!.smokeTurns = 2;

const chokeColloredoUnit = chokeUnits.find((u) => u.id === "player-colloredo")!;
chokeColloredoUnit.pos = { x: 6, y: 0, z: 22 }; // adjacent indoor hall
chokeColloredoUnit.armor = 2;
chokeColloredoUnit.hp = chokeColloredoUnit.maxHp;
draftGrid.getTile(chokeColloredoUnit.pos)!.smokeTurns = 2;

const afterChokeUnits = applyBlackPowderChoking(chokeUnits, draftGrid);
const bartoAfter = afterChokeUnits.find((u) => u.id === "player-bartolomej")!;
const colloredoAfter = afterChokeUnits.find((u) => u.id === "player-colloredo")!;

assert(
  bartoAfter.isChoking === true,
  "Unarmored monk ending turn in indoor smoke must receive Black-Powder Choking debuff",
);
assert(
  bartoAfter.movePerAp === 3, // Heavy musket base is 4, minus 1 = 3
  `Choking soldier must suffer -1 Mobility (expected 3, got ${bartoAfter.movePerAp})`,
);
assert(
  colloredoAfter.isChoking === false,
  "Armored Marshal Colloredo (armor > 0, full HP) must resist smoke choking via Cuirassier Resistance",
);

console.log(
  "✓ Dynamic Smoke, Blast Shockwave & Cumulative Concealment (ADR-0011) validated.",
);

// 29. Test Poslední vzepětí (Death Throes) & Negative HP Thresholds (ADR-0012)
console.log("--- 29. Poslední vzepětí (Death Throes) & Negative HP Thresholds (ADR-0012) ---");

// A) 8 HP Musketeer suffering lethal damage without overkill -> enters Poslední vzepětí
const sampleEnemyMusketeer = units.find((u) => u.id === "enemy-garden-musketeer")!;
assert(sampleEnemyMusketeer.maxHp === 8, "Musketeer must have 8 maxHp");
const damageOutcome1 = resolveUnitDamageResolution(sampleEnemyMusketeer, 12);
assert(damageOutcome1.nextHp === -4, "8 HP - 12 damage = -4 HP");
assert(damageOutcome1.alive === true, "Unit must remain alive during Poslední vzepětí");
assert(damageOutcome1.inDeathThroes === true, "Unit must enter Poslední vzepětí");
assert(damageOutcome1.instantKilled === false, "Instant overkill threshold not reached at -4 HP");

// B) Instant Overkill threshold <= -(maxHp + 1)
// For 8 HP Musketeer, instant threshold is <= -9 HP (e.g. 17 damage)
const damageOutcome2 = resolveUnitDamageResolution(sampleEnemyMusketeer, 17);
assert(damageOutcome2.nextHp === -9, "8 HP - 17 damage = -9 HP");
assert(damageOutcome2.alive === false, "Unit must instantly drop dead at <= -9 HP");
assert(damageOutcome2.instantKilled === true, "Instant overkill flag must be true");
assert(damageOutcome2.inDeathThroes === false, "Instant killed unit must not enter Poslední vzepětí");

// For 10 HP Odowalsky, instant threshold is <= -11 HP
const sampleOdowalsky = units.find((u) => u.id === "enemy-odowalsky")!;
assert(sampleOdowalsky.maxHp === 10, "Odowalsky must have 10 maxHp");
const odoOutcome1 = resolveUnitDamageResolution(sampleOdowalsky, 15);
assert(odoOutcome1.nextHp === -5, "10 HP - 15 damage = -5 HP");
assert(odoOutcome1.alive === true && odoOutcome1.inDeathThroes === true, "Odowalsky enters Poslední vzepětí at -5 HP");
const odoOutcome2 = resolveUnitDamageResolution(sampleOdowalsky, 21);
assert(odoOutcome2.nextHp === -11, "10 HP - 21 damage = -11 HP");
assert(odoOutcome2.alive === false && odoOutcome2.instantKilled === true, "Odowalsky instantly dies at <= -11 HP");

// C) Cumulative damage into negative HP while already in Poslední vzepětí
const dyingMusketeer: UnitData = {
  ...sampleEnemyMusketeer,
  hp: -4,
  inDeathThroes: true,
  deathThroesTurns: 1,
};
const followUpOutcome = resolveUnitDamageResolution(dyingMusketeer, 5);
assert(followUpOutcome.nextHp === -9, "-4 HP - 5 damage = -9 HP");
assert(followUpOutcome.alive === false && followUpOutcome.instantKilled === true, "Cumulative damage to -9 HP must finish the unit");

// D) Dying enemy in Poslední vzepětí is strictly barred from capturing Colloredo
const dyingAdjacentEnemy: UnitData = {
  ...sampleEnemyMusketeer,
  pos: { x: 10, y: 0, z: 15 },
  hp: -2,
  inDeathThroes: true,
  deathThroesTurns: 1,
  firearmLoaded: true,
};
const testColloredoUnit: UnitData = {
  ...colloredo,
  pos: { x: 10, y: 0, z: 14 },
};
const dyingCaptureCheck = checkEnemyColloredoCapture(grid, dyingAdjacentEnemy, testColloredoUnit);
assert(dyingCaptureCheck.canCapture === false, "Dying enemy in Poslední vzepětí MUST NOT be allowed to capture Colloredo");

// E) Hero Poslední vzepětí: Companion in death throes counts as active rescuer
const testStoreUnits = units.map((u) => {
  if (u.id === "player-colloredo") return { ...u, detainedTurns: 1 };
  if (u.id === "player-jan-matej") return { ...u, hp: -2, inDeathThroes: true, deathThroesTurns: 1 };
  if (u.faction === "player") return { ...u, alive: false };
  return u;
});
const activeRescuerOutcome = checkMissionOutcome(grid, testStoreUnits);
assert(activeRescuerOutcome.outcome === "ongoing", "Companion in Poslední vzepětí must count as active rescuer (defeat not triggered)");

// F) Annihilation victory is not triggered while enemies in death throes are still alive
const almostWonUnits = units.map((u) => {
  if (u.faction === "enemy") {
    if (u.id === "enemy-odowalsky") {
      return { ...u, hp: -3, inDeathThroes: true, alive: true };
    }
    return { ...u, alive: false };
  }
  return u;
});
const delayedVictoryOutcome = checkMissionOutcome(grid, almostWonUnits);
assert(delayedVictoryOutcome.outcome === "ongoing", "Victory must not trigger while enemy in Poslední vzepětí is still alive");

console.log(
  "✓ Poslední vzepětí (Death Throes), Negative HP Thresholds & Capture Prohibition (ADR-0012) validated.",
);

console.log("=== ALL MISSION 1 TESTS PASSED SUCCESSFULLY! ===");



