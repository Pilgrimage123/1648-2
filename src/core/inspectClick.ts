/**
 * Světový klik při držení F1 / 0.
 * Přehled má přednost před pohybem, střelbou, otevřením dveří a přepnutím patra.
 */

export function doorMeshForwardsClick(
  inspectKeyHeld: boolean,
  isAdjacent: boolean,
): boolean {
  return inspectKeyHeld || isAdjacent;
}

export function stairClickChangesFloor(
  inspectKeyHeld: boolean,
  actionMode: string,
  stairIsReachableMove: boolean,
): boolean {
  if (inspectKeyHeld) return false;
  return !(actionMode === "move" && stairIsReachableMove);
}

/** V režimu pohybu duch vyššího patra nechytá kliky. Držený přehled tu výjimku ruší. */
export function higherFloorUnitIgnoresClicks(
  inspectKeyHeld: boolean,
  isHigherFloor: boolean,
  actionMode: string,
): boolean {
  return !inspectKeyHeld && isHigherFloor && actionMode === "move";
}
