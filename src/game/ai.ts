import { MOVE_PER_AP } from "./config";
import { evaluateShot } from "./combat";
import {
  boards,
  chebyshev,
  coverValue,
  flood,
  hasLineOfSight,
  occupied,
  reconstruct,
  type StepNode,
} from "./map";
import type { Sim, Unit } from "./types";
import { gunLoaded, living } from "./units";

export type EnemyAction =
  | { type: "move"; x: number; y: number }
  | { type: "attack"; targetId: string; weaponIndex: number }
  | { type: "throw"; x: number; y: number; weaponIndex: number }
  | { type: "reload" };

function foesOf(sim: Sim): Unit[] {
  return living(sim.units).filter((u) => u.faction === "imperial");
}

function jakubZone(sim: Sim, x: number, y: number): boolean {
  const jakub = sim.units.find(
    (u) => u.archetype === "jakub" && u.alive && !u.embarked && u.overwatch,
  );
  if (!jakub) return false;
  if (chebyshev(x, y, jakub.x, jakub.y) > 2) return false;
  return hasLineOfSight(sim.tiles, jakub.x, jakub.y, x, y);
}

function bestShot(
  sim: Sim,
  unit: Unit,
  x: number,
  y: number,
  foes: Unit[],
  ignoreLoad = false,
) {
  let best: { foe: Unit; weaponIndex: number; chance: number; score: number } | null =
    null;
  for (let wi = 0; wi < unit.weapons.length; wi++) {
    const weapon = unit.weapons[wi];
    if (!weapon || weapon.delivery !== "shot") continue;
    for (const foe of foes) {
      const info = evaluateShot(unit, x, y, foe, sim.tiles, sim.smokes, {
        ignoreAp: true,
        ignoreLoad,
        weaponIndex: wi,
      });
      if (info.reason !== "ok") continue;
      const stopped = Math.max(0, Math.min(weapon.damage, foe.armor - weapon.pierce));
      const dmg = weapon.damage - stopped;
      if (dmg <= 0) continue;
      let score = (info.chance / 100) * dmg;
      if (foe.vip) score *= 1.35;
      if (foe.hp <= dmg) score *= 1.25;
      if (!best || score > best.score) {
        best = { foe, weaponIndex: wi, chance: info.chance, score };
      }
    }
  }
  return best;
}

function safety(sim: Sim, x: number, y: number, foes: Unit[]): number {
  let best = 0;
  for (const foe of foes) {
    best = Math.max(best, coverValue(sim.tiles, sim.smokes, x, y, foe.x, foe.y));
  }
  return best;
}

function pathEntersZone(sim: Sim, nodes: Map<string, StepNode>, x: number, y: number): boolean {
  return reconstruct(nodes, x, y).some((p) => jakubZone(sim, p.x, p.y));
}

function moveDest(
  sim: Sim,
  unit: Unit,
  foes: Unit[],
  avoidZone: boolean,
  minRange: number,
): { x: number; y: number } | null {
  const gun = unit.weapons[0];
  if (!gun) return null;
  const blocked = occupied(sim.units, unit.id);
  const nodes = flood(sim.tiles, blocked, unit.x, unit.y, 40, boards(unit, sim.phase));
  let best: { node: StepNode; score: number } | null = null;
  for (const node of nodes.values()) {
    if (node.steps === 0 || node.steps > 8) continue;
    if (avoidZone && pathEntersZone(sim, nodes, node.x, node.y)) continue;
    if (foes.some((f) => chebyshev(node.x, node.y, f.x, f.y) < minRange)) continue;
    const shot = bestShot(sim, unit, node.x, node.y, foes, true);
    if (!shot || shot.chance < 28) continue;
    const score = shot.score - node.steps * 0.35;
    if (!best || score > best.score) best = { node, score };
  }
  let goal = best?.node ?? null;
  if (!goal) {
    const here = Math.min(...foes.map((f) => chebyshev(unit.x, unit.y, f.x, f.y)));
    let bestD = here;
    for (const node of nodes.values()) {
      if (node.steps === 0) continue;
      if (avoidZone && pathEntersZone(sim, nodes, node.x, node.y)) continue;
      let d = Infinity;
      for (const foe of foes) d = Math.min(d, chebyshev(node.x, node.y, foe.x, foe.y));
      if (d < minRange || d >= bestD) continue;
      bestD = d;
      goal = node;
    }
  }
  if (!goal) return null;
  const path = reconstruct(nodes, goal.x, goal.y);
  if (path.length === 0) return null;
  return path[Math.min(MOVE_PER_AP, path.length) - 1] ?? null;
}

function coverStep(sim: Sim, unit: Unit, foes: Unit[]): { x: number; y: number } | null {
  const gun = unit.weapons.find((w) => w.firearm);
  if (!gun || !gunLoaded(unit, gun) || unit.ap < 1 + gun.ap) return null;
  const blocked = occupied(sim.units, unit.id);
  const nodes = flood(sim.tiles, blocked, unit.x, unit.y, MOVE_PER_AP, boards(unit, sim.phase));
  const current = bestShot(sim, unit, unit.x, unit.y, foes);
  const currentScore = (current?.score ?? 0) + safety(sim, unit.x, unit.y, foes) * 0.035;
  let pick: { x: number; y: number; score: number } | null = null;
  for (const node of nodes.values()) {
    if (node.steps === 0 || node.steps > MOVE_PER_AP) continue;
    if (foes.some((f) => chebyshev(node.x, node.y, f.x, f.y) < 3)) continue;
    if (pathEntersZone(sim, nodes, node.x, node.y)) continue;
    const shot = bestShot(sim, unit, node.x, node.y, foes);
    if (!shot || shot.chance < 26) continue;
    const score = shot.score + safety(sim, node.x, node.y, foes) * 0.04 - node.steps * 0.15;
    if (!pick || score > pick.score) pick = { x: node.x, y: node.y, score };
  }
  if (!pick || pick.score < currentScore + 0.45) return null;
  return { x: pick.x, y: pick.y };
}

function grenadeThrow(
  sim: Sim,
  unit: Unit,
): { x: number; y: number; weaponIndex: number } | null {
  const weaponIndex = unit.weapons.findIndex((w) => w.delivery === "throw");
  if (weaponIndex < 0) return null;
  const weapon = unit.weapons[weaponIndex];
  if (!weapon || (unit.stock[weapon.id] ?? 0) <= 0 || unit.ap < weapon.ap) return null;
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = 0; y < sim.tiles.length; y++) {
    const row = sim.tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const dist = chebyshev(unit.x, unit.y, x, y);
      if (dist < 1 || dist > weapon.range) continue;
      if (!hasLineOfSight(sim.tiles, unit.x, unit.y, x, y)) continue;
      let friends = 0;
      let hits = 0;
      let score = 0;
      for (const other of sim.units) {
        if (!other.alive || other.embarked) continue;
        if (chebyshev(other.x, other.y, x, y) > weapon.blast) continue;
        if (other.faction === "swedish") friends += 1;
        else {
          hits += 1;
          const stopped = Math.max(0, Math.min(weapon.damage, other.armor - weapon.pierce));
          score += weapon.damage - stopped;
        }
      }
      if (hits < 2 || friends > 0) continue;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) return null;
  return { x: best.x, y: best.y, weaponIndex };
}

export function nextAction(sim: Sim, unit: Unit): EnemyAction | null {
  if (!unit.alive || unit.embarked || unit.ap <= 0) return null;
  const foes = foesOf(sim);
  if (foes.length === 0) return null;
  const bomb = grenadeThrow(sim, unit);
  if (bomb) return { type: "throw", x: bomb.x, y: bomb.y, weaponIndex: bomb.weaponIndex };
  const weapon = unit.weapons[0];
  if (!weapon) return null;

  if (!weapon.firearm) {
    const shot = bestShot(sim, unit, unit.x, unit.y, foes);
    if (shot && unit.ap >= weapon.ap) {
      return { type: "attack", targetId: shot.foe.id, weaponIndex: shot.weaponIndex };
    }
    const dest = moveDest(sim, unit, foes, false, 1);
    if (dest && unit.ap >= 1) return { type: "move", x: dest.x, y: dest.y };
    return null;
  }

  const shot = gunLoaded(unit, weapon) ? bestShot(sim, unit, unit.x, unit.y, foes) : null;
  if (shot && shot.chance >= 42 && unit.ap >= weapon.ap) {
    return { type: "attack", targetId: shot.foe.id, weaponIndex: shot.weaponIndex };
  }
  const safer = gunLoaded(unit, weapon) ? coverStep(sim, unit, foes) : null;
  if (safer) return { type: "move", x: safer.x, y: safer.y };
  if (shot && shot.chance >= 28 && unit.ap >= weapon.ap) {
    return { type: "attack", targetId: shot.foe.id, weaponIndex: shot.weaponIndex };
  }
  if (!gunLoaded(unit, weapon) && unit.ap >= weapon.reloadAp) return { type: "reload" };
  if (shot && shot.chance >= 18 && unit.ap >= weapon.ap) {
    return { type: "attack", targetId: shot.foe.id, weaponIndex: shot.weaponIndex };
  }
  const dest = moveDest(sim, unit, foes, true, 3);
  if (dest && unit.ap >= 1 && (!shot || shot.chance < 18)) {
    return { type: "move", x: dest.x, y: dest.y };
  }
  if (shot && unit.ap >= weapon.ap) {
    return { type: "attack", targetId: shot.foe.id, weaponIndex: shot.weaponIndex };
  }
  return null;
}
