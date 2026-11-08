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
  const points: GridCoord[] = [];
  let x1 = start.x;
  let y1 = start.y as number;
  let z1 = start.z;
  const x2 = end.x;
  const y2 = end.y as number;
  const z2 = end.z;

  points.push({ x: x1, y: (y1 > 0 ? 1 : 0) as FloorLevel, z: z1 });

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
      points.push({ x: x1, y: (y1 > 0 ? 1 : 0) as FloorLevel, z: z1 });
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
      points.push({ x: x1, y: (y1 > 0 ? 1 : 0) as FloorLevel, z: z1 });
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
      points.push({ x: x1, y: (y1 > 0 ? 1 : 0) as FloorLevel, z: z1 });
    }
  }

  return points;
}

/**
 * Ověří přímou viditelnost (Line of Sight) pomocí 3D Bresenhamova algoritmu nad datovou mřížkou.
 * Vysoké zdi (`high_wall`), pilíře (`pillar`) a plné stropy horního patra blokují výhled.
 */
export function checkLineOfSight3D(
  grid: GridSystem,
  from: GridCoord,
  to: GridCoord,
): { clear: boolean; ray: GridCoord[] } {
  const ray = bresenham3D(from, to);
  if (ray.length <= 2) {
    return { clear: true, ray };
  }

  for (let i = 1; i < ray.length - 1; i++) {
    const cell = ray[i]!;
    const tile = grid.getTile(cell);
    if (!tile) return { clear: false, ray };

    // Vysoké zdi a kamenné pilíře blokují přímou viditelnost
    if (tile.obstacle === "high_wall" || tile.obstacle === "pillar") {
      return { clear: false, ray };
    }

    // Přechod paprsku mezi patry: plná podlaha horního patra blokuje výhled dovnitř přízemí,
    // pokud nejde o žebřík nebo střelbu přes okraj střechy.
    if (from.y !== to.y && cell.y === 0) {
      const roofAbove = grid.getTile({ x: cell.x, y: 1, z: cell.z });
      const prevCell = ray[i - 1]!;
      const nextCell = ray[i + 1]!;
      const crossingSlabHere = prevCell.y !== nextCell.y || cell.y !== from.y;
      if (
        crossingSlabHere &&
        roofAbove &&
        roofAbove.hasFloor &&
        !roofAbove.isLadder
      ) {
        const upperEnd = from.y === 1 ? from : to;
        const distFromUpper =
          Math.abs(cell.x - upperEnd.x) + Math.abs(cell.z - upperEnd.z);
        if (distFromUpper > 1) {
          return { clear: false, ray };
        }
      }
    }
  }

  return { clear: true, ray };
}

/**
 * Určí světovou stranu (N, E, S, W), ze které přilétá výstřel na cílovou dlaždici,
 * a vrátí úroveň krytu cíle v tomto směru.
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

    // E) Kouř z černého prachu (Black Powder Smoke: -20 %)
    const shooterInSmoke = (shooterTile?.smokeTurns ?? 0) > 0;
    const targetInSmoke = (targetTile?.smokeTurns ?? 0) > 0;
    const smokeModifier = shooterInSmoke || targetInSmoke ? -20 : 0;
    if (smokeModifier !== 0) {
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

    // H) Autorita polního maršála Colloreda (+8 % pro spojence v okruhu 7 polí)
    let marshalModifier = 0;
    if (shooter.faction === "player" && battlefield.units) {
      const colloredo = battlefield.units.find(
        (u) => u.id === "player-colloredo" && u.alive,
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
      marshalModifier;

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

    const rawCritChance =
      weapon.baseCritChance +
      flankCritModifier +
      pointBlankCritModifier +
      armorCritPenalty;
    const critChance = Math.max(0, Math.min(100, Math.round(rawCritChance)));

    // E) Informace o průrazu a zničení zbroje (Armor Pierce / Armor Shred) v pravém křídle
    if (weapon.armorPierce > 0) {
      critModifiers.push({
        id: "weapon-armor-pierce",
        label: "Průraz zbroje (Armor Pierce)",
        detail: "Kolik bodů kyrysu cíle výstřel zcela ignoruje",
        value: weapon.armorPierce,
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
    const misfireChance = Math.max(
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
      remainingArmorAfterShred - weapon.armorPierce,
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
      armorPierce: weapon.armorPierce,
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
 * Vrací pouze cíle, které jsou v dosahu zbraně a mají čistou 3D Bresenhamovu přímou viditelnost (LoS).
 */
export function evaluateVisibleTargets(
  grid: GridSystem,
  attacker: UnitData,
  allUnits: UnitData[],
  weather: WeatherType = "clear",
  fromPos: GridCoord = attacker.pos,
): TargetEvaluation[] {
  const results: TargetEvaluation[] = [];

  for (const unit of allUnits) {
    if (!unit.alive || unit.faction === attacker.faction) continue;
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
  const rawDamage =
    rawRollDamage + (critical ? attacker.weapon.critBonusDamage : 0);

  // Destrukce zbroje (Shred) a průraz (Pierce)
  const armorShredded = Math.min(target.armor, attacker.weapon.armorShred);
  const remainingArmor = Math.max(0, target.armor - armorShredded);
  // Kritický zásah pronikne mimo zbroj (ignoruje +1 bod zbroje navíc)
  const effectivePierce =
    attacker.weapon.armorPierce + (critical ? 1 : 0);
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
  const players = allUnits.filter((u) => u.alive && u.faction === "player");
  if (players.length === 0 || !enemy.alive || enemy.ap <= 0) {
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

    let nearestPlayer = players[0]!;
    let nearestDist = Infinity;
    for (const p of players) {
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

    const colloredo = players.find((p) => p.id === "player-colloredo");

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
        // Prioritně cílí na Colloreda, pokud je v palebném poli.
        const colloredoTarget = targets.find((t) => t.targetId === "player-colloredo");
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
          score: 100 + coverScore + heightScore + shotScore - apCost * 6,
          bestTargetId: bestTarget.targetId,
        });
        return;
      }
    }

    const distDiff = Math.abs(nearestDist - 6);
    const interceptScore = colloredo ? Math.max(0, (12 - gridDistance3D(coord, colloredo.pos)) * 4) : 0;
    candidates.push({
      coord,
      apCost,
      score: coverScore + heightScore + interceptScore - distDiff * 6,
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

  return {
    movePath,
    moveApCost: chosen.apCost,
    targetId: chosen.bestTargetId,
  };
}
