/**
 * Zero-dependency typed i18n (ADR-0001). No React.
 *
 * Czech (`cs`) is the only registered language. To add another one:
 * 1. Extend `LocaleId` in `./types`.
 * 2. Add a pack whose `messages` has every key of the Czech catalog
 *    (`csMessages` plus `csUiMessages`) and whose `plural` matches that
 *    language (Czech uses 1 / 2–4 / 5+).
 * 3. Put the pack in `packs`. The language control lists `listLocales()`.
 * Sentences are `Phrase` values. `formatPhrase` resolves them from the
 * active pack, so a mid-mission switch redraws the chronicle, banners,
 * shot math, and epilogue from the same facts.
 */
import type {
  BuffId,
  DoorData,
  SoundContactKind,
  UnitData,
} from "../core/types";
import {
  csAbilities,
  csBuffs,
  csDoors,
  csMeasures,
  csMelee,
  csPerks,
  csUnits,
  csWeapons,
} from "./cs-lexicon";
import { csMessages } from "./cs-messages";
import { csUiMessages } from "./cs-ui";
import { pluralCs } from "./grammar";
import { phrase, type MessageId, type Phrase } from "./phrase";
import type {
  FormatContext,
  GramCase,
  LocaleId,
  MessageFn,
  MessageParams,
  UnitLexeme,
} from "./types";

export type { MessageId, MessageParams, LocaleId, GramCase, Phrase };
export type PerkId = "steel_loyalty" | "maltese_pyrotechnician" | "clementine_zeal";
export type MeasureUnit = keyof typeof csMeasures;
export { phrase };

export interface LocalePack {
  id: LocaleId;
  htmlLang: string;
  endonym: string;
  units: Record<string, UnitLexeme>;
  weapons: typeof csWeapons;
  melee: typeof csMelee;
  abilities: typeof csAbilities;
  buffs: Record<BuffId, string>;
  doors: Record<string, string>;
  perks: Record<PerkId, { name: string; desc: string }>;
  measures: typeof csMeasures;
  messages: Record<MessageId, MessageFn>;
  plural: typeof pluralCs;
}

const csPack: LocalePack = {
  id: "cs",
  htmlLang: "cs",
  endonym: "Čeština",
  units: csUnits,
  weapons: csWeapons,
  melee: csMelee,
  abilities: csAbilities,
  buffs: csBuffs,
  doors: csDoors,
  perks: csPerks,
  measures: csMeasures,
  messages: { ...csMessages, ...csUiMessages },
  plural: pluralCs,
};

const packs: Record<LocaleId, LocalePack> = { cs: csPack };

let current: LocaleId = "cs";
const listeners = new Set<() => void>();

export function getLocale(): LocaleId {
  return current;
}

export function listLocales(): LocalePack[] {
  return Object.values(packs);
}

export function getPack(locale: LocaleId = current): LocalePack {
  return packs[locale];
}

function applyDocument(locale: LocaleId): void {
  if (typeof document === "undefined") return;
  const pack = packs[locale];
  document.documentElement.lang = pack.htmlLang;
  document.title = formatPhrase(phrase("ui.document.title"), locale);
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute("content", formatPhrase(phrase("ui.document.description"), locale));
  }
}

export function setLocale(id: LocaleId): void {
  if (!packs[id] || id === current) return;
  current = id;
  applyDocument(id);
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function bindDocumentLocale(): void {
  applyDocument(current);
}

function contextFor(pack: LocalePack): FormatContext {
  const lex = (id: string | undefined): UnitLexeme | undefined =>
    id ? pack.units[id] : undefined;
  return {
    unit: (id, gram: GramCase = "nom") => lex(id)?.[gram] ?? id ?? "",
    role: (id) => lex(id)?.roleTitle ?? "",
    weapon: (id) => (id ? pack.weapons[id]?.name : undefined) ?? id ?? "",
    melee: (id) => (id ? pack.melee[id]?.name : undefined) ?? id ?? "",
    meleeDesc: (id) => (id ? pack.melee[id]?.description : undefined) ?? "",
    ability: (id) => (id ? pack.abilities[id]?.name : undefined) ?? id ?? "",
    door: (id) => (id ? pack.doors[id] : undefined) ?? id ?? "",
    plural: pack.plural,
  };
}

export function formatPhrase(value: Phrase, locale: LocaleId = current): string {
  const pack = packs[locale];
  const format = pack.messages[value.id];
  if (!format) return value.id;
  return format(value.params ?? {}, contextFor(pack));
}

export function text(id: MessageId, params?: MessageParams, locale?: LocaleId): string {
  return formatPhrase(phrase(id, params), locale ?? current);
}

export function formatMeasure(unit: MeasureUnit, value: number, locale: LocaleId = current): string {
  const shown = value > 0 ? `+${value}` : String(value);
  if (unit === "percent") return `${shown} %`;
  return `${shown} ${packs[locale].measures[unit]}`;
}

export function unitName(id: string, gram: GramCase = "nom", locale: LocaleId = current): string {
  return contextFor(packs[locale]).unit(id, gram);
}

export function buffLabel(id: BuffId, locale: LocaleId = current): string {
  return packs[locale].buffs[id];
}

/** Weapon, melee, ability, powder keg, or grenade id shown on a combat-loss plate. */
export function lossSourceLabel(id: string, locale: LocaleId = current): string {
  const pack = packs[locale];
  return pack.weapons[id]?.name ?? pack.melee[id]?.name ?? pack.abilities[id]?.name ?? id;
}

export function doorLabel(id: string, locale: LocaleId = current): string {
  return packs[locale].doors[id] ?? id;
}

export function weaponLabel(id: string, locale: LocaleId = current): string {
  return packs[locale].weapons[id]?.name ?? id;
}

export function meleeLabel(id: string, locale: LocaleId = current): string {
  return packs[locale].melee[id]?.name ?? id;
}

export function perkCopy(id: PerkId, locale: LocaleId = current): { name: string; desc: string } {
  return packs[locale].perks[id];
}

const CONTACT_MESSAGE: Record<SoundContactKind, MessageId> = {
  matchcord_glow: "contact.matchcord",
  footsteps: "contact.footsteps",
  gunfire_flash: "contact.gunfire",
};

export function contactPhrase(kind: SoundContactKind): Phrase {
  return phrase(CONTACT_MESSAGE[kind]);
}

export function projectUnit(unit: UnitData, locale: LocaleId = current): UnitData {
  const pack = packs[locale];
  const lex = pack.units[unit.id];
  const weapon = pack.weapons[unit.weapon.id];
  const melee = unit.meleeWeapon ? pack.melee[unit.meleeWeapon.id] : undefined;
  const ability = unit.ability ? pack.abilities[unit.ability.id] : undefined;
  return {
    ...unit,
    name: lex?.nom ?? unit.name,
    roleTitle: lex?.roleTitle ?? unit.roleTitle,
    buffTitle: unit.buffId ? (pack.buffs[unit.buffId] ?? unit.buffTitle) : unit.buffTitle,
    weapon: weapon ? { ...unit.weapon, name: weapon.name } : unit.weapon,
    meleeWeapon:
      unit.meleeWeapon && melee
        ? {
            ...unit.meleeWeapon,
            name: melee.name,
            description: melee.description ?? unit.meleeWeapon.description,
          }
        : unit.meleeWeapon,
    ability:
      unit.ability && ability
        ? {
            ...unit.ability,
            name: ability.name,
            subtitle: ability.subtitle ?? unit.ability.subtitle,
            description: ability.description ?? unit.ability.description,
          }
        : unit.ability,
  };
}

export function projectDoor(door: DoorData, locale: LocaleId = current): DoorData {
  const label = packs[locale].doors[door.id];
  return label ? { ...door, label } : door;
}
