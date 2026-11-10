/**
 * Stavový automat filmové kamery ve stylu XCOM 2 (/src/core/CameraDirector.ts).
 * Čistý TypeScript modul (bez závislostí na Three.js a Reactu) řídící přechody mezi:
 * 1. TACTICAL_ISO: Ptačí izometrický pohled (sledování 1 AP pohybu + dynamické zprůhlednění střech uvnitř budov)
 * 2. ACTION_OTS_FOLLOW: Nízký Over-the-Shoulder průlet za ramenem hrdiny (2 AP sprint, vyražení dveří, přeskok krytu, schodiště)
 * 3. INTERRUPT_POD_REVEAL: Zastavení pohybu, přelet a zoom na nově odhalenou hlídku mušketýrů/pikenýrů a jejich Scramble do krytu
 * 4. INTERRUPT_OVERWATCH_SLOWMO: Zpomalení času (timeScale), záběr na střelce v oblaku prachu a blízké sledování běžícího vojáka
 * 5. COVER_SETTLE_RESET: Animace zakleknutí do krytu v cíli a plynulý návrat do izometrického pohledu
 * 6. AIM_OTS & PROJECTILE_TRACK: Střelecká kamera přes rameno a sledování letící střely
 */

import {
  bestTileCover,
  CARDINAL_OFFSETS,
  coordKey,
  GridSystem,
  isEnclosedRoofedCoord,
  sameCoord,
} from "./GridSystem";
import type {
  CardinalDir,
  CoverLevel,
  FloorLevel,
  GridCoord,
  MovementZoneType,
  UnitData,
} from "./types";

export type CameraStateId =
  | "TACTICAL_ISO"
  | "ACTION_OTS_FOLLOW"
  | "INTERRUPT_POD_REVEAL"
  | "INTERRUPT_OVERWATCH_SLOWMO"
  | "COVER_SETTLE_RESET"
  | "AIM_OTS"
  | "PROJECTILE_TRACK";

export type StepInteractionKind = "none" | "vault" | "door_breach" | "stairs";

export interface PodRevealInterruptPayload {
  /** Jednotka hráče, která hlídku odhalila */
  spotterUnitId: string;
  /** Dlaždice, ze které k odhalení došlo */
  spotterCoord: GridCoord;
  /** ID nově odhalených nepřátel v této skupině (podu) */
  revealedEnemyIds: string[];
  /** Středová souřadnice odhalené skupiny pro přelet kamery (Pan & Zoom) */
  focusCoord: GridCoord;
  /** Čas spuštění přerušení (performance.now()) */
  startedAt: number;
  /** Délka trvání sekvence v ms */
  durationMs: number;
}

export interface OverwatchSlowMoInterruptPayload {
  /** Hlídkující střelec (Overwatch watcher) */
  watcherUnitId: string;
  watcherCoord: GridCoord;
  /** Běžící voják zachycený v pohybu */
  targetUnitId: string;
  ambushCoord: GridCoord;
  /** Aktuální podfáze přepadu: záběr na střelce v dýmu vs. detail běžícího vojáka */
  subPhase: "SHOOTER_FOCUS" | "RUNNER_TRACK";
  startedAt: number;
  durationMs: number;
}

export interface CoverSettlePayload {
  unitId: string;
  coord: GridCoord;
  coverLevel: CoverLevel;
  coverDir: CardinalDir | null;
  startedAt: number;
  durationMs: number;
}

export interface CameraDirectorState {
  mode: CameraStateId;
  /** Globální měřítko plynutí času pro animace (1.0 = normální, 0.25 = Overwatch Slow-Mo) */
  timeScale: number;
  podReveal: PodRevealInterruptPayload | null;
  overwatchSlowMo: OverwatchSlowMoInterruptPayload | null;
  coverSettle: CoverSettlePayload | null;
}

export function createInitialCameraDirectorState(): CameraDirectorState {
  return {
    mode: "TACTICAL_ISO",
    timeScale: 1.0,
    podReveal: null,
    overwatchSlowMo: null,
    coverSettle: null,
  };
}

/**
 * Sdílená telemetrie běžící postavy aktualizovaná v reálném čase (60-144 Hz) z UnitActor.useFrame
 * a čtená v TacticalCamera.useFrame bez alokací React stavu.
 */
export interface LiveMovementTelemetry {
  unitId: string | null;
  continuousCoord: { x: number; y: number; z: number };
  worldPos: [number, number, number];
  tangentXZ: [number, number];
  progress01: number;
  segmentIndex: number;
  segmentFraction: number;
  stepInteraction: StepInteractionKind;
  interactionImpulseTs: number;
}

export const liveMovementTelemetry: LiveMovementTelemetry = {
  unitId: null,
  continuousCoord: { x: 0, y: 0, z: 0 },
  worldPos: [0, 0, 0],
  tangentXZ: [0, -1],
  progress01: 0,
  segmentIndex: 0,
  segmentFraction: 0,
  stepInteraction: "none",
  interactionImpulseTs: 0,
};

export function resetLiveMovementTelemetry(): void {
  liveMovementTelemetry.unitId = null;
  liveMovementTelemetry.progress01 = 0;
  liveMovementTelemetry.segmentIndex = 0;
  liveMovementTelemetry.segmentFraction = 0;
  liveMovementTelemetry.stepInteraction = "none";
}

/**
 * Zjistí, zda trasa obsahuje environmentální interakce (vyražení zavřených dveří,
 * přeskok nízkého krytu při vyběhnutí nebo přechod po schodišti).
 */
export function detectPathInteractions(
  grid: GridSystem,
  from: GridCoord,
  path: GridCoord[],
): {
  hasDoorBreach: boolean;
  doorCoords: GridCoord[];
  hasVault: boolean;
  hasStairs: boolean;
  firstInteraction: StepInteractionKind;
} {
  const doorCoords: GridCoord[] = [];
  let hasStairs = false;
  let hasVault = false;

  const fullCoords = [from, ...path];
  for (let i = 1; i < fullCoords.length; i++) {
    const prev = fullCoords[i - 1]!;
    const curr = fullCoords[i]!;

    if (curr.y !== prev.y) {
      hasStairs = true;
    }

    if (grid.isDoorClosedAt(curr)) {
      doorCoords.push(curr);
    }

    // Přeskok nízkého krytu (Vault): pokud jednotka vybíhá z dlaždice, která má ve směru kroku poloviční kryt (low_wall / parapet)
    if (i === 1 && curr.y === prev.y) {
      const dx = curr.x - prev.x;
      const dz = curr.z - prev.z;
      const stepDir: CardinalDir | null =
         dz < 0 ? "N" : dz > 0 ? "S" : dx > 0 ? "E" : dx < 0 ? "W" : null;
      const startTile = grid.getTile(prev);
      if (stepDir && startTile && startTile.cover[stepDir] === "half") {
        hasVault = true;
      }
    }
  }

  const hasDoorBreach = doorCoords.length > 0;
  const firstInteraction: StepInteractionKind = hasDoorBreach
    ? "door_breach"
    : hasVault
      ? "vault"
      : hasStairs
        ? "stairs"
        : "none";

  return {
    hasDoorBreach,
    doorCoords,
    hasVault,
    hasStairs,
    firstInteraction,
  };
}

/**
 * Rozhodne, zda se má při pohybu aktivovat nízká filmová kamera za ramenem (ACTION_OTS_FOLLOW)
 * místo ptačí izometrické kamery (TACTICAL_ISO).
 *
 * Pravidla (XCOM 2):
 * 1. Musí být zapnutá volba `actionCamEnabled`.
 * 2. Musí jít o jednotku hráče (`faction === 'player'`).
 * 3. Jde o 2 AP sprint (`apCost >= 2` nebo `zone === 'yellow'` nebo délka trasy > `movePerAp`),
 *    NEBO trasa zahrnuje interakci s prostředím (vyražení dveří, přeskok nízkého krytu, schodiště).
 */
export function shouldTriggerActionCamForMove(opts: {
  actionCamEnabled: boolean;
  unit: UnitData;
  path: GridCoord[];
  apCost: 1 | 2;
  zone: MovementZoneType;
  interactions: {
    hasDoorBreach: boolean;
    hasVault: boolean;
    hasStairs: boolean;
  };
}): boolean {
  if (!opts.actionCamEnabled) return false;
  if (opts.unit.faction !== "player") return false;
  if (opts.path.length === 0) return false;

  const isSprint2Ap =
    opts.apCost >= 2 ||
    opts.zone === "yellow" ||
    opts.path.length > opts.unit.movePerAp;

  const hasEnvInteraction =
    opts.interactions.hasDoorBreach ||
    opts.interactions.hasVault ||
    opts.interactions.hasStairs;

  return isSprint2Ap || hasEnvInteraction;
}

/**
 * Vyhodnotí, zda má kamera automaticky zprůhlednit střechu / vyšší patra (Floor Cutaway),
 * protože sledovaná jednotka se nachází uvnitř kryté dobové budovy (palác, loubí, šance).
 */
export function resolveDynamicRoofCutawayFloor(
  coord: GridCoord,
  currentActiveFloor: FloorLevel,
): FloorLevel {
  if (isEnclosedRoofedCoord(coord.x, coord.y, coord.z)) {
    return coord.y;
  }
  if (coord.y !== currentActiveFloor) {
    return coord.y;
  }
  return currentActiveFloor;
}

/**
 * Určí hlavní směr krytu na cílové dlaždici pro animaci zakleknutí (Cover Settle).
 */
export function resolvePrimaryCoverDirection(
  grid: GridSystem,
  coord: GridCoord,
): { level: CoverLevel; dir: CardinalDir | null } {
  const tile = grid.getTile(coord);
  if (!tile) return { level: "none", dir: null };

  const best = bestTileCover(tile.cover);
  if (best === "none") return { level: "none", dir: null };

  for (const dir of ["N", "E", "S", "W"] as CardinalDir[]) {
    if (tile.cover[dir] === best) {
      return { level: best, dir };
    }
  }
  return { level: best, dir: "N" };
}

/**
 * Vypočítá cílovou dlaždici pro "Scramble" animaci nově odhaleného nepřítele (Pod Reveal):
 * hledá volnou pochozí dlaždici ve vzdálenosti 1–2 kroků, která poskytuje kryt (half/full)
 * směrem k hráči, který hlídku odhalil.
 */
export function computeScrambleDestination(
  grid: GridSystem,
  enemy: UnitData,
  allUnits: UnitData[],
  spotterPos: GridCoord,
): GridCoord | null {
  const currentTile = grid.getTile(enemy.pos);
  // Pokud už nepřítel stojí v plném krytu, stačí mu krátký přesun o 1 pole do bočního krytu, nebo zůstane na místě
  const candidates: { coord: GridCoord; score: number }[] = [];

  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const manhattan = Math.abs(dx) + Math.abs(dz);
      if (manhattan === 0 || manhattan > 2) continue;

      const cand: GridCoord = {
        x: enemy.pos.x + dx,
        y: enemy.pos.y,
        z: enemy.pos.z + dz,
      };
      const tile = grid.getTile(cand);
      if (!tile || !tile.hasFloor || !tile.walkable) continue;
      if (grid.isBlockedByUnit(cand, allUnits, enemy.id)) continue;

      // Pokud je kandidát o 2 pole daleko, musí existovat průchozí mezikrok
      if (manhattan === 2) {
        const mid1: GridCoord = {
          x: enemy.pos.x + Math.sign(dx),
          y: enemy.pos.y,
          z: enemy.pos.z,
        };
        const mid2: GridCoord = {
          x: enemy.pos.x,
          y: enemy.pos.y,
          z: enemy.pos.z + Math.sign(dz),
        };
        const t1 = dx !== 0 ? grid.getTile(mid1) : undefined;
        const t2 = dz !== 0 ? grid.getTile(mid2) : undefined;
        const canStep =
          (t1 && t1.walkable && !grid.isBlockedByUnit(mid1, allUnits, enemy.id)) ||
          (t2 && t2.walkable && !grid.isBlockedByUnit(mid2, allUnits, enemy.id));
        if (!canStep) continue;
      }

      const bestCov = bestTileCover(tile.cover);
      let score =
        bestCov === "full" ? 40 : bestCov === "half" ? 25 : 0;

      // Bonus, pokud kryt směřuje přímo ke spotterovi
      const toSpotterX = spotterPos.x - cand.x;
      const toSpotterZ = spotterPos.z - cand.z;
      const primaryDir: CardinalDir =
        Math.abs(toSpotterZ) >= Math.abs(toSpotterX)
          ? toSpotterZ < 0
            ? "N"
            : "S"
          : toSpotterX > 0
            ? "E"
            : "W";

      if (tile.cover[primaryDir] === "full") score += 35;
      else if (tile.cover[primaryDir] === "half") score += 20;

      // Mírná preference vzdálenosti 1-2 pole bez vběhnutí přímo k hráči
      const distToSpotter = Math.hypot(toSpotterX, toSpotterZ);
      if (distToSpotter < 2.2) score -= 30;

      if (score > 0 || (currentTile && bestTileCover(currentTile.cover) === "none")) {
        candidates.push({ coord: cand, score: score - manhattan * 2 });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0]!;
  return sameCoord(winner.coord, enemy.pos) ? null : winner.coord;
}

/**
 * Čistá přechodová funkce stavového automatu kamery (State Machine Resolver).
 * Určuje prioritní aktivní stav kamery na základě herního kontextu.
 */
export function resolveActiveCameraState(input: {
  director: CameraDirectorState;
  actionCamEnabled: boolean;
  actionMode: string;
  hasValidAimTarget: boolean;
  hasActiveProjectile: boolean;
  activeMovement: {
    unitId: string;
    isActionCam?: boolean;
  } | null;
}): CameraStateId {
  // 1. Nejvyšší priorita: Event Interrupts (Overwatch Slow-Mo a Pod Reveal)
  if (input.director.overwatchSlowMo) {
    return "INTERRUPT_OVERWATCH_SLOWMO";
  }
  if (input.director.podReveal) {
    return "INTERRUPT_POD_REVEAL";
  }

  // 2. Letící projektil / petarda / úder zblízka (včetně výstřelu z Overwatch)
  if (input.hasActiveProjectile) {
    return "PROJECTILE_TRACK";
  }

  // 3. Režim ručního míření přes rameno (Over-the-Shoulder Aim)
  if (input.actionMode === "shoot" && input.hasValidAimTarget) {
    return "AIM_OTS";
  }

  // 4. Pohyb jednotky po mřížce
  if (input.activeMovement) {
    if (input.actionCamEnabled && input.activeMovement.isActionCam) {
      return "ACTION_OTS_FOLLOW";
    }
    return "TACTICAL_ISO";
  }

  // 5. Zakleknutí do krytu a návrat kamery do izometrického pohledu
  if (input.director.coverSettle && input.actionCamEnabled) {
    return "COVER_SETTLE_RESET";
  }

  // 6. Výchozí taktický izometrický pohled z ptačí perspektivy
  return "TACTICAL_ISO";
}

export { CARDINAL_OFFSETS, coordKey };
