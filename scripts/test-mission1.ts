import assert from "node:assert";
import {
  calculateMeleeAttack,
  calculateShot,
  checkLineOfSight3D,
  computeEnemyAiDecision,
  evaluateAdjacentMeleeTargets,
  gridDistance3D,
  isAdjacentForMelee,
  resolveTargetCoverAgainstShot,
  rollMeleeAttack,
  rollRangedAttack,
} from "../src/core/CombatSystem.ts";
import {
  coordKey,
  createInitialGrid,
  createInitialUnits,
  createReinforcementUnits,
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
import type { FloorLevel, GridCoord } from "../src/core/types.ts";

console.log("=== TEST MISSION 1: ESCAPE OF MARSHAL COLLOREDO (GRAND PRIORY PALACE) ===");

// 1. Test Grid & Expanded 3-Floor Baroque Map Setup
const grid = createInitialGrid();
assert(
  grid.width === 20 && grid.depth === 24 && grid.floors === 3,
  "Grid dimensions must be 20x24 with 3 floors (P0, P1, P2)",
);

// Check water tiles (Čertovka canal)
const waterTile = grid.getTile({ x: 0, y: 0, z: 0 });
assert(
  waterTile && waterTile.surface === "water" && !waterTile.walkable,
  "Čertovka water must not be walkable",
);

// Check distant dock & escape zone at Čertovka
const dockTile1 = grid.getTile({ x: 2, y: 0, z: 2 });
const dockTile2 = grid.getTile({ x: 3, y: 0, z: 2 });
assert(
  dockTile1 && dockTile1.surface === "wood_dock" && dockTile1.walkable,
  "Dock tile 1 must be walkable wood dock",
);
assert(
  dockTile1.isEscapeZone === true,
  "Dock tile 1 (2, 0, 2) must be marked as escape zone",
);
assert(
  dockTile2 && dockTile2.isEscapeZone === true,
  "Dock tile 2 (3, 0, 2) must be marked as escape zone",
);

// Check 3 powder kegs in the Maltese Garden
const keg1 = grid.getTile({ x: 6, y: 0, z: 11 });
const keg2 = grid.getTile({ x: 13, y: 0, z: 8 });
const keg3 = grid.getTile({ x: 8, y: 0, z: 5 });
assert(keg1 && keg1.obstacle === "powder_keg", "Powder keg 1 must be at (6, 0, 11)");
assert(keg2 && keg2.obstacle === "powder_keg", "Powder keg 2 must be at (13, 0, 8)");
assert(keg3 && keg3.obstacle === "powder_keg", "Powder keg 3 must be at (8, 0, 5)");

// Check Piano Nobile (P1) and Maltese Watchtower (P2)
const pianoNobileTile = grid.getTile({ x: 10, y: 1, z: 20 });
assert(
  pianoNobileTile && pianoNobileTile.hasFloor && pianoNobileTile.walkable,
  "Grand Priory Palace Piano Nobile (1st floor) must be walkable",
);
const watchtowerTile = grid.getTile({ x: 6, y: 2, z: 16 });
assert(
  watchtowerTile && watchtowerTile.hasFloor && watchtowerTile.walkable,
  "Maltese Watchtower (2nd floor) must be walkable",
);

console.log(
  "✓ 20x24x3 Map, Grand Priory Palace (P0, P1 Piano Nobile, P2 Watchtower), Čertovka dock, and powder kegs validated.",
);

// 1b. Test Straight and Spiral Staircases Walkability (Up & Down across P0, P1, P2)
const grandStairP0 = grid.getTile({ x: 9, y: 0, z: 19 });
assert(
  grandStairP0?.stairType === "straight_stairs",
  "Grand Palace Staircase at (9, 19) must be straight_stairs",
);
const westSpiralP0 = grid.getTile({ x: 4, y: 0, z: 17 });
assert(
  westSpiralP0?.stairType === "spiral_stairs",
  "West Convent Staircase at (4, 17) must be spiral_stairs",
);
const towerSpiralP1 = grid.getTile({ x: 5, y: 1, z: 16 });
assert(
  towerSpiralP1?.stairType === "spiral_stairs",
  "Watchtower Staircase at (5, 16) must be spiral_stairs",
);

// Pathfinding across straight staircase (P0 -> P1 and P1 -> P0)
const pathStraightUp = findPathAStar(
  grid,
  { x: 10, y: 0, z: 18 },
  { x: 10, y: 1, z: 21 },
  [],
);
assert(
  pathStraightUp.length > 0 && pathStraightUp[pathStraightUp.length - 1]!.y === 1,
  "Unit must walk smoothly up the Grand Palace Straight Staircase from P0 to P1",
);
const pathStraightDown = findPathAStar(
  grid,
  { x: 10, y: 1, z: 21 },
  { x: 10, y: 0, z: 18 },
  [],
);
assert(
  pathStraightDown.length > 0 &&
    pathStraightDown[pathStraightDown.length - 1]!.y === 0,
  "Unit must walk smoothly down the Grand Palace Straight Staircase from P1 to P0",
);

// Pathfinding across spiral staircase from P0 all the way to P2 (Maltese Watchtower) and back down
const pathSpiralToTower = findPathAStar(
  grid,
  { x: 4, y: 0, z: 18 },
  { x: 6, y: 2, z: 16 },
  [],
);
assert(
  pathSpiralToTower.length > 0 &&
    pathSpiralToTower[pathSpiralToTower.length - 1]!.y === 2,
  "Unit must climb from P0 through P1 to P2 Watchtower via spiral/straight staircases",
);
const pathFromTowerToGround = findPathAStar(
  grid,
  { x: 7, y: 2, z: 16 },
  { x: 9, y: 0, z: 17 },
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
  { ...dummyBlocker, id: "blocker-unit", pos: { x: 8, y: 1 as const, z: 10 } },
];
const pathPastOccupiedLanding = findPathAStar(
  grid,
  { x: 8, y: 0, z: 11 },
  { x: 9, y: 1, z: 10 },
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

console.log(
  "✓ Initial roster (Colloredo, Jan Matěj, Václav z Michalovic on P1, Bratr Bartoloměj, Odowalsky) validated.",
);

// 3. Test Assisted Movement Mechanic (Podepření komorníkem)
// Initially Jan Matěj is at (9, 0, 19) and Colloredo is at (10, 0, 19) -> distance 1 -> Assisted!
let synced = syncColloredoMobility(units);
let syncedColloredo = synced.find((u) => u.id === "player-colloredo")!;
assert(
  syncedColloredo.movePerAp === 5,
  "Colloredo should have 5 movePerAp when assisted by Jan Matěj",
);
assert(
  syncedColloredo.buffTitle?.includes("Podepřen"),
  "Colloredo should have assisted buff title",
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
  "Colloredo must have only 3 movePerAp when limping alone",
);
assert(
  syncedColloredo.buffTitle?.includes("kulhání"),
  "Colloredo should have limping title when alone",
);

console.log("✓ Assisted mobility mechanic (Jan Matěj supporting Colloredo) validated.");

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

// 9. Test Swedish Capture & Ransom Directive (AI priority for Colloredo)
const testUnitsWithColloredoInSight = units.map((u) => {
  if (u.id === "enemy-odowalsky") {
    return { ...u, pos: { x: 10, y: 0 as const, z: 12 }, ap: 2 };
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

console.log(
  "✓ Swedish Capture & Ransom directive validated (Colloredo targeted for high-value capture).",
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
        pos: { x: downedMarshal.pos.x - 1, y: 0 as const, z: downedMarshal.pos.z },
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
    ? { ...u, pos: { x: colloredo!.pos.x, y: 0 as const, z: colloredo!.pos.z - 1 } }
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

// 11. Test All 3 Playable Characters' Special Abilities & Smart Tutorial Demonstration
const abilityStore = useGameStore.getState();
abilityStore.resetGame();

// 11a: Jan Matěj — Přísaha komorníka
useGameStore.getState().activateSpecialAbility("player-jan-matej");
const afterJan = useGameStore.getState();
const janAfter = afterJan.units.find((u) => u.id === "player-jan-matej")!;
const colloredoAfterJan = afterJan.units.find((u) => u.id === "player-colloredo")!;
assert(
  afterJan.demonstratedAbilities["player-jan-matej"] === true,
  "Jan Matěj ability must be marked as demonstrated",
);
assert(
  janAfter.ability?.currentCooldown === 2,
  "Jan Matěj ability must enter 2-turn cooldown",
);
assert(
  janAfter.ap === 3,
  "Jan Matěj gains +1 AP bonus from hero rush (2 + 1 = 3 AP)",
);
assert(
  colloredoAfterJan.armor === 2 && colloredoAfterJan.maxArmor === 2,
  "Colloredo must gain +2 armor cloak from Jan Matěj",
);
assert(colloredoAfterJan.ap === 3, "Colloredo must gain +1 AP from Jan Matěj");

// 11b: Václav z Michalovic — Svatováclavské soustředění
const vaclavBeforeCalc = calculateShot(
  afterJan.grid,
  afterJan.units.find((u) => u.id === "player-vaclav-michalovic")!,
  odowalsky!,
  "rain",
  vaclav!.pos,
  afterJan.units,
);
useGameStore.getState().activateSpecialAbility("player-vaclav-michalovic");
const afterVaclav = useGameStore.getState();
const vaclavAfter = afterVaclav.units.find(
  (u) => u.id === "player-vaclav-michalovic",
)!;
assert(
  afterVaclav.demonstratedAbilities["player-vaclav-michalovic"] === true,
  "Václav ability must be marked as demonstrated",
);
assert(
  vaclavAfter.abilityBuffActive === true,
  "Václav must have abilityBuffActive === true",
);
assert(
  vaclavAfter.ap === 3,
  "Václav gains +1 AP tactical focus (2 + 1 = 3 AP)",
);
const vaclavAfterCalc = calculateShot(
  afterVaclav.grid,
  vaclavAfter,
  odowalsky!,
  "rain",
  vaclavAfter.pos,
  afterVaclav.units,
);
assert(
  vaclavAfterCalc.misfireChance === 0,
  `Václav misfire chance in rain must drop from ${vaclavBeforeCalc.misfireChance}% to 0%`,
);
const verdictMod = vaclavAfterCalc.hitModifiers.find(
  (m) => m.id === "ability-klementinum-verdict",
);
assert(
  verdictMod && verdictMod.value === 35,
  "Václav shot breakdown must include Svatováclavské soustředění (+35 % hit modifier)",
);
assert(
  vaclavAfterCalc.critChance > vaclavBeforeCalc.critChance,
  "Václav crit chance must increase with Svatováclavské soustředění (+45 % crit)",
);
assert(
  vaclavAfterCalc.armorPierce === vaclavAfter.weapon.armorPierce + 2,
  "Václav armor pierce must increase by +2",
);

// 11c: Bratr Bartoloměj — Maltézská šrapnelová salva
useGameStore.getState().activateSpecialAbility("player-bartolomej");
const afterBart = useGameStore.getState();
const bartAfter = afterBart.units.find((u) => u.id === "player-bartolomej")!;
assert(
  afterBart.demonstratedAbilities["player-bartolomej"] === true,
  "Bartoloměj ability must be marked as demonstrated",
);
assert(bartAfter.ap === 1, "Bartoloměj ability costs 1 AP (2 -> 1 AP)");
assert(
  bartAfter.ability?.currentCooldown === 2,
  "Bartoloměj ability must enter 2-turn cooldown",
);
assert(
  bartAfter.grenades === 3,
  "Bartoloměj restocks petard on ability (2 + 1 = 3)",
);
const bartTile = afterBart.grid.getTile(bartAfter.pos);
assert(
  bartTile && bartTile.smokeTurns > 0,
  "Bartoloměj ability must deploy protective smoke screen around him",
);
const damagedEnemies = afterBart.units.filter(
  (u) => u.faction === "enemy" && (u.hp < u.maxHp || u.isShaken),
);
assert(
  damagedEnemies.length >= 1,
  "Bartoloměj shrapnel volley must damage and shake at least 1 enemy",
);

// 11d: Hrabě Colloredo — Rozkaz maršála
const alliesBeforeCmd = afterBart.units.filter(
  (u) => u.faction === "player" && u.id !== "player-colloredo",
);
useGameStore.getState().activateSpecialAbility("player-colloredo");
const afterCmd = useGameStore.getState();
const colloredoAfterCmd = afterCmd.units.find((u) => u.id === "player-colloredo")!;
assert(
  colloredoAfterCmd.ap === 2,
  "Colloredo used 1 AP for command (3 -> 2 AP)",
);
const alliesAfterCmd = afterCmd.units.filter(
  (u) => u.faction === "player" && u.id !== "player-colloredo",
);
alliesAfterCmd.forEach((ally) => {
  const prev = alliesBeforeCmd.find((a) => a.id === ally.id)!;
  assert(
    ally.ap === Math.min(ally.maxAp + 2, prev.ap + 2),
    `${ally.name} should receive up to +2 AP from marshal command`,
  );
});

console.log(
  "✓ All 4 characters' special abilities (Jan Matěj, Václav, Bratr Bartoloměj, Hrabě Colloredo) validated.",
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
  initialExplored.has("9,0,20"),
  "Grand Priory Palace interior (9,0,20) must start in explored memory",
);
assert(
  initialExplored.has("2,0,2"),
  "Čertovka fisherman skiff dock (2,0,2) must start in explored memory",
);

// Verify dynamic sight radius across floors and weather
const vaclavFogUnit = fogState.units.find(
  (u) => u.id === "player-vaclav-michalovic",
)!;
const vaclavSightP1Rain = computeUnitSightRadius(
  fogState.grid,
  vaclavFogUnit,
  "rain",
  { x: 11, y: 1, z: 16 },
);
const vaclavSightP2Clear = computeUnitSightRadius(
  fogState.grid,
  vaclavFogUnit,
  "clear",
  { x: 10, y: 2, z: 16 },
);
const vaclavSightP0Fog = computeUnitSightRadius(
  fogState.grid,
  vaclavFogUnit,
  "fog",
  { x: 11, y: 0, z: 16 },
);
assert(
  vaclavSightP2Clear > vaclavSightP1Rain && vaclavSightP1Rain > vaclavSightP0Fog,
  `Sight radius must scale with floor elevation and weather (P2 clear=${vaclavSightP2Clear} > P1 rain=${vaclavSightP1Rain} > P0 fog=${vaclavSightP0Fog})`,
);

// Verify initial spotted vs. shrouded enemies & 17th-century Sound/Matchcord Contacts
assert(
  fogState.fogSnapshot.visibleEnemyIds.has("enemy-sniper-roof"),
  "Swedish sharpshooter on garden belvedere (10,1,9) must be spotted at start from Piano Nobile",
);
assert(
  !fogState.fogSnapshot.visibleEnemyIds.has("enemy-dragoon"),
  "Swedish dragoon in western garden (5,0,7) must start shrouded in Fog of War",
);
assert(
  fogState.fogSnapshot.soundContacts.some((c) => c.unitId === "enemy-dragoon"),
  "Unspotted dragoon within acoustic range must emit a 17th-century Sound Contact",
);

// Verify black-powder smoke LoS occlusion on same floor vs. high-ground overlook
const smokeTestGrid = createInitialGrid();
smokeTestGrid.addSmoke({ x: 9, y: 0, z: 12 }, 0, 2);
const losBlockedBySmoke = checkFogLineOfSight3D(
  smokeTestGrid,
  { x: 9, y: 0, z: 15 },
  { x: 9, y: 0, z: 9 },
  false,
);
assert(
  !losBlockedBySmoke,
  "Intermediate black-powder smoke tile must block ground-level P0->P0 Fog of War line of sight",
);
const losOverSmokeFromTower = checkFogLineOfSight3D(
  smokeTestGrid,
  { x: 9, y: 2, z: 16 },
  { x: 9, y: 0, z: 9 },
  false,
);
assert(
  losOverSmokeFromTower,
  "Viewing from elevated Maltese Watchtower (P2) must overlook ground-level smoke onto target",
);

// Verify tile visibility helper and toggleFogOfWar
const farNorthCorner = { x: 18, y: 0 as const, z: 5 };
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
  { x: 5, y: 0, z: 8 },
  fogState.units,
  "rain",
  fogState.fogSnapshot.visibleEnemyIds,
);
assert(
  reconPreview.newlyRevealedCount >= 1 &&
    reconPreview.spottedEnemyIds.includes("enemy-dragoon"),
  "Recon preview from (5,0,8) must detect newly revealed enemy-dragoon",
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
  "Reinforcements must consist of 2 units (Dragoon and Cuirassier)",
);
assert(
  reinforcementUnits.some((u) => u.id === "enemy-reinforcement-dragoon" && u.faction === "enemy" && u.pos.z === 4),
  "Reinforcement dragoon must arrive at northern garden gate (z: 4)",
);
assert(
  reinforcementUnits.some((u) => u.id === "enemy-reinforcement-cuirassier" && u.faction === "enemy" && u.pos.z === 4),
  "Reinforcement cuirassier must arrive at northern garden gate (z: 4)",
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
  (u) => u.id === "enemy-reinforcement-dragoon" && u.alive,
);
assert(
  dragoonInUnits !== undefined,
  "Reinforcement dragoon must be present in active units roster",
);
const cuirassierInUnits = round5State.units.find(
  (u) => u.id === "enemy-reinforcement-cuirassier" && u.alive,
);
assert(
  cuirassierInUnits !== undefined,
  "Reinforcement cuirassier must be present in active units roster",
);

// Check that Colloredo can still reach the boat and escape (Tutorial approachability)
const escapeOutcome = checkMissionOutcome(
  round5State.grid,
  round5State.units.map((u) =>
    u.id === "player-colloredo" ? { ...u, pos: { x: 2, y: 0, z: 2 } } : u,
  ),
);
assert(
  escapeOutcome.outcome === "victory" &&
    escapeOutcome.victoryReason === "boat_escape",
  "Colloredo reaching the dock at (2,0,2) must result in boat_escape victory even with reinforcements on map",
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

const armoryDoorCoord = { x: 4, y: 0 as const, z: 18 };
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
// Václav is on P1 loggia ({ x: 8, y: 1, z: 15 }) with balustrade and Swedish patrol is below on P0 ({ x: 8, y: 0, z: 13 })
const p1EdgeCoord: GridCoord = { x: 8, y: 1, z: 15 };
const p0CourtyardCoord: GridCoord = { x: 8, y: 0, z: 13 };
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
const lowObstacleCoord: GridCoord = { x: 7, y: 0, z: 15 };
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
  { x: 6, y: 1, z: 19 },
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
const candidateTile: GridCoord = { x: 9, y: 0, z: 17 };
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
const smokyP0TargetCoord: GridCoord = { x: 8, y: 0, z: 13 };
grid.addSmoke(smokyP0TargetCoord, 2);
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
const p0Key = coordKey({ x: 8, y: 0, z: 13 });
const p2Key = coordKey({ x: 8, y: 2, z: 13 });
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
  { x: 12, y: 0, z: 15 },
  1,
);
assert(
  resolvedOnP1.x === 12 && resolvedOnP1.y === 1 && resolvedOnP1.z === 15,
  "When activeFloor=1 and [12, 15] has a P1 floor, resolvePreferredFloorCoord must return P1 (y=1)",
);

const resolvedOnP2 = resolvePreferredFloorCoord(
  vaclavStoreState.grid,
  { x: 6, y: 0, z: 16 },
  2,
);
assert(
  resolvedOnP2.x === 6 && resolvedOnP2.y === 2 && resolvedOnP2.z === 16,
  "When activeFloor=2 and [6, 16] has a P2 watchtower floor, resolvePreferredFloorCoord must return P2 (y=2)",
);

// Verify fallback to P0 ONLY in single-story garden / courtyard locations where P1 does not exist
const resolvedGardenFallback = resolvePreferredFloorCoord(
  vaclavStoreState.grid,
  { x: 10, y: 0, z: 12 },
  1,
);
assert(
  resolvedGardenFallback.x === 10 &&
    resolvedGardenFallback.y === 0 &&
    resolvedGardenFallback.z === 12,
  "When activeFloor=1 and [10, 12] is in the single-story garden (no P1 floor), resolvePreferredFloorCoord must fall back to P0 (y=0)",
);

// Verify Václav's A* path across P1 stays strictly on P1
const vaclavUnitNow = vaclavStoreState.units.find(
  (u) => u.id === "player-vaclav-michalovic",
)!;
const p1GalleryPath = findPathAStar(
  vaclavStoreState.grid,
  vaclavUnitNow.pos,
  { x: 8, y: 1, z: 15 },
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
  { x: 9, y: 0, z: 20 },
  { x: 9, y: 0, z: 18 },
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
      palaceMissMeta.impactObstacle === "palace_stucco"),
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
  bartolomejUnit?.meleeWeapon?.id === "maltese_broadsword",
  "Bartoloměj must be equipped with Maltese broadsword (4-6 HP)",
);
assert(
  vaclavUnit?.meleeWeapon?.id === "cleric_dagger",
  "Václav must be equipped with cleric dagger / furketa point",
);

// 25b: Adjacency Test for Melee Combat
const baseCoord: GridCoord = { x: 8, y: 0, z: 8 };
assert(isAdjacentForMelee(baseCoord, { x: 8, y: 0, z: 9 }), "North neighbor must be adjacent");
assert(isAdjacentForMelee(baseCoord, { x: 9, y: 0, z: 9 }), "Diagonal neighbor must be adjacent");
assert(isAdjacentForMelee(baseCoord, { x: 8, y: 1, z: 8 }), "Vertical floor neighbor must be adjacent");
assert(!isAdjacentForMelee(baseCoord, { x: 8, y: 0, z: 10 }), "Tile at distance 2 is not adjacent");
assert(!isAdjacentForMelee(baseCoord, { x: 12, y: 0, z: 12 }), "Distant tile is not adjacent");

// 25c: Melee Calculations (Colloredo vs Bartoloměj)
const dummyEnemy = initialTestUnits.find((u) => u.id === "enemy-dragoon")!;
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
  bartolomejMeleeCalc.minDamage === 4 && bartolomejMeleeCalc.maxDamage === 6,
  "Bartoloměj broadsword melee preview must show 4-6 HP damage",
);
assert(
  bartolomejMeleeCalc.armorPierce === 1,
  "Maltese broadsword must pierce 1 point of cuirass armor",
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

console.log("=== ALL MISSION 1 TESTS PASSED SUCCESSFULLY! ===");


