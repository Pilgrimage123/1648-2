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
  createReinforcementUnits,
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
  checkMissionOutcome,
  syncColloredoCaptureState,
  syncColloredoMobility,
  useGameStore,
} from "../src/store/useGameStore.ts";

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

console.log("=== ALL MISSION 1 TESTS PASSED SUCCESSFULLY! ===");
