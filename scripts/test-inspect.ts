/**
 * Úplný přehled (F1 / 0): obsah listu a to, že podržený klik nerozkazuje.
 */
import assert from "node:assert";
import { buildInspectView, type InspectContext } from "../src/core/inspectView.ts";
import { coordKey, createInitialGrid, createInitialUnits } from "../src/core/GridSystem.ts";
import type { FogOfWarSnapshot, GridCoord, UnitData } from "../src/core/types.ts";
import { useGameStore } from "../src/store/useGameStore.ts";

console.log("=== TEST INSPECT DOSSIER (F1 / 0) ===");

const grid = createInitialGrid();
const units = createInitialUnits();
const jan = units.find((unit) => unit.id === "player-jan-matej")!;
const enemy = units.find((unit) => unit.id === "enemy-odowalsky")!;

function fog(partial: Partial<FogOfWarSnapshot> = {}): FogOfWarSnapshot {
  return {
    visibleCoords: new Set<string>(),
    exploredCoords: new Set<string>(),
    visibleEnemyIds: new Set<string>(),
    soundContacts: [],
    unitSightRadii: {},
    ...partial,
  };
}

function seen(coord: GridCoord): FogOfWarSnapshot {
  return fog({
    visibleCoords: new Set([coordKey(coord)]),
    exploredCoords: new Set([coordKey(coord)]),
  });
}

function view(overrides: Partial<InspectContext> = {}) {
  return buildInspectView({
    units,
    tileAt: (coord) => grid.getTile(coord),
    doorAt: (coord) => grid.getDoor(coord),
    fog: fog(),
    fogOfWarEnabled: true,
    pin: null,
    actionMode: "move",
    selectedUnitId: jan.id,
    selectedTargetId: null,
    activeCombat: null,
    ...overrides,
  });
}

const soldier = view();
assert(soldier.kind === "unit", "selected soldier opens a unit sheet");
if (soldier.kind === "unit") {
  assert.equal(soldier.name, "Jan Matěj");
  assert.equal(soldier.firearmName, "Kolečková dragounská karabina");
  assert.equal(soldier.stats.find((stat) => stat.label === "Zdraví")?.value, "14/14");
  assert.equal(soldier.ability, null);
}

const withAbility: UnitData[] = units.map((unit) =>
  unit.id === jan.id
    ? {
        ...unit,
        ability: {
          id: "protector_oath",
          name: "Přísaha ochránce",
          subtitle: "Drží bránu",
          description: "Drží bránu.",
          apCost: 1,
          cooldownTurns: 3,
          currentCooldown: 1,
        },
      }
    : unit,
);
const abilitySheet = view({ units: withAbility });
assert(abilitySheet.kind === "unit" && abilitySheet.ability?.description === "Drží bránu.");

const aimed = view({
  actionMode: "shoot",
  selectedTargetId: enemy.id,
  fog: fog({ visibleEnemyIds: new Set([enemy.id]) }),
  activeCombat: {
    mode: "shot",
    targetId: enemy.id,
    hitChance: 42,
    critChance: 10,
    minDamage: 4,
    maxDamage: 6,
    misfireChance: 8,
    armorPierce: 1,
    armorShred: 0,
    hitModifiers: [],
    critModifiers: [],
  },
});
assert(aimed.kind === "unit", "aiming follows the enemy");
if (aimed.kind === "unit") {
  assert.equal(aimed.name, enemy.name);
  assert.notEqual(aimed.name, jan.name);
  assert.equal(aimed.combat?.hitChance, 42);
  assert.equal(aimed.combat?.misfire, "8 %");
}

const hidden = view({
  pin: { kind: "unit", id: enemy.id },
  fog: fog({
    soundContacts: [
      {
        unitId: enemy.id,
        pos: enemy.pos,
        kind: "matchcord_glow",
        label: "Žhnoucí doutnák v šerosvitu",
        distanceToNearestAlly: 4,
      },
    ],
  }),
});
assert.equal(hidden.kind, "contact");
const hiddenText = JSON.stringify(hidden);
assert.equal(hiddenText.includes(enemy.weapon.name), false, "hidden enemy keeps the weapon name out");
assert.equal(hiddenText.includes(enemy.name), false, "hidden enemy keeps the name out");
if (hidden.kind === "contact") {
  assert.equal(hidden.headline, "Žhnoucí doutnák v šerosvitu");
}

const doorCoord: GridCoord = { x: 5, y: 0, z: 17 };
const doorSheet = view({
  pin: { kind: "tile", coord: doorCoord },
  fog: seen(doorCoord),
});
assert(doorSheet.kind === "terrain" && doorSheet.censored === false);
if (doorSheet.kind === "terrain") {
  assert.equal(doorSheet.title, "Kované dveře maltézské zbrojnice");
  assert.equal(
    doorSheet.lines.find((line) => line.label === "Stav dveří")?.value,
    "Zavřené",
  );
}

const kegCoord: GridCoord = { x: 7, y: 0, z: 13 };
const darkKeg = view({ pin: { kind: "tile", coord: kegCoord } });
assert(darkKeg.kind === "terrain" && darkKeg.censored === true);
if (darkKeg.kind === "terrain") {
  assert.equal(darkKeg.cover, null);
  assert.equal(JSON.stringify(darkKeg).includes("5 HP"), false);
  assert.equal(darkKeg.title, "Neprozkoumáno");
}

const litKeg = view({
  pin: { kind: "tile", coord: kegCoord },
  fog: seen(kegCoord),
});
assert(litKeg.kind === "terrain" && litKeg.title === "Prachový sud");
if (litKeg.kind === "terrain") {
  assert.equal(
    litKeg.lines.find((line) => line.label === "Výbuch")?.value,
    "3×3, 5 HP, 2 zbroj, kouř",
  );
}

useGameStore.getState().resetGame();
const before = useGameStore.getState();
const selectedId = before.selectedUnitId!;
const posBefore = { ...before.units.find((unit) => unit.id === selectedId)!.pos };
const doorBefore = before.grid.getDoor(doorCoord)!.state;

before.beginInspectHold();
before.handleUnitClick(enemy.id);
const afterUnit = useGameStore.getState();
assert.equal(afterUnit.selectedUnitId, selectedId, "inspect click does not reselect");
assert.equal(afterUnit.actionMode, "move", "inspect click does not enter aim");
assert.deepEqual(afterUnit.inspectPin, { kind: "unit", id: enemy.id });
assert.equal(afterUnit.inspectOpen, true);

afterUnit.toggleDoor(doorCoord);
const afterDoor = useGameStore.getState();
assert.equal(afterDoor.grid.getDoor(doorCoord)!.state, doorBefore, "inspect click does not open the door");
assert.deepEqual(afterDoor.inspectPin, { kind: "tile", coord: doorCoord });

afterDoor.handleTileClick(kegCoord);
const afterTile = useGameStore.getState();
assert.deepEqual(
  afterTile.units.find((unit) => unit.id === selectedId)!.pos,
  posBefore,
  "inspect click does not move the soldier",
);
assert.deepEqual(afterTile.inspectPin, { kind: "tile", coord: kegCoord });

afterTile.endInspectHold();
assert.equal(useGameStore.getState().inspectOpen, true, "releasing the key keeps a click-opened sheet");
assert.deepEqual(useGameStore.getState().inspectPin, { kind: "tile", coord: kegCoord });

useGameStore.getState().closeInspect();
useGameStore.getState().beginInspectHold();
useGameStore.getState().endInspectHold();
assert.equal(useGameStore.getState().inspectOpen, true);
assert.equal(useGameStore.getState().inspectPin, null);
useGameStore.getState().beginInspectHold();
useGameStore.getState().endInspectHold();
assert.equal(useGameStore.getState().inspectOpen, false);

console.log("Inspect dossier checks passed.");
