import {
  endTurnInfo,
  firearm,
  hradbaInfo,
  objectiveLine,
  phaseLabel,
  prayerInfo,
  reloadInfo,
  rozkazInfo,
  sailInfo,
} from "./orders";
import type { Epilogue, HudUnit, Sim, Snapshot, UiState, Unit } from "./types";
import { armorLabel, gunLoaded } from "./units";

function weaponButtonLabel(unit: Unit, w: Unit["weapons"][number]): string {
  if (unit.stock[w.id] !== undefined) return `${w.short} · ${unit.stock[w.id]}`;
  if (w.firearm && !gunLoaded(unit, w)) return `${w.short} · vybitá`;
  return w.short;
}

function statusOf(unit: Unit): string {
  if (unit.embarked) return "Na loďce";
  if (!unit.alive) return "Padl";
  const bits: string[] = [];
  if (unit.overwatch) bits.push("Hradba");
  if (unit.blessing) bits.push("Požehnán");
  const plate = armorLabel(unit);
  if (plate) bits.push(plate);
  const armed = unit.weapons[unit.weaponIndex];
  if (armed?.firearm) {
    bits.push(gunLoaded(unit, armed) ? `${armed.short} nabitá` : `${armed.short} vybitá`);
  } else if (armed) {
    const left = unit.stock[armed.id];
    bits.push(left !== undefined ? `${armed.short} (${left})` : armed.short);
  } else {
    bits.push("Beze zbraně");
  }
  return bits.join(" · ");
}

function hud(unit: Unit): HudUnit {
  const gun = firearm(unit);
  return {
    id: unit.id,
    name: unit.name,
    title: unit.title,
    faction: unit.faction,
    archetype: unit.archetype,
    hp: unit.hp,
    maxHp: unit.maxHp,
    ap: unit.ap,
    maxAp: unit.maxAp,
    armor: unit.armor,
    armorMax: unit.armorMax,
    x: unit.x,
    y: unit.y,
    alive: unit.alive,
    embarked: unit.embarked,
    vip: unit.vip,
    loaded: gun ? gunLoaded(unit, gun) : null,
    blessing: unit.blessing,
    overwatch: unit.overwatch,
    prayerUsed: unit.prayerUsed,
    weapons: unit.weapons.map((w, i) => ({
      id: w.id,
      name: weaponButtonLabel(unit, w),
      active: unit.weaponIndex === i,
    })),
    status: statusOf(unit),
  };
}

export function project(sim: Sim, ui: UiState, epilogue: Epilogue | null): Snapshot {
  const selected = sim.units.find((u) => u.id === ui.selectedId) ?? null;
  const weaponButtons =
    selected && selected.faction === "imperial" && selected.weapons.length > 1
      ? selected.weapons.map((w, i) => ({
          id: w.id,
          name: weaponButtonLabel(selected, w),
          active: selected.weaponIndex === i,
        }))
      : [];
  const sail = sailInfo(sim, ui.selectedId, ui.busy);
  return {
    phase: sim.phase,
    phaseLabel: phaseLabel(sim),
    objective: objectiveLine(sim),
    round: sim.round,
    turn: sim.turn,
    holdLeft: sim.phase === "hold" ? sim.holdLeft : null,
    busy: ui.busy,
    muted: ui.muted,
    actionCamEnabled: ui.actionCamEnabled,
    cameraPreset: ui.cameraPreset,
    lightingMood: ui.lightingMood,
    banner: ui.banner,
    mode: ui.mode,
    selectedId: ui.selectedId,
    hoverText: ui.hoverText,
    hoverTile: ui.hoverTile,
    aimPreview: ui.aimPreview,
    movePreview: ui.movePreview,
    log: sim.log.slice(-12),
    units: sim.units.map(hud),
    enemiesAlive: sim.units.filter((u) => u.faction === "swedish" && u.alive).length,
    reload: reloadInfo(sim, ui.selectedId, ui.busy),
    prayer: prayerInfo(sim, ui.selectedId, ui.busy),
    rozkaz: rozkazInfo(sim, ui.selectedId, ui.busy, ui.mode),
    hradba: hradbaInfo(sim, ui.selectedId, ui.busy),
    sail: { visible: sail.visible, enabled: sail.enabled, label: sail.label },
    endTurn: endTurnInfo(sim, ui.busy),
    weaponButtons,
    epilogue,
  };
}
