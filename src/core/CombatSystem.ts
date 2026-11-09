/**
 * Čistý TypeScript modul pro výpočet 3D Bresenhamovy přímé viditelnosti (LoS),
 * kompletního rozpisu šancí na zásah ve stylu XCOM 2 adaptovaného na 17. století
 * (ShotCalculationResult, StatModifier) a taktické AI (/src/core/CombatSystem.ts).
 * Striktně bez importů Three.js nebo Reactu.
 */

import { bestTileCover, GridSystem, sameCoord } from "./GridSystem";
import { computeReachableTiles, findPathAStar } from "./Pathfinding";
import type {
  AttackOutcome,
  CardinalDir,
  CoverLevel,
  FloorLevel,
  GridCoord,
  ShotCalculationResult,
  StatModifier,
  TargetEvaluation,
  TargetRibbonCategory,
  UnitData,
  WeaponStats,
  WeatherType,
} from "./types";

/**
 * Kontext bojiště předávaný do výpočtu střelby (CombatCalculator).
 */
export interface BattlefieldState {
  grid: GridSystem;
  weather: WeatherType;
  units?: UnitData[];
}

/**
 * 3D Bresenhamův algoritmus nad celočíselnou mřížkou `{ x, y, z }`.
 * Vrací všechny navštívené dlaždice od `start` do `end` (včetně).
 */
export function bresenham3D(start: GridCoord, end: GridCoord): GridCoord[] {
  const clampFloor = (val: number): FloorLevel =>
    Math.max(0, Math.min(2, Math.round(val))) as FloorLevel;
  const points: GridCoord[] = [];
  let x1 = start.x;
  let y1 = start.y as number;
  let z1 = start.z;
  const x2 = end.x;
  const y2 = end.y as number;
  const z2 = end.z;

  points.push({ x: x1, y: clampFloor(y1), z: z1 });

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const dz = Math.abs(z2 - z1);

  const xs = x2 > x1 ? 1 : -1;
  const ys = y2 > y1 ? 1 : -1;
  const zs = z2 > z1 ? 1 : -1;

  if (dx >= dy && dx >= dz) {
    let p1 = 2 * dy - dx;
    let p2 = 2 * dz - dx;
    while (x1 !== x2) {
      x1 += xs;
      if (p1 >= 0) {
        y1 += ys;
        p1 -= 2 * dx;
      }
      if (p2 >= 0) {
        z1 += zs;
        p2 -= 2 * dx;
      }
      p1 += 2 * dy;
      p2 += 2 * dz;
      points.push({ x: x1, y: clampFloor(y1), z: z1 });
    }
  } else if (dz >= dx && dz >= dy) {
    let p1 = 2 * dy - dz;
    let p2 = 2 * dx - dz;
    while (z1 !== z2) {
      z1 += zs;
      if (p1 >= 0) {
        y1 += ys;
        p1 -= 2 * dz;
      }
      if (p2 >= 0) {
        x1 += xs;
        p2 -= 2 * dz;
      }
      p1 += 2 * dy;
      p2 += 2 * dx;
      points.push({ x: x1, y: clampFloor(y1), z: z1 });
    }
  } else {
    let p1 = 2 * dx - dy;
    let p2 = 2 * dz - dy;
    while (y1 !== y2) {
      y1 += ys;
      if (p1 >= 0) {
        x1 += xs;
        p1 -= 2 * dy;
      }
      if (p2 >= 0) {
        z1 += zs;
        p2 -= 2 * dy;
      }
      p1 += 2 * dx;
      p2 += 2 * dz;
      points.push({ x: x1, y: clampFloor(y1), z: z1 });
    }
  }

  return points;
}

/**
 * Pomocná kontrola přímého 3D Bresenhamova paprsku mezi dvěma body.
 * Pokud je `allowAdjacentPillarPeek` true, kamenný sloup (`pillar`) na poli
 * bezprostředně sousedícím se střelcem (`i === 1`) nebo cílem (`i === ray.length - 2`)
 * neblokuje přímou viditelnost, protože postava se kolem úzkého sloupu vykloní.
 */
function checkDirectRay3D(
  grid: GridSystem,
  from: GridCoord,
  to: GridCoord,
  allowAdjacentPillarPeek = true,
): { clear: boolean; ray: GridCoord[] } {
  const ray = bresenham3D(from, to);
  if (ray.length <= 2) {
    return { clear: true, ray };
  }

  const maxEndpointFloor = Math.max(from.y, to.y);
  const upperEnd = from.y >= to.y ? from : to;

  for (let i = 1; i < ray.length - 1; i++) {
    const cell = ray[i]!;
    const tile = grid.getTile(cell);
    if (!tile) return { clear: false, ray };

    // Vysoké zdi a zavřené dveře blokují vždy; pilíř na sousedním poli (i === 1 nebo i === ray.length - 2)
    // umožňuje vyklonění (step-out peek)
    if (tile.obstacle === "high_wall" || grid.isDoorClosedAt(cell)) {
      return { clear: false, ray };
    }
    if (tile.obstacle === "pillar") {
      const isEndpointNeighbor = i === 1 || i === ray.length - 2;
      if (!allowAdjacentPillarPeek || !isEndpointNeighbor) {
        return { clear: false, ray };
      }
    }

    // Přechod paprsku mezi patry: plná podlaha vyššího patra blokuje výhled dovnitř nižšího patra,
    // pokud nejde o schodišťový průvlak nebo střelbu přes okraj balustrády.
    if (from.y !== to.y && cell.y < maxEndpointFloor) {
      const nextFloorAbove = Math.min(2, cell.y + 1) as FloorLevel;
      const roofAbove = grid.getTile({ x: cell.x, y: nextFloorAbove, z: cell.z });
      if (roofAbove && roofAbove.hasFloor && !roofAbove.isLadder) {
        const distFromUpper = Math.max(
          Math.abs(cell.x - upperEnd.x),
          Math.abs(cell.z - upperEnd.z),
        );
        if (distFromUpper > 1) {
          return { clear: false, ray };
        }
      }
    }
  }

  return { clear: true, ray };
}

/**
 * Ověří přímou viditelnost (Line of Sight) pomocí 3D Bresenhamova algoritmu nad datovou mřížkou,
 * včetně XCOM mechaniky vyklonění z plného krytu (Step-Out Peeking):
 * - Pokud jednotka stojí přímo za vysokou zdí nebo rohem, vykloní se do sousedního volného pole
 *   kolmo na směr střelby, aby mohla přes roh pálit (a být zasažena s postihem krytu).
 */
export function checkLineOfSight3D(
  grid: GridSystem,
  from: GridCoord,
  to: GridCoord,
): { clear: boolean; ray: GridCoord[] } {
  const direct = checkDirectRay3D(grid, from, to, true);
  if (direct.clear) {
    return direct;
  }

  // XCOM Step-Out Peeking & ADR-0010 Edge Peeking přes balustrádu patra:
  // Vyzkoušíme vyklonění střelce nebo cíle o 1 pole do boku či přes okraj patra
  const stepOffsets = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];

  const canStepTo = (base: GridCoord, dx: number, dz: number): GridCoord | null => {
    const c: GridCoord = { x: base.x + dx, y: base.y, z: base.z + dz };
    const t = grid.getTile(c);
    if (!t || !t.hasFloor || !t.walkable) return null;
    return c;
  };

  // Edge Peeking (ADR-0010): Střelec na okraji vyvýšeného patra se vykloní přes balustrádu / hranu podlahy
  // do volného prostoru nad nádvořím, čímž získá přímý výhled dolů
  const canEdgePeek = (base: GridCoord, dx: number, dz: number, otherEnd: GridCoord): GridCoord | null => {
    const c: GridCoord = { x: base.x + dx, y: base.y, z: base.z + dz };
    if (!grid.inBounds(c)) return null;
    const t = grid.getTile(c);
    if (!t) return null;
    if (t.obstacle === "high_wall" || t.obstacle === "pillar" || grid.isDoorClosedAt(c)) {
      return null;
    }
    // Vyklonění musí směřovat k cíli (kladný skalární součin)
    const dot = dx * (otherEnd.x - base.x) + dz * (otherEnd.z - base.z);
    if (dot < 0) return null;

    // Pokud je tam volný prostor nad nižším patrem (nemá podlahu) nebo pochozí plocha,
    // postava se může vyklonit přes zábradlí
    if (!t.hasFloor || (t.hasFloor && t.walkable)) {
      return c;
    }
    return null;
  };

  // 1. Vyklonění střelce zpoza rohu vysoké zdi / pilíře nebo přes hranu balustrády
  for (const off of stepOffsets) {
    const peekFrom =
      canStepTo(from, off.dx, off.dz) ??
      (from.y !== to.y ? canEdgePeek(from, off.dx, off.dz, to) : null);
    if (!peekFrom) continue;
    const peekCheck = checkDirectRay3D(grid, peekFrom, to, true);
    if (peekCheck.clear) {
      return { clear: true, ray: [from, ...peekCheck.ray.slice(1)] };
    }
  }

  // 2. Vyklonění cíle zpoza rohu vysoké zdi / pilíře nebo přes hranu balustrády
  for (const off of stepOffsets) {
    const peekTo =
      canStepTo(to, off.dx, off.dz) ??
      (from.y !== to.y ? canEdgePeek(to, off.dx, off.dz, from) : null);
    if (!peekTo) continue;
    const peekCheck = checkDirectRay3D(grid, from, peekTo, true);
    if (peekCheck.clear) {
      return {
        clear: true,
        ray: [...peekCheck.ray.slice(0, -1), to],
      };
    }
  }

  return direct;
}

/**
 * Určí světovou stranu (N, E, S, W), ze které přilétá výstřel na cílovou dlaždici,
 * a vrátí úroveň krytu cíle v tomto směru se započtením výškového rozdílu (ADR-0010).
 */
export function resolveTargetCoverAgainstShot(
  grid: GridSystem,
  attackerPos: GridCoord,
  targetPos: GridCoord,
): { cover: CoverLevel; incomingDirection: CardinalDir } {
  const targetTile = grid.getTile(targetPos);
  const dx = attackerPos.x - targetPos.x;
  const dz = attackerPos.z - targetPos.z;

  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);

  const primaryDir: CardinalDir =
    absZ >= absX
      ? dz <= 0
        ? "N"
        : "S"
      : dx >= 0
        ? "E"
        : "W";

  if (!targetTile) {
    return { cover: "none", incomingDirection: primaryDir };
  }

  // Započteme primární směr příletu kule. Boční směr zahrneme pouze v případě,
  // že trajektorie výstřelu má výraznou úhlopříčnou složku (poměr stran >= 0.5),
  // aby boční zeď neposkytovala krytí proti střelbě téměř kolmo zepředu/zezadu.
  const candidateDirs: CardinalDir[] = [];
  candidateDirs.push(primaryDir);

  if (primaryDir === "N" || primaryDir === "S") {
    if (absX > 0 && absX * 2 >= absZ) {
      candidateDirs.push(dx > 0 ? "E" : "W");
    }
  } else {
    if (absZ > 0 && absZ * 2 >= absX) {
      candidateDirs.push(dz < 0 ? "N" : "S");
    }
  }

  const rank: Record<CoverLevel, number> = { none: 0, half: 1, full: 2 };
  let best: CoverLevel = "none";

  for (const dir of candidateDirs) {
    const level = targetTile.cover[dir];
    if (rank[level] > rank[best]) {
      best = level;
    }
  }

  // Vertikální úprava krytí podle ADR-0010:
  // 1. Střelba shora dolů (attackerPos.y > targetPos.y):
  //    Výšková převaha překonává nízké překážky. Nízký kryt (half) je shora zcela eliminován (none),
  //    vysoký kryt (full) je redukován na poloviční (half).
  if (attackerPos.y > targetPos.y) {
    if (best === "half") {
      best = "none";
    } else if (best === "full") {
      best = "half";
    }
  }
  // 2. Střelba zespodu nahoru (attackerPos.y < targetPos.y):
  //    Cíl na vyvýšeném patře chráněný balustrádou, parapetem nebo okrajem podlahy
  //    má proti střelbě zespodu garantován plný kryt (full -40 %).
  else if (attackerPos.y < targetPos.y) {
    if (best === "half" || best === "full" || targetTile.obstacle === "low_wall") {
      best = "full";
    } else {
      best = "half";
    }
  }

  return { cover: best, incomingDirection: primaryDir };
}

export function gridDistance3D(a: GridCoord, b: GridCoord): number {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * 1.5;
  const dz = a.z - b.z;
  return Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 10) / 10;
}

/**
 * Modulární kalkulátor střelby (CombatCalculator) pro období třicetileté války (1618–1648).
 * Přijímá střelce (`Shooter`), cíl (`Target`), zbraň (`Weapon`) a stav bojiště (`BattlefieldState`)
 * a vrací kompletní `ShotCalculationResult` včetně položkového rozpisu pro levé a pravé křídlo HUDu.
 */
export class CombatCalculator {
  public static calculateShot(
    shooter: UnitData,
    target: UnitData,
    weapon: WeaponStats,
    battlefield: BattlefieldState,
    fromPos: GridCoord = shooter.pos,
  ): ShotCalculationResult {
    const { grid, weather } = battlefield;
    const rawDist = gridDistance3D(fromPos, target.pos);
    const distance = Math.max(1, Math.round(rawDist));

    const { cover: targetCover, incomingDirection } =
      resolveTargetCoverAgainstShot(grid, fromPos, target.pos);

    const shooterTile = grid.getTile(fromPos);
    const targetTile = grid.getTile(target.pos);

    const hitModifiers: StatModifier[] = [];
    const critModifiers: StatModifier[] = [];

    // =========================================================================
    // 1. LEVÝ PANEL: MODIFIKÁTORY ŠANCE NA ZÁSAH (Hit Modifiers)
    // =========================================================================

    // A) Základní přesnost střelce (Base Marksmanship) + přesnost zbraně
    const baseMarksmanship = shooter.marksmanship;
    hitModifiers.push({
      id: "base-marksmanship",
      label: "Základní přesnost střelce",
      detail: shooter.roleTitle,
      value: baseMarksmanship,
      unit: "%",
      kind: "base",
    });

    if (weapon.baseAccuracy !== 0) {
      hitModifiers.push({
        id: "weapon-accuracy",
        label: `Přesnost zbraně (${weapon.name})`,
        detail:
          weapon.lockType === "wheellock"
            ? "Kolečkový zámek (rychlý zážeh)"
            : "Hladká hlaveň s doutnákovým zámkem",
        value: weapon.baseAccuracy,
        unit: "%",
        kind: weapon.baseAccuracy > 0 ? "bonus" : "penalty",
      });
    }

    // B) Vzdálenost k cíli (Point-blank bonus na blízko vs. penalizace hladké hlavně na dálku)
    let distanceModifier = 0;
    if (distance <= weapon.pointBlankRange) {
      distanceModifier = Math.max(4, (weapon.pointBlankRange - distance + 1) * 4);
      hitModifiers.push({
        id: "distance-point-blank",
        label: `Střelba zblízka (Point-Blank, ${distance} polí)`,
        detail: "Zaručený soustřel na krátkou vzdálenost",
        value: distanceModifier,
        unit: "%",
        kind: "bonus",
      });
    } else if (distance > weapon.optimalRange) {
      const overOptimal = distance - weapon.optimalRange;
      distanceModifier = -Math.round(overOptimal * weapon.falloffPerTile);
      hitModifiers.push({
        id: "distance-falloff",
        label: `Velká vzdálenost hladké hlavně (${distance} polí)`,
        detail: `Nad optimální dostřel (${weapon.optimalRange} polí)`,
        value: distanceModifier,
        unit: "%",
        kind: "penalty",
      });
    } else {
      hitModifiers.push({
        id: "distance-optimal",
        label: `Optimální dostřel (${distance} polí)`,
        detail: "Bez postihu za rozptyl kule",
        value: 0,
        unit: "%",
        kind: "neutral",
      });
    }

    // C) Kryt cíle: Poloviční kryt (-20 %), Plný kryt (-40 %)
    let coverModifier = 0;
    if (targetCover === "half") {
      coverModifier = -20;
      hitModifiers.push({
        id: "target-cover-half",
        label: `Poloviční kryt cíle (směr ${incomingDirection})`,
        detail: "Gabion, nízká zídka nebo převržený vůz",
        value: coverModifier,
        unit: "%",
        kind: "penalty",
      });
    } else if (targetCover === "full") {
      coverModifier = -40;
      hitModifiers.push({
        id: "target-cover-full",
        label: `Plný kryt cíle (směr ${incomingDirection})`,
        detail: "Kamenná zeď, pilíř nebo vozová hradba",
        value: coverModifier,
        unit: "%",
        kind: "penalty",
      });
    } else {
      hitModifiers.push({
        id: "target-cover-none",
        label: "Nekrytý cíl / Obchvat (Flanked)",
        detail: `Cíl nemá kryt ze směru ${incomingDirection}`,
        value: 0,
        unit: "%",
        kind: "bonus",
      });
    }

    // Průraz překážek při aktivní schopnosti Svatováclavský ortel
    if (shooter.abilityBuffActive && shooter.ability?.id === "klementinum_verdict" && coverModifier < 0) {
      hitModifiers.push({
        id: "ability-klementinum-wall-pierce",
        label: "Průraz překážky [Svatováclavské soustředění]",
        detail: "Těžká olověná kule proráží kamennou zídku (ruší postih krytu)",
        value: Math.abs(coverModifier),
        unit: "%",
        kind: "bonus",
      });
      coverModifier = 0;
    }

    // D) Výšková převaha (High Ground bonus: +15 %)
    const heightAdvantage = fromPos.y > target.pos.y;
    const heightModifier = heightAdvantage ? 15 : 0;
    if (heightAdvantage) {
      hitModifiers.push({
        id: "high-ground",
        label: "Výšková převaha (High Ground)",
        detail: `Střelba z patra ${fromPos.y} do patra ${target.pos.y}`,
        value: heightModifier,
        unit: "%",
        kind: "bonus",
      });
    }

    // E) Kouř z černého prachu (Smoke Horizon Piercing ADR-0010)
    const shooterInSmoke = (shooterTile?.smokeTurns ?? 0) > 0;
    const targetInSmoke = (targetTile?.smokeTurns ?? 0) > 0;
    let smokeModifier = 0;
    if (shooterInSmoke || targetInSmoke) {
      if (fromPos.y > target.pos.y && !shooterInSmoke && targetInSmoke) {
        // Střelec z vyvýšeného patra nahlíží přes nízký přízemní dým: -10 % místo -20 %
        smokeModifier = -10;
        hitModifiers.push({
          id: "smoke-horizon-piercing",
          label: "Průhled z výšky přes dým (Smoke Piercing)",
          detail: "Střelba shora přes přízemní kouř z černého prachu (-10 %)",
          value: smokeModifier,
          unit: "%",
          kind: "penalty",
        });
      } else {
        smokeModifier = -20;
        hitModifiers.push({
          id: "black-powder-smoke",
          label: "Kouř z černého prachu (Black Powder Smoke)",
          detail:
            shooterInSmoke && targetInSmoke
              ? "Střelec i cíl stojí v dýmu z předchozích salv"
              : shooterInSmoke
                ? "Střelec stojí v hustém dýmu ze střelného prachu"
                : "Cíl je zahalen dýmem z předchozích salv",
          value: smokeModifier,
          unit: "%",
          kind: "penalty",
        });
      }
    }

    // F) Počasí (Déšť / Mlha): Penalizace k viditelnosti
    let weatherHitModifier = 0;
    if (weather === "fog") {
      weatherHitModifier = -10;
      hitModifiers.push({
        id: "weather-fog",
        label: "Počasí: Ranní vltavská mlha",
        detail: "Snížená viditelnost na bojišti",
        value: weatherHitModifier,
        unit: "%",
        kind: "penalty",
      });
    } else if (weather === "rain") {
      weatherHitModifier = -10;
      hitModifiers.push({
        id: "weather-rain",
        label: "Počasí: Prudký déšť",
        detail: "Zhoršený výhled a vlhnoucí střelný prach na pánvičce",
        value: weatherHitModifier,
        unit: "%",
        kind: "penalty",
      });
    }

    // G) Stav střelce: Opření muškety o furketu (vidlici) (+15 %) a Otřesení morálky (-20 %)
    const forkActive = weapon.supportsRestFork && !shooter.movedThisTurn;
    const forkModifier = forkActive ? 15 : 0;
    if (forkActive) {
      hitModifiers.push({
        id: "musket-rest-fork",
        label: "Opření muškety o furketu (vidlici)",
        detail: "Střelec se v tomto tahu nepohnul a stabilizoval hlaveň",
        value: forkModifier,
        unit: "%",
        kind: "bonus",
      });
    }

    const shakenModifier = shooter.isShaken ? -20 : 0;
    if (shooter.isShaken) {
      hitModifiers.push({
        id: "morale-shaken",
        label: "Otřesená morálka (Suppressed / Shaken)",
        detail: "Třes rukou pod nepřátelskou palbou",
        value: shakenModifier,
        unit: "%",
        kind: "penalty",
      });
    }

    // H) Autorita polního maršála Colloreda (+8 % pro spojence v okruhu 7 polí, pokud není zadržen)
    let marshalModifier = 0;
    if (shooter.faction === "player" && battlefield.units) {
      const colloredo = battlefield.units.find(
        (u) =>
          u.id === "player-colloredo" &&
          u.alive &&
          u.hp > 0 &&
          (u.detainedTurns ?? 0) === 0,
      );
      if (colloredo) {
        const distToMarshal = gridDistance3D(fromPos, colloredo.pos);
        if (shooter.id === "player-colloredo" || distToMarshal <= 7) {
          marshalModifier = 8;
          hitModifiers.push({
            id: "marshal-colloredo-aura",
            label: "Autorita polního maršála",
            detail:
              shooter.id === "player-colloredo"
                ? "Válečné zkušenosti vrchního velitele (+8 %)"
                : "Přítomnost maršála Colloreda na bojišti (+8 %)",
            value: marshalModifier,
            unit: "%",
            kind: "bonus",
          });
        }
      }
    }

    // I) Aktivovaná zvláštní schopnost postavy [Klávesa 5]
    let abilityHitModifier = 0;
    if (shooter.abilityBuffActive) {
      if (shooter.ability?.id === "klementinum_verdict") {
        abilityHitModifier = 35;
        hitModifiers.push({
          id: "ability-klementinum-verdict",
          label: "Svatováclavské soustředění [Schopnost 5]",
          detail: "Suchý prach z Klementina a dokonalá balistická dráha (+35 %)",
          value: abilityHitModifier,
          unit: "%",
          kind: "bonus",
        });
      } else {
        abilityHitModifier = 15;
        hitModifiers.push({
          id: "ability-heroic-focus",
          label: `${shooter.ability?.name ?? "Zvláštní schopnost"} [5]`,
          detail: "Taktické odhodlání (+15 % k zásahu)",
          value: abilityHitModifier,
          unit: "%",
          kind: "bonus",
        });
      }
    }

    const rawHitChance =
      baseMarksmanship +
      weapon.baseAccuracy +
      distanceModifier +
      coverModifier +
      heightModifier +
      smokeModifier +
      weatherHitModifier +
      forkModifier +
      shakenModifier +
      marshalModifier +
      abilityHitModifier;

    const hitChance = Math.max(0, Math.min(100, Math.round(rawHitChance)));

    // =========================================================================
    // 2. PRAVÝ PANEL: MODIFIKÁTORY KRITICKÉHO ZÁSAHU A PRŮRAZU ZBROJE
    // =========================================================================

    // A) Základní šance zbraně na kritický zásah
    critModifiers.push({
      id: "base-weapon-crit",
      label: `Základní šance zbraně (${weapon.name})`,
      detail: `Bonus kritického zásahu +${weapon.critBonusDamage} HP`,
      value: weapon.baseCritChance,
      unit: "%",
      kind: "base",
    });

    // B) Obchvat (Flanking bonus: +40 % ke kritickému zásahu)
    const isFlanked = targetCover === "none";
    const flankCritModifier = isFlanked ? 40 : 0;
    if (isFlanked) {
      critModifiers.push({
        id: "crit-flanking",
        label: "Obchvat / Nekrytý cíl (Flanking)",
        detail: "Střelba ze strany, kde cíl nechrání žádná překážka",
        value: flankCritModifier,
        unit: "%",
        kind: "bonus",
      });
    }

    // C) Střelba z bezprostřední blízkosti (Point-Blank Crit Bonus: +15 %)
    const pointBlankCritModifier =
      distance <= weapon.pointBlankRange ? 15 : 0;
    if (pointBlankCritModifier > 0) {
      critModifiers.push({
        id: "crit-point-blank",
        label: "Střelba z bezprostřední blízkosti (Point-Blank)",
        detail: "Vysoká průraznost olověné kule na krátkou vzdálenost",
        value: pointBlankCritModifier,
        unit: "%",
        kind: "bonus",
      });
    }

    // D) Kvalita zbroje cíle (Těžký kyrys snižuje šanci na kritický zásah o 8 % za bod zbroje)
    const armorCritPenalty = target.armor > 0 ? -target.armor * 8 : 0;
    if (armorCritPenalty !== 0) {
      critModifiers.push({
        id: "target-cuirass-crit-resist",
        label: `Kvalita zbroje cíle (${target.armor} b. kyrysu)`,
        detail: "Ocelový kyrys a přilba odrážejí přímé průstřely",
        value: armorCritPenalty,
        unit: "%",
        kind: "penalty",
      });
    }

    // D2) Bonus kritického zásahu ze Svatováclavského soustředění (+45 %)
    let abilityCritModifier = 0;
    if (shooter.abilityBuffActive && shooter.ability?.id === "klementinum_verdict") {
      abilityCritModifier = 45;
      critModifiers.push({
        id: "crit-klementinum-verdict",
        label: "Svatováclavské soustředění [Schopnost 5]",
        detail: "Mířená rána na spáry švédského kyrysu (+45 % krit, +3 HP poškození)",
        value: abilityCritModifier,
        unit: "%",
        kind: "bonus",
      });
    }

    const rawCritChance =
      weapon.baseCritChance +
      flankCritModifier +
      pointBlankCritModifier +
      armorCritPenalty +
      abilityCritModifier;
    const critChance = Math.max(0, Math.min(100, Math.round(rawCritChance)));

    const effectiveArmorPierce =
      weapon.armorPierce +
      (shooter.abilityBuffActive && shooter.ability?.id === "klementinum_verdict"
        ? 2
        : 0);

    // E) Informace o průrazu a zničení zbroje (Armor Pierce / Armor Shred) v pravém křídle
    if (effectiveArmorPierce > 0) {
      critModifiers.push({
        id: "weapon-armor-pierce",
        label: "Průraz zbroje (Armor Pierce)",
        detail: "Kolik bodů kyrysu cíle výstřel zcela ignoruje",
        value: effectiveArmorPierce,
        unit: "ZBROJ",
        kind: "bonus",
      });
    }

    if (weapon.armorShred > 0) {
      critModifiers.push({
        id: "weapon-armor-shred",
        label: "Destrukce kyrysu (Armor Shred)",
        detail: "Kolik bodů zbroje cíle výstřel při zásahu trvale zničí",
        value: weapon.armorShred,
        unit: "ZBROJ",
        kind: "bonus",
      });
    }

    // =========================================================================
    // 3. ŠANCE NA SELHÁNÍ VÝSTŘELU (Misfire % — specifikum 17. století)
    // =========================================================================
    let weatherMisfireAdd = 0;
    if (weather === "rain") {
      weatherMisfireAdd = weapon.lockType === "matchlock" ? 14 : 4;
    } else if (weather === "fog") {
      weatherMisfireAdd = weapon.lockType === "matchlock" ? 5 : 2;
    }
    const smokeMisfireAdd = shooterInSmoke ? 3 : 0;
    const misfireChance =
      shooter.abilityBuffActive && shooter.ability?.id === "klementinum_verdict"
        ? 0
        : Math.max(
            0,
            Math.min(
              60,
              Math.round(
                weapon.baseMisfireChance + weatherMisfireAdd + smokeMisfireAdd,
              ),
            ),
          );

    // =========================================================================
    // 4. NÁHLED POŠKOZENÍ NA UKAZATELI ZDRAVÍ A ZBROJE (HP & Armor Preview)
    // =========================================================================
    const expectedArmorLoss = Math.min(target.armor, weapon.armorShred);
    const remainingArmorAfterShred = Math.max(
      0,
      target.armor - expectedArmorLoss,
    );
    const effectiveArmorAbsorption = Math.max(
      0,
      remainingArmorAfterShred - effectiveArmorPierce,
    );

    const expectedHpLossMin = Math.max(
      1,
      weapon.minDamage - effectiveArmorAbsorption,
    );
    const expectedHpLossMax = Math.max(
      expectedHpLossMin,
      weapon.maxDamage - effectiveArmorAbsorption,
    );

    // =========================================================================
    // 5. KATEGORIE IKONY V SEZNAMU CÍLŮ (Target Ribbon Category)
    // =========================================================================
    const isExtremeRange = distance > weapon.optimalRange + 2;
    let ribbonCategory: TargetRibbonCategory = "covered";
    if (isFlanked) {
      ribbonCategory = "flanked"; // Žlutá ikona (obchvat / nekrytý cíl)
    } else if (isExtremeRange) {
      ribbonCategory = "extreme_range"; // Šedá/Modrá ikona (extrémní dostřel s penalizací)
    } else {
      ribbonCategory = "covered"; // Červená ikona (nepřítel v krytu / standardní pozici)
    }

    return {
      shooterId: shooter.id,
      targetId: target.id,
      weaponName: weapon.name,
      lockType: weapon.lockType,
      distance,
      incomingDirection,
      targetCover,
      isFlanked,
      isExtremeRange,
      heightAdvantage,
      ribbonCategory,
      hitChance,
      critChance,
      misfireChance,
      minDamage: weapon.minDamage,
      maxDamage: weapon.maxDamage,
      critBonusDamage: weapon.critBonusDamage,
      armorPierce: effectiveArmorPierce,
      armorShred: weapon.armorShred,
      expectedArmorLoss,
      expectedHpLossMin,
      expectedHpLossMax,
      hitModifiers,
      critModifiers,
    };
  }
}

/**
 * Pomocná funkce obalující `CombatCalculator.calculateShot` pro snadné volání.
 */
export function calculateShot(
  grid: GridSystem,
  shooter: UnitData,
  target: UnitData,
  weather: WeatherType = "clear",
  fromPos: GridCoord = shooter.pos,
  units?: UnitData[],
): ShotCalculationResult {
  return CombatCalculator.calculateShot(
    shooter,
    target,
    shooter.weapon,
    { grid, weather, units },
    fromPos,
  );
}

/**
 * Vyhodnotí všechny živé nepřátele z pohledu střelce `attacker`.
 * Vrací pouze cíle, které jsou v dosahu zbraně, mají čistou 3D Bresenhamovu přímou viditelnost (LoS)
 * a (pokud je aktivní Mlha války `visibleEnemyIds`) jsou odhaleny v zorném poli družiny.
 */
export function evaluateVisibleTargets(
  grid: GridSystem,
  attacker: UnitData,
  allUnits: UnitData[],
  weather: WeatherType = "clear",
  fromPosOrVisibleIds?: GridCoord | Set<string>,
  visibleEnemyIdsArg?: Set<string>,
): TargetEvaluation[] {
  const fromPos: GridCoord =
    fromPosOrVisibleIds && !(fromPosOrVisibleIds instanceof Set)
      ? fromPosOrVisibleIds
      : attacker.pos;
  const visibleEnemyIds: Set<string> | undefined =
    fromPosOrVisibleIds instanceof Set
      ? fromPosOrVisibleIds
      : visibleEnemyIdsArg;

  const results: TargetEvaluation[] = [];

  for (const unit of allUnits) {
    if (!unit.alive || unit.hp <= 0 || unit.faction === attacker.faction)
      continue;
    if (visibleEnemyIds && !visibleEnemyIds.has(unit.id)) continue;

    const dist = gridDistance3D(fromPos, unit.pos);
    const inRange = dist <= attacker.weapon.maxRange;
    if (!inRange) continue;

    const los = checkLineOfSight3D(grid, fromPos, unit.pos);
    if (!los.clear) continue;

    const calculation = calculateShot(
      grid,
      attacker,
      unit,
      weather,
      fromPos,
      allUnits,
    );
    results.push({
      targetId: unit.id,
      targetPos: unit.pos,
      hasLos: true,
      losRay: los.ray,
      inRange: true,
      calculation,
    });
  }

  results.sort((a, b) => b.calculation.hitChance - a.calculation.hitChance);
  return results;
}

/**
 * Provede hod na výstřel podle vypočteného `ShotCalculationResult`:
 * 1. Nejprve ověří šanci na selhání doutnáku / prachu (`misfireChance`).
 * 2. Poté ověří šanci na zásah (`hitChance`).
 * 3. Při zásahu spočítá kritický zásah, destrukci zbroje (`armorShred`) a absorpci kyrysem.
 */
export function rollRangedAttack(
  attacker: UnitData,
  target: UnitData,
  calculation: ShotCalculationResult,
  rng: () => number = Math.random,
  accuracyMultiplier = 1,
): AttackOutcome {
  // 1. Hod na selhání výstřelu (Misfire)
  const misfireRoll = rng() * 100;
  if (misfireRoll < calculation.misfireChance) {
    return {
      attackerId: attacker.id,
      targetId: target.id,
      misfired: true,
      hit: false,
      critical: false,
      damage: 0,
      armorShredded: 0,
      armorAbsorbed: 0,
      hitChance: calculation.hitChance,
      critChance: calculation.critChance,
      misfireChance: calculation.misfireChance,
      flanked: calculation.isFlanked,
      heightAdvantage: calculation.heightAdvantage,
      killed: false,
    };
  }

  // 2. Hod na zásah cíle
  const effectiveHitChance = Math.max(
    0,
    Math.min(100, Math.round(calculation.hitChance * accuracyMultiplier)),
  );
  const hitRoll = rng() * 100;
  const hit = hitRoll < effectiveHitChance;

  if (!hit) {
    return {
      attackerId: attacker.id,
      targetId: target.id,
      misfired: false,
      hit: false,
      critical: false,
      damage: 0,
      armorShredded: 0,
      armorAbsorbed: 0,
      hitChance: effectiveHitChance,
      critChance: calculation.critChance,
      misfireChance: calculation.misfireChance,
      flanked: calculation.isFlanked,
      heightAdvantage: calculation.heightAdvantage,
      killed: false,
    };
  }

  // 3. Hod na kritický zásah (průstřel mimo zbroj) a výpočet poškození
  const critRoll = rng() * 100;
  const critical = critRoll < calculation.critChance;
  const span = attacker.weapon.maxDamage - attacker.weapon.minDamage + 1;
  const rawRollDamage =
    attacker.weapon.minDamage + Math.floor(rng() * Math.max(1, span));
  const isVerdict =
    attacker.abilityBuffActive && attacker.ability?.id === "klementinum_verdict";
  const rawDamage =
    rawRollDamage +
    (critical ? attacker.weapon.critBonusDamage : 0) +
    (isVerdict ? 3 : 0);

  // Destrukce zbroje (Shred) a průraz (Pierce)
  const shredAmount = attacker.weapon.armorShred + (isVerdict ? 1 : 0);
  const armorShredded = Math.min(target.armor, shredAmount);
  const remainingArmor = Math.max(0, target.armor - armorShredded);
  // Kritický zásah pronikne mimo zbroj (ignoruje +1 bod zbroje navíc)
  const effectivePierce =
    attacker.weapon.armorPierce +
    (critical ? 1 : 0) +
    (isVerdict ? 2 : 0);
  const armorAbsorbed = Math.max(0, remainingArmor - effectivePierce);

  const finalDamage = Math.max(1, rawDamage - armorAbsorbed);
  const killed = target.hp - finalDamage <= 0;

  return {
    attackerId: attacker.id,
    targetId: target.id,
    misfired: false,
    hit: true,
    critical,
    damage: finalDamage,
    armorShredded,
    armorAbsorbed,
    hitChance: effectiveHitChance,
    critChance: calculation.critChance,
    misfireChance: calculation.misfireChance,
    flanked: calculation.isFlanked,
    heightAdvantage: calculation.heightAdvantage,
    killed,
  };
}

export function facingFromDelta(
  from: GridCoord,
  to: GridCoord,
  fallback: CardinalDir = "N",
): CardinalDir {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx === 0 && dz === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? "E" : "W";
  }
  return dz >= 0 ? "S" : "N";
}

export interface EnemyAiDecision {
  movePath: GridCoord[];
  moveApCost: number;
  targetId: string | null;
  doorToOpen?: GridCoord | null;
}

/**
 * Taktická AI pro nepřátelskou jednotku:
 * 1. Vyhodnotí současnou dlaždici a všechna pole dosažitelná za 1 AP (Modrá zóna).
 * 2. Preferuje dlaždice s krytem proti hráčovým žoldnéřům, výškovou převahu a čistý výstřel.
 * 3. Pokud z 1 AP nelze vystřelit, přesune se (sprint 2 AP) ke krytu blíže k hráči.
 */
export function computeEnemyAiDecision(
  grid: GridSystem,
  enemy: UnitData,
  allUnits: UnitData[],
  weather: WeatherType = "clear",
): EnemyAiDecision {
  const players = allUnits.filter(
    (u) => u.alive && u.hp > 0 && u.faction === "player",
  );
  const colloredoUnit = allUnits.find(
    (u) => u.id === "player-colloredo" && u.alive,
  );
  if ((players.length === 0 && !colloredoUnit) || !enemy.alive || enemy.ap <= 0) {
    return { movePath: [], moveApCost: 0, targetId: null };
  }

  const reachable = computeReachableTiles(grid, enemy, allUnits);

  interface CandidateSpot {
    coord: GridCoord;
    apCost: number;
    score: number;
    bestTargetId: string | null;
  }

  const candidates: CandidateSpot[] = [];

  const evaluateSpot = (coord: GridCoord, apCost: number) => {
    const canShootAfter = enemy.ap - apCost >= 1;
    const tile = grid.getTile(coord);
    if (!tile) return;

    const refPlayers = players.length > 0 ? players : colloredoUnit ? [colloredoUnit] : [];
    if (refPlayers.length === 0) return;

    let nearestPlayer = refPlayers[0]!;
    let nearestDist = Infinity;
    for (const p of refPlayers) {
      const d = gridDistance3D(coord, p.pos);
      if (d < nearestDist) {
        nearestDist = d;
        nearestPlayer = p;
      }
    }

    const { cover: covVsNearest } = resolveTargetCoverAgainstShot(
      grid,
      nearestPlayer.pos,
      coord,
    );
    const coverScore =
      covVsNearest === "full"
        ? 45
        : covVsNearest === "half"
          ? 25
          : bestTileCover(tile.cover) !== "none"
            ? 8
            : -15;

    const heightScore = coord.y > 0 ? 18 : 0;

    // Bonus za těsné obklíčení / střežení maršála Colloreda (vzdálenost <= 1 na stejném patře)
    const adjacentToColloredo =
      colloredoUnit &&
      coord.y === colloredoUnit.pos.y &&
      Math.abs(coord.x - colloredoUnit.pos.x) <= 1 &&
      Math.abs(coord.z - colloredoUnit.pos.z) <= 1;
    const colloredoHasEscort =
      colloredoUnit &&
      allUnits.some(
        (u) =>
          u.faction === "player" &&
          u.alive &&
          u.hp > 0 &&
          u.id !== "player-colloredo" &&
          u.pos.y === colloredoUnit.pos.y &&
          Math.abs(u.pos.x - colloredoUnit.pos.x) <= 1 &&
          Math.abs(u.pos.z - colloredoUnit.pos.z) <= 1,
      );
    const captureProximityBonus =
      adjacentToColloredo && !colloredoHasEscort ? 55 : 0;

    if (canShootAfter) {
      const simulatedEnemy: UnitData = {
        ...enemy,
        pos: coord,
        movedThisTurn: apCost > 0 ? true : enemy.movedThisTurn,
      };
      const targets = evaluateVisibleTargets(
        grid,
        simulatedEnemy,
        allUnits,
        weather,
        coord,
      );
      if (targets.length > 0) {
        // Švédský přepadový oddíl má rozkaz maršála nezabít, ale zajmout pro tučné výkupné!
        // Prioritně cílí na Colloreda, pokud ještě není zadržen.
        const colloredoTarget = targets.find(
          (t) =>
            t.targetId === "player-colloredo" &&
            (colloredoUnit?.detainedTurns ?? 0) === 0,
        );
        const bestTarget =
          colloredoTarget && colloredoTarget.calculation.hitChance >= 25
            ? colloredoTarget
            : targets[0]!;

        const isVipTarget = bestTarget.targetId === "player-colloredo";
        const shotScore =
          bestTarget.calculation.hitChance * 1.4 +
          (bestTarget.calculation.isFlanked ? 25 : 0) +
          (isVipTarget ? 45 : 0); // Vysoká priorita zajetí velkopřevora
        candidates.push({
          coord,
          apCost,
          score:
            100 +
            coverScore +
            heightScore +
            shotScore +
            captureProximityBonus -
            apCost * 6,
          bestTargetId: bestTarget.targetId,
        });
        return;
      }
    }

    const distDiff = Math.abs(nearestDist - 6);
    const interceptScore = colloredoUnit
      ? Math.max(0, (12 - gridDistance3D(coord, colloredoUnit.pos)) * 4)
      : 0;
    candidates.push({
      coord,
      apCost,
      score:
        coverScore +
        heightScore +
        interceptScore +
        captureProximityBonus -
        distDiff * 6,
      bestTargetId: null,
    });
  };

  evaluateSpot(enemy.pos, 0);

  for (const r of reachable.values()) {
    evaluateSpot(r.coord, r.apCost);
  }

  candidates.sort((a, b) => b.score - a.score);
  const chosen = candidates[0];
  if (!chosen) {
    return { movePath: [], moveApCost: 0, targetId: null };
  }

  const movePath = sameCoord(enemy.pos, chosen.coord)
    ? []
    : findPathAStar(grid, enemy.pos, chosen.coord, allUnits, enemy.id);

  // Pokud je nepřítel v bezprostředním sousedství zavřených dveří a cíl/hráč je za nimi,
  // otevře je jako volnou akci (0 AP) pro obnovení přímé viditelnosti a průchodu
  let doorToOpen: GridCoord | null = null;
  const adjacentDoorOffsets = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];
  for (const off of adjacentDoorOffsets) {
    const dc: GridCoord = {
      x: enemy.pos.x + off.dx,
      y: enemy.pos.y,
      z: enemy.pos.z + off.dz,
    };
    if (grid.isDoorClosedAt(dc)) {
      doorToOpen = dc;
      break;
    }
  }

  return {
    movePath,
    moveApCost: chosen.apCost,
    targetId: chosen.bestTargetId,
    doorToOpen,
  };
}
