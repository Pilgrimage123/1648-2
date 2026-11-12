/**
 * Datové modely pro bezhlavé (headless) taktické jádro (/src/core/types.ts).
 * Neobsahuje žádné závislosti na Three.js ani Reactu.
 * User-facing sentences are `Phrase` values resolved by `src/i18n`.
 */
import type { Phrase } from "../i18n/phrase";
import type { MeasureUnit } from "../i18n/types";

export type FloorLevel = 0 | 1 | 2;

export type StairType =
  | "none"
  | "straight_stairs"
  | "spiral_stairs"
  | "ladder"
  | "grand_stairs";

export interface GridCoord {
  x: number;
  y: FloorLevel;
  z: number;
}

export type CardinalDir = "N" | "E" | "S" | "W";

export type CoverLevel = "none" | "half" | "full";

export type ObstacleType = "none" | "low_wall" | "high_wall" | "pillar" | "powder_keg";

export type DirectionalCover = Record<CardinalDir, CoverLevel>;

/** Stav křídla dveří (zavřeno = blokuje pohyb i přímý LoS, otevřeno = volný průchod i výhled) */
export type DoorState = "closed" | "open";

/**
 * Barokní dubové a kované dveře na mřížce (Grand Priory Palace & Garden):
 * - V zavřeném stavu blokují pohyb a zrakovou linii (LoS)
 * - V otevřeném stavu poskytují volný průchod a výhled
 * - Jednotka stojící na sousedním poli (Chebyshev <= 1, stejné patro) je může otevřít/zavřít jako Free Action (0 AP)
 * - Dvoukřídlé portály synchronizují otevření obou křídel současně
 */
export interface DoorData {
  id: string;
  coord: GridCoord;
  state: DoorState;
  /** Orientace zárubně dveří (E_W = otevírá se podél osy X ve zdi Z, N_S = otevírá se podél osy Z ve zdi X) */
  axis: "E_W" | "N_S";
  /** Historický název brány/dveří */
  label: string;
  /** Zda jde o honosné dvoukřídlé dveře / barokní portál */
  isDoubleLeaf?: boolean;
  /** Souřadnice spárovaného druhého křídla */
  pairedCoord?: GridCoord;
  /** Role křídla v portálu: 'left' | 'right' */
  leafRole?: "left" | "right";
}


/** Počasí na bojišti ovlivňující viditelnost a spolehlivost doutnákových zbraní */
export type WeatherType = "clear" | "fog" | "rain";

/** Typ zámku palné zbraně ze 17. století */
export type FirearmLockType = "matchlock" | "wheellock" | "artillery";

export interface TileData {
  coord: GridCoord;
  walkable: boolean;
  /** Zda na dané souřadnici (x, y, z) existuje pochozí podlaha/střecha */
  hasFloor: boolean;
  /** Vertikální spojení pater (přímé schodiště, točité schodiště nebo žebřík) */
  isLadder: boolean;
  /** Konkrétní architektonický typ vertikálního přechodu */
  stairType?: StairType;
  /** Směr stoupání přímého schodiště nebo orientace vřetene */
  stairDir?: CardinalDir;
  /** Patra, která toto schodiště na souřadnici (x, z) přímo propojuje */
  stairConnections?: FloorLevel[];
  /** Směrové krytí chránící jednotku na dlaždici proti střelbě ze směrů N, E, S, W */
  cover: DirectionalCover;
  /** Typ překážky na dlaždici (nízká zídka/gabion, vysoká zeď, pilíř, výbušný prachový sud) */
  obstacle: ObstacleType;
  /** Počet zbývajících kol hustého kouře z černého prachu na této dlaždici (-20 % k zásahu) */
  smokeTurns: number;
  /** Vizuální povrch dlaždice odlišující honosný palác, zaprášenou ulici a rozstřílenou ruinu */
  surface:
    | "cobble"
    | "stone_floor"
    | "palace_carpet"
    | "wood_roof"
    | "rubble"
    | "scorched_ruin"
    | "water"
    | "wood_dock";
  /** Stupeň válečné devastace dlaždice a přilehlého krytu (0 = neporušený, 1 = rozstřílený/omítka, 2 = ohořelá ruina/kráter) */
  damageLevel?: 0 | 1 | 2;
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

export type OverwatchMode = "full_360" | "prepared_volley_cone";

export interface WeaponStats {
  id: string;
  name: string;
  lockType: FirearmLockType;
  minDamage: number;
  maxDamage: number;
  critBonusDamage: number;
  /** Maximální bonus kritického poškození (např. +6 až +8 HP u těžké muškety, +4 až +6 HP u švédské muškety) */
  critBonusMaxDamage?: number;
  /** Základní šance zbraně na kritický zásah (%) */
  baseCritChance: number;
  /** Základní přesnost zbraně (Base Aim %) */
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
  /** Zda zbraň vyžaduje opěrnou vidlici (furketu) */
  supportsRestFork: boolean;
  /** Cena standardního výstřelu v akčních bodech (2 AP u těžké muškety s furketou, 1 AP u švédské odlehčené muškety) */
  fireApCost?: 1 | 2;
  /** Zda lze těžkou mušketu nouzově vystřelit od boku za 1 AP (s postihem -35 % Aim a následným stavem Otřesený) */
  allowEmergencyHipFire?: boolean;
  /** Postih k přesnosti při nouzové střelbě od boku za 1 AP (výchozí 35 %) */
  hipFireAimPenalty?: number;
  /** Celková cena nabití v AP při fázovém nabíjení po 1 AP (4 AP těžká mušketa, 2 AP švédská mušketa s papírovými patronami) */
  reloadApCost?: number;
  /** Tiles lost from `SOLDIER_BASE_MOVE` (7). Carbine and Swedish musket are −2, heavy musket −3. Colloredo's limp ignores this. */
  mobilityPenalty?: number;
  /** Režim hlídky: plný 360° Overwatch (kolečkový zámek) nebo Připravená salva v předním kuželu (doutnáková mušketa) */
  overwatchMode?: OverwatchMode;
}

/** Důvod zadržení či zajetí polního maršála Colloreda */
export type CaptureReason =
  | "zero_hp"
  | "surrounded_unprotected"
  | "all_companions_fallen";

/** Status identity. The visible title comes from the locale pack. */
export type BuffId = "limp" | "detained_1" | "detained_2" | "choking";

/** Identifikátory unikátních aktivovaných schopností postav v 1. misi */
export type SpecialAbilityId =
  | "protector_oath"
  | "klementinum_verdict"
  | "maltese_shrapnel"
  | "marshal_command";

export interface SpecialAbilityDef {
  id: SpecialAbilityId;
  name: string;
  subtitle: string;
  description: string;
  apCost: 0 | 1;
  cooldownTurns: number;
  currentCooldown: number;
}

export interface MeleeWeaponStats {
  id: string;
  name: string;
  kind: "sword" | "dagger" | "polearm" | "pistol_butt" | "musket_butt" | "fist";
  minDamage: number;
  maxDamage: number;
  critBonusDamage: number;
  baseCritChance: number;
  baseAccuracy: number;
  armorPierce: number;
  armorShred: number;
  /** Šance (%) na omráčení / otřesení cíle úderem těžké pažby (např. 25 % u těžké muškety) */
  stunChance?: number;
  /** Zda prudký úder pažbou zbraně vysype rozpracované fázové nabíjení (u těžké muškety) */
  spillsReloadOnStrike?: boolean;
  description: string;
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
  /** Chladná zbraň nebo úder pažbou muškety pro boj zblízka (1 AP) */
  meleeWeapon?: MeleeWeaponStats;
  /** Zda má jednorannou pistoli/bambitku nabitou (hrabě Colloredo má pouze 1 výstřel bez možnosti přebití!) */
  pistolLoaded?: boolean;
  grenades: number;
  isOverwatch: boolean;
  /** Zda se jednotka v aktuálním tahu již pohnula (ovlivňuje oporu furkety a střelbu z těžké muškety) */
  movedThisTurn: boolean;
  /** Zda je morálka jednotky otřesena (Suppressed / Shaken: -20 % k zásahu) */
  isShaken: boolean;
  /** Zda jednotka trpí záchvatem kašle po setrvání v zakouřeném interiéru (-1 Pohyblivost na 1 tah, ADR-0011) */
  isChoking?: boolean;
  /** Zda je jednotka klíčovým velitelem (pokud je zadržen po 2 kola, mise končí prohrou) */
  isVip?: boolean;
  /** Počet kol, po která je VIP maršál nepřetržitě zadržen nepřáteli (0 = volný, 1 = 1. kolo, 2 = zajat / Game Over) */
  detainedTurns?: number;
  /** Důvod aktuálního zadržení nebo zajetí VIP maršála */
  captureReason?: CaptureReason | null;
  /** Language-neutral status. The title is projected from the locale pack. */
  buffId?: BuffId;
  /** Popisek aktivního stavu (např. "Těžké kulhání (zranění z Lützenu)") */
  buffTitle?: string;
  /** Zda je palná zbraň (mušketa/karabina) plně nabitá a připravená k výstřelu */
  firearmLoaded?: boolean;
  /** Postup fázového nabíjení po 1 AP (např. 0..4 u těžké muškety, 0..2 u švédské muškety) */
  reloadProgress?: number;
  /** Unikátní aktivovaná schopnost postavy [Klávesa 5] */
  ability?: SpecialAbilityDef;
  /** Zda má postava v tomto kole aktivní posílení ze své zvláštní schopnosti */
  abilityBuffActive?: boolean;
  /** Zda je jednotka v Posledním vzepětí (agónie po smrtelném zranění hp <= 0, ADR-0012) */
  inDeathThroes?: boolean;
  /** Zbývající počet tahů v Posledním vzepětí před definitivním pádem k zemi (obvykle 1) */
  deathThroesTurns?: number;
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
  /** Phrase resolved by the active locale. */
  label: Phrase;
  /** Volitelný podtitulek vysvětlující historický/herní kontext */
  detail?: Phrase;
  /** Číselná hodnota modifikátoru (např. +15, -20, -40) */
  value: number;
  /** Jednotka zobrazená u hodnoty */
  unit: MeasureUnit;
  /** Typ položky určující barvu v UI (bonus = zelená/zlatá, penalty = červená, base = neutrální) */
  kind: "base" | "bonus" | "penalty" | "neutral";
}

/**
 * Dynamický záblesk pro fond osvětlení bojiště (ADR-0011).
 * Spravuje max 2 explozivní světla a 1 výstřelové světlo se stmíváním dle kvadratického zákona.
 */
export interface ActiveLightFlash {
  id: number;
  kind: "blast" | "muzzle";
  coord: GridCoord;
  color: string;
  intensity: number;
  radius: number;
  durationMs: number;
  createdAt: number;
}

/**
 * Kompletní výsledek výpočtu střelby (ShotCalculationResult) pro XCOM-2 Aiming HUD
 * a rozkládací postranní panely (Breakdown Wings).
 */
export interface ShotCalculationResult {
  shooterId: string;
  targetId: string;
  weaponId: string;
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
  critBonusMaxDamage?: number;
  /** Cena tohoto výstřelu v AP (2 AP z furkety, 1 AP nouzově od boku nebo ze švédské muškety) */
  fireApCost?: 1 | 2;
  /** Zda jde o nouzovou střelbu od boku z těžké muškety (1 AP, -35 % Aim, způsobí stav Otřesený) */
  isHipFire?: boolean;
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

export interface MeleeCalculationResult {
  attackerId: string;
  targetId: string;
  weaponId: string;
  weaponName: string;
  kind: MeleeWeaponStats["kind"];
  hitChance: number;
  critChance: number;
  heightAdvantage: boolean;
  minDamage: number;
  maxDamage: number;
  critBonusDamage: number;
  armorPierce: number;
  armorShred: number;
  expectedArmorLoss: number;
  expectedHpLossMin: number;
  expectedHpLossMax: number;
  hitModifiers: StatModifier[];
  critModifiers: StatModifier[];
}

export interface MeleeTargetEvaluation {
  targetId: string;
  targetPos: GridCoord;
  inRange: boolean;
  calculation: MeleeCalculationResult;
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
  /** Zda zásah uvrhl cíl do Posledního vzepětí (ADR-0012) */
  enteredDeathThroes?: boolean;
  /** Zda byl cíl zabit okamžitým překročením prahu hp <= -(maxHp + 1) */
  instantKilled?: boolean;
}

export interface CombatLogEntry {
  id: string;
  round: number;
  faction: Faction;
  message: Phrase;
  tone: "info" | "hit" | "crit" | "miss" | "misfire" | "overwatch" | "alert" | "buff" | "story";
}

/**
 * Stav viditelnosti dlaždice v barokní Mlze války (Chiaroscuro Fog of War):
 * - 'unexplored': Neprozkoumaná temnota (Terra Incognita) — dosud nespatřeno žádným členem družiny
 * - 'shrouded': Prozkoumaný šerosvit (Paměť bojiště) — dříve odhaleno nebo známý půdorys paláce, nyní mimo přímý dohled (LoS)
 * - 'visible': Aktivní zorné pole (Osvětleno šerosvitem) — právě teď v přímém 3D LoS družiny nebo ozářeno výbuchem/lucernou
 */
export type FogVisibilityState = "unexplored" | "shrouded" | "visible";

/**
 * Zvukový nebo světelný kontakt se skrytým nepřítelem v šerosvitu (17. století):
 * - 'matchcord_glow': Žhnoucí doutnák doutnákové muškety ve tmě a dešti
 * - 'footsteps': Šramot ocelového kyrysu a kroky na mokré dlažbě
 * - 'gunfire_flash': Záblesk výstřelu z pánvičky v temnotě
 */
export type SoundContactKind = "matchcord_glow" | "footsteps" | "gunfire_flash";

export interface SoundContact {
  unitId: string;
  pos: GridCoord;
  kind: SoundContactKind;
  label: string;
  distanceToNearestAlly: number;
}

export interface FogOfWarSnapshot {
  /** Klíče souřadnic (`x,y,z`) dlaždic, které jsou právě teď v aktivním zorném poli ('visible') */
  visibleCoords: Set<string>;
  /** Klíče souřadnic (`x,y,z`) všech dlaždic, které již družina odhalila ('shrouded' | 'visible') */
  exploredCoords: Set<string>;
  /** ID nepřátelských jednotek, které jsou právě teď přímo viditelné a zaměřitelné */
  visibleEnemyIds: Set<string>;
  /** Zvukové a doutnákové kontakty nepřátel skrytých v mlze války */
  soundContacts: SoundContact[];
  /** Efektivní poloměr dohledu (v polích) pro každou hráčovu jednotku */
  unitSightRadii: Record<string, number>;
}

export type ActionMode = "move" | "shoot" | "grenade" | "melee" | "reload";

/**
 * Fáze skriptovaného tutoriálu ve stylu XCOM 2 (Mission 1 Onboarding).
 */
export type GuidedTutorialStep =
  | "step_1_matej_move"        // 1. Jan Matěj: Pohyb do krytu za balustrádu (1 AP vs 2 AP, Half/Full Cover)
  | "step_2_colloredo_escort"  // 2. Hrabě Colloredo: Těžké kulhání (3 pole/AP) & Pravidlo zajetí
  | "step_3_vaclav_aim"        // 3. Václav z Michalovic: Výšková převaha (+15 %) & Křídlení (Flank +40 % Crit)
  | "step_4_vaclav_shoot"      // 4. Míření, rozpad šance a výstřel (Akční kamera)
  | "step_5_enemy_turn_react"  // 5. Tah nepřítele: Odveta a demonstrace záchrany kamenným krytem
  | "step_6_vaclav_reload"     // 6. Fázové nabíjení po 1 AP (Černoprachý realismus 17. století)
  | "step_7_keg_explosion"     // 7. Bratr Bartoloměj: Prachový sud & Zničení krytu petardou (plocha 3x3)
  | "step_8_melee_finish"      // 8. Zteč zblízka (Melee Rush na PKM) pro doražení cíle bez plýtvání prachem
  | "step_9_free_combat";      // 9. Schodiště, patra [V] a volná taktika k rybářské pramici na Čertovce

export interface GuidedTutorialInstruction {
  step: GuidedTutorialStep;
  speaker: string;
  role: string;
  portrait: UnitArchetype;
  title: string;
  orderText: string;
  tacticalTip: string;
  allowedUnitId: string | null;
  allowedTileCoords: GridCoord[] | null;
  allowedActionMode: ActionMode | null;
  beacon: {
    coord: GridCoord;
    label: string;
    color: string;
    icon?: "shield" | "crosshair" | "keg" | "melee" | "dock";
  } | null;
}

export interface GuidedTutorialState {
  enabled: boolean;
  currentStep: GuidedTutorialStep;
  dismissed: boolean;
  rejectFeedback: Phrase | null;
  rejectTimestamp: number;
}


