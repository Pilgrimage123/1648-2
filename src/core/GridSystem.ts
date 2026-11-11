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
  MeleeWeaponStats,
  WeatherType,
} from "./types";

export const GRID_WIDTH = 24;
export const GRID_DEPTH = 28;
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
 * S vysokou prioritou vybere dlaždici v aktuálně vybraném patře (`activeFloor`: P0 / P1 / P2).
 * Jiné patro nabídne pouze tehdy, když je zcela jasné, že na dané souřadnici `[x, z]`
 * vybrané patro vůbec nemá podlahu (např. v jednopatrových místech zahrady nebo nad otevřeným dvorem).
 */
export function resolvePreferredFloorCoord(
  grid: GridSystem,
  rawCoord: GridCoord,
  activeFloor: FloorLevel,
): GridCoord {
  if (rawCoord.y === activeFloor) {
    const exact = grid.getTile(rawCoord);
    if (exact && exact.hasFloor) return rawCoord;
  }

  // 1. Nejvyšší priorita: existuje na [x, z] podlaha přímo ve vybraném patře (activeFloor)?
  const preferred: GridCoord = {
    x: rawCoord.x,
    y: activeFloor,
    z: rawCoord.z,
  };
  const preferredTile = grid.getTile(preferred);
  if (preferredTile && preferredTile.hasFloor) {
    return preferred;
  }

  // 2. Fallback pro jednopatrová místa (zahrada, otevřený dvůr): nejbližší nižší existující podlaha
  for (let f = activeFloor - 1; f >= 0; f--) {
    const candidate: GridCoord = {
      x: rawCoord.x,
      y: f as FloorLevel,
      z: rawCoord.z,
    };
    const candidateTile = grid.getTile(candidate);
    if (candidateTile && candidateTile.hasFloor) {
      return candidate;
    }
  }

  return rawCoord;
}

/**
 * Kamenné balustrády a parapety na vyvýšených patrech (24 × 28):
 * - Patro 1 (y = 1): Zahradní belveder (x: 9..14, z: 9..12) a Piano Nobile Velkopřevorského paláce (x: 3..20, z: 16..26)
 * - Patro 2 (y = 2): Maltézská strážní věž a střešní ochoz konventu (x: 4..8, z: 17..19)
 */
export function getRoofParapetCover(c: GridCoord, dir: CardinalDir): CoverLevel {
  if (c.y === 1) {
    // 1. Zahradní belveder (x: 9..14, z: 9..12)
    if (c.x >= 9 && c.x <= 14 && c.z >= 9 && c.z <= 12) {
      if (c.z === 9 && dir === "N") return "half";
      if (c.z === 12 && dir === "S") return "half";
      if (c.x === 9 && dir === "W") return "half";
      if (c.x === 14 && dir === "E") return "half";
    }

    // 2. Piano Nobile a arkádový ochoz Velkopřevorského paláce (x: 3..20, z: 16..26)
    if (c.x >= 3 && c.x <= 20 && c.z >= 16 && c.z <= 26) {
      // Severní lodžie nad Sala Terrenou s výhledem do zahrady
      if (c.z === 16 && dir === "N") return "half";
      // Vnitřní arkádové zábradlí nad čestným nádvořím (Cour d'honneur x: 10..13, z: 18..20)
      if (c.x === 9 && c.z >= 18 && c.z <= 20 && dir === "E") return "half";
      if (c.x === 14 && c.z >= 18 && c.z <= 20 && dir === "W") return "half";
      if (c.z === 21 && c.x >= 10 && c.x <= 13 && dir === "N") return "half";
      if (c.z === 17 && c.x >= 10 && c.x <= 13 && dir === "S") return "half";
      // Vnější obvodové zdi a okna patra
      if (c.x === 3 && dir === "W") return "half";
      if (c.x === 20 && dir === "E") return "half";
      if (c.z === 26 && dir === "S") return "half";
    }
  }

  if (c.y === 2) {
    // 3. Maltézská strážní věž a střešní ochoz (x: 4..8, z: 17..19)
    if (c.x >= 4 && c.x <= 8 && c.z >= 17 && c.z <= 19) {
      if (c.z === 17 && dir === "N") return "half";
      if (c.z === 19 && dir === "S") return "half";
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

  /**
   * Vrátí všechny otevřené venkovní dveře hraničící s exteriérem zahrady (ADR-0011).
   * Slouží pro výpočet přirozeného průvanového odvětrávání (Through-Draft Portal Venting).
   */
  public getOpenExteriorDoors(): DoorData[] {
    const offsets = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
    ];
    return this.getAllDoors().filter((door) => {
      if (door.state !== "open") return false;
      const c = door.coord;
      if (!isEnclosedRoofedCoord(c.x, c.y, c.z)) return true;
      return offsets.some(
        (off) => !isEnclosedRoofedCoord(c.x + off.dx, c.y, c.z + off.dz),
      );
    });
  }

  public isDoorClosedAt(c: GridCoord): boolean {
    const door = this.getDoor(c);
    return door ? door.state === "closed" : false;
  }

  public setDoorState(c: GridCoord, state: DoorState, syncPaired = true): boolean {
    const door = this.getDoor(c);
    if (!door) return false;
    door.state = state;
    const tile = this.getTile(c);
    if (tile) {
      tile.walkable = tile.hasFloor && state === "open" && tile.obstacle === "none";
    }
    if (syncPaired && door.pairedCoord) {
      const pairedDoor = this.getDoor(door.pairedCoord);
      if (pairedDoor && pairedDoor.state !== state) {
        this.setDoorState(door.pairedCoord, state, false);
      }
    }
    this.bakeCoverFromObstacles();
    return true;
  }

  public toggleDoor(c: GridCoord): DoorState | null {
    const door = this.getDoor(c);
    if (!door) return null;
    const nextState: DoorState = door.state === "closed" ? "open" : "closed";
    this.setDoorState(c, nextState, true);
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
   * Aplikuje fyziku rázové vlny exploze (ADR-0011):
   * - Epicentrum (r = 0): je expanzí horkých plynů okamžitě vyfouknuto a zbaveno dýmu (smokeTurns = 0).
   * - Obvodový prstenec (r = 1..radius): stlačí vytlačený dým a prach:
   *   - V interiéru (isEnclosedRoofedCoord): 3 tahy (nebo 4).
   *   - V exteriéru: 2 tahy (v dešti 1 tah).
   */
  public applyExplosionShockwave(
    center: GridCoord,
    radius = 1,
    weather: WeatherType = "clear",
  ): void {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c: GridCoord = {
          x: center.x + dx,
          y: center.y,
          z: center.z + dz,
        };
        const tile = this.getTile(c);
        if (!tile || !tile.hasFloor || tile.obstacle === "high_wall") continue;

        const isEpicenter = dx === 0 && dz === 0;
        if (isEpicenter) {
          tile.smokeTurns = 0;
        } else {
          const indoor = isEnclosedRoofedCoord(c.x, c.y, c.z);
          const turns = indoor ? 3 : weather === "rain" ? 1 : 2;
          tile.smokeTurns = Math.max(tile.smokeTurns, turns);
        }
      }
    }
  }

  /**
   * Na konci kola sníží zbývající trvání kouře z černého prachu (ADR-0011):
   * - Běžný úbytek o 1 tah.
   * - Průvanové odvětrávání (Through-Draft): dlaždice v dosahu <= 2 polí od otevřených venkovních dveří
   *   ztrácejí 2 tahy za kolo.
   * - Déšť (rain): venkovní dým a polétavý prach usedají dvakrát rychleji (úbytek o 2 tahy).
   */
  public decaySmoke(weather: WeatherType = "clear"): void {
    const openDoors = this.getOpenExteriorDoors();
    for (const tile of this.tiles.values()) {
      if (tile.smokeTurns <= 0) continue;
      const c = tile.coord;
      const isIndoor = isEnclosedRoofedCoord(c.x, c.y, c.z);

      // Průvanové odvětrávání otevřenými portály
      let hasDraft = false;
      for (const door of openDoors) {
        if (
          door.coord.y === c.y &&
          Math.max(Math.abs(door.coord.x - c.x), Math.abs(door.coord.z - c.z)) <= 2
        ) {
          hasDraft = true;
          break;
        }
      }

      const rainDampening = !isIndoor && weather === "rain";
      const decayAmount = hasDraft || rainDampening ? 2 : 1;
      tile.smokeTurns = Math.max(0, tile.smokeTurns - decayAmount);
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
 * Vytvoří rozšířené bojiště mise 1 (24 × 28, 3 patra):
 * Útěk velkopřevora a polního maršála Rudolfa hraběte Colloredo-Wallsee z Velkopřevorského paláce
 * Českého velkopřevorství řádu maltézských rytířů na Malé Straně (26. července 1648).
 *
 * Architektonická dispozice podle historických reálií (raně barokní přestavba za Colloreda, Carlo Lurago):
 * 1. Jih (z: 16..27, x: 2..21): Čtyřkřídlý Velkopřevorský palác s uzavřenými místnostmi s nosnými zdmi:
 *    - Přízemí (y = 0): Sala Terrena, uzavřená maltézská zbrojnice, východní konvent, čestné nádvoří (Cour d'honneur) a Monumentální císařské schodiště.
 *    - 1. patro (y = 1, Piano Nobile): Ložnice a pracovna velkopřevora Colloreda, velký Rytířský sál a arkádová lodžie nad zahradou.
 *    - 2. patro (y = 2): Maltézská strážní věž a střešní vyhlídkový ochoz západního křídla konventu.
 * 2. Střed (z: 5..15, x: 1..22): Velkopřevorská zahrada s barokními partery, Belvederem (y = 1) a 3 sudy střelného prachu.
 * 3. Sever (z: 0..4, x: 0..23): Mlýnská stoka Čertovka s dřevěným přístavištěm a rybářskou pramicí (úniková zóna maršála).
 */
export function createInitialGrid(): GridSystem {
  const grid = new GridSystem(GRID_WIDTH, GRID_DEPTH, GRID_FLOORS);

  // ===========================================================================
  // 1. PŘÍZEMÍ VELKOPŘEVORSKÉHO PALÁCE (y = 0, x: 2..21, z: 16..27)
  // ===========================================================================
  for (let z = 16; z <= 27; z++) {
    for (let x = 2; x <= 21; x++) {
      const ground = grid.getTile({ x, y: 0, z });
      if (!ground) continue;
      const isCourtyard = x >= 10 && x <= 13 && z >= 18 && z <= 20;
      const isRoyalRunner =
        (x === 11 || x === 12) && z >= 16 && z <= 26;
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
    // Severní zahradní průčelí paláce (z = 16) — monumentální dvoukřídlý portál je na x: 11..12
    // Pole [5, 16] je otevřené kryté loubí/portikus před dveřmi zbrojnice do zahrady (žádné zablokované dveře)
    [2, 16], [3, 16], [4, 16], [6, 16], [7, 16], [8, 16], [9, 16], [10, 16],
    [13, 16], [14, 16], [15, 16], [16, 16], [17, 16], [18, 16], [19, 16], [20, 16], [21, 16],
    // Západní a východní obvodové zdi paláce (x = 2 a x = 21)
    [2, 17], [2, 18], [2, 19], [2, 20], [2, 21], [2, 22], [2, 23], [2, 24], [2, 25], [2, 26], [2, 27],
    [21, 17], [21, 18], [21, 19], [21, 20], [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27],
    // Jižní obvodová zeď k maltézskému kostelu Panny Marie pod řetězem (z = 27)
    [3, 27], [4, 27], [5, 27], [6, 27], [7, 27], [8, 27], [9, 27], [10, 27],
    [11, 27], [12, 27], [13, 27], [14, 27], [15, 27], [16, 27], [17, 27], [18, 27], [19, 27], [20, 27],

    // VNITŘNÍ DĚLÍCÍ ZDI (ŽÁDNÉ DVEŘE BEZ STĚN):
    // A) Maltézská zbrojnice v západním křídle (x: 3..7, z: 17..24)
    // Severní stěna zbrojnice (z = 17) — dveře jsou na x: 5
    [3, 17], [4, 17], [6, 17], [7, 17],
    // Východní masivní zeď zbrojnice (x = 8) s vnitřním klenutým průchodem do arkád na [8, 20]
    [8, 17], [8, 18], [8, 19], [8, 21], [8, 22], [8, 23], [8, 24],
    // Jižní zeď zbrojnice (z = 25)
    [3, 25], [4, 25], [5, 25], [6, 25], [7, 25],

    // B) Východní konventní křídlo a kapitulní sál (x: 15..20, z: 17..25)
    // Západní dělící zeď konventu (x = 15) — dveře jsou na x: 15, z: 21
    [15, 17], [15, 18], [15, 19], [15, 20], [15, 22], [15, 23], [15, 24],
    // Jižní zeď konventního křídla (z = 25)
    [16, 25], [17, 25], [18, 25], [19, 25], [20, 25],
  ];
  for (const [x, z] of highWallsPalaceP0) {
    grid.setObstacle({ x, y: 0, z }, "high_wall");
  }

  // Toskánské arkádové pilíře lemující vnitřní nádvoří (Cour d'honneur) a Sala Terrenu
  // [14, 21] záměrně vynechán, aby neblokoval prostor před dveřmi konventu (průchod přes sloupy)
  const palacePillarsP0: [number, number][] = [
    [9, 17],
    [14, 17],
    [9, 19],
    [14, 19],
    [9, 21],
    [10, 25],
    [13, 25],
  ];
  for (const [x, z] of palacePillarsP0) {
    grid.setObstacle({ x, y: 0, z }, "pillar");
  }

  // Barikády z dubového palácového nábytku v Sala Terreně a arkádách (průchody mezi sloupy zachovány volné)
  const palaceLowWallsP0: [number, number][] = [
    [9, 16],
    [14, 16],
    [7, 26],
    [16, 26],
  ];
  for (const [x, z] of palaceLowWallsP0) {
    grid.setObstacle({ x, y: 0, z }, "low_wall");
  }

  // ===========================================================================
  // 2. 1. PATRO PALÁCE — PIANO NOBILE & RYTÍŘSKÝ SÁL (y = 1, x: 3..20, z: 16..26)
  // ===========================================================================
  for (let z = 16; z <= 26; z++) {
    for (let x = 3; x <= 20; x++) {
      // Otevřené nebe nad vnitřním nádvořím (x: 10..13, z: 18..20)
      const isCourtyardWell = x >= 10 && x <= 13 && z >= 18 && z <= 20;
      if (isCourtyardWell) continue;

      const isGrandCarpet =
        ((x === 11 || x === 12) && z >= 21 && z <= 26) ||
        (x >= 4 && x <= 6 && z >= 22 && z <= 24);
      grid.setFloor(
        { x, y: 1, z },
        true,
        isGrandCarpet ? "palace_carpet" : "stone_floor",
      );
    }
  }

  // Vnitřní nosné a dělící stěny v 1. patře (Piano Nobile):
  // Ložnice a pracovna maršála Colloreda (x: 3..7, z: 21..25)
  // Severní stěna ložnice (z = 21) — dvoukřídlé dveře jsou na x: 5..6
  // Východní stěna ložnice (x = 8) má klenutý průchod na [8, 23] pro plynulý úprk maršála k císařskému schodišti
  const highWallsPianoNobile: [number, number][] = [
    [3, 21], [4, 21], [7, 21],
    // Východní stěna ložnice k rytířskému vestibulu (x = 8, s průchodem na z = 23)
    [8, 21], [8, 22], [8, 24], [8, 25],
    // Jižní stěna ložnice (z = 26)
    [3, 26], [4, 26], [5, 26], [6, 26], [7, 26],
    // Východní křídlo (x = 15)
    [15, 21], [15, 22], [15, 23], [15, 24], [15, 25],
  ];
  for (const [x, z] of highWallsPianoNobile) {
    grid.setObstacle({ x, y: 1, z }, "high_wall");
  }

  // Pilíře a barokní balustrády v 1. patře (Piano Nobile) — prostorné průchody mezi sloupy ke schodišti
  grid.setObstacle({ x: 9, y: 1, z: 22 }, "pillar");
  grid.setObstacle({ x: 14, y: 1, z: 22 }, "pillar");
  grid.setObstacle({ x: 7, y: 1, z: 16 }, "low_wall");
  grid.setObstacle({ x: 16, y: 1, z: 16 }, "low_wall");

  // ===========================================================================
  // 3. 2. PATRO PALÁCE — MALTÉZSKÁ STRÁŽNÍ VĚŽ A STŘEŠNÍ OCHOZ (y = 2, x: 4..8, z: 17..19)
  // ===========================================================================
  for (let z = 17; z <= 19; z++) {
    for (let x = 4; x <= 8; x++) {
      grid.setFloor({ x, y: 2, z }, true, "stone_floor");
    }
  }
  grid.setObstacle({ x: 6, y: 2, z: 17 }, "low_wall");
  grid.setObstacle({ x: 4, y: 2, z: 18 }, "pillar");

  // ===========================================================================
  // 4. VELKOPŘEVORSKÁ ZAHRADA A BAROKNÍ PARTERY (z: 5..15, x: 1..22)
  // ===========================================================================
  // Západní ohradní zeď maltézské zahrady (dnešní Lennonova zeď) a východní zeď k Nostickému paláci
  for (const z of [6, 7, 8, 9, 11, 12, 13, 14, 15]) {
    grid.setObstacle({ x: 1, y: 0, z }, "high_wall");
  }
  for (const z of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    grid.setObstacle({ x: 22, y: 0, z }, "high_wall");
  }

  // Kamenné zahradní zídky, balustrády parteru a gabiony
  const gardenLowWalls: [number, number][] = [
    [4, 14],
    [5, 14],
    [18, 14],
    [19, 14],
    [8, 14],
    [15, 14],
    [4, 11],
    [5, 11],
    [18, 11],
    [19, 11],
    [7, 10],
    [16, 10],
    [4, 8],
    [5, 8],
    [18, 8],
    [19, 8],
    [6, 6],
    [7, 6],
    [16, 6],
    [17, 6],
    [5, 4],
    [8, 4],
    [15, 4],
    [18, 4],
  ];
  for (const [x, z] of gardenLowWalls) {
    grid.setObstacle({ x, y: 0, z }, "low_wall");
  }

  // Kamenné pilíře a zahradní sochy / stély
  const gardenPillars: [number, number][] = [
    [6, 11],
    [17, 11],
    [9, 8],
    [14, 8],
    [6, 5],
    [17, 5],
  ];
  for (const [x, z] of gardenPillars) {
    grid.setObstacle({ x, y: 0, z }, "pillar");
  }

  // VÝBUŠNÉ SUDY SE STŘELNÝM PRACHEM (Explosive Powder Kegs)
  grid.setObstacle({ x: 7, y: 0, z: 13 }, "powder_keg");
  grid.setObstacle({ x: 16, y: 0, z: 9 }, "powder_keg");
  grid.setObstacle({ x: 10, y: 0, z: 6 }, "powder_keg");

  // ===========================================================================
  // 5. ZAHRADNÍ BELVEDER / ARKÁDOVÁ TERASA V 1. PATŘE (y = 1, x: 9..14, z: 9..12)
  // ===========================================================================
  for (let z = 9; z <= 12; z++) {
    for (let x = 9; x <= 14; x++) {
      grid.setFloor({ x, y: 1, z }, true, "wood_roof");
    }
  }

  // ===========================================================================
  // 6. SCHODIŠTĚ (MONUMENTÁLNÍ CÍSAŘSKÉ SCHODIŠTĚ PŘES VÍCE POLÍ & TOČITÁ SCHODIŠTĚ)
  // ===========================================================================
  // A) Monumentální císařské vícedílné schodiště (Grand Escalier) v paláci (P0 <-> P1, x: 11..12, z: 22..24)
  // Schodiště zabírá 2 pole šířky a 3 pole hloubky, s kobercem a balustrádami (všech 6 polí plně propojeno)
  grid.setStairs(11, 22, [0, 1], "grand_stairs", "S", "palace_carpet");
  grid.setStairs(12, 22, [0, 1], "grand_stairs", "S", "palace_carpet");
  grid.setStairs(11, 23, [0, 1], "grand_stairs", "S", "palace_carpet");
  grid.setStairs(12, 23, [0, 1], "grand_stairs", "S", "palace_carpet");
  grid.setStairs(11, 24, [0, 1], "grand_stairs", "S", "palace_carpet");
  grid.setStairs(12, 24, [0, 1], "grand_stairs", "S", "palace_carpet");

  // B) Východní konventní přímé schodiště (P0 <-> P1)
  grid.setStairs(19, 18, [0, 1], "straight_stairs", "S", "stone_floor");

  // C) Západní točité schodiště maltézské zbrojnice (P0 <-> P1)
  grid.setStairs(4, 20, [0, 1], "straight_stairs", "N", "stone_floor");

  // D) Věžní točité schodiště Maltézské strážní věže (propojuje P0 <-> P1 <-> P2)
  grid.setStairs(5, 18, [0, 1, 2], "spiral_stairs", "E", "stone_floor");

  // E) Zahradní belveder: přímé schodiště na jihu (10, 12) a točité schodiště na severovýchodě (13, 9)
  grid.setStairs(10, 12, [0, 1], "straight_stairs", "N", "wood_roof");
  grid.setStairs(13, 9, [0, 1], "spiral_stairs", "S", "wood_roof");

  // ===========================================================================
  // 6b. HONOSNÉ DVOUKŘÍDLÉ A JEDNOKŘÍDLÉ DVEŘE (FREE ACTIONS)
  // VŠECHNY DVEŘE JSOU PEVNĚ ZASAZENY DO NOSNÝCH STĚN (ŽÁDNÉ DVEŘE BEZ STĚN)
  // ===========================================================================
  // 1. Honosný dvoukřídlý zahradní portál ze Sala Terreny do Velkopřevorské zahrady (x: 11..12, z: 16, y = 0)
  // Pevně zasazen mezi vysoké zdi na x: 10 a x: 13
  grid.setDoor({
    id: "door-salaterrena-west",
    coord: { x: 11, y: 0, z: 16 },
    state: "open",
    axis: "E_W",
    label: "Západní křídlo portálu Sala Terreny",
    isDoubleLeaf: true,
    pairedCoord: { x: 12, y: 0, z: 16 },
    leafRole: "left",
  });
  grid.setDoor({
    id: "door-salaterrena-east",
    coord: { x: 12, y: 0, z: 16 },
    state: "open",
    axis: "E_W",
    label: "Východní křídlo portálu Sala Terreny",
    isDoubleLeaf: true,
    pairedCoord: { x: 11, y: 0, z: 16 },
    leafRole: "right",
  });

  // 2. Honosné vyřezávané dvoukřídlé dveře komnaty velkopřevora v Piano Nobile (x: 5..6, z: 21, y = 1)
  // Pevně zasazené mezi vysoké stěny na x: 4 a x: 7
  grid.setDoor({
    id: "door-bedroom-west",
    coord: { x: 5, y: 1, z: 21 },
    state: "closed",
    axis: "E_W",
    label: "Západní křídlo dveří ložnice velkopřevora (P1)",
    isDoubleLeaf: true,
    pairedCoord: { x: 6, y: 1, z: 21 },
    leafRole: "left",
  });
  grid.setDoor({
    id: "door-bedroom-east",
    coord: { x: 6, y: 1, z: 21 },
    state: "closed",
    axis: "E_W",
    label: "Východní křídlo dveří ložnice velkopřevora (P1)",
    isDoubleLeaf: true,
    pairedCoord: { x: 5, y: 1, z: 21 },
    leafRole: "right",
  });

  // 3. Dubové kované dveře západní maltézské zbrojnice (x: 5, z: 17, y = 0)
  // Pevně zasazené v severní zdi zbrojnice mezi stěnami x: 4 a x: 6
  grid.setDoor({
    id: "door-armory",
    coord: { x: 5, y: 0, z: 17 },
    state: "closed",
    axis: "E_W",
    label: "Kované dveře maltézské zbrojnice",
  });

  // 4. Kovaná zahradní branka v ohradní zdi zahrady (x: 1, z: 10, y = 0)
  // Pevně zasazená v západní zdi zahrady mezi zdivy z: 9 a z: 11
  grid.setDoor({
    id: "door-garden-west-gate",
    coord: { x: 1, y: 0, z: 10 },
    state: "closed",
    axis: "N_S",
    label: "Západní branka do Maltézské uličky",
  });

  // 5. Dubové dveře východního konventního křídla (x: 15, z: 21, y = 0)
  // Pevně zasazené ve zdi x: 15 mezi zdivy z: 20 a z: 22
  grid.setDoor({
    id: "door-convent-east",
    coord: { x: 15, y: 0, z: 21 },
    state: "closed",
    axis: "N_S",
    label: "Dveře kapitulního sálu a knihovny",
  });

  // ===========================================================================
  // 7. MLÝNSKÁ STOKA ČERTOVKA & VZDÁLENÁ RYBÁŘSKÁ PRAMICE (z: 0..4)
  // ===========================================================================
  for (let z = 0; z <= 2; z++) {
    for (let x = 0; x <= 18; x++) {
      const tile = grid.getTile({ x, y: 0, z });
      if (tile) {
        tile.surface = "water";
        tile.walkable = false;
      }
    }
  }
  for (let x = 0; x <= 2; x++) {
    const tile = grid.getTile({ x, y: 0, z: 3 });
    if (tile) {
      tile.surface = "water";
      tile.walkable = false;
    }
  }

  // Dřevěné přístaviště na Čertovce s rybářskou pramicí (ÚNIKOVÁ ZÓNA MARŠÁLA)
  const dockCoords: [number, number][] = [
    [3, 2],
    [4, 2],
    [3, 3],
    [4, 3],
  ];
  for (const [x, z] of dockCoords) {
    const tile = grid.getTile({ x, y: 0, z });
    if (tile) {
      tile.surface = "wood_dock";
      tile.walkable = true;
      tile.obstacle = "none";
      if (z === 2) {
        tile.isEscapeZone = true; // Záchranná loďka u břehu Čertovky!
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
  // 1. Přízemí a Piano Nobile Velkopřevorského paláce mimo otevřené nádvoří (x: 10..13, z: 18..20)
  if (y <= 1 && x >= 1.5 && x <= 21.5 && z >= 15.5 && z <= 27.5) {
    const inOpenCourtyard = x >= 9.6 && x <= 13.4 && z >= 17.6 && z <= 20.4;
    if (!inOpenCourtyard) {
      return true;
    }
  }
  // 2. Přízemí pod klenbou zahradního belvederu (x: 9..14, z: 9..12)
  if (y < 1 && x >= 8.5 && x <= 14.5 && z >= 8.5 && z <= 12.5) {
    return true;
  }
  return false;
}

/** Unencumbered soldier pace. Weapon weight is subtracted via `soldierMovePerAp`. Colloredo's limp replaces this. */
export const SOLDIER_BASE_MOVE = 7;

/** Tiles per AP after the weapon's `mobilityPenalty` (base 7). */
export function soldierMovePerAp(weapon: WeaponStats): number {
  return Math.max(1, SOLDIER_BASE_MOVE - (weapon.mobilityPenalty ?? 0));
}

/** Čertovka extraction tile. First escape-zone tile in grid order, which is the west dock `(3, 0, 2)`. */
export function getMission1EscapeTile(grid: GridSystem): TileData | undefined {
  return grid.getAllTiles().find((t) => t.isEscapeZone && t.coord.y === 0);
}

/** Powder keg nearest the palace (highest `z`), used by the step-3 tutorial beacon. */
export function getMission1TutorialKeg(grid: GridSystem): TileData | undefined {
  return grid
    .getAllTiles()
    .filter((t) => t.obstacle === "powder_keg")
    .sort((a, b) => b.coord.z - a.coord.z || a.coord.x - b.coord.x)[0];
}

/**
 * In-world tutorial beacon. Steps 1–2 have none.
 * Step 3 marks a real powder keg. Step 4 marks the Čertovka escape dock.
 */
export function getMission1TutorialBeacon(
  grid: GridSystem,
  step: 1 | 2 | 3 | 4 | null,
): { coord: GridCoord; label: string; color: string } | null {
  if (step === 3) {
    const keg = getMission1TutorialKeg(grid);
    if (!keg) return null;
    return {
      coord: { ...keg.coord },
      label: "Prachový sud (Odpálit!)",
      color: "#f97316",
    };
  }
  if (step === 4) {
    const dock = getMission1EscapeTile(grid);
    if (!dock) return null;
    return {
      coord: { ...dock.coord },
      label: "Rybářská pramice (Cíl)",
      color: "#38bdf8",
    };
  }
  return null;
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
    minDamage: 6,
    maxDamage: 9,
    critBonusDamage: 4,
    critBonusMaxDamage: 5,
    baseCritChance: 15,
    baseAccuracy: 60,
    falloffPerTile: 5,
    pointBlankRange: 4,
    optimalRange: 5,
    maxRange: 14,
    armorPierce: 2,
    armorShred: 1,
    baseMisfireChance: 3,
    supportsRestFork: false,
    fireApCost: 1,
    reloadApCost: 0,
    mobilityPenalty: 0,
    overwatchMode: "full_360",
  },
  wheellock_carbine: {
    id: "wheellock_carbine",
    name: "Kolečková dragounská karabina",
    lockType: "wheellock",
    minDamage: 7,
    maxDamage: 10,
    critBonusDamage: 4,
    critBonusMaxDamage: 5,
    baseCritChance: 15,
    baseAccuracy: 62,
    falloffPerTile: 4,
    pointBlankRange: 4,
    optimalRange: 7,
    maxRange: 16,
    armorPierce: 2,
    armorShred: 1,
    baseMisfireChance: 4,
    supportsRestFork: false,
    fireApCost: 1,
    reloadApCost: 2,
    mobilityPenalty: 2,
    overwatchMode: "full_360",
  },
  matchlock_musket_fork: {
    id: "matchlock_musket_fork",
    name: "Starší těžká mušketa (s furketou)",
    lockType: "matchlock",
    minDamage: 12,
    maxDamage: 16,
    critBonusDamage: 6,
    critBonusMaxDamage: 8,
    baseCritChance: 15,
    baseAccuracy: 65,
    falloffPerTile: 3,
    pointBlankRange: 3,
    optimalRange: 10,
    maxRange: 18,
    armorPierce: 4,
    armorShred: 4,
    baseMisfireChance: 6,
    supportsRestFork: true,
    fireApCost: 2,
    allowEmergencyHipFire: true,
    hipFireAimPenalty: 35,
    reloadApCost: 4,
    mobilityPenalty: 3,
    overwatchMode: "prepared_volley_cone",
  },
  swedish_musket: {
    id: "swedish_musket",
    name: "Švédská odlehčená mušketa (M1624)",
    lockType: "matchlock",
    minDamage: 8,
    maxDamage: 12,
    critBonusDamage: 4,
    critBonusMaxDamage: 6,
    baseCritChance: 10,
    baseAccuracy: 55,
    falloffPerTile: 4,
    pointBlankRange: 4,
    optimalRange: 7,
    maxRange: 15,
    armorPierce: 2,
    armorShred: 2,
    baseMisfireChance: 6,
    supportsRestFork: false,
    fireApCost: 1,
    allowEmergencyHipFire: false,
    reloadApCost: 2,
    mobilityPenalty: 2,
    overwatchMode: "prepared_volley_cone",
  },
  // Ponecháno v katalogu pro zpětnou kompatibilitu odkazů (mapováno na parametry těžké muškety)
  heavy_arquebus: {
    id: "heavy_arquebus",
    name: "Starší těžká mušketa (s furketou)",
    lockType: "matchlock",
    minDamage: 12,
    maxDamage: 16,
    critBonusDamage: 6,
    critBonusMaxDamage: 8,
    baseCritChance: 15,
    baseAccuracy: 65,
    falloffPerTile: 3,
    pointBlankRange: 3,
    optimalRange: 10,
    maxRange: 18,
    armorPierce: 4,
    armorShred: 4,
    baseMisfireChance: 6,
    supportsRestFork: true,
    fireApCost: 2,
    allowEmergencyHipFire: true,
    hipFireAimPenalty: 35,
    reloadApCost: 4,
    mobilityPenalty: 3,
    overwatchMode: "prepared_volley_cone",
  },
};

/**
 * Dobové chladné zbraně a údery pažbou pro boj zblízka (17. století):
 * úder těžkou pažbou španělské muškety, úder pažbou švédské muškety, lovecký tesák a pažba vybité bambitky.
 */
export const MELEE_CATALOG: Record<string, MeleeWeaponStats> = {
  colloredo_pistol_butt: {
    id: "colloredo_pistol_butt",
    name: "Pažba vybité bambitky",
    kind: "pistol_butt",
    minDamage: 1,
    maxDamage: 2,
    critBonusDamage: 1,
    baseCritChance: 5,
    baseAccuracy: 60,
    armorPierce: 0,
    armorShred: 0,
    description:
      "Hrabě v noční košili nemá meč. Zoufale se brání úderem těžké ořechové pažby své vystřelené pistole (minimální poškození proti kyrysu).",
  },
  heavy_musket_butt: {
    id: "heavy_musket_butt",
    name: "Úder pažbou těžké muškety",
    kind: "musket_butt",
    minDamage: 6,
    maxDamage: 8,
    critBonusDamage: 3,
    baseCritChance: 15,
    baseAccuracy: 78,
    armorPierce: 1,
    armorShred: 1,
    stunChance: 25,
    spillsReloadOnStrike: true,
    description:
      "Osmikilová španělská mušketa otočená jako těžký okovaný kyj (6–8 HP, 25 % šance na otřesení cíle, vysype případné rozpracované nabíjení).",
  },
  swedish_musket_butt: {
    id: "swedish_musket_butt",
    name: "Úder pažbou švédské muškety",
    kind: "musket_butt",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 10,
    baseAccuracy: 82,
    armorPierce: 1,
    armorShred: 0,
    stunChance: 0,
    spillsReloadOnStrike: false,
    description:
      "Spolehlivý nouzový úder okovanou pažbou švédské odlehčené muškety M1624 na blízko (4–6 HP).",
  },
  valet_cleaver: {
    id: "valet_cleaver",
    name: "Lovecký tesák komorníka",
    kind: "dagger",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 15,
    baseAccuracy: 85,
    armorPierce: 1,
    armorShred: 1,
    description:
      "Ostrý lovecký tesák na černou zvěř, kterým Jan Matěj dokáže probodnout slabiny nepřátelského kyrysu.",
  },
  cleric_dagger: {
    id: "cleric_dagger",
    name: "Úder pažbou švédské muškety",
    kind: "musket_butt",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 10,
    baseAccuracy: 82,
    armorPierce: 1,
    armorShred: 0,
    description:
      "Spolehlivý nouzový úder pažbou odlehčené muškety klementinského studenta Václava z Michalovic (4–6 HP).",
  },
  maltese_broadsword: {
    id: "maltese_broadsword",
    name: "Maltézský válečný meč & kord",
    kind: "sword",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 3,
    baseCritChance: 20,
    baseAccuracy: 85,
    armorPierce: 1,
    armorShred: 1,
    description:
      "Těžká kovaná sečná čepel ukovaná v maltézské zbrojnici.",
  },
  swedish_dagger: {
    id: "swedish_dagger",
    name: "Úder pažbou švédské muškety",
    kind: "musket_butt",
    minDamage: 4,
    maxDamage: 6,
    critBonusDamage: 2,
    baseCritChance: 10,
    baseAccuracy: 82,
    armorPierce: 1,
    armorShred: 0,
    description:
      "Nouzový úder pažbou odlehčené švédské muškety M1624 v boji tělo na tělo (4–6 HP).",
  },
};

/**
 * Rozestavení 1. mise: Útěk hraběte Colloreda z Velkopřevorského paláce přes zahradu k Čertovce.
 * Obránci (4):
 * - Hrabě Colloredo (VIP v noční košili, jednoranná kolečková pistole)
 * - Jan Matěj (Osobní komorník, kolečková karabina)
 * - Václav z Michalovic (Klementinský student na arkádě 1. patra, Švédská odlehčená mušketa M1624)
 * - Bratr Bartoloměj (Maltézský zbrojmistr v Sala Terreně, Starší těžká mušketa s furketou — má k ní sentimentální vztah)
 * Švédský přepad (4): Mušketýři pod velením Arnošta Odowalského se Švédskými odlehčenými mušketami M1624.
 */
export function createInitialUnits(): UnitData[] {
  return [
    // 1. Vrchní polní maršál a velkopřevor Rudolf hrabě Colloredo-Wallsee (VIP cíl eskorty)
    // Začíná v soukromé ložnici v 1. patře (Piano Nobile) v noční košili, nikoliv pod schody!
    {
      id: "player-colloredo",
      name: "Hrabě Colloredo",
      roleTitle: "Velkopřevor & Polní maršál (V noční košili · VIP)",
      faction: "player",
      archetype: "commander",
      pos: { x: 5, y: 1, z: 23 },
      facing: "N",
      hp: 14,
      maxHp: 14,
      armor: 0, // Bez zbroje! Vyskočil rovnou z postele v Piano Nobile
      maxArmor: 0,
      ap: 2,
      maxAp: 2,
      marksmanship: 72,
      movePerAp: 3, // Těžký handicap: 7 zranění z Lützenu 1632, těžce kulhá
      weapon: WEAPON_CATALOG.colloredo_wheellock_pistol!,
      meleeWeapon: MELEE_CATALOG.colloredo_pistol_butt!,
      pistolLoaded: true, // Má pouze 1 výstřel z postele, nelze v boji znovu nabít!
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      isVip: true,
      detainedTurns: 0,
      captureReason: null,
      buffTitle: "Těžké kulhání (zranění z Lützenu)",
      ability: undefined,
      abilityBuffActive: false,
      alive: true,
    },

    // 2. Osobní komorník Jan Matěj (pomáhá maršálovi s úprkem z ložnice po monumentálním schodišti)
    {
      id: "player-jan-matej",
      name: "Jan Matěj",
      roleTitle: "Osobní komorník (Kolečková karabina)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 6, y: 1, z: 22 },
      facing: "N",
      hp: 14,
      maxHp: 14,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 68,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.wheellock_carbine!),
      weapon: WEAPON_CATALOG.wheellock_carbine!,
      meleeWeapon: MELEE_CATALOG.valet_cleaver!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      ability: undefined,
      abilityBuffActive: false,
      alive: true,
    },

    // 3. Václav z Michalovic (Klementinský student a písař na severní lodžii 1. patra — Švédská odlehčená mušketa M1624)
    {
      id: "player-vaclav-michalovic",
      name: "Václav z Michalovic",
      roleTitle: "Klementinský mušketýr & písař (Odlehčená mušketa M1624)",
      faction: "player",
      archetype: "sniper",
      pos: { x: 14, y: 1, z: 16 },
      facing: "N",
      hp: 12,
      maxHp: 12,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 78,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      ability: undefined,
      abilityBuffActive: false,
      alive: true,
    },

    // 4. Bratr Bartoloměj (Maltézský zbrojmistr v Sala Terreně u dvoukřídlého portálu — Starší těžká mušketa s furketou)
    {
      id: "player-bartolomej",
      name: "Bratr Bartoloměj",
      roleTitle: "Maltézský zbrojmistr (Starší těžká mušketa s furketou)",
      faction: "player",
      archetype: "ranger",
      pos: { x: 11, y: 0, z: 17 },
      facing: "N",
      hp: 16,
      maxHp: 16,
      armor: 3,
      maxArmor: 3,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.matchlock_musket_fork!),
      weapon: WEAPON_CATALOG.matchlock_musket_fork!,
      meleeWeapon: MELEE_CATALOG.heavy_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 2,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      ability: undefined,
      abilityBuffActive: false,
      alive: true,
    },

    // Švédský přepadový oddíl mušketýrů ve Velkopřevorské zahradě (všichni nesou Švédské odlehčené muškety Model 1624)
    // 1. Arnošt Odowalsky (Velitel švédských mušketýrů)
    {
      id: "enemy-odowalsky",
      name: "Arnošt Odowalsky",
      roleTitle: "Velitel švédských mušketýrů (Odlehčená mušketa M1624)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 14, y: 0, z: 7 },
      facing: "S",
      hp: 15,
      maxHp: 15,
      armor: 2,
      maxArmor: 2,
      ap: 2,
      maxAp: 2,
      marksmanship: 72,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // 2. Švédský mušketýr (zahradní hlídka)
    {
      id: "enemy-garden-musketeer",
      name: "Švédský mušketýr",
      roleTitle: "Mušketýrská hlídka (Odlehčená mušketa M1624)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 6, y: 0, z: 8 },
      facing: "S",
      hp: 12,
      maxHp: 12,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
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
      roleTitle: "Švédský mušketýr (Odlehčená mušketa M1624)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 11, y: 0, z: 7 },
      facing: "S",
      hp: 12,
      maxHp: 12,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },

    // 4. Mušketýr na belvederu (patro 1)
    {
      id: "enemy-sniper-roof",
      name: "Mušketýr na belvederu",
      roleTitle: "Švédský mušketýr (Odlehčená mušketa M1624 · Belveder)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 12, y: 1, z: 10 },
      facing: "S",
      hp: 12,
      maxHp: 12,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 68,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
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
 * které dorazí v 5. kole severní zahradní branou (x: 11..14, z: 5).
 * Všichni nepřátelé jsou mušketýři se Švédskými odlehčenými mušketami M1624.
 */
export function createReinforcementUnits(): UnitData[] {
  return [
    {
      id: "enemy-reinforcement-vanguard",
      name: "Předsunutý mušketýr",
      roleTitle: "Königsmarckův mušketýr (Odlehčená mušketa M1624)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 11, y: 0, z: 5 },
      facing: "S",
      hp: 12,
      maxHp: 12,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 66,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 0,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
    {
      id: "enemy-reinforcement-reserve",
      name: "Záložní mušketýr",
      roleTitle: "Švédský mušketýr (Odlehčená mušketa M1624)",
      faction: "enemy",
      archetype: "trooper",
      pos: { x: 14, y: 0, z: 5 },
      facing: "S",
      hp: 12,
      maxHp: 12,
      armor: 1,
      maxArmor: 1,
      ap: 2,
      maxAp: 2,
      marksmanship: 65,
      movePerAp: soldierMovePerAp(WEAPON_CATALOG.swedish_musket!),
      weapon: WEAPON_CATALOG.swedish_musket!,
      meleeWeapon: MELEE_CATALOG.swedish_musket_butt!,
      firearmLoaded: true,
      reloadProgress: 0,
      grenades: 1,
      isOverwatch: false,
      movedThisTurn: false,
      isShaken: false,
      alive: true,
    },
  ];
}
