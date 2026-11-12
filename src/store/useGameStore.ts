/**
 * Zustand State Store (/src/store/useGameStore.ts).
 * Propojuje čistou herní logiku (/src/core/) s React UI (Aiming HUD, Target Ribbon, Breakdown Wings)
 * a 3D scénou (@react-three/fiber).
 */

import { create } from "zustand";
import {
  buffLabel,
  phrase,
  projectUnit,
  subscribeLocale,
  type PerkId,
  type Phrase,
} from "../i18n/runtime";
import {
  applyBlackPowderChoking,
  calculateMeleeAttack,
  calculateShot,
  checkEnemyColloredoCapture,
  checkLineOfSight3D,
  computeEnemyAiDecision,
  evaluateAdjacentMeleeTargets,
  evaluateVisibleTargets,
  facingFromDelta,
  gridDistance3D,
  isAdjacentForMelee,
  isCompanionProtectedByCount,
  isInPreparedVolleyCone,
  isInstantOverkill,
  isUnitFighting,
  resolveTargetCoverAgainstShot,
  rollMeleeAttack,
  rollRangedAttack,
} from "../core/CombatSystem";
import {
  CARDINAL_OFFSETS,
  coordKey,
  createInitialGrid,
  createInitialUnits,
  createReinforcementUnits,
  GridSystem,
  relabelCatalogs,
  sameCoord,
} from "../core/GridSystem";
import {
  checkFogLineOfSight3D,
  computeFogOfWar,
  createInitialExploredCoords,
  previewReconFromTile,
  type DynamicLightSource,
} from "../core/FogOfWar";
import { computeReachableTiles, findPathAStar } from "../core/Pathfinding";
import {
  computeScrambleDestination,
  createInitialCameraDirectorState,
  detectPathInteractions,
  resetLiveMovementTelemetry,
  resolveDynamicRoofCutawayFloor,
  resolvePrimaryCoverDirection,
  shouldTriggerActionCamForMove,
  type CameraDirectorState,
  type StepInteractionKind,
} from "../core/CameraDirector";
import {
  playGunshotSound,
  playExplosionSound,
  playMisfireSound,
  playHitSound,
  playMeleeSound,
  playRicochetSound,
  playSpecialAbilitySound,
} from "../utils/audioSystem";
import { muzzleFlashDraft, retainFlashes } from "../components/canvas/diegeticLights";
import type { InspectPin } from "../core/inspectView";
import type {
  ActiveLightFlash,
  AttackOutcome,
  BuffId,
  CaptureReason,
  CardinalDir,
  CombatLogEntry,
  CoverLevel,
  Faction,
  FloorLevel,
  FogOfWarSnapshot,
  GridCoord,
  MeleeCalculationResult,
  MeleeTargetEvaluation,
  ReachableTile,
  RenderMode,
  TargetEvaluation,
  UnitData,
  WeatherType,
  GuidedTutorialStep,
  GuidedTutorialState,
} from "../core/types";
import {
  getGuidedStepData,
  isTileAllowedForGuidedMove,
  isActionAllowedForGuidedStep,
  getGuidedRejectFeedback,
} from "../core/GuidedTutorialSystem";

export type ActionMode = "move" | "shoot" | "grenade" | "melee" | "reload";

export type ImpactObstacleKind =
  | "high_wall"
  | "pillar"
  | "low_wall"
  | "palace_wood"
  | "palace_stucco"
  | "cobble";

export interface UnitCombatLoss {
  id: number;
  timestamp: number;
  durationMs: number;
  attackerId: string;
  weaponId: string;
  hit: boolean;
  critical: boolean;
  misfired: boolean;
  hitChance?: number;
  /** Stav zdraví před zásahem a po zásahu */
  hpBefore: number;
  hpAfter: number;
  hpLost: number;
  maxHp: number;
  /** Stav zbroje (kyrysu) před zásahem a po zásahu */
  armorBefore: number;
  armorAfter: number;
  armorLost: number;
  armorAbsorbed: number;
  maxArmor: number;
  /** Ztráta akčních bodů (AP), morálky, hlídky či svobody */
  apLost: number;
  shakenApplied: boolean;
  overwatchLost: boolean;
  detainedApplied: boolean;
  killed: boolean;
  enteredDeathThroes?: boolean;
  instantKilled?: boolean;
}

export interface UnitVisualFX {
  lungeTimestamp: number;
  hitTimestamp: number;
  coverSettleTimestamp?: number;
  coverSettleDir?: CardinalDir | null;
  floatingBanner: {
    id: number;
    phrase: Phrase;
    tone: "hit" | "crit" | "miss" | "misfire" | "overwatch" | "buff";
  } | null;
  combatLoss?: UnitCombatLoss | null;
}

export interface ProjectileVisual {
  id: number;
  from: GridCoord;
  to: GridCoord;
  targetId?: string;
  hitChance?: number;
  kind: "bullet" | "grenade" | "sniper_beam" | "shrapnel_burst" | "melee_strike";
  createdAt: number;
  durationMs?: number;
  hit?: boolean;
  critical?: boolean;
  misfired?: boolean;
  /** Výsledné zranění do zdraví (HP) pro škálování částic krve a otřesu kamery */
  damage?: number;
  /** Závažnost krvácení: 0 = bez krve (minutí / pohlceno kyrysem), 1 = lehké (1-2 HP), 2 = střední průstřel (3-4 HP), 3 = těžké/kritické/smrtící (5+ HP) */
  bloodSeverity?: 0 | 1 | 2 | 3;
  /** Počet stržených bodů zbroje (odletující kovové střepiny kyrysu) */
  armorShredded?: number;
  /** Počet bodů poškození pohlcených zbrojí */
  armorAbsorbed?: number;
  /** Zda cíl po zásahu padl k zemi */
  killed?: boolean;
  /** Typ zasažené překážky / zdiva při minutí cíle */
  impactObstacle?: ImpactObstacleKind;
  /** Přesná souřadnice dlaždice/překážky, do které narazila zbloudilá kulka při minutí */
  missImpactCoord?: GridCoord;
  extraTargets?: GridCoord[];
  detonatedKegs?: GridCoord[];
}

export interface BlastZoneEvent {
  id: number;
  coord: GridCoord;
  createdAt: number;
  baseRadius: number;
  maxRadius: number;
  isExplosion: boolean;
}

interface GameStoreState {
  grid: GridSystem;
  units: UnitData[];
  round: number;
  turn: Faction;
  reinforcementsSpawned: boolean;
  reinforcementRound: number;
  weather: WeatherType;
  gridVersion: number;
  smokeVersion: number;
  combatIntensity: number;
  blastZones: BlastZoneEvent[];
  outcome: "ongoing" | "victory" | "defeat";
  victoryReason: "boat_escape" | "annihilation" | null;
  defeatReason: CaptureReason | null;
  isCapturingAnim: boolean;

  selectedUnitId: string | null;
  activeFloor: FloorLevel;
  renderMode: RenderMode;
  cameraStep: number; // Kroky rotace kamery po 90° (Q/E)
  isFullscreen: boolean;

  actionMode: ActionMode;
  breakdownOpen: boolean; // Rozbalení postranních křídel matematického rozpisu (tlačítko Rozpad)
  /** Úplný přehled jednotky nebo terénu (F1 / 0). */
  inspectOpen: boolean;
  /** Držení F1 nebo 0. Klik v tomto stavu jen otevře přehled. */
  inspectKeyHeld: boolean;
  /** Klik během držení už přehled otevřel, takže puštění klávesy ho nezavře. */
  inspectClickConsumed: boolean;
  /** null = sledovat výběr. Jinak přichycený cíl z podrženého kliknutí. */
  inspectPin: InspectPin;
  fogOfWarEnabled: boolean; // Barokní šerosvit a mlha války (Chiaroscuro Fog of War)
  fogSnapshot: FogOfWarSnapshot;
  reachableTiles: Map<string, ReachableTile>;
  hoveredTile: GridCoord | null;
  hoveredPath: GridCoord[];
  hoveredSpottedEnemyIds: string[];
  visibleTargets: TargetEvaluation[];
  visibleMeleeTargets: MeleeTargetEvaluation[];
  selectedTargetId: string | null;

  isBusy: boolean;
  cameraDirector: CameraDirectorState;
  revealedPodEnemyIds: Set<string>;
  activeMovement: {
    unitId: string;
    from: GridCoord;
    path: GridCoord[];
    isActionCam?: boolean;
    interactionKind?: StepInteractionKind;
  } | null;
  activeProjectile: ProjectileVisual | null;
  /** Dynamické záblesky exploze a výstřelů pro osvětlení a rozptyl v dýmu (ADR-0011) */
  lightFlashes: ActiveLightFlash[];
  triggerLightFlash: (flash: Omit<ActiveLightFlash, "id" | "createdAt">) => void;
  unitFx: Record<string, UnitVisualFX>;
  combatLog: CombatLogEntry[];

  // Tutoriál a Taktický rádce (Mission 1 Onboarding)
  tutorialStep: 1 | 2 | 3 | 4 | null;
  tutorialDismissed: boolean;
  setTutorialStep: (step: 1 | 2 | 3 | 4 | null) => void;
  advanceTutorialStep: () => void;
  toggleTutorial: () => void;

  // Skriptovaný vedený tutoriál ve stylu XCOM 2 (Operation Gatecrasher)
  guidedTutorial: GuidedTutorialState;
  setGuidedTutorialStep: (step: GuidedTutorialStep) => void;
  skipGuidedTutorial: () => void;
  toggleGuidedTutorial: () => void;
  setGuidedTutorialReject: (msg: Phrase | null) => void;

  // Paradoxní oběť a Železná vigilie (Mission 1 Climax)
  sacrificeDilemmaOpen: boolean;
  sacrificedHeroId: string | null;
  ironVigilPerk: { perkId: PerkId; heroId: string } | null;
  chooseSacrifice: (heroId: string) => void;

  // Zvláštní aktivované schopnosti hrdinů (Mission 1 Smart Tutorial & Demo)
  demonstratedAbilities: Record<string, boolean>;
  activateSpecialAbility: (unitId?: string) => void;

  // Akce UI Controlleru a herní smyčky
  // Kinematická akční kamera (XCOM Action Cam)
  actionCamEnabled: boolean;
  toggleActionCam: () => void;
  setActionCamEnabled: (enabled: boolean) => void;

  selectUnit: (unitId: string) => void;
  setActiveFloor: (floor: FloorLevel) => void;
  toggleFloor: () => void;
  toggleFullscreen: () => void;
  setFullscreenState: (fs: boolean) => void;
  setRenderMode: (mode: RenderMode) => void;
  toggleRenderMode: () => void;
  setWeather: (weather: WeatherType) => void;
  cycleWeather: () => void;
  toggleFogOfWar: () => void;
  setFogOfWarEnabled: (enabled: boolean) => void;
  rotateCamera: (dir: 1 | -1) => void;
  setActionMode: (mode: ActionMode) => void;
  toggleBreakdown: () => void;
  beginInspectHold: () => void;
  endInspectHold: () => void;
  cancelInspectHold: () => void;
  closeInspect: () => void;
  selectTarget: (targetId: string) => void;
  cycleTarget: (dir: 1 | -1) => void;
  setHoveredTile: (coord: GridCoord | null) => void;
  previewEnemyMeleeHover: (enemyId: string | null) => void;
  handleTileClick: (coord: GridCoord) => void;
  handleTileRightClick: (coord: GridCoord) => void;
  handleUnitClick: (unitId: string) => void;
  handleUnitRightClick: (unitId: string) => void;
  handleRightClickCancel: () => void;
  completeUnitMovement: () => void;
  executeShoot: (targetId?: string) => void;
  executeReload: () => void;
  executeMelee: (targetId?: string, options?: { freeChainAp?: boolean }) => void;
  activateOverwatch: () => void;
  executeGrenade: (targetCoord: GridCoord) => void;
  toggleDoor: (coord: GridCoord) => void;
  endTurn: () => void;
  resetGame: () => void;
}

let logSeq = 1;
let fxSeq = 1;
let moveResolveCallback: (() => void) | null = null;

function makeLog(
  round: number,
  faction: Faction,
  message: Phrase,
  tone: CombatLogEntry["tone"] = "info",
): CombatLogEntry {
  return {
    id: `log-${logSeq++}`,
    round,
    faction,
    message,
    tone,
  };
}

/**
 * Fond dynamických záblesků (ADR-0011):
 * Udržuje max 2 explozivní světla a max 1 výstřelové světlo, vyřazuje prošlé.
 */
function addLightFlash(
  existing: ActiveLightFlash[],
  newFlash: Omit<ActiveLightFlash, "id" | "createdAt">,
  now = Date.now(),
): ActiveLightFlash[] {
  const kept = retainFlashes(existing, newFlash.kind, now);
  return [
    ...kept,
    {
      ...newFlash,
      id: fxSeq++,
      createdAt: now,
    },
  ];
}

function delay(ms: number): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Najde nejvýhodnější dosažitelnou dlaždici sousedící s nepřítelem pro XCOM 2 Zteč zblízka (Run & Slash).
 * Upřednostňuje:
 * 1. Aktuálně najetou dlaždici (`preferredCoord`), pokud již sousedí s cílem a je dosažitelná,
 * 2. Modrou zónu (1 AP) před žlutým sprintem (2 AP),
 * 3. Ortogonální sousedství (1m) a vyšší kvalitu krytu v cíli,
 * 4. Nejkratší vzdálenost od výchozí pozice útočníka.
 */
export function findBestMeleeChargeTile(
  grid: GridSystem,
  attacker: UnitData,
  enemy: UnitData,
  reachableTiles: Map<string, ReachableTile>,
  preferredCoord?: GridCoord | null,
): ReachableTile | null {
  if (!attacker.alive || !enemy.alive) return null;

  if (preferredCoord && isAdjacentForMelee(preferredCoord, enemy.pos)) {
    const prefReach = reachableTiles.get(coordKey(preferredCoord));
    if (prefReach) return prefReach;
  }

  let best: ReachableTile | null = null;
  let bestScore = -Infinity;

  for (const reach of reachableTiles.values()) {
    if (!isAdjacentForMelee(reach.coord, enemy.pos)) continue;

    const manhattan =
      Math.abs(reach.coord.x - enemy.pos.x) +
      Math.abs(reach.coord.z - enemy.pos.z);
    const cov = resolvePrimaryCoverDirection(grid, reach.coord).level;
    const covBonus = cov === "full" ? 15 : cov === "half" ? 8 : 0;
    const distFromAttacker = Math.hypot(
      reach.coord.x - attacker.pos.x,
      reach.coord.z - attacker.pos.z,
    );

    const score =
      -reach.apCost * 100 +
      (manhattan === 1 ? 20 : 0) +
      covBonus -
      distFromAttacker;

    if (score > bestScore) {
      bestScore = score;
      best = reach;
    }
  }

  return best;
}

/**
 * Spočítá metadata zásahu nebo minutí střely:
 * - Určí stupeň krvácení (`bloodSeverity`: 0 | 1 | 2 | 3) podle uděleného poškození, kritického zásahu a vyřazení cíle
 * - Při minutí (`hit === false`) vyhledá skutečnou překážku (kryt před cílem nebo zeď/pilíř za cílem),
 *   do které kulka narazí a ze které odletí kusy zdiva, omítky, dřevěných třísek a prachu.
 */
export function resolveShotImpactMetadata(
  grid: GridSystem,
  from: GridCoord,
  to: GridCoord,
  outcome: Pick<
    AttackOutcome,
    | "hit"
    | "critical"
    | "misfired"
    | "damage"
    | "armorShredded"
    | "armorAbsorbed"
    | "killed"
  >,
): {
  bloodSeverity: 0 | 1 | 2 | 3;
  impactObstacle: ImpactObstacleKind;
  missImpactCoord: GridCoord;
} {
  let bloodSeverity: 0 | 1 | 2 | 3 = 0;
  if (outcome.hit && !outcome.misfired && outcome.damage > 0) {
    if (
      outcome.damage >= 5 ||
      outcome.killed ||
      (outcome.critical && outcome.damage >= 3)
    ) {
      bloodSeverity = 3;
    } else if (outcome.damage >= 3 || outcome.critical) {
      bloodSeverity = 2;
    } else {
      bloodSeverity = 1;
    }
  }

  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.max(1, Math.hypot(dx, dz));
  const stepX = Math.round(dx / len);
  const stepZ = Math.round(dz / len);
  const perpX = -stepZ;
  const perpZ = stepX;

  // Kandidáti na zasaženou překážku při minutí:
  // 1) Kryt přímo před cílem (který střelu zastavil)
  // 2) Zeď / pilíř / barikáda přímo za cílem nebo šikmo vedle cíle ve směru palby
  const candidates: GridCoord[] = [
    { x: to.x - stepX, y: to.y, z: to.z - stepZ },
    { x: to.x + stepX, y: to.y, z: to.z + stepZ },
    { x: to.x + stepX + perpX, y: to.y, z: to.z + stepZ + perpZ },
    { x: to.x + stepX - perpX, y: to.y, z: to.z + stepZ - perpZ },
    { x: to.x + perpX, y: to.y, z: to.z + perpZ },
    { x: to.x - perpX, y: to.y, z: to.z - perpZ },
    to,
  ];

  for (const cand of candidates) {
    const t = grid.getTile(cand);
    if (!t) continue;
    if (t.obstacle === "high_wall") {
      return {
        bloodSeverity,
        impactObstacle: cand.z >= 15 ? "palace_stucco" : "high_wall",
        missImpactCoord: cand,
      };
    }
    if (t.obstacle === "pillar") {
      return {
        bloodSeverity,
        impactObstacle: "pillar",
        missImpactCoord: cand,
      };
    }
    if (t.obstacle === "low_wall") {
      return {
        bloodSeverity,
        impactObstacle: cand.z >= 15 ? "palace_wood" : "low_wall",
        missImpactCoord: cand,
      };
    }
  }

  const fallbackCoord: GridCoord = {
    x: Math.max(0, Math.min(grid.width - 1, to.x + stepX)),
    y: to.y,
    z: Math.max(0, Math.min(grid.depth - 1, to.z + stepZ)),
  };
  return {
    bloodSeverity,
    impactObstacle: to.z >= 15 ? "palace_stucco" : "cobble",
    missImpactCoord: fallbackCoord,
  };
}

/**
 * Sestaví přesný rozpis ztrát zasažené jednotky (`UnitCombatLoss`) pro přímé zobrazení nad cílem během útoku.
 */
export function buildUnitCombatLoss(
  beforeUnit: UnitData,
  afterUnit: UnitData,
  opts: {
    attackerId: string;
    weaponId: string;
    hit: boolean;
    critical: boolean;
    misfired: boolean;
    hitChance?: number;
    armorAbsorbed?: number;
    durationMs?: number;
  },
): UnitCombatLoss {
  const hpBefore = beforeUnit.hp;
  const hpAfter = afterUnit.hp;
  const hpLost = Math.max(0, hpBefore - hpAfter);
  const armorBefore = beforeUnit.armor;
  const armorAfter = Math.max(0, afterUnit.armor);
  const armorLost = Math.max(0, armorBefore - armorAfter);
  const apLost = Math.max(0, beforeUnit.ap - afterUnit.ap);
  const shakenApplied = !beforeUnit.isShaken && afterUnit.isShaken && hpAfter > 0;
  const overwatchLost = beforeUnit.isOverwatch && !afterUnit.isOverwatch;
  const detainedApplied =
    (beforeUnit.detainedTurns ?? 0) === 0 && (afterUnit.detainedTurns ?? 0) > 0;
  const enteredDeathThroes = !beforeUnit.inDeathThroes && (afterUnit.inDeathThroes ?? false);
  const killed = beforeUnit.alive && !afterUnit.alive;
  const instantKilled = killed && isInstantOverkill(hpAfter, beforeUnit.maxHp);

  return {
    id: fxSeq++,
    timestamp: performance.now(),
    durationMs: opts.durationMs ?? 1500,
    attackerId: opts.attackerId,
    weaponId: opts.weaponId,
    hit: opts.hit,
    critical: opts.critical,
    misfired: opts.misfired,
    hitChance: opts.hitChance,
    hpBefore,
    hpAfter,
    hpLost,
    maxHp: beforeUnit.maxHp,
    armorBefore,
    armorAfter,
    armorLost,
    armorAbsorbed: opts.armorAbsorbed ?? 0,
    maxArmor: Math.max(beforeUnit.maxArmor, armorBefore),
    apLost,
    shakenApplied,
    overwatchLost,
    detainedApplied,
    killed,
    enteredDeathThroes,
    instantKilled,
  };
}

/**
 * Čerstvý vstup do Posledního vzepětí vždy dluží 1 aktivaci.
 * Už probíhající agónie si ponechá uložené deathThroesTurns, včetně 0 (tah už byl vydán).
 */
function deathThroesTurnsAfterHit(unit: UnitData, inThroes: boolean): number {
  if (!inThroes) return 0;
  if (unit.inDeathThroes) return unit.deathThroesTurns ?? 1;
  return 1;
}

/**
 * Vyhodnotí okamžitý stav zadržení nebo vyproštění maršála Colloreda:
 * 1. Zadržení jen živým Švédem na sousedním poli bez eskorty. HP <= 0 je Poslední vzepětí, ne pád k zemi.
 * 2. Vyproštění eskortou zruší zadržení a nevrací záporné HP (ADR-0012: v Misi 1 není polní léčení).
 * Umírající společník je eskortou. Umírající nepřítel zajmout nesmí.
 */
export function syncColloredoCaptureState(units: UnitData[]): {
  units: UnitData[];
  newlyDetained: boolean;
  rescued: boolean;
  reason: CaptureReason | null;
} {
  const colloredo = units.find((u) => u.id === "player-colloredo" && u.alive);
  if (!colloredo) {
    return { units, newlyDetained: false, rescued: false, reason: null };
  }

  const besideMarshal = (u: UnitData) =>
    u.pos.y === colloredo.pos.y &&
    Math.abs(u.pos.x - colloredo.pos.x) <= 1 &&
    Math.abs(u.pos.z - colloredo.pos.z) <= 1;

  const hasAllyEscort = units.some(
    (u) =>
      u.faction === "player" &&
      u.id !== colloredo.id &&
      isUnitFighting(u) &&
      besideMarshal(u),
  );

  const hasEnemyCaptorNearby = units.some(
    (u) =>
      u.faction === "enemy" &&
      u.alive &&
      u.hp > 0 &&
      !u.inDeathThroes &&
      besideMarshal(u),
  );

  const allCompanionsDead = !units.some(
    (u) =>
      u.faction === "player" &&
      u.id !== colloredo.id &&
      isUnitFighting(u),
  );

  const prevDetained = colloredo.detainedTurns ?? 0;
  const marshalInThroes = !!colloredo.inDeathThroes || colloredo.hp <= 0;

  // 1. Vyproštění maršála (pokud byl zadržen 1. kolem a ještě nebyl odvlečen)
  if (prevDetained > 0 && prevDetained < 2) {
    const canRescueStanding =
      !marshalInThroes && (!hasEnemyCaptorNearby || hasAllyEscort);
    const canRescueDying =
      marshalInThroes && hasAllyEscort && !hasEnemyCaptorNearby;

    if (canRescueStanding || canRescueDying) {
      const nextUnits = units.map((u) =>
        u.id === colloredo.id
          ? {
              ...u,
              ap: Math.max(u.ap, marshalInThroes ? u.ap : 1),
              detainedTurns: 0,
              captureReason: null,
              isShaken: marshalInThroes ? u.isShaken : false,
            }
          : u,
      );
      return {
        units: nextUnits,
        newlyDetained: false,
        rescued: true,
        reason: null,
      };
    }
  }

  // 2. Nové zadržení jen živým Švédem bez eskorty
  const shouldDetain = hasEnemyCaptorNearby && !hasAllyEscort;

  if (prevDetained === 0 && shouldDetain) {
    const reason: CaptureReason = allCompanionsDead
      ? "all_companions_fallen"
      : "surrounded_unprotected";

    const nextUnits = units.map((u) =>
      u.id === colloredo.id
        ? {
            ...u,
            alive: true,
            ap: 0,
            isOverwatch: false,
            detainedTurns: 1,
            captureReason: reason,
          }
        : u,
    );
    return {
      units: nextUnits,
      newlyDetained: true,
      rescued: false,
      reason,
    };
  }

  // 3. Pokud je již zadržen, pojistíme AP = 0 a aktualizujeme důvod
  if (prevDetained >= 1) {
    const updatedReason: CaptureReason = allCompanionsDead
      ? "all_companions_fallen"
      : (colloredo.captureReason ?? "surrounded_unprotected");

    const nextUnits = units.map((u) =>
      u.id === colloredo.id
        ? {
            ...u,
            alive: true,
            ap: 0,
            isOverwatch: false,
            captureReason: updatedReason,
          }
        : u,
    );
    return {
      units: nextUnits,
      newlyDetained: false,
      rescued: false,
      reason: updatedReason,
    };
  }

  return { units, newlyDetained: false, rescued: false, reason: null };
}

/**
 * Posune počítadlo zadržení maršála Colloreda na konci kola.
 * Úspěšné zajetí (a Game Over) nastane, když je maršál nepřáteli zadržen 2 kola (detainedTurns >= 2).
 */
export function advanceColloredoDetentionTurn(units: UnitData[]): {
  units: UnitData[];
  capturedNow: boolean;
  detainedTurns: number;
  captureReason: CaptureReason | null;
} {
  const synced = syncColloredoCaptureState(units);
  const colloredo = synced.units.find(
    (u) => u.id === "player-colloredo" && u.alive,
  );
  if (!colloredo || (colloredo.detainedTurns ?? 0) === 0) {
    return {
      units: synced.units,
      capturedNow: false,
      detainedTurns: 0,
      captureReason: null,
    };
  }

  const nextDetained = (colloredo.detainedTurns ?? 0) + 1;
  const allCompanionsDead = !synced.units.some(
    (u) =>
      u.faction === "player" &&
      u.id !== colloredo.id &&
      isUnitFighting(u),
  );
  const reason: CaptureReason = allCompanionsDead
    ? "all_companions_fallen"
    : (colloredo.captureReason ?? "surrounded_unprotected");

  const updatedUnits = synced.units.map((u) =>
    u.id === colloredo.id
      ? {
          ...u,
          alive: true,
          ap: 0,
          isOverwatch: false,
          detainedTurns: nextDetained,
          captureReason: reason,
        }
      : u,
  );

  return {
    units: updatedUnits,
    capturedNow: nextDetained >= 2,
    detainedTurns: nextDetained,
    captureReason: reason,
  };
}

/**
 * Synchronizuje stav zadržení a postih těžkého kulhání maršála Colloreda.
 * Zranění z Lützenu 1632 (7 střelných ran, zmrzačená noha) omezuje maršála na 3 pole/AP.
 * Pokud je maršál zadržen Švédy (detainedTurns >= 1), nemůže se sám pohybovat (movePerAp = 0), dokud jej družina nevyprostí.
 * Za běžného stavu má trvalý postih „Těžké kulhání (zranění z Lützenu)“ s rychlostí 3 pole/AP.
 */
export function syncColloredoMobility(units: UnitData[]): UnitData[] {
  const captureSynced = syncColloredoCaptureState(units).units;
  const colloredo = captureSynced.find(
    (u) => u.id === "player-colloredo" && u.alive,
  );
  if (!colloredo) return captureSynced;

  const detainedTurns = colloredo.detainedTurns ?? 0;
  if (detainedTurns >= 1) {
    const buffId: BuffId = detainedTurns >= 2 ? "detained_2" : "detained_1";
    if (colloredo.movePerAp === 0 && colloredo.buffId === buffId) {
      return captureSynced;
    }
    return captureSynced.map((u) =>
      u.id === colloredo.id
        ? { ...u, movePerAp: 0, ap: 0, buffId, buffTitle: buffLabel(buffId) }
        : u,
    );
  }

  if (colloredo.movePerAp === 3 && colloredo.buffId === "limp") {
    return captureSynced;
  }

  return captureSynced.map((u) =>
    u.id === colloredo.id
      ? { ...u, movePerAp: 3, buffId: "limp", buffTitle: buffLabel("limp") }
      : u,
  );
}

/**
 * Nalezne nejbližší volnou pochůznou souřadnici pro vstup posil na bojiště,
 * pokud by původní vstupní brána byla zablokována jinou jednotkou.
 */
export function findFreeSpawnCoord(
  grid: GridSystem,
  existingUnits: UnitData[],
  preferred: GridCoord,
): GridCoord {
  const prefTile = grid.getTile(preferred);
  if (
    prefTile?.walkable &&
    !existingUnits.some((u) => u.alive && sameCoord(u.pos, preferred))
  ) {
    return preferred;
  }
  for (let r = 1; r <= 3; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const c: GridCoord = {
          x: preferred.x + dx,
          y: preferred.y,
          z: preferred.z + dz,
        };
        const tile = grid.getTile(c);
        if (
          tile?.walkable &&
          !existingUnits.some((u) => u.alive && sameCoord(u.pos, c))
        ) {
          return c;
        }
      }
    }
  }
  return preferred;
}

/**
 * Automaticky vyhledá následujícího bojeschopného vojáka hráče s volnými AP (ap > 0).
 * Pokud má aktuálně vybraná jednotka stále volné AP (ap > 0), ponechá ji vybranou.
 * Jakmile jednotka vyčerpá svůj tah (ap === 0), přepne automaticky na dalšího vojáka v pořadí.
 */
export function findNextAvailablePlayerUnit(
  units: UnitData[],
  currentSelectedId: string | null,
): UnitData | null {
  const synced = syncColloredoMobility(units);
  const playerUnits = synced.filter(
    (u) =>
      u.faction === "player" &&
      isUnitFighting(u) &&
      (u.detainedTurns ?? 0) === 0,
  );
  if (playerUnits.length === 0) return null;

  const currentUnit = playerUnits.find((u) => u.id === currentSelectedId);
  // Pokud má stávající jednotka stále AP > 0, ponecháme ji vybranou!
  if (currentUnit && currentUnit.ap > 0) {
    return currentUnit;
  }

  // Pokud stávající jednotka vyčerpala AP (ap === 0), hledáme dalšího vojáka v pořadí družiny s ap > 0
  const currentRosterIdx = synced.findIndex((u) => u.id === currentSelectedId);
  if (currentRosterIdx >= 0) {
    for (let i = 1; i <= synced.length; i++) {
      const idx = (currentRosterIdx + i) % synced.length;
      const candidate = synced[idx];
      if (
        candidate &&
        candidate.faction === "player" &&
        isUnitFighting(candidate) &&
        candidate.ap > 0 &&
        (candidate.detainedTurns ?? 0) === 0
      ) {
        return candidate;
      }
    }
  }

  // Pokud nebyl nalezen žádný v kruhovém pořadí, vezmeme prvního s AP > 0
  const firstWithAp = playerUnits.find((u) => u.ap > 0);
  if (firstWithAp) return firstWithAp;

  // Pokud VŠICHNI vojáci vyčerpali svoje AP (0 AP), ponecháme stávající jednotku nebo první živou
  return currentUnit ?? playerUnits[0] ?? null;
}

function extractDynamicLights(blastZones: BlastZoneEvent[]): DynamicLightSource[] {
  return blastZones.slice(-8).map((bz) => ({
    coord: bz.coord,
    radius: bz.isExplosion ? 2.8 : 1.8,
  }));
}

function deriveSelectionData(
  grid: GridSystem,
  units: UnitData[],
  selectedId: string | null,
  weather: WeatherType,
  preferredTargetId?: string | null,
  prevExploredCoords?: Set<string>,
  blastZones: BlastZoneEvent[] = [],
  fogOfWarEnabled = true,
) {
  const syncedUnits = syncColloredoMobility(units);
  const baseExplored = prevExploredCoords ?? createInitialExploredCoords(grid);
  const dynamicLights = extractDynamicLights(blastZones);
  const fogSnapshot = computeFogOfWar(
    grid,
    syncedUnits,
    weather,
    baseExplored,
    dynamicLights,
  );
  const unit = syncedUnits.find((u) => u.id === selectedId && u.alive);
  if (!unit || unit.faction !== "player") {
    return {
      reachableTiles: new Map<string, ReachableTile>(),
      visibleTargets: [] as TargetEvaluation[],
      visibleMeleeTargets: [] as MeleeTargetEvaluation[],
      selectedTargetId: null as string | null,
      units: syncedUnits,
      fogSnapshot,
    };
  }
  const isDetained = (unit.detainedTurns ?? 0) > 0 || !isUnitFighting(unit);
  const reachableTiles = isDetained
    ? new Map<string, ReachableTile>()
    : computeReachableTiles(grid, unit, syncedUnits);
  const visibleFilter = fogOfWarEnabled
    ? fogSnapshot.visibleEnemyIds
    : undefined;
  const visibleTargets = isDetained
    ? ([] as TargetEvaluation[])
    : evaluateVisibleTargets(grid, unit, syncedUnits, weather, visibleFilter);
  const visibleMeleeTargets = isDetained
    ? ([] as MeleeTargetEvaluation[])
    : evaluateAdjacentMeleeTargets(grid, unit, syncedUnits, visibleFilter);
  const keepTarget =
    preferredTargetId &&
    (visibleTargets.some((t) => t.targetId === preferredTargetId) ||
      visibleMeleeTargets.some((t) => t.targetId === preferredTargetId))
      ? preferredTargetId
      : (visibleTargets[0]?.targetId ?? visibleMeleeTargets[0]?.targetId ?? null);
  return {
    reachableTiles,
    visibleTargets,
    visibleMeleeTargets,
    selectedTargetId: keepTarget,
    units: syncedUnits,
    fogSnapshot,
  };
}

/**
 * Vyhodnotí stav mise 1:
 * - Vítězství 1 (Útěk): Maršál Colloredo dosáhl rybářské pramice na Čertovce (tile.isEscapeZone === true) a není zadržen.
 * - Vítězství 2 (Vojenské): Švédský přepadový oddíl Arnošta Odowalského byl pobit.
 * - Porážka: Polní maršál Colloredo (VIP) je zadržen Švédy po dobu 2 kol (detainedTurns >= 2) nebo padla celá jeho družina, když je sražen.
 */
export function checkMissionOutcome(
  grid: GridSystem,
  units: UnitData[],
): {
  outcome: "ongoing" | "victory" | "defeat";
  victoryReason: "boat_escape" | "annihilation" | null;
  defeatReason: CaptureReason | null;
} {
  const colloredo = units.find((u) => u.id === "player-colloredo");
  if (!colloredo || !colloredo.alive) {
    return {
      outcome: "defeat",
      victoryReason: null,
      defeatReason: colloredo?.captureReason ?? "zero_hp",
    };
  }

  // Zajetí nastane až po 2 kolech zadržení (detainedTurns >= 2)
  if ((colloredo.detainedTurns ?? 0) >= 2) {
    return {
      outcome: "defeat",
      victoryReason: null,
      defeatReason: colloredo.captureReason ?? "zero_hp",
    };
  }

  // Pokud je maršál zadržen a všichni ostatní obránci padli, nikdo jej už nemůže vyprostit
  const activeRescuers = units.some(
    (u) =>
      u.faction === "player" &&
      u.alive &&
      (u.hp > 0 || (u.inDeathThroes ?? false)) &&
      (u.detainedTurns ?? 0) === 0,
  );
  if (!activeRescuers) {
    return {
      outcome: "defeat",
      victoryReason: null,
      defeatReason: "all_companions_fallen",
    };
  }

  const colloredoTile = grid.getTile(colloredo.pos);
  if (
    colloredoTile?.isEscapeZone &&
    colloredo.alive &&
    (colloredo.detainedTurns ?? 0) === 0
  ) {
    return { outcome: "victory", victoryReason: "boat_escape", defeatReason: null };
  }
  const enemiesAlive = units.some((u) => u.faction === "enemy" && u.alive);
  if (!enemiesAlive) {
    return { outcome: "victory", victoryReason: "annihilation", defeatReason: null };
  }
  return { outcome: "ongoing", victoryReason: null, defeatReason: null };
}

/**
 * Zpracuje výbuchy petard a řetězové detonace prachových sudů (Powder Kegs).
 */
interface ExplosionResult {
  nextUnits: UnitData[];
  detonatedKegs: GridCoord[];
  victims: string[];
}

function processExplosions(
  grid: GridSystem,
  units: UnitData[],
  blastCoord: GridCoord,
  damage = 5,
  armorShred = 2,
  weather: WeatherType = "clear",
): ExplosionResult {
  const detonatedKegs: GridCoord[] = [];
  const victims: string[] = [];
  const queue: GridCoord[] = [blastCoord];
  const visitedKegs = new Set<string>();

  let currentUnits = [...units];

  while (queue.length > 0) {
    const center = queue.shift()!;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c: GridCoord = {
          x: center.x + dx,
          y: center.y,
          z: center.z + dz,
        };
        const tile = grid.getTile(c);
        if (!tile) continue;

        if (tile.obstacle === "powder_keg") {
          const key = coordKey(c);
          if (!visitedKegs.has(key)) {
            visitedKegs.add(key);
            grid.setObstacle(c, "none");
            detonatedKegs.push(c);
            queue.push(c);
          }
        } else if (tile.obstacle === "low_wall") {
          grid.setObstacle(c, "none");
        }
        grid.damageTile(c, 2);
      }
    }

    // Fyzika rázové vlny exploze (ADR-0011): Epicentrum je vyfouknuto (0), obvod absorbuje kouř
    grid.applyExplosionShockwave(center, 1, weather);

    currentUnits = currentUnits.map((u) => {
      if (!u.alive) return u;
      const inBlast =
        u.pos.y === center.y &&
        Math.abs(u.pos.x - center.x) <= 1 &&
        Math.abs(u.pos.z - center.z) <= 1;
      if (!inBlast) return u;

      if (!victims.includes(u.id)) victims.push(u.id);
      const nextArmor = Math.max(0, u.armor - armorShred);
      const nextHp = u.hp - damage;
      const instantKilled = isInstantOverkill(nextHp, u.maxHp);
      const inThroes = !instantKilled && nextHp <= 0;
      return {
        ...u,
        armor: nextArmor,
        hp: nextHp,
        isShaken: nextHp > 0,
        alive: !instantKilled,
        inDeathThroes: inThroes,
        deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
        isOverwatch: nextHp > 0 ? u.isOverwatch : false,
      };
    });
  }

  grid.bakeCoverFromObstacles();

  return { nextUnits: currentUnits, detonatedKegs, victims };
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const initialGrid = createInitialGrid();
  const initialUnits = createInitialUnits();
  const initialWeather: WeatherType = "rain";
  const firstPlayerId =
    initialUnits.find((u) => u.id === "player-jan-matej")?.id ??
    initialUnits.find((u) => u.faction === "player")?.id ??
    null;
  const derived = deriveSelectionData(
    initialGrid,
    initialUnits,
    firstPlayerId,
    initialWeather,
  );

  const triggerUnitFx = (
    unitId: string,
    patch: Partial<{
      lunge: boolean;
      hit: boolean;
      coverSettle: boolean;
      coverSettleDir: CardinalDir | null;
      banner: {
        phrase: Phrase;
        tone: "hit" | "crit" | "miss" | "misfire" | "overwatch" | "buff";
      };
      loss: UnitCombatLoss | null;
    }>,
  ) => {
    const now = performance.now();
    set((state) => {
      const prev = state.unitFx[unitId] ?? {
        lungeTimestamp: 0,
        hitTimestamp: 0,
        coverSettleTimestamp: 0,
        coverSettleDir: null,
        floatingBanner: null,
        combatLoss: null,
      };
      return {
        unitFx: {
          ...state.unitFx,
          [unitId]: {
            lungeTimestamp: patch.lunge ? now : prev.lungeTimestamp,
            hitTimestamp: patch.hit ? now : prev.hitTimestamp,
            coverSettleTimestamp: patch.coverSettle
              ? now
              : prev.coverSettleTimestamp,
            coverSettleDir:
              patch.coverSettleDir !== undefined
                ? patch.coverSettleDir
                : prev.coverSettleDir,
            floatingBanner: patch.banner
              ? { id: fxSeq++, ...patch.banner }
              : prev.floatingBanner,
            combatLoss:
              patch.loss !== undefined ? patch.loss : prev.combatLoss,
          },
        },
      };
    });
  };

  const animateUnitAlongPath = (
    unitId: string,
    path: GridCoord[],
    opts?: {
      isActionCam?: boolean;
      interactionKind?: StepInteractionKind;
    },
  ): Promise<void> => {
    if (path.length === 0) return Promise.resolve();
    const unit = get().units.find((u) => u.id === unitId);
    if (!unit) return Promise.resolve();

    const interactions = detectPathInteractions(get().grid, unit.pos, path);
    const isActionCam =
      opts?.isActionCam ??
      (get().actionCamEnabled &&
        unit.faction === "player" &&
        (path.length > unit.movePerAp ||
          interactions.hasDoorBreach ||
          interactions.hasVault ||
          interactions.hasStairs));
    const interactionKind =
      opts?.interactionKind ?? interactions.firstInteraction;

    if (typeof window === "undefined") {
      // V bezhlavém (headless) testovacím prostředí otevřeme vyražené dveře na trase okamžitě
      if (interactions.hasDoorBreach) {
        for (const dc of interactions.doorCoords) {
          get().grid.setDoorState(dc, "open");
        }
      }
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      moveResolveCallback = resolve;
      set((s) => ({
        activeMovement: {
          unitId,
          from: { ...unit.pos },
          path,
          isActionCam,
          interactionKind,
        },
        cameraDirector: {
          ...s.cameraDirector,
          mode: isActionCam ? "ACTION_OTS_FOLLOW" : "TACTICAL_ISO",
        },
      }));
    });
  };

  /**
   * Event Interrupt 3a: Pod Reveal & Scramble.
   * Zastaví pohyb, provede rychlý přelet kamery (Pan & Zoom) na nově odhalenou skupinu mušketýrů/pikenýrů,
   * spustí jejich "Scramble" přesun o 1–2 dlaždice do nejbližšího krytu a vrátí kameru k vojákovi.
   */
  const performPodRevealAndScramble = async (
    spotterUnitId: string,
    spotterCoord: GridCoord,
    newlySpottedEnemies: UnitData[],
  ) => {
    if (newlySpottedEnemies.length === 0) return;

    // Najdeme celou skupinu (pod) v okolí odhalených nepřátel (do vzdálenosti 4 polí)
    const state = get();
    const podMembers = state.units.filter(
      (u) =>
        u.faction === "enemy" &&
        isUnitFighting(u) &&
        (newlySpottedEnemies.some((s) => s.id === u.id) ||
          newlySpottedEnemies.some(
            (s) =>
              s.pos.y === u.pos.y &&
              Math.abs(s.pos.x - u.pos.x) <= 4 &&
              Math.abs(s.pos.z - u.pos.z) <= 4 &&
              !state.revealedPodEnemyIds.has(u.id),
          )),
    );

    if (podMembers.length === 0) return;

    // Spočítáme těžiště odhalené hlídky pro Pan & Zoom kamery
    const avgX = Math.round(
      podMembers.reduce((acc, u) => acc + u.pos.x, 0) / podMembers.length,
    );
    const avgZ = Math.round(
      podMembers.reduce((acc, u) => acc + u.pos.z, 0) / podMembers.length,
    );
    const focusFloor = podMembers[0]!.pos.y;
    const focusCoord: GridCoord = { x: avgX, y: focusFloor, z: avgZ };

    const nowTs = performance.now();
    const nextRevealed = new Set(state.revealedPodEnemyIds);
    for (const m of podMembers) {
      nextRevealed.add(m.id);
    }

    set((s) => ({
      activeFloor: focusFloor,
      revealedPodEnemyIds: nextRevealed,
      cameraDirector: {
        ...s.cameraDirector,
        mode: "INTERRUPT_POD_REVEAL",
        podReveal: {
          spotterUnitId,
          spotterCoord,
          revealedEnemyIds: podMembers.map((m) => m.id),
          focusCoord,
          startedAt: nowTs,
          durationMs: 1150,
        },
      },
      combatLog: [
        ...s.combatLog,
        makeLog(
          s.round,
          "enemy",
          phrase("log.podReveal", {
            unitIds: podMembers.map((m) => m.id),
          }),
          "alert",
        ),
      ],
    }));

    // Zobrazíme bojový poplach nad odhalenými nepřáteli a vypočítáme jejich Scramble přesun do krytu
    let currentUnits = [...get().units];
    for (const member of podMembers) {
      triggerUnitFx(member.id, {
        banner: { phrase: phrase("banner.alarm"), tone: "overwatch" },
      });

      const scrambleDest = computeScrambleDestination(
        get().grid,
        member,
        currentUnits,
        spotterCoord,
      );
      const targetPos = scrambleDest ?? member.pos;
      const scrambleFacing = facingFromDelta(
        targetPos,
        spotterCoord,
        member.facing,
      );

      currentUnits = currentUnits.map((u) =>
        u.id === member.id
          ? {
              ...u,
              pos: targetPos,
              facing: scrambleFacing,
            }
          : u,
      );
    }

    // Krátká pauza na přelet kamery (Pan & Zoom), následně nepřátelé zaskočí do krytu (Scramble)
    await delay(350);

    set((s) => {
      const synced = syncColloredoMobility(currentUnits);
      const nextFog = computeFogOfWar(
        s.grid,
        synced,
        s.weather,
        s.fogSnapshot.exploredCoords,
        extractDynamicLights(s.blastZones),
      );
      return {
        units: synced,
        fogSnapshot: nextFog,
      };
    });

    await delay(750);

    set((s) => ({
      activeFloor: spotterCoord.y,
      cameraDirector: {
        ...s.cameraDirector,
        mode: "TACTICAL_ISO",
        podReveal: null,
      },
    }));
  };

  const playCaptureFinalAnimationAndDefeat = async (
    reason: CaptureReason,
    roundNum: number,
  ) => {
    const colloredo = get().units.find((u) => u.id === "player-colloredo");

    set((s) => ({
      isBusy: true,
      isCapturingAnim: true,
      activeFloor: colloredo ? colloredo.pos.y : s.activeFloor,
      combatLog: [
        ...s.combatLog,
        makeLog(
          roundNum,
          "enemy",
          phrase("log.capture.done", { capture: reason }),
          "alert",
        ),
      ],
    }));

    triggerUnitFx("player-colloredo", {
      hit: true,
      banner: { phrase: phrase("banner.captured"), tone: "crit" },
    });

    await delay(900);

    set({
      isBusy: false,
      isCapturingAnim: false,
      outcome: "defeat",
      victoryReason: null,
      defeatReason: reason,
    });
  };

  const performOverwatchReactionsIfAny = async (
    movedUnitId: string,
    destCoord: GridCoord,
    movementPath?: GridCoord[],
  ) => {
    const state = get();
    const movedUnit = state.units.find((u) => u.id === movedUnitId);
    if (!movedUnit || !movedUnit.alive) return;

    // Trasa pohybu (nebo fallback na cílové pole)
    const evaluatedPath =
      movementPath && movementPath.length > 0 ? movementPath : [destCoord];

    // Najdeme hlídkující vojáky opačné frakce s nabitou zbraní
    const potentialWatchers = state.units.filter(
      (u) =>
        isUnitFighting(u) &&
        u.faction !== movedUnit.faction &&
        u.isOverwatch &&
        u.firearmLoaded !== false &&
        (u.id !== "player-colloredo" || u.pistolLoaded !== false),
    );

    if (potentialWatchers.length === 0) return;

    for (const watcher of potentialWatchers) {
      const currentMoved = get().units.find((u) => u.id === movedUnitId);
      if (!currentMoved || !isUnitFighting(currentMoved)) break;

      // Zkontrolujeme, zda střelec má stále aktivní hlídku a nabitou zbraň
      const freshWatcher = get().units.find((u) => u.id === watcher.id);
      if (
        !freshWatcher ||
        !isUnitFighting(freshWatcher) ||
        !freshWatcher.isOverwatch ||
        freshWatcher.firearmLoaded === false
      ) {
        continue;
      }

      // Švédové po hraběti nikdy nestřílí (ani v reakční palbě / Overwatch)!
      if (freshWatcher.faction === "enemy" && movedUnitId === "player-colloredo") {
        continue;
      }

      const isConeMode =
        freshWatcher.weapon.overwatchMode === "prepared_volley_cone";

      // XCOM taktika: Hlídkující hledá moment na trase, kdy nepřítel běží
      // U doutnákových mušket (Připravená salva) musí cíl vstoupit do předního kuželu (90°)
      type CandidateStep = {
        coord: GridCoord;
        cover: CoverLevel;
        isFlanked: boolean;
        dist: number;
        index: number;
      };

      const validSteps: CandidateStep[] = [];

      for (let i = 0; i < evaluatedPath.length; i++) {
        const step = evaluatedPath[i]!;
        const dist = gridDistance3D(freshWatcher.pos, step);
        if (dist > freshWatcher.weapon.maxRange) continue;

        if (
          isConeMode &&
          !isInPreparedVolleyCone(freshWatcher.pos, freshWatcher.facing, step)
        ) {
          continue;
        }

        // Kontrola ochrany hrabětem: Švédové nebudou střílet na hráčskou postavu,
        // pokud je do tří políček od hraběte a střelec vidí hraběte
        if (freshWatcher.faction === "enemy") {
          const simulatedTarget: UnitData = {
            ...currentMoved,
            pos: step,
          };
          if (
            isCompanionProtectedByCount(
              get().grid,
              freshWatcher.pos,
              simulatedTarget,
              get().units,
            )
          ) {
            continue;
          }
        }

        // Kontrola 3D přímé viditelnosti
        const los = checkLineOfSight3D(get().grid, freshWatcher.pos, step);
        if (!los.clear) continue;

        // Kontrola mlhy války (musí být viditelný v šerosvitu pozorovatele)
        const fogCheck = checkFogLineOfSight3D(
          get().grid,
          freshWatcher.pos,
          step,
          false,
        );
        if (!fogCheck) continue;

        // Kontrola krytu na daném poli vůči střelci: nepřítel NESMÍ být v krytu (žádný Full Cover)
        const coverRes = resolveTargetCoverAgainstShot(
          get().grid,
          freshWatcher.pos,
          step,
        );

        if (coverRes.cover !== "full") {
          validSteps.push({
            coord: step,
            cover: coverRes.cover,
            isFlanked: coverRes.cover === "none",
            dist,
            index: i,
          });
        }
      }

      // Pokud na žádném poli nebyl cíl nekrytý a viditelný, zkusíme fallback na cílové pole pouze pokud není za plnou zdí
      let ambushStep: CandidateStep | null = null;
      if (validSteps.length > 0) {
        // Preferujeme pole bez jakéhokoliv krytu (cover === 'none' / obchvat),
        // následně co nejblíže optimálnímu dostřelu střelce a blíže začátku pohybu (rychlý záchyt)
        validSteps.sort((a, b) => {
          if (a.isFlanked && !b.isFlanked) return -1;
          if (!a.isFlanked && b.isFlanked) return 1;
          const aDistDiff = Math.abs(a.dist - freshWatcher.weapon.optimalRange);
          const bDistDiff = Math.abs(b.dist - freshWatcher.weapon.optimalRange);
          if (aDistDiff !== bDistDiff) return aDistDiff - bDistDiff;
          return a.index - b.index;
        });
        ambushStep = validSteps[0]!;
      } else {
        const distToDest = gridDistance3D(freshWatcher.pos, destCoord);
        const losDest = checkLineOfSight3D(get().grid, freshWatcher.pos, destCoord);
        const inDestCone =
          !isConeMode ||
          isInPreparedVolleyCone(
            freshWatcher.pos,
            freshWatcher.facing,
            destCoord,
          );
        if (
          inDestCone &&
          distToDest <= freshWatcher.weapon.maxRange &&
          losDest.clear
        ) {
          const destCover = resolveTargetCoverAgainstShot(
            get().grid,
            freshWatcher.pos,
            destCoord,
          );
          if (destCover.cover !== "full") {
            ambushStep = {
              coord: destCoord,
              cover: destCover.cover,
              isFlanked: destCover.cover === "none",
              dist: distToDest,
              index: evaluatedPath.length - 1,
            };
          }
        }
      }

      if (!ambushStep) continue;

      const ambushCoord = ambushStep.coord;

      // 1. Event Interrupt 3b: Overwatch Slow-Mo (Fáze A: SHOOTER_FOCUS)
      // Zpomalíme čas (timeScale = 0.25), kamera zabere střelce v oblaku střelného prachu
      const slowMoStartTs = performance.now();
      set((s) => ({
        activeFloor: freshWatcher.pos.y,
        cameraDirector: {
          ...s.cameraDirector,
          mode: "INTERRUPT_OVERWATCH_SLOWMO",
          timeScale: 0.25,
          overwatchSlowMo: {
            watcherUnitId: freshWatcher.id,
            watcherCoord: freshWatcher.pos,
            targetUnitId: currentMoved.id,
            ambushCoord,
            subPhase: "SHOOTER_FOCUS",
            startedAt: slowMoStartTs,
            durationMs: 1750,
          },
        },
        units: s.units.map((u) =>
          u.id === freshWatcher.id
            ? {
                ...u,
                facing: facingFromDelta(u.pos, ambushCoord, u.facing),
              }
            : u,
        ),
      }));

      triggerUnitFx(freshWatcher.id, {
        banner: { phrase: phrase("banner.spotted"), tone: "overwatch" },
      });

      // 2. Záběr na střelce před výstřelem v zpomaleném čase
      await delay(650);

      // Znovu ověříme stav před samotným výstřelem (zda mezitím hra neskončila)
      const targetUnitNow = get().units.find((u) => u.id === movedUnitId);
      if (!targetUnitNow || !isUnitFighting(targetUnitNow)) {
        set((s) => ({
          cameraDirector: {
            ...s.cameraDirector,
            mode: "TACTICAL_ISO",
            timeScale: 1.0,
            overwatchSlowMo: null,
          },
        }));
        break;
      }

      const calculation = calculateShot(
        get().grid,
        freshWatcher,
        { ...targetUnitNow, pos: ambushCoord },
        get().weather,
        freshWatcher.pos,
      );

      const outcome = rollRangedAttack(
        freshWatcher,
        targetUnitNow,
        calculation,
        Math.random,
        0.85,
      );

      // Výstřel z Overwatch vytvoří oblak kouře z černého prachu na dlaždici střelce
      if (!outcome.misfired) {
        get().grid.addSmoke(freshWatcher.pos, 0, 2);
      }

      if (outcome.misfired) {
        playMisfireSound();
      } else {
        playGunshotSound(freshWatcher.weapon.lockType === "wheellock");
      }

      const impactMeta = resolveShotImpactMetadata(
        get().grid,
        freshWatcher.pos,
        ambushCoord,
        outcome,
      );
      const nowTs = performance.now();
      set((s) => ({
        activeFloor: ambushCoord.y,
        smokeVersion: s.smokeVersion + 1,
        combatIntensity: s.combatIntensity + 1,
        cameraDirector: {
          ...s.cameraDirector,
          mode: "INTERRUPT_OVERWATCH_SLOWMO",
          timeScale: 0.35,
          overwatchSlowMo: s.cameraDirector.overwatchSlowMo
            ? {
                ...s.cameraDirector.overwatchSlowMo,
                subPhase: "RUNNER_TRACK",
              }
            : null,
        },
        blastZones: [
          ...s.blastZones.slice(-18),
          {
            id: fxSeq++,
            coord: freshWatcher.pos,
            createdAt: nowTs,
            baseRadius: 1.4,
            maxRadius: 3.8,
            isExplosion: false,
          },
          ...(outcome.misfired
            ? []
            : [
                {
                  id: fxSeq++,
                  coord: outcome.hit ? ambushCoord : impactMeta.missImpactCoord,
                  createdAt: nowTs,
                  baseRadius: 1.2,
                  maxRadius: 3.2,
                  isExplosion: false,
                },
              ]),
        ],
        units: s.units.map((u) =>
          u.id === freshWatcher.id
            ? {
                ...u,
                isOverwatch: false,
                firearmLoaded: false,
                reloadProgress: 0,
                pistolLoaded:
                  freshWatcher.id === "player-colloredo" ? false : u.pistolLoaded,
                facing: facingFromDelta(u.pos, ambushCoord, u.facing),
              }
            : u,
        ),
        activeProjectile: {
          id: fxSeq++,
          from: freshWatcher.pos,
          to: ambushCoord,
          targetId: currentMoved.id,
          hitChance: outcome.hitChance,
          kind: "bullet",
          createdAt: nowTs,
          durationMs: 1780,
          hit: outcome.hit,
          critical: outcome.critical,
          misfired: outcome.misfired,
          damage: outcome.damage,
          bloodSeverity: impactMeta.bloodSeverity,
          armorShredded: outcome.armorShredded,
          armorAbsorbed: outcome.armorAbsorbed,
          killed: outcome.killed,
          impactObstacle: impactMeta.impactObstacle,
          missImpactCoord: impactMeta.missImpactCoord,
        },
        lightFlashes: addLightFlash(
          s.lightFlashes,
          muzzleFlashDraft(
            freshWatcher.pos,
            facingFromDelta(freshWatcher.pos, ambushCoord, freshWatcher.facing),
            outcome.misfired,
          ),
        ),
      }));

      triggerUnitFx(freshWatcher.id, {
        lunge: true,
        banner: outcome.misfired
          ? { phrase: phrase("banner.misfire"), tone: "misfire" }
          : { phrase: phrase("banner.ambush"), tone: "overwatch" },
      });

      // Čekání na plynulý dolet střely k cíli (~41 % z 1780 ms = 730 ms)
      await delay(730);
      if (!outcome.misfired) {
        if (outcome.hit) {
          playHitSound(outcome.critical, impactMeta.bloodSeverity);
        } else {
          playRicochetSound(impactMeta.impactObstacle === "palace_wood");
        }
      }

      let newlyDetainedByOw = false;
      const beforeTargetOw =
        get().units.find((u) => u.id === currentMoved.id) ?? currentMoved;
      let afterTargetOw: UnitData = beforeTargetOw;

      set((s) => {
        if (!outcome.misfired) {
          s.grid.damageTile(
            outcome.hit ? ambushCoord : impactMeta.missImpactCoord,
            1,
          );
        }
        const updatedUnits = s.units.map((u) => {
          if (u.id !== currentMoved.id) return u;
          const nextArmor = Math.max(0, u.armor - outcome.armorShredded);
          const nextHp = u.hp - outcome.damage;
          const instantKilled = isInstantOverkill(nextHp, u.maxHp);
          const inThroes = !instantKilled && nextHp <= 0;
          const shakenNow =
            u.isShaken || (outcome.hit && (outcome.critical || outcome.damage >= 4));
          return {
            ...u,
            armor: nextArmor,
            hp: nextHp,
            isShaken: nextHp > 0 ? shakenNow : false,
            alive: !instantKilled,
            inDeathThroes: inThroes,
            deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
            isOverwatch: nextHp > 0 ? u.isOverwatch : false,
          };
        });

        const captureSync = syncColloredoCaptureState(updatedUnits);
        newlyDetainedByOw = captureSync.newlyDetained;
        const syncedUnits = syncColloredoMobility(captureSync.units);
        afterTargetOw =
          syncedUnits.find((u) => u.id === currentMoved.id) ?? beforeTargetOw;

        const extraLogs: CombatLogEntry[] = [];
        if (captureSync.newlyDetained) {
          extraLogs.push(
            makeLog(
              s.round,
              "enemy",
              phrase("log.detained.overwatch"),
              "alert",
            ),
          );
        }

        return {
          gridVersion: s.gridVersion + (outcome.misfired ? 0 : 1),
          units: syncedUnits,
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              freshWatcher.faction,
              phrase("log.overwatch.shot", {
                attackerId: freshWatcher.id,
                targetId: currentMoved.id,
                damage: outcome.damage,
                shred: outcome.armorShredded,
                critical: outcome.critical,
                chance: outcome.hitChance,
                misfired: outcome.misfired,
                hit: outcome.hit,
              }),
              outcome.misfired
                ? "misfire"
                : outcome.hit
                  ? "overwatch"
                  : "miss",
            ),
            ...extraLogs,
          ],
        };
      });

      if (!outcome.misfired) {
        const owLoss = buildUnitCombatLoss(beforeTargetOw, afterTargetOw, {
          attackerId: freshWatcher.id,
          weaponId: freshWatcher.weapon.id,
          hit: outcome.hit,
          critical: outcome.critical,
          misfired: outcome.misfired,
          hitChance: outcome.hitChance,
          armorAbsorbed: outcome.armorAbsorbed,
          durationMs: 1550,
        });
        triggerUnitFx(currentMoved.id, {
          hit: outcome.hit,
          loss: owLoss,
          banner: newlyDetainedByOw
            ? { phrase: phrase("banner.detainedHalf"), tone: "crit" }
            : outcome.hit
              ? {
                  phrase: outcome.critical
                    ? phrase("banner.critShort", { damage: outcome.damage })
                    : phrase("banner.damage", { damage: outcome.damage }),
                  tone: outcome.critical ? "crit" : "hit",
                }
              : { phrase: phrase("banner.miss"), tone: "miss" },
        });
      }

      await delay(1050);
      set((s) => ({
        activeProjectile: null,
        cameraDirector: {
          ...s.cameraDirector,
          mode: "TACTICAL_ISO",
          timeScale: 1.0,
          overwatchSlowMo: null,
        },
      }));
    }
  };

  return {
    grid: initialGrid,
    units: derived.units,
    round: 1,
    turn: "player",
    reinforcementsSpawned: false,
    reinforcementRound: 5,
    weather: initialWeather,
    gridVersion: 1,
    smokeVersion: 1,
    combatIntensity: 0,
    blastZones: [],
    outcome: "ongoing",
    victoryReason: null,
    defeatReason: null,
    isCapturingAnim: false,

    selectedUnitId: firstPlayerId,
    activeFloor: 1,
    renderMode: "2D_SPRITE",
    cameraStep: 0,
    isFullscreen: false,
    actionCamEnabled: true,

    actionMode: "move",
    breakdownOpen: false,
    inspectOpen: false,
    inspectKeyHeld: false,
    inspectClickConsumed: false,
    inspectPin: null,
    fogOfWarEnabled: true,
    fogSnapshot: derived.fogSnapshot,
    reachableTiles: derived.reachableTiles,
    hoveredTile: null,
    hoveredPath: [],
    hoveredSpottedEnemyIds: [],
    visibleTargets: derived.visibleTargets,
    visibleMeleeTargets: derived.visibleMeleeTargets,
    selectedTargetId: derived.selectedTargetId,

    isBusy: false,
    cameraDirector: createInitialCameraDirectorState(),
    revealedPodEnemyIds: new Set(derived.fogSnapshot.visibleEnemyIds),
    activeMovement: null,
    activeProjectile: null,
    lightFlashes: [],
    triggerLightFlash: (flash) => {
      set((s) => ({
        lightFlashes: addLightFlash(s.lightFlashes, flash),
      }));
    },
    unitFx: {},
    combatLog: [
      makeLog(1, "player", phrase("log.briefing.gate"), "alert"),
      makeLog(1, "player", phrase("log.briefing.escape"), "story"),
    ],

    tutorialStep: 1,
    tutorialDismissed: false,

    guidedTutorial: {
      enabled: true,
      currentStep: "step_1_matej_move",
      dismissed: false,
      rejectFeedback: null,
      rejectTimestamp: 0,
    },

    setGuidedTutorialStep: (step: GuidedTutorialStep) => {
      set((s) => {
        let legacyStep: 1 | 2 | 3 | 4 | null = s.tutorialStep;
        if (step === "step_1_matej_move" || step === "step_2_colloredo_escort") legacyStep = 1;
        else if (step === "step_3_vaclav_aim" || step === "step_4_vaclav_shoot") legacyStep = 2;
        else if (
          step === "step_5_enemy_turn_react" ||
          step === "step_6_vaclav_reload" ||
          step === "step_7_keg_explosion" ||
          step === "step_8_melee_finish"
        )
          legacyStep = 3;
        else if (step === "step_9_free_combat") legacyStep = 4;

        return {
          guidedTutorial: {
            ...s.guidedTutorial,
            currentStep: step,
            rejectFeedback: null,
          },
          tutorialStep: legacyStep,
        };
      });
    },

    skipGuidedTutorial: () => {
      set((s) => ({
        guidedTutorial: {
          ...s.guidedTutorial,
          enabled: false,
          currentStep: "step_9_free_combat",
          rejectFeedback: null,
        },
        tutorialStep: 4,
      }));
    },

    toggleGuidedTutorial: () => {
      set((s) => ({
        guidedTutorial: {
          ...s.guidedTutorial,
          dismissed: !s.guidedTutorial.dismissed,
        },
        tutorialDismissed: !s.tutorialDismissed,
      }));
    },

    setGuidedTutorialReject: (msg: Phrase | null) => {
      set((s) => ({
        guidedTutorial: {
          ...s.guidedTutorial,
          rejectFeedback: msg,
          rejectTimestamp: performance.now(),
        },
      }));
    },

    setTutorialStep: (step: 1 | 2 | 3 | 4 | null) => {
      set((s) => {
        let nextGuided: GuidedTutorialStep = s.guidedTutorial.currentStep;
        if (step === 1) nextGuided = "step_1_matej_move";
        else if (step === 2) nextGuided = "step_3_vaclav_aim";
        else if (step === 3) nextGuided = "step_6_vaclav_reload";
        else if (step === 4) nextGuided = "step_9_free_combat";
        return {
          tutorialStep: step,
          guidedTutorial: {
            ...s.guidedTutorial,
            currentStep: nextGuided,
            enabled: step !== null,
          },
        };
      });
    },

    advanceTutorialStep: () => {
      set((s) => {
        if (s.tutorialStep === null) return { tutorialStep: 1 };
        if (s.tutorialStep < 4) {
          const next = (s.tutorialStep + 1) as 1 | 2 | 3 | 4;
          let nextGuided: GuidedTutorialStep = s.guidedTutorial.currentStep;
          if (next === 2) nextGuided = "step_3_vaclav_aim";
          else if (next === 3) nextGuided = "step_6_vaclav_reload";
          else if (next === 4) nextGuided = "step_9_free_combat";
          return {
            tutorialStep: next,
            guidedTutorial: { ...s.guidedTutorial, currentStep: nextGuided },
          };
        }
        return {
          tutorialStep: null,
          guidedTutorial: {
            ...s.guidedTutorial,
            enabled: false,
            currentStep: "step_9_free_combat",
          },
        };
      });
    },

    toggleTutorial: () => {
      set((s) => ({
        tutorialDismissed: !s.tutorialDismissed,
        guidedTutorial: {
          ...s.guidedTutorial,
          dismissed: !s.guidedTutorial.dismissed,
        },
      }));
    },

    sacrificeDilemmaOpen: false,
    sacrificedHeroId: null,
    ironVigilPerk: null,
    demonstratedAbilities: {},

    chooseSacrifice: (heroId: string) => {
      const perkId: PerkId =
        heroId === "player-bartolomej"
          ? "maltese_pyrotechnician"
          : heroId === "player-vaclav-michalovic"
            ? "clementine_zeal"
            : "steel_loyalty";

      set((s) => ({
        sacrificeDilemmaOpen: false,
        sacrificedHeroId: heroId,
        ironVigilPerk: { perkId, heroId },
        outcome: "victory",
        victoryReason: "boat_escape",
        defeatReason: null,
        combatLog: [
          ...s.combatLog,
          makeLog(
            s.round,
            "player",
            phrase("log.sacrifice.volunteer", { heroId }),
            "story",
          ),
          makeLog(
            s.round,
            "player",
            phrase("log.sacrifice.paradox", { heroId }),
            "alert",
          ),
        ],
      }));
    },

    toggleActionCam: () => {
      set((s) => ({ actionCamEnabled: !s.actionCamEnabled }));
    },
    setActionCamEnabled: (enabled: boolean) => {
      set({ actionCamEnabled: enabled });
    },

    selectUnit: (unitId: string) => {
      const state = get();
      if (state.isBusy || state.turn !== "player") return;
      const unit = state.units.find((u) => u.id === unitId);
      if (!unit || !unit.alive || unit.faction !== "player") return;

      if (state.guidedTutorial.enabled && !state.guidedTutorial.dismissed) {
        const step = state.guidedTutorial.currentStep;
        if (
          unitId === "player-vaclav-michalovic" &&
          (step === "step_1_matej_move" || step === "step_2_colloredo_escort")
        ) {
          get().setGuidedTutorialStep("step_3_vaclav_aim");
        } else if (unitId === "player-bartolomej" && step !== "step_9_free_combat") {
          get().setGuidedTutorialStep("step_7_keg_explosion");
        }
      }

      const sel = deriveSelectionData(
        state.grid,
        state.units,
        unitId,
        state.weather,
        state.selectedTargetId,
        state.fogSnapshot.exploredCoords,
        state.blastZones,
        state.fogOfWarEnabled,
      );
      set({
        selectedUnitId: unitId,
        activeFloor: unit.pos.y,
        actionMode: "move",
        fogSnapshot: sel.fogSnapshot,
        reachableTiles: sel.reachableTiles,
        visibleTargets: sel.visibleTargets,
        visibleMeleeTargets: sel.visibleMeleeTargets,
        selectedTargetId: sel.selectedTargetId,
        hoveredPath: [],
      });
    },

    setActiveFloor: (floor: FloorLevel) => {
      set({ activeFloor: floor, hoveredTile: null, hoveredPath: [] });
    },

    toggleFloor: () => {
      set((s) => ({
        activeFloor: ((s.activeFloor + 1) % 3) as FloorLevel,
        hoveredTile: null,
        hoveredPath: [],
      }));
    },

    toggleFullscreen: () => {
      if (typeof document === "undefined") return;
      if (!document.fullscreenElement) {
        document.documentElement
          .requestFullscreen()
          .then(() => {
            set({ isFullscreen: true });
          })
          .catch(() => {
            set((s) => ({ isFullscreen: !s.isFullscreen }));
          });
      } else {
        document
          .exitFullscreen()
          .then(() => {
            set({ isFullscreen: false });
          })
          .catch(() => {
            set({ isFullscreen: false });
          });
      }
    },

    setFullscreenState: (fs: boolean) => {
      set({ isFullscreen: fs });
    },

    setRenderMode: (mode: RenderMode) => {
      set({ renderMode: mode });
    },

    toggleRenderMode: () => {
      set((s) => ({
        renderMode: s.renderMode === "2D_SPRITE" ? "3D_MODEL" : "2D_SPRITE",
      }));
    },

    setWeather: (weather: WeatherType) => {
      const state = get();
      const sel = deriveSelectionData(
        state.grid,
        state.units,
        state.selectedUnitId,
        weather,
        state.selectedTargetId,
        state.fogSnapshot.exploredCoords,
        state.blastZones,
        state.fogOfWarEnabled,
      );
      set({
        weather,
        fogSnapshot: sel.fogSnapshot,
        visibleTargets: sel.visibleTargets,
        selectedTargetId: sel.selectedTargetId,
      });
    },

    cycleWeather: () => {
      const order: WeatherType[] = ["clear", "fog", "rain"];
      const current = get().weather;
      const next = order[(order.indexOf(current) + 1) % order.length]!;
      get().setWeather(next);
    },

    toggleFogOfWar: () => {
      const state = get();
      get().setFogOfWarEnabled(!state.fogOfWarEnabled);
    },

    setFogOfWarEnabled: (enabled: boolean) => {
      const state = get();
      const sel = deriveSelectionData(
        state.grid,
        state.units,
        state.selectedUnitId,
        state.weather,
        state.selectedTargetId,
        state.fogSnapshot.exploredCoords,
        state.blastZones,
        enabled,
      );
      set({
        fogOfWarEnabled: enabled,
        fogSnapshot: sel.fogSnapshot,
        visibleTargets: sel.visibleTargets,
        selectedTargetId: sel.selectedTargetId,
      });
    },

    rotateCamera: (dir: 1 | -1) => {
      set((s) => ({ cameraStep: s.cameraStep + dir }));
    },

    setActionMode: (mode: ActionMode) => {
      const state = get();
      if (state.turn !== "player") return;

      if (state.guidedTutorial.enabled && !state.guidedTutorial.dismissed) {
        const step = state.guidedTutorial.currentStep;
        if (step === "step_3_vaclav_aim" && mode === "shoot") {
          get().setGuidedTutorialStep("step_4_vaclav_shoot");
        }
      }

      // Návrat do režimu pohybu (Zpět k pohybu / Esc / 1) - musí VŽDY fungovat bez ohledu na AP střelce či stav zadržení
      if (mode === "move") {
        if (state.activeMovement) return;

        let unit = state.units.find((u) => u.id === state.selectedUnitId);
        if (!unit || !unit.alive) {
          const firstAlive = state.units.find(
            (u) => u.faction === "player" && u.alive,
          );
          if (firstAlive) {
            get().selectUnit(firstAlive.id);
            return;
          }
          set({
            isBusy: false,
            actionMode: "move",
            hoveredPath: [],
            hoveredTile: null,
            reachableTiles: new Map(),
            visibleTargets: [],
            selectedTargetId: null,
          });
          return;
        }

        const sel = deriveSelectionData(
          state.grid,
          state.units,
          unit.id,
          state.weather,
          null,
          state.fogSnapshot.exploredCoords,
          state.blastZones,
          state.fogOfWarEnabled,
        );

        set({
          isBusy: false,
          actionMode: "move",
          selectedUnitId: unit.id,
          activeFloor: unit.pos.y,
          reachableTiles: sel.reachableTiles,
          visibleTargets: sel.visibleTargets,
          selectedTargetId: sel.selectedTargetId,
          fogSnapshot: sel.fogSnapshot,
          hoveredPath: [],
          hoveredTile: null,
        });
        return;
      }

      if (state.isBusy) return;

      let unit = state.units.find((u) => u.id === state.selectedUnitId);

      if (mode === "shoot") {
        // Pokud aktuálně vybraná jednotka nemůže střílet nebo nemá cíl v zorném poli,
        // zkusíme najít jiného živého člena družiny s AP > 0, který má platný cíl!
        const canCurrentAct =
          !!unit &&
          isUnitFighting(unit) &&
          unit.ap > 0 &&
          (unit.detainedTurns ?? 0) === 0;

        const visibleFilter = state.fogOfWarEnabled
          ? state.fogSnapshot.visibleEnemyIds
          : undefined;

        let targets = canCurrentAct && unit
          ? evaluateVisibleTargets(
              state.grid,
              unit,
              state.units,
              state.weather,
              visibleFilter,
            )
          : [];

        if (!canCurrentAct || targets.length === 0) {
          const readyShooter = state.units.find((u) => {
            if (
              u.faction !== "player" ||
              !isUnitFighting(u) ||
              u.ap <= 0 ||
              (u.detainedTurns ?? 0) > 0
            ) {
              return false;
            }
            const t = evaluateVisibleTargets(
              state.grid,
              u,
              state.units,
              state.weather,
              visibleFilter,
            );
            return t.length > 0;
          });

          if (readyShooter) {
            unit = readyShooter;
            targets = evaluateVisibleTargets(
              state.grid,
              readyShooter,
              state.units,
              state.weather,
              visibleFilter,
            );
          }
        }

        if (!unit || !unit.alive) return;

        const reachable =
          unit.ap > 0 && (unit.detainedTurns ?? 0) === 0 && isUnitFighting(unit)
            ? computeReachableTiles(state.grid, unit, state.units)
            : new Map<string, ReachableTile>();

        const keepId =
          state.selectedTargetId &&
          targets.some((t) => t.targetId === state.selectedTargetId)
            ? state.selectedTargetId
            : (targets[0]?.targetId ?? null);
        const targetUnit = state.units.find((u) => u.id === keepId);

        set({
          selectedUnitId: unit.id,
          actionMode: "shoot",
          reachableTiles: reachable,
          visibleTargets: targets,
          selectedTargetId: keepId,
          activeFloor: targetUnit ? targetUnit.pos.y : unit.pos.y,
          hoveredPath: [],
        });
        return;
      }

      if (mode === "grenade") {
        if (
          !unit ||
          !unit.alive ||
          unit.ap <= 0 ||
          (unit.detainedTurns ?? 0) > 0 ||
          !isUnitFighting(unit) ||
          (unit.grenades ?? 0) <= 0
        )
          return;

        set({
          actionMode: "grenade",
          activeFloor: unit.pos.y,
          hoveredPath: [],
        });
        return;
      }

      if (mode === "melee") {
        if (
          !unit ||
          !unit.alive ||
          unit.ap <= 0 ||
          (unit.detainedTurns ?? 0) > 0 ||
          !isUnitFighting(unit)
        )
          return;

        const visibleFilter = state.fogOfWarEnabled
          ? state.fogSnapshot.visibleEnemyIds
          : undefined;

        let meleeTargets = evaluateAdjacentMeleeTargets(
          state.grid,
          unit,
          state.units,
          visibleFilter,
        );

        if (meleeTargets.length === 0) {
          const readyMeleeUser = state.units.find((u) => {
            if (
              u.faction !== "player" ||
              !isUnitFighting(u) ||
              u.ap <= 0 ||
              (u.detainedTurns ?? 0) > 0
            ) {
              return false;
            }
            return (
              evaluateAdjacentMeleeTargets(
                state.grid,
                u,
                state.units,
                visibleFilter,
              ).length > 0
            );
          });
          if (readyMeleeUser) {
            unit = readyMeleeUser;
            meleeTargets = evaluateAdjacentMeleeTargets(
              state.grid,
              readyMeleeUser,
              state.units,
              visibleFilter,
            );
          }
        }

        const keepId =
          state.selectedTargetId &&
          meleeTargets.some((t) => t.targetId === state.selectedTargetId)
            ? state.selectedTargetId
            : (meleeTargets[0]?.targetId ?? null);
        const targetUnit = state.units.find((u) => u.id === keepId);

        set({
          selectedUnitId: unit.id,
          actionMode: "melee",
          visibleMeleeTargets: meleeTargets,
          selectedTargetId: keepId,
          activeFloor: targetUnit ? targetUnit.pos.y : unit.pos.y,
          hoveredPath: [],
        });
        return;
      }
    },

    toggleBreakdown: () => {
      set((s) => ({ breakdownOpen: !s.breakdownOpen }));
    },

    beginInspectHold: () => {
      if (get().inspectKeyHeld) return;
      set({ inspectKeyHeld: true, inspectClickConsumed: false });
    },

    endInspectHold: () => {
      const state = get();
      if (!state.inspectKeyHeld) return;
      if (state.inspectClickConsumed) {
        set({ inspectKeyHeld: false, inspectClickConsumed: false });
        return;
      }
      set({
        inspectKeyHeld: false,
        inspectClickConsumed: false,
        inspectOpen: !state.inspectOpen,
        inspectPin: null,
      });
    },

    cancelInspectHold: () => {
      set({ inspectKeyHeld: false, inspectClickConsumed: false });
    },

    closeInspect: () => {
      set({
        inspectOpen: false,
        inspectPin: null,
        inspectClickConsumed: true,
      });
    },

    selectTarget: (targetId: string) => {
      const state = get();
      const inVisible = state.visibleTargets.some((t) => t.targetId === targetId);
      const inMelee = state.visibleMeleeTargets.some((t) => t.targetId === targetId);
      if (inVisible || inMelee) {
        const target = state.units.find((u) => u.id === targetId);
        set({
          selectedTargetId: targetId,
          actionMode: inMelee && !inVisible ? "melee" : state.actionMode,
          activeFloor: target ? target.pos.y : state.activeFloor,
        });
      }
    },

    cycleTarget: (dir: 1 | -1) => {
      const state = get();
      const targetPool =
        state.actionMode === "melee"
          ? state.visibleMeleeTargets
          : state.visibleTargets;
      if (targetPool.length === 0) return;
      const currentIdx = targetPool.findIndex(
        (t) => t.targetId === state.selectedTargetId,
      );
      const nextIdx =
        currentIdx < 0
          ? 0
          : (currentIdx + dir + targetPool.length) % targetPool.length;
      const nextTargetId = targetPool[nextIdx]?.targetId;
      if (nextTargetId) {
        get().selectTarget(nextTargetId);
      }
    },

    setHoveredTile: (coord: GridCoord | null) => {
      const state = get();
      if (!coord) {
        if (
          state.hoveredTile !== null ||
          state.hoveredPath.length > 0 ||
          state.hoveredSpottedEnemyIds.length > 0
        ) {
          set({ hoveredTile: null, hoveredPath: [], hoveredSpottedEnemyIds: [] });
        }
        return;
      }

      if (state.hoveredTile && sameCoord(state.hoveredTile, coord)) return;

      if (
        state.isBusy ||
        state.turn !== "player" ||
        state.actionMode !== "move" ||
        !state.selectedUnitId
      ) {
        set({ hoveredTile: coord, hoveredPath: [], hoveredSpottedEnemyIds: [] });
        return;
      }

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      const reachable = state.reachableTiles.get(coordKey(coord));
      if (!unit || !reachable) {
        set({ hoveredTile: coord, hoveredPath: [], hoveredSpottedEnemyIds: [] });
        return;
      }

      const path = findPathAStar(
        state.grid,
        unit.pos,
        coord,
        state.units,
        unit.id,
      );
      const recon = previewReconFromTile(
        state.grid,
        unit,
        coord,
        state.units,
        state.weather,
        state.fogSnapshot.visibleEnemyIds,
      );
      set({
        hoveredTile: coord,
        hoveredPath: path,
        hoveredSpottedEnemyIds: recon.spottedEnemyIds,
      });
    },

    previewEnemyMeleeHover: (enemyId: string | null) => {
      const state = get();
      if (!enemyId) {
        if (
          state.hoveredTile !== null ||
          state.hoveredPath.length > 0 ||
          state.hoveredSpottedEnemyIds.length > 0
        ) {
          set({ hoveredTile: null, hoveredPath: [], hoveredSpottedEnemyIds: [] });
        }
        return;
      }

      if (
        state.isBusy ||
        state.turn !== "player" ||
        state.actionMode !== "move" ||
        !state.selectedUnitId
      ) {
        return;
      }

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      const enemy = state.units.find(
        (u) => u.id === enemyId && u.alive && u.faction === "enemy",
      );
      if (
        !unit ||
        !unit.alive ||
        unit.ap <= 0 ||
        (unit.detainedTurns ?? 0) > 0 ||
        !enemy
      ) {
        return;
      }

      if (
        state.fogOfWarEnabled &&
        !state.fogSnapshot.visibleEnemyIds.has(enemy.id)
      ) {
        return;
      }

      if (isAdjacentForMelee(unit.pos, enemy.pos)) {
        set({ hoveredTile: null, hoveredPath: [], hoveredSpottedEnemyIds: [] });
        return;
      }

      const chargeReach = findBestMeleeChargeTile(
        state.grid,
        unit,
        enemy,
        state.reachableTiles,
        state.hoveredTile,
      );
      if (!chargeReach) {
        return;
      }

      const path = findPathAStar(
        state.grid,
        unit.pos,
        chargeReach.coord,
        state.units,
        unit.id,
      );
      set({
        hoveredTile: chargeReach.coord,
        hoveredPath: path,
        hoveredSpottedEnemyIds: [enemy.id],
      });
    },

    handleRightClickCancel: () => {
      if (get().inspectKeyHeld) return;
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;
      if (state.actionMode !== "move") {
        get().setActionMode("move");
      }
    },

    handleUnitRightClick: (unitId: string) => {
      if (get().inspectKeyHeld) {
        set({
          inspectOpen: true,
          inspectClickConsumed: true,
          inspectPin: { kind: "unit", id: unitId },
        });
        return;
      }
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      // Pokud je otevřena střelba nebo chystán granát, pravé tlačítko akci zruší a vrátí hráče do základního pohledu
      if (state.actionMode === "shoot" || state.actionMode === "grenade") {
        get().setActionMode("move");
        return;
      }

      const clickedUnit = state.units.find((u) => u.id === unitId);
      if (!clickedUnit || !clickedUnit.alive) return;

      if (clickedUnit.faction === "player") {
        if (state.actionMode !== "move") {
          get().setActionMode("move");
        } else {
          get().selectUnit(unitId);
        }
        return;
      }

      // Pravé kliknutí na nepřítele: XCOM 2 Útok zblízka (okamžitý přesun spojený se seknutím, útok nestojí další AP navíc)
      if (
        state.fogOfWarEnabled &&
        !state.fogSnapshot.visibleEnemyIds.has(clickedUnit.id)
      ) {
        set({ activeFloor: clickedUnit.pos.y });
        triggerUnitFx(clickedUnit.id, {
          banner: { phrase: phrase("banner.hiddenFog"), tone: "miss" },
        });
        return;
      }

      const currentUnit = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !currentUnit ||
        !currentUnit.alive ||
        currentUnit.ap <= 0 ||
        (currentUnit.detainedTurns ?? 0) > 0 ||
        !isUnitFighting(currentUnit)
      ) {
        if (state.actionMode === "melee") {
          get().setActionMode("move");
        }
        return;
      }

      // 1. Pokud voják již stojí na sousedním poli u nepřítele, provede okamžitý sek zblízka
      if (isAdjacentForMelee(currentUnit.pos, clickedUnit.pos)) {
        get().executeMelee(clickedUnit.id);
        return;
      }

      // 2. Pokud byl v režimu melee a klikl pravým na vzdáleného nepřítele mimo dosah
      const chargeReach = findBestMeleeChargeTile(
        state.grid,
        currentUnit,
        clickedUnit,
        state.reachableTiles,
        state.hoveredTile,
      );

      if (!chargeReach) {
        if (state.actionMode === "melee") {
          get().setActionMode("move");
          return;
        }
        triggerUnitFx(clickedUnit.id, {
          banner: { phrase: phrase("banner.outOfCharge"), tone: "miss" },
        });
        return;
      }

      // Uložíme cíl zteče na začátek přesunu a spustíme pohyb na sousední dlaždici `chargeReach.coord`
      if (state.actionMode !== "move") {
        set({ actionMode: "move" });
      }
      set({ selectedTargetId: clickedUnit.id });
      // Spustíme přesun s navázaným bezplatným útokem zblízka po doběhu
      const path = findPathAStar(
        state.grid,
        currentUnit.pos,
        chargeReach.coord,
        state.units,
        currentUnit.id,
      );
      if (path.length === 0) return;

      triggerUnitFx(currentUnit.id, {
        banner: { phrase: phrase("banner.charge"), tone: "buff" },
      });

      // Vyvoláme pohyb na dlaždici s příznakem cíle pro okamžité seknutí po doběhu (0 AP navíc)
      set({
        hoveredTile: chargeReach.coord,
        hoveredPath: path,
        hoveredSpottedEnemyIds: [clickedUnit.id],
      });
      get().handleTileClick(chargeReach.coord);
    },

    handleTileRightClick: (coord: GridCoord) => {
      if (get().inspectKeyHeld) {
        set({
          inspectOpen: true,
          inspectClickConsumed: true,
          inspectPin: { kind: "tile", coord: { ...coord } },
        });
        return;
      }
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      // Pokud na dlaždici stojí živý nepřítel a jsme v režimu pohybu, pravé kliknutí spustí XCOM 2 Zteč zblízka
      const unitOnTile = state.units.find(
        (u) => u.alive && sameCoord(u.pos, coord),
      );
      if (unitOnTile && unitOnTile.faction === "enemy" && state.actionMode === "move") {
        get().handleUnitRightClick(unitOnTile.id);
        return;
      }

      // Zrušení akce / Zpět: Pokud je otevřeno menu střelby, granátu nebo zblízka, pravé tlačítko akci zruší
      if (state.actionMode !== "move") {
        get().setActionMode("move");
        return;
      }

      // V režimu pohybu pravé kliknutí na dlaždici provede okamžitý přesun (Move / Dash)
      get().handleTileClick(coord);
    },

    handleUnitClick: (unitId: string) => {
      if (get().inspectKeyHeld) {
        set({
          inspectOpen: true,
          inspectClickConsumed: true,
          inspectPin: { kind: "unit", id: unitId },
        });
        return;
      }
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const clickedUnit = state.units.find((u) => u.id === unitId);
      if (!clickedUnit || !clickedUnit.alive) return;

      if (clickedUnit.faction === "player") {
        get().selectUnit(unitId);
        return;
      }

      // Kliknutí na nepřátelskou jednotku
      if (state.actionMode === "grenade") {
        get().executeGrenade(clickedUnit.pos);
        return;
      }

      const currentUnit = state.units.find((u) => u.id === state.selectedUnitId);
      const isAdjacent =
        !!currentUnit && isAdjacentForMelee(currentUnit.pos, clickedUnit.pos);

      // Režim úderu zblízka
      if (state.actionMode === "melee") {
        if (isAdjacent) {
          get().executeMelee(clickedUnit.id);
        } else {
          get().selectTarget(clickedUnit.id);
        }
        return;
      }

      // Pokud hrabě Colloredo již vystřelil svou jednorannou bambitku a klikne na sousedního nepřítele, udeří jej pažbou!
      if (
        currentUnit &&
        currentUnit.id === "player-colloredo" &&
        currentUnit.pistolLoaded === false &&
        isAdjacent &&
        currentUnit.ap > 0
      ) {
        get().executeMelee(clickedUnit.id);
        return;
      }

      const canCurrentShootTarget =
        !!currentUnit &&
        currentUnit.alive &&
        currentUnit.ap > 0 &&
        (currentUnit.detainedTurns ?? 0) === 0 &&
        state.visibleTargets.some((t) => t.targetId === clickedUnit.id);

      if (canCurrentShootTarget) {
        if (
          state.actionMode === "shoot" &&
          state.selectedTargetId === clickedUnit.id
        ) {
          get().executeShoot(clickedUnit.id);
        } else {
          get().selectTarget(clickedUnit.id);
        }
        return;
      }

      // Pokud je nepřítel zahalen mlhou války (není přímo odhalen), upozorníme hráče na šerosvit
      if (
        state.fogOfWarEnabled &&
        !state.fogSnapshot.visibleEnemyIds.has(clickedUnit.id)
      ) {
        set({ activeFloor: clickedUnit.pos.y });
        triggerUnitFx(clickedUnit.id, {
          banner: { phrase: phrase("banner.hiddenFog"), tone: "miss" },
        });
        return;
      }

      const visibleFilter = state.fogOfWarEnabled
        ? state.fogSnapshot.visibleEnemyIds
        : undefined;

      // Pokud vybraný voják na cíl nevidí nebo nemá AP, zkusíme najít jiného člena čety s AP > 0, který na něj vidí
      const alternateShooter = state.units.find((u) => {
        if (
          u.faction !== "player" ||
          !isUnitFighting(u) ||
          u.ap <= 0 ||
          (u.detainedTurns ?? 0) > 0
        ) {
          return false;
        }
        const t = evaluateVisibleTargets(
          state.grid,
          u,
          state.units,
          state.weather,
          visibleFilter,
        );
        return t.some((ev) => ev.targetId === clickedUnit.id);
      });

      if (alternateShooter) {
        const sel = deriveSelectionData(
          state.grid,
          state.units,
          alternateShooter.id,
          state.weather,
          clickedUnit.id,
          state.fogSnapshot.exploredCoords,
          state.blastZones,
          state.fogOfWarEnabled,
        );
        set({
          selectedUnitId: alternateShooter.id,
          actionMode: "shoot",
          fogSnapshot: sel.fogSnapshot,
          reachableTiles: sel.reachableTiles,
          visibleTargets: sel.visibleTargets,
          selectedTargetId: clickedUnit.id,
          activeFloor: clickedUnit.pos.y,
          hoveredPath: [],
        });
      } else {
        // Přepneme alespoň patro na kliknutého nepřítele a zobrazíme upozornění na něm
        set({ activeFloor: clickedUnit.pos.y });
        triggerUnitFx(clickedUnit.id, {
          banner: { phrase: phrase("banner.outOfSight"), tone: "miss" },
        });
      }
    },

    handleTileClick: (coord: GridCoord) => {
      if (get().inspectKeyHeld) {
        set({
          inspectOpen: true,
          inspectClickConsumed: true,
          inspectPin: { kind: "tile", coord: { ...coord } },
        });
        return;
      }
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const unitOnTile = state.units.find(
        (u) => u.alive && sameCoord(u.pos, coord),
      );
      if (unitOnTile) {
        get().handleUnitClick(unitOnTile.id);
        return;
      }

      // Interakce s dveřmi (Free action 0 AP): pokud hráč klikne na dveře a vybraná jednotka stojí vedle nich
      const doorAtTile = state.grid.getDoor(coord);
      const selUnit = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        doorAtTile &&
        selUnit &&
        selUnit.alive &&
        (selUnit.detainedTurns ?? 0) === 0 &&
        isUnitFighting(selUnit) &&
        selUnit.pos.y === coord.y &&
        Math.abs(selUnit.pos.x - coord.x) <= 1 &&
        Math.abs(selUnit.pos.z - coord.z) <= 1
      ) {
        get().toggleDoor(coord);
        return;
      }

      if (state.actionMode === "grenade") {
        get().executeGrenade(coord);
        return;
      }

      // Přímé odpálení prachového sudu výstřelem (pokud hráč klikne na sud s prachem v režimu střelby nebo pohybu mimo dosah chůze)
      const clickedTile = state.grid.getTile(coord);
      const activeUnit = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        clickedTile?.obstacle === "powder_keg" &&
        activeUnit &&
        activeUnit.alive &&
        activeUnit.ap >= 1 &&
        (activeUnit.detainedTurns ?? 0) === 0 &&
        isUnitFighting(activeUnit) &&
        gridDistance3D(activeUnit.pos, coord) <= activeUnit.weapon.maxRange &&
        checkLineOfSight3D(state.grid, activeUnit.pos, coord).clear
      ) {
        void (async () => {
          const newFacing = facingFromDelta(
            activeUnit.pos,
            coord,
            activeUnit.facing,
          );
          playGunshotSound(activeUnit.weapon.lockType === "wheellock");
          get().grid.addSmoke(activeUnit.pos, 0, 2);
          const nowTs = performance.now();

          set((s) => ({
            isBusy: true,
            smokeVersion: s.smokeVersion + 1,
            combatIntensity: s.combatIntensity + 3,
            blastZones: [
              ...s.blastZones.slice(-18),
              {
                id: fxSeq++,
                coord: activeUnit.pos,
                createdAt: nowTs,
                baseRadius: 1.5,
                maxRadius: 4.0,
                isExplosion: false,
              },
              {
                id: fxSeq++,
                coord,
                createdAt: nowTs,
                baseRadius: 2.8,
                maxRadius: 7.5,
                isExplosion: true,
              },
            ],
            units: s.units.map((u) =>
              u.id === activeUnit.id
                ? {
                    ...u,
                    facing: newFacing,
                    ap: 0,
                    isOverwatch: false,
                    abilityBuffActive: false,
                  }
                : u,
            ),
            activeProjectile: {
              id: fxSeq++,
              from: activeUnit.pos,
              to: coord,
              kind: "bullet",
              createdAt: nowTs,
              durationMs: 1780,
              hit: true,
              critical: true,
              damage: 5,
              bloodSeverity: 0,
              detonatedKegs: [coord],
            },
            lightFlashes: addLightFlash(
              addLightFlash(
                s.lightFlashes,
                muzzleFlashDraft(activeUnit.pos, newFacing, false),
              ),
              {
                kind: "blast",
                coord,
                color: "#f97316",
                intensity: 14,
                radius: 12,
                durationMs: 550,
              },
            ),
          }));

          triggerUnitFx(activeUnit.id, {
            lunge: true,
            banner: { phrase: phrase("banner.detonate"), tone: "crit" },
          });

          await delay(730);
          playExplosionSound();

          const beforeUnitsKeg = get().units;
          const blast = processExplosions(
            get().grid,
            beforeUnitsKeg,
            coord,
            5,
            2,
          );
          const captureSync = syncColloredoCaptureState(blast.nextUnits);
          const syncedUnits = syncColloredoMobility(captureSync.units);

          for (const vid of blast.victims) {
            const bUnit = beforeUnitsKeg.find((u) => u.id === vid);
            const aUnit = syncedUnits.find((u) => u.id === vid);
            const kegLoss =
              bUnit && aUnit
                ? buildUnitCombatLoss(bUnit, aUnit, {
                    attackerId: activeUnit.id,
                    weaponId: "powder_keg",
                    hit: true,
                    critical: true,
                    misfired: false,
                    hitChance: 100,
                    durationMs: 1500,
                  })
                : null;
            triggerUnitFx(vid, {
              hit: true,
              loss: kegLoss,
              banner: { phrase: phrase("banner.kegBlast"), tone: "crit" },
            });
          }

          set((s) => {
            const nextTutorialStep =
              s.tutorialStep === 3 ? (4 as const) : s.tutorialStep;
            const nextGuidedStep =
              s.guidedTutorial.enabled && s.guidedTutorial.currentStep === "step_7_keg_explosion"
                ? ("step_8_melee_finish" as const)
                : s.guidedTutorial.currentStep;
            return {
              gridVersion: s.gridVersion + 1,
              smokeVersion: s.smokeVersion + 2,
              units: syncedUnits,
              tutorialStep: nextTutorialStep,
              guidedTutorial: {
                ...s.guidedTutorial,
                currentStep: nextGuidedStep,
              },
              combatLog: [
                ...s.combatLog,
                makeLog(
                  s.round,
                  "player",
                  phrase("log.keg.shot", {
                    attackerId: activeUnit.id,
                    x: coord.x,
                    z: coord.z,
                    count: blast.victims.length,
                  }),
                  "crit",
                ),
              ],
            };
          });

          await delay(1050);
          const afterState = get();
          const outcomeCheck = checkMissionOutcome(
            afterState.grid,
            afterState.units,
          );
          const nextDerived = deriveSelectionData(
            afterState.grid,
            afterState.units,
            afterState.selectedUnitId,
            afterState.weather,
            afterState.selectedTargetId,
            afterState.fogSnapshot.exploredCoords,
            afterState.blastZones,
            afterState.fogOfWarEnabled,
          );
          set({
            isBusy: false,
            activeProjectile: null,
            actionMode: "move",
            outcome: outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            fogSnapshot: nextDerived.fogSnapshot,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            selectedTargetId: nextDerived.selectedTargetId,
          });
        })();
        return;
      }

      if (state.actionMode === "shoot") {
        const reach = state.reachableTiles.get(coordKey(coord));
        const activeUnit = state.units.find((u) => u.id === state.selectedUnitId);
        if (
          reach &&
          activeUnit &&
          activeUnit.alive &&
          activeUnit.ap > 0 &&
          (activeUnit.detainedTurns ?? 0) === 0 &&
          isUnitFighting(activeUnit)
        ) {
          get().setActionMode("move");
        } else {
          get().setActionMode("move");
          return;
        }
      }

      const currentMode = get().actionMode;
      if (currentMode !== "move" || !state.selectedUnitId) return;

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !unit ||
        !unit.alive ||
        unit.ap <= 0 ||
        (unit.detainedTurns ?? 0) > 0 ||
        !isUnitFighting(unit)
      )
        return;

      if (state.guidedTutorial.enabled && !state.guidedTutorial.dismissed) {
        const step = state.guidedTutorial.currentStep;
        if (!isTileAllowedForGuidedMove(step, coord)) {
          get().setGuidedTutorialReject(getGuidedRejectFeedback(step, "tile"));
          return;
        }
      }

      const reach = get().reachableTiles.get(coordKey(coord));
      if (!reach) return;

      const path = findPathAStar(
        state.grid,
        unit.pos,
        coord,
        state.units,
        unit.id,
      );
      if (path.length === 0) return;

      // Zjistíme, zda tento přesun byl spuštěn jako XCOM 2 Zteč zblízka (Run & Slash) na sousedního nepřítele
      const chainedMeleeEnemy =
        state.selectedTargetId
          ? state.units.find(
              (u) =>
                u.id === state.selectedTargetId &&
                u.faction === "enemy" &&
                isUnitFighting(u) &&
                isAdjacentForMelee(coord, u.pos) &&
                state.hoveredSpottedEnemyIds.includes(u.id),
            ) ?? null
          : null;
      const chainedMeleeTargetId = chainedMeleeEnemy?.id ?? null;

      void (async () => {
        const interactions = detectPathInteractions(state.grid, unit.pos, path);
        const isActionCam = shouldTriggerActionCamForMove({
          actionCamEnabled: state.actionCamEnabled,
          unit,
          path,
          apCost: reach.apCost,
          zone: reach.zone,
          interactions,
        });

        set((s) => ({
          isBusy: true,
          hoveredPath: [],
          reachableTiles: new Map(),
          cameraDirector: {
            ...s.cameraDirector,
            mode: isActionCam ? "ACTION_OTS_FOLLOW" : "TACTICAL_ISO",
            timeScale: 1.0,
            podReveal: null,
            overwatchSlowMo: null,
            coverSettle: null,
          },
        }));

        // Krokové vyhodnocení trasy s podporou přerušení uprostřed běhu (Pod Reveal & Overwatch Slow-Mo)
        let remainingPath = [...path];
        let actualFinalStep = path[path.length - 1]!;
        let prevStepForFacing = unit.pos;
        const startFloor = unit.pos.y;

        while (remainingPath.length > 0) {
          const currentState = get();
          const currentUnit = currentState.units.find((u) => u.id === unit.id);
          if (
            !currentUnit ||
            !isUnitFighting(currentUnit) ||
            (currentUnit.detainedTurns ?? 0) > 0
          ) {
            break;
          }

          // Hledáme nejbližší dlaždici na zbývající trase, která spustí Overwatch nebo Pod Reveal
          let cutIdx = remainingPath.length - 1;
          let triggersOverwatchAtCut = false;
          let newlyRevealedAtCut: UnitData[] = [];

          const activeWatchers = currentState.units.filter(
            (u) =>
              isUnitFighting(u) &&
              u.faction !== currentUnit.faction &&
              u.isOverwatch &&
              u.firearmLoaded !== false &&
              (u.id !== "player-colloredo" || u.pistolLoaded !== false),
          );

          for (let i = 0; i < remainingPath.length; i++) {
            const step = remainingPath[i]!;

            // A) Kontrola Overwatch / Připravené salvy na dlaždici `step`
            let stepTriggersOw = false;
            for (const watcher of activeWatchers) {
              const dist = gridDistance3D(watcher.pos, step);
              if (dist > watcher.weapon.maxRange) continue;
              if (
                watcher.weapon.overwatchMode === "prepared_volley_cone" &&
                !isInPreparedVolleyCone(watcher.pos, watcher.facing, step)
              ) {
                continue;
              }
              if (!checkLineOfSight3D(currentState.grid, watcher.pos, step).clear)
                continue;
              if (
                !checkFogLineOfSight3D(
                  currentState.grid,
                  watcher.pos,
                  step,
                  false,
                )
              )
                continue;
              const cov = resolveTargetCoverAgainstShot(
                currentState.grid,
                watcher.pos,
                step,
              );
              if (cov.cover !== "full") {
                stepTriggersOw = true;
                break;
              }
            }

            // B) Kontrola Pod Reveal (odhalení dosud neaktivované skupiny nepřátel v mlze války)
            let stepRevealed: UnitData[] = [];
            if (currentState.fogOfWarEnabled) {
              const recon = previewReconFromTile(
                currentState.grid,
                currentUnit,
                step,
                currentState.units,
                currentState.weather,
                currentState.revealedPodEnemyIds,
              );
              if (recon.spottedEnemyIds.length > 0) {
                stepRevealed = currentState.units.filter(
                  (u) =>
                    u.faction === "enemy" &&
                    isUnitFighting(u) &&
                    recon.spottedEnemyIds.includes(u.id) &&
                    !currentState.revealedPodEnemyIds.has(u.id),
                );
              }
            }

            if (stepTriggersOw || stepRevealed.length > 0) {
              cutIdx = i;
              triggersOverwatchAtCut = stepTriggersOw;
              newlyRevealedAtCut = stepRevealed;
              break;
            }
          }

          const segment = remainingPath.slice(0, cutIdx + 1);
          const segEnd = segment[segment.length - 1]!;
          const segPrev =
            segment.length >= 2
              ? segment[segment.length - 2]!
              : currentUnit.pos;
          const segFacing = facingFromDelta(
            segPrev,
            segEnd,
            currentUnit.facing,
          );

          await animateUnitAlongPath(unit.id, segment, {
            isActionCam,
            interactionKind: interactions.firstInteraction,
          });

          // Otevřeme případné dveře, kterými tento segment prošel
          let doorsOpenedInSeg = false;
          for (const stepCoord of segment) {
            if (get().grid.isDoorClosedAt(stepCoord)) {
              get().grid.setDoorState(stepCoord, "open");
              doorsOpenedInSeg = true;
            }
          }

          actualFinalStep = segEnd;
          prevStepForFacing = segPrev;

          // Aktualizujeme pozici jednotky na konci segmentu a zprůhledníme střechu, pokud vstoupila do budovy
          set((s) => {
            const nextFloor = resolveDynamicRoofCutawayFloor(
              segEnd,
              s.activeFloor,
            );
            const movedUnits = s.units.map((u) =>
              u.id === unit.id ? { ...u, pos: segEnd, facing: segFacing } : u,
            );
            const segFog = computeFogOfWar(
              s.grid,
              movedUnits,
              s.weather,
              s.fogSnapshot.exploredCoords,
              extractDynamicLights(s.blastZones),
            );
            return {
              activeFloor: nextFloor,
              gridVersion: s.gridVersion + (doorsOpenedInSeg ? 1 : 0),
              units: movedUnits,
              fogSnapshot: segFog,
            };
          });

          if (triggersOverwatchAtCut) {
            await performOverwatchReactionsIfAny(unit.id, segEnd, [segEnd]);
          }

          // Zkontrolujeme, zda voják po přepadu ze zálohy stále žije a může pokračovat
          const afterOwUnit = get().units.find((u) => u.id === unit.id);
          if (
            !afterOwUnit ||
            !isUnitFighting(afterOwUnit) ||
            (afterOwUnit.detainedTurns ?? 0) > 0
          ) {
            break;
          }

          if (newlyRevealedAtCut.length > 0) {
            await performPodRevealAndScramble(
              unit.id,
              segEnd,
              newlyRevealedAtCut,
            );
          }

          remainingPath = remainingPath.slice(cutIdx + 1);
        }

        const finalStep = actualFinalStep;
        const newFacing = facingFromDelta(
          prevStepForFacing,
          finalStep,
          unit.facing,
        );

        let moveRescuedColloredo = false;
        let moveDetainedColloredo = false;
        let guidedHandoffUnitId: string | null = null;

        set((s) => {
          const updatedUnits = s.units.map((u) =>
            u.id === unit.id
              ? {
                  ...u,
                  pos: finalStep,
                  facing: newFacing,
                  ap: Math.max(0, u.ap - reach.apCost),
                  movedThisTurn: true,
                  isOverwatch: false,
                }
              : u,
          );
          const captureSync = syncColloredoCaptureState(updatedUnits);
          moveRescuedColloredo = captureSync.rescued;
          moveDetainedColloredo = captureSync.newlyDetained;
          const syncedUnits = syncColloredoMobility(captureSync.units);

          const climb =
            finalStep.y !== startFloor
              ? finalStep.y > startFloor
                ? ("up" as const)
                : finalStep.y === 0
                  ? ("ground" as const)
                  : ("down" as const)
              : undefined;

          // Tutoriál: Krok 1 (Pohyb & Ovládání) automaticky přejde na Krok 2,
          // jakmile hráč poprvé pohne jednotkou
          const nextTutorialStep =
            s.tutorialStep === 1
              ? (2 as const)
              : s.tutorialStep;

          let nextGuidedStep = s.guidedTutorial.currentStep;
          if (s.guidedTutorial.enabled && !s.guidedTutorial.dismissed) {
            if (s.guidedTutorial.currentStep === "step_1_matej_move") {
              nextGuidedStep = "step_2_colloredo_escort";
              guidedHandoffUnitId = "player-colloredo";
            } else if (s.guidedTutorial.currentStep === "step_2_colloredo_escort") {
              nextGuidedStep = "step_3_vaclav_aim";
              guidedHandoffUnitId = "player-vaclav-michalovic";
            }
          }

          const extraLogs: CombatLogEntry[] = [];
          if (interactions.hasDoorBreach) {
            extraLogs.push(
              makeLog(
                s.round,
                "player",
                phrase("log.door.breach", { unitId: unit.id }),
                "overwatch",
              ),
            );
          }
          if (captureSync.rescued) {
            extraLogs.push(
              makeLog(
                s.round,
                "player",
                phrase("log.rescue.move", { unitId: unit.id }),
                "story",
              ),
            );
          } else if (captureSync.newlyDetained) {
            extraLogs.push(
              makeLog(
                s.round,
                "enemy",
                phrase("log.detained.escort"),
                "alert",
              ),
            );
          }

          return {
            units: syncedUnits,
            activeFloor: resolveDynamicRoofCutawayFloor(
              finalStep,
              finalStep.y,
            ),
            tutorialStep: nextTutorialStep,
            guidedTutorial: {
              ...s.guidedTutorial,
              currentStep: nextGuidedStep,
            },
            combatLog: [
              ...s.combatLog,
              makeLog(
                s.round,
                "player",
                phrase("log.move", {
                  unitId: unit.id,
                  zone: reach.zone,
                  x: finalStep.x,
                  y: finalStep.y,
                  z: finalStep.z,
                  climb,
                  floor: finalStep.y,
                }),
                "info",
              ),
              ...extraLogs,
            ],
          };
        });

        if (moveRescuedColloredo) {
          triggerUnitFx("player-colloredo", {
            banner: { phrase: phrase("banner.freed"), tone: "buff" },
          });
        } else if (moveDetainedColloredo) {
          triggerUnitFx("player-colloredo", {
            hit: true,
            banner: { phrase: phrase("banner.detainedHalf"), tone: "crit" },
          });
        }

        // State 4: Cover Settle & Camera Reset (animace zakleknutí do krytu a návrat do izometrického pohledu)
        const movedSurvivor = get().units.find(
          (u) => u.id === unit.id && isUnitFighting(u),
        );
        if (movedSurvivor) {
          const coverInfo = resolvePrimaryCoverDirection(get().grid, finalStep);
          triggerUnitFx(unit.id, {
            coverSettle: true,
            coverSettleDir: coverInfo.dir,
          });
          if (get().actionCamEnabled && (isActionCam || coverInfo.level !== "none")) {
            set((s) => ({
              cameraDirector: {
                ...s.cameraDirector,
                mode: "COVER_SETTLE_RESET",
                timeScale: 1.0,
                coverSettle: {
                  unitId: unit.id,
                  coord: finalStep,
                  coverLevel: coverInfo.level,
                  coverDir: coverInfo.dir,
                  startedAt: performance.now(),
                  durationMs: 380,
                },
              },
            }));
            await delay(360);
          }
        }

        const afterState = get();
        const outcomeCheck = checkMissionOutcome(afterState.grid, afterState.units);
        if (outcomeCheck.outcome !== "ongoing") {
          set((s) => ({
            cameraDirector: {
              ...s.cameraDirector,
              mode: "TACTICAL_ISO",
              timeScale: 1.0,
              coverSettle: null,
            },
          }));
          // Pokud hráč dosáhl vítězství a dosud nebyla vyřešena Paradoxní oběť, otevřeme dilematické okno!
          if (outcomeCheck.outcome === "victory" && !afterState.sacrificedHeroId) {
            const aliveCompanions = afterState.units.filter(
              (u) =>
                u.faction === "player" &&
                isUnitFighting(u) &&
                u.id !== "player-colloredo",
            );
            if (aliveCompanions.length > 0) {
              set({
                isBusy: false,
                sacrificeDilemmaOpen: true,
              });
              return;
            }
          }

          if (outcomeCheck.outcome === "defeat") {
            await playCaptureFinalAnimationAndDefeat(
              outcomeCheck.defeatReason ?? "zero_hp",
              afterState.round,
            );
            return;
          }

          set({
            isBusy: false,
            outcome: outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            defeatReason: null,
            combatLog: [
              ...afterState.combatLog,
              makeLog(
                afterState.round,
                "player",
                outcomeCheck.victoryReason === "boat_escape"
                  ? phrase("log.victory.boat")
                  : phrase("log.victory.annihilation"),
                "story",
              ),
            ],
          });
          return;
        }

        // XCOM 2 Zteč zblízka (Run & Slash): Pokud byl pohyb spuštěn pravým klikem na nepřítele
        // a voják doběhl živý na sousední pole k cíli, okamžitě provede útok zblízka za 0 AP navíc!
        if (chainedMeleeTargetId) {
          const latestState = get();
          const attackerAfterMove = latestState.units.find(
            (u) => u.id === unit.id && isUnitFighting(u) && (u.detainedTurns ?? 0) === 0,
          );
          const targetAfterMove = latestState.units.find(
            (u) => u.id === chainedMeleeTargetId && isUnitFighting(u),
          );
          if (
            attackerAfterMove &&
            targetAfterMove &&
            isAdjacentForMelee(attackerAfterMove.pos, targetAfterMove.pos)
          ) {
            set((s) => ({
              isBusy: false,
              selectedUnitId: attackerAfterMove.id,
              selectedTargetId: targetAfterMove.id,
              hoveredSpottedEnemyIds: [],
              cameraDirector: {
                ...s.cameraDirector,
                mode: "TACTICAL_ISO",
                timeScale: 1.0,
                podReveal: null,
                overwatchSlowMo: null,
                coverSettle: null,
              },
            }));
            get().executeMelee(targetAfterMove.id, { freeChainAp: true });
            return;
          }
        }

        const handoffUnit = guidedHandoffUnitId
          ? (afterState.units.find(
              (u) => u.id === guidedHandoffUnitId && isUnitFighting(u),
            ) ?? null)
          : null;
        const autoNextUnit = handoffUnit
          ? null
          : findNextAvailablePlayerUnit(
              afterState.units,
              afterState.selectedUnitId,
            );
        const autoNextId =
          handoffUnit?.id ?? autoNextUnit?.id ?? afterState.selectedUnitId;
        const nextDerived = deriveSelectionData(
          afterState.grid,
          afterState.units,
          autoNextId,
          afterState.weather,
          afterState.selectedTargetId,
          afterState.fogSnapshot.exploredCoords,
          afterState.blastZones,
          afterState.fogOfWarEnabled,
        );

        set((s) => ({
          isBusy: false,
          cameraDirector: {
            ...s.cameraDirector,
            mode: "TACTICAL_ISO",
            timeScale: 1.0,
            podReveal: null,
            overwatchSlowMo: null,
            coverSettle: null,
          },
          selectedUnitId: autoNextId,
          activeFloor: (handoffUnit ?? autoNextUnit)
            ? (handoffUnit ?? autoNextUnit)!.pos.y
            : s.activeFloor,
          units: nextDerived.units,
          fogSnapshot: nextDerived.fogSnapshot,
          reachableTiles: nextDerived.reachableTiles,
          visibleTargets: nextDerived.visibleTargets,
          visibleMeleeTargets: nextDerived.visibleMeleeTargets,
          selectedTargetId: nextDerived.selectedTargetId,
        }));
      })();
    },

    completeUnitMovement: () => {
      const cb = moveResolveCallback;
      moveResolveCallback = null;
      resetLiveMovementTelemetry();
      set({ activeMovement: null });
      if (cb) cb();
    },

    executeShoot: (targetIdArg?: string) => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const attacker = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !attacker ||
        !attacker.alive ||
        attacker.ap < 1 ||
        (attacker.detainedTurns ?? 0) > 0 ||
        !isUnitFighting(attacker)
      )
        return;

      if (attacker.id === "player-colloredo" && attacker.pistolLoaded === false) {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(s.round, "player", phrase("log.pistol.spent"), "alert"),
          ],
        }));
        triggerUnitFx(attacker.id, {
          banner: { phrase: phrase("banner.pistolEmpty"), tone: "misfire" },
        });
        return;
      }

      if (attacker.firearmLoaded === false) {
        const reqReloadAp = attacker.weapon.reloadApCost ?? 2;
        const curReload = attacker.reloadProgress ?? 0;
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.weapon.empty", {
                unitId: attacker.id,
                weaponId: attacker.weapon.id,
                progress: curReload,
                required: reqReloadAp,
              }),
              "alert",
            ),
          ],
        }));
        triggerUnitFx(attacker.id, {
          banner: {
            phrase: phrase("banner.barrelEmptyProgress", {
              progress: curReload,
              required: reqReloadAp,
            }),
            tone: "misfire",
          },
        });
        return;
      }

      const baseFireAp = attacker.weapon.fireApCost ?? 1;
      const isHipFire =
        baseFireAp >= 2 && (attacker.movedThisTurn || attacker.ap < baseFireAp);

      if (baseFireAp >= 2 && isHipFire && !attacker.weapon.allowEmergencyHipFire) {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.fork.requiresTwoAp", { weaponId: attacker.weapon.id }),
              "alert",
            ),
          ],
        }));
        triggerUnitFx(attacker.id, {
          banner: { phrase: phrase("banner.needTwoApStill"), tone: "misfire" },
        });
        return;
      }

      const apSpent = isHipFire ? 1 : baseFireAp;

      const chosenId = targetIdArg ?? state.selectedTargetId;
      const targetEval = state.visibleTargets.find(
        (t) => t.targetId === chosenId,
      );
      const target = state.units.find((u) => u.id === chosenId && u.alive);
      if (!targetEval || !target) return;

      void (async () => {
        const outcome = rollRangedAttack(
          attacker,
          target,
          targetEval.calculation,
        );
        const newFacing = facingFromDelta(
          attacker.pos,
          target.pos,
          attacker.facing,
        );

        const isVerdictShot =
          attacker.abilityBuffActive &&
          attacker.ability?.id === "klementinum_verdict";

        if (outcome.misfired) {
          playMisfireSound();
        } else {
          playGunshotSound(attacker.weapon.lockType === "wheellock");
        }

        // Pokud nedošlo k selhání doutnáku, výstřel zahalí dlaždici střelce oblakem kouře z černého prachu
        if (!outcome.misfired) {
          get().grid.addSmoke(attacker.pos, 0, 2);
        }

        // Zjistíme dopředu, zda zásah odpálí sousední prachový sud, aby 3D scéna vykreslila ohnivou kouli v okamžiku dopadu
        const neighborKegDir = (["N", "E", "S", "W"] as CardinalDir[]).find(
          (dir) => {
            const { dx, dz } = CARDINAL_OFFSETS[dir];
            const t = get().grid.getTile({
              x: target.pos.x + dx,
              y: target.pos.y,
              z: target.pos.z + dz,
            });
            return t && t.obstacle === "powder_keg";
          },
        );
        const willDetonateKegPos =
          neighborKegDir &&
          !outcome.misfired &&
          outcome.hit &&
          (outcome.critical || outcome.damage >= 5)
            ? {
                x: target.pos.x + CARDINAL_OFFSETS[neighborKegDir].dx,
                y: target.pos.y,
                z: target.pos.z + CARDINAL_OFFSETS[neighborKegDir].dz,
              }
            : null;

        const impactMeta = resolveShotImpactMetadata(
          get().grid,
          attacker.pos,
          target.pos,
          outcome,
        );
        const nowTs = performance.now();
        const isPistol =
          attacker.weapon.id === "colloredo_wheellock_pistol" ||
          attacker.id === "player-colloredo" ||
          attacker.weapon.name.toLowerCase().includes("pistol") ||
          attacker.weapon.name.toLowerCase().includes("bambitka");

        set((s) => ({
          isBusy: true,
          activeFloor: target.pos.y,
          smokeVersion: s.smokeVersion + 1,
          combatIntensity: s.combatIntensity + (willDetonateKegPos ? 3 : 1),
          blastZones: [
            ...s.blastZones.slice(-18),
            {
              id: fxSeq++,
              coord: attacker.pos,
              createdAt: nowTs,
              baseRadius: 1.5,
              maxRadius: 4.2,
              isExplosion: false,
            },
            ...(outcome.misfired
              ? []
              : [
                  {
                    id: fxSeq++,
                    coord:
                      willDetonateKegPos ??
                      (outcome.hit ? target.pos : impactMeta.missImpactCoord),
                    createdAt: nowTs,
                    baseRadius: willDetonateKegPos ? 2.8 : 1.3,
                    maxRadius: willDetonateKegPos ? 7.5 : 3.6,
                    isExplosion: !!willDetonateKegPos,
                  },
                ]),
          ],
          units: s.units.map((u) =>
            u.id === attacker.id
              ? {
                  ...u,
                  facing: newFacing,
                  // Výstřely ze všech pušek/mušket ukončují tah (ap = 0), pistole spotřebuje pouze apSpent
                  ap: isVerdictShot && outcome.hit
                    ? 1
                    : isPistol
                      ? Math.max(0, u.ap - apSpent)
                      : 0,
                  isOverwatch: false,
                  isShaken: isHipFire ? true : u.isShaken,
                  abilityBuffActive: false,
                  pistolLoaded:
                    attacker.id === "player-colloredo" ? false : u.pistolLoaded,
                  firearmLoaded: false,
                  reloadProgress: 0,
                }
              : u,
          ),
          activeProjectile: {
            id: fxSeq++,
            from: attacker.pos,
            to: target.pos,
            targetId: target.id,
            hitChance: outcome.hitChance,
            kind: isVerdictShot ? "sniper_beam" : "bullet",
            createdAt: nowTs,
            durationMs: 1780,
            hit: outcome.hit,
            critical: outcome.critical,
            misfired: outcome.misfired,
            damage: outcome.damage,
            bloodSeverity: impactMeta.bloodSeverity,
            armorShredded: outcome.armorShredded,
            armorAbsorbed: outcome.armorAbsorbed,
            killed: outcome.killed,
            impactObstacle: impactMeta.impactObstacle,
            missImpactCoord: impactMeta.missImpactCoord,
            detonatedKegs: willDetonateKegPos ? [willDetonateKegPos] : undefined,
          },
          lightFlashes: willDetonateKegPos
            ? addLightFlash(
                addLightFlash(
                  s.lightFlashes,
                  muzzleFlashDraft(attacker.pos, newFacing, outcome.misfired),
                ),
                {
                  kind: "blast",
                  coord: willDetonateKegPos,
                  color: "#f97316",
                  intensity: 14,
                  radius: 12,
                  durationMs: 550,
                },
              )
            : addLightFlash(
                s.lightFlashes,
                muzzleFlashDraft(attacker.pos, newFacing, outcome.misfired),
              ),
        }));

        triggerUnitFx(attacker.id, {
          lunge: true,
          banner: outcome.misfired
            ? { phrase: phrase("banner.misfireMatchcord"), tone: "misfire" }
            : isHipFire
              ? { phrase: phrase("banner.hipFire"), tone: "overwatch" }
              : undefined,
        });

        // Čekáme přesně na plynulý dolet kulky k cíli (~730 ms = 41 % z 1780 ms)
        await delay(730);
        if (!outcome.misfired) {
          if (outcome.hit) {
            playHitSound(outcome.critical, impactMeta.bloodSeverity);
          } else {
            playRicochetSound(impactMeta.impactObstacle === "palace_wood");
          }
        }
        if (willDetonateKegPos) {
          playExplosionSound();
        }

        let rescuedByShot = false;
        let detainedByBlast = false;
        let pendingDefeatReason: CaptureReason | null = null;
        let kegVictims: string[] = [];
        const beforeUnitsShoot = get().units;
        const beforeTargetShoot =
          beforeUnitsShoot.find((u) => u.id === target.id) ?? target;
        let afterUnitsShoot: UnitData[] = beforeUnitsShoot;

        set((s) => {
          if (!outcome.misfired) {
            s.grid.damageTile(
              outcome.hit ? target.pos : impactMeta.missImpactCoord,
              1,
            );
          }
          const updatedUnits = s.units.map((u) => {
            if (u.id !== target.id) return u;
            const nextArmor = Math.max(0, u.armor - outcome.armorShredded);
            const nextHp = u.hp - outcome.damage;
            const instantKilled = isInstantOverkill(nextHp, u.maxHp);
            const inThroes = !instantKilled && nextHp <= 0;
            const shakenNow =
              u.isShaken ||
              (outcome.hit && (outcome.critical || outcome.damage >= 4));
            return {
              ...u,
              armor: nextArmor,
              hp: nextHp,
              isShaken: nextHp > 0 ? shakenNow : false,
              alive: !instantKilled,
              inDeathThroes: inThroes,
              deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
              isOverwatch: nextHp > 0 ? u.isOverwatch : false,
            };
          });

          const targetAfter = updatedUnits.find((u) => u.id === target.id);
          const wasInstantKilled = targetAfter ? !targetAfter.alive : false;
          const enteredThroesNow = targetAfter ? targetAfter.inDeathThroes && !target.inDeathThroes : false;
          const shotPhrase = phrase("log.shot", {
            attackerId: attacker.id,
            targetId: target.id,
            weaponId: attacker.weapon.id,
            chance: outcome.hitChance,
            damage: outcome.damage,
            misfire: outcome.misfireChance,
            hit: outcome.hit,
            critical: outcome.critical,
            misfired: outcome.misfired,
            hipFire: isHipFire,
            fork: baseFireAp >= 2,
            height: outcome.heightAdvantage,
            flanked: outcome.flanked,
            shred: outcome.armorShredded,
            absorbed: outcome.armorAbsorbed,
            instant: wasInstantKilled,
            enteredThroes: enteredThroesNow,
            agony: !!targetAfter?.inDeathThroes,
            hp: targetAfter?.hp,
          });

          let finalUnits = updatedUnits;
          let kegDetonated = false;

          if (willDetonateKegPos) {
            const blast = processExplosions(
              s.grid,
              updatedUnits,
              willDetonateKegPos,
              5,
              2,
            );
            finalUnits = blast.nextUnits;
            kegVictims = blast.victims;
            kegDetonated = true;
          }

          const captureSync = syncColloredoCaptureState(finalUnits);
          rescuedByShot = captureSync.rescued;
          detainedByBlast = captureSync.newlyDetained;
          finalUnits = syncColloredoMobility(captureSync.units);
          afterUnitsShoot = finalUnits;

          const outcomeCheck = checkMissionOutcome(s.grid, finalUnits);
          if (outcomeCheck.outcome === "defeat") {
            pendingDefeatReason = outcomeCheck.defeatReason ?? "zero_hp";
          }

          const newLogs = [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              shotPhrase,
              outcome.misfired
                ? "misfire"
                : outcome.hit
                  ? outcome.critical
                    ? "crit"
                    : "hit"
                  : "miss",
            ),
          ];
          if (kegDetonated && willDetonateKegPos) {
            newLogs.push(
              makeLog(
                s.round,
                "player",
                phrase("log.keg.spark", {
                  x: willDetonateKegPos.x,
                  z: willDetonateKegPos.z,
                }),
                "alert",
              ),
            );
          }
          if (captureSync.rescued) {
            newLogs.push(
              makeLog(s.round, "player", phrase("log.rescue.shot"), "story"),
            );
          } else if (captureSync.newlyDetained) {
            newLogs.push(
              makeLog(s.round, "enemy", phrase("log.detained.blast"), "alert"),
            );
          }

          const nextTutorialStep =
            s.tutorialStep === 2
              ? (3 as const)
              : kegDetonated && s.tutorialStep === 3
                ? (4 as const)
                : s.tutorialStep;

          const nextGuidedStep =
            s.guidedTutorial.enabled && s.guidedTutorial.currentStep === "step_4_vaclav_shoot"
              ? ("step_5_enemy_turn_react" as const)
              : kegDetonated && s.guidedTutorial.currentStep === "step_7_keg_explosion"
                ? ("step_8_melee_finish" as const)
                : s.guidedTutorial.currentStep;

          return {
            gridVersion: s.gridVersion + (outcome.misfired ? 0 : 1),
            smokeVersion: s.smokeVersion + (kegDetonated ? 2 : 1),
            units: finalUnits,
            tutorialStep: nextTutorialStep,
            guidedTutorial: {
              ...s.guidedTutorial,
              currentStep: nextGuidedStep,
            },
            combatLog: newLogs,
          };
        });

        // Okamžitá reakce cíle a přímé zobrazení všech ztrát v momentě zásahu kulkou
        if (!outcome.misfired) {
          const afterTargetShoot =
            afterUnitsShoot.find((u) => u.id === target.id) ?? beforeTargetShoot;
          const targetLoss = buildUnitCombatLoss(
            beforeTargetShoot,
            afterTargetShoot,
            {
              attackerId: attacker.id,
              weaponId: attacker.weapon.id,
              hit: outcome.hit,
              critical: outcome.critical,
              misfired: outcome.misfired,
              hitChance: outcome.hitChance,
              armorAbsorbed: outcome.armorAbsorbed,
              durationMs: 1550,
            },
          );
          triggerUnitFx(target.id, {
            hit: outcome.hit,
            loss: targetLoss,
            banner: outcome.hit
              ? {
                  phrase: outcome.critical
                    ? phrase("banner.critShortBang", { damage: outcome.damage })
                    : phrase("banner.damage", { damage: outcome.damage }),
                  tone: outcome.critical ? "crit" : "hit",
                }
              : { phrase: phrase("banner.missedPlain"), tone: "miss" },
          });
        }

        for (const vid of kegVictims) {
          if (vid !== target.id) {
            const bUnit = beforeUnitsShoot.find((u) => u.id === vid);
            const aUnit = afterUnitsShoot.find((u) => u.id === vid);
            const vLoss =
              bUnit && aUnit
                ? buildUnitCombatLoss(bUnit, aUnit, {
                    attackerId: attacker.id,
                    weaponId: "powder_keg",
                    hit: true,
                    critical: true,
                    misfired: false,
                    hitChance: 100,
                    durationMs: 1550,
                  })
                : null;
            triggerUnitFx(vid, {
              hit: true,
              loss: vLoss,
              banner: { phrase: phrase("banner.kegBlast"), tone: "crit" },
            });
          }
        }

        if (rescuedByShot) {
          triggerUnitFx("player-colloredo", {
            banner: { phrase: phrase("banner.freed"), tone: "buff" },
          });
        } else if (detainedByBlast) {
          triggerUnitFx("player-colloredo", {
            hit: true,
            banner: { phrase: phrase("banner.detainedHalf"), tone: "crit" },
          });
        }

        // Necháme 1050 ms doznít efekt zásahu, rozpis ztrát cíle, krev a úlomky zdiva v záběru akční kamery
        await delay(1050);

        set((s) => {
          const outcomeCheck = checkMissionOutcome(s.grid, s.units);
          const autoNextUnit = findNextAvailablePlayerUnit(s.units, s.selectedUnitId);
          const autoNextId = autoNextUnit?.id ?? s.selectedUnitId;
          const nextDerived = deriveSelectionData(
            s.grid,
            s.units,
            autoNextId,
            s.weather,
            s.selectedTargetId,
            s.fogSnapshot.exploredCoords,
            s.blastZones,
            s.fogOfWarEnabled,
          );
          return {
            isBusy: outcomeCheck.outcome === "defeat",
            activeProjectile: null,
            selectedUnitId: autoNextId,
            actionMode: "move",
            activeFloor: autoNextUnit ? autoNextUnit.pos.y : attacker.pos.y,
            outcome:
              outcomeCheck.outcome === "defeat"
                ? "ongoing"
                : outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            fogSnapshot: nextDerived.fogSnapshot,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            visibleMeleeTargets: nextDerived.visibleMeleeTargets,
            selectedTargetId: nextDerived.selectedTargetId,
          };
        });

        if (pendingDefeatReason) {
          await playCaptureFinalAnimationAndDefeat(
            pendingDefeatReason,
            get().round,
          );
        }
      })();
    },

    executeReload: () => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !unit ||
        !isUnitFighting(unit) ||
        (unit.detainedTurns ?? 0) > 0
      )
        return;

      if (unit.id === "player-colloredo") {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(s.round, "player", phrase("log.pistol.cannotReload"), "alert"),
          ],
        }));
        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.pistolNoReload"), tone: "misfire" },
        });
        return;
      }

      if (unit.firearmLoaded !== false) {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.weapon.alreadyLoaded", {
                unitId: unit.id,
                weaponId: unit.weapon.id,
              }),
              "info",
            ),
          ],
        }));
        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.alreadyLoaded"), tone: "buff" },
        });
        return;
      }

      if (unit.ap < 1) {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.reload.noAp", { weaponId: unit.weapon.id }),
              "alert",
            ),
          ],
        }));
        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.needOneAp"), tone: "misfire" },
        });
        return;
      }

      playSpecialAbilitySound("klementinum_verdict");

      const requiredAp = unit.weapon.reloadApCost ?? 2;
      const prevProgress = unit.reloadProgress ?? 0;
      const nextProgress = Math.min(requiredAp, prevProgress + 1);
      const isNowLoaded = nextProgress >= requiredAp;

      const updatedUnits = state.units.map((u) =>
        u.id === unit.id
          ? {
              ...u,
              ap: Math.max(0, u.ap - 1),
              isOverwatch: false,
              reloadProgress: isNowLoaded ? 0 : nextProgress,
              firearmLoaded: isNowLoaded,
            }
          : u,
      );

      const autoNextUnit = findNextAvailablePlayerUnit(updatedUnits, unit.id);
      const autoNextId = autoNextUnit?.id ?? unit.id;

      let nextTutorialGuided = state.guidedTutorial.currentStep;
      let nextSelId = autoNextId;
      let nextFlr = autoNextUnit ? autoNextUnit.pos.y : unit.pos.y;
      if (
        state.guidedTutorial.enabled &&
        !state.guidedTutorial.dismissed &&
        state.guidedTutorial.currentStep === "step_6_vaclav_reload"
      ) {
        nextTutorialGuided = "step_7_keg_explosion";
        nextSelId = "player-bartolomej";
        nextFlr = 0;
      }

      const sel = deriveSelectionData(
        state.grid,
        updatedUnits,
        nextSelId,
        state.weather,
        state.selectedTargetId,
        state.fogSnapshot.exploredCoords,
        state.blastZones,
        state.fogOfWarEnabled,
      );

      set((s) => ({
        units: sel.units,
        selectedUnitId: nextSelId,
        activeFloor: nextFlr,
        guidedTutorial: {
          ...s.guidedTutorial,
          currentStep: nextTutorialGuided,
        },
        actionMode: "move",
        fogSnapshot: sel.fogSnapshot,
        reachableTiles: sel.reachableTiles,
        visibleTargets: sel.visibleTargets,
        visibleMeleeTargets: sel.visibleMeleeTargets,
        selectedTargetId: sel.selectedTargetId,
        combatLog: [
          ...s.combatLog,
          makeLog(
            s.round,
            "player",
            phrase("log.reload.step", {
              unitId: unit.id,
              progress: nextProgress,
              required: requiredAp,
              heavy: requiredAp >= 4,
              loaded: isNowLoaded,
            }),
            "buff",
          ),
        ],
      }));

      triggerUnitFx(unit.id, {
        banner: {
          phrase: isNowLoaded
            ? phrase("banner.reloadDone", { required: requiredAp })
            : phrase("banner.reloadStep", {
                progress: nextProgress,
                required: requiredAp,
              }),
          tone: "buff",
        },
      });
    },

    executeMelee: (targetIdArg?: string, options?: { freeChainAp?: boolean }) => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const isFreeChain = options?.freeChainAp === true;
      const attacker = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !attacker ||
        !attacker.alive ||
        (!isFreeChain && attacker.ap < 1) ||
        (attacker.detainedTurns ?? 0) > 0 ||
        !isUnitFighting(attacker)
      )
        return;

      const meleeWeapon = attacker.meleeWeapon ?? {
        id: "fist",
        name: "Pěstní souboj",
        kind: "fist" as const,
        minDamage: 1,
        maxDamage: 2,
        critBonusDamage: 1,
        baseCritChance: 5,
        baseAccuracy: 70,
        armorPierce: 0,
        armorShred: 0,
        description: "Zoufalý boj holýma rukama.",
      };

      const chosenId =
        targetIdArg ??
        state.visibleMeleeTargets[0]?.targetId ??
        state.selectedTargetId;
      const target = state.units.find(
        (u) =>
          u.id === chosenId &&
          isUnitFighting(u) &&
          u.faction !== attacker.faction,
      );
      if (!target || !isAdjacentForMelee(attacker.pos, target.pos)) return;

      void (async () => {
        const calc = calculateMeleeAttack(
          get().grid,
          attacker,
          target,
          get().units,
        );
        const outcome = rollMeleeAttack(attacker, target, calc);
        const newFacing = facingFromDelta(
          attacker.pos,
          target.pos,
          attacker.facing,
        );

        const isButt =
          meleeWeapon.kind === "pistol_butt" ||
          meleeWeapon.kind === "musket_butt";
        const spilledReload = !!(
          meleeWeapon.spillsReloadOnStrike &&
          attacker.firearmLoaded === false &&
          (attacker.reloadProgress ?? 0) > 0
        );
        playMeleeSound(isButt ? "butt" : "blade", outcome.hit, outcome.critical);

        const nowTs = performance.now();
        const bloodSev: 0 | 1 | 2 | 3 = !outcome.hit
          ? 0
          : isButt && outcome.damage < 6
            ? 1
            : outcome.critical || outcome.damage >= 5
              ? 3
              : 2;

        set((s) => ({
          isBusy: true,
          activeFloor: target.pos.y,
          combatIntensity: s.combatIntensity + 1,
          units: s.units.map((u) =>
            u.id === attacker.id
              ? {
                  ...u,
                  facing: newFacing,
                  ap: isFreeChain ? u.ap : Math.max(0, u.ap - 1),
                  isOverwatch: false,
                  reloadProgress: spilledReload ? 0 : u.reloadProgress,
                }
              : u,
          ),
          activeProjectile: {
            id: fxSeq++,
            from: attacker.pos,
            to: target.pos,
            targetId: target.id,
            hitChance: outcome.hitChance,
            kind: "melee_strike",
            createdAt: nowTs,
            durationMs: 1720,
            hit: outcome.hit,
            critical: outcome.critical,
            misfired: false,
            damage: outcome.damage,
            bloodSeverity: bloodSev,
            armorShredded: outcome.armorShredded,
            armorAbsorbed: outcome.armorAbsorbed,
            killed: outcome.killed,
          },
        }));

        triggerUnitFx(attacker.id, {
          lunge: true,
          banner: spilledReload
            ? { phrase: phrase("banner.buttSpill"), tone: "overwatch" }
            : isFreeChain
              ? { phrase: phrase("banner.chargeFree"), tone: "buff" }
              : isButt
                ? { phrase: phrase("banner.buttStrike"), tone: "buff" }
                : { phrase: phrase("banner.meleeStrike"), tone: "buff" },
        });

        // Čekáme na dopad úderu (~680 ms)
        await delay(680);

        if (outcome.hit) {
          playHitSound(outcome.critical, bloodSev);
        } else {
          playRicochetSound(true);
        }

        let rescuedByStrike = false;
        let pendingDefeatReason: CaptureReason | null = null;
        const beforeUnits = get().units;
        const beforeTarget =
          beforeUnits.find((u) => u.id === target.id) ?? target;

        set((s) => {
          const stunnedByButt =
            outcome.hit &&
            (meleeWeapon.stunChance ?? 0) > 0 &&
            Math.random() * 100 < (meleeWeapon.stunChance ?? 0);

          const updatedUnits = s.units.map((u) => {
            if (u.id !== target.id) return u;
            const nextArmor = Math.max(0, u.armor - outcome.armorShredded);
            const nextHp = u.hp - outcome.damage;
            const instantKilled = isInstantOverkill(nextHp, u.maxHp);
            const inThroes = !instantKilled && nextHp <= 0;
            const shakenNow =
              u.isShaken ||
              stunnedByButt ||
              (outcome.hit && (outcome.critical || outcome.damage >= 3));
            return {
              ...u,
              armor: nextArmor,
              hp: nextHp,
              isShaken: nextHp > 0 ? shakenNow : false,
              alive: !instantKilled,
              inDeathThroes: inThroes,
              deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
              isOverwatch: nextHp > 0 ? u.isOverwatch : false,
            };
          });

          const targetAfter = updatedUnits.find((u) => u.id === target.id);
          const wasInstantKilled = targetAfter ? !targetAfter.alive : false;
          const enteredThroesNow = targetAfter ? targetAfter.inDeathThroes && !target.inDeathThroes : false;
          const meleePhrase = phrase("log.melee", {
            attackerId: attacker.id,
            targetId: target.id,
            meleeId: meleeWeapon.id,
            butt: isButt,
            hit: outcome.hit,
            critical: outcome.critical,
            chance: outcome.hitChance,
            damage: outcome.damage,
            stunned: stunnedByButt,
            spilled: spilledReload,
            height: outcome.heightAdvantage,
            shred: outcome.armorShredded,
            absorbed: outcome.armorAbsorbed,
            instant: wasInstantKilled,
            enteredThroes: enteredThroesNow,
            agony: !!targetAfter?.inDeathThroes,
            hp: targetAfter?.hp,
          });

          const captureSync = syncColloredoCaptureState(updatedUnits);
          rescuedByStrike = captureSync.rescued;
          const finalUnits = syncColloredoMobility(captureSync.units);

          const outcomeCheck = checkMissionOutcome(s.grid, finalUnits);
          if (outcomeCheck.outcome === "defeat") {
            pendingDefeatReason = outcomeCheck.defeatReason ?? "zero_hp";
          }

          const newLogs = [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              meleePhrase,
              outcome.hit ? (outcome.critical ? "crit" : "hit") : "miss",
            ),
          ];
          if (captureSync.rescued) {
            newLogs.push(
              makeLog(s.round, "player", phrase("log.rescue.melee"), "story"),
            );
          }

          let nextGuidedStep = s.guidedTutorial.currentStep;
          if (s.guidedTutorial.enabled && !s.guidedTutorial.dismissed) {
            if (s.guidedTutorial.currentStep === "step_8_melee_finish") {
              nextGuidedStep = "step_9_free_combat";
            }
          }

          return {
            units: finalUnits,
            guidedTutorial: {
              ...s.guidedTutorial,
              currentStep: nextGuidedStep,
            },
            combatLog: newLogs,
          };
        });

        const afterUnits = get().units;
        const afterTarget = afterUnits.find((u) => u.id === target.id);
        const lossObj: UnitCombatLoss | null = outcome.hit
          ? {
              id: fxSeq++,
              timestamp: performance.now(),
              durationMs: 1650,
              attackerId: attacker.id,
              weaponId: meleeWeapon.id,
              hit: true,
              critical: outcome.critical,
              misfired: false,
              hitChance: outcome.hitChance,
              hpBefore: beforeTarget.hp,
              hpAfter: afterTarget?.hp ?? 0,
              hpLost: outcome.damage,
              maxHp: target.maxHp,
              armorBefore: beforeTarget.armor,
              armorAfter: afterTarget?.armor ?? 0,
              armorLost: outcome.armorShredded,
              armorAbsorbed: outcome.armorAbsorbed,
              maxArmor: target.maxArmor,
              apLost: 0,
              shakenApplied: (afterTarget?.isShaken ?? false) && !beforeTarget.isShaken,
              overwatchLost: beforeTarget.isOverwatch && !(afterTarget?.isOverwatch ?? false),
              detainedApplied: false,
              killed: outcome.killed,
            }
          : null;

        triggerUnitFx(target.id, {
          hit: outcome.hit,
          loss: lossObj,
          banner: outcome.hit
            ? outcome.critical
              ? {
                  phrase: phrase("banner.critDamage", { damage: outcome.damage }),
                  tone: "crit",
                }
              : {
                  phrase: phrase("banner.damage", { damage: outcome.damage }),
                  tone: "hit",
                }
            : { phrase: phrase("banner.meleeMiss"), tone: "miss" },
        });

        if (rescuedByStrike) {
          triggerUnitFx("player-colloredo", {
            banner: { phrase: phrase("banner.freed"), tone: "buff" },
          });
        }

        await delay(1040);

        set((s) => {
          const outcomeCheck = checkMissionOutcome(s.grid, s.units);
          const autoNextUnit = findNextAvailablePlayerUnit(s.units, s.selectedUnitId);
          const autoNextId = autoNextUnit?.id ?? s.selectedUnitId;
          const nextDerived = deriveSelectionData(
            s.grid,
            s.units,
            autoNextId,
            s.weather,
            s.selectedTargetId,
            s.fogSnapshot.exploredCoords,
            s.blastZones,
            s.fogOfWarEnabled,
          );
          return {
            isBusy: outcomeCheck.outcome === "defeat",
            activeProjectile: null,
            selectedUnitId: autoNextId,
            actionMode: "move",
            activeFloor: autoNextUnit ? autoNextUnit.pos.y : attacker.pos.y,
            outcome:
              outcomeCheck.outcome === "defeat"
                ? "ongoing"
                : outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            fogSnapshot: nextDerived.fogSnapshot,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            visibleMeleeTargets: nextDerived.visibleMeleeTargets,
            selectedTargetId: nextDerived.selectedTargetId,
          };
        });

        if (pendingDefeatReason) {
          await playCaptureFinalAnimationAndDefeat(
            pendingDefeatReason,
            get().round,
          );
        }
      })();
    },

    activateOverwatch: () => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !unit ||
        !unit.alive ||
        unit.ap < 1 ||
        unit.isOverwatch ||
        (unit.detainedTurns ?? 0) > 0 ||
        !isUnitFighting(unit)
      )
        return;

      if (
        unit.firearmLoaded === false ||
        (unit.id === "player-colloredo" && unit.pistolLoaded === false)
      ) {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.weapon.emptyOverwatch", { unitId: unit.id }),
              "alert",
            ),
          ],
        }));
        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.barrelEmpty"), tone: "misfire" },
        });
        return;
      }

      const requiredOwAp = unit.weapon.fireApCost ?? 1;
      if (unit.ap < requiredOwAp) {
        set((s) => ({
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.overwatch.needAp", {
                weaponId: unit.weapon.id,
                required: requiredOwAp,
              }),
              "alert",
            ),
          ],
        }));
        triggerUnitFx(unit.id, {
          banner: {
            phrase: phrase("banner.needAp", { required: requiredOwAp }),
            tone: "misfire",
          },
        });
        return;
      }

      const isConeVolley =
        unit.weapon.overwatchMode === "prepared_volley_cone";

      const updatedUnits = state.units.map((u) =>
        u.id === unit.id ? { ...u, ap: 0, isOverwatch: true } : u,
      );
      const autoNextUnit = findNextAvailablePlayerUnit(updatedUnits, unit.id);
      const autoNextId = autoNextUnit?.id ?? unit.id;
      const nextDerived = deriveSelectionData(
        state.grid,
        updatedUnits,
        autoNextId,
        state.weather,
        state.selectedTargetId,
        state.fogSnapshot.exploredCoords,
        state.blastZones,
        state.fogOfWarEnabled,
      );

      set((s) => ({
        units: updatedUnits,
        selectedUnitId: autoNextId,
        activeFloor: autoNextUnit ? autoNextUnit.pos.y : s.activeFloor,
        actionMode: "move",
        fogSnapshot: nextDerived.fogSnapshot,
        reachableTiles: nextDerived.reachableTiles,
        visibleTargets: nextDerived.visibleTargets,
        visibleMeleeTargets: nextDerived.visibleMeleeTargets,
        selectedTargetId: nextDerived.selectedTargetId,
        combatLog: [
          ...s.combatLog,
          makeLog(
            s.round,
            "player",
            isConeVolley
              ? phrase("log.overwatch.cone", {
                  unitId: unit.id,
                  facing: unit.facing,
                })
              : phrase("log.overwatch.360", { unitId: unit.id }),
            "overwatch",
          ),
        ],
      }));

      triggerUnitFx(unit.id, {
        banner: {
          phrase: isConeVolley
            ? phrase("banner.overwatchCone")
            : phrase("banner.overwatch360"),
          tone: "overwatch",
        },
      });
    },

    activateSpecialAbility: (unitIdArg?: string) => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const targetUnitId = unitIdArg ?? state.selectedUnitId;
      if (!targetUnitId) return;

      if (unitIdArg && unitIdArg !== state.selectedUnitId) {
        get().selectUnit(unitIdArg);
      }

      const freshState = get();
      const unit = freshState.units.find((u) => u.id === targetUnitId);
      if (
        !unit ||
        !isUnitFighting(unit) ||
        (unit.detainedTurns ?? 0) > 0 ||
        !unit.ability ||
        unit.ability.currentCooldown > 0 ||
        unit.ap < unit.ability.apCost
      ) {
        return;
      }

      const ability = unit.ability;
      const nextAp = Math.max(0, unit.ap - ability.apCost);

      if (ability.id === "protector_oath") {
        // 1. Jan Matěj: Přísaha komorníka & Věrná stráž (0 AP, CD 2)
        // Přiskočí k maršálovi (pokud je dále), nasadí mu ochranný plášť (+2 Zbroj, +3 HP, +1 AP, záchrana ze zadržení)
        // a zahalí maršálovo stanoviště do husté dýmové clony (3x3), sám získá +1 Zbroj a +1 AP!
        playSpecialAbilitySound("protector_oath");
        let rescuedMarshal = false;
        let colloredoKeptMortalWound = false;
        const colloredo = freshState.units.find(
          (u) => u.id === "player-colloredo" && u.alive,
        );

        let newJanPos = unit.pos;
        if (colloredo && gridDistance3D(unit.pos, colloredo.pos) > 1) {
          const offsets = [
            { x: -1, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: -1 },
            { x: 1, z: -1 },
            { x: -1, z: 1 },
            { x: 1, z: 1 },
          ];
          for (const off of offsets) {
            const candidate: GridCoord = {
              x: colloredo.pos.x + off.x,
              y: colloredo.pos.y,
              z: colloredo.pos.z + off.z,
            };
            const tile = freshState.grid.getTile(candidate);
            const occupied = freshState.units.some(
              (u) => u.alive && u.id !== unit.id && sameCoord(u.pos, candidate),
            );
            if (tile && tile.walkable && !occupied) {
              newJanPos = candidate;
              break;
            }
          }
        }

        if (colloredo) {
          freshState.grid.addSmoke(colloredo.pos, 1, 3);
        }

        const updatedUnits = freshState.units.map((u) => {
          if (u.id === unit.id) {
            return {
              ...u,
              pos: newJanPos,
              ap: Math.min(u.maxAp + 1, nextAp + 1),
              isShaken: false,
              abilityBuffActive: true,
              ability: u.ability
                ? { ...u.ability, currentCooldown: u.ability.cooldownTurns }
                : undefined,
            };
          }
          if (u.id === "player-colloredo" && u.alive) {
            const wasDetained = (u.detainedTurns ?? 0) > 0;
            if (wasDetained) rescuedMarshal = true;
            const dying = u.hp <= 0 || !!u.inDeathThroes;
            if (dying) colloredoKeptMortalWound = true;
            const nextMaxArmor = Math.max(2, u.maxArmor + 1);
            return {
              ...u,
              hp: dying ? u.hp : Math.min(u.maxHp, u.hp + 3),
              maxArmor: nextMaxArmor,
              armor: Math.min(nextMaxArmor, u.armor + 2),
              ap: Math.min(u.maxAp + 1, Math.max(1, u.ap + 1)),
              isShaken: dying ? u.isShaken : false,
              detainedTurns: 0,
              captureReason: null,
            };
          }
          return u;
        });

        const syncedUnits = syncColloredoMobility(updatedUnits);
        const nextDerived = deriveSelectionData(
          freshState.grid,
          syncedUnits,
          unit.id,
          freshState.weather,
          freshState.selectedTargetId,
          freshState.fogSnapshot.exploredCoords,
          freshState.blastZones,
          freshState.fogOfWarEnabled,
        );

        set((s) => ({
          smokeVersion: s.smokeVersion + 1,
          units: nextDerived.units,
          selectedUnitId: unit.id,
          activeFloor: unit.pos.y,
          fogSnapshot: nextDerived.fogSnapshot,
          reachableTiles: nextDerived.reachableTiles,
          visibleTargets: nextDerived.visibleTargets,
          selectedTargetId: nextDerived.selectedTargetId,
          demonstratedAbilities: {
            ...s.demonstratedAbilities,
            [unit.id]: true,
          },
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.ability.cloak", {
                abilityId: ability.id,
                unitId: unit.id,
                keptWound: colloredoKeptMortalWound,
                rescued: rescuedMarshal,
              }),
              "buff",
            ),
          ],
        }));

        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.oath"), tone: "buff" },
        });
        triggerUnitFx("player-colloredo", {
          banner: {
            phrase: rescuedMarshal
              ? phrase("banner.cloakFreed")
              : phrase("banner.cloak"),
            tone: "buff",
          },
        });
        return;
      }

      if (ability.id === "klementinum_verdict") {
        // 2. Václav z Michalovic: Svatováclavský ortel & Průrazná salva (0 AP, CD 2)
        // Posvěcený suchý prach: +35 % Zásah, +45 % Krit, +3 DMG, +2 Průraz, ignoruje zídky, 0 % selhání v dešti a zisk +1 AP!
        playSpecialAbilitySound("klementinum_verdict");
        const updatedUnits = freshState.units.map((u) =>
          u.id === unit.id
            ? {
                ...u,
                ap: Math.min(u.maxAp + 1, nextAp + 1), // Zisk +1 AP pro okamžité manévrování nebo dvě akce!
                isShaken: false,
                abilityBuffActive: true,
                ability: u.ability
                  ? { ...u.ability, currentCooldown: u.ability.cooldownTurns }
                  : undefined,
              }
            : u,
        );

        const nextDerived = deriveSelectionData(
          freshState.grid,
          updatedUnits,
          unit.id,
          freshState.weather,
          freshState.selectedTargetId,
          freshState.fogSnapshot.exploredCoords,
          freshState.blastZones,
          freshState.fogOfWarEnabled,
        );
        const switchToShoot = nextDerived.visibleTargets.length > 0;

        set((s) => ({
          units: nextDerived.units,
          selectedUnitId: unit.id,
          activeFloor: unit.pos.y,
          actionMode: switchToShoot ? "shoot" : s.actionMode,
          fogSnapshot: nextDerived.fogSnapshot,
          reachableTiles: nextDerived.reachableTiles,
          visibleTargets: nextDerived.visibleTargets,
          selectedTargetId: nextDerived.selectedTargetId,
          demonstratedAbilities: {
            ...s.demonstratedAbilities,
            [unit.id]: true,
          },
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.ability.verdict", {
                abilityId: ability.id,
                unitId: unit.id,
              }),
              "crit",
            ),
          ],
        }));

        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.verdict"), tone: "crit" },
        });
        return;
      }

      if (ability.id === "maltese_shrapnel") {
        // 3. Bratr Bartoloměj: Maltézská pekelná salva & Detonace (1 AP, CD 2)
        // Odpálí kazetový šrapnel: zasáhne všechny nepřátele v okruhu (3 HP, -2 zbroj, omráčení), odpálí sudy a doplní +1 granát!
        playSpecialAbilitySound("maltese_shrapnel");
        freshState.grid.addSmoke(unit.pos, 1, 3);

        const livingEnemies = freshState.units.filter(
          (u) => u.faction === "enemy" && u.alive,
        );
        const inRangeEnemies = livingEnemies.filter(
          (e) => gridDistance3D(unit.pos, e.pos) <= 9,
        );
        const hitEnemyList =
          inRangeEnemies.length > 0 ? inRangeEnemies : livingEnemies.slice(0, 2);
        const hitEnemyIds = new Set<string>(hitEnemyList.map((e) => e.id));

        let updatedUnits = freshState.units.map((u) => {
          if (u.id === unit.id) {
            return {
              ...u,
              ap: nextAp,
              grenades: Math.min(3, u.grenades + 1), // Doplní +1 granát do brašny!
              isShaken: false,
              abilityBuffActive: true,
              ability: u.ability
                ? { ...u.ability, currentCooldown: u.ability.cooldownTurns }
                : undefined,
            };
          }
          if (hitEnemyIds.has(u.id)) {
            const nextHp = u.hp - 3;
            const nextArmor = Math.max(0, u.armor - 2);
            const instantKilled = isInstantOverkill(nextHp, u.maxHp);
            const inThroes = !instantKilled && nextHp <= 0;
            return {
              ...u,
              hp: nextHp,
              armor: nextArmor,
              alive: !instantKilled,
              inDeathThroes: inThroes,
              deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
              isShaken: nextHp > 0 ? true : false,
              ap: Math.max(0, u.ap - 1),
              isOverwatch: false,
            };
          }
          return u;
        });

        // Kontrola a řetězový odpal prachových sudů v zóně výbuchu
        let kegDetonated = false;
        let shrapnelKegX: number | undefined;
        let shrapnelKegZ: number | undefined;
        for (const hitEnemy of hitEnemyList) {
          const nearbyKegPos = (["N", "E", "S", "W"] as CardinalDir[]).map(
            (dir) => {
              const { dx, dz } = CARDINAL_OFFSETS[dir];
              return {
                x: hitEnemy.pos.x + dx,
                y: hitEnemy.pos.y,
                z: hitEnemy.pos.z + dz,
              };
            },
          ).find((pos) => {
            const t = freshState.grid.getTile(pos);
            return t && t.obstacle === "powder_keg";
          });

          if (nearbyKegPos) {
            const blast = processExplosions(
              freshState.grid,
              updatedUnits,
              nearbyKegPos,
              5,
              2,
            );
            updatedUnits = blast.nextUnits;
            kegDetonated = true;
            shrapnelKegX = nearbyKegPos.x;
            shrapnelKegZ = nearbyKegPos.z;
            break;
          }
        }

        const captureSync = syncColloredoCaptureState(updatedUnits);
        const syncedUnits = syncColloredoMobility(captureSync.units);
        const autoNextUnit = findNextAvailablePlayerUnit(syncedUnits, unit.id);
        const autoNextId = autoNextUnit?.id ?? unit.id;
        const nextDerived = deriveSelectionData(
          freshState.grid,
          syncedUnits,
          autoNextId,
          freshState.weather,
          freshState.selectedTargetId,
          freshState.fogSnapshot.exploredCoords,
          freshState.blastZones,
          freshState.fogOfWarEnabled,
        );

        const primaryTargetPos =
          hitEnemyList.length > 0 ? hitEnemyList[0]!.pos : unit.pos;

        const shrapnelProjId = fxSeq++;
        const nowTs = performance.now();
        if (kegDetonated) {
          playExplosionSound();
        }
        for (const hitEnemy of hitEnemyList) {
          freshState.grid.damageTile(hitEnemy.pos, 1);
        }
        set((s) => ({
          smokeVersion: s.smokeVersion + (kegDetonated ? 2 : 1),
          gridVersion: s.gridVersion + 1,
          combatIntensity: s.combatIntensity + (kegDetonated ? 4 : 2),
          blastZones: [
            ...s.blastZones.slice(-16),
            {
              id: fxSeq++,
              coord: unit.pos,
              createdAt: nowTs,
              baseRadius: 2.2,
              maxRadius: 5.5,
              isExplosion: true,
            },
            ...hitEnemyList.map((e) => ({
              id: fxSeq++,
              coord: e.pos,
              createdAt: nowTs,
              baseRadius: 1.8,
              maxRadius: 4.5,
              isExplosion: kegDetonated,
            })),
          ],
          units: nextDerived.units,
          selectedUnitId: autoNextId,
          activeFloor: autoNextUnit ? autoNextUnit.pos.y : unit.pos.y,
          activeProjectile: {
            id: shrapnelProjId,
            from: unit.pos,
            to: primaryTargetPos,
            targetId: hitEnemyList[0]?.id,
            hitChance: 100,
            kind: "shrapnel_burst",
            createdAt: nowTs,
            durationMs: 1670,
            hit: true,
            critical: true,
            damage: 3,
            bloodSeverity: 2,
            armorShredded: 2,
            extraTargets: hitEnemyList.map((e) => e.pos),
          },
          fogSnapshot: nextDerived.fogSnapshot,
          reachableTiles: nextDerived.reachableTiles,
          visibleTargets: nextDerived.visibleTargets,
          selectedTargetId: nextDerived.selectedTargetId,
          demonstratedAbilities: {
            ...s.demonstratedAbilities,
            [unit.id]: true,
          },
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.ability.shrapnel", {
                abilityId: ability.id,
                unitId: unit.id,
                count: hitEnemyIds.size,
                keg: kegDetonated,
                kegX: shrapnelKegX,
                kegZ: shrapnelKegZ,
              }),
              "crit",
            ),
          ],
        }));

        const shrapnelTimer = setTimeout(() => {
          if (get().activeProjectile?.id === shrapnelProjId) {
            set({ activeProjectile: null });
          }
        }, 1670);
        (shrapnelTimer as unknown as { unref?: () => void }).unref?.();

        triggerUnitFx(unit.id, {
          lunge: true,
          banner: { phrase: phrase("banner.shrapnel"), tone: "crit" },
        });
        for (const eid of hitEnemyIds) {
          const bEnemy = freshState.units.find((u) => u.id === eid);
          const aEnemy = nextDerived.units.find((u) => u.id === eid);
          const shrapnelLoss =
            bEnemy && aEnemy
              ? buildUnitCombatLoss(bEnemy, aEnemy, {
                  attackerId: unit.id,
                  weaponId: ability.id,
                  hit: true,
                  critical: true,
                  misfired: false,
                  hitChance: 100,
                  durationMs: 1670,
                })
              : null;
          triggerUnitFx(eid, {
            hit: true,
            loss: shrapnelLoss,
            banner: { phrase: phrase("banner.shrapnelHit"), tone: "crit" },
          });
        }
        return;
      }

      if (ability.id === "marshal_command") {
        playSpecialAbilitySound("marshal_command");
        const updatedUnits = freshState.units.map((u) => {
          if (u.id === unit.id) {
            return {
              ...u,
              ap: nextAp,
              isShaken: false,
              abilityBuffActive: true,
              ability: u.ability
                ? { ...u.ability, currentCooldown: u.ability.cooldownTurns }
                : undefined,
            };
          }
          if (u.faction === "player" && u.alive && u.id !== unit.id) {
            return {
              ...u,
              ap: Math.min(u.maxAp + 2, u.ap + 2),
              isShaken: false,
            };
          }
          return u;
        });

        const syncedUnits = syncColloredoMobility(updatedUnits);
        const nextDerived = deriveSelectionData(
          freshState.grid,
          syncedUnits,
          unit.id,
          freshState.weather,
          freshState.selectedTargetId,
          freshState.fogSnapshot.exploredCoords,
          freshState.blastZones,
          freshState.fogOfWarEnabled,
        );

        set((s) => ({
          units: nextDerived.units,
          selectedUnitId: unit.id,
          activeFloor: unit.pos.y,
          fogSnapshot: nextDerived.fogSnapshot,
          reachableTiles: nextDerived.reachableTiles,
          visibleTargets: nextDerived.visibleTargets,
          selectedTargetId: nextDerived.selectedTargetId,
          demonstratedAbilities: {
            ...s.demonstratedAbilities,
            [unit.id]: true,
          },
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              phrase("log.ability.command", { abilityId: ability.id }),
              "buff",
            ),
          ],
        }));

        triggerUnitFx(unit.id, {
          banner: { phrase: phrase("banner.command"), tone: "buff" },
        });
        for (const ally of syncedUnits) {
          if (ally.faction === "player" && ally.alive && ally.id !== unit.id) {
            triggerUnitFx(ally.id, {
              banner: { phrase: phrase("banner.plusTwoAp"), tone: "buff" },
            });
          }
        }
        return;
      }
    },

    executeGrenade: (targetCoord: GridCoord) => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const attacker = state.units.find((u) => u.id === state.selectedUnitId);
      if (
        !attacker ||
        !attacker.alive ||
        attacker.ap < 1 ||
        attacker.grenades <= 0 ||
        (attacker.detainedTurns ?? 0) > 0 ||
        !isUnitFighting(attacker)
      )
        return;

      const dist = gridDistance3D(attacker.pos, targetCoord);
      if (dist > 8) return;

      void (async () => {
        const newFacing = facingFromDelta(
          attacker.pos,
          targetCoord,
          attacker.facing,
        );

        const nowTs = performance.now();
        set((s) => ({
          isBusy: true,
          combatIntensity: s.combatIntensity + 3,
          blastZones: [
            ...s.blastZones.slice(-18),
            {
              id: fxSeq++,
              coord: targetCoord,
              createdAt: nowTs,
              baseRadius: 2.6,
              maxRadius: 7.2,
              isExplosion: true,
            },
          ],
          units: s.units.map((u) =>
            u.id === attacker.id
              ? {
                  ...u,
                  facing: newFacing,
                  ap: 0,
                  grenades: Math.max(0, u.grenades - 1),
                  isOverwatch: false,
                }
              : u,
          ),
          activeProjectile: {
            id: fxSeq++,
            from: attacker.pos,
            to: targetCoord,
            kind: "grenade",
            createdAt: nowTs,
            durationMs: 1370,
            hit: true,
            critical: true,
          },
        }));

        triggerUnitFx(attacker.id, { lunge: true });

        await delay(560);
        playExplosionSound();
        get().triggerLightFlash({
          kind: "blast",
          coord: targetCoord,
          color: "#f97316",
          intensity: 14,
          radius: 12,
          durationMs: 550,
        });

        const grenadeDamage = 4;
        const grenadeShred = 2;

        // Zpracování exploze petardy a případné řetězové detonace prachových sudů
        const beforeGrenadeUnits = get().units;
        const blast = processExplosions(
          get().grid,
          beforeGrenadeUnits,
          targetCoord,
          grenadeDamage,
          grenadeShred,
        );
        const hitVictims = blast.victims;
        const captureSync = syncColloredoCaptureState(blast.nextUnits);
        const updatedUnits = syncColloredoMobility(captureSync.units);
        let pendingDefeatReason: CaptureReason | null = null;

        for (const vid of hitVictims) {
          const bUnit = beforeGrenadeUnits.find((u) => u.id === vid);
          const aUnit = updatedUnits.find((u) => u.id === vid);
          const gLoss =
            bUnit && aUnit
              ? buildUnitCombatLoss(bUnit, aUnit, {
                  attackerId: attacker.id,
                  weaponId: "grenade",
                  hit: true,
                  critical: true,
                  misfired: false,
                  hitChance: 100,
                  durationMs: 1300,
                })
              : null;
          triggerUnitFx(vid, {
            hit: true,
            loss: gLoss,
            banner:
              vid === "player-colloredo" && captureSync.newlyDetained
                ? { phrase: phrase("banner.detainedHalf"), tone: "crit" }
                : {
                    phrase: phrase("banner.grenadeBlast", { damage: grenadeDamage }),
                    tone: "crit",
                  },
          });
        }

        if (captureSync.rescued) {
          triggerUnitFx("player-colloredo", {
            banner: { phrase: phrase("banner.freed"), tone: "buff" },
          });
        }

        set((s) => {
          const outcomeCheck = checkMissionOutcome(s.grid, updatedUnits);
          if (outcomeCheck.outcome === "defeat") {
            pendingDefeatReason = outcomeCheck.defeatReason ?? "zero_hp";
          }

          const detonatedKeg = blast.detonatedKegs[0];

          const nextTutorialStep =
            s.tutorialStep === 3 ? (4 as const) : s.tutorialStep;

          const nextGuidedStep =
            s.guidedTutorial.enabled && s.guidedTutorial.currentStep === "step_7_keg_explosion"
              ? ("step_8_melee_finish" as const)
              : s.guidedTutorial.currentStep;

          const extraLogs: CombatLogEntry[] = [];
          if (captureSync.rescued) {
            extraLogs.push(
              makeLog(s.round, "player", phrase("log.rescue.grenade"), "story"),
            );
          } else if (captureSync.newlyDetained) {
            extraLogs.push(
              makeLog(s.round, "enemy", phrase("log.detained.grenade"), "alert"),
            );
          }

          return {
            gridVersion: s.gridVersion + 1,
            smokeVersion: s.smokeVersion + 1,
            units: updatedUnits,
            tutorialStep: nextTutorialStep,
            guidedTutorial: {
              ...s.guidedTutorial,
              currentStep: nextGuidedStep,
            },
            combatLog: [
              ...s.combatLog,
              makeLog(
                s.round,
                "player",
                phrase("log.grenade", {
                  attackerId: attacker.id,
                  x: targetCoord.x,
                  y: targetCoord.y,
                  z: targetCoord.z,
                  count: hitVictims.length,
                  damage: grenadeDamage,
                  shred: grenadeShred,
                  keg: blast.detonatedKegs.length > 0,
                  kegX: detonatedKeg?.x,
                  kegZ: detonatedKeg?.z,
                }),
                "crit",
              ),
              ...extraLogs,
            ],
          };
        });

        await delay(810);

        set((s) => {
          const outcomeCheck = checkMissionOutcome(s.grid, s.units);
          const autoNextUnit = findNextAvailablePlayerUnit(s.units, s.selectedUnitId);
          const autoNextId = autoNextUnit?.id ?? s.selectedUnitId;
          const nextDerived = deriveSelectionData(
            s.grid,
            s.units,
            autoNextId,
            s.weather,
            s.selectedTargetId,
            s.fogSnapshot.exploredCoords,
            s.blastZones,
            s.fogOfWarEnabled,
          );
          return {
            isBusy: outcomeCheck.outcome === "defeat",
            activeProjectile: null,
            selectedUnitId: autoNextId,
            activeFloor: autoNextUnit ? autoNextUnit.pos.y : s.activeFloor,
            actionMode: "move",
            outcome:
              outcomeCheck.outcome === "defeat"
                ? "ongoing"
                : outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            fogSnapshot: nextDerived.fogSnapshot,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            visibleMeleeTargets: nextDerived.visibleMeleeTargets,
            selectedTargetId: nextDerived.selectedTargetId,
          };
        });

        if (pendingDefeatReason) {
          await playCaptureFinalAnimationAndDefeat(
            pendingDefeatReason,
            get().round,
          );
        }
      })();
    },

    toggleDoor: (coord: GridCoord) => {
      if (get().inspectKeyHeld) {
        set({
          inspectOpen: true,
          inspectClickConsumed: true,
          inspectPin: { kind: "tile", coord: { ...coord } },
        });
        return;
      }
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing") {
        return;
      }
      const door = state.grid.getDoor(coord);
      if (!door) return;

      const actor = state.units.find((u) => u.id === state.selectedUnitId);
      const isAdjacent =
        actor &&
        actor.alive &&
        actor.pos.y === coord.y &&
        Math.abs(actor.pos.x - coord.x) <= 1 &&
        Math.abs(actor.pos.z - coord.z) <= 1;

      if (!isAdjacent) return;

      const nextState = state.grid.toggleDoor(coord);
      if (!nextState) return;

      const sel = deriveSelectionData(
        state.grid,
        state.units,
        state.selectedUnitId,
        state.weather,
        state.selectedTargetId,
        state.fogSnapshot.exploredCoords,
        state.blastZones,
        state.fogOfWarEnabled,
      );

      set((s) => ({
        gridVersion: s.gridVersion + 1,
        fogSnapshot: sel.fogSnapshot,
        reachableTiles: sel.reachableTiles,
        visibleTargets: sel.visibleTargets,
        selectedTargetId: sel.selectedTargetId,
        combatLog: [
          ...s.combatLog,
          makeLog(
            s.round,
            "player",
            phrase("log.door.toggle", {
              unitId: actor?.id,
              open: nextState === "open",
              doorId: door.id,
              x: coord.x,
              z: coord.z,
              y: coord.y,
            }),
            "info",
          ),
        ],
      }));
    },

    endTurn: () => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      void (async () => {
        // Pokud byl maršál Colloredo zadržen (1/2) a hráč jej během svého tahu nedokázal vyprostit,
        // posuneme počítadlo zadržení na 2/2 -> zajetí je dokonáno!
        const preTurnSync = syncColloredoCaptureState(get().units);
        const colloredoBeforeEnemy = preTurnSync.units.find(
          (u) => u.id === "player-colloredo" && u.alive,
        );
        if (colloredoBeforeEnemy && (colloredoBeforeEnemy.detainedTurns ?? 0) >= 1) {
          const advanced = advanceColloredoDetentionTurn(preTurnSync.units);
          set({
            units: syncColloredoMobility(advanced.units),
          });
          if (advanced.capturedNow) {
            await playCaptureFinalAnimationAndDefeat(
              advanced.captureReason ?? "zero_hp",
              get().round,
            );
            return;
          }
        }

        // Konec aktivace hráče: agónie skončí jen když byl tento tah vydán
        // (deathThroesTurns === 0). Čerstvý vstup (1) přežije do příští aktivace.
        const dyingHeroes = get().units.filter(
          (u) =>
            u.faction === "player" &&
            u.alive &&
            !!u.inDeathThroes &&
            (u.deathThroesTurns ?? 1) === 0,
        );
        for (const hero of dyingHeroes) {
          if (hero.id === "player-colloredo") {
            const tile = get().grid.getTile(hero.pos);
            if (!tile?.isEscapeZone) {
              set((s) => ({
                units: s.units.map((u) =>
                  u.id === hero.id ? { ...u, alive: false, inDeathThroes: false } : u,
                ),
                combatLog: [
                  ...s.combatLog,
                  makeLog(
                    s.round,
                    "player",
                    phrase("log.deathThroes.colloredoBoat"),
                    "alert",
                  ),
                ],
                outcome: "defeat",
                defeatReason: "zero_hp",
              }));
              await delay(600);
              return;
            }
          } else {
            // Společník vyčerpal svůj tah v Posledním vzepětí a padá mrtev
            set((s) => ({
              units: s.units.map((u) =>
                u.id === hero.id ? { ...u, alive: false, inDeathThroes: false } : u,
              ),
              combatLog: [
                ...s.combatLog,
                makeLog(
                  s.round,
                  "player",
                  phrase("log.deathThroes.hero", { heroId: hero.id }),
                  "alert",
                ),
              ],
            }));
            triggerUnitFx(hero.id, {
              banner: { phrase: phrase("banner.fallen"), tone: "crit" },
            });
            playHitSound(true, 3);
            await delay(350);
          }
        }

        const afterHeroLossOutcome = checkMissionOutcome(get().grid, get().units);
        if (afterHeroLossOutcome.outcome !== "ongoing") {
          set({
            outcome: afterHeroLossOutcome.outcome,
            victoryReason: afterHeroLossOutcome.victoryReason,
            defeatReason: afterHeroLossOutcome.defeatReason,
          });
          return;
        }

        set((s) => ({
          isBusy: true,
          turn: "enemy",
          actionMode: "move",
          reachableTiles: new Map(),
          hoveredPath: [],
          units: applyBlackPowderChoking(s.units, s.grid).map((u) => {
            if (u.faction !== "enemy" || !u.alive) return u;
            const fighting = isUnitFighting(u);
            return {
              ...u,
              ap: fighting ? u.maxAp : 0,
              movedThisTurn: false,
              isOverwatch: false,
              isShaken: false,
              deathThroesTurns:
                fighting && u.inDeathThroes ? 0 : u.deathThroesTurns,
            };
          }),
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "enemy",
              phrase("log.round.enemy", { count: s.round }),
              "alert",
            ),
          ],
        }));

        await delay(400);

        const expireEnemyDeathThroes = async (id: string): Promise<boolean> => {
          const finishedEnemy = get().units.find((u) => u.id === id);
          if (
            !finishedEnemy ||
            !finishedEnemy.alive ||
            !finishedEnemy.inDeathThroes ||
            (finishedEnemy.deathThroesTurns ?? 1) !== 0
          ) {
            return false;
          }

          set((s) => ({
            units: s.units.map((u) =>
              u.id === id
                ? {
                    ...u,
                    alive: false,
                    inDeathThroes: false,
                    ap: 0,
                    isOverwatch: false,
                  }
                : u,
            ),
            combatLog: [
              ...s.combatLog,
              makeLog(
                s.round,
                "enemy",
                phrase("log.deathThroes.enemy", { unitId: finishedEnemy.id }),
                "alert",
              ),
            ],
          }));
          triggerUnitFx(id, {
            banner: { phrase: phrase("banner.fallenThroes"), tone: "crit" },
          });
          playHitSound(true, 3);
          await delay(350);

          const outcomeAfterDeath = checkMissionOutcome(get().grid, get().units);
          if (outcomeAfterDeath.outcome !== "ongoing") {
            set({
              outcome: outcomeAfterDeath.outcome,
              victoryReason: outcomeAfterDeath.victoryReason,
              defeatReason: outcomeAfterDeath.defeatReason,
            });
            return true;
          }
          return false;
        };

        const enemyIds = get()
          .units.filter((u) => u.faction === "enemy" && u.alive)
          .map((u) => u.id);

        for (const enemyId of enemyIds) {
          if (get().outcome !== "ongoing") break;
          const enemy = get().units.find(
            (u) => u.id === enemyId && isUnitFighting(u),
          );
          if (!enemy) continue;

          set({ activeFloor: enemy.pos.y });

          const plan = computeEnemyAiDecision(
            get().grid,
            enemy,
            get().units,
            get().weather,
          );

          // Pokud stojí u zavřených dveří, otevře je (Free action 0 AP)
          if (plan.doorToOpen) {
            get().grid.setDoorState(plan.doorToOpen, "open");
            set((s) => ({
              gridVersion: s.gridVersion + 1,
              combatLog: [
                ...s.combatLog,
                makeLog(
                  s.round,
                  "enemy",
                  phrase("log.door.enemy", { unitId: enemy.id }),
                  "overwatch",
                ),
              ],
            }));
            await delay(180);
          }

          if (plan.movePath.length > 0) {
            await animateUnitAlongPath(enemy.id, plan.movePath);
            const dest = plan.movePath[plan.movePath.length - 1]!;
            const prev =
              plan.movePath.length >= 2
                ? plan.movePath[plan.movePath.length - 2]!
                : enemy.pos;
            const facing = facingFromDelta(prev, dest, enemy.facing);

            set((s) => {
              const movedUnits = s.units.map((u) =>
                u.id === enemy.id
                  ? {
                      ...u,
                      pos: dest,
                      facing,
                      movedThisTurn: true,
                      ap: Math.max(0, u.ap - plan.moveApCost),
                    }
                  : u,
              );
              const nextFog = computeFogOfWar(
                s.grid,
                movedUnits,
                s.weather,
                s.fogSnapshot.exploredCoords,
                extractDynamicLights(s.blastZones),
              );
              return {
                activeFloor: dest.y,
                units: movedUnits,
                fogSnapshot: nextFog,
              };
            });

            await performOverwatchReactionsIfAny(enemy.id, dest, plan.movePath);
            await delay(220);
          }

          const updatedEnemy = get().units.find(
            (u) => u.id === enemyId && u.alive,
          );
          if (!updatedEnemy || get().outcome !== "ongoing")
            continue;

          const colloredo = get().units.find(
            (u) => u.id === "player-colloredo" && u.alive,
          );

          // 1. ZAJETÍ HRABĚTE (1 AP):
          // Švédové po hraběti nestřílí, ale zajmou ho tak, že buď utratí 1 AP těsně vedle něj
          // nebo do tří políček u něj, pokud mají nabitou palnou zbraň.
          // V Posledním vzepětí (agónii) mají nepřátelé zajetí maršála přísně zakázáno (ADR-0012).
          if (colloredo && updatedEnemy.ap >= 1 && !updatedEnemy.inDeathThroes) {
            const capCheck = checkEnemyColloredoCapture(
              get().grid,
              updatedEnemy,
              colloredo,
            );
            if (capCheck.canCapture) {
              const captureFacing = facingFromDelta(
                updatedEnemy.pos,
                colloredo.pos,
                updatedEnemy.facing,
              );
              const logMsg = capCheck.isAdjacent
                ? phrase("log.capture.adjacent", { unitId: updatedEnemy.id })
                : phrase("log.capture.gunpoint", {
                    unitId: updatedEnemy.id,
                    distance: capCheck.distanceTiles,
                  });

              set((s) => ({
                units: s.units.map((u) =>
                  u.id === updatedEnemy.id
                    ? {
                        ...u,
                        ap: Math.max(0, u.ap - 1),
                        facing: captureFacing,
                      }
                    : u.id === colloredo.id
                      ? {
                          ...u,
                          ap: 0,
                          detainedTurns: 2,
                          captureReason: "surrounded_unprotected",
                        }
                      : u,
                ),
                combatLog: [
                  ...s.combatLog,
                  makeLog(s.round, "enemy", logMsg, "alert"),
                ],
              }));

              triggerUnitFx(updatedEnemy.id, {
                lunge: true,
                banner: {
                  phrase: capCheck.isGunpoint
                    ? phrase("banner.gunpoint")
                    : phrase("banner.captureAp"),
                  tone: "crit",
                },
              });
              triggerUnitFx(colloredo.id, {
                hit: true,
                banner: { phrase: phrase("banner.captured"), tone: "crit" },
              });

              playHitSound(true, 2);
              await delay(850);

              await playCaptureFinalAnimationAndDefeat(
                "surrounded_unprotected",
                get().round,
              );
              return;
            }
          }

          // Pokud voják dorazil k hraběti, ale vyčerpal všechna AP na přesun (sprint 2 AP):
          // Hrabě je v bezprostředním ohrožení (zadržen 1/2 kola) — hráč má 1 tah na reakci!
          // V Posledním vzepětí (agónii) mají nepřátelé zajetí maršála přísně zakázáno (ADR-0012).
          if (colloredo && updatedEnemy.ap === 0 && !updatedEnemy.inDeathThroes) {
            const capCheck = checkEnemyColloredoCapture(
              get().grid,
              updatedEnemy,
              colloredo,
            );
            if (capCheck.canCapture) {
              const warningMsg = capCheck.isAdjacent
                ? phrase("log.capture.threatAdjacent", { unitId: updatedEnemy.id })
                : phrase("log.capture.threatGunpoint", {
                    unitId: updatedEnemy.id,
                    distance: capCheck.distanceTiles,
                  });

              set((s) => ({
                units: s.units.map((u) =>
                  u.id === colloredo.id
                    ? {
                        ...u,
                        detainedTurns: 1,
                        captureReason: "surrounded_unprotected",
                      }
                    : u,
                ),
                combatLog: [
                  ...s.combatLog,
                  makeLog(s.round, "enemy", warningMsg, "alert"),
                ],
              }));

              triggerUnitFx(colloredo.id, {
                hit: true,
                banner: { phrase: phrase("banner.threat"), tone: "crit" },
              });
            }
          }

          if (updatedEnemy.ap <= 0) {
            if (await expireEnemyDeathThroes(enemyId)) return;
            continue;
          }

          // Pokud má nepřítel vybitou mušketu:
          if (updatedEnemy.firearmLoaded === false) {
            // V Posledním vzepětí nepřítel neztrácí čas nabíjením, ale přednostně udeří pažbou zblízka (ADR-0012)
            if (updatedEnemy.inDeathThroes) {
              const adjMelee = evaluateAdjacentMeleeTargets(
                get().grid,
                updatedEnemy,
                get().units,
              );
              const validMelee = adjMelee.find(
                (t) => t.targetId !== "player-colloredo",
              );
              if (validMelee && updatedEnemy.ap >= 1) {
                const targetUnit = get().units.find(
                  (u) => u.id === validMelee.targetId && u.alive,
                );
                if (targetUnit) {
                  const strikeFacing = facingFromDelta(
                    updatedEnemy.pos,
                    targetUnit.pos,
                    updatedEnemy.facing,
                  );
                  const outcome = rollMeleeAttack(
                    updatedEnemy,
                    targetUnit,
                    validMelee.calculation,
                  );
                  const beforeTargetStrike = targetUnit;
                  let afterTargetStrike: UnitData = targetUnit;

                  set((s) => {
                    const nextUnits = s.units.map((u) => {
                      if (u.id === updatedEnemy.id) {
                        return {
                          ...u,
                          facing: strikeFacing,
                          ap: Math.max(0, u.ap - 1),
                        };
                      }
                      if (u.id === targetUnit.id) {
                        const nextArmor = Math.max(
                          0,
                          u.armor - outcome.armorShredded,
                        );
                        const nextHp = u.hp - outcome.damage;
                        const instantKilled = isInstantOverkill(nextHp, u.maxHp);
                        const inThroes = !instantKilled && nextHp <= 0;
                        const shakenNow =
                          u.isShaken ||
                          (outcome.hit && (outcome.critical || outcome.damage >= 3));
                        return {
                          ...u,
                          armor: nextArmor,
                          hp: nextHp,
                          isShaken: nextHp > 0 ? shakenNow : false,
                          alive: !instantKilled,
                          inDeathThroes: inThroes,
                          deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
                          isOverwatch: nextHp > 0 ? u.isOverwatch : false,
                        };
                      }
                      return u;
                    });
                    const captureSync = syncColloredoCaptureState(nextUnits);
                    const syncedUnits = syncColloredoMobility(captureSync.units);
                    afterTargetStrike =
                      syncedUnits.find((u) => u.id === targetUnit.id) ?? targetUnit;

                    const msg = phrase("log.enemy.throesMelee", {
                      attackerId: updatedEnemy.id,
                      targetId: targetUnit.id,
                      hit: outcome.hit,
                      damage: outcome.damage,
                    });

                    return {
                      units: syncedUnits,
                      combatLog: [
                        ...s.combatLog,
                        makeLog(s.round, "enemy", msg, outcome.hit ? "hit" : "miss"),
                      ],
                    };
                  });

                  triggerUnitFx(updatedEnemy.id, { lunge: true });
                  await delay(320);
                  if (outcome.hit) {
                    playHitSound(outcome.critical, 2);
                  }
                  triggerUnitFx(targetUnit.id, {
                    hit: outcome.hit,
                    loss: buildUnitCombatLoss(
                      beforeTargetStrike,
                      afterTargetStrike,
                      {
                        attackerId: updatedEnemy.id,
                        weaponId: "swedish_musket_butt",
                        hit: outcome.hit,
                        critical: outcome.critical,
                        misfired: false,
                        hitChance: validMelee.calculation.hitChance,
                      },
                    ),
                  });
                  await delay(450);
                  if (await expireEnemyDeathThroes(enemyId)) return;
                  continue;
                }
              }
              // Pokud nemá nikoho na dosah pažby, nenabíjí a pokračuje
              if (await expireEnemyDeathThroes(enemyId)) return;
              continue;
            }

            const reqReloadAp = updatedEnemy.weapon.reloadApCost ?? 2;
            const curReload = updatedEnemy.reloadProgress ?? 0;
            const stepsSpent = Math.min(
              updatedEnemy.ap,
              Math.max(1, reqReloadAp - curReload),
            );
            const nextReload = Math.min(reqReloadAp, curReload + stepsSpent);
            const isNowLoaded = nextReload >= reqReloadAp;

            set((s) => ({
              units: s.units.map((u) =>
                u.id === updatedEnemy.id
                  ? {
                      ...u,
                      ap: Math.max(0, u.ap - stepsSpent),
                      reloadProgress: isNowLoaded ? 0 : nextReload,
                      firearmLoaded: isNowLoaded,
                    }
                  : u,
              ),
              combatLog: [
                ...s.combatLog,
                makeLog(
                  s.round,
                  "enemy",
                  phrase("log.enemy.reload", {
                    unitId: updatedEnemy.id,
                    loaded: isNowLoaded,
                    progress: nextReload,
                    required: reqReloadAp,
                  }),
                  "info",
                ),
              ],
            }));
            triggerUnitFx(updatedEnemy.id, {
              banner: {
                phrase: isNowLoaded
                  ? phrase("banner.loaded", { required: reqReloadAp })
                  : phrase("banner.reloading", {
                      progress: nextReload,
                      required: reqReloadAp,
                    }),
                tone: "buff",
              },
            });
            await delay(240);
            continue;
          }

          const targets = evaluateVisibleTargets(
            get().grid,
            updatedEnemy,
            get().units,
            get().weather,
          );
          const chosenTargetEval =
            targets.find((t) => t.targetId === plan.targetId) ?? targets[0];

          if (chosenTargetEval) {
            const targetUnit = get().units.find(
              (u) => u.id === chosenTargetEval.targetId && u.alive,
            );
            if (
              targetUnit &&
              targetUnit.id !== "player-colloredo" &&
              !isCompanionProtectedByCount(
                get().grid,
                updatedEnemy.pos,
                targetUnit,
                get().units,
              )
            ) {
              const outcome = rollRangedAttack(
                updatedEnemy,
                targetUnit,
                chosenTargetEval.calculation,
              );
              const shotFacing = facingFromDelta(
                updatedEnemy.pos,
                targetUnit.pos,
                updatedEnemy.facing,
              );

              if (!outcome.misfired) {
                get().grid.addSmoke(updatedEnemy.pos, 0, 2);
              }

              if (outcome.misfired) {
                playMisfireSound();
              } else {
                playGunshotSound(updatedEnemy.weapon.lockType === "wheellock");
              }

              const enemyFireAp = updatedEnemy.weapon.fireApCost ?? 1;

              const impactMeta = resolveShotImpactMetadata(
                get().grid,
                updatedEnemy.pos,
                targetUnit.pos,
                outcome,
              );
              const nowTs = performance.now();
              set((s) => ({
                activeFloor: targetUnit.pos.y,
                smokeVersion: s.smokeVersion + 1,
                combatIntensity: s.combatIntensity + 1,
                blastZones: [
                  ...s.blastZones.slice(-18),
                  {
                    id: fxSeq++,
                    coord: updatedEnemy.pos,
                    createdAt: nowTs,
                    baseRadius: 1.5,
                    maxRadius: 4.0,
                    isExplosion: false,
                  },
                  ...(outcome.misfired
                    ? []
                    : [
                        {
                          id: fxSeq++,
                          coord: outcome.hit
                            ? targetUnit.pos
                            : impactMeta.missImpactCoord,
                          createdAt: nowTs,
                          baseRadius: 1.2,
                          maxRadius: 3.4,
                          isExplosion: false,
                        },
                      ]),
                ],
                units: s.units.map((u) =>
                  u.id === updatedEnemy.id
                    ? {
                        ...u,
                        facing: shotFacing,
                        ap: Math.max(0, u.ap - enemyFireAp),
                        firearmLoaded: false,
                        reloadProgress: 0,
                      }
                    : u,
                ),
                activeProjectile: {
                  id: fxSeq++,
                  from: updatedEnemy.pos,
                  to: targetUnit.pos,
                  targetId: targetUnit.id,
                  hitChance: outcome.hitChance,
                  kind: "bullet",
                  createdAt: nowTs,
                  durationMs: 1780,
                  hit: outcome.hit,
                  critical: outcome.critical,
                  misfired: outcome.misfired,
                  damage: outcome.damage,
                  bloodSeverity: impactMeta.bloodSeverity,
                  armorShredded: outcome.armorShredded,
                  armorAbsorbed: outcome.armorAbsorbed,
                  killed: outcome.killed,
                  impactObstacle: impactMeta.impactObstacle,
                  missImpactCoord: impactMeta.missImpactCoord,
                },
                lightFlashes: addLightFlash(
                  s.lightFlashes,
                  muzzleFlashDraft(updatedEnemy.pos, shotFacing, outcome.misfired),
                ),
              }));

              triggerUnitFx(updatedEnemy.id, {
                lunge: true,
                banner: outcome.misfired
                  ? { phrase: phrase("banner.misfire"), tone: "misfire" }
                  : undefined,
              });
              await delay(730);
              if (!outcome.misfired) {
                if (outcome.hit) {
                  playHitSound(outcome.critical, impactMeta.bloodSeverity);
                } else {
                  playRicochetSound(
                    impactMeta.impactObstacle === "palace_wood",
                  );
                }
              }

              let newlyDetainedByEnemyShot = false;
              let immediateDefeatReason: CaptureReason | null = null;
              const beforeEnemyShotTarget =
                get().units.find((u) => u.id === targetUnit.id) ?? targetUnit;
              let afterEnemyShotTarget: UnitData = beforeEnemyShotTarget;

              set((s) => {
                if (!outcome.misfired) {
                  s.grid.damageTile(
                    outcome.hit ? targetUnit.pos : impactMeta.missImpactCoord,
                    1,
                  );
                }
                const nextUnits = s.units.map((u) => {
                  if (u.id !== targetUnit.id) return u;
                  const nextArmor = Math.max(
                    0,
                    u.armor - outcome.armorShredded,
                  );
                  const nextHp = u.hp - outcome.damage;
                  const instantKilled = isInstantOverkill(nextHp, u.maxHp);
                  const inThroes = !instantKilled && nextHp <= 0;
                  const shakenNow =
                    u.isShaken ||
                    (outcome.hit && (outcome.critical || outcome.damage >= 4));
                  return {
                    ...u,
                    armor: nextArmor,
                    hp: nextHp,
                    isShaken: nextHp > 0 ? shakenNow : false,
                    alive: !instantKilled,
                    inDeathThroes: inThroes,
                    deathThroesTurns: deathThroesTurnsAfterHit(u, inThroes),
                    isOverwatch: nextHp > 0 ? u.isOverwatch : false,
                  };
                });

                const captureSync = syncColloredoCaptureState(nextUnits);
                newlyDetainedByEnemyShot = captureSync.newlyDetained;
                const syncedUnits = syncColloredoMobility(captureSync.units);
                afterEnemyShotTarget =
                  syncedUnits.find((u) => u.id === targetUnit.id) ??
                  beforeEnemyShotTarget;

                const msg = phrase("log.enemy.shot", {
                  attackerId: updatedEnemy.id,
                  targetId: targetUnit.id,
                  misfired: outcome.misfired,
                  hit: outcome.hit,
                  chance: outcome.hitChance,
                  damage: outcome.damage,
                  shred: outcome.armorShredded,
                  critical: outcome.critical,
                });

                const outcomeCheck = checkMissionOutcome(s.grid, syncedUnits);
                if (outcomeCheck.outcome === "defeat") {
                  immediateDefeatReason =
                    outcomeCheck.defeatReason ?? "all_companions_fallen";
                }

                const extraLogs: CombatLogEntry[] = [];
                if (captureSync.newlyDetained && !immediateDefeatReason) {
                  extraLogs.push(
                    makeLog(
                      s.round,
                      "enemy",
                      phrase("log.detained.enemyShot"),
                      "alert",
                    ),
                  );
                }

                const nextFog = computeFogOfWar(
                  s.grid,
                  syncedUnits,
                  s.weather,
                  s.fogSnapshot.exploredCoords,
                  extractDynamicLights(s.blastZones),
                );

                return {
                  gridVersion: s.gridVersion + (outcome.misfired ? 0 : 1),
                  units: syncedUnits,
                  fogSnapshot: nextFog,
                  combatLog: [
                    ...s.combatLog,
                    makeLog(
                      s.round,
                      "enemy",
                      msg,
                      outcome.misfired
                        ? "misfire"
                        : outcome.hit
                          ? outcome.critical
                            ? "crit"
                            : "hit"
                          : "miss",
                    ),
                    ...extraLogs,
                  ],
                };
              });

              if (!outcome.misfired) {
                const enemyShotLoss = buildUnitCombatLoss(
                  beforeEnemyShotTarget,
                  afterEnemyShotTarget,
                  {
                    attackerId: updatedEnemy.id,
                    weaponId: updatedEnemy.weapon.id,
                    hit: outcome.hit,
                    critical: outcome.critical,
                    misfired: outcome.misfired,
                    hitChance: outcome.hitChance,
                    armorAbsorbed: outcome.armorAbsorbed,
                    durationMs: 1450,
                  },
                );
                triggerUnitFx(targetUnit.id, {
                  hit: outcome.hit,
                  loss: enemyShotLoss,
                  banner: newlyDetainedByEnemyShot
                    ? { phrase: phrase("banner.detainedHalf"), tone: "crit" }
                    : outcome.hit
                       ? {
                           phrase: outcome.critical
                             ? phrase("banner.critShortBang", {
                                 damage: outcome.damage,
                               })
                             : phrase("banner.damage", { damage: outcome.damage }),
                           tone: outcome.critical ? "crit" : "hit",
                         }
                       : { phrase: phrase("banner.miss"), tone: "miss" },
                });
              }

              await delay(1050);
              set({ activeProjectile: null });

              if (immediateDefeatReason) {
                await playCaptureFinalAnimationAndDefeat(
                  immediateDefeatReason,
                  get().round,
                );
                return;
              }

              // Pokud střelci se švédskou odlehčenou mušketou (1 AP výstřel) zbyl 1 AP, zahájí 1. krok nabíjení (1/2)
              const afterShotEnemy = get().units.find(
                (u) => u.id === updatedEnemy.id && u.alive && u.ap >= 1,
              );
              if (afterShotEnemy && afterShotEnemy.firearmLoaded === false) {
                const reqAp = afterShotEnemy.weapon.reloadApCost ?? 2;
                set((s) => ({
                  units: s.units.map((u) =>
                    u.id === afterShotEnemy.id
                      ? {
                          ...u,
                          ap: 0,
                          reloadProgress: 1,
                          firearmLoaded: 1 >= reqAp,
                        }
                      : u,
                  ),
                }));
              }
            }
          } else {
            set((s) => ({
              units: s.units.map((u) =>
                u.id === updatedEnemy.id
                  ? { ...u, ap: 0, isOverwatch: true }
                  : u,
              ),
              combatLog: [
                ...s.combatLog,
                makeLog(
                  s.round,
                  "enemy",
                  phrase("log.enemy.overwatch", {
                    unitId: updatedEnemy.id,
                    facing: updatedEnemy.facing,
                  }),
                  "overwatch",
                ),
              ],
            }));
            triggerUnitFx(updatedEnemy.id, {
              banner: { phrase: phrase("banner.preparedVolley"), tone: "overwatch" },
            });
            await delay(240);
          }

          if (await expireEnemyDeathThroes(enemyId)) return;
        }

        if (get().outcome !== "ongoing") {
          set({ isBusy: false });
          return;
        }

        // Rozptýlení starého kouře na přelomu kola a zahájení tahu hráče (ADR-0011)
        get().grid.decaySmoke(get().weather);

        set((s) => {
          const nextRound = s.round + 1;
          let spawnedReinforcements = false;
          let incomingUnits: UnitData[] = [];
          const extraRoundLogs: CombatLogEntry[] = [];

          if (nextRound === 3) {
            extraRoundLogs.push(
              makeLog(3, "enemy", phrase("log.warn.reinforcement.3"), "alert"),
            );
          } else if (nextRound === 4) {
            extraRoundLogs.push(
              makeLog(4, "enemy", phrase("log.warn.reinforcement.4"), "alert"),
            );
          } else if (nextRound >= s.reinforcementRound && !s.reinforcementsSpawned) {
            spawnedReinforcements = true;
            const newUnits = createReinforcementUnits();
            incomingUnits = newUnits.map((nu) => {
              const freePos = findFreeSpawnCoord(s.grid, s.units, nu.pos);
              return { ...nu, pos: freePos };
            });
            extraRoundLogs.push(
              makeLog(
                nextRound,
                "enemy",
                phrase("log.reinforcement.arrive"),
                "alert",
              ),
            );
          }

          const combinedUnits = [...s.units, ...incomingUnits];
          const unitsWithChoking = applyBlackPowderChoking(combinedUnits, s.grid);
          const refreshedUnits = syncColloredoMobility(
            unitsWithChoking.map((u) => {
              if (u.faction !== "player" || !u.alive) return u;
              const detained = (u.detainedTurns ?? 0) > 0;
              const fighting = isUnitFighting(u);
              return {
                ...u,
                ap: fighting && !detained ? u.maxAp : 0,
                movedThisTurn: false,
                isOverwatch: false,
                isShaken: false,
                abilityBuffActive: false,
                deathThroesTurns:
                  fighting && u.inDeathThroes ? 0 : u.deathThroesTurns,
                ability: u.ability
                  ? {
                      ...u.ability,
                      currentCooldown: Math.max(0, u.ability.currentCooldown - 1),
                    }
                  : undefined,
              };
            }),
          );
          const currentSelected = refreshedUnits.find(
            (u) =>
              u.id === s.selectedUnitId &&
              u.faction === "player" &&
              isUnitFighting(u) &&
              u.ap > 0 &&
              (u.detainedTurns ?? 0) === 0,
          );
          const nextSelectedId =
            currentSelected?.id ??
            refreshedUnits.find(
              (u) =>
                u.faction === "player" &&
                isUnitFighting(u) &&
                u.ap > 0 &&
                (u.detainedTurns ?? 0) === 0,
            )?.id ??
            refreshedUnits.find(
              (u) => u.faction === "player" && isUnitFighting(u),
            )?.id ??
            null;
          const nextSelectedUnit = refreshedUnits.find(
            (u) => u.id === nextSelectedId,
          );
          const nextDerived = deriveSelectionData(
            s.grid,
            refreshedUnits,
            nextSelectedId,
            s.weather,
            s.selectedTargetId,
            s.fogSnapshot.exploredCoords,
            s.blastZones,
            s.fogOfWarEnabled,
          );

          let finalSelectedId = nextSelectedId;
          let finalFloor = nextSelectedUnit ? nextSelectedUnit.pos.y : 0;
          let nextGuidedStep = s.guidedTutorial.currentStep;

          if (s.guidedTutorial.enabled && !s.guidedTutorial.dismissed) {
            if (
              s.guidedTutorial.currentStep === "step_5_enemy_turn_react" ||
              s.guidedTutorial.currentStep === "step_4_vaclav_shoot"
            ) {
              nextGuidedStep = "step_6_vaclav_reload";
              finalSelectedId = "player-vaclav-michalovic";
              finalFloor = 1;
            }
          }

          return {
            round: nextRound,
            reinforcementsSpawned: s.reinforcementsSpawned || spawnedReinforcements,
            turn: "player",
            smokeVersion: s.smokeVersion + 1,
            isBusy: false,
            units: refreshedUnits,
            selectedUnitId: finalSelectedId,
            activeFloor: finalFloor,
            actionMode: "move",
            guidedTutorial: {
              ...s.guidedTutorial,
              currentStep: nextGuidedStep,
            },
            fogSnapshot: nextDerived.fogSnapshot,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            selectedTargetId: nextDerived.selectedTargetId,
            combatLog: [
              ...s.combatLog,
              makeLog(
                nextRound,
                "player",
                phrase("log.round.player", { count: nextRound }),
                "info",
              ),
              ...extraRoundLogs,
            ],
          };
        });
      })();
    },

    resetGame: () => {
      const nextGrid = createInitialGrid();
      const nextUnits = syncColloredoMobility(createInitialUnits());
      const firstId =
        nextUnits.find((u) => u.id === "player-jan-matej")?.id ??
        nextUnits.find((u) => u.faction === "player")?.id ??
        null;
      const currentWeather = "rain"; // Výchozí autentický noční déšť
      const currentFogEnabled = get().fogOfWarEnabled;
      const nextDerived = deriveSelectionData(
        nextGrid,
        nextUnits,
        firstId,
        currentWeather,
        null,
        undefined,
        [],
        currentFogEnabled,
      );
      moveResolveCallback = null;
      resetLiveMovementTelemetry();

      set((s) => ({
        grid: nextGrid,
        units: nextUnits,
        round: 1,
        turn: "player",
        reinforcementsSpawned: false,
        reinforcementRound: 5,
        weather: currentWeather,
        gridVersion: s.gridVersion + 1,
        smokeVersion: s.smokeVersion + 1,
        combatIntensity: 0,
        blastZones: [],
        outcome: "ongoing",
        victoryReason: null,
        defeatReason: null,
        isCapturingAnim: false,
        sacrificeDilemmaOpen: false,
        sacrificedHeroId: null,
        ironVigilPerk: null,
        demonstratedAbilities: {},
        tutorialStep: 1,
        tutorialDismissed: false,
        guidedTutorial: {
          enabled: true,
          currentStep: "step_1_matej_move",
          dismissed: false,
          rejectFeedback: null,
          rejectTimestamp: 0,
        },
        selectedUnitId: firstId,
        activeFloor: 1,
        actionMode: "move",
        inspectOpen: false,
        inspectKeyHeld: false,
        inspectClickConsumed: false,
        inspectPin: null,
        fogSnapshot: nextDerived.fogSnapshot,
        reachableTiles: nextDerived.reachableTiles,
        hoveredTile: null,
        hoveredPath: [],
        visibleTargets: nextDerived.visibleTargets,
        selectedTargetId: nextDerived.selectedTargetId,
        isBusy: false,
        cameraDirector: createInitialCameraDirectorState(),
        revealedPodEnemyIds: new Set(nextDerived.fogSnapshot.visibleEnemyIds),
        activeMovement: null,
        activeProjectile: null,
        lightFlashes: [],
        unitFx: {},
        combatLog: [
          makeLog(1, "player", phrase("log.briefing.gate"), "alert"),
          makeLog(1, "player", phrase("log.briefing.escape"), "story"),
        ],
      }));
    },
  };
});

subscribeLocale(() => {
  relabelCatalogs();
  useGameStore.setState((state) => {
    state.grid.applyLocaleLabels();
    const units = state.units.map((unit) => projectUnit(unit));
    const derived = deriveSelectionData(
      state.grid,
      units,
      state.selectedUnitId,
      state.weather,
      state.selectedTargetId,
      state.fogSnapshot.exploredCoords,
      state.blastZones,
      state.fogOfWarEnabled,
    );
    return {
      units: derived.units,
      reachableTiles: derived.reachableTiles,
      visibleTargets: derived.visibleTargets,
      visibleMeleeTargets: derived.visibleMeleeTargets,
      selectedTargetId: derived.selectedTargetId,
      fogSnapshot: derived.fogSnapshot,
      gridVersion: state.gridVersion + 1,
    };
  });
});
