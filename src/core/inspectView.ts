/**
 * Úplný přehled (F1 / 0) — čistý popis jednotky, kontaktu v šerosvitu nebo terénu.
 * Bez Reactu a bez Three.js. UI jen vykreslí vrácený pohled.
 */

import { contactPhrase, doorLabel, text } from "../i18n/runtime";
import { getTileVisibility } from "./FogOfWar";
import { bestTileCover, sameCoord } from "./GridSystem";
import type {
  CardinalDir,
  CoverLevel,
  DoorData,
  Faction,
  FirearmLockType,
  FloorLevel,
  FogOfWarSnapshot,
  FogVisibilityState,
  GridCoord,
  MeleeWeaponStats,
  ObstacleType,
  SoundContact,
  SoundContactKind,
  StairType,
  StatModifier,
  TileData,
  UnitArchetype,
  UnitData,
  WeaponStats,
} from "./types";

export type InspectPin =
  | null
  | { kind: "unit"; id: string }
  | { kind: "tile"; coord: GridCoord };

export type InspectActionMode = "move" | "shoot" | "grenade" | "melee" | "reload";

export interface InspectLabeledValue {
  label: string;
  value: string;
}

export interface InspectCombatMath {
  mode: "shot" | "melee";
  targetId: string;
  hitChance: number;
  critChance: number;
  minDamage: number;
  maxDamage: number;
  misfireChance?: number;
  armorPierce: number;
  armorShred: number;
  hitModifiers: StatModifier[];
  critModifiers: StatModifier[];
}

export interface InspectContext {
  units: readonly UnitData[];
  tileAt: (coord: GridCoord) => TileData | undefined;
  doorAt: (coord: GridCoord) => DoorData | undefined;
  fog: FogOfWarSnapshot;
  fogOfWarEnabled: boolean;
  pin: InspectPin;
  actionMode: InspectActionMode;
  selectedUnitId: string | null;
  selectedTargetId: string | null;
  activeCombat: InspectCombatMath | null;
}

export interface InspectUnitView {
  kind: "unit";
  tone: "amber" | "crimson";
  title: string;
  name: string;
  roleTitle: string;
  factionLine: string;
  faction: Faction;
  archetype: UnitArchetype;
  isVip: boolean;
  alive: boolean;
  detained: boolean;
  place: string;
  facing: string;
  bestCover: CoverLevel;
  stats: InspectLabeledValue[];
  conditions: string[];
  firearmName: string;
  firearm: InspectLabeledValue[];
  meleeName: string | null;
  melee: InspectLabeledValue[];
  ability: {
    name: string;
    subtitle: string;
    description: string;
    meta: string;
  } | null;
  passive: string | null;
  combat: {
    mode: "shot" | "melee";
    title: string;
    hitChance: number;
    critChance: number;
    damage: string;
    misfire: string | null;
    pierce: string;
    hitModifiers: StatModifier[];
    critModifiers: StatModifier[];
    metrics: InspectLabeledValue[];
  } | null;
}

export interface InspectContactView {
  kind: "contact";
  tone: "amber";
  title: string;
  headline: string;
  detail: string;
  distance: string | null;
}

export interface InspectTerrainView {
  kind: "terrain";
  tone: "stone";
  title: string;
  censored: boolean;
  summary: string;
  lines: InspectLabeledValue[];
  cover: { dir: CardinalDir; level: CoverLevel; label: string }[] | null;
  occupant: string | null;
}

export interface InspectEmptyView {
  kind: "empty";
  tone: "stone";
  title: string;
  detail: string;
}

export type InspectView =
  | InspectUnitView
  | InspectContactView
  | InspectTerrainView
  | InspectEmptyView;

function coverLabel(level: CoverLevel): string {
  return text(`inspect.cover.${level}`);
}

function facingLabel(dir: CardinalDir): string {
  return text(`inspect.dir.${dir}`);
}

function lockLabel(lock: FirearmLockType): string {
  return text(`inspect.lock.${lock}`);
}

function meleeKindLabel(kind: MeleeWeaponStats["kind"]): string {
  return text(`inspect.meleeKind.${kind}`);
}

function surfaceLabel(surface: TileData["surface"]): string {
  return text(`inspect.surface.${surface}`);
}

function obstacleLabel(obstacle: ObstacleType): string {
  return text(`inspect.obstacle.${obstacle}`);
}

function stairLabel(stair: StairType): string {
  return text(`inspect.stair.${stair}`);
}

function floorLabel(floor: FloorLevel): string {
  return text(`inspect.floor.${floor}`);
}

function contactDetail(kind: SoundContactKind): string {
  if (kind === "matchcord_glow") return text("contact.matchcord.detail");
  if (kind === "footsteps") return text("contact.footsteps.detail");
  return text("contact.gunfire.detail");
}

export function buildInspectView(ctx: InspectContext): InspectView {
  if (ctx.pin?.kind === "tile") {
    return buildTerrain(ctx, ctx.pin.coord);
  }

  const unitId =
    ctx.pin?.kind === "unit"
      ? ctx.pin.id
      : followUnitId(ctx);

  if (!unitId) return emptyView();

  const unit = ctx.units.find((u) => u.id === unitId);
  if (!unit) return emptyView();

  if (unit.faction === "enemy" && !enemyIsRevealed(ctx, unit.id)) {
    return buildContact(ctx, unit);
  }

  return buildUnit(ctx, unit);
}

function followUnitId(ctx: InspectContext): string | null {
  const aiming = ctx.actionMode === "shoot" || ctx.actionMode === "melee";
  if (aiming && ctx.selectedTargetId) return ctx.selectedTargetId;
  return ctx.selectedUnitId;
}

function enemyIsRevealed(ctx: InspectContext, unitId: string): boolean {
  if (!ctx.fogOfWarEnabled) return true;
  return ctx.fog.visibleEnemyIds.has(unitId);
}

function emptyView(): InspectEmptyView {
  return {
    kind: "empty",
    tone: "stone",
    title: text("inspect.none.title"),
    detail: text("inspect.none.detail"),
  };
}

function buildContact(ctx: InspectContext, unit: UnitData): InspectContactView {
  const contact = ctx.fog.soundContacts.find((c) => c.unitId === unit.id) ?? null;
  const kind = contact?.kind ?? "matchcord_glow";
  return {
    kind: "contact",
    tone: "amber",
    title: text("inspect.contact.title"),
    headline: contact ? text(contactPhrase(kind).id) : text("contact.hidden"),
    detail: contact ? contactDetail(contact.kind) : text("inspect.contact.silent"),
    distance: contact ? formatDistance(contact) : null,
  };
}

function formatDistance(contact: SoundContact): string {
  return text("inspect.contact.distance", { distance: contact.distanceToNearestAlly });
}

function buildUnit(ctx: InspectContext, unit: UnitData): InspectUnitView {
  const tile = ctx.tileAt(unit.pos);
  const detained = (unit.detainedTurns ?? 0) > 0;
  const damage = ctx.activeCombat
    ? `${ctx.activeCombat.minDamage}–${ctx.activeCombat.maxDamage} HP`
    : "";
  const misfire =
    ctx.activeCombat?.mode === "shot" ? `${ctx.activeCombat.misfireChance ?? 0} %` : null;
  const metrics: InspectLabeledValue[] = ctx.activeCombat
    ? [
        { label: text("inspect.combat.hit"), value: `${ctx.activeCombat.hitChance} %` },
        { label: text("inspect.combat.crit"), value: `${ctx.activeCombat.critChance} %` },
        { label: text("inspect.combat.wound"), value: damage },
      ]
    : [];
  if (ctx.activeCombat && misfire) {
    metrics.push({ label: text("inspect.combat.misfire"), value: misfire });
  }
  const combat =
    ctx.activeCombat && ctx.activeCombat.targetId === unit.id
      ? {
          mode: ctx.activeCombat.mode,
          title:
            ctx.activeCombat.mode === "shot"
              ? text("inspect.combat.shotTitle")
              : text("inspect.combat.meleeTitle"),
          hitChance: ctx.activeCombat.hitChance,
          critChance: ctx.activeCombat.critChance,
          damage,
          misfire,
          pierce: text("inspect.combat.pierceLine", {
            count: ctx.activeCombat.armorPierce,
            shred: ctx.activeCombat.armorShred,
          }),
          hitModifiers: ctx.activeCombat.hitModifiers,
          critModifiers: ctx.activeCombat.critModifiers,
          metrics,
        }
      : null;

  return {
    kind: "unit",
    tone: unit.faction === "enemy" ? "crimson" : "amber",
    title: unit.faction === "enemy" ? text("inspect.unit.enemy") : text("inspect.unit.player"),
    name: unit.name,
    roleTitle: unit.roleTitle,
    factionLine: unit.faction === "enemy" ? text("inspect.faction.enemy") : text("inspect.faction.player"),
    faction: unit.faction,
    archetype: unit.archetype,
    isVip: Boolean(unit.isVip),
    alive: unit.alive,
    detained,
    place: `${floorLabel(unit.pos.y)} · ${unit.pos.x}, ${unit.pos.z}`,
    facing: facingLabel(unit.facing),
    bestCover: tile ? bestTileCover(tile.cover) : "none",
    stats: unitStats(unit),
    conditions: unitConditions(unit),
    firearmName: unit.weapon.name,
    firearm: firearmLines(unit),
    meleeName: unit.meleeWeapon?.name ?? null,
    melee: unit.meleeWeapon ? meleeLines(unit.meleeWeapon) : [],
    ability: unit.ability
      ? {
          name: unit.ability.name,
          subtitle: unit.ability.subtitle,
          description: unit.ability.description,
          meta: text("inspect.ability.meta", {
            count: unit.ability.apCost,
            required: unit.ability.cooldownTurns,
            progress: unit.ability.currentCooldown,
          }),
        }
      : null,
    passive: unit.buffTitle ?? null,
    combat,
  };
}

function unitStats(unit: UnitData): InspectLabeledValue[] {
  return [
    { label: text("inspect.stat.hp"), value: `${unit.hp}/${unit.maxHp}` },
    { label: text("inspect.stat.armor"), value: `${unit.armor}/${unit.maxArmor}` },
    { label: text("inspect.stat.ap"), value: `${unit.ap}/${unit.maxAp}` },
    { label: text("inspect.stat.aim"), value: `${unit.marksmanship} %` },
    { label: text("inspect.stat.move"), value: text("inspect.moveValue", { count: unit.movePerAp }) },
    { label: text("inspect.stat.grenades"), value: String(unit.grenades) },
  ];
}

function unitConditions(unit: UnitData): string[] {
  const chips: string[] = [];
  if (!unit.alive) {
    chips.push(text("inspect.cond.dead"));
  } else if (unit.inDeathThroes || unit.hp <= 0) {
    chips.push(text("inspect.cond.throes"));
    chips.push(text("inspect.cond.overkill", { hp: -(unit.maxHp + 1) }));
  }
  if ((unit.detainedTurns ?? 0) > 0) {
    const reason = captureLabel(unit.captureReason);
    chips.push(
      text("inspect.cond.detained", {
        progress: unit.detainedTurns ?? 0,
        names: reason ?? undefined,
      }),
    );
  }
  if (unit.isVip) chips.push(text("inspect.cond.vip"));
  if (unit.isShaken) chips.push(text("inspect.cond.shaken"));
  if (unit.isOverwatch) chips.push(text("inspect.cond.overwatch"));
  if (unit.movedThisTurn) chips.push(text("inspect.cond.moved"));
  if (unit.buffTitle) chips.push(unit.buffTitle);
  if (unit.id === "player-colloredo") {
    chips.push(
      unit.pistolLoaded === false
        ? text("inspect.cond.pistolEmpty")
        : text("inspect.cond.pistolLoaded"),
    );
  } else if (unit.firearmLoaded === false) {
    const cost = unit.weapon.reloadApCost ?? 2;
    chips.push(
      text("inspect.cond.reloading", {
        progress: unit.reloadProgress ?? 0,
        required: cost,
      }),
    );
  }
  return chips;
}

function captureLabel(reason: UnitData["captureReason"]): string | null {
  if (reason === "zero_hp") return text("inspect.capture.zero");
  if (reason === "surrounded_unprotected") return text("inspect.capture.surrounded");
  if (reason === "all_companions_fallen") return text("inspect.capture.fallen");
  return null;
}

function firearmLines(unit: UnitData): InspectLabeledValue[] {
  const weapon = unit.weapon;
  const lines: InspectLabeledValue[] = [
    { label: text("inspect.weapon.lock"), value: lockLabel(weapon.lockType) },
    { label: text("inspect.weapon.damage"), value: `${weapon.minDamage}–${weapon.maxDamage} HP` },
    {
      label: text("inspect.weapon.critBonus"),
      value: critBonusLabel(weapon),
    },
    { label: text("inspect.weapon.baseCrit"), value: `${weapon.baseCritChance} %` },
    { label: text("inspect.weapon.baseAim"), value: `${weapon.baseAccuracy} %` },
    { label: text("inspect.weapon.pointBlank"), value: text("inspect.tiles", { count: weapon.pointBlankRange }) },
    { label: text("inspect.weapon.optimal"), value: text("inspect.tiles", { count: weapon.optimalRange }) },
    { label: text("inspect.weapon.max"), value: text("inspect.tiles", { count: weapon.maxRange }) },
    {
      label: text("inspect.weapon.falloff"),
      value: text("inspect.weapon.falloffValue", { count: weapon.falloffPerTile }),
    },
    { label: text("inspect.weapon.pierce"), value: String(weapon.armorPierce) },
    { label: text("inspect.weapon.shred"), value: String(weapon.armorShred) },
    { label: text("inspect.weapon.misfire"), value: `${weapon.baseMisfireChance} %` },
    {
      label: text("inspect.weapon.fork"),
      value: weapon.supportsRestFork ? text("inspect.yes") : text("inspect.no"),
    },
    { label: text("inspect.weapon.fireCost"), value: `${weapon.fireApCost ?? 1} AP` },
    { label: text("inspect.weapon.reload"), value: `${weapon.reloadApCost ?? 2} AP` },
    {
      label: text("inspect.weapon.mobility"),
      value:
        unit.id === "player-colloredo"
          ? text("inspect.weapon.limpOverrides")
          : text("inspect.tiles", { count: weapon.mobilityPenalty ?? 0 }),
    },
    {
      label: text("inspect.weapon.overwatch"),
      value:
        weapon.overwatchMode === "prepared_volley_cone"
          ? text("inspect.weapon.cone")
          : text("inspect.weapon.circle"),
    },
  ];

  if (weapon.allowEmergencyHipFire) {
    lines.push({
      label: text("inspect.weapon.hipLabel"),
      value: text("inspect.weapon.hip", { count: weapon.hipFireAimPenalty ?? 35 }),
    });
  }

  return lines;
}

function critBonusLabel(weapon: WeaponStats): string {
  if (weapon.critBonusMaxDamage != null && weapon.critBonusMaxDamage !== weapon.critBonusDamage) {
    return `+${weapon.critBonusDamage}–${weapon.critBonusMaxDamage} HP`;
  }
  return `+${weapon.critBonusDamage} HP`;
}

function meleeLines(weapon: MeleeWeaponStats): InspectLabeledValue[] {
  const lines: InspectLabeledValue[] = [
    { label: text("inspect.melee.kind"), value: meleeKindLabel(weapon.kind) },
    { label: text("inspect.weapon.damage"), value: `${weapon.minDamage}–${weapon.maxDamage} HP` },
    { label: text("inspect.weapon.critBonus"), value: `+${weapon.critBonusDamage} HP` },
    { label: text("inspect.weapon.baseCrit"), value: `${weapon.baseCritChance} %` },
    { label: text("inspect.melee.accuracy"), value: `${weapon.baseAccuracy} %` },
    { label: text("inspect.weapon.pierce"), value: String(weapon.armorPierce) },
    { label: text("inspect.weapon.shred"), value: String(weapon.armorShred) },
    { label: text("inspect.melee.desc"), value: weapon.description },
  ];
  if (weapon.stunChance != null) {
    lines.push({ label: text("inspect.melee.stun"), value: `${weapon.stunChance} %` });
  }
  if (weapon.spillsReloadOnStrike) {
    lines.push({ label: text("inspect.weapon.reload"), value: text("inspect.melee.spill") });
  }
  return lines;
}

function buildTerrain(ctx: InspectContext, coord: GridCoord): InspectTerrainView {
  const visibility = getTileVisibility(coord, ctx.fog, ctx.fogOfWarEnabled);
  if (visibility === "unexplored") {
    return {
      kind: "terrain",
      tone: "stone",
      title: text("inspect.unexplored.title"),
      censored: true,
      summary: text("inspect.unexplored.summary"),
      lines: [],
      cover: null,
      occupant: null,
    };
  }

  const tile = ctx.tileAt(coord);
  if (!tile) {
    return {
      kind: "terrain",
      tone: "stone",
      title: text("inspect.empty.title"),
      censored: false,
      summary: text("inspect.empty.summary"),
      lines: [{ label: text("inspect.line.coord"), value: coordLabel(coord) }],
      cover: null,
      occupant: null,
    };
  }

  const door = ctx.doorAt(coord) ?? null;
  const title = terrainTitle(tile, door);
  const lines: InspectLabeledValue[] = [
    { label: text("inspect.line.coord"), value: coordLabel(coord) },
    { label: text("inspect.line.floor"), value: floorLabel(tile.coord.y) },
    { label: text("inspect.line.surface"), value: surfaceLabel(tile.surface) },
    { label: text("inspect.line.move"), value: tile.walkable ? text("inspect.walkable") : text("inspect.blocked") },
    { label: text("inspect.line.flooring"), value: tile.hasFloor ? text("inspect.yes") : text("inspect.no") },
    {
      label: text("inspect.line.damage"),
      value: damageLabel(tile.damageLevel ?? 0),
    },
    {
      label: text("inspect.line.smoke"),
      value: tile.smokeTurns > 0 ? text("inspect.smokeTurns", { count: tile.smokeTurns }) : text("inspect.smokeNone"),
    },
    {
      label: text("inspect.line.escape"),
      value: tile.isEscapeZone ? text("inspect.escape.yes") : text("inspect.no"),
    },
  ];

  if (tile.obstacle !== "none") {
    lines.push({ label: text("inspect.line.obstacle"), value: obstacleLabel(tile.obstacle) });
  }
  if (tile.obstacle === "powder_keg") {
    lines.push({
      label: text("inspect.line.blast"),
      value: text("inspect.blastValue"),
    });
  }

  const stair = tile.stairType ?? (tile.isLadder ? "ladder" : "none");
  if (stair !== "none") {
    lines.push({ label: text("inspect.line.stairs"), value: stairLabel(stair) });
    if (tile.stairDir) {
      lines.push({ label: text("inspect.line.stairDir"), value: facingLabel(tile.stairDir) });
    }
    if (tile.stairConnections && tile.stairConnections.length > 0) {
      lines.push({
        label: text("inspect.line.stairLink"),
        value: tile.stairConnections.map((floor) => `P${floor}`).join(", "),
      });
    }
  }

  if (door) {
    lines.push(
      { label: text("inspect.line.door"), value: doorLabel(door.id) },
      {
        label: text("inspect.line.doorState"),
        value: door.state === "open" ? text("inspect.door.open") : text("inspect.door.closed"),
      },
      {
        label: text("inspect.line.axis"),
        value: door.axis === "E_W" ? text("inspect.axis.ew") : text("inspect.axis.ns"),
      },
      {
        label: text("inspect.line.leaves"),
        value: door.isDoubleLeaf ? text("inspect.leaves.double") : text("inspect.leaves.single"),
      },
    );
  }

  return {
    kind: "terrain",
    tone: "stone",
    title,
    censored: false,
    summary: visibilitySummary(visibility),
    lines,
    cover: (["N", "E", "S", "W"] as const).map((dir) => ({
      dir,
      level: tile.cover[dir],
      label: coverLabel(tile.cover[dir]),
    })),
    occupant: terrainOccupant(ctx, coord, visibility),
  };
}

function terrainTitle(tile: TileData, door: DoorData | null): string {
  if (door) return doorLabel(door.id);
  if (tile.obstacle === "powder_keg") return text("inspect.obstacle.powder_keg");
  if (tile.obstacle !== "none") return obstacleLabel(tile.obstacle);
  const stair = tile.stairType ?? (tile.isLadder ? "ladder" : "none");
  if (stair !== "none") return stairLabel(stair);
  return surfaceLabel(tile.surface);
}

function terrainOccupant(
  ctx: InspectContext,
  coord: GridCoord,
  visibility: FogVisibilityState,
): string | null {
  if (visibility !== "visible") return null;
  const occupant = ctx.units.find((unit) => unit.alive && sameCoord(unit.pos, coord));
  if (!occupant) return null;
  if (occupant.faction === "enemy" && !enemyIsRevealed(ctx, occupant.id)) return null;
  return occupant.name;
}

function visibilitySummary(visibility: FogVisibilityState): string {
  if (visibility === "shrouded") return text("inspect.shrouded");
  return text("inspect.visible");
}

function damageLabel(level: 0 | 1 | 2): string {
  return text(`inspect.damage.${level}`);
}

function coordLabel(coord: GridCoord): string {
  return `${coord.x}, ${coord.y}, ${coord.z}`;
}
