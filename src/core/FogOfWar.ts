/**
 * Barokní Mlha války a Šerosvit (/src/core/FogOfWar.ts).
 * Čistý TypeScript modul (headless core bez závislostí na Three.js a Reactu) pro:
 * 1. Třístavovou taktickou viditelnost ('unexplored' Terra Incognita, 'shrouded' Paměť šerosvitu, 'visible' Aktivní LoS).
 * 2. Dynamický dosah nočního dohledu podle výškového patra (P0, P1 Piano Nobile, P2 Maltézská věž), počasí (Jasno, Liják, Vltavská mlha)
 *    a clony kouře z černého prachu (Black Powder Smoke).
 * 3. Zvukové a světelné kontakty 17. století (žhnoucí doutnák muškety ve tmě, šramot kyrysu, záblesk výstřelu z pánvičky).
 */

import { bresenham3D, checkLineOfSight3D, gridDistance3D } from "./CombatSystem";
import { coordKey, GridSystem, sameCoord } from "./GridSystem";
import type {
  FogOfWarSnapshot,
  FogVisibilityState,
  GridCoord,
  SoundContact,
  UnitData,
  WeatherType,
} from "./types";

export interface DynamicLightSource {
  coord: GridCoord;
  radius: number;
}

/**
 * Spočítá efektivní poloměr nočního dohledu (v polích) pro danou jednotku:
 * - Zohledňuje archetyp (ostrostřelec Václav vidí dále do tmy),
 * - Výškovou převahu (1. patro Piano Nobile / Belveder +2.2 pole, 2. patro Maltézská věž +5.5 pole),
 * - Počasí (Jasná noc +2.5, Noční liják -1.0, Ranní vltavská mlha -2.5),
 * - Hustý kouř z černého prachu na dlaždici pozorovatele (-2.5 pole),
 * - Aktivní schopnosti Svatováclavské soustředění / Rozkaz polního maršála (+6.0 polí).
 */
export function computeUnitSightRadius(
  grid: GridSystem,
  unit: UnitData,
  weather: WeatherType = "rain",
  fromPos: GridCoord = unit.pos,
): number {
  const baseRadius =
    unit.archetype === "sniper"
      ? 9.2
      : unit.archetype === "commander"
        ? 8.5
        : 8.5;

  const elevationBonus =
    fromPos.y === 2 ? 5.5 : fromPos.y === 1 ? 2.2 : 0;

  const weatherMod =
    weather === "clear" ? 2.5 : weather === "fog" ? -2.5 : -1.0;

  const tile = grid.getTile(fromPos);
  const inSmokePenalty = (tile?.smokeTurns ?? 0) > 0 ? -2.5 : 0;

  const abilityBonus =
    unit.abilityBuffActive &&
    (unit.ability?.id === "klementinum_verdict" ||
      unit.ability?.id === "marshal_command")
      ? 6.0
      : 0;

  return Math.max(
    4.0,
    Math.round(
      (baseRadius + elevationBonus + weatherMod + inSmokePenalty + abilityBonus) *
        10,
    ) / 10,
  );
}

/**
 * Ověří, zda má pozorovatel z `from` přímý průhled (3D Bresenham LoS) na dlaždici `to`
 * se započtením neprůhledné clony hustého kouře z černého prachu (`smokeTurns > 0`).
 * - Samotný oblak dýmu je vidět, ale skrz hustý dým na stejné úrovni (`from.y <= to.y`) nelze vidět dlaždice za ním.
 * - Střelec stojící na vyvýšeném patře (`from.y > to.y`, např. Piano Nobile nebo Maltézská věž) vidí přes přízemní dým.
 */
export function checkFogLineOfSight3D(
  grid: GridSystem,
  from: GridCoord,
  to: GridCoord,
  ignoreSmoke = false,
): boolean {
  if (sameCoord(from, to)) return true;

  const targetTile = grid.getTile(to);
  // Pro vysoké zdi, pilíře a zavřené dveře kontrolujeme, zda je viditelná alespoň jejich čelní hrana z pozice pozorovatele
  if (
    targetTile &&
    (targetTile.obstacle === "high_wall" ||
      targetTile.obstacle === "pillar" ||
      grid.isDoorClosedAt(to))
  ) {
    const ray = bresenham3D(from, to);
    if (ray.length <= 2) return true;
    const prefixEnd = ray[ray.length - 2]!;
    return checkFogLineOfSight3D(grid, from, prefixEnd, ignoreSmoke);
  }

  const los = checkLineOfSight3D(grid, from, to);
  if (!los.clear) return false;

  if (!ignoreSmoke && from.y <= to.y && los.ray.length > 2) {
    for (let i = 1; i < los.ray.length - 1; i++) {
      const stepCoord = los.ray[i]!;
      const stepTile = grid.getTile(stepCoord);
      if (stepTile && stepTile.smokeTurns > 0 && stepCoord.y >= from.y) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Vrátí výchozí množinu prozkoumaných dlaždic na začátku 1. mise:
 * Maršál Colloredo a jeho sloužící důvěrně znají půdorys vlastního Velkopřevorského paláce (`z >= 15`)
 * a vědí, kde u břehu Čertovky kotví domluvená rybářská pramice (`x: 1..4, z: 1..3`).
 * Samotná noční Velkopřevorská zahrada (`z: 4..14`) začíná zahalena v neprozkoumané temnotě ('unexplored'),
 * dokud do ní družina nepohlédne nebo nevstoupí.
 */
export function createInitialExploredCoords(grid: GridSystem): Set<string> {
  const explored = new Set<string>();
  for (const tile of grid.getAllTiles()) {
    if (!tile.hasFloor) continue;
    const { x, y, z } = tile.coord;
    // Půdorys Velkopřevorského paláce je domácím obráncům znám
    if (z >= 15) {
      explored.add(coordKey(tile.coord));
      continue;
    }
    // Přístaviště s lucernou na rybářské pramici na Čertovce
    if (y === 0 && x >= 1 && x <= 5 && z >= 1 && z <= 4) {
      explored.add(coordKey(tile.coord));
    }
  }
  return explored;
}

/**
 * Hlavní výpočet barokní Mlhy války (Fog of War Snapshot) pro aktuální stav bojiště.
 */
export function computeFogOfWar(
  grid: GridSystem,
  units: UnitData[],
  weather: WeatherType = "rain",
  prevExploredCoords?: Set<string>,
  dynamicLights: DynamicLightSource[] = [],
): FogOfWarSnapshot {
  const visibleCoords = new Set<string>();
  const exploredCoords = new Set<string>(
    prevExploredCoords ?? createInitialExploredCoords(grid),
  );
  const unitSightRadii: Record<string, number> = {};

  const playerUnits = units.filter(
    (u) => u.faction === "player" && u.alive,
  );

  const hasGlobalReconBuff = playerUnits.some(
    (u) =>
      u.abilityBuffActive &&
      (u.ability?.id === "klementinum_verdict" ||
        u.ability?.id === "marshal_command"),
  );

  const allFloorTiles = grid.getAllTiles().filter((t) => t.hasFloor);

  // 1. Zorné pole (Line of Sight) všech živých jednotek hráče
  for (const ally of playerUnits) {
    const sightRadius = computeUnitSightRadius(grid, ally, weather, ally.pos);
    unitSightRadii[ally.id] = sightRadius;
    const ignoreSmoke =
      Boolean(ally.abilityBuffActive) &&
      ally.ability?.id === "klementinum_verdict";

    // Vždy odhalíme dlaždici, na níž jednotka stojí, a bezprostředně sousedící dlaždice na stejném patře
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const near: GridCoord = {
          x: ally.pos.x + dx,
          y: ally.pos.y,
          z: ally.pos.z + dz,
        };
        const nearTile = grid.getTile(near);
        if (nearTile && nearTile.hasFloor) {
          const k = coordKey(near);
          visibleCoords.add(k);
          exploredCoords.add(k);
        }
      }
    }

    for (const tile of allFloorTiles) {
      const k = coordKey(tile.coord);
      if (visibleCoords.has(k)) continue;

      const dist = gridDistance3D(ally.pos, tile.coord);
      if (dist > sightRadius) continue;

      if (checkFogLineOfSight3D(grid, ally.pos, tile.coord, ignoreSmoke)) {
        visibleCoords.add(k);
        exploredCoords.add(k);
      }
    }
  }

  // 2. Stálé majáky v šerosvitu: Lucerna na přídi rybářské pramice na Čertovce (x: 2..3, z: 2..3, y: 0)
  for (let z = 1; z <= 3; z++) {
    for (let x = 1; x <= 4; x++) {
      const c: GridCoord = { x, y: 0, z };
      const t = grid.getTile(c);
      if (t && t.hasFloor) {
        const k = coordKey(c);
        visibleCoords.add(k);
        exploredCoords.add(k);
      }
    }
  }

  // 3. Dynamické záblesky střelného prachu, výbuchy petard a prachových sudů (Chiaroscuro Flash Illumination)
  for (const light of dynamicLights) {
    for (const tile of allFloorTiles) {
      if (Math.abs(tile.coord.y - light.coord.y) > 1) continue;
      const dist = gridDistance3D(light.coord, tile.coord);
      if (dist <= light.radius) {
        const k = coordKey(tile.coord);
        visibleCoords.add(k);
        exploredCoords.add(k);
      }
    }
  }

  // 4. Vyhodnocení viditelných nepřátel vs. zvukových/doutnákových kontaktů ve tmě
  const visibleEnemyIds = new Set<string>();
  const soundContacts: SoundContact[] = [];

  for (const unit of units) {
    if (unit.faction !== "enemy" || !unit.alive) continue;

    const enemyKey = coordKey(unit.pos);
    const isTileVisible = visibleCoords.has(enemyKey);

    if (isTileVisible || hasGlobalReconBuff) {
      visibleEnemyIds.add(unit.id);
      exploredCoords.add(enemyKey);
      continue;
    }

    // Spočítáme vzdálenost k nejbližšímu obránci
    let minAllyDist = Infinity;
    for (const ally of playerUnits) {
      const d = gridDistance3D(ally.pos, unit.pos);
      if (d < minAllyDist) minAllyDist = d;
    }

    // Zvukový nebo světelný kontakt v nočním šerosvitu:
    // - Doutnáková mušketa ('matchlock') má žhnoucí doutnák, který ve tmě prozrazuje střelce na <= 13 polí
    // - Pohybující se nepřítel nebo těžký kyrys cinká ve tmě na <= 11 polí
    const hasGlowingMatchcord = unit.weapon.lockType === "matchlock";
    const nearDynamicFlash = dynamicLights.some(
      (l) => gridDistance3D(l.coord, unit.pos) <= l.radius + 1.5,
    );

    if (nearDynamicFlash) {
      soundContacts.push({
        unitId: unit.id,
        pos: unit.pos,
        kind: "gunfire_flash",
        label: "Záblesk pánvičky ve tmě",
        distanceToNearestAlly: Math.round(minAllyDist * 10) / 10,
      });
    } else if (hasGlowingMatchcord && minAllyDist <= 13.5) {
      soundContacts.push({
        unitId: unit.id,
        pos: unit.pos,
        kind: "matchcord_glow",
        label: "Žhnoucí doutnák v šerosvitu",
        distanceToNearestAlly: Math.round(minAllyDist * 10) / 10,
      });
    } else if (unit.movedThisTurn || minAllyDist <= 11.5) {
      soundContacts.push({
        unitId: unit.id,
        pos: unit.pos,
        kind: "footsteps",
        label: "Šramot kyrysu a kroky ve tmě",
        distanceToNearestAlly: Math.round(minAllyDist * 10) / 10,
      });
    }
  }

  return {
    visibleCoords,
    exploredCoords,
    visibleEnemyIds,
    soundContacts,
    unitSightRadii,
  };
}

/**
 * Vrátí stav viditelnosti dlaždice ('visible' | 'shrouded' | 'unexplored').
 * Pokud je přepínač `fogOfWarEnabled` vypnutý (režim taktického přehledu mapy), vrací vždy `'visible'`.
 */
export function getTileVisibility(
  coord: GridCoord,
  snapshot: FogOfWarSnapshot,
  fogOfWarEnabled = true,
): FogVisibilityState {
  if (!fogOfWarEnabled) return "visible";
  const key = coordKey(coord);
  if (snapshot.visibleCoords.has(key)) return "visible";
  if (snapshot.exploredCoords.has(key)) return "shrouded";
  return "unexplored";
}

/**
 * Spočítá náhled průzkumu pro dlaždici `candidateCoord`, na kterou hráč ukazuje myší v režimu pohybu:
 * - Kolik živých nepřátel bude z této dlaždice v přímém dohledu a dostřelu,
 * - Kolik dosud skrytých nepřátel v mlze války tento přesun nově odhalí.
 */
export function previewReconFromTile(
  grid: GridSystem,
  mover: UnitData,
  candidateCoord: GridCoord,
  allUnits: UnitData[],
  weather: WeatherType,
  currentVisibleEnemyIds: Set<string>,
): {
  sightableEnemies: number;
  newlyRevealedEnemies: number;
  newlyRevealedCount: number;
  newlyRevealedTilesCount: number;
  spottedEnemyIds: string[];
} {
  const radius = computeUnitSightRadius(grid, mover, weather, candidateCoord);
  const ignoreSmoke =
    Boolean(mover.abilityBuffActive) &&
    mover.ability?.id === "klementinum_verdict";

  let sightableEnemies = 0;
  let newlyRevealedEnemies = 0;
  const spottedEnemyIds: string[] = [];

  for (const u of allUnits) {
    if (u.faction !== "enemy" || !u.alive) continue;
    const dist = gridDistance3D(candidateCoord, u.pos);
    if (dist > Math.max(radius, mover.weapon.maxRange)) continue;

    if (
      dist <= radius &&
      checkFogLineOfSight3D(grid, candidateCoord, u.pos, ignoreSmoke)
    ) {
      sightableEnemies++;
      spottedEnemyIds.push(u.id);
      if (!currentVisibleEnemyIds.has(u.id)) {
        newlyRevealedEnemies++;
      }
    }
  }

  // Výpočet orientačního počtu nově spatřených polí při postupu na schodiště / jiné patro (ADR-0010)
  let newlyRevealedTilesCount = 0;
  if (candidateCoord.y !== mover.pos.y || Boolean(grid.getTile(candidateCoord)?.isLadder)) {
    const floorTiles = grid
      .getAllTiles()
      .filter((t) => t.hasFloor && t.coord.y === candidateCoord.y);
    for (const t of floorTiles) {
      if (
        gridDistance3D(candidateCoord, t.coord) <= radius &&
        checkFogLineOfSight3D(grid, candidateCoord, t.coord, ignoreSmoke)
      ) {
        newlyRevealedTilesCount++;
      }
    }
  }

  return {
    sightableEnemies,
    newlyRevealedEnemies,
    newlyRevealedCount: newlyRevealedEnemies,
    newlyRevealedTilesCount,
    spottedEnemyIds,
  };
}
