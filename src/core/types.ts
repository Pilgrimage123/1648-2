/**
 * Datové modely pro bezhlavé (headless) taktické jádro (/src/core/types.ts).
 * Neobsahuje žádné závislosti na Three.js ani Reactu.
 */

export type FloorLevel = 0 | 1;

export interface GridCoord {
  x: number;
  y: FloorLevel;
  z: number;
}

export type CardinalDir = "N" | "E" | "S" | "W";

export type CoverLevel = "none" | "half" | "full";

export type ObstacleType = "none" | "low_wall" | "high_wall" | "pillar" | "powder_keg";

export type DirectionalCover = Record<CardinalDir, CoverLevel>;

/** Počasí na bojišti ovlivňující viditelnost a spolehlivost doutnákových zbraní */
export type WeatherType = "clear" | "fog" | "rain";

/** Typ zámku palné zbraně ze 17. století */
export type FirearmLockType = "matchlock" | "wheellock" | "artillery";

export interface TileData {
  coord: GridCoord;
  walkable: boolean;
  /** Zda na dané souřadnici (x, y, z) existuje pochozí podlaha/střecha */
  hasFloor: boolean;
  /** Žebřík propojující přízemí (y=0) a 1. patro (y=1) */
  isLadder: boolean;
  /** Směrové krytí chránící jednotku na dlaždici proti střelbě ze směrů N, E, S, W */
  cover: DirectionalCover;
  /** Typ překážky na dlaždici (nízká zídka/gabion, vysoká zeď, pilíř, výbušný prachový sud) */
  obstacle: ObstacleType;
  /** Počet zbývajících kol hustého kouře z černého prachu na této dlaždici (-20 % k zásahu) */
  smokeTurns: number;
  /** Vizuální povrch dlaždice */
  surface: "cobble" | "stone_floor" | "wood_roof" | "rubble" | "water" | "wood_dock";
  /** Zda je toto pole únikovou zónou k rybářské pramici na Čertovce */
  isEscapeZone?: boolean;
}

export type MovementZoneType = "blue" | "yellow";

export interface ReachableTile {
  coord: GridCoord;
  costSteps: number;
  apCost: 1 | 2;
  zone: MovementZoneType;
  bestCover: CoverLevel;
}

export type Faction = "player" | "enemy";

export type UnitArchetype = "ranger" | "sniper" | "trooper" | "sectoid" | "commander";

export type RenderMode = "2D_SPRITE" | "3D_MODEL";

export interface WeaponStats {
  id: string;
  name: string;
  lockType: FirearmLockType;
  minDamage: number;
  maxDamage: number;
  critBonusDamage: number;
  /** Základní šance zbraně na kritický zásah (%) */
  baseCritChance: number;
  /** Základní přesnost zbraně (%) */
  baseAccuracy: number;
  /** Penalizace přesnosti za každé pole nad optimální dostřel */
  falloffPerTile: number;
  /** Vzdálenost (v polích), do které platí Point-Blank bonus na blízko */
  pointBlankRange: number;
  /** Optimální dostřel hladké hlavně bez penalizace */
  optimalRange: number;
  /** Maximální dostřel zbraně */
  maxRange: number;
  /** Kolik bodů zbroje (kyrysu) výstřel ignoruje */
  armorPierce: number;
  /** Kolik bodů zbroje (kyrysu) výstřel trvale zničí (Shred) */
  armorShred: number;
  /** Základní šance na selhání výstřelu (Misfire %) v běžném počasí */
  baseMisfireChance: number;
  /** Zda lze těžkou mušketu opřít o furketu (vidlici) pro +15 % přesnosti bez pohybu */
  supportsRestFork: boolean;
}

export interface UnitData {
  id: string;
  name: string;
  roleTitle: string;
  faction: Faction;
  archetype: UnitArchetype;
  pos: GridCoord;
  facing: CardinalDir;
  hp: number;
  maxHp: number;
  /** Aktuální body zbroje (kyrys / přilba) */
  armor: number;
  /** Maximální body zbroje */
  maxArmor: number;
  ap: number;
  maxAp: number;
  /** Základní střelecká dovednost žoldnéře (Base Marksmanship %) */
  marksmanship: number;
  /** Počet polí za 1 AP (Modrá zóna) */
  movePerAp: number;
  weapon: WeaponStats;
  grenades: number;
  isOverwatch: boolean;
  /** Zda se jednotka v aktuálním tahu již pohnula (ovlivňuje bonus za furketu) */
  movedThisTurn: boolean;
  /** Zda je morálka jednotky otřesena (Suppressed / Shaken: -20 % k zásahu) */
  isShaken: boolean;
  /** Zda je jednotka klíčovým velitelem (pokud padne, mise končí prohrou) */
  isVip?: boolean;
  /** Popisek aktivního taktického posílení (např. "Podepřen komorníkem") */
  buffTitle?: string;
  alive: boolean;
}

/**
 * Kategorie ikony cíle ve spodní liště (Target Ribbon):
 * - 'flanked': Žlutá ikona — cíl je v obchvatu (Flanked) nebo na zcela nekrytém prostranství
 * - 'covered': Červená ikona — cíl je v krytu (za vozovou hradbou, gabionem, zídkou)
 * - 'extreme_range': Šedá/Modrá ikona — cíl je v extrémním dostřelu s vysokou penalizací
 */
export type TargetRibbonCategory = "flanked" | "covered" | "extreme_range";

/**
 * Jednotlivá položka matematického rozpisu pro rozkládací postranní panely (Breakdown Wings).
 */
export interface StatModifier {
  id: string;
  /** Název modifikátoru v UI (např. "Opření o furketu (vidlici)") */
  label: string;
  /** Volitelný podtitulek vysvětlující historický/herní kontext */
  detail?: string;
  /** Číselná hodnota modifikátoru (např. +15, -20, -40) */
  value: number;
  /** Jednotka zobrazená u hodnoty */
  unit: "%" | "HP" | "ZBROJ";
  /** Typ položky určující barvu v UI (bonus = zelená/zlatá, penalty = červená, base = neutrální) */
  kind: "base" | "bonus" | "penalty" | "neutral";
}

/**
 * Kompletní výsledek výpočtu střelby (ShotCalculationResult) pro XCOM-2 Aiming HUD
 * a rozkládací postranní panely (Breakdown Wings).
 */
export interface ShotCalculationResult {
  shooterId: string;
  targetId: string;
  weaponName: string;
  lockType: FirearmLockType;
  distance: number;
  incomingDirection: CardinalDir;
  targetCover: CoverLevel;
  isFlanked: boolean;
  isExtremeRange: boolean;
  heightAdvantage: boolean;
  ribbonCategory: TargetRibbonCategory;

  /** Výsledná šance na zásah ořezaná na 0 % až 100 % */
  hitChance: number;
  /** Výsledná šance na kritický zásah / průstřel mimo zbroj (0 % až 100 %) */
  critChance: number;
  /** Šance na selhání výstřelu (vlhký prach / doutnák, 0 % až 100 %) */
  misfireChance: number;

  /** Hrubý rozptyl poškození zbraně */
  minDamage: number;
  maxDamage: number;
  critBonusDamage: number;
  /** Průraz zbroje (kolik bodů kyrysu výstřel ignoruje) */
  armorPierce: number;
  /** Zničení zbroje (kolik bodů kyrysu výstřel trvale strhne) */
  armorShred: number;

  /** Náhled pro blikající ukazatel cíle: kolik bodů zbroje cíl ztratí při zásahu */
  expectedArmorLoss: number;
  /** Náhled pro blikající ukazatel cíle: minimální úbytek HP po započtení zbroje a průrazu */
  expectedHpLossMin: number;
  /** Náhled pro blikající ukazatel cíle: maximální úbytek HP po započtení zbroje a průrazu */
  expectedHpLossMax: number;

  /** Položky pro levý rozkládací panel (Modifikátory šance na zásah) */
  hitModifiers: StatModifier[];
  /** Položky pro pravý rozkládací panel (Modifikátory kritického zásahu a průrazu zbroje) */
  critModifiers: StatModifier[];
}

export interface TargetEvaluation {
  targetId: string;
  targetPos: GridCoord;
  hasLos: boolean;
  losRay: GridCoord[];
  inRange: boolean;
  calculation: ShotCalculationResult;
}

export interface AttackOutcome {
  attackerId: string;
  targetId: string;
  misfired: boolean;
  hit: boolean;
  critical: boolean;
  damage: number;
  armorShredded: number;
  armorAbsorbed: number;
  hitChance: number;
  critChance: number;
  misfireChance: number;
  flanked: boolean;
  heightAdvantage: boolean;
  killed: boolean;
}

export interface CombatLogEntry {
  id: string;
  round: number;
  faction: Faction;
  text: string;
  tone: "info" | "hit" | "crit" | "miss" | "misfire" | "overwatch" | "alert" | "buff" | "story";
}
