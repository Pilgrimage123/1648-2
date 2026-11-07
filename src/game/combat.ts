import { PRAYER_AIM } from "./config";
import { at, chebyshev, coverValue, hasLineOfSight, placeSmoke } from "./map";
import type { Sim, Smoke, TileKind, Unit, Weapon } from "./types";
import { gunLoaded, markUnloaded } from "./units";

export type ShotReason = "ok" | "range" | "los" | "load" | "ap" | "empty" | "none";

export type ShotInfo = {
  weaponIndex: number;
  chance: number;
  cover: 0 | 25 | 50;
  dist: number;
  reason: ShotReason;
};

export function hitChance(
  attacker: Unit,
  weapon: Weapon,
  dist: number,
  cover: number,
): number {
  let acc = weapon.accuracy - Math.max(0, dist - 1) * weapon.falloff;
  const penalty =
    weapon.delivery === "throw" ? 0 : weapon.firearm ? cover : Math.round(cover * 0.5);
  acc -= penalty;
  if (attacker.blessing) acc += PRAYER_AIM;
  return Math.max(6, Math.min(96, Math.round(acc)));
}

export function evaluateShot(
  attacker: Unit,
  ax: number,
  ay: number,
  defender: Unit,
  tiles: TileKind[][],
  smokes: Smoke[],
  opts?: { ignoreAp?: boolean; ignoreLoad?: boolean; weaponIndex?: number },
): ShotInfo {
  const dist = chebyshev(ax, ay, defender.x, defender.y);
  if (attacker.weapons.length === 0 || defender.embarked || !defender.alive) {
    return { weaponIndex: -1, chance: 0, cover: 0, dist, reason: "none" };
  }
  const rawIndex = opts?.weaponIndex ?? attacker.weaponIndex;
  const weaponIndex = Math.max(0, Math.min(rawIndex, attacker.weapons.length - 1));
  const weapon = attacker.weapons[weaponIndex]!;
  const cover = weapon.delivery === "throw" ? 0 : coverValue(tiles, smokes, defender.x, defender.y, ax, ay);
  const chance = hitChance(attacker, weapon, dist, cover);
  let reason: ShotReason = "ok";
  const left = attacker.stock[weapon.id];
  if (weapon.delivery === "place") reason = "none";
  else if (left !== undefined && left <= 0) reason = "empty";
  else if (dist <= 0 || dist > weapon.range) reason = "range";
  else if (!hasLineOfSight(tiles, ax, ay, defender.x, defender.y)) reason = "los";
  else if (weapon.firearm && !gunLoaded(attacker, weapon) && !opts?.ignoreLoad) reason = "load";
  else if (!opts?.ignoreAp && attacker.ap < weapon.ap) reason = "ap";
  return { weaponIndex, chance, cover, dist, reason };
}

export type Roll = {
  hit: boolean;
  misfire: boolean;
  damage: number;
  roll: number;
  stopped: number;
  shredded: number;
};

export function rollAttack(sim: Sim, weapon: Weapon, chance: number, blessed = false): Roll {
  if (!blessed && weapon.firearm && weapon.misfire > 0 && sim.rng() < weapon.misfire) {
    return { hit: false, misfire: true, damage: 0, roll: -1, stopped: 0, shredded: 0 };
  }
  const roll = sim.rng() * 100;
  const hit = roll < chance;
  return { hit, misfire: false, damage: hit ? weapon.damage : 0, roll, stopped: 0, shredded: 0 };
}

export function mitigate(
  target: Unit,
  weapon: Weapon,
  damage: number,
): { dealt: number; stopped: number; shredded: number } {
  const stopped = Math.max(0, Math.min(damage, target.armor - weapon.pierce));
  const dealt = damage - stopped;
  let shredded = 0;
  if (weapon.shred > 0 && target.armor > 0) {
    shredded = Math.min(target.armor, weapon.shred);
    target.armor -= shredded;
  }
  if (dealt > 0) target.hp = Math.max(0, target.hp - dealt);
  return { dealt, stopped, shredded };
}

const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function scatterTile(sim: Sim, x: number, y: number): { x: number; y: number } {
  const open: { x: number; y: number }[] = [];
  for (const [dx, dy] of NEIGHBORS) {
    const tile = at(sim.tiles, x + dx, y + dy);
    if (tile && tile !== "wall" && tile !== "river") open.push({ x: x + dx, y: y + dy });
  }
  if (open.length === 0) return { x, y };
  return open[Math.floor(sim.rng() * open.length)] ?? { x, y };
}

export function unitsInBlast(sim: Sim, x: number, y: number, radius: number): Unit[] {
  return sim.units
    .filter((unit) => unit.alive && !unit.embarked && chebyshev(unit.x, unit.y, x, y) <= radius)
    .sort((a, b) => Number(b.vip) - Number(a.vip));
}

export function commitAttack(
  sim: Sim,
  attacker: Unit,
  defender: Unit,
  weapon: Weapon,
  result: Roll,
): void {
  if (weapon.firearm) {
    markUnloaded(attacker, weapon.id);
    placeSmoke(sim.smokes, sim.clock, attacker.x, attacker.y);
  }
  if (attacker.blessing) attacker.blessing = false;
  if (result.hit && !result.misfire) {
    const hit = mitigate(defender, weapon, result.damage);
    result.damage = hit.dealt;
    result.stopped = hit.stopped;
    result.shredded = hit.shredded;
  }
}

export function reasonLine(info: ShotInfo, attacker: Unit): string {
  const weapon = attacker.weapons[info.weaponIndex];
  if (info.reason === "load") return `${weapon?.name ?? "Zbraň"} není nabitá.`;
  if (info.reason === "empty") return "Už mu žádná nezbyla.";
  if (info.reason === "ap") return "Málo akčních bodů.";
  if (info.reason === "los") return "Zeď stojí ve střele.";
  if (info.reason === "range") return "Příliš daleko.";
  if (attacker.vip) return "Colloredo neválčí zbraní. Může vydat rozkaz.";
  return "Teď nelze udeřit.";
}
