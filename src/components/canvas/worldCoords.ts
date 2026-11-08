/**
 * Coordinate conversion utilities between discrete 3D GridCoord { x, y, z }
 * and Three.js world space [wx, wy, wz].
 */

import { GRID_DEPTH, GRID_WIDTH } from "../../core/GridSystem";
import type { GridCoord } from "../../core/types";

export const TILE_SIZE = 1.6;
export const FLOOR_HEIGHT = 2.4;

export function gridToWorld(coord: GridCoord): [number, number, number] {
  const wx = (coord.x - (GRID_WIDTH - 1) * 0.5) * TILE_SIZE;
  const wy = coord.y * FLOOR_HEIGHT;
  const wz = (coord.z - (GRID_DEPTH - 1) * 0.5) * TILE_SIZE;
  return [wx, wy, wz];
}
