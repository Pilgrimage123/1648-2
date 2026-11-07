import { COLS, COVER_FULL, COVER_HALF, ROWS } from "./config";
import type { Smoke, TileKind, Unit } from "./types";

const RAW = [
  "pp#..c...#..c.~",
  "p...#....#....~",
  "..c.#..c...#..~",
  "..#c.......#qqb",
  ".....#.....#.q~",
  "...#.#.c....q.~",
  "..c......#.#.c~",
  "p....#....#...~",
  "pp..c..#....c.~",
];

const LEGEND: Record<string, TileKind> = {
  ".": "cobble",
  p: "palace",
  "#": "wall",
  c: "cart",
  "~": "river",
  b: "boat",
  q: "quay",
};

export function createTiles(): TileKind[][] {
  if (RAW.length !== ROWS) throw new Error("Mapa nemá 9 řad.");
  return RAW.map((row, y) => {
    if (row.length !== COLS) throw new Error(`Řada ${y} má ${row.length} polí.`);
    return [...row].map((ch) => {
      const kind = LEGEND[ch];
      if (!kind) throw new Error(`Neznámé pole ${ch}`);
      return kind;
    });
  });
}

export function hash01(x: number, y: number, n: number): number {
  let h =
    Math.imul(x + 19, 374761393) ^
    Math.imul(y + 7, 668265263) ^
    Math.imul(n + 3, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

export function at(tiles: TileKind[][], x: number, y: number): TileKind | null {
  if (!inBounds(x, y)) return null;
  return tiles[y]?.[x] ?? null;
}

export function walkable(
  tiles: TileKind[][],
  x: number,
  y: number,
  allowBoat: boolean,
): boolean {
  const t = at(tiles, x, y);
  if (!t || t === "wall" || t === "river") return false;
  if (t === "boat") return allowBoat;
  return true;
}

export function boards(unit: { vip: boolean; faction: string }, phase: string): boolean {
  if (phase === "hold" || phase === "victory" || phase === "defeat") return false;
  return unit.vip;
}

export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function occupied(units: Unit[], ignoreId?: string): Set<string> {
  const set = new Set<string>();
  for (const u of units) {
    if (!u.alive || u.embarked || u.id === ignoreId) continue;
    set.add(`${u.x},${u.y}`);
  }
  return set;
}

function canStep(
  tiles: TileKind[][],
  blocked: Set<string>,
  x: number,
  y: number,
  nx: number,
  ny: number,
  allowBoat: boolean,
): boolean {
  if (!walkable(tiles, nx, ny, allowBoat)) return false;
  if (blocked.has(`${nx},${ny}`)) return false;
  if (nx !== x && ny !== y) {
    if (!walkable(tiles, x, ny, allowBoat) || !walkable(tiles, nx, y, allowBoat)) {
      return false;
    }
    if (blocked.has(`${x},${ny}`) || blocked.has(`${nx},${y}`)) return false;
  }
  return true;
}

export type StepNode = {
  x: number;
  y: number;
  steps: number;
  parent: string | null;
};

export function flood(
  tiles: TileKind[][],
  blocked: Set<string>,
  sx: number,
  sy: number,
  maxSteps: number,
  allowBoat: boolean,
): Map<string, StepNode> {
  const nodes = new Map<string, StepNode>();
  const start = `${sx},${sy}`;
  nodes.set(start, { x: sx, y: sy, steps: 0, parent: null });
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const key = queue[qi++]!;
    const cur = nodes.get(key)!;
    if (cur.steps >= maxSteps) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = `${nx},${ny}`;
      if (nodes.has(nk)) continue;
      if (!canStep(tiles, blocked, cur.x, cur.y, nx, ny, allowBoat)) continue;
      nodes.set(nk, { x: nx, y: ny, steps: cur.steps + 1, parent: key });
      queue.push(nk);
    }
  }
  return nodes;
}

export function reconstruct(
  nodes: Map<string, StepNode>,
  x: number,
  y: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let key = `${x},${y}`;
  for (let n = 0; n < 80 && nodes.has(key); n++) {
    const node = nodes.get(key)!;
    if (node.parent == null) break;
    out.push({ x: node.x, y: node.y });
    key = node.parent;
  }
  out.reverse();
  return out;
}

export function hasLineOfSight(
  tiles: TileKind[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (x0 === x1 && y0 === y1) return true;
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    let ox = 0;
    let oy = 0;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
      ox = sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
      oy = sy;
    }
    if (x === x1 && y === y1) return true;
    if (at(tiles, x, y) === "wall") return false;
    if (ox !== 0 && oy !== 0) {
      if (at(tiles, x - ox, y) === "wall" && at(tiles, x, y - oy) === "wall") {
        return false;
      }
    }
  }
  return true;
}

export function coverValue(
  tiles: TileKind[][],
  smokes: Smoke[],
  x: number,
  y: number,
  ax: number,
  ay: number,
): 0 | 25 | 50 {
  let cover: 0 | 25 | 50 = 0;
  if (at(tiles, x, y) === "cart" || at(tiles, x, y) === "rubble" || smokes.some((s) => s.x === x && s.y === y)) {
    cover = COVER_HALF;
  }
  const sx = Math.sign(ax - x);
  const sy = Math.sign(ay - y);
  const checks: [number, number][] = [];
  if (sx !== 0) checks.push([x + sx, y]);
  if (sy !== 0) checks.push([x, y + sy]);
  if (sx !== 0 && sy !== 0) checks.push([x + sx, y + sy]);
  for (const [cx, cy] of checks) {
    const tile = at(tiles, cx, cy);
    if (tile === "wall") return COVER_FULL;
    if (tile === "cart" || tile === "rubble") cover = COVER_HALF;
  }
  return cover;
}

export function placeSmoke(smokes: Smoke[], clock: number, x: number, y: number): void {
  const expire = clock + 2;
  const existing = smokes.find((s) => s.x === x && s.y === y);
  if (existing) existing.expire = Math.max(existing.expire, expire);
  else smokes.push({ x, y, expire });
}

export function ageClock(clock: number, smokes: Smoke[]): { clock: number; smokes: Smoke[] } {
  const next = clock + 1;
  return { clock: next, smokes: smokes.filter((s) => s.expire > next) };
}
