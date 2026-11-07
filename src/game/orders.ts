import { PRAYER_HEAL } from "./config";
import { at } from "./map";
import type { ActionBtn, Sim, Unit } from "./types";
import { unitById, gunLoaded } from "./units";

const HIDDEN: ActionBtn = { visible: false, enabled: false, label: "" };

function ready(sim: Sim, busy: boolean): boolean {
  return (
    !busy &&
    sim.turn === "player" &&
    (sim.phase === "flight" || sim.phase === "dock" || sim.phase === "hold") &&
    sim.pendingEnd == null
  );
}

export function pole(n: number): string {
  if (n === 1) return "1 pole";
  if (n >= 2 && n <= 4) return `${n} pole`;
  return `${n} polí`;
}

export function instrumental(unit: Unit): string {
  if (unit.id === "martin") return "Martinem";
  if (unit.id === "vaclav") return "Václavem";
  if (unit.id === "jakub") return "Jakubem";
  return unit.name;
}

export function firearm(unit: Unit | null) {
  if (!unit) return null;
  const armed = unit.weapons[unit.weaponIndex];
  if (armed?.firearm && !gunLoaded(unit, armed)) return armed;
  const guns = unit.weapons.filter((w) => w.firearm);
  const unloaded = guns.find((w) => !gunLoaded(unit, w));
  if (unloaded) return unloaded;
  if (armed?.firearm) return armed;
  return guns[0] ?? null;
}

export function reloadInfo(sim: Sim, id: string | null, busy: boolean): ActionBtn {
  const unit = unitById(sim, id);
  const gun = firearm(unit);
  if (!unit || unit.faction !== "imperial" || !gun) return HIDDEN;
  const cost = gun.reloadAp;
  const loaded = gunLoaded(unit, gun);
  return {
    visible: true,
    enabled: ready(sim, busy) && unit.alive && !unit.embarked && !loaded && unit.ap >= cost,
    label: loaded ? `${gun.short} je nabitá` : `Nabít ${gun.short} · ${cost === 1 ? "1 AP" : `${cost} AP`}`,
  };
}

export function prayerInfo(sim: Sim, id: string | null, busy: boolean): ActionBtn {
  const unit = unitById(sim, id);
  if (!unit?.prayer || unit.faction !== "imperial") return HIDDEN;
  return {
    visible: true,
    enabled: ready(sim, busy) && unit.alive && !unit.embarked && !unit.prayerUsed,
    label: unit.prayerUsed ? "Modlitba už zazněla" : "Ježíši, Maria, pomoz!",
  };
}

export function hradbaInfo(sim: Sim, id: string | null, busy: boolean): ActionBtn {
  const unit = unitById(sim, id);
  if (!unit || unit.archetype !== "jakub") return HIDDEN;
  return {
    visible: true,
    enabled:
      ready(sim, busy) && unit.alive && !unit.embarked && !unit.overwatch && unit.ap >= 1,
    label: unit.overwatch ? "Hradba stojí" : "Hradba · 1 AP",
  };
}

export function rozkazInfo(sim: Sim, id: string | null, busy: boolean, mode: "normal" | "rozkaz"): ActionBtn {
  const unit = unitById(sim, id);
  if (!unit?.vip) return HIDDEN;
  const on = mode === "rozkaz";
  return {
    visible: true,
    enabled: ready(sim, busy) && unit.alive && !unit.embarked && unit.ap >= 1,
    label: on ? "Zvolte spojence" : "Rozkaz · 1 AP",
  };
}

export function sailInfo(
  sim: Sim,
  selectedId: string | null,
  busy: boolean,
): ActionBtn & { hero: Unit | null } {
  if (sim.phase !== "dock") return { ...HIDDEN, hero: null };
  const col = sim.units.find((u) => u.vip);
  const onBoat =
    !!col && col.alive && !col.embarked && at(sim.tiles, col.x, col.y) === "boat";
  const cands = sim.units.filter(
    (u) =>
      !u.vip &&
      u.faction === "imperial" &&
      u.alive &&
      !u.embarked &&
      at(sim.tiles, u.x, u.y) === "quay",
  );
  if (!onBoat) {
    return { visible: true, enabled: false, label: "Colloredo není na loďce", hero: null };
  }
  if (cands.length === 0) {
    return {
      visible: true,
      enabled: false,
      label: "Přiveďte hrdinu na nábřeží",
      hero: null,
    };
  }
  const chosen = cands.find((c) => c.id === selectedId) ?? cands[0] ?? null;
  if (!chosen) {
    return { visible: true, enabled: false, label: "Přiveďte hrdinu na nábřeží", hero: null };
  }
  return {
    visible: true,
    enabled: ready(sim, busy),
    label: `Odplout s ${instrumental(chosen)}`,
    hero: chosen,
  };
}

export function endTurnInfo(sim: Sim, busy: boolean): ActionBtn {
  const visible = sim.phase === "flight" || sim.phase === "dock" || sim.phase === "hold";
  if (!visible) return HIDDEN;
  if (sim.turn === "enemy") {
    return { visible: true, enabled: false, label: "Švédové jednají…" };
  }
  return {
    visible: true,
    enabled: ready(sim, busy),
    label: busy ? "Provedení…" : "Ukončit tah",
  };
}

export function objectiveLine(sim: Sim): string {
  if (sim.phase === "briefing") return "Noc ještě nezačala.";
  if (sim.turn === "enemy") return "Švédové jednají — klepněte na mapu, ať se tah zrychlí.";
  if (sim.phase === "flight") return "Doveďte Colloreda živého na loďku u Vltavy.";
  if (sim.phase === "dock") return "Jeden hrdina na nábřeží. Ostatní dva zůstanou ve tmě.";
  if (sim.phase === "hold") {
    const n = sim.holdLeft;
    const word = n === 1 ? "náraz" : n >= 2 && n <= 4 ? "nárazy" : "nárazů";
    return `Udržte břeh. Loďka se odváže po ${n} ${word}.`;
  }
  return "";
}

export function phaseLabel(sim: Sim): string {
  switch (sim.phase) {
    case "briefing":
      return "Před útokem";
    case "flight":
      return "Útěk uličkami";
    case "dock":
      return "U loďky";
    case "hold":
      return "Poslední vzdor";
    case "victory":
      return "Odpluto";
    case "defeat":
      return "Pád";
  }
}

export function healAmount(unit: Unit): number {
  return Math.min(PRAYER_HEAL, unit.maxHp - unit.hp);
}
