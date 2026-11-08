/**
 * Pure TypeScript 3D A* Pathfinding and Dijkstra Movement Zone Calculator (/src/core/Pathfinding.ts).
 * Supports multi-floor navigation via ladders (isLadder). Zero Three.js or React imports.
 */

import {
  bestTileCover,
  CARDINAL_OFFSETS,
  coordKey,
  GridSystem,
  sameCoord,
} from "./GridSystem";
import type {
  CardinalDir,
  FloorLevel,
  GridCoord,
  ReachableTile,
  UnitData,
} from "./types";

interface AStarNode {
  coord: GridCoord;
  g: number;
  f: number;
  parentKey: string | null;
}

function heuristic3D(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.y - b.y) * 2;
}

/**
 * Returns valid neighboring walkable coordinates from `current`, including
 * cardinal neighbors on the same floor and vertical ladder transitions (`isLadder`).
 */
export function getNeighbors(
  grid: GridSystem,
  current: GridCoord,
  units: UnitData[],
  movingUnitId?: string,
): { coord: GridCoord; stepCost: number }[] {
  const results: { coord: GridCoord; stepCost: number }[] = [];
  const currentTile = grid.getTile(current);
  if (!currentTile) return results;

  // 1. Cardinal movement on the same floor
  for (const dir of ["N", "E", "S", "W"] as CardinalDir[]) {
    const { dx, dz } = CARDINAL_OFFSETS[dir];
    const nextCoord: GridCoord = {
      x: current.x + dx,
      y: current.y,
      z: current.z + dz,
    };
    const nextTile = grid.getTile(nextCoord);
    if (!nextTile || !nextTile.hasFloor || !nextTile.walkable) continue;
    if (grid.isBlockedByUnit(nextCoord, units, movingUnitId)) continue;
    results.push({ coord: nextCoord, stepCost: 1 });
  }

  // 2. Vertical movement via ladder between y=0 and y=1
  if (currentTile.isLadder) {
    const targetFloor: FloorLevel = current.y === 0 ? 1 : 0;
    const verticalCoord: GridCoord = {
      x: current.x,
      y: targetFloor,
      z: current.z,
    };
    const verticalTile = grid.getTile(verticalCoord);
    if (
      verticalTile &&
      verticalTile.hasFloor &&
      verticalTile.walkable &&
      verticalTile.isLadder &&
      !grid.isBlockedByUnit(verticalCoord, units, movingUnitId)
    ) {
      results.push({ coord: verticalCoord, stepCost: 1 });
    }
  }

  return results;
}

/**
 * 3D A* Pathfinding across floors (using ladders).
 * Returns an array of GridCoord steps (excluding start, including goal), or empty array if unreachable.
 */
export function findPathAStar(
  grid: GridSystem,
  start: GridCoord,
  goal: GridCoord,
  units: UnitData[],
  movingUnitId?: string,
): GridCoord[] {
  if (sameCoord(start, goal)) return [];
  const goalTile = grid.getTile(goal);
  if (!goalTile || !goalTile.hasFloor || !goalTile.walkable) return [];
  if (grid.isBlockedByUnit(goal, units, movingUnitId)) return [];

  const openMap = new Map<string, AStarNode>();
  const closedSet = new Set<string>();
  const allNodes = new Map<string, AStarNode>();

  const startKey = coordKey(start);
  const startNode: AStarNode = {
    coord: start,
    g: 0,
    f: heuristic3D(start, goal),
    parentKey: null,
  };
  openMap.set(startKey, startNode);
  allNodes.set(startKey, startNode);

  while (openMap.size > 0) {
    let currentKey = "";
    let currentNode: AStarNode | null = null;
    for (const [k, node] of openMap.entries()) {
      if (!currentNode || node.f < currentNode.f) {
        currentKey = k;
        currentNode = node;
      }
    }
    if (!currentNode) break;

    if (sameCoord(currentNode.coord, goal)) {
      const path: GridCoord[] = [];
      let cursor: AStarNode | undefined = currentNode;
      while (cursor && cursor.parentKey !== null) {
        path.push(cursor.coord);
        cursor = allNodes.get(cursor.parentKey);
      }
      path.reverse();
      return path;
    }

    openMap.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = getNeighbors(
      grid,
      currentNode.coord,
      units,
      movingUnitId,
    );
    for (const { coord: nextCoord, stepCost } of neighbors) {
      const nextKey = coordKey(nextCoord);
      if (closedSet.has(nextKey)) continue;

      const tentativeG = currentNode.g + stepCost;
      const existing = openMap.get(nextKey);
      if (!existing || tentativeG < existing.g) {
        const nextNode: AStarNode = {
          coord: nextCoord,
          g: tentativeG,
          f: tentativeG + heuristic3D(nextCoord, goal),
          parentKey: currentKey,
        };
        openMap.set(nextKey, nextNode);
        allNodes.set(nextKey, nextNode);
      }
    }
  }

  return [];
}

/**
 * Computes all reachable tiles for `unit` using Dijkstra / Flood Fill,
 * partitioned into:
 * - Blue Zone (`'blue'`): 1 AP cost, leaves >= 1 AP to shoot/act
 * - Yellow Zone (`'yellow'`): 2 AP sprint/dash (or final AP), consumes remaining AP
 */
export function computeReachableTiles(
  grid: GridSystem,
  unit: UnitData,
  units: UnitData[],
): Map<string, ReachableTile> {
  const result = new Map<string, ReachableTile>();
  if (!unit.alive || unit.ap <= 0) return result;

  const maxSteps = unit.ap * unit.movePerAp;
  const distMap = new Map<string, number>();
  const queue: { coord: GridCoord; steps: number }[] = [
    { coord: unit.pos, steps: 0 },
  ];
  distMap.set(coordKey(unit.pos), 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.steps - b.steps);
    const current = queue.shift()!;
    const currentKey = coordKey(current.coord);
    const knownDist = distMap.get(currentKey) ?? Infinity;
    if (current.steps > knownDist) continue;

    if (current.steps > 0) {
      const tile = grid.getTile(current.coord);
      if (tile) {
        const apCost: 1 | 2 = current.steps <= unit.movePerAp ? 1 : 2;
        if (apCost <= unit.ap) {
          const leavesAction = unit.ap - apCost >= 1;
          result.set(currentKey, {
            coord: current.coord,
            costSteps: current.steps,
            apCost,
            zone: leavesAction ? "blue" : "yellow",
            bestCover: bestTileCover(tile.cover),
          });
        }
      }
    }

    if (current.steps >= maxSteps) continue;

    const neighbors = getNeighbors(grid, current.coord, units, unit.id);
    for (const { coord: nextCoord, stepCost } of neighbors) {
      const nextSteps = current.steps + stepCost;
      if (nextSteps > maxSteps) continue;
      const nextKey = coordKey(nextCoord);
      const prevBest = distMap.get(nextKey) ?? Infinity;
      if (nextSteps < prevBest) {
        distMap.set(nextKey, nextSteps);
        queue.push({ coord: nextCoord, steps: nextSteps });
      }
    }
  }

  return result;
}
