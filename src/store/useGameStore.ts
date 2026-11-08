/**
 * Zustand State Store (/src/store/useGameStore.ts).
 * Propojuje čistou herní logiku (/src/core/) s React UI (Aiming HUD, Target Ribbon, Breakdown Wings)
 * a 3D scénou (@react-three/fiber).
 */

import { create } from "zustand";
import {
  calculateShot,
  checkLineOfSight3D,
  computeEnemyAiDecision,
  evaluateVisibleTargets,
  facingFromDelta,
  gridDistance3D,
  rollRangedAttack,
} from "../core/CombatSystem";
import {
  CARDINAL_OFFSETS,
  coordKey,
  createInitialGrid,
  createInitialUnits,
  GridSystem,
  sameCoord,
} from "../core/GridSystem";
import { computeReachableTiles, findPathAStar } from "../core/Pathfinding";
import type {
  CardinalDir,
  CombatLogEntry,
  Faction,
  FloorLevel,
  GridCoord,
  ReachableTile,
  RenderMode,
  TargetEvaluation,
  UnitData,
  WeatherType,
} from "../core/types";

export type ActionMode = "move" | "shoot" | "grenade";

export interface UnitVisualFX {
  lungeTimestamp: number;
  hitTimestamp: number;
  floatingBanner: {
    id: number;
    text: string;
    tone: "hit" | "crit" | "miss" | "misfire" | "overwatch" | "buff";
  } | null;
}

export interface ProjectileVisual {
  id: number;
  from: GridCoord;
  to: GridCoord;
  kind: "bullet" | "grenade";
  createdAt: number;
}

interface GameStoreState {
  grid: GridSystem;
  units: UnitData[];
  round: number;
  turn: Faction;
  weather: WeatherType;
  gridVersion: number;
  smokeVersion: number;
  outcome: "ongoing" | "victory" | "defeat";
  victoryReason: "boat_escape" | "annihilation" | null;

  selectedUnitId: string | null;
  activeFloor: FloorLevel;
  renderMode: RenderMode;
  cameraStep: number; // Kroky rotace kamery po 90° (Q/E)

  actionMode: ActionMode;
  breakdownOpen: boolean; // Rozbalení postranních křídel matematického rozpisu (F1)
  reachableTiles: Map<string, ReachableTile>;
  hoveredTile: GridCoord | null;
  hoveredPath: GridCoord[];
  visibleTargets: TargetEvaluation[];
  selectedTargetId: string | null;

  isBusy: boolean;
  activeMovement: {
    unitId: string;
    from: GridCoord;
    path: GridCoord[];
  } | null;
  activeProjectile: ProjectileVisual | null;
  unitFx: Record<string, UnitVisualFX>;
  combatLog: CombatLogEntry[];

  // Tutoriál a Taktický rádce (Mission 1 Onboarding)
  tutorialStep: 1 | 2 | 3 | 4 | null;
  tutorialDismissed: boolean;
  setTutorialStep: (step: 1 | 2 | 3 | 4 | null) => void;
  advanceTutorialStep: () => void;
  toggleTutorial: () => void;

  // Paradoxní oběť a Železná vigilie (Mission 1 Climax)
  sacrificeDilemmaOpen: boolean;
  sacrificedHeroId: string | null;
  ironVigilPerk: { name: string; desc: string; heroName: string } | null;
  chooseSacrifice: (heroId: string) => void;

  // Akce UI Controlleru a herní smyčky
  selectUnit: (unitId: string) => void;
  setActiveFloor: (floor: FloorLevel) => void;
  toggleFloor: () => void;
  setRenderMode: (mode: RenderMode) => void;
  toggleRenderMode: () => void;
  setWeather: (weather: WeatherType) => void;
  cycleWeather: () => void;
  rotateCamera: (dir: 1 | -1) => void;
  setActionMode: (mode: ActionMode) => void;
  toggleBreakdown: () => void;
  selectTarget: (targetId: string) => void;
  cycleTarget: (dir: 1 | -1) => void;
  setHoveredTile: (coord: GridCoord | null) => void;
  handleTileClick: (coord: GridCoord) => void;
  handleUnitClick: (unitId: string) => void;
  completeUnitMovement: () => void;
  executeShoot: (targetId?: string) => void;
  activateOverwatch: () => void;
  executeGrenade: (targetCoord: GridCoord) => void;
  endTurn: () => void;
  resetGame: () => void;
}

let logSeq = 1;
let fxSeq = 1;
let moveResolveCallback: (() => void) | null = null;

function makeLog(
  round: number,
  faction: Faction,
  text: string,
  tone: CombatLogEntry["tone"] = "info",
): CombatLogEntry {
  return {
    id: `log-${logSeq++}`,
    round,
    faction,
    text,
    tone,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Synchronizuje pohybovou schopnost maršála Colloreda podle blízkosti sloužících.
 * Zranění z Lützenu 1632 (7 střelných ran, zmrzačená noha) omezuje maršála na 3 pole/AP.
 * Pokud vedle něj (okruh 1 pole) stojí věrný sloužící (komorník Martin / kovář Jakub),
 * podepřou jej a Colloredo získává plných 5 polí za AP!
 */
export function syncColloredoMobility(units: UnitData[]): UnitData[] {
  const colloredo = units.find((u) => u.id === "player-colloredo" && u.alive);
  if (!colloredo) return units;

  const hasAllyNearby = units.some(
    (u) =>
      u.faction === "player" &&
      u.alive &&
      u.id !== colloredo.id &&
      Math.abs(u.pos.x - colloredo.pos.x) <= 1 &&
      Math.abs(u.pos.z - colloredo.pos.z) <= 1 &&
      u.pos.y === colloredo.pos.y,
  );

  const desiredMove = hasAllyNearby ? 5 : 3;
  const desiredBuff = hasAllyNearby
    ? "Podepřen komorníkem (+2 k pohybu)"
    : "Těžké kulhání (zranění z Lützenu)";

  if (
    colloredo.movePerAp === desiredMove &&
    colloredo.buffTitle === desiredBuff
  ) {
    return units;
  }

  return units.map((u) =>
    u.id === colloredo.id
      ? { ...u, movePerAp: desiredMove, buffTitle: desiredBuff }
      : u,
  );
}

function deriveSelectionData(
  grid: GridSystem,
  units: UnitData[],
  selectedId: string | null,
  weather: WeatherType,
  preferredTargetId?: string | null,
) {
  const syncedUnits = syncColloredoMobility(units);
  const unit = syncedUnits.find((u) => u.id === selectedId && u.alive);
  if (!unit || unit.faction !== "player") {
    return {
      reachableTiles: new Map<string, ReachableTile>(),
      visibleTargets: [] as TargetEvaluation[],
      selectedTargetId: null as string | null,
      units: syncedUnits,
    };
  }
  const reachableTiles = computeReachableTiles(grid, unit, syncedUnits);
  const visibleTargets = evaluateVisibleTargets(grid, unit, syncedUnits, weather);
  const keepTarget =
    preferredTargetId &&
    visibleTargets.some((t) => t.targetId === preferredTargetId)
      ? preferredTargetId
      : (visibleTargets[0]?.targetId ?? null);
  return {
    reachableTiles,
    visibleTargets,
    selectedTargetId: keepTarget,
    units: syncedUnits,
  };
}

/**
 * Vyhodnotí stav mise 1:
 * - Vítězství 1 (Útěk): Maršál Colloredo dosáhl rybářské pramice na Čertovce (tile.isEscapeZone === true).
 * - Vítězství 2 (Vojenské): Švédský přepadový oddíl Arnošta Odowalského byl pobit.
 * - Porážka: Polní maršál Colloredo (VIP) padl nebo byl zajat.
 */
function checkMissionOutcome(
  grid: GridSystem,
  units: UnitData[],
): {
  outcome: "ongoing" | "victory" | "defeat";
  victoryReason: "boat_escape" | "annihilation" | null;
} {
  const colloredo = units.find((u) => u.id === "player-colloredo");
  if (!colloredo || !colloredo.alive) {
    return { outcome: "defeat", victoryReason: null };
  }
  const playersAlive = units.some((u) => u.faction === "player" && u.alive);
  if (!playersAlive) {
    return { outcome: "defeat", victoryReason: null };
  }
  const colloredoTile = grid.getTile(colloredo.pos);
  if (colloredoTile?.isEscapeZone) {
    return { outcome: "victory", victoryReason: "boat_escape" };
  }
  const enemiesAlive = units.some((u) => u.faction === "enemy" && u.alive);
  if (!enemiesAlive) {
    return { outcome: "victory", victoryReason: "annihilation" };
  }
  return { outcome: "ongoing", victoryReason: null };
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
      }
    }

    grid.addSmoke(center, 1, 3);

    currentUnits = currentUnits.map((u) => {
      if (!u.alive) return u;
      const inBlast =
        u.pos.y === center.y &&
        Math.abs(u.pos.x - center.x) <= 1 &&
        Math.abs(u.pos.z - center.z) <= 1;
      if (!inBlast) return u;

      if (!victims.includes(u.id)) victims.push(u.id);
      const nextArmor = Math.max(0, u.armor - armorShred);
      const nextHp = Math.max(0, u.hp - damage);
      return {
        ...u,
        armor: nextArmor,
        hp: nextHp,
        isShaken: nextHp > 0,
        alive: nextHp > 0,
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
    initialUnits.find((u) => u.faction === "player")?.id ?? null;
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
      banner: {
        text: string;
        tone: "hit" | "crit" | "miss" | "misfire" | "overwatch" | "buff";
      };
    }>,
  ) => {
    const now = performance.now();
    set((state) => {
      const prev = state.unitFx[unitId] ?? {
        lungeTimestamp: 0,
        hitTimestamp: 0,
        floatingBanner: null,
      };
      return {
        unitFx: {
          ...state.unitFx,
          [unitId]: {
            lungeTimestamp: patch.lunge ? now : prev.lungeTimestamp,
            hitTimestamp: patch.hit ? now : prev.hitTimestamp,
            floatingBanner: patch.banner
              ? { id: fxSeq++, ...patch.banner }
              : prev.floatingBanner,
          },
        },
      };
    });
  };

  const animateUnitAlongPath = (
    unitId: string,
    path: GridCoord[],
  ): Promise<void> => {
    if (path.length === 0) return Promise.resolve();
    const unit = get().units.find((u) => u.id === unitId);
    if (!unit) return Promise.resolve();

    return new Promise<void>((resolve) => {
      moveResolveCallback = resolve;
      set({
        activeMovement: {
          unitId,
          from: { ...unit.pos },
          path,
        },
      });
    });
  };

  const performOverwatchReactionsIfAny = async (
    movedUnitId: string,
    destCoord: GridCoord,
  ) => {
    const state = get();
    const movedUnit = state.units.find((u) => u.id === movedUnitId);
    if (!movedUnit || !movedUnit.alive) return;

    const watchers = state.units.filter(
      (u) =>
        u.alive &&
        u.faction !== movedUnit.faction &&
        u.isOverwatch &&
        gridDistance3D(u.pos, destCoord) <= u.weapon.maxRange &&
        checkLineOfSight3D(state.grid, u.pos, destCoord).clear,
    );

    for (const watcher of watchers) {
      const currentMoved = get().units.find((u) => u.id === movedUnitId);
      if (!currentMoved || !currentMoved.alive) break;

      const calculation = calculateShot(
        get().grid,
        watcher,
        currentMoved,
        get().weather,
        watcher.pos,
      );
      const outcome = rollRangedAttack(
        watcher,
        currentMoved,
        calculation,
        Math.random,
        0.85,
      );

      // Výstřel z Overwatch vytvoří oblak kouře z černého prachu na dlaždici střelce
      if (!outcome.misfired) {
        get().grid.addSmoke(watcher.pos, 0, 2);
      }

      set((s) => ({
        smokeVersion: s.smokeVersion + 1,
        units: s.units.map((u) =>
          u.id === watcher.id
            ? {
                ...u,
                isOverwatch: false,
                facing: facingFromDelta(u.pos, destCoord, u.facing),
              }
            : u,
        ),
        activeProjectile: outcome.misfired
          ? null
          : {
              id: fxSeq++,
              from: watcher.pos,
              to: destCoord,
              kind: "bullet",
              createdAt: performance.now(),
            },
      }));

      triggerUnitFx(watcher.id, {
        lunge: true,
        banner: outcome.misfired
          ? { text: "SELHÁNÍ!", tone: "misfire" }
          : { text: "OVERWATCH!", tone: "overwatch" },
      });

      await delay(280);

      set((s) => {
        const updatedUnits = s.units.map((u) => {
          if (u.id !== currentMoved.id) return u;
          const nextArmor = Math.max(0, u.armor - outcome.armorShredded);
          const nextHp = Math.max(0, u.hp - outcome.damage);
          const shakenNow =
            u.isShaken || (outcome.hit && (outcome.critical || outcome.damage >= 4));
          return {
            ...u,
            armor: nextArmor,
            hp: nextHp,
            isShaken: nextHp > 0 ? shakenNow : false,
            alive: nextHp > 0,
            isOverwatch: nextHp > 0 ? u.isOverwatch : false,
          };
        });

        const logMsg = outcome.misfired
          ? `${watcher.name} chtěl vypálit z Overwatch na ${currentMoved.name}, ale zvlhlý prach selhal!`
          : outcome.hit
            ? `${watcher.name} zasáhl z Overwatch ${currentMoved.name} (−${outcome.damage} HP${outcome.armorShredded > 0 ? `, −${outcome.armorShredded} zbroj` : ""}${outcome.critical ? ", KRITICKÝ!" : ""})!`
            : `${watcher.name} vypálil z Overwatch na ${currentMoved.name}, ale minul (${outcome.hitChance} %).`;

        const outcomeCheck = checkMissionOutcome(s.grid, updatedUnits);
        return {
          units: updatedUnits,
          activeProjectile: null,
          outcome: outcomeCheck.outcome,
          victoryReason: outcomeCheck.victoryReason,
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              watcher.faction,
              logMsg,
              outcome.misfired
                ? "misfire"
                : outcome.hit
                  ? "overwatch"
                  : "miss",
            ),
          ],
        };
      });

      if (!outcome.misfired) {
        triggerUnitFx(currentMoved.id, {
          hit: outcome.hit,
          banner: outcome.hit
            ? {
                text: outcome.critical
                  ? `KRIT −${outcome.damage}`
                  : `−${outcome.damage} HP`,
                tone: outcome.critical ? "crit" : "hit",
              }
            : { text: "VEDLE", tone: "miss" },
        });
      }

      await delay(320);
    }
  };

  return {
    grid: initialGrid,
    units: initialUnits,
    round: 1,
    turn: "player",
    weather: initialWeather,
    gridVersion: 1,
    smokeVersion: 1,
    outcome: "ongoing",
    victoryReason: null,

    selectedUnitId: firstPlayerId,
    activeFloor: 0,
    renderMode: "2D_SPRITE",
    cameraStep: 0,

    actionMode: "move",
    breakdownOpen: true,
    reachableTiles: derived.reachableTiles,
    hoveredTile: null,
    hoveredPath: [],
    visibleTargets: derived.visibleTargets,
    selectedTargetId: derived.selectedTargetId,

    isBusy: false,
    activeMovement: null,
    activeProjectile: null,
    unitFx: {},
    combatLog: [
      makeLog(
        1,
        "player",
        "26. července 1648, 02:30 ráno (Noční liják): Zrádce Arnošt Odowalsky otevřel Strahovskou bránu švédským dragounům generála Königsmarcka!",
        "alert",
      ),
      makeLog(
        1,
        "player",
        "Maršál Rudolf Colloredo vyskočil z lůžka v noční košili. Malostranská mostecká věž je odříznuta! Dostaňte zraněného maršála zahradou k rybářské pramici na Čertovce!",
        "story",
      ),
    ],

    tutorialStep: 1,
    tutorialDismissed: false,

    setTutorialStep: (step: 1 | 2 | 3 | 4 | null) => {
      set({ tutorialStep: step });
    },

    advanceTutorialStep: () => {
      set((s) => {
        if (s.tutorialStep === null) return { tutorialStep: 1 };
        if (s.tutorialStep < 4) {
          return { tutorialStep: (s.tutorialStep + 1) as 1 | 2 | 3 | 4 };
        }
        return { tutorialStep: null };
      });
    },

    toggleTutorial: () => {
      set((s) => ({ tutorialDismissed: !s.tutorialDismissed }));
    },

    sacrificeDilemmaOpen: false,
    sacrificedHeroId: null,
    ironVigilPerk: null,

    chooseSacrifice: (heroId: string) => {
      const state = get();
      const hero = state.units.find((u) => u.id === heroId);
      const heroName = hero?.name ?? "Věrný společník";

      let perk = {
        name: "Ocelová věrnost",
        desc: "+20 % odolnost proti šoku a panice, +1 AP při záchraně raněného druha",
        heroName,
      };
      if (heroId === "player-bartolomej") {
        perk = {
          name: "Maltézský pyrotechnik",
          desc: "+2 k dosahu vrhání granátů, výbuchy prachu způsobují o +1 vyšší poškození",
          heroName,
        };
      } else if (heroId === "player-vaclav-michalovic") {
        perk = {
          name: "Klementinský zápal",
          desc: "+10 % k přesnosti při střelbě z vyvýšených míst / věže, 0 % šance na selhání zbraně v dešti",
          heroName,
        };
      }

      set((s) => ({
        sacrificeDilemmaOpen: false,
        sacrificedHeroId: heroId,
        ironVigilPerk: perk,
        outcome: "victory",
        victoryReason: "boat_escape",
        combatLog: [
          ...s.combatLog,
          makeLog(
            s.round,
            "player",
            `${heroName} se dobrovolně obětoval u branky paláce, aby maršál Colloredo mohl odrazit s pramicí do vln Vltavy!`,
            "story",
          ),
          makeLog(
            s.round,
            "player",
            `PARADOX PŘEŽITÍ: Dva společníci v loďce padli pod salvou švédských mušket, kryjíce maršála. Ale ${heroName} zázrakem přežil výbuch prachu, přeplaval řeku a Pater Jiří Plachý jej v Klementinu přijal do ŽELEZNÉ VIGILIE!`,
            "alert",
          ),
        ],
      }));
    },

    selectUnit: (unitId: string) => {
      const state = get();
      if (state.isBusy || state.turn !== "player") return;
      const unit = state.units.find((u) => u.id === unitId);
      if (!unit || !unit.alive || unit.faction !== "player") return;

      const sel = deriveSelectionData(
        state.grid,
        state.units,
        unitId,
        state.weather,
        state.selectedTargetId,
      );
      set({
        selectedUnitId: unitId,
        activeFloor: unit.pos.y,
        actionMode: "move",
        reachableTiles: sel.reachableTiles,
        visibleTargets: sel.visibleTargets,
        selectedTargetId: sel.selectedTargetId,
        hoveredPath: [],
      });
    },

    setActiveFloor: (floor: FloorLevel) => {
      set({ activeFloor: floor, hoveredTile: null, hoveredPath: [] });
    },

    toggleFloor: () => {
      set((s) => ({
        activeFloor: s.activeFloor === 0 ? 1 : 0,
        hoveredTile: null,
        hoveredPath: [],
      }));
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
      );
      set({
        weather,
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

    rotateCamera: (dir: 1 | -1) => {
      set((s) => ({ cameraStep: s.cameraStep + dir }));
    },

    setActionMode: (mode: ActionMode) => {
      const state = get();
      if (state.isBusy || state.turn !== "player") return;
      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (!unit || !unit.alive || unit.ap <= 0) return;

      if (mode === "shoot") {
        const targets = evaluateVisibleTargets(
          state.grid,
          unit,
          state.units,
          state.weather,
        );
        const keepId =
          state.selectedTargetId &&
          targets.some((t) => t.targetId === state.selectedTargetId)
            ? state.selectedTargetId
            : (targets[0]?.targetId ?? null);
        const targetUnit = state.units.find((u) => u.id === keepId);
        set({
          actionMode: "shoot",
          visibleTargets: targets,
          selectedTargetId: keepId,
          activeFloor: targetUnit ? targetUnit.pos.y : state.activeFloor,
          hoveredPath: [],
        });
        return;
      }

      set({
        actionMode: mode,
        activeFloor: unit.pos.y,
        hoveredPath: [],
      });
    },

    toggleBreakdown: () => {
      set((s) => ({ breakdownOpen: !s.breakdownOpen }));
    },

    selectTarget: (targetId: string) => {
      const state = get();
      if (state.visibleTargets.some((t) => t.targetId === targetId)) {
        const target = state.units.find((u) => u.id === targetId);
        set({
          selectedTargetId: targetId,
          actionMode: "shoot",
          activeFloor: target ? target.pos.y : state.activeFloor,
        });
      }
    },

    cycleTarget: (dir: 1 | -1) => {
      const state = get();
      if (state.visibleTargets.length === 0) return;
      const currentIdx = state.visibleTargets.findIndex(
        (t) => t.targetId === state.selectedTargetId,
      );
      const nextIdx =
        currentIdx < 0
          ? 0
          : (currentIdx + dir + state.visibleTargets.length) %
            state.visibleTargets.length;
      const nextTargetId = state.visibleTargets[nextIdx]?.targetId;
      if (nextTargetId) {
        get().selectTarget(nextTargetId);
      }
    },

    setHoveredTile: (coord: GridCoord | null) => {
      const state = get();
      if (!coord) {
        if (state.hoveredTile !== null || state.hoveredPath.length > 0) {
          set({ hoveredTile: null, hoveredPath: [] });
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
        set({ hoveredTile: coord, hoveredPath: [] });
        return;
      }

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      const reachable = state.reachableTiles.get(coordKey(coord));
      if (!unit || !reachable) {
        set({ hoveredTile: coord, hoveredPath: [] });
        return;
      }

      const path = findPathAStar(
        state.grid,
        unit.pos,
        coord,
        state.units,
        unit.id,
      );
      set({ hoveredTile: coord, hoveredPath: path });
    },

    handleUnitClick: (unitId: string) => {
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

      const isVisible = state.visibleTargets.some(
        (t) => t.targetId === clickedUnit.id,
      );
      if (isVisible) {
        if (
          state.actionMode === "shoot" &&
          state.selectedTargetId === clickedUnit.id
        ) {
          get().executeShoot(clickedUnit.id);
        } else {
          get().selectTarget(clickedUnit.id);
        }
      }
    },

    handleTileClick: (coord: GridCoord) => {
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

      if (state.actionMode === "grenade") {
        get().executeGrenade(coord);
        return;
      }

      if (state.actionMode !== "move" || !state.selectedUnitId) return;

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (!unit || !unit.alive || unit.ap <= 0) return;

      const reach = state.reachableTiles.get(coordKey(coord));
      if (!reach) return;

      const path = findPathAStar(
        state.grid,
        unit.pos,
        coord,
        state.units,
        unit.id,
      );
      if (path.length === 0) return;

      void (async () => {
        set({
          isBusy: true,
          hoveredPath: [],
          reachableTiles: new Map(),
        });

        await animateUnitAlongPath(unit.id, path);

        const finalStep = path[path.length - 1]!;
        const prevStep =
          path.length >= 2 ? path[path.length - 2]! : unit.pos;
        const newFacing = facingFromDelta(prevStep, finalStep, unit.facing);

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
          const syncedUnits = syncColloredoMobility(updatedUnits);
          const climbNote =
            finalStep.y !== unit.pos.y
              ? finalStep.y === 1
                ? " (vylezl po žebříku do 1. patra)"
                : " (slezl po žebříku do přízemí)"
              : "";
          const zoneNote =
            reach.zone === "yellow" ? "Sprint (2 AP)" : "Přesun (1 AP)";

          // Tutoriál: Krok 1 (Pohyb & Eskorta) automaticky přejde na Krok 2,
          // jakmile hráč pohne jednotkou a Colloredo získá doprovod (+2 k pohybu)
          const colloredo = syncedUnits.find((u) => u.id === "player-colloredo");
          const nextTutorialStep =
            s.tutorialStep === 1 && colloredo && colloredo.movePerAp === 5
              ? (2 as const)
              : s.tutorialStep;

          return {
            units: syncedUnits,
            activeFloor: finalStep.y,
            tutorialStep: nextTutorialStep,
            combatLog: [
              ...s.combatLog,
              makeLog(
                s.round,
                "player",
                `${unit.name}: ${zoneNote} na [${finalStep.x}, patro ${finalStep.y}, ${finalStep.z}]${climbNote}.`,
                "info",
              ),
            ],
          };
        });

        await performOverwatchReactionsIfAny(unit.id, finalStep);

        const afterState = get();
        const outcomeCheck = checkMissionOutcome(afterState.grid, afterState.units);
        if (outcomeCheck.outcome !== "ongoing") {
          // Pokud hráč dosáhl vítězství a dosud nebyla vyřešena Paradoxní oběť, otevřeme dilematické okno!
          if (outcomeCheck.outcome === "victory" && !afterState.sacrificedHeroId) {
            const aliveCompanions = afterState.units.filter(
              (u) =>
                u.faction === "player" &&
                u.alive &&
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

          const logMsg =
            outcomeCheck.outcome === "victory" &&
            outcomeCheck.victoryReason === "boat_escape"
              ? "MARŠÁL COLLOREDO DOSÁHL RYBÁŘSKÉ PRAMICE! Rybář okamžitě odráží od břehu a veze maršála přes rozvodněnou Vltavu na Staré Město!"
              : outcomeCheck.outcome === "victory"
                ? "Švédský přepadový oddíl Arnošta Odowalského byl zneškodněn! Cesta k rybářské pramici na Čertovce je volná!"
                : "Maršál Colloredo padl... Praha ztratila svého vrchního velitele a pravý břeh se neubrání!";

          set({
            isBusy: false,
            outcome: outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            combatLog: [
              ...afterState.combatLog,
              makeLog(
                afterState.round,
                "player",
                logMsg,
                outcomeCheck.outcome === "victory" ? "story" : "alert",
              ),
            ],
          });
          return;
        }

        const nextDerived = deriveSelectionData(
          afterState.grid,
          afterState.units,
          afterState.selectedUnitId,
          afterState.weather,
          afterState.selectedTargetId,
        );
        set({
          isBusy: false,
          reachableTiles: nextDerived.reachableTiles,
          visibleTargets: nextDerived.visibleTargets,
          selectedTargetId: nextDerived.selectedTargetId,
        });
      })();
    },

    completeUnitMovement: () => {
      const cb = moveResolveCallback;
      moveResolveCallback = null;
      set({ activeMovement: null });
      if (cb) cb();
    },

    executeShoot: (targetIdArg?: string) => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const attacker = state.units.find((u) => u.id === state.selectedUnitId);
      if (!attacker || !attacker.alive || attacker.ap < 1) return;

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

        // Pokud nedošlo k selhání doutnáku, výstřel zahalí dlaždici střelce oblakem kouře z černého prachu
        if (!outcome.misfired) {
          get().grid.addSmoke(attacker.pos, 0, 2);
        }

        set((s) => ({
          isBusy: true,
          smokeVersion: s.smokeVersion + 1,
          units: s.units.map((u) =>
            u.id === attacker.id
              ? { ...u, facing: newFacing, ap: 0, isOverwatch: false }
              : u,
          ),
          activeProjectile: outcome.misfired
            ? null
            : {
                id: fxSeq++,
                from: attacker.pos,
                to: target.pos,
                kind: "bullet",
                createdAt: performance.now(),
              },
        }));

        triggerUnitFx(attacker.id, {
          lunge: true,
          banner: outcome.misfired
            ? { text: "SELHÁNÍ DOUTNÁKU!", tone: "misfire" }
            : undefined,
        });

        await delay(280);

        set((s) => {
          const updatedUnits = s.units.map((u) => {
            if (u.id !== target.id) return u;
            const nextArmor = Math.max(0, u.armor - outcome.armorShredded);
            const nextHp = Math.max(0, u.hp - outcome.damage);
            const shakenNow =
              u.isShaken ||
              (outcome.hit && (outcome.critical || outcome.damage >= 4));
            return {
              ...u,
              armor: nextArmor,
              hp: nextHp,
              isShaken: nextHp > 0 ? shakenNow : false,
              alive: nextHp > 0,
              isOverwatch: nextHp > 0 ? u.isOverwatch : false,
            };
          });

          const bonusTags: string[] = [];
          if (outcome.heightAdvantage) bonusTags.push("výšková převaha +15 %");
          if (outcome.flanked) bonusTags.push("OBCHVAT +40 % krit");
          if (outcome.armorShredded > 0)
            bonusTags.push(`zničena zbroj −${outcome.armorShredded}`);
          if (outcome.armorAbsorbed > 0)
            bonusTags.push(`kyrys pohltil ${outcome.armorAbsorbed} HP`);
          const tagSuffix =
            bonusTags.length > 0 ? ` [${bonusTags.join(", ")}]` : "";

          const text = outcome.misfired
            ? `${attacker.name} stiskl spoušť (${attacker.weapon.name}), ale vlhký střelný prach na pánvičce jen zasyčel (Selhání ${outcome.misfireChance} %)!`
            : outcome.hit
              ? `${attacker.name} zasáhl ${target.name} (${outcome.hitChance} %) za ${outcome.damage} HP${outcome.critical ? " — KRITICKÝ PRŮSTŘEL!" : ""}${outcome.killed ? " (PADL)" : ""}${tagSuffix}.`
              : `${attacker.name} minul ${target.name} (šance ${outcome.hitChance} %)${tagSuffix}.`;

          let finalUnits = updatedUnits;
          let kegDetonated = false;
          let kegLog = "";
          // Zásah v těsné blízkosti prachového sudu může způsobit mohutnou sekundární explozi
          const neighborKeg = (["N", "E", "S", "W"] as CardinalDir[]).find((dir) => {
            const { dx, dz } = CARDINAL_OFFSETS[dir];
            const t = s.grid.getTile({
              x: target.pos.x + dx,
              y: target.pos.y,
              z: target.pos.z + dz,
            });
            return t && t.obstacle === "powder_keg";
          });

          if (neighborKeg && outcome.hit && (outcome.critical || outcome.damage >= 5)) {
            const { dx, dz } = CARDINAL_OFFSETS[neighborKeg];
            const kegPos = {
              x: target.pos.x + dx,
              y: target.pos.y,
              z: target.pos.z + dz,
            };
            const blast = processExplosions(s.grid, updatedUnits, kegPos, 5, 2);
            finalUnits = blast.nextUnits;
            kegDetonated = true;
            kegLog = `VÝBUCH PRACHU! Jiskra z výstřelu odpálila sud se střelným prachem na [${kegPos.x}, ${kegPos.z}]!`;
          }

          const outcomeCheck = checkMissionOutcome(s.grid, finalUnits);
          const nextDerived = deriveSelectionData(
            s.grid,
            finalUnits,
            s.selectedUnitId,
            s.weather,
          );

          const newLogs = [
            ...s.combatLog,
            makeLog(
              s.round,
              "player",
              text,
              outcome.misfired
                ? "misfire"
                : outcome.hit
                  ? outcome.critical
                    ? "crit"
                    : "hit"
                  : "miss",
            ),
          ];
          if (kegDetonated) {
            newLogs.push(makeLog(s.round, "player", kegLog, "alert"));
          }

          const nextTutorialStep =
            s.tutorialStep === 2
              ? (3 as const)
              : kegDetonated && s.tutorialStep === 3
                ? (4 as const)
                : s.tutorialStep;

          return {
            isBusy: false,
            gridVersion: kegDetonated ? s.gridVersion + 1 : s.gridVersion,
            smokeVersion: s.smokeVersion + (kegDetonated ? 2 : 1),
            units: finalUnits,
            tutorialStep: nextTutorialStep,
            activeProjectile: null,
            actionMode: "move",
            activeFloor: attacker.pos.y,
            outcome: outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            selectedTargetId: nextDerived.selectedTargetId,
            combatLog: newLogs,
          };
        });

        if (!outcome.misfired) {
          triggerUnitFx(target.id, {
            hit: outcome.hit,
            banner: outcome.hit
              ? {
                  text: outcome.critical
                    ? `KRIT −${outcome.damage}!`
                    : `−${outcome.damage} HP`,
                  tone: outcome.critical ? "crit" : "hit",
                }
              : { text: "MINUL", tone: "miss" },
          });
        }
      })();
    },

    activateOverwatch: () => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (!unit || !unit.alive || unit.ap < 1 || unit.isOverwatch) return;

      const updatedUnits = state.units.map((u) =>
        u.id === unit.id ? { ...u, ap: 0, isOverwatch: true } : u,
      );
      const nextDerived = deriveSelectionData(
        state.grid,
        updatedUnits,
        state.selectedUnitId,
        state.weather,
      );

      set((s) => ({
        units: updatedUnits,
        actionMode: "move",
        reachableTiles: nextDerived.reachableTiles,
        visibleTargets: nextDerived.visibleTargets,
        selectedTargetId: nextDerived.selectedTargetId,
        combatLog: [
          ...s.combatLog,
          makeLog(
            s.round,
            "player",
            `${unit.name} přešel do režimu OVERWATCH (hlídá pohyb nepřátel v zorném poli).`,
            "overwatch",
          ),
        ],
      }));

      triggerUnitFx(unit.id, {
        banner: { text: "OVERWATCH", tone: "overwatch" },
      });
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
        attacker.grenades <= 0
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

        set((s) => ({
          isBusy: true,
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
            createdAt: performance.now(),
          },
        }));

        triggerUnitFx(attacker.id, { lunge: true });

        await delay(380);

        const grenadeDamage = 4;
        const grenadeShred = 2;

        // Zpracování exploze petardy a případné řetězové detonace prachových sudů
        const blast = processExplosions(
          get().grid,
          get().units,
          targetCoord,
          grenadeDamage,
          grenadeShred,
        );
        const hitVictims = blast.victims;
        const updatedUnits = blast.nextUnits;

        set((s) => {
          const outcomeCheck = checkMissionOutcome(s.grid, updatedUnits);
          const nextDerived = deriveSelectionData(
            s.grid,
            updatedUnits,
            s.selectedUnitId,
            s.weather,
          );

          const kegNote =
            blast.detonatedKegs.length > 0
              ? ` + ODPÁLENO ${blast.detonatedKegs.length} PRACHOVÝCH SUDŮ!`
              : "";

          const nextTutorialStep =
            s.tutorialStep === 3 ? (4 as const) : s.tutorialStep;

          return {
            isBusy: false,
            gridVersion: s.gridVersion + 1,
            smokeVersion: s.smokeVersion + 1,
            units: updatedUnits,
            tutorialStep: nextTutorialStep,
            activeProjectile: null,
            actionMode: "move",
            outcome: outcomeCheck.outcome,
            victoryReason: outcomeCheck.victoryReason,
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            selectedTargetId: nextDerived.selectedTargetId,
            combatLog: [
              ...s.combatLog,
              makeLog(
                s.round,
                "player",
                `${attacker.name} hodil petardu na [${targetCoord.x}, patro ${targetCoord.y}, ${targetCoord.z}] — výbuch 3×3 (${hitVictims.length} zasaženo za ${grenadeDamage} HP, −${grenadeShred} zbroj a dým)${kegNote}!`,
                "crit",
              ),
            ],
          };
        });

        for (const vid of hitVictims) {
          triggerUnitFx(vid, {
            hit: true,
            banner: { text: `VÝBUCH −${grenadeDamage}`, tone: "crit" },
          });
        }
      })();
    },

    endTurn: () => {
      const state = get();
      if (state.isBusy || state.turn !== "player" || state.outcome !== "ongoing")
        return;

      void (async () => {
        set((s) => ({
          isBusy: true,
          turn: "enemy",
          actionMode: "move",
          reachableTiles: new Map(),
          hoveredPath: [],
          units: s.units.map((u) =>
            u.faction === "enemy" && u.alive
              ? {
                  ...u,
                  ap: u.maxAp,
                  movedThisTurn: false,
                  isOverwatch: false,
                  isShaken: false,
                }
              : u,
          ),
          combatLog: [
            ...s.combatLog,
            makeLog(
              s.round,
              "enemy",
              `--- Kolo ${s.round}: Aktivita švédské hlídky ---`,
              "alert",
            ),
          ],
        }));

        await delay(400);

        const enemyIds = get()
          .units.filter((u) => u.faction === "enemy" && u.alive)
          .map((u) => u.id);

        for (const enemyId of enemyIds) {
          if (get().outcome !== "ongoing") break;
          const enemy = get().units.find((u) => u.id === enemyId && u.alive);
          if (!enemy) continue;

          set({ activeFloor: enemy.pos.y });

          const plan = computeEnemyAiDecision(
            get().grid,
            enemy,
            get().units,
            get().weather,
          );

          if (plan.movePath.length > 0) {
            await animateUnitAlongPath(enemy.id, plan.movePath);
            const dest = plan.movePath[plan.movePath.length - 1]!;
            const prev =
              plan.movePath.length >= 2
                ? plan.movePath[plan.movePath.length - 2]!
                : enemy.pos;
            const facing = facingFromDelta(prev, dest, enemy.facing);

            set((s) => ({
              activeFloor: dest.y,
              units: s.units.map((u) =>
                u.id === enemy.id
                  ? {
                      ...u,
                      pos: dest,
                      facing,
                      movedThisTurn: true,
                      ap: Math.max(0, u.ap - plan.moveApCost),
                    }
                  : u,
              ),
            }));

            await performOverwatchReactionsIfAny(enemy.id, dest);
            await delay(220);
          }

          const updatedEnemy = get().units.find(
            (u) => u.id === enemyId && u.alive,
          );
          if (
            !updatedEnemy ||
            updatedEnemy.ap <= 0 ||
            get().outcome !== "ongoing"
          )
            continue;

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
            if (targetUnit) {
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

              set((s) => ({
                smokeVersion: s.smokeVersion + 1,
                units: s.units.map((u) =>
                  u.id === updatedEnemy.id
                    ? { ...u, facing: shotFacing, ap: 0 }
                    : u,
                ),
                activeProjectile: outcome.misfired
                  ? null
                  : {
                      id: fxSeq++,
                      from: updatedEnemy.pos,
                      to: targetUnit.pos,
                      kind: "bullet",
                      createdAt: performance.now(),
                    },
              }));

              triggerUnitFx(updatedEnemy.id, {
                lunge: true,
                banner: outcome.misfired
                  ? { text: "SELHÁNÍ!", tone: "misfire" }
                  : undefined,
              });
              await delay(300);

              set((s) => {
                const nextUnits = s.units.map((u) => {
                  if (u.id !== targetUnit.id) return u;
                  const nextArmor = Math.max(
                    0,
                    u.armor - outcome.armorShredded,
                  );
                  const nextHp = Math.max(0, u.hp - outcome.damage);
                  const shakenNow =
                    u.isShaken ||
                    (outcome.hit && (outcome.critical || outcome.damage >= 4));
                  return {
                    ...u,
                    armor: nextArmor,
                    hp: nextHp,
                    isShaken: nextHp > 0 ? shakenNow : false,
                    alive: nextHp > 0,
                    isOverwatch: nextHp > 0 ? u.isOverwatch : false,
                  };
                });

                const msg = outcome.misfired
                  ? `${updatedEnemy.name} chtěl vystřelit na ${targetUnit.name}, ale doutnák v dešti selhal!`
                  : outcome.hit
                    ? `${updatedEnemy.name} zasáhl ${targetUnit.name} (${outcome.hitChance} %) za ${outcome.damage} HP${outcome.armorShredded > 0 ? ` (−${outcome.armorShredded} zbroj)` : ""}${outcome.critical ? " (KRITICKÝ!)" : ""}!`
                    : `${updatedEnemy.name} vystřelil na ${targetUnit.name} (${outcome.hitChance} %), ale minul.`;

                const outcomeCheck = checkMissionOutcome(s.grid, nextUnits);
                return {
                  units: nextUnits,
                  activeProjectile: null,
                  outcome: outcomeCheck.outcome,
                  victoryReason: outcomeCheck.victoryReason,
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
                  ],
                };
              });

              if (!outcome.misfired) {
                triggerUnitFx(targetUnit.id, {
                  hit: outcome.hit,
                  banner: outcome.hit
                    ? {
                        text: outcome.critical
                          ? `KRIT −${outcome.damage}!`
                          : `−${outcome.damage} HP`,
                        tone: outcome.critical ? "crit" : "hit",
                      }
                    : { text: "VEDLE", tone: "miss" },
                });
              }

              await delay(360);
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
                  `${updatedEnemy.name} zaujal kryt a drží Overwatch.`,
                  "overwatch",
                ),
              ],
            }));
            triggerUnitFx(updatedEnemy.id, {
              banner: { text: "OVERWATCH", tone: "overwatch" },
            });
            await delay(240);
          }
        }

        if (get().outcome !== "ongoing") {
          set({ isBusy: false });
          return;
        }

        // Rozptýlení starého kouře na přelomu kola a zahájení tahu hráče
        get().grid.decaySmoke();

        set((s) => {
          const nextRound = s.round + 1;
          const refreshedUnits = syncColloredoMobility(
            s.units.map((u) =>
              u.faction === "player" && u.alive
                ? {
                    ...u,
                    ap: u.maxAp,
                    movedThisTurn: false,
                    isOverwatch: false,
                    isShaken: false,
                  }
                : u,
            ),
          );
          const currentSelected = refreshedUnits.find(
            (u) =>
              u.id === s.selectedUnitId && u.alive && u.faction === "player",
          );
          const nextSelectedId =
            currentSelected?.id ??
            refreshedUnits.find((u) => u.faction === "player" && u.alive)?.id ??
            null;
          const nextSelectedUnit = refreshedUnits.find(
            (u) => u.id === nextSelectedId,
          );
          const nextDerived = deriveSelectionData(
            s.grid,
            refreshedUnits,
            nextSelectedId,
            s.weather,
          );

          return {
            round: nextRound,
            turn: "player",
            smokeVersion: s.smokeVersion + 1,
            isBusy: false,
            units: refreshedUnits,
            selectedUnitId: nextSelectedId,
            activeFloor: nextSelectedUnit ? nextSelectedUnit.pos.y : 0,
            actionMode: "move",
            reachableTiles: nextDerived.reachableTiles,
            visibleTargets: nextDerived.visibleTargets,
            selectedTargetId: nextDerived.selectedTargetId,
            combatLog: [
              ...s.combatLog,
              makeLog(
                nextRound,
                "player",
                `--- Kolo ${nextRound}: Útěk velkopřevora Colloreda ---`,
                "info",
              ),
            ],
          };
        });
      })();
    },

    resetGame: () => {
      const nextGrid = createInitialGrid();
      const nextUnits = syncColloredoMobility(createInitialUnits());
      const firstId = nextUnits.find((u) => u.faction === "player")?.id ?? null;
      const currentWeather = "rain"; // Výchozí autentický noční déšť
      const nextDerived = deriveSelectionData(
        nextGrid,
        nextUnits,
        firstId,
        currentWeather,
      );
      moveResolveCallback = null;

      set((s) => ({
        grid: nextGrid,
        units: nextUnits,
        round: 1,
        turn: "player",
        weather: currentWeather,
        gridVersion: s.gridVersion + 1,
        smokeVersion: s.smokeVersion + 1,
        outcome: "ongoing",
        victoryReason: null,
        sacrificeDilemmaOpen: false,
        sacrificedHeroId: null,
        ironVigilPerk: null,
        tutorialStep: 1,
        tutorialDismissed: false,
        selectedUnitId: firstId,
        activeFloor: 0,
        actionMode: "move",
        reachableTiles: nextDerived.reachableTiles,
        hoveredTile: null,
        hoveredPath: [],
        visibleTargets: nextDerived.visibleTargets,
        selectedTargetId: nextDerived.selectedTargetId,
        isBusy: false,
        activeMovement: null,
        activeProjectile: null,
        unitFx: {},
        combatLog: [
          makeLog(
            1,
            "player",
            "26. července 1648, 02:30 ráno (Noční liják): Zrádce Arnošt Odowalsky otevřel Strahovskou bránu švédským dragounům generála Königsmarcka!",
            "alert",
          ),
          makeLog(
            1,
            "player",
            "Maršál Rudolf Colloredo vyskočil z lůžka v noční košili. Malostranská mostecká věž je odříznuta! Dostaňte zraněného maršála zahradou k rybářské pramici na Čertovce!",
            "story",
          ),
        ],
      }));
    },
  };
});
