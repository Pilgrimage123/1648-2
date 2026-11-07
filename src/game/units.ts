import { SEED, WEAPONS } from "./config";
import { at, createTiles, hash01 } from "./map";
import type { Sim, Unit, Weapon, WeaponId } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function base(
  partial: Pick<Unit, "id" | "name" | "title" | "faction" | "archetype" | "vip" | "prayer" | "hp" | "x" | "y" | "weapons">,
  gear?: { armor?: number; stock?: Partial<Record<WeaponId, number>> },
): Unit {
  const armor = gear?.armor ?? 0;
  return {
    ...partial,
    maxHp: partial.hp,
    ap: 2,
    maxAp: 2,
    facing: partial.faction === "imperial" ? 1 : -1,
    alive: true,
    embarked: false,
    weaponIndex: 0,
    loaded: partial.weapons.some((w) => w.firearm),
    ready: partial.weapons.filter((w) => w.firearm).map((w) => w.id),
    stock: gear?.stock ?? {},
    armor,
    armorMax: armor,
    prayerUsed: false,
    blessing: false,
    overwatch: false,
    fate: "none",
    bob: hash01(partial.x, partial.y, 9) * Math.PI * 2,
  };
}

export function gunLoaded(unit: Unit, weapon: Weapon): boolean {
  if (!weapon.firearm) return true;
  return unit.ready.includes(weapon.id);
}

export function markLoaded(unit: Unit, id: WeaponId): void {
  if (!unit.ready.includes(id)) unit.ready.push(id);
  syncLoaded(unit);
}

export function markUnloaded(unit: Unit, id: WeaponId): void {
  unit.ready = unit.ready.filter((ready) => ready !== id);
  syncLoaded(unit);
}

export function syncLoaded(unit: Unit): void {
  const armed = unit.weapons[unit.weaponIndex];
  if (armed?.firearm) unit.loaded = unit.ready.includes(armed.id);
  else unit.loaded = unit.weapons.some((w) => w.firearm && unit.ready.includes(w.id));
}

export function armorLabel(unit: Unit): string {
  if (unit.armor >= 2) return "půlzbroj";
  if (unit.armor === 1) return "kabátec";
  if (unit.armorMax > 0) return "zbroj stržena";
  return "";
}

export function createRoster(): Unit[] {
  return [
    base({
      id: "colloredo",
      name: "Colloredo",
      title: "Maršál, bez zbraně",
      faction: "imperial",
      archetype: "colloredo",
      vip: true,
      prayer: false,
      hp: 6,
      x: 1,
      y: 4,
      weapons: [],
    }),
    base({
      id: "martin",
      name: "Martin",
      title: "Císařský dragoun",
      faction: "imperial",
      archetype: "martin",
      vip: false,
      prayer: true,
      hp: 10,
      x: 0,
      y: 3,
      weapons: [WEAPONS.pistol, WEAPONS.carbine, WEAPONS.rapier, WEAPONS.grenade],
    },
    { armor: 1, stock: { grenade: 1 } },
  ),
    base({
      id: "vaclav",
      name: "Václav",
      title: "Student z Klementina",
      faction: "imperial",
      archetype: "vaclav",
      vip: false,
      prayer: true,
      hp: 7,
      x: 0,
      y: 5,
      weapons: [WEAPONS.musket],
    }),
    base({
      id: "jakub",
      name: "Jakub",
      title: "Malostranský kovář",
      faction: "imperial",
      archetype: "jakub",
      vip: false,
      prayer: true,
      hp: 13,
      x: 1,
      y: 6,
      weapons: [WEAPONS.halberd, WEAPONS.petard],
    },
    { armor: 1, stock: { petard: 1 } },
  ),
    base({
      id: "olof",
      name: "Švédský mušketýr",
      title: "Švédský mušketýr",
      faction: "swedish",
      archetype: "musketeer",
      vip: false,
      prayer: false,
      hp: 6,
      x: 6,
      y: 0,
      weapons: [WEAPONS.swedeMusket],
    },
    { armor: 1 },
  ),
    base({
      id: "lars",
      name: "Švédský mušketýr",
      title: "Švédský mušketýr",
      faction: "swedish",
      archetype: "musketeer",
      vip: false,
      prayer: false,
      hp: 6,
      x: 7,
      y: 2,
      weapons: [WEAPONS.swedeMusket],
    },
    { armor: 1 },
  ),
    base({
      id: "erik",
      name: "Švédský pikenýr",
      title: "Švédský pikenýr",
      faction: "swedish",
      archetype: "pikeman",
      vip: false,
      prayer: false,
      hp: 10,
      x: 9,
      y: 4,
      weapons: [WEAPONS.pike],
    },
    { armor: 2 },
  ),
    base({
      id: "nils",
      name: "Švédský pikenýr",
      title: "Švédský pikenýr",
      faction: "swedish",
      archetype: "pikeman",
      vip: false,
      prayer: false,
      hp: 10,
      x: 10,
      y: 6,
      weapons: [WEAPONS.pike],
    },
    { armor: 2 },
  ),
  ];
}

export function makeSwede(
  kind: "musketeer" | "pikeman" | "grenadier",
  id: string,
  name: string,
  x: number,
  y: number,
): Unit {
  const typeName =
    name && name !== "Švéd" && !name.startsWith("Švéd ")
      ? name
      : kind === "grenadier"
        ? "Švédský granátník"
        : kind === "musketeer"
          ? "Švédský mušketýr"
          : "Švédský pikenýr";
  if (kind === "grenadier") {
    return base(
      {
        id,
        name: typeName,
        title: "Švédský granátník",
        faction: "swedish",
        archetype: "musketeer",
        vip: false,
        prayer: false,
        hp: 8,
        x,
        y,
        weapons: [WEAPONS.swedeMusket, WEAPONS.grenade],
      },
      { armor: 1, stock: { grenade: 1 } },
    );
  }
  const musket = kind === "musketeer";
  return base(
    {
      id,
      name: typeName,
      title: musket ? "Švédská posila · mušketa" : "Švédská posila · pika",
      faction: "swedish",
      archetype: musket ? "musketeer" : "pikeman",
      vip: false,
      prayer: false,
      hp: musket ? 6 : 10,
      x,
      y,
      weapons: [musket ? WEAPONS.swedeMusket : WEAPONS.pike],
    },
    { armor: musket ? 1 : 2 },
  );
}

export function createSim(seed = SEED): Sim {
  const tiles = createTiles();
  const units = createRoster();
  for (const u of units) {
    const tile = at(tiles, u.x, u.y);
    if (!tile || tile === "wall" || tile === "river") {
      throw new Error(`Špatné pole pro ${u.id}: ${u.x},${u.y}`);
    }
  }
  return {
    tiles,
    units,
    smokes: [],
    decals: [],
    clock: 0,
    phase: "briefing",
    turn: "player",
    round: 1,
    holdLeft: 0,
    seq: 1,
    kills: 0,
    log: [],
    rng: mulberry32(seed),
    pendingEnd: null,
    nameBag: ["Sven", "Gustaf", "Anders", "Per", "Karl", "Bengt"],
  };
}

export function unitById(sim: Sim, id: string | null): Unit | null {
  if (!id) return null;
  return sim.units.find((u) => u.id === id) ?? null;
}

export function living(units: Unit[]): Unit[] {
  return units.filter((u) => u.alive && !u.embarked);
}

export function hasDefender(sim: Sim): boolean {
  return sim.units.some(
    (u) => u.faction === "imperial" && !u.vip && u.alive && !u.embarked,
  );
}

export function hasHope(sim: Sim): boolean {
  return sim.units.some((u) => u.faction === "imperial" && !u.vip && u.alive);
}

export function pushLog(sim: Sim, line: string): void {
  sim.log.push(line);
  if (sim.log.length > 48) sim.log.shift();
}
