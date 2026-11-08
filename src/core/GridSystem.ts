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
        } else if (neighbor.obstacle === "low_wall" || neighbor.obstacle === "powder_keg") {
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
 * Vytvoří bojiště mise 1: Útěk polního maršála Colloreda z Velkopřevorského paláce.
 * Jižní část: ložnice a zadní trakt paláce (kamenná podlaha, portál s barikádou).
 * Střední část: maltézská zahrada s altánem, terasou v patře 1 a výbušnými sudy prachu.
 * Severozápadní cíp: rameno Čertovky (vodní plocha), dřevěné molo a rybářská pramice (úniková zóna).
 */
export function createInitialGrid(): GridSystem {
  const grid = new GridSystem(16, 16, 2);

  // 1. Zadní trakt Velkopřevorského paláce (x: 2..13, z: 12..15)
  for (let z = 12; z <= 15; z++) {
    for (let x = 2; x <= 13; x++) {
      const ground = grid.getTile({ x, y: 0, z });
      if (ground) ground.surface = "stone_floor";
    }
  }

  // Zdi paláce s průchodem do zahrady
  const highWallsPalace: [number, number][] = [
    [2, 12],
    [3, 12],
    [4, 12],
    [5, 12],
    [10, 12],
    [11, 12],
    [12, 12],
    [13, 12],
    [2, 13],
    [2, 14],
    [13, 13],
    [13, 14],
  ];
  for (const [x, z] of highWallsPalace) {
    grid.setObstacle({ x, y: 0, z }, "high_wall");
  }

  // Pilíře uvnitř palácové komnaty
  grid.setObstacle({ x: 5, y: 0, z: 14 }, "pillar");
  grid.setObstacle({ x: 10, y: 0, z: 14 }, "pillar");

  // Barikády z palácového nábytku v průchodu do zahrady (poloviční kryt)
  grid.setObstacle({ x: 6, y: 0, z: 12 }, "low_wall");
  grid.setObstacle({ x: 9, y: 0, z: 12 }, "low_wall");

  // 2. Maltézská zahrada a nádvoří (z: 4..11)
  const gardenWalls: [number, number][] = [
    [3, 9],
    [4, 9],
    [11, 9],
    [12, 9],
    [7, 10],
    [8, 10],
    [4, 5],
    [5, 5],
    [10, 4],
    [11, 4],
    [2, 6],
    [13, 6],
  ];
  for (const [x, z] of gardenWalls) {
    grid.setObstacle({ x, y: 0, z }, "low_wall");
  }

  // Zahradní kamenné zdi a nosné pilíře
  grid.setObstacle({ x: 4, y: 0, z: 7 }, "high_wall");
  grid.setObstacle({ x: 11, y: 0, z: 7 }, "high_wall");
  grid.setObstacle({ x: 7, y: 0, z: 7 }, "pillar");

  // VÝBUŠNÉ SUDY SE STŘELNÝM PRACHEM (Explosive Powder Kegs)
  // Poskytují poloviční kryt, ale při zasažení střelou nebo granátem mohutně explodují!
  grid.setObstacle({ x: 5, y: 0, z: 8 }, "powder_keg");
  grid.setObstacle({ x: 10, y: 0, z: 5 }, "powder_keg");

  // 3. Severozápadní cíp: Rameno Čertovky & Rybářská pramice
  // Vodní plocha Čertovky (neprůchozí hluboká voda)
  for (let z = 0; z <= 3; z++) {
    for (let x = 0; x <= 1; x++) {
      const tile = grid.getTile({ x, y: 0, z });
      if (tile) {
        tile.surface = "water";
        tile.walkable = false;
      }
    }
  }
  const extraWater = grid.getTile({ x: 2, y: 0, z: 0 });
  if (extraWater) {
    extraWater.surface = "water";
    extraWater.walkable = false;
  }
  const extraWater2 = grid.getTile({ x: 2, y: 0, z: 1 });
  if (extraWater2) {
    extraWater2.surface = "water";
    extraWater2.walkable = false;
  }

  // Dřevěné molo s rybářskou pramicí (ÚNIKOVÁ ZÓNA MARŠÁLA)
  const dockCoords: [number, number][] = [
    [1, 2],
    [2, 2],
    [2, 3],
  ];
  for (const [x, z] of dockCoords) {
    const tile = grid.getTile({ x, y: 0, z });
    if (tile) {
      tile.surface = "wood_dock";
      tile.walkable = true;
      tile.obstacle = "none";
      if (z === 2) {
        tile.isEscapeZone = true; // Záchranná loďka u mola!
      }
    }
  }

  // Zadní zahradní branka vedoucí k molu
  grid.setObstacle({ x: 3, y: 0, z: 3 }, "low_wall");

  // 4. Horní terasa / ochoz zahrady (y = 1 nad x: 6..9, z: 6..8)
  for (let z = 6; z <= 8; z++) {
    for (let x = 6; x <= 9; x++) {
      grid.setFloor({ x, y: 1, z }, true, "wood_roof");
    }
  }

  // Zábradlí terasy poskytující poloviční kryt
  for (let x = 6; x <= 9; x++) {
    grid.setDirectionalCover({ x, y: 1, z: 6 }, "N", "half");
    grid.setDirectionalCover({ x, y: 1, z: 8 }, "S", "half");
  }
  for (let z = 6; z <= 8; z++) {
    grid.setDirectionalCover({ x: 6, y: 1, z }, "W", "half");
    grid.setDirectionalCover({ x: 9, y: 1, z }, "E", "half");
  }

  // Žebříky na terasu
  grid.setLadder(6, 6);
  grid.setLadder(9, 8);

  // Počáteční kouř z černého prachu u průlomu zahrady
  grid.addSmoke({ x: 7, y: 0, z: 5 }, 0, 2);
  grid.addSmoke({ x: 10, y: 0, z: 4 }, 0, 2);

  grid.bakeCoverFromObstacles();

  return grid;
}

/**
 * Dobový arzenál třicetileté války (1618–1648):
 * kolečkové karabiny, těžké doutnákové muškety s furketou, arkebuzy a maršálova osobní pistole.
 */
export const WEAPON_CATALOG: Record<string, WeaponStats> = {
  colloredo_wheellock_pistol: {
    id: "colloredo_wheellock_pistol",
    name: "Maršálova osobní kolečková pistole",
    lockType: "wheellock",
    minDamage: 4,
    maxDamage: 7,
    critBonusDamage: 3,
    baseCritChance: 25,
    baseAccuracy: 12,
    falloffPerTile: 5,
    pointBlankRange: 4,
    optimalRange: 5,
    maxRange: 10,
    armorPierce: 1,
    armorShred: 1,
    baseMisfireChance: 3,
    supportsRestFork: false,
  },
  odowalsky_carbine: {
    id: "odowalsky_carbine",
    name: "Odowalského zrádcovská karabina",
    lockType: "wheellock",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 20,
    baseAccuracy: 12,
    falloffPerTile: 3,
    pointBlankRange: 4,
    optimalRange: 7,
    maxRange: 14,
    armorPierce: 1,
    armorShred: 1,
    baseMisfireChance: 4,
    supportsRestFork: false,
  },
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
 * Rozestavení 1. mise: Útěk hraběte Colloreda z Velkopřevorského paláce.
 * Obránci (4): Kulhající maršál v noční košili (VIP) a jeho 3 věrní služebníci.
 * Švédský přepad (4): Zrádce Odowalsky a jeho přepadový oddíl v zahradě.
 */
export function createInitialUnits(): UnitData[] {
  return [
    // 1. Vrchní polní maršál Rudolf hrabě Colloredo-Wallsee (VIP cíl eskorty)
    {
      id: "player-colloredo",
      name: "Hrabě Colloredo",
      roleTitle: "Polní maršál (V noční košili · VIP)",
      faction: "player",
      archetype: "commander",
      pos: { x: 8, y: 0, z: 14 },
      facing: "N",
      hp: 8,
      maxHp: 8,
      armor: 0, // Bez zbroje! Vyskočil rovnou z postele
      maxArmor: 0,
      ap: 2,
      maxAp: 2,
      marksmanship: 75,
      movePerAp: 3, // Těžký handicap: 7 zranění z Lützenu 1632, těžce kulhá
      weapon: WEAPON_CATALOG.colloredo_wheellock_pistol!,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      isVip: true,
      buffTitle: "Podepřen komorníkem (+2 pohyb)",
      alive: true,
    },

    // 2. Osobní komorník Martin (pomáhá maršálovi s pohybem)
    {
      id: "player-martin",
      name: "Komorník Martin",
      roleTitle: "Osobní komorník (Kolečková karabina)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 7, y: 0, z: 14 },
      facing: "N",
      hp: 7,
      maxHp: 7,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 68,
      movePerAp: 5,
      weapon: WEAPON_CATALOG.wheellock_carbine!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // 3. Mladý maltézský páže Václav (Klementinský student)
    {
      id: "player-vaclav",
      name: "Páže Václav",
      roleTitle: "Maltézský páže (Furketa & Doutnák)",
      faction: "player",
      archetype: "sniper",
      pos: { x: 9, y: 0, z: 14 },
      facing: "N",
      hp: 6,
      maxHp: 6,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 78,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.matchlock_musket_fork!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // 4. Mistr Jakub (Palácový zbrojíř a kovář)
    {
      id: "player-jakub",
      name: "Mistr Jakub",
      roleTitle: "Palácový zbrojíř (Arkebuza & Těžký kyrys)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 8, y: 0, z: 12 },
      facing: "N",
      hp: 10,
      maxHp: 10,
      armor: 3,
      maxArmor: 3,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.heavy_arquebus!,
      grenades: 2,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // Švédský přepadový oddíl Arnošta Odowalského
    // 1. Arnošt Odowalsky (Zrádce, který otevřel Strahovskou bránu)
    {
      id: "enemy-odowalsky",
      name: "Arnošt Odowalsky",
      roleTitle: "Zrádný podplukovník (Kyrys & Karabina)",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 11, y: 0, z: 4 },
      facing: "S",
      hp: 9,
      maxHp: 9,
      armor: 3,
      maxArmor: 3,
      ap: 2,
      maxAp: 2,
      marksmanship: 74,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.odowalsky_carbine!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // 2. Švédský dragoun (Královská jízda generála Königsmarcka)
    {
      id: "enemy-dragoon",
      name: "Švédský dragoun",
      roleTitle: "Předvoj z Mostecké ulice",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 4, y: 0, z: 5 },
      facing: "S",
      hp: 7,
      maxHp: 7,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 68,
      movePerAp: 5,
      weapon: WEAPON_CATALOG.wheellock_carbine!,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // 3. Královský mušketýr (střelec v zahradě)
    {
      id: "enemy-musketeer",
      name: "Královský mušketýr",
      roleTitle: "Švédský pěšák (V dešti hrozí selhání)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 7, y: 0, z: 4 },
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

    // 4. Odstřelovač na terase (patro 1)
    {
      id: "enemy-sniper-roof",
      name: "Střelec na terase",
      roleTitle: "Odstřelovač (Výšková převaha na ochozu)",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 8, y: 1, z: 7 },
      facing: "S",
      hp: 6,
      maxHp: 6,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 72,
      movePerAp: 4,
      weapon: WEAPON_CATALOG.swedish_musket!,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
  ];
}
