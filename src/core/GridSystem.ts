/**
 * Čistý TypeScript 3D mřížkový systém (/src/core/GridSystem.ts).
 * Řídí 3D souřadnice { x, y, z }, 3 výšková patra (y=0 Přízemí, y=1 Piano Nobile & Belveder, y=2 Maltézská věž),
 * kamenná přímá i točitá schodiště, směrové kryty, překážky a oblaka kouře z černého prachu.
 * Bez závislostí na Three.js a Reactu.
 */

import type {
  CardinalDir,
  CoverLevel,
  DirectionalCover,
  DoorData,
  DoorState,
  FloorLevel,
  GridCoord,
  ObstacleType,
  StairType,
  TileData,
  UnitData,
  WeaponStats,
} from "./types";

export const GRID_WIDTH = 20;
export const GRID_DEPTH = 24;
export const GRID_FLOORS = 3;

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
 * Kamenné balustrády a parapety na vyvýšených patrech:
 * - Patro 1 (y = 1): Zahradní belveder (x: 8..11, z: 8..10) a Piano Nobile Velkopřevorského paláce (x: 3..16, z: 15..22)
 * - Patro 2 (y = 2): Maltézská strážní věž a střešní ochoz konventu (x: 4..8, z: 15..17)
 */
export function getRoofParapetCover(c: GridCoord, dir: CardinalDir): CoverLevel {
  if (c.y === 1) {
    // 1. Zahradní belveder (x: 8..11, z: 8..10)
    if (c.x >= 8 && c.x <= 11 && c.z >= 8 && c.z <= 10) {
      if (c.z === 8 && dir === "N") return "half";
      if (c.z === 10 && dir === "S") return "half";
      if (c.x === 8 && dir === "W") return "half";
      if (c.x === 11 && dir === "E") return "half";
    }

    // 2. Piano Nobile a arkádový ochoz Velkopřevorského paláce (x: 3..16, z: 15..22)
    if (c.x >= 3 && c.x <= 16 && c.z >= 15 && c.z <= 22) {
      // Severní lodžie nad Sala Terrenou s výhledem do zahrady
      if (c.z === 15 && dir === "N") return "half";
      // Vnitřní arkádové zábradlí nad čestným nádvořím (Cour d'honneur x: 7..12, z: 16..18)
      if (c.x === 6 && c.z >= 16 && c.z <= 18 && dir === "E") return "half";
      if (c.x === 13 && c.z >= 16 && c.z <= 18 && dir === "W") return "half";
      if (c.z === 19 && c.x >= 7 && c.x <= 12 && dir === "N") return "half";
      // Vnější obvodové zdi a okna patra
      if (c.x === 3 && dir === "W") return "half";
      if (c.x === 16 && dir === "E") return "half";
      if (c.z === 22 && dir === "S") return "half";
    }
  }

  if (c.y === 2) {
    // 3. Maltézská strážní věž a střešní ochoz (x: 4..8, z: 15..17)
    if (c.x >= 4 && c.x <= 8 && c.z >= 15 && c.z <= 17) {
      if (c.z === 15 && dir === "N") return "half";
      if (c.z === 17 && dir === "S") return "half";
      if (c.x === 4 && dir === "W") return "half";
      if (c.x === 8 && dir === "E") return "half";
    }
  }

  return "none";
}

export class GridSystem {
  public readonly width: number;
  public readonly depth: number;
  public readonly floors: number;
  private readonly tiles: Map<string, TileData> = new Map();
  private readonly doors: Map<string, DoorData> = new Map();

  constructor(width = GRID_WIDTH, depth = GRID_DEPTH, floors = GRID_FLOORS) {
    this.width = width;
    this.depth = depth;
    this.floors = floors;
    this.initializeEmpty();
  }

  private initializeEmpty(): void {
    this.tiles.clear();
    this.doors.clear();
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
            stairType: "none",
            cover: emptyCover(),
            obstacle: "none",
            smokeTurns: 0,
            surface: isGround ? "cobble" : "wood_roof",
            damageLevel: 0,
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

  public setDoor(door: DoorData): void {
    const key = coordKey(door.coord);
    this.doors.set(key, { ...door });
    const tile = this.getTile(door.coord);
    if (tile) {
      tile.walkable = tile.hasFloor && door.state === "open" && tile.obstacle === "none";
    }
  }

  public getDoor(c: GridCoord): DoorData | undefined {
    return this.doors.get(coordKey(c));
  }

  public getAllDoors(): DoorData[] {
    return Array.from(this.doors.values());
  }

  public isDoorClosedAt(c: GridCoord): boolean {
    const door = this.getDoor(c);
    return door ? door.state === "closed" : false;
  }

  public setDoorState(c: GridCoord, state: DoorState): boolean {
    const door = this.getDoor(c);
    if (!door) return false;
    door.state = state;
    const tile = this.getTile(c);
    if (tile) {
      tile.walkable = tile.hasFloor && state === "open" && tile.obstacle === "none";
    }
    this.bakeCoverFromObstacles();
    return true;
  }

  public toggleDoor(c: GridCoord): DoorState | null {
    const door = this.getDoor(c);
    if (!door) return null;
    const nextState: DoorState = door.state === "closed" ? "open" : "closed";
    this.setDoorState(c, nextState);
    return nextState;
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
    if (obstacle === "low_wall" && c.z < 15 && c.y === 0) {
      tile.surface = "rubble";
    }
    this.bakeCoverFromObstacles();
  }

  /**
   * Dynamicky poznamená dlaždici (a případné zdivo) stopami boje:
   * - level 1: rozstřílená dlažba / opadaná štuková omítka (po dopadu kulek)
   * - level 2: ohořelá zdevastovaná ruina / kráter (po výbuchu petardy či prachového sudu)
   */
  public damageTile(c: GridCoord, level: 1 | 2): void {
    const tile = this.getTile(c);
    if (!tile || !tile.hasFloor || tile.surface === "water") return;
    const prev = tile.damageLevel ?? 0;
    const next = Math.max(prev, level) as 0 | 1 | 2;
    tile.damageLevel = next;
    if (next === 2 && tile.surface !== "wood_dock") {
      tile.surface = "scorched_ruin";
      // Pokud byla na dlaždici nízká překážka (zídka, gabion), výbuch ji rozmetá
      if (tile.obstacle === "low_wall") {
        tile.obstacle = "none";
        tile.walkable = true;
        this.bakeCoverFromObstacles();
      }
    } else if (
      next === 1 &&
      (tile.surface === "cobble" ||
        tile.surface === "stone_floor" ||
        tile.surface === "palace_carpet")
    ) {
      tile.surface = "rubble";
    }
  }

  /**
   * Vytvoří plně pochozí přímé nebo točité schodiště propojující zadaná patra (`floors`).
   * Zároveň nastaví `isLadder = true` pro plnou zpětnou kompatibilitu se stávajícími testy a AI.
   */
  public setStairs(
    x: number,
    z: number,
    floors: FloorLevel[] = [0, 1],
    stairType: StairType = "straight_stairs",
    stairDir: CardinalDir = "N",
    upperSurface?: TileData["surface"],
  ): void {
    const sorted = Array.from(new Set(floors)).sort((a, b) => a - b) as FloorLevel[];
    for (const y of sorted) {
      const tile = this.getTile({ x, y, z });
      if (!tile) continue;
      tile.hasFloor = true;
      tile.obstacle = "none";
      tile.walkable = true;
      tile.isLadder = true;
      tile.stairType = stairType;
      tile.stairDir = stairDir;
      tile.stairConnections = sorted.filter((f) => Math.abs(f - y) === 1);
      if (y > 0 && upperSurface) {
        tile.surface = upperSurface;
      }
    }
  }

  public setLadder(x: number, z: number): void {
    this.setStairs(x, z, [0, 1], "straight_stairs", "N");
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

      // Reset na výchozí krytí dlaždice (parapety na ochozech a věži, jinak žádné)
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
        if (neighbor.obstacle === "high_wall" || neighbor.obstacle === "pillar" || this.isDoorClosedAt(neighbor.coord)) {
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
 * Vytvoří rozšířené bojiště mise 1 (20 × 24, 3 patra):
 * Útěk velkopřevora a polního maršála Rudolfa hraběte Colloredo-Wallsee z Velkopřevorského paláce
 * Českého velkopřevorství řádu maltézských rytířů na Malé Straně (26. července 1648).
 *
 * Architektonická dispozice podle historických reálií (raně barokní přestavba za Colloreda, Carlo Lurago):
 * 1. Jih (z: 15..23, x: 2..17): Čtyřkřídlý Velkopřevorský palác kolem vnitřního arkádového nádvoří (Cour d'honneur):
 *    - Přízemí (y = 0): Kapitulní vestibul, západní maltézská zbrojnice, východní konventní křídlo, arkády a Sala Terrena.
 *    - 1. patro (y = 1, Piano Nobile): Rytířský sál a ložnice velkopřevora Colloreda, arkádové pavlače kolem nádvoří.
 *    - 2. patro (y = 2): Maltézská strážní věž a střešní vyhlídkový ochoz západního křídla konventu.
 * 2. Střed (z: 5..14, x: 1..18): Rozlehlá Velkopřevorská zahrada (dnešní Lennonova zeď na západě) s barokními partery,
 *    vyvýšeným Zahradním belvederem v 1. patře (x: 8..11, z: 8..10, y = 1) a 3 sudy střelného prachu.
 * 3. Sever a severozápad (z: 0..4): Mlýnská stoka Čertovka s dřevěným přístavištěm a vzdálenou rybářskou pramicí
 *    (úniková zóna na x: 2..3, z: 2).
 */
export function createInitialGrid(): GridSystem {
  const grid = new GridSystem(GRID_WIDTH, GRID_DEPTH, GRID_FLOORS);

  // ===========================================================================
  // 1. PŘÍZEMÍ VELKOPŘEVORSKÉHO PALÁCE (y = 0, x: 2..17, z: 15..23)
  // ===========================================================================
  for (let z = 15; z <= 23; z++) {
    for (let x = 2; x <= 17; x++) {
      const ground = grid.getTile({ x, y: 0, z });
      if (!ground) continue;
      const isCourtyard = x >= 7 && x <= 12 && z >= 16 && z <= 18;
      const isRoyalRunner =
        (x === 9 || x === 10) && z >= 15 && z <= 22;
      ground.surface = isRoyalRunner
        ? "palace_carpet"
        : isCourtyard
          ? "cobble"
          : "stone_floor";
      ground.damageLevel = 0;
    }
  }

  // Obvodové renesančně-barokní zdi Velkopřevorského paláce (s trojosou Sala Terrenou do zahrady)
  const highWallsPalaceP0: [number, number][] = [
    // Severní zahradní průčelí paláce (z = 15) — průchod uprostřed (x: 9..10) a boční branky
    [2, 15],
    [3, 15],
    [4, 15],
    [5, 15],
    [15, 15],
    [16, 15],
    [17, 15],
    // Západní a východní křídlo konventu (x = 2 a x = 17)
    [2, 16],
    [2, 17],
    [2, 18],
    [2, 19],
    [2, 20],
    [2, 21],
    [2, 22],
    [2, 23],
    [17, 16],
    [17, 17],
    [17, 18],
    [17, 19],
    [17, 20],
    [17, 21],
    [17, 22],
    [17, 23],
    // Jižní obvodová zeď k maltézskému kostelu Panny Marie pod řetězem (z = 23)
    [3, 23],
    [4, 23],
    [5, 23],
    [6, 23],
    [7, 23],
    [8, 23],
    [9, 23],
    [10, 23],
    [11, 23],
    [12, 23],
    [13, 23],
    [14, 23],
    [15, 23],
    [16, 23],
  ];
  for (const [x, z] of highWallsPalaceP0) {
    grid.setObstacle({ x, y: 0, z }, "high_wall");
  }

  // Toskánské arkádové pilíře lemující vnitřní nádvoří (Cour d'honneur) a Sala Terrenu
  const palacePillarsP0: [number, number][] = [
    [6, 15],
    [13, 15],
    [6, 18],
    [13, 18],
    [6, 20],
    [13, 20],
    [8, 21],
    [11, 21],
  ];
  for (const [x, z] of palacePillarsP0) {
    grid.setObstacle({ x, y: 0, z }, "pillar");
  }

  // Barikády z dubového palácového nábytku v Sala Terreně a arkádách
  const palaceLowWallsP0: [number, number][] = [
    [7, 15],
    [8, 15],
    [11, 15],
    [12, 15],
    [5, 19],
    [14, 19],
  ];
  for (const [x, z] of palaceLowWallsP0) {
    grid.setObstacle({ x, y: 0, z }, "low_wall");
  }

  // ===========================================================================
  // 2. 1. PATRO PALÁCE — PIANO NOBILE & RYTÍŘSKÝ SÁL (y = 1, x: 3..16, z: 15..22)
  // ===========================================================================
  for (let z = 15; z <= 22; z++) {
    for (let x = 3; x <= 16; x++) {
      // Otevřené nebe nad vnitřním nádvořím (x: 7..12, z: 16..18) a nad hlavním obloukem Sala Terreny (x: 9..10, z: 15)
      const isCourtyardWell = x >= 7 && x <= 12 && z >= 16 && z <= 18;
      const isSalaTerrenaArch = (x === 9 || x === 10) && z === 15;
      if (isCourtyardWell || isSalaTerrenaArch) continue;

      const isGrandCarpet =
        ((x === 9 || x === 10) && z >= 19 && z <= 22) ||
        (z === 20 && x >= 5 && x <= 14);
      grid.setFloor(
        { x, y: 1, z },
        true,
        isGrandCarpet ? "palace_carpet" : "stone_floor",
      );
    }
  }

  // Pilíře a barokní přepážky v 1. patře (Piano Nobile)
  grid.setObstacle({ x: 6, y: 1, z: 20 }, "pillar");
  grid.setObstacle({ x: 13, y: 1, z: 20 }, "pillar");
  grid.setObstacle({ x: 7, y: 1, z: 19 }, "low_wall");
  grid.setObstacle({ x: 12, y: 1, z: 19 }, "low_wall");
  grid.setObstacle({ x: 5, y: 1, z: 15 }, "low_wall");
  grid.setObstacle({ x: 14, y: 1, z: 16 }, "low_wall");

  // ===========================================================================
  // 3. 2. PATRO PALÁCE — MALTÉZSKÁ STRÁŽNÍ VĚŽ A STŘEŠNÍ OCHOZ (y = 2, x: 4..8, z: 15..17)
  // ===========================================================================
  for (let z = 15; z <= 17; z++) {
    for (let x = 4; x <= 8; x++) {
      grid.setFloor({ x, y: 2, z }, true, "stone_floor");
    }
  }
  grid.setObstacle({ x: 6, y: 2, z: 15 }, "low_wall");
  grid.setObstacle({ x: 4, y: 2, z: 16 }, "pillar");

  // ===========================================================================
  // 4. VELKOPŘEVORSKÁ ZAHRADA A BAROKNÍ PARTERY (z: 5..14, x: 1..18)
  // ===========================================================================
  // Západní ohradní zeď maltézské zahrady (dnešní Lennonova zeď) a východní zeď k Nostickému paláci
  for (const z of [6, 7, 8, 10, 11, 12, 13]) {
    grid.setObstacle({ x: 1, y: 0, z }, "high_wall");
    grid.setObstacle({ x: 18, y: 0, z }, "high_wall");
  }

  // Kamenné zahradní zídky, balustrády parteru a gabiony
  const gardenLowWalls: [number, number][] = [
    [4, 13],
    [5, 13],
    [14, 13],
    [15, 13],
    [8, 13],
    [11, 13],
    [3, 11],
    [4, 11],
    [15, 11],
    [16, 11],
    [6, 10],
    [13, 10],
    [3, 8],
    [4, 8],
    [15, 8],
    [16, 8],
    [5, 6],
    [6, 6],
    [12, 6],
    [13, 6],
    [4, 4],
    [7, 4],
    [11, 4],
    [15, 4],
  ];
  for (const [x, z] of gardenLowWalls) {
    grid.setObstacle({ x, y: 0, z }, "low_wall");
  }

  // Kamenné pilíře a zahradní stély
  const gardenPillars: [number, number][] = [
    [5, 10],
    [14, 10],
    [8, 9],
    [11, 9],
    [5, 5],
    [14, 5],
  ];
  for (const [x, z] of gardenPillars) {
    grid.setObstacle({ x, y: 0, z }, "pillar");
  }

  // VÝBUŠNÉ SUDY SE STŘELNÝM PRACHEM (Explosive Powder Kegs)
  grid.setObstacle({ x: 6, y: 0, z: 11 }, "powder_keg");
  grid.setObstacle({ x: 13, y: 0, z: 8 }, "powder_keg");
  grid.setObstacle({ x: 8, y: 0, z: 5 }, "powder_keg");

  // ===========================================================================
  // 5. ZAHRADNÍ BELVEDER / ARKÁDOVÁ TERASA V 1. PATŘE (y = 1, x: 8..11, z: 8..10)
  // ===========================================================================
  for (let z = 8; z <= 10; z++) {
    for (let x = 8; x <= 11; x++) {
      grid.setFloor({ x, y: 1, z }, true, "wood_roof");
    }
  }

  // ===========================================================================
  // 6. SCHODIŠTĚ (PŘÍMÁ BAROKNÍ A TOČITÁ VĚŽNÍ SCHODIŠTĚ MÍSTO ŽEBŘÍKŮ)
  // ===========================================================================
  // A) Dvojité čestné přímé schodiště (Grand Escalier) uvnitř Velkopřevorského paláce (P0 <-> P1)
  grid.setStairs(9, 19, [0, 1], "straight_stairs", "S", "palace_carpet");
  grid.setStairs(10, 19, [0, 1], "straight_stairs", "S", "palace_carpet");

  // B) Východní palácové přímé schodiště u zahradní arkády (P0 <-> P1)
  grid.setStairs(14, 15, [0, 1], "straight_stairs", "S", "stone_floor");

  // C) Západní palácové točité schodiště u zbrojnice (P0 <-> P1)
  grid.setStairs(4, 17, [0, 1], "spiral_stairs", "N", "stone_floor");

  // D) Věžní točité schodiště Maltézské strážní věže (propojuje P0 <-> P1 <-> P2)
  grid.setStairs(5, 16, [0, 1, 2], "spiral_stairs", "E", "stone_floor");

  // E) Střešní přímé schodiště na Maltézskou věž z Piano Nobile (P1 <-> P2)
  grid.setStairs(8, 16, [1, 2], "straight_stairs", "W", "stone_floor");

  // F) Zahradní belveder: přímé kamenné schodiště na jihu (8, 10) a točité vřetenové schodiště na severovýchodě (11, 8)
  grid.setStairs(8, 10, [0, 1], "straight_stairs", "N", "wood_roof");
  grid.setStairs(11, 8, [0, 1], "spiral_stairs", "S", "wood_roof");

  // ===========================================================================
  // 6b. OTEVÍRATELNÉ A ZAVÍRATELNÉ DVEŘE (FREE ACTIONS)
  // ===========================================================================
  // 1. Dvojkřídlá zahradní brána ze Sala Terreny do Velkopřevorské zahrady (x: 9..10, z: 15, y = 0)
  grid.setDoor({
    id: "door-salaterrena-west",
    coord: { x: 9, y: 0, z: 15 },
    state: "open",
    axis: "E_W",
    label: "Západní křídlo brány Sala Terreny",
  });
  grid.setDoor({
    id: "door-salaterrena-east",
    coord: { x: 10, y: 0, z: 15 },
    state: "open",
    axis: "E_W",
    label: "Východní křídlo brány Sala Terreny",
  });

  // 2. Dubové kované dveře západní maltézské zbrojnice (x: 4, z: 18, y = 0)
  grid.setDoor({
    id: "door-armory",
    coord: { x: 4, y: 0, z: 18 },
    state: "closed",
    axis: "N_S",
    label: "Kované dveře maltézské zbrojnice",
  });

  // 3. Dubové křídlové dveře komnaty velkopřevora v Piano Nobile (x: 10, z: 18, y = 1)
  grid.setDoor({
    id: "door-pianonobile-hall",
    coord: { x: 10, y: 1, z: 18 },
    state: "closed",
    axis: "E_W",
    label: "Vyřezávané dveře ložnice velkopřevora (P1)",
  });

  // 4. Kovaná zahradní branka v ohradní zdi zahrady (x: 1, z: 9, y = 0)
  grid.setDoor({
    id: "door-garden-west-gate",
    coord: { x: 1, y: 0, z: 9 },
    state: "closed",
    axis: "N_S",
    label: "Západní branka do Maltézské uličky",
  });

  // ===========================================================================
  // 7. MLÝNSKÁ STOKA ČERTOVKA & VZDÁLENÁ RYBÁŘSKÁ PRAMICE (z: 0..3)
  // ===========================================================================
  for (let z = 0; z <= 2; z++) {
    for (let x = 0; x <= 14; x++) {
      const tile = grid.getTile({ x, y: 0, z });
      if (tile) {
        tile.surface = "water";
        tile.walkable = false;
      }
    }
  }
  for (let x = 0; x <= 1; x++) {
    const tile = grid.getTile({ x, y: 0, z: 3 });
    if (tile) {
      tile.surface = "water";
      tile.walkable = false;
    }
  }

  // Dřevěné přístaviště na Čertovce s rybářskou pramicí (ÚNIKOVÁ ZÓNA MARŠÁLA)
  const dockCoords: [number, number][] = [
    [2, 2],
    [3, 2],
    [2, 3],
    [3, 3],
  ];
  for (const [x, z] of dockCoords) {
    const tile = grid.getTile({ x, y: 0, z });
    if (tile) {
      tile.surface = "wood_dock";
      tile.walkable = true;
      tile.obstacle = "none";
      if (z === 2) {
        tile.isEscapeZone = true; // Vzdálená záchranná loďka u břehu Čertovky!
      }
    }
  }

  grid.bakeCoverFromObstacles();

  return grid;
}

/**
 * Určí, zda se daná pozice na mřížce nachází v zastřešeném interiéru Velkopřevorského paláce
 * nebo pod klenutým loubím zahradního belvederu.
 * V těchto krytých prostorách nikdy neprší a prach/popel se v nich objeví až po zahájení střelby či výbuchů.
 */
export function isEnclosedRoofedCoord(x: number, y: number, z: number): boolean {
  // 1. Přízemí a Piano Nobile Velkopřevorského paláce mimo otevřené nádvoří (x: 7..12, z: 16..18)
  if (y <= 1 && x >= 1.5 && x <= 17.5 && z >= 14.5 && z <= 23.5) {
    const inOpenCourtyard = x >= 6.6 && x <= 12.4 && z >= 15.6 && z <= 18.4;
    if (!inOpenCourtyard) {
      return true;
    }
  }
  // 2. Přízemí pod klenbou zahradního belvederu (patro 0 kryté stropem patra 1)
  if (y < 1 && x >= 7.5 && x <= 11.5 && z >= 7.5 && z <= 10.5) {
    return true;
  }
  return false;
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
    maxRange: 14,
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
    maxRange: 16,
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
    maxRange: 16,
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
    maxRange: 18,
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
    maxRange: 15,
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
    maxRange: 15,
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
    maxRange: 16,
    armorPierce: 1,
    armorShred: 1,
    baseMisfireChance: 5,
    supportsRestFork: false,
  },
};

/**
 * Rozestavení 1. mise: Útěk hraběte Colloreda z Velkopřevorského paláce přes zahradu k Čertovce.
 * Obránci (4): Kulhající velkopřevor a polní maršál v noční košili (VIP) u paty čestného schodiště a jeho 3 věrní.
 * Švédský přepad (4): Zrádce Odowalsky a jeho přepadový oddíl ve Velkopřevorské zahradě a na belvederu.
 */
export function createInitialUnits(): UnitData[] {
  return [
    // 1. Vrchní polní maršál a velkopřevor Rudolf hrabě Colloredo-Wallsee (VIP cíl eskorty)
    {
      id: "player-colloredo",
      name: "Hrabě Colloredo",
      roleTitle: "Velkopřevor & Polní maršál (V noční košili · VIP)",
      faction: "player",
      archetype: "commander",
      pos: { x: 10, y: 0, z: 19 },
      facing: "N",
      hp: 8,
      maxHp: 8,
      armor: 0, // Bez zbroje! Vyskočil rovnou z postele v Piano Nobile
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
      detainedTurns: 0,
      captureReason: null,
      buffTitle: "Podepřen komorníkem (+2 pohyb)",
      ability: {
        id: "marshal_command",
        name: "Rozkaz polního maršála",
        subtitle: "Železná Praha (+2 AP družině & Výstřel)",
        description:
          "Maršál Colloredo tasí kord a vypálí z pistole na nejbližšího Švéda (3 HP): všichni spojenci okamžitě získají +2 AP, +1 zbroj a setřesou paniku!",
        apCost: 1,
        cooldownTurns: 3,
        currentCooldown: 0,
      },
      abilityBuffActive: false,
      alive: true,
    },

    // 2. Osobní komorník Jan Matěj (pomáhá maršálovi s pohybem po schodišti i zahradou)
    {
      id: "player-jan-matej",
      name: "Jan Matěj",
      roleTitle: "Osobní komorník (Kolečková karabina)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 9, y: 0, z: 19 },
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
      ability: {
        id: "protector_oath",
        name: "Přísaha komorníka",
        subtitle: "Věrná stráž & Dým (0 AP)",
        description:
          "Jan Matěj přiskočí k maršálovi, přehodí přes něj těžký plášť (+2 zbroj, +3 HP, vyproštění ze zadržení), zahalí jej do dýmu 3×3 a sám získá +1 zbroj a +1 AP!",
        apCost: 0,
        cooldownTurns: 2,
        currentCooldown: 0,
      },
      abilityBuffActive: false,
      alive: true,
    },

    // 3. Václav z Michalovic (Klementinský student a osobní písař velkopřevora na arkádě 1. patra)
    {
      id: "player-vaclav-michalovic",
      name: "Václav z Michalovic",
      roleTitle: "Klementinský klerik & písař (Furketa & Doutnák)",
      faction: "player",
      archetype: "sniper",
      pos: { x: 11, y: 1, z: 16 },
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
      ability: {
        id: "klementinum_verdict",
        name: "Svatováclavské soustředění",
        subtitle: "Průraz zdí & Deadeye (0 AP)",
        description:
          "Václav ukryje doutnák a nasype suchý prach: +35 % zásah, +45 % krit, +3 DMG, +2 průraz, ignoruje kryt zídek, 0 % selhání v dešti a po zásahu vrátí 1 AP!",
        apCost: 0,
        cooldownTurns: 2,
        currentCooldown: 0,
      },
      abilityBuffActive: false,
      alive: true,
    },

    // 4. Bratr Bartoloměj (Maltézský zbrojmistr v Sala Terreně u vstupu do zahrady)
    {
      id: "player-bartolomej",
      name: "Bratr Bartoloměj",
      roleTitle: "Maltézský zbrojmistr (Arkebuza & Těžký kyrys)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 10, y: 0, z: 15 },
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
      ability: {
        id: "maltese_shrapnel",
        name: "Maltézská šrapnelová salva",
        subtitle: "Pekelná bouře, Sudy & Dým (1 AP)",
        description:
          "Bratr Bartoloměj odpálí kazetový šrapnel: zasáhne všechny nepřátele v dosahu (3 HP, -2 zbroj, omráčení), odpálí sudy s prachem, vytvoří clonu dýmu a doplní si +1 granát!",
        apCost: 1,
        cooldownTurns: 2,
        currentCooldown: 0,
      },
      abilityBuffActive: false,
      alive: true,
    },

    // Švédský přepadový oddíl Arnošta Odowalského ve Velkopřevorské zahradě
    // 1. Arnošt Odowalsky (Zrádce, který otevřel Strahovskou bránu)
    {
      id: "enemy-odowalsky",
      name: "Arnošt Odowalsky",
      roleTitle: "Zrádný podplukovník (Kyrys & Karabina)",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 13, y: 0, z: 6 },
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
      pos: { x: 5, y: 0, z: 7 },
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

    // 3. Královský mušketýr (střelec v zahradním parteru)
    {
      id: "enemy-musketeer",
      name: "Královský mušketýr",
      roleTitle: "Švédský pěšák (V dešti hrozí selhání)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 9, y: 0, z: 6 },
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

    // 4. Odstřelovač na zahradním belvederu (patro 1)
    {
      id: "enemy-sniper-roof",
      name: "Střelec na belvederu",
      roleTitle: "Odstřelovač (Výšková převaha na terase)",
      faction: "enemy",
      archetype: "sectoid",
      pos: { x: 10, y: 1, z: 9 },
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

/**
 * Vytvoří posily švédského vojska generála Königsmarcka z Mostecké ulice,
 * které dorazí v 5. kole severní zahradní branou (x: 9..12, z: 4).
 */
export function createReinforcementUnits(): UnitData[] {
  return [
    {
      id: "enemy-reinforcement-dragoon",
      name: "Královský dragoun",
      roleTitle: "Königsmarckova jízda (Mostecká ulice)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 9, y: 0, z: 4 },
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
    {
      id: "enemy-reinforcement-cuirassier",
      name: "Švédský kyrysník",
      roleTitle: "Těžká jízda z Malostranského náměstí",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 12, y: 0, z: 4 },
      facing: "S",
      hp: 6,
      maxHp: 6,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
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
