/**
 * Test Suite: Guided Tutorial System (XCOM 2 Style Onboarding)
 * scripts/test-guided-tutorial.ts
 */

import assert from "node:assert";
import { GUIDED_TUTORIAL_STEPS, getGuidedStepData, getGuidedTutorialBeacon, isTileAllowedForGuidedMove } from "../src/core/GuidedTutorialSystem";
import { createInitialGrid, createInitialUnits } from "../src/core/GridSystem";
import { useGameStore } from "../src/store/useGameStore";

console.log("=== TEST GUIDED TUTORIAL SYSTEM (XCOM 2 STYLE) ===");

// 1. Ověření definice všech 9 mikrokroků
const stepKeys = Object.keys(GUIDED_TUTORIAL_STEPS);
assert.strictEqual(stepKeys.length, 9, "Musí existovat přesně 9 mikrokroků tutoriálu");

for (const key of stepKeys) {
  const step = getGuidedStepData(key as any);
  assert(step.speaker, `Krok ${key} musí mít mluvčího`);
  assert(step.role, `Krok ${key} musí mít roli`);
  assert(step.title, `Krok ${key} musí mít titul`);
  assert(step.orderText, `Krok ${key} musí mít imperativní rozkaz`);
  assert(step.tacticalTip, `Krok ${key} musí mít taktické ponaučení`);
}
console.log("✓ Všech 9 mikrokroků tutoriálu je kompletně definováno.");

// 2. Počáteční stav obchodu useGameStore
useGameStore.getState().resetGame();
const initialStore = useGameStore.getState();
assert(initialStore.guidedTutorial.enabled === true, "Skriptovaný výcvik musí být ve výchozím stavu zapnut");
assert(initialStore.guidedTutorial.currentStep === "step_1_matej_move", "První krok musí být step_1_matej_move");
assert(initialStore.guidedTutorial.dismissed === false, "Výcvik nesmí být skryt");
assert(initialStore.selectedUnitId === "player-jan-matej", "Výchozí vybranou postavou musí být Jan Matěj");
assert(initialStore.activeFloor === 1, "Výchozí patro musí být 1 (Piano Nobile, ložnice velkopřevora)");
console.log("✓ Počáteční stav hry správně aktivuje Jana Matěje v 1. patře.");

// 3. Test povolených polí pro pohyb (Input Guard)
assert(isTileAllowedForGuidedMove("step_1_matej_move", { x: 6, y: 1, z: 20 }) === true, "Pole [6, 1, 20] musí být povoleno");
assert(isTileAllowedForGuidedMove("step_1_matej_move", { x: 5, y: 1, z: 20 }) === true, "Pole [5, 1, 20] musí být povoleno");
assert(isTileAllowedForGuidedMove("step_1_matej_move", { x: 6, y: 1, z: 25 }) === false, "Otevřené pole v ložnici nesmí být povoleno pro Krok 1");
console.log("✓ Input Guard správně vymezuje pouze kryt za balustrádou.");

// 4. Test majáků pro jednotlivé kroky
const grid = createInitialGrid();
const units = createInitialUnits();

const beacon1 = getGuidedTutorialBeacon(grid, "step_1_matej_move", units);
assert(beacon1 !== null, "Krok 1 musí mít maják");
assert.strictEqual(beacon1!.coord.x, 6);
assert.strictEqual(beacon1!.coord.z, 20);

const beacon3 = getGuidedTutorialBeacon(grid, "step_3_vaclav_aim", units);
assert(beacon3 !== null, "Krok 3 musí mít maják na cíl");
assert.strictEqual(beacon3!.coord.x, 12);
assert.strictEqual(beacon3!.coord.z, 10);

const beacon7 = getGuidedTutorialBeacon(grid, "step_7_keg_explosion", units);
assert(beacon7 !== null, "Krok 7 musí mít maják na prachový sud");
assert.strictEqual(beacon7!.coord.x, 7);
assert.strictEqual(beacon7!.coord.z, 13);

const beacon9 = getGuidedTutorialBeacon(grid, "step_9_free_combat", units);
assert(beacon9 !== null, "Krok 9 musí mít maják na únikovou pramici");
assert.strictEqual(beacon9!.coord.x, 3);
assert.strictEqual(beacon9!.coord.z, 2);
console.log("✓ 3D majáky na bojišti správně lokalizují kryt, střelce, prachový sud a pramici.");

// 5. Test přechodů stavu
useGameStore.getState().setGuidedTutorialStep("step_3_vaclav_aim");
assert(useGameStore.getState().guidedTutorial.currentStep === "step_3_vaclav_aim");
assert(useGameStore.getState().tutorialStep === 2, "Krok 3 musí odpovídat legacy tutorialStep 2");

useGameStore.getState().setActionMode("shoot");
assert(useGameStore.getState().guidedTutorial.currentStep === "step_4_vaclav_shoot", "Přepnutí do míření musí posunout Krok 3 na Krok 4");

// 6. Test přeskočení výcviku (Skip Tutorial)
useGameStore.getState().skipGuidedTutorial();
const skippedStore = useGameStore.getState();
assert(skippedStore.guidedTutorial.enabled === false, "Po přeskočení musí být enabled = false");
assert(skippedStore.guidedTutorial.currentStep === "step_9_free_combat", "Po přeskočení musí být krok step_9_free_combat");
assert(skippedStore.tutorialStep === 4, "Legacy krok musí být 4");
console.log("✓ Přeskočení výcviku okamžitě odemkne svobodnou hru.");

// 7. Test minimalizace / znovuzobrazení (Toggle)
useGameStore.getState().toggleGuidedTutorial();
assert(useGameStore.getState().guidedTutorial.dismissed === true);
useGameStore.getState().toggleGuidedTutorial();
assert(useGameStore.getState().guidedTutorial.dismissed === false);
console.log("✓ Minimalizace a obnovení panelu funguje správně.");

console.log("=== ALL GUIDED TUTORIAL TESTS PASSED SUCCESSFULLY! ===");
