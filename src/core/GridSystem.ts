/**
 * Čistý TypeScript 3D mřížkový systém (/src/core/GridSystem.ts).
 * Řídí 3D souřadnice { x, y, z }, patra (y=0, y=1), žebříky, směrové kryty,
 * překážky a oblaka kouře z černého prachu. Bez závislostí na Three.js a Reactu.
 */

import type {
  CardinalDir,
  CoverLevel,
  DirectionalCover,
  FloorLevel,
  GridCoord,
  ObstacleType,
  TileData,
  UnitData,
  WeaponStats,
} from "./types";

export const GRID_WIDTH = 16;
export const GRID_DEPTH = 16;
export const GRID_FLOORS = 2;

export const CARDINAL_OFFSETS: Record<CardinalDir, { dx: number; dz: number }> = {
  N: { dx: 0, dz: -1 },
  E: { dx: 1, dz: 0 },
  S: { dx: 0, dz: 1 },
  W: { dx: -1, dz: 0 },
};

export function coordKey(c: GridCoord): string {
  return `${c.x},${c.y},${c.z}`;
}

export function sameCoord(a: GridCoord, b: GridCoord): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function emptyCover(): DirectionalCover {
  return { N: "none", E: "none", S: "none", W: "none" };
}

export function maxCoverLevel(a: CoverLevel, b: CoverLevel): CoverLevel {
  const rank: Record<CoverLevel, number> = { none: 0, half: 1, full: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export function bestTileCover(cover: DirectionalCover): CoverLevel {
  let best: CoverLevel = "none";
  for (const dir of ["N", "E", "S", "W"] as CardinalDir[]) {
    best = maxCoverLevel(best, cover[dir]);
  }
  return best;
}

/**
 * Parapety a zábradlí na střešním ochozu (patro 1).
 */
export function getRoofParapetCover(c: GridCoord, dir: CardinalDir): CoverLevel {
  if (c.y !== 1) return "none";
  if (c.x >= 5 && c.x <= 10 && c.z === 6 && dir === "N") return "half";
  if (c.x >= 5 && c.x <= 10 && c.z === 9 && dir === "S") return "half";
  if (c.z >= 6 && c.z <= 9 && c.x === 5 && dir === "W") return "half";
  if (c.z >= 6 && c.z <= 9 && c.x === 10 && dir === "E") return "half";
  return "none";
}

export class GridSystem {
  public readonly width: number;
  public readonly depth: number;
  public readonly floors: number;
  private readonly tiles: Map<string, TileData> = new Map();

  constructor(width = GRID_WIDTH, depth = GRID_DEPTH, floors = GRID_FLOORS) {
    this.width = width;
    this.depth = depth;
    this.floors = floors;
    this.initializeEmpty();
  }

  private initializeEmpty(): void {
    this.tiles.clear();
    for (let y = 0; y < this.floors; y++) {
      const floor = y as FloorLevel;
      for (let z = 0; z < this.depth; z++) {
        for (let x = 0; x < this.width; x++) {
          const coord: GridCoord = { x, y: floor, z };
          const isGround = floor === 0;
          this.tiles.set(coordKey(coord), {
            coord,
            walkable: isGround,
            hasFloor: isGround,
            isLadder: false,
            cover: emptyCover(),
            obstacle: "none",
            smokeTurns: 0,
            surface: isGround ? "cobble" : "wood_roof",
          });
        }
      }
    }
  }

  public inBounds(c: GridCoord): boolean {
    return (
      c.x >= 0 &&
      c.x < this.width &&
      c.z >= 0 &&
      c.z < this.depth &&
      c.y >= 0 &&
      c.y < this.floors
    );
  }

  public getTile(c: GridCoord): TileData | undefined {
    if (!this.inBounds(c)) return undefined;
    return this.tiles.get(coordKey(c));
  }

  public getAllTiles(): TileData[] {
    return Array.from(this.tiles.values());
  }

  public getFloorTiles(floor: FloorLevel): TileData[] {
    return this.getAllTiles().filter((t) => t.coord.y === floor && t.hasFloor);
  }

  public getSmokeTiles(): TileData[] {
    return this.getAllTiles().filter((t) => t.hasFloor && t.smokeTurns > 0);
  }

  public setFloor(
    c: GridCoord,
    hasFloor: boolean,
    surface: TileData["surface"] = "wood_roof",
  ): void {
    const tile = this.getTile(c);
    if (!tile) return;
    tile.hasFloor = hasFloor;
    tile.walkable = hasFloor && tile.obstacle === "none";
    tile.surface = surface;
  }

  public setObstacle(c: GridCoord, obstacle: ObstacleType): void {
    const tile = this.getTile(c);
    if (!tile) return;
    tile.obstacle = obstacle;
    tile.walkable = tile.hasFloor && obstacle === "none";
    if (obstacle === "low_wall") {
      tile.surface = "rubble";
    }
  }

  public setLadder(x: number, z: number): void {
    for (const y of [0, 1] as FloorLevel[]) {
      const tile = this.getTile({ x, y, z });
      if (!tile) continue;
      tile.hasFloor = true;
      tile.obstacle = "none";
      tile.walkable = true;
      tile.isLadder = true;
    }
  }

  public setDirectionalCover(
    c: GridCoord,
    dir: CardinalDir,
    level: CoverLevel,
  ): void {
    const tile = this.getTile(c);
    if (!tile) return;
    tile.cover[dir] = maxCoverLevel(tile.cover[dir], level);
  }

  /**
   * Přidá oblak kouře z černého prachu na zadanou dlaždici (příp. okolí).
   */
  public addSmoke(center: GridCoord, radius = 0, turns = 2): void {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c: GridCoord = {
          x: center.x + dx,
          y: center.y,
          z: center.z + dz,
        };
        const tile = this.getTile(c);
        if (tile && tile.hasFloor && tile.obstacle !== "high_wall") {
          tile.smokeTurns = Math.max(tile.smokeTurns, turns);
        }
      }
    }
  }

  /**
   * Na konci kola sníží zbývající trvání kouře z černého prachu o 1.
   */
  public decaySmoke(): void {
    for (const tile of this.tiles.values()) {
      if (tile.smokeTurns > 0) {
        tile.smokeTurns = Math.max(0, tile.smokeTurns - 1);
      }
    }
  }

  /**
   * Přepočítá směrové krytí pro všechny pochozí dlaždice podle sousedních překážek
   * (`low_wall` => `'half'`, `high_wall` | `pillar` => `'full'`), se zachováním střešních parapetů.
   * Spolehlivě odstraní kryt, pokud byl objekt v průběhu boje zničen (např. granátem).
   */
  public bakeCoverFromObstacles(): void {
    for (const tile of this.tiles.values()) {
      if (!tile.hasFloor || !tile.walkable) {
        tile.cover = emptyCover();
        continue;
      }

      // Reset na výchozí krytí dlaždice (parapety na střeše, jinak žádné)
      tile.cover = {
        N: getRoofParapetCover(tile.coord, "N"),
        E: getRoofParapetCover(tile.coord, "E"),
        S: getRoofParapetCover(tile.coord, "S"),
        W: getRoofParapetCover(tile.coord, "W"),
      };

      for (const dir of ["N", "E", "S", "W"] as CardinalDir[]) {
        const { dx, dz } = CARDINAL_OFFSETS[dir];
        const neighbor = this.getTile({
          x: tile.coord.x + dx,
          y: tile.coord.y,
          z: tile.coord.z + dz,
        });
        if (!neighbor) continue;
        if (neighbor.obstacle === "high_wall" || neighbor.obstacle === "pillar") {
          tile.cover[dir] = maxCoverLevel(tile.cover[dir], "full");
        } else if (neighbor.obstacle === "low_wall") {
          tile.cover[dir] = maxCoverLevel(tile.cover[dir], "half");
        }
      }
    }
  }

  public isBlockedByUnit(
    c: GridCoord,
    units: UnitData[],
    ignoreUnitId?: string,
  ): boolean {
    return units.some(
      (u) => u.alive && u.id !== ignoreUnitId && sameCoord(u.pos, c),
    );
  }
}

/**
 * Vytvoří 16x16 dvoupodlažní bojiště na Malé Straně s rozbořeným domem uprostřed,
 * gabiony/zídkami (poloviční kryt), kamennými zdmi (plný kryt) a 2 žebříky do patra y=1.
 */
export function createInitialGrid(): GridSystem {
  const grid = new GridSystem(16, 16, 2);

  // 1. Půdorys rozbořeného dvoupodlažního domu (x: 4..11, z: 5..10)
  for (let z = 5; z <= 10; z++) {
    for (let x = 4; x <= 11; x++) {
      const ground = grid.getTile({ x, y: 0, z });
      if (ground) ground.surface = "stone_floor";
    }
  }

  // Vysoké kamenné zdi v přízemí (plný kryt -40 % a blokování LoS)
  const highWallsGround: [number, number][] = [
    [4, 5],
    [5, 5],
    [6, 5],
    [9, 5],
    [10, 5],
    [11, 5],
    [4, 10],
    [6, 10],
    [9, 10],
    [11, 10],
    [4, 6],
    [4, 8],
    [11, 7],
    [11, 9],
  ];
  for (const [x, z] of highWallsGround) {
    grid.setObstacle({ x, y: 0, z }, "high_wall");
  }

  // Nosné pilíře uvnitř domu
  const pillarsGround: [number, number][] = [
    [6, 7],
    [9, 7],
    [6, 8],
    [9, 8],
  ];
  for (const [x, z] of pillarsGround) {
    grid.setObstacle({ x, y: 0, z }, "pillar");
  }

  // Nízké zídky, gabiony a převržené vozy (poloviční kryt -20 %)
  const lowWallsGround: [number, number][] = [
    [5, 10],
    [10, 10],
    [4, 7],
    [11, 8],
    [3, 12],
    [4, 12],
    [7, 12],
    [8, 12],
    [11, 12],
    [12, 12],
    [3, 3],
    [4, 3],
    [7, 3],
    [8, 3],
    [11, 3],
    [12, 3],
    [2, 7],
    [2, 8],
    [13, 7],
    [13, 8],
  ];
  for (const [x, z] of lowWallsGround) {
    grid.setObstacle({ x, y: 0, z }, "low_wall");
  }

  // Rohové pilíře v ulicích
  grid.setObstacle({ x: 2, y: 0, z: 4 }, "pillar");
  grid.setObstacle({ x: 13, y: 0, z: 4 }, "pillar");
  grid.setObstacle({ x: 2, y: 0, z: 11 }, "pillar");
  grid.setObstacle({ x: 13, y: 0, z: 11 }, "pillar");

  // 2. Horní patro / střešní ochoz (y = 1) nad středovou budovou (x: 5..10, z: 6..9)
  for (let z = 6; z <= 9; z++) {
    for (let x = 5; x <= 10; x++) {
      grid.setFloor({ x, y: 1, z }, true, "wood_roof");
    }
  }

  grid.setObstacle({ x: 7, y: 1, z: 7 }, "pillar");
  grid.setObstacle({ x: 8, y: 1, z: 8 }, "low_wall");

  // Zábradlí / parapet na okraji střechy (poskytuje poloviční kryt -20 %)
  for (let x = 5; x <= 10; x++) {
    grid.setDirectionalCover({ x, y: 1, z: 6 }, "N", "half");
    grid.setDirectionalCover({ x, y: 1, z: 9 }, "S", "half");
  }
  for (let z = 6; z <= 9; z++) {
    grid.setDirectionalCover({ x: 5, y: 1, z }, "W", "half");
    grid.setDirectionalCover({ x: 10, y: 1, z }, "E", "half");
  }

  // 3. Dva žebříky propojující přízemí (y=0) a střechu (y=1)
  grid.setLadder(5, 9);
  grid.setLadder(10, 6);

  // Počáteční oblak kouře z černého prachu u průlomu domu pro okamžitou ukázku modifikátoru
  grid.addSmoke({ x: 7, y: 0, z: 9 }, 0, 2);
  grid.addSmoke({ x: 8, y: 0, z: 5 }, 0, 2);

  grid.bakeCoverFromObstacles();

  return grid;
}

/**
 * Dobový arzenál třicetileté války (1618–1648):
 * kolečkové karabiny, těžké doutnákové muškety s furketou, arkebuzy a švédské muškety.
 */
export const WEAPON_CATALOG: Record<string, WeaponStats> = {
  wheellock_carbine: {
    id: "wheellock_carbine",
    name: "Kolečková dragounská karabina",
    lockType: "wheellock",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 15,
    baseAccuracy: 10,
    falloffPerTile: 4,
    pointBlankRange: 4,
    optimalRange: 6,
    maxRange: 13,
    armorPierce: 1,
    armorShred: 1,
    baseMisfireChance: 4,
    supportsRestFork: false,
  },
  matchlock_musket_fork: {
    id: "matchlock_musket_fork",
    name: "Těžká doutnáková mušketa s furketou",
    lockType: "matchlock",
    minDamage: 5,
    maxDamage: 8,
    critBonusDamage: 3,
    baseCritChance: 20,
    baseAccuracy: 15,
    falloffPerTile: 3,
    pointBlankRange: 3,
    optimalRange: 9,
    maxRange: 16,
    armorPierce: 2,
    armorShred: 1,
    baseMisfireChance: 9,
    supportsRestFork: true,
  },
  heavy_arquebus: {
    id: "heavy_arquebus",
    name: "Zákopová arkebuza & petarda",
    lockType: "matchlock",
    minDamage: 4,
    maxDamage: 7,
    critBonusDamage: 3,
    baseCritChance: 15,
    baseAccuracy: 8,
    falloffPerTile: 5,
    pointBlankRange: 4,
    optimalRange: 5,
    maxRange: 12,
    armorPierce: 1,
    armorShred: 2,
    baseMisfireChance: 8,
    supportsRestFork: true,
  },
  swedish_musket: {
    id: "swedish_musket",
    name: "Švédská doutnáková mušketa",
    lockType: "matchlock",
    minDamage: 3,
    maxDamage: 5,
    critBonusDamage: 2,
    baseCritChance: 10,
    baseAccuracy: 5,
    falloffPerTile: 4,
    pointBlankRange: 3,
    optimalRange: 6,
    maxRange: 13,
    armorPierce: 1,
    armorShred: 1,
    baseMisfireChance: 9,
    supportsRestFork: true,
  },
  officer_wheellock: {
    id: "officer_wheellock",
    name: "Důstojnická kolečková arkebuza",
    lockType: "wheellock",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 15,
    baseAccuracy: 10,
    falloffPerTile: 3,
    pointBlankRange: 4,
    optimalRange: 7,
    maxRange: 14,
    armorPierce: 1,
    armorShred: 1,
    baseMisfireChance: 5,
    supportsRestFork: false,
  },
};

/**
 * Výchozí rozestavení: 3 císařští obránci na jižním okraji a 4 švédští vojáci
 * (předsunutí tak, aby byli ihned v dostřelu a šlo okamžitě testovat Target Ribbon a Breakdown Wings).
 */
export function createInitialUnits(): UnitData[] {
  return [
    // Hráčova družina (Jižní okraj / barikáda)
    {
      id: "player-martin",
      name: "Martin",
      roleTitle: "Císařský dragoun (Kolečková karabina)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 4, y: 0, z: 11 },
      facing: "N",
      hp: 8,
      maxHp: 8,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 70,
      movePerAp: 5,
      weapon: WEAPON_CATALOG.wheellock_carbine!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
    {
      id: "player-vaclav",
      name: "Václav",
      roleTitle: "Mušketýr z Klementina (Furketa)",
      faction: "player",
      archetype: "sniper",
      pos: { x: 7, y: 0, z: 11 },
      facing: "N",
      hp: 6,
      maxHp: 6,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 75,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.matchlock_musket_fork!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
    {
      id: "player-jakub",
      name: "Mistr Jakub",
      roleTitle: "Malostranský kovář (Arkebuza & Kyrys)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 10, y: 0, z: 11 },
      facing: "N",
      hp: 10,
      maxHp: 10,
      armor: 3,
      maxArmor: 3,
      ap: 2,
      maxAp: 2,
      marksmanship: 66,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.heavy_arquebus!,
      grenades: 2,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // Švédská hlídka (4 nepřátelé v různých taktických situacích: v krytu, nekrytý/flanked, na střeše a v dálce)
    {
      id: "enemy-trooper-1",
      name: "Švédský mušketýr I",
      roleTitle: "Královská pěchota (Za gabionem)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 3, y: 0, z: 4 },
      facing: "S",
      hp: 6,
      maxHp: 6,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.swedish_musket!,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
    {
      id: "enemy-trooper-2",
      name: "Švédský pikenýr-střelec",
      roleTitle: "Předvoj v průlomu (Nekrytý / Flanked)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 7, y: 0, z: 8 },
      facing: "S",
      hp: 7,
      maxHp: 7,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.swedish_musket!,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
    {
      id: "enemy-sectoid-roof",
      name: "Švédský granátník",
      roleTitle: "Střelec na ochozu (Patro 1)",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 8, y: 1, z: 9 },
      facing: "S",
      hp: 7,
      maxHp: 7,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 70,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.officer_wheellock!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
    {
      id: "enemy-sectoid-hall",
      name: "Švédský hejtman",
      roleTitle: "Velitel v těžkém kyrysu",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 11, y: 0, z: 3 },
      facing: "S",
      hp: 9,
      maxHp: 9,
      armor: 3,
      maxArmor: 3,
      ap: 2,
      maxAp: 2,
      marksmanship: 72,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.officer_wheellock!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
  ];
}
