/**
 * Úplný přehled (F1 / 0) — čistý popis jednotky, kontaktu v šerosvitu nebo terénu.
 * Bez Reactu a bez Three.js. UI jen vykreslí vrácený pohled.
 */

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

const COVER_LABEL: Record<CoverLevel, string> = {
  none: "Žádný",
  half: "Poloviční",
  full: "Plný",
};

const FACING_LABEL: Record<CardinalDir, string> = {
  N: "Sever",
  E: "Východ",
  S: "Jih",
  W: "Západ",
};

const LOCK_LABEL: Record<FirearmLockType, string> = {
  matchlock: "Doutnákový zámek",
  wheellock: "Kolečkový zámek",
  artillery: "Dělostřelectvo",
};

const MELEE_KIND: Record<MeleeWeaponStats["kind"], string> = {
  sword: "Meč",
  dagger: "Dýka",
  polearm: "Sudlice",
  pistol_butt: "Pažba pistole",
  musket_butt: "Pažba muškety",
  fist: "Pěst",
};

const SURFACE_LABEL: Record<TileData["surface"], string> = {
  cobble: "Dlážděná ulice",
  stone_floor: "Kamenná podlaha",
  palace_carpet: "Palácový koberec",
  wood_roof: "Dřevěná střecha",
  rubble: "Suť",
  scorched_ruin: "Ohořelá ruina",
  water: "Voda Čertovky",
  wood_dock: "Dřevěné molo",
};

const OBSTACLE_LABEL: Record<ObstacleType, string> = {
  none: "Žádná",
  low_wall: "Nízká zídka",
  high_wall: "Vysoká zeď",
  pillar: "Pilíř",
  powder_keg: "Prachový sud",
};

const STAIR_LABEL: Record<StairType, string> = {
  none: "Žádné",
  straight_stairs: "Přímé schodiště",
  spiral_stairs: "Točité schodiště",
  ladder: "Žebřík",
  grand_stairs: "Monumentální schodiště",
};

const CONTACT_DETAIL: Record<SoundContactKind, string> = {
  matchcord_glow: "Žhnoucí doutnák doutnákové muškety. Postava sama zůstává skrytá.",
  footsteps: "Kroky a cinkot kyrysu ve tmě. Postava sama zůstává skrytá.",
  gunfire_flash: "Záblesk pánvičky. Postava sama zůstává skrytá.",
};

const FLOOR_LABEL: Record<FloorLevel, string> = {
  0: "Přízemí (P0)",
  1: "Piano Nobile (P1)",
  2: "Maltézská věž (P2)",
};

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
    title: "Žádný výběr",
    detail: "Vyberte vojáka, nebo podržte F1 či 0 a klepněte na postavu, dveře nebo terén.",
  };
}

function buildContact(ctx: InspectContext, unit: UnitData): InspectContactView {
  const contact = ctx.fog.soundContacts.find((c) => c.unitId === unit.id) ?? null;
  return {
    kind: "contact",
    tone: "amber",
    title: "Kontakt v šerosvitu",
    headline: contact?.label ?? "Skryto v šerosvitu",
    detail: contact
      ? CONTACT_DETAIL[contact.kind]
      : "Žádný doutnák, krok ani záblesk. Podrobnosti zůstávají skryté.",
    distance: contact ? formatDistance(contact) : null,
  };
}

function formatDistance(contact: SoundContact): string {
  const tiles = contact.distanceToNearestAlly;
  const rounded = Number.isInteger(tiles) ? String(tiles) : tiles.toFixed(1);
  return `${rounded} polí od nejbližšího obránce`;
}

function buildUnit(ctx: InspectContext, unit: UnitData): InspectUnitView {
  const tile = ctx.tileAt(unit.pos);
  const detained = (unit.detainedTurns ?? 0) > 0;
  const combat =
    ctx.activeCombat && ctx.activeCombat.targetId === unit.id
      ? {
          mode: ctx.activeCombat.mode,
          title: ctx.activeCombat.mode === "shot" ? "Výstřel na tento cíl" : "Úder na tento cíl",
          hitChance: ctx.activeCombat.hitChance,
          critChance: ctx.activeCombat.critChance,
          damage: `${ctx.activeCombat.minDamage}–${ctx.activeCombat.maxDamage} HP`,
          misfire:
            ctx.activeCombat.mode === "shot"
              ? `${ctx.activeCombat.misfireChance ?? 0} %`
              : null,
          pierce: `průraz ${ctx.activeCombat.armorPierce} · stržení ${ctx.activeCombat.armorShred}`,
          hitModifiers: ctx.activeCombat.hitModifiers,
          critModifiers: ctx.activeCombat.critModifiers,
        }
      : null;

  return {
    kind: "unit",
    tone: unit.faction === "enemy" ? "crimson" : "amber",
    title: unit.faction === "enemy" ? "Přehled nepřítele" : "Přehled obránce",
    name: unit.name,
    roleTitle: unit.roleTitle,
    factionLine: unit.faction === "enemy" ? "Švédská hlídka" : "Obránce Prahy",
    faction: unit.faction,
    archetype: unit.archetype,
    isVip: Boolean(unit.isVip),
    alive: unit.alive,
    detained,
    place: `${FLOOR_LABEL[unit.pos.y]} · ${unit.pos.x}, ${unit.pos.z}`,
    facing: FACING_LABEL[unit.facing],
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
          meta: `Cena ${unit.ability.apCost} AP · obnovení ${unit.ability.cooldownTurns} kol · zbývá ${unit.ability.currentCooldown}`,
        }
      : null,
    passive: unit.buffTitle ?? null,
    combat,
  };
}

function unitStats(unit: UnitData): InspectLabeledValue[] {
  return [
    { label: "Zdraví", value: `${unit.hp}/${unit.maxHp}` },
    { label: "Zbroj", value: `${unit.armor}/${unit.maxArmor}` },
    { label: "Akční body", value: `${unit.ap}/${unit.maxAp}` },
    { label: "Muška", value: `${unit.marksmanship} %` },
    { label: "Pohyb", value: `${unit.movePerAp} polí / AP` },
    { label: "Granáty", value: String(unit.grenades) },
  ];
}

function unitConditions(unit: UnitData): string[] {
  const chips: string[] = [];
  if (!unit.alive) {
    chips.push("Padl");
  } else if (unit.inDeathThroes || unit.hp <= 0) {
    chips.push("Poslední vzepětí (1 tah do pádu)");
    chips.push(`Okamžitá smrt při ≤ ${-(unit.maxHp + 1)} HP`);
  }
  if ((unit.detainedTurns ?? 0) > 0) {
    const reason = captureLabel(unit.captureReason);
    chips.push(
      reason
        ? `Zadržen ${unit.detainedTurns}/2 · ${reason}`
        : `Zadržen ${unit.detainedTurns}/2`,
    );
  }
  if (unit.isVip) chips.push("Velitel k ochraně");
  if (unit.isShaken) chips.push("Otřesený");
  if (unit.isOverwatch) chips.push("V hlídce");
  if (unit.movedThisTurn) chips.push("V tomto kole se pohnul");
  if (unit.buffTitle) chips.push(unit.buffTitle);
  if (unit.id === "player-colloredo") {
    chips.push(unit.pistolLoaded === false ? "Bambitka vybitá" : "Bambitka 1/1");
  } else if (unit.firearmLoaded === false) {
    const cost = unit.weapon.reloadApCost ?? 2;
    chips.push(`Nabíjení ${unit.reloadProgress ?? 0}/${cost}`);
  }
  return chips;
}

function captureLabel(reason: UnitData["captureReason"]): string | null {
  if (reason === "zero_hp") return "padl na 0 HP";
  if (reason === "surrounded_unprotected") return "obklíčen bez ochrany";
  if (reason === "all_companions_fallen") return "všichni druhové padli";
  return null;
}

function firearmLines(unit: UnitData): InspectLabeledValue[] {
  const weapon = unit.weapon;
  const lines: InspectLabeledValue[] = [
    { label: "Zámek", value: LOCK_LABEL[weapon.lockType] },
    { label: "Poškození", value: `${weapon.minDamage}–${weapon.maxDamage} HP` },
    {
      label: "Kritický bonus",
      value: critBonusLabel(weapon),
    },
    { label: "Základní krit", value: `${weapon.baseCritChance} %` },
    { label: "Základní přesnost", value: `${weapon.baseAccuracy} %` },
    { label: "Bodový dostřel", value: `${weapon.pointBlankRange} polí` },
    { label: "Optimální dostřel", value: `${weapon.optimalRange} polí` },
    { label: "Maximální dostřel", value: `${weapon.maxRange} polí` },
    { label: "Pokles přesnosti", value: `${weapon.falloffPerTile} % / pole` },
    { label: "Průraz zbroje", value: String(weapon.armorPierce) },
    { label: "Stržení zbroje", value: String(weapon.armorShred) },
    { label: "Selhání", value: `${weapon.baseMisfireChance} %` },
    {
      label: "Furketa",
      value: weapon.supportsRestFork ? "Ano" : "Ne",
    },
    { label: "Cena výstřelu", value: `${weapon.fireApCost ?? 1} AP` },
    { label: "Nabíjení", value: `${weapon.reloadApCost ?? 2} AP` },
    {
      label: "Postih pohybu",
      value:
        unit.id === "player-colloredo"
          ? "Kulhání má přednost před vahou zbraně"
          : `${weapon.mobilityPenalty ?? 0} polí`,
    },
    {
      label: "Hlídka",
      value:
        weapon.overwatchMode === "prepared_volley_cone"
          ? "Připravená salva v kuželu"
          : "Kruhová hlídka",
    },
  ];

  if (weapon.allowEmergencyHipFire) {
    lines.push({
      label: "Střelba od boku",
      value: `1 AP, −${weapon.hipFireAimPenalty ?? 35} % muška, otřesení`,
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
    { label: "Druh", value: MELEE_KIND[weapon.kind] },
    { label: "Poškození", value: `${weapon.minDamage}–${weapon.maxDamage} HP` },
    { label: "Kritický bonus", value: `+${weapon.critBonusDamage} HP` },
    { label: "Základní krit", value: `${weapon.baseCritChance} %` },
    { label: "Přesnost", value: `${weapon.baseAccuracy} %` },
    { label: "Průraz zbroje", value: String(weapon.armorPierce) },
    { label: "Stržení zbroje", value: String(weapon.armorShred) },
    { label: "Popis", value: weapon.description },
  ];
  if (weapon.stunChance != null) {
    lines.push({ label: "Omráčení", value: `${weapon.stunChance} %` });
  }
  if (weapon.spillsReloadOnStrike) {
    lines.push({ label: "Nabíjení", value: "Úder vysype rozpracované nabíjení" });
  }
  return lines;
}

function buildTerrain(ctx: InspectContext, coord: GridCoord): InspectTerrainView {
  const visibility = getTileVisibility(coord, ctx.fog, ctx.fogOfWarEnabled);
  if (visibility === "unexplored") {
    return {
      kind: "terrain",
      tone: "stone",
      title: "Neprozkoumáno",
      censored: true,
      summary: "Toto pole je stále v temnotě. Kryt, dveře ani překážky odtud nejsou vidět.",
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
      title: "Prázdné pole",
      censored: false,
      summary: "Na těchto souřadnicích není dlaždice.",
      lines: [{ label: "Souřadnice", value: coordLabel(coord) }],
      cover: null,
      occupant: null,
    };
  }

  const door = ctx.doorAt(coord) ?? null;
  const title = terrainTitle(tile, door);
  const lines: InspectLabeledValue[] = [
    { label: "Souřadnice", value: coordLabel(coord) },
    { label: "Patro", value: FLOOR_LABEL[tile.coord.y] },
    { label: "Povrch", value: SURFACE_LABEL[tile.surface] },
    { label: "Pohyb", value: tile.walkable ? "Pochozí" : "Nepochozí" },
    { label: "Podlaha", value: tile.hasFloor ? "Ano" : "Ne" },
    {
      label: "Poškození",
      value: damageLabel(tile.damageLevel ?? 0),
    },
    {
      label: "Kouř",
      value: tile.smokeTurns > 0 ? `${tile.smokeTurns} kol` : "Žádný",
    },
    {
      label: "Únik",
      value: tile.isEscapeZone ? "Rybářská pramice" : "Ne",
    },
  ];

  if (tile.obstacle !== "none") {
    lines.push({ label: "Překážka", value: OBSTACLE_LABEL[tile.obstacle] });
  }
  if (tile.obstacle === "powder_keg") {
    lines.push({
      label: "Výbuch",
      value: "3×3, 5 HP, 2 zbroj, kouř",
    });
  }

  const stair = tile.stairType ?? (tile.isLadder ? "ladder" : "none");
  if (stair !== "none") {
    lines.push({ label: "Schody", value: STAIR_LABEL[stair] });
    if (tile.stairDir) {
      lines.push({ label: "Směr schodů", value: FACING_LABEL[tile.stairDir] });
    }
    if (tile.stairConnections && tile.stairConnections.length > 0) {
      lines.push({
        label: "Spojuje patra",
        value: tile.stairConnections.map((floor) => `P${floor}`).join(", "),
      });
    }
  }

  if (door) {
    lines.push(
      { label: "Dveře", value: door.label },
      { label: "Stav dveří", value: door.state === "open" ? "Otevřené" : "Zavřené" },
      {
        label: "Osa",
        value: door.axis === "E_W" ? "Východ–západ" : "Sever–jih",
      },
      { label: "Křídla", value: door.isDoubleLeaf ? "Dvoukřídlé" : "Jednokřídlé" },
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
      label: COVER_LABEL[tile.cover[dir]],
    })),
    occupant: terrainOccupant(ctx, coord, visibility),
  };
}

function terrainTitle(tile: TileData, door: DoorData | null): string {
  if (door) return door.label;
  if (tile.obstacle === "powder_keg") return "Prachový sud";
  if (tile.obstacle !== "none") return OBSTACLE_LABEL[tile.obstacle];
  const stair = tile.stairType ?? (tile.isLadder ? "ladder" : "none");
  if (stair !== "none") return STAIR_LABEL[stair];
  return SURFACE_LABEL[tile.surface];
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
  if (visibility === "shrouded") {
    return "Pole už družina spatřila. Živé postavy, které teď nejsou v dohledu, se tu nezobrazují.";
  }
  return "Pole je v přímém dohledu.";
}

function damageLabel(level: 0 | 1 | 2): string {
  if (level === 1) return "Rozstřílené";
  if (level === 2) return "Ohořelá ruina";
  return "Neporušené";
}

function coordLabel(coord: GridCoord): string {
  return `${coord.x}, ${coord.y}, ${coord.z}`;
}
