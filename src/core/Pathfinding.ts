/**
 * Pure TypeScript 3D A* Pathfinding and Dijkstra Movement Zone Calculator (/src/core/Pathfinding.ts).
 * Supports multi-floor navigation (P0 <-> P1 <-> P2) via straight and spiral staircases,
 * including anti-deadlock diagonal ramp transitions when a landing is occupied,
 * and running door-breach navigation when `movingUnitId` is specified.
 * Zero Three.js or React imports.
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
  TileData,
  UnitData,
} from "./types";

interface AStarNode {
  coord: GridCoord;
  g: number;
  f: number;
  parentKey: string | null;
}

function heuristic3D(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.y - b.y);
}

function getConnectedStairFloors(
  tile: TileData,
  currentFloor: FloorLevel,
): FloorLevel[] {
  if (!tile.isLadder && (!tile.stairType || tile.stairType === "none")) {
    return [];
  }
  if (tile.stairConnections && tile.stairConnections.length > 0) {
    return tile.stairConnections.filter((f) => f !== currentFloor);
  }
  // Fallback pro zpětnou kompatibilitu s `setLadder` bez explicitních `stairConnections`
  if (currentFloor === 0) return [1];
  if (currentFloor === 1) return [0];
  return [1];
}

function isTilePassableForUnit(
  grid: GridSystem,
  tile: TileData | undefined,
  allowClosedDoors: boolean,
): boolean {
  if (!tile || !tile.hasFloor) return false;
  if (tile.walkable) return true;
  if (
    allowClosedDoors &&
    tile.obstacle === "none" &&
    grid.isDoorClosedAt(tile.coord)
  ) {
    return true;
  }
  return false;
}

/**
 * Returns valid neighboring walkable coordinates from `current`, including:
 * 1. Cardinal movement on the same floor (`stepCost: 1`)
 * 2. Direct vertical transitions on a staircase (`(x, y, z) <-> (x, targetFloor, z)`, `stepCost: 1`)
 * 3. Diagonal ramp step-off / step-on transitions (`stepCost: 2`) so units can smoothly walk past
 *    a staircase landing even if another unit is standing on one end of the stairs.
 */
export function getNeighbors(
  grid: GridSystem,
  current: GridCoord,
  units: UnitData[],
  movingUnitId?: string,
): { coord: GridCoord; stepCost: number }[] {
  const results: { coord: GridCoord; stepCost: number }[] = [];
  const seenKeys = new Set<string>();
  const currentTile = grid.getTile(current);
  if (!currentTile) return results;
  const allowClosedDoors = !!movingUnitId;

  const pushNeighbor = (coord: GridCoord, stepCost: number) => {
    const key = coordKey(coord);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    results.push({ coord, stepCost });
  };

  // 1. Cardinal movement on the same floor
  for (const dir of ["N", "E", "S", "W"] as CardinalDir[]) {
    const { dx, dz } = CARDINAL_OFFSETS[dir];
    const nextCoord: GridCoord = {
      x: current.x + dx,
      y: current.y,
      z: current.z + dz,
    };
    const nextTile = grid.getTile(nextCoord);
    if (!isTilePassableForUnit(grid, nextTile, allowClosedDoors) || !nextTile)
      continue;

    if (!grid.isBlockedByUnit(nextCoord, units, movingUnitId)) {
      pushNeighbor(nextCoord, 1);
    } else {
      // 1b. Ramp step-on: ONLY if the adjacent tile on our floor is a staircase whose landing on our floor
      // is occupied by another unit, allow stepping directly onto its connected upper/lower floor landing (cost 2).
      const neighborStairFloors = getConnectedStairFloors(nextTile, current.y);
      for (const targetFloor of neighborStairFloors) {
        const upperOrLowerLanding: GridCoord = {
          x: nextCoord.x,
          y: targetFloor,
          z: nextCoord.z,
        };
        const landingTile = grid.getTile(upperOrLowerLanding);
        if (
          isTilePassableForUnit(grid, landingTile, allowClosedDoors) &&
          !grid.isBlockedByUnit(upperOrLowerLanding, units, movingUnitId)
        ) {
          pushNeighbor(upperOrLowerLanding, 2);
        }
      }
    }
  }

  // 2. Vertical movement via straight or spiral staircase across connected floors (P0 <-> P1 <-> P2)
  const targetFloors = getConnectedStairFloors(currentTile, current.y);
  for (const targetFloor of targetFloors) {
    const verticalCoord: GridCoord = {
      x: current.x,
      y: targetFloor,
      z: current.z,
    };
    const verticalTile = grid.getTile(verticalCoord);
    if (
      !isTilePassableForUnit(grid, verticalTile, allowClosedDoors) ||
      !verticalTile
    )
      continue;

    if (!grid.isBlockedByUnit(verticalCoord, units, movingUnitId)) {
      pushNeighbor(verticalCoord, 1);
    } else {
      // 2b. Ramp step-off: if the target floor landing directly above/below is occupied by an ally,
      // allow stepping directly off the stairs onto an adjacent walkable tile on `targetFloor` (cost 2).
      for (const dir of ["N", "E", "S", "W"] as CardinalDir[]) {
        const { dx, dz } = CARDINAL_OFFSETS[dir];
        const stepOffCoord: GridCoord = {
          x: current.x + dx,
          y: targetFloor,
          z: current.z + dz,
        };
        const stepOffTile = grid.getTile(stepOffCoord);
        if (
          isTilePassableForUnit(grid, stepOffTile, allowClosedDoors) &&
          !grid.isBlockedByUnit(stepOffCoord, units, movingUnitId)
        ) {
          pushNeighbor(stepOffCoord, 2);
        }
      }
    }
  }

  return results;
}

/**
 * 3D A* Pathfinding across floors (using straight and spiral staircases).
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
  const allowClosedDoors = !!movingUnitId;
  const goalTile = grid.getTile(goal);
  if (!isTilePassableForUnit(grid, goalTile, allowClosedDoors)) return [];
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
      const floorChangeBias =
        (nextCoord.y !== currentNode.coord.y ? 0.05 : 0) +
        Math.abs(nextCoord.y - goal.y) * 0.02;
      const tentativeF =
        tentativeG + heuristic3D(nextCoord, goal) + floorChangeBias;
      const existing = openMap.get(nextKey);
      if (
        !existing ||
        tentativeG < existing.g ||
        (tentativeG === existing.g && tentativeF < existing.f)
      ) {
        const nextNode: AStarNode = {
          coord: nextCoord,
          g: tentativeG,
          f: tentativeF,
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

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
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
