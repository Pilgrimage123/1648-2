/**
 * Coordinate conversion utilities between discrete 3D GridCoord { x, y, z }
 * and Three.js world space [wx, wy, wz].
 */

import { GRID_DEPTH, GRID_WIDTH } from "../../core/GridSystem";
import type { GridCoord } from "../../core/types";

export const TILE_SIZE = 1.6;
export const FLOOR_HEIGHT = 2.4;

export function gridToWorld(coord: GridCoord): [number, number, number] {
  return continuousGridToWorld(coord.x, coord.y, coord.z);
}

/**
 * Continuous / floating-point coordinate conversion to 3D world space.
 * Prevents `as any` type assertions for fractional sub-grid entities (e.g. boats, mist patches).
 */
export function continuousGridToWorld(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const wx = (x - (GRID_WIDTH - 1) * 0.5) * TILE_SIZE;
  const wy = y * FLOOR_HEIGHT;
  const wz = (z - (GRID_DEPTH - 1) * 0.5) * TILE_SIZE;
  return [wx, wy, wz];
}
