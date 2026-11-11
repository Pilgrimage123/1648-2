/**
 * Čistý TypeScript modul pro výpočet 3D Bresenhamovy přímé viditelnosti (LoS),
 * kompletního rozpisu šancí na zásah ve stylu XCOM 2 adaptovaného na 17. století
 * (ShotCalculationResult, StatModifier) a taktické AI (/src/core/CombatSystem.ts).
 * Striktně bez importů Three.js nebo Reactu.
 */

import {
  bestTileCover,
  GridSystem,
  isEnclosedRoofedCoord,
  sameCoord,
  soldierMovePerAp,
} from "./GridSystem";
import { computeReachableTiles, findPathAStar } from "./Pathfinding";
import type {
  AttackOutcome,
  CardinalDir,
  CoverLevel,
  FloorLevel,
  GridCoord,
  MeleeCalculationResult,
  MeleeTargetEvaluation,
  MeleeWeaponStats,
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
  const isPointBlank = gridDistance3D(from, to) <= 1.5;
  const isHighGround = from.y > to.y;

  let consecutiveSmoke = 0;
  let maxConsecutiveSmoke = 0;

  for (let i = 0; i < ray.length; i++) {
    const cell = ray[i]!;
    const tile = grid.getTile(cell);
    if (!tile) {
      if (i > 0 && i < ray.length - 1) return { clear: false, ray };
      continue;
    }

    let hasSmoke = (tile?.smokeTurns ?? 0) > 0;
    if (!hasSmoke && cell.y > 0) {
      const groundTile = grid.getTile({ x: cell.x, y: 0, z: cell.z });
      if (groundTile && groundTile.smokeTurns > 0) {
        hasSmoke = true;
      }
    }

    if (hasSmoke) {
      consecutiveSmoke++;
      if (consecutiveSmoke > maxConsecutiveSmoke) {
        maxConsecutiveSmoke = consecutiveSmoke;
      }
    } else {
      consecutiveSmoke = 0;
    }

    if (i > 0 && i < ray.length - 1) {
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
  }

  // Kumulativní clona kouře (ADR-0011):
  // 1. Výjimka kontaktního dosahu (Point-Blank Proximity Rule: vzdálenost <= 1.5):
  //    boj zblízka zachovává přímou viditelnost i přes kouř.
  // 2. Výjimka výškové převahy (Smoke Horizon Piercing: from.y > to.y):
  //    střelec shora prorazí až 2 kouřová pole; zablokováno je až při > 2.
  // 3. Střelba ve stejné rovině či zdola nahoru:
  //    2 a více po sobě jdoucích kouřových polí zcela přeruší zrakovou linii.
  if (!isPointBlank) {
    if (isHighGround) {
      if (maxConsecutiveSmoke > 2) {
        return { clear: false, ray };
      }
    } else {
      if (maxConsecutiveSmoke >= 2) {
        return { clear: false, ray };
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

    // A) Základní přesnost zbraně (Base Aim) + střelecká zkušenost vojáka
    const weaponBaseAim = weapon.baseAccuracy;
    hitModifiers.push({
      id: "weapon-accuracy",
      label: `Základní přesnost (${weapon.name})`,
      detail: weapon.supportsRestFork
        ? "Dlouhá hlaveň + stabilita opěrné vidlice (furkety)"
        : weapon.lockType === "wheellock"
          ? "Kolečkový zámek (rychlý zážeh jiskrou)"
          : "Kratší hlaveň, střelba z ruky bez opory (Model 1624)",
      value: weaponBaseAim,
      unit: "%",
      kind: "base",
    });

    const shooterSkillBonus = shooter.marksmanship - 65;
    if (shooterSkillBonus !== 0) {
      hitModifiers.push({
        id: "base-marksmanship",
        label: `Střelecká zkušenost (${shooter.name})`,
        detail: shooter.roleTitle,
        value: shooterSkillBonus,
        unit: "%",
        kind: shooterSkillBonus > 0 ? "bonus" : "penalty",
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
        label: `Efektivní dostřel (${distance} polí)`,
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

    // E) Černý prach a dým (Black Powder Smoke):
    // - Střelba z políčka zahaleného dýmem má postih -10 % Aim
    // - Cíl v oblaku dýmu má +15 % Obranu (-15 % k zásahu; při střelbě shora přes nízký dým -10 %)
    const shooterInSmoke = (shooterTile?.smokeTurns ?? 0) > 0;
    const targetInSmoke = (targetTile?.smokeTurns ?? 0) > 0;
    let smokeModifier = 0;
    if (shooterInSmoke) {
      smokeModifier -= 10;
      hitModifiers.push({
        id: "shooter-smoke-aim",
        label: "Střelba z oblaku dýmu (-10 % Aim)",
        detail: "Hustý dým z černého prachu na políčku střelce zhoršuje míření",
        value: -10,
        unit: "%",
        kind: "penalty",
      });
    }
    if (targetInSmoke) {
      if (fromPos.y > target.pos.y && !shooterInSmoke) {
        smokeModifier -= 10;
        hitModifiers.push({
          id: "smoke-horizon-piercing",
          label: "Průhled z výšky přes dým (Smoke Piercing)",
          detail: "Střelba shora přes přízemní kouř z černého prachu (-10 %)",
          value: -10,
          unit: "%",
          kind: "penalty",
        });
      } else {
        smokeModifier -= 15;
        hitModifiers.push({
          id: "black-powder-smoke",
          label: "Oblak dýmu v cíli (+15 Obrana)",
          detail: "Cíl je zahalen dýmem z černého prachu (+15 % Obrana cíle)",
          value: -15,
          unit: "%",
          kind: "penalty",
        });
      }
    } else {
      // Clona dýmu mezi střelcem a cílem (ADR-0011)
      let rayHasIntermediateSmoke = false;
      const ray = bresenham3D(fromPos, target.pos);
      for (let i = 1; i < ray.length - 1; i++) {
        const stepTile = grid.getTile(ray[i]!);
        if (stepTile && stepTile.smokeTurns > 0) {
          rayHasIntermediateSmoke = true;
          break;
        }
      }
      if (rayHasIntermediateSmoke) {
        if (fromPos.y > target.pos.y && !shooterInSmoke) {
          smokeModifier -= 10;
          hitModifiers.push({
            id: "smoke-horizon-piercing",
            label: "Průhled z výšky přes dým (Smoke Piercing)",
            detail: "Střelba shora přes přízemní kouř z černého prachu (-10 %)",
            value: -10,
            unit: "%",
            kind: "penalty",
          });
        } else {
          smokeModifier -= 15;
          hitModifiers.push({
            id: "black-powder-smoke",
            label: "Clona dýmu v dráze střely (+15 Obrana)",
            detail: "Střela prolétá kouřem z černého prachu (+15 % Obrana cíle)",
            value: -15,
            unit: "%",
            kind: "penalty",
          });
        }
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

    // G) Stav střelce: Těžká mušketa s furketou (2 AP bez pohybu vs. nouzová střelba od boku za 1 AP s -35 % Aim a Otřesením)
    const requiresTwoApFork = (weapon.fireApCost ?? 1) === 2;
    const isHipFire =
      requiresTwoApFork &&
      !!weapon.allowEmergencyHipFire &&
      (shooter.movedThisTurn || shooter.ap < 2);
    const fireApCost: 1 | 2 = requiresTwoApFork && !isHipFire ? 2 : 1;

    let forkOrHipModifier = 0;
    if (requiresTwoApFork) {
      if (isHipFire) {
        forkOrHipModifier = -(weapon.hipFireAimPenalty ?? 35);
        hitModifiers.push({
          id: "emergency-hip-fire",
          label: "Nouzová střelba od boku (1 AP, bez furkety)",
          detail: "Výstřel 8kg muškety z ruky (-35 % Aim, zpětný ráz způsobí stav Otřesený!)",
          value: forkOrHipModifier,
          unit: "%",
          kind: "penalty",
        });
      } else {
        hitModifiers.push({
          id: "musket-rest-fork",
          label: "Rozložená furketa (opěrná vidlice, 2 AP)",
          detail: "Střelec se v kole výstřelu nepohnul a stabilizoval těžkou hlaveň",
          value: 0,
          unit: "%",
          kind: "neutral",
        });
      }
    }

    const shakenModifier = shooter.isShaken ? -20 : 0;
    if (shooter.isShaken) {
      hitModifiers.push({
        id: "morale-shaken",
        label: "Otřesený střelec (Shaken)",
        detail: "Třes rukou pod palbou nebo po zpětném rázu těžké muškety (-20 %)",
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
                : "Maršál Colloredo je do 7 polí (+8 %)",
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
      weaponBaseAim +
      shooterSkillBonus +
      distanceModifier +
      coverModifier +
      heightModifier +
      smokeModifier +
      weatherHitModifier +
      forkOrHipModifier +
      shakenModifier +
      marshalModifier +
      abilityHitModifier;

    const hitChance = Math.max(0, Math.min(100, Math.round(rawHitChance)));

    // =========================================================================
    // 2. PRAVÝ PANEL: MODIFIKÁTORY KRITICKÉHO ZÁSAHU A PRŮRAZU ZBROJE
    // =========================================================================

    // A) Základní šance zbraně na kritický zásah
    const critDamageLabel =
      weapon.critBonusMaxDamage && weapon.critBonusMaxDamage > weapon.critBonusDamage
        ? `+${weapon.critBonusDamage} až +${weapon.critBonusMaxDamage} HP`
        : `+${weapon.critBonusDamage} HP`;
    critModifiers.push({
      id: "base-weapon-crit",
      label: `Základní šance zbraně (${weapon.name})`,
      detail: `Bonus kritického poškození ${critDamageLabel}`,
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
    // 3. ŠANCE NA SELHÁNÍ VÝSTŘELU (Misfire % — v dešti mají doutnákové zámky 20 % šanci)
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
      critBonusMaxDamage: weapon.critBonusMaxDamage,
      fireApCost,
      isHipFire,
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

export interface ColloredoCaptureCheck {
  canCapture: boolean;
  isAdjacent: boolean;
  isGunpoint: boolean;
  distanceTiles: number;
}

/**
 * Zkontroluje, zda švédský voják může zajmout hraběte Colloreda za 1 AP:
 * - Buď těsně vedle něj (Chebyshev <= 1, stejné patro, nejde o stejné pole)
 * - Nebo do tří políček u něj (Chebyshev <= 3, |dy| <= 1), pokud má nabitou palnou zbraň a přímou viditelnost
 */
export function checkEnemyColloredoCapture(
  grid: GridSystem,
  enemy: UnitData,
  colloredo: UnitData,
  fromPos?: GridCoord,
): ColloredoCaptureCheck {
  const pos = fromPos ?? enemy.pos;
  const noCapture: ColloredoCaptureCheck = {
    canCapture: false,
    isAdjacent: false,
    isGunpoint: false,
    distanceTiles: 999,
  };

  if (!enemy.alive || enemy.hp <= 0) return noCapture;
  if (!colloredo.alive) return noCapture;

  const dx = Math.abs(pos.x - colloredo.pos.x);
  const dz = Math.abs(pos.z - colloredo.pos.z);
  const dy = Math.abs(pos.y - colloredo.pos.y);
  const chebyshevDist = Math.max(dx, dz);

  // 1. Těsně vedle něj (Chebyshev <= 1, stejné patro dy === 0, nejde o stejné pole)
  const isAdjacent =
    pos.y === colloredo.pos.y && dx <= 1 && dz <= 1 && !(dx === 0 && dz === 0);
  if (isAdjacent) {
    return {
      canCapture: true,
      isAdjacent: true,
      isGunpoint: false,
      distanceTiles: chebyshevDist,
    };
  }

  // 2. Do tří políček u něj, pokud mají nabitou palnou zbraň
  const isWithin3Tiles = chebyshevDist <= 3 && dy <= 1;
  const hasLoadedFirearm = enemy.firearmLoaded !== false;

  if (isWithin3Tiles && hasLoadedFirearm) {
    const los = checkLineOfSight3D(grid, pos, colloredo.pos);
    if (los.clear) {
      return {
        canCapture: true,
        isAdjacent: false,
        isGunpoint: true,
        distanceTiles: chebyshevDist,
      };
    }
  }

  return noCapture;
}

/**
 * Ověří, zda je daná hráčská jednotka chráněna přítomností hraběte Colloreda:
 * - Hráčská jednotka je do 3 políček od hraběte (Chebyshev <= 3, |dy| <= 1).
 * - Střelec ze své pozice vidí hraběte (přímá 3D viditelnost bez neprůhledných překážek a hustého dýmu).
 * Pokud jsou obě podmínky splněny, Švédové na tuto postavu nebudou střílet,
 * aby neriskovali zbloudilou kulku a usmrcení maršála, kterého potřebují živého pro tučné výkupné.
 */
export function isCompanionProtectedByCount(
  grid: GridSystem,
  shooterPos: GridCoord,
  targetUnit?: UnitData | null,
  allUnits: UnitData[] = [],
): boolean {
  if (!targetUnit || targetUnit.faction !== "player") return false;
  if (targetUnit.id === "player-colloredo") return true;

  const colloredo = allUnits.find(
    (u) => u.id === "player-colloredo" && u.alive,
  );
  if (!colloredo) return false;

  const dx = Math.abs(targetUnit.pos.x - colloredo.pos.x);
  const dz = Math.abs(targetUnit.pos.z - colloredo.pos.z);
  const dy = Math.abs(targetUnit.pos.y - colloredo.pos.y);
  const within3Tiles = Math.max(dx, dz) <= 3 && dy <= 1;

  if (!within3Tiles) return false;

  // Vidí střelec hraběte?
  const losToCount = checkLineOfSight3D(grid, shooterPos, colloredo.pos);
  if (!losToCount.clear) return false;

  // Ověření kouře mezi střelcem a hrabětem
  if (shooterPos.y <= colloredo.pos.y && losToCount.ray.length > 2) {
    for (let i = 1; i < losToCount.ray.length - 1; i++) {
      const stepCoord = losToCount.ray[i]!;
      const stepTile = grid.getTile(stepCoord);
      if (stepTile && stepTile.smokeTurns > 0 && stepCoord.y >= shooterPos.y) {
        return false;
      }
    }
  }

  return true;
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

    // Švédové po hraběti nikdy nestřílí!
    if (attacker.faction === "enemy" && unit.id === "player-colloredo") {
      continue;
    }

    // Švédové nestřílí na hráčskou postavu, pokud je do 3 políček od hraběte a střelec hraběte vidí
    if (
      attacker.faction === "enemy" &&
      isCompanionProtectedByCount(grid, fromPos, unit, allUnits)
    ) {
      continue;
    }

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
  const critMin = attacker.weapon.critBonusDamage;
  const critMax = attacker.weapon.critBonusMaxDamage ?? critMin;
  const critSpan = Math.max(1, critMax - critMin + 1);
  const rolledCritBonus = critical
    ? critMin + Math.floor(rng() * critSpan)
    : 0;
  const isVerdict =
    attacker.abilityBuffActive && attacker.ability?.id === "klementinum_verdict";
  const rawDamage =
    rawRollDamage +
    rolledCritBonus +
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

/**
 * Zjistí, zda se dvě souřadnice nacházejí v bezprostředním sousedství pro boj zblízka
 * (Chebyshevova vzdálenost v rovině X-Z <= 1, výškový rozdíl patra |dy| <= 1, a nejde o stejné pole).
 */
export function isAdjacentForMelee(a: GridCoord, b: GridCoord): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const dz = Math.abs(a.z - b.z);
  return dx <= 1 && dz <= 1 && dy <= 1 && !(dx === 0 && dy === 0 && dz === 0);
}

/**
 * Vypočítá pravděpodobnost zásahu, kritického úderu a ztráty zbroje při útoku zblízka (17. století).
 * Hrabě Colloredo má pouze těžkou ořechovou pažbu své jednoranné bambitky, která působí jen 1-2 HP
 * a proti nepřátelskému kyrysu je minimálně účinná.
 */
export function calculateMeleeAttack(
  grid: GridSystem,
  attacker: UnitData,
  target: UnitData,
  allUnits?: UnitData[],
): MeleeCalculationResult {
  const weapon: MeleeWeaponStats = attacker.meleeWeapon ?? {
    id: "fist",
    name: "Pěstní souboj",
    kind: "fist",
    minDamage: 1,
    maxDamage: 2,
    critBonusDamage: 1,
    baseCritChance: 5,
    baseAccuracy: 70,
    armorPierce: 0,
    armorShred: 0,
    description: "Zoufalý boj holýma rukama.",
  };

  const hitModifiers: StatModifier[] = [];
  const critModifiers: StatModifier[] = [];

  // 1. ZÁKLADNÍ PŘESNOST ZBRANĚ ZBLÍZKA
  hitModifiers.push({
    id: "base-melee-acc",
    label: `Základní přesnost (${weapon.name})`,
    detail: weapon.description,
    value: weapon.baseAccuracy,
    unit: "%",
    kind: "base",
  });

  // 2. BOJOVÁ ZKUŠENOST / ZRUČNOST POSTAVY
  const skillBonus = Math.round((attacker.marksmanship - 65) * 0.4);
  if (skillBonus !== 0) {
    hitModifiers.push({
      id: "melee-skill-factor",
      label: "Bojová zručnost šermíře",
      detail: attacker.roleTitle,
      value: skillBonus,
      unit: "%",
      kind: skillBonus > 0 ? "bonus" : "penalty",
    });
  }

  // 3. HANDICAP HRABĚTE COLLOREDA (V noční košili, 7 zranění z Lützenu, těžká pažba)
  if (attacker.id === "player-colloredo") {
    hitModifiers.push({
      id: "colloredo-melee-handicap",
      label: "Zranění z Lützenu & noční košile",
      detail: "Maršál těžce kulhá a ohání se těžkou vybitou bambitkou (-15 %)",
      value: -15,
      unit: "%",
      kind: "penalty",
    });
  }

  // 4. VÝŠKOVÁ PŘEVAHA (High Ground +15 %)
  const heightAdvantage = attacker.pos.y > target.pos.y;
  if (heightAdvantage) {
    hitModifiers.push({
      id: "melee-high-ground",
      label: "Výšková převaha (úder shora)",
      detail: `Útok z patra ${attacker.pos.y} na patro ${target.pos.y}`,
      value: 15,
      unit: "%",
      kind: "bonus",
    });
  }

  // 5. STAV OTŘESENÍ MORÁLKY (Shaken)
  if (attacker.isShaken) {
    hitModifiers.push({
      id: "attacker-shaken",
      label: "Otřesená morálka útočníka",
      detail: "Třes rukou po nepřátelské palbě",
      value: -20,
      unit: "%",
      kind: "penalty",
    });
  }
  if (target.isShaken) {
    hitModifiers.push({
      id: "target-shaken",
      label: "Dezorientovaný cíl (Otřesen)",
      detail: "Cíl nestíhá krýt úder zblízka",
      value: 15,
      unit: "%",
      kind: "bonus",
    });
  }

  const rawHit =
    weapon.baseAccuracy +
    skillBonus +
    (attacker.id === "player-colloredo" ? -15 : 0) +
    (heightAdvantage ? 15 : 0) +
    (attacker.isShaken ? -20 : 0) +
    (target.isShaken ? 15 : 0);
  const hitChance = Math.max(10, Math.min(95, Math.round(rawHit)));

  // KRITICKÝ ZÁSAH
  critModifiers.push({
    id: "base-melee-crit",
    label: `Základní kritická šance (${weapon.name})`,
    detail: `Bonus kritického zásahu +${weapon.critBonusDamage} HP`,
    value: weapon.baseCritChance,
    unit: "%",
    kind: "base",
  });

  const armorCritPenalty = target.armor > 0 ? -target.armor * 8 : 0;
  if (armorCritPenalty !== 0) {
    critModifiers.push({
      id: "target-armor-crit-resist",
      label: `Odolnost kyrysu (${target.armor} b. zbroje)`,
      detail: "Ocelový kyrys odráží sečné a tupé rány",
      value: armorCritPenalty,
      unit: "%",
      kind: "penalty",
    });
  }

  if (weapon.armorPierce > 0) {
    critModifiers.push({
      id: "melee-armor-pierce",
      label: "Průraz čepelí (Armor Pierce)",
      detail: "Hrot zbraně ignoruje body zbroje",
      value: weapon.armorPierce,
      unit: "ZBROJ",
      kind: "bonus",
    });
  }

  if (weapon.armorShred > 0) {
    critModifiers.push({
      id: "melee-armor-shred",
      label: "Destrukce zbroje (Armor Shred)",
      detail: "Čepel rozsekává řemení a plech kyrysu",
      value: weapon.armorShred,
      unit: "ZBROJ",
      kind: "bonus",
    });
  }

  const rawCrit = weapon.baseCritChance + armorCritPenalty;
  const critChance = Math.max(0, Math.min(85, Math.round(rawCrit)));

  // VÝPOČET ZTRÁT ZDRAVÍ A ZBROJE
  const expectedArmorLoss = Math.min(target.armor, weapon.armorShred);
  const remainingArmor = Math.max(0, target.armor - expectedArmorLoss);
  const effectiveAbsorption = Math.max(0, remainingArmor - weapon.armorPierce);

  const expectedHpLossMin = Math.max(1, weapon.minDamage - effectiveAbsorption);
  const expectedHpLossMax = Math.max(
    expectedHpLossMin,
    weapon.maxDamage - effectiveAbsorption,
  );

  return {
    attackerId: attacker.id,
    targetId: target.id,
    weaponName: weapon.name,
    kind: weapon.kind,
    hitChance,
    critChance,
    heightAdvantage,
    minDamage: weapon.minDamage,
    maxDamage: weapon.maxDamage,
    critBonusDamage: weapon.critBonusDamage,
    armorPierce: weapon.armorPierce,
    armorShred: weapon.armorShred,
    expectedArmorLoss,
    expectedHpLossMin,
    expectedHpLossMax,
    hitModifiers,
    critModifiers,
  };
}

/**
 * Vyhodnotí všechny nepřátele stojící na sousedních polích pro útok zblízka.
 */
export function evaluateAdjacentMeleeTargets(
  grid: GridSystem,
  attacker: UnitData,
  allUnits: UnitData[],
  visibleEnemyIds?: Set<string>,
): MeleeTargetEvaluation[] {
  const results: MeleeTargetEvaluation[] = [];

  for (const unit of allUnits) {
    if (!unit.alive || unit.hp <= 0 || unit.faction === attacker.faction) {
      continue;
    }
    if (visibleEnemyIds && !visibleEnemyIds.has(unit.id)) {
      continue;
    }
    if (!isAdjacentForMelee(attacker.pos, unit.pos)) {
      continue;
    }

    const calculation = calculateMeleeAttack(grid, attacker, unit, allUnits);
    results.push({
      targetId: unit.id,
      targetPos: unit.pos,
      inRange: true,
      calculation,
    });
  }

  results.sort((a, b) => b.calculation.hitChance - a.calculation.hitChance);
  return results;
}

/**
 * Provede útok chladnou zbraní nebo pažbou zblízka.
 * Útok zblízka nikdy neselhává na vlhký doutnák (misfired: false).
 */
export function rollMeleeAttack(
  attacker: UnitData,
  target: UnitData,
  calc: MeleeCalculationResult,
  rng: () => number = Math.random,
): AttackOutcome {
  const hitRoll = rng() * 100;
  const hit = hitRoll < calc.hitChance;

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
      hitChance: calc.hitChance,
      critChance: calc.critChance,
      misfireChance: 0,
      flanked: true,
      heightAdvantage: attacker.pos.y > target.pos.y,
      killed: false,
    };
  }

  const critRoll = rng() * 100;
  const critical = critRoll < calc.critChance;
  const span = calc.maxDamage - calc.minDamage + 1;
  const rollDamage = calc.minDamage + Math.floor(rng() * Math.max(1, span));
  const rawDamage = rollDamage + (critical ? calc.critBonusDamage : 0);

  const armorShredded = Math.min(target.armor, calc.armorShred);
  const remainingArmor = Math.max(0, target.armor - armorShredded);
  const effectivePierce = calc.armorPierce + (critical ? 1 : 0);
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
    hitChance: calc.hitChance,
    critChance: calc.critChance,
    misfireChance: 0,
    flanked: true,
    heightAdvantage: attacker.pos.y > target.pos.y,
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

/**
 * Zkontroluje, zda cílová dlaždice leží v úzkém 90° předním kuželu Připravené salvy
 * doutnákové muškety podle směru natočení střelce (facing).
 */
export function isInPreparedVolleyCone(
  watcherPos: GridCoord,
  watcherFacing: CardinalDir,
  targetCoord: GridCoord,
): boolean {
  const dx = targetCoord.x - watcherPos.x;
  const dz = targetCoord.z - watcherPos.z;
  if (dx === 0 && dz === 0) return false;
  switch (watcherFacing) {
    case "N":
      return dz < 0 && Math.abs(dx) <= Math.abs(dz);
    case "S":
      return dz > 0 && Math.abs(dx) <= Math.abs(dz);
    case "E":
      return dx > 0 && Math.abs(dz) <= Math.abs(dx);
    case "W":
      return dx < 0 && Math.abs(dz) <= Math.abs(dx);
  }
}

export interface EnemyAiDecision {
  movePath: GridCoord[];
  moveApCost: number;
  targetId: string | null;
  doorToOpen?: GridCoord | null;
  isCaptureAction?: boolean;
}

/**
 * Taktická AI pro nepřátelskou jednotku:
 * 1. Švédové po hraběti nestřílí, ale zajmou ho tak, že buď utratí 1 AP těsně vedle něj
 *    nebo do tří políček u něj, pokud mají nabitou palnou zbraň.
 * 2. Na ostatní hráčské postavy klidně pálí a útočí, ale nebudou na ně střílet,
 *    pokud je hráčská postava do tří políček od hraběte (a střelec vidí hraběte).
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
    return { movePath: [], moveApCost: 0, targetId: null, isCaptureAction: false };
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
    const requiredFireAp = enemy.weapon.fireApCost ?? 1;
    const canShootAfter =
      enemy.firearmLoaded !== false &&
      (requiredFireAp === 1
        ? enemy.ap - apCost >= 1
        : apCost === 0 && !enemy.movedThisTurn && enemy.ap >= requiredFireAp);
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
    const remainingAp = enemy.ap - apCost;

    // 1. Ověření možnosti zajmout hraběte Colloreda za 1 AP z tohoto místa:
    // Švédové po hraběti nestřílí, ale zajmou ho tak, že buď utratí 1 AP těsně vedle něj
    // nebo do tří políček u něj, pokud mají nabitou palnou zbraň.
    if (colloredoUnit && remainingAp >= 1) {
      const captureCheck = checkEnemyColloredoCapture(
        grid,
        enemy,
        colloredoUnit,
        coord,
      );
      if (captureCheck.canCapture) {
        // Nejvyšší možná priorita: Švédský voják může dosáhnout pozice a utratit 1 AP k zajetí hraběte!
        candidates.push({
          coord,
          apCost,
          score:
            4000 +
            (captureCheck.isAdjacent ? 150 : 100) -
            apCost * 15,
          bestTargetId: "player-colloredo",
        });
        return;
      }
    }

    // Snaha přiblížit se k hraběti na dosah zajetí (3 pole s nabitou mušketou nebo 1 pole)
    const distToColloredo = colloredoUnit
      ? Math.max(
          Math.abs(coord.x - colloredoUnit.pos.x),
          Math.abs(coord.z - colloredoUnit.pos.z),
        )
      : Infinity;
    const capturePursuitScore = colloredoUnit
      ? Math.max(0, (18 - distToColloredo) * 12)
      : 0;

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
        // evaluateVisibleTargets již garantuje, že cíl není hrabě Colloredo
        // ani spojenec do 3 políček od hraběte, pokud na hraběte střelec vidí!
        const bestTarget = targets[0]!;
        const shotScore =
          bestTarget.calculation.hitChance * 1.4 +
          (bestTarget.calculation.isFlanked ? 25 : 0);
        candidates.push({
          coord,
          apCost,
          score:
            100 +
            coverScore +
            heightScore +
            shotScore +
            capturePursuitScore -
            apCost * 6,
          bestTargetId: bestTarget.targetId,
        });
        return;
      }
    }

    const distDiff = Math.abs(nearestDist - 6);
    candidates.push({
      coord,
      apCost,
      score:
        coverScore +
        heightScore +
        capturePursuitScore -
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
    return { movePath: [], moveApCost: 0, targetId: null, isCaptureAction: false };
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

  const isCaptureAction =
    colloredoUnit && chosen.bestTargetId === "player-colloredo";

  return {
    movePath,
    moveApCost: chosen.apCost,
    targetId: chosen.bestTargetId,
    doorToOpen,
    isCaptureAction: Boolean(isCaptureAction),
  };
}

/**
 * Aplikuje nebo ruší zadýmení a záchvat kašle (ADR-0011):
 * - Jednotka v uzavřeném zastřešeném interiéru (isEnclosedRoofedCoord) s aktivním kouřem (smokeTurns > 0)
 *   obdrží záchvat kašle (-1 Pohyb pro nadcházející tah).
 * - Vojáci s neporušenou těžkou zbrojí (armor > 0 a hp === maxHp, např. maršál Colloredo a kyrysníci)
 *   jsou díky nákrčníku a morionu imunní (Cuirassier Respiratory Resistance).
 */
export function applyBlackPowderChoking(
  units: UnitData[],
  grid: GridSystem,
): UnitData[] {
  return units.map((u) => {
    if (!u.alive) return u;
    const tile = grid.getTile(u.pos);
    const inIndoorSmoke =
      isEnclosedRoofedCoord(u.pos.x, u.pos.y, u.pos.z) &&
      (tile?.smokeTurns ?? 0) > 0;

    // Cuirassier Respiratory Resistance: plná zbroj a plné zdraví chrání dýchací cesty
    const hasRespiratoryResistance = u.armor > 0 && u.hp === u.maxHp;
    const isChoking = inIndoorSmoke && !hasRespiratoryResistance;

    const basePace =
      u.id === "player-colloredo"
        ? 3
        : soldierMovePerAp(u.weapon);

    const nextMovePerAp = isChoking ? Math.max(1, basePace - 1) : basePace;

    let buffTitle = u.buffTitle;
    if (isChoking) {
      if (!buffTitle || buffTitle.includes("Záchvat kašle")) {
        buffTitle = "Záchvat kašle (zadýmení interiéru: -1 Pohyb)";
      }
    } else if (buffTitle === "Záchvat kašle (zadýmení interiéru: -1 Pohyb)") {
      buffTitle = undefined;
    }

    return {
      ...u,
      isChoking,
      movePerAp: (u.detainedTurns ?? 0) > 0 ? 0 : nextMovePerAp,
      buffTitle,
    };
  });
}
