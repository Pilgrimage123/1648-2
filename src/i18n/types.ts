/**
 * Language-neutral copy contracts (ADR-0001).
 *
 * Simulation code stores a `Phrase` (message id + facts). A `LocalePack`
 * turns that phrase into a sentence. Czech is the only pack today.
 * Adding a language means extending `LocaleId`, implementing `LocalePack`
 * for every message key, and registering the pack.
 */

export type LocaleId = "cs";

/** Grammatical case. Czech templates request one; other languages may ignore it. */
export type GramCase = "nom" | "gen" | "dat" | "acc" | "voc" | "loc" | "ins";

export type UnitGender = "m" | "f";

/** How a modifier value is drawn. Czech renders armor as ZBROJ. */
export type MeasureUnit = "percent" | "hp" | "armor";

export interface UnitLexeme {
  gender: UnitGender;
  nom: string;
  gen: string;
  dat: string;
  acc: string;
  voc: string;
  loc: string;
  ins: string;
  roleTitle: string;
}

export interface NamedText {
  name: string;
  description?: string;
  subtitle?: string;
}

/** Facts a sentence may mention. Templates read only the fields they need. */
export interface MessageParams {
  unitId?: string;
  /** Several units named in one sentence, declined by the template. */
  unitIds?: string[];
  attackerId?: string;
  targetId?: string;
  heroId?: string;
  weaponId?: string;
  meleeId?: string;
  abilityId?: string;
  doorId?: string;
  names?: string;
  damage?: number;
  shred?: number;
  absorbed?: number;
  chance?: number;
  misfire?: number;
  progress?: number;
  required?: number;
  count?: number;
  distance?: number;
  optimal?: number;
  armor?: number;
  hp?: number;
  cover?: number;
  x?: number;
  y?: number;
  z?: number;
  kegX?: number;
  kegZ?: number;
  floor?: number;
  fromFloor?: number;
  toFloor?: number;
  dir?: string;
  facing?: string;
  zone?: "blue" | "yellow";
  climb?: "up" | "down" | "ground";
  capture?: "zero_hp" | "surrounded_unprotected" | "all_companions_fallen";
  victory?: "boat_escape" | "annihilation";
  step?: "unit" | "tile" | "action";
  hit?: boolean;
  critical?: boolean;
  misfired?: boolean;
  hipFire?: boolean;
  fork?: boolean;
  height?: boolean;
  flanked?: boolean;
  instant?: boolean;
  enteredThroes?: boolean;
  agony?: boolean;
  stunned?: boolean;
  spilled?: boolean;
  keg?: boolean;
  rescued?: boolean;
  keptWound?: boolean;
  loaded?: boolean;
  open?: boolean;
  heavy?: boolean;
  self?: boolean;
  butt?: boolean;
}

export interface FormatContext {
  unit: (id: string | undefined, gram?: GramCase) => string;
  role: (id: string | undefined) => string;
  weapon: (id: string | undefined) => string;
  melee: (id: string | undefined) => string;
  meleeDesc: (id: string | undefined) => string;
  ability: (id: string | undefined) => string;
  door: (id: string | undefined) => string;
  plural: (n: number, one: string, few: string, many: string) => string;
}

export type MessageFn = (params: MessageParams, ctx: FormatContext) => string;
