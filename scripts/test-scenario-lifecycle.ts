/**
 * Scenario Lifecycle & Transition Test
 * scripts/test-scenario-lifecycle.ts
 *
 * Validates full scenario switching between Mission 1 and Mission 2,
 * ensuring no state desynchronization, roof mask corruption, or tutorial leak occurs.
 */

import assert from "node:assert";
import { isEnclosedRoofedCoord } from "../src/core/GridSystem.ts";
import { INSCRIPTION, ONDREJ_ID, PLACHY_ID, ROPE, WINDLASS } from "../src/core/mission2.ts";
import { useGameStore } from "../src/store/useGameStore.ts";

console.log("=== TEST SCENARIO LIFECYCLE & TRANSITIONS ===");

const store = useGameStore.getState();

// 1. Initial State: Mission 1
assert.strictEqual(store.scenario, "mission1");
assert.strictEqual(store.guidedTutorial.enabled, true);
assert.strictEqual(store.guidedTutorial.currentStep, "step_1_matej_move");
assert.strictEqual(isEnclosedRoofedCoord(10, 1, 22), true, "Palace interior is roofed");
assert.strictEqual(isEnclosedRoofedCoord(5, 0, 10), false, "Garden parterre is unroofed");

// 2. Transition to Mission 2
store.beginScenario("mission2");
const m2Store = useGameStore.getState();
assert.strictEqual(m2Store.scenario, "mission2");
assert.strictEqual(m2Store.guidedTutorial.enabled, false, "Guided tutorial must be disabled in Mission 2");
assert.strictEqual(m2Store.guidedTutorial.dismissed, true, "Guided tutorial must be dismissed in Mission 2");
assert.strictEqual(m2Store.tutorialDismissed, true);
assert.strictEqual(m2Store.activeFloor, 2);
assert.strictEqual(m2Store.selectedUnitId, PLACHY_ID);
assert.ok(m2Store.m2, "Mission 2 clock must be initialized");
assert.strictEqual(m2Store.m2.seated, false);
assert.strictEqual(m2Store.m2.pawlUnpinned, false);

// Roof mask check for Mission 2 (Bridge Tower)
assert.strictEqual(isEnclosedRoofedCoord(5, 0, 14), false, "Bridge deck is open to weather");
assert.strictEqual(isEnclosedRoofedCoord(14, 0, 14), true, "Bridge tower gateway vault is roofed");
assert.strictEqual(isEnclosedRoofedCoord(11, 1, 14), true, "Windlass hall is roofed");

// Test pawl unpinning action guard
const ondrej = m2Store.units.find((u) => u.id === ONDREJ_ID)!;
assert.ok(ondrej, "Ondřej must exist in Mission 2");

// Move Ondrej to windlass position directly in store
useGameStore.setState((s) => ({
  units: s.units.map((u) => (u.id === ONDREJ_ID ? { ...u, pos: { ...WINDLASS }, ap: 2 } : u)),
  selectedUnitId: ONDREJ_ID,
}));

// Unpin pawl once
useGameStore.getState().unpinWindlassPawl();
const afterUnpin1 = useGameStore.getState();
assert.strictEqual(afterUnpin1.m2!.windlassArmed, true, "Windlass must be armed after unpin action");
const ondrejAp1 = afterUnpin1.units.find((u) => u.id === ONDREJ_ID)!.ap;
assert.strictEqual(ondrejAp1, 1, "Unpinning consumes 1 AP");

// Unpin pawl a second time on the same turn - should be blocked by guard and NOT consume another AP
useGameStore.getState().unpinWindlassPawl();
const afterUnpin2 = useGameStore.getState();
const ondrejAp2 = afterUnpin2.units.find((u) => u.id === ONDREJ_ID)!.ap;
assert.strictEqual(ondrejAp2, 1, "Duplicate unpin in same turn must not consume AP");

// Complete enemy turn to finish pawl unpinning
useGameStore.setState((s) => ({
  m2: { ...s.m2!, pawlUnpinned: true },
}));

// Position Plachy at rope and sever rope
useGameStore.setState((s) => ({
  units: s.units.map((u) => (u.id === PLACHY_ID ? { ...u, pos: { ...ROPE }, ap: 2 } : u)),
  selectedUnitId: PLACHY_ID,
}));

useGameStore.getState().severPortcullisRope();
const afterSever = useGameStore.getState();
assert.strictEqual(afterSever.m2!.ropeSevered, true, "Rope must be severed");
assert.strictEqual(afterSever.m2!.seated, true, "Portcullis must be seated");
assert.strictEqual(afterSever.outcome, "victory", "Mission 2 must be won upon severing rope");
assert.strictEqual(afterSever.victoryReason, "portcullis");

// 3. Transition back to Mission 1
store.beginScenario("mission1");
const m1Restored = useGameStore.getState();
assert.strictEqual(m1Restored.scenario, "mission1");
assert.strictEqual(m1Restored.guidedTutorial.enabled, true, "Guided tutorial must be restored for Mission 1");
assert.strictEqual(m1Restored.guidedTutorial.currentStep, "step_1_matej_move");
assert.strictEqual(m1Restored.guidedTutorial.dismissed, false);
assert.strictEqual(m1Restored.selectedUnitId, "player-jan-matej");
assert.strictEqual(m1Restored.activeFloor, 1);
assert.strictEqual(m1Restored.outcome, "ongoing");

// Roof mask check restored for Grand Priory Palace
assert.strictEqual(isEnclosedRoofedCoord(10, 1, 22), true, "Palace interior is roofed again");
assert.strictEqual(isEnclosedRoofedCoord(5, 0, 10), false, "Garden is unroofed again");

console.log("✓ All scenario lifecycle and transition checks passed cleanly!");
