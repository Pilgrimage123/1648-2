import { nextAction } from "./ai";
import { createMixer, type SoundName } from "./audio";
import {
  commitAttack,
  evaluateShot,
  hitChance,
  mitigate,
  reasonLine,
  rollAttack,
  scatterTile,
  unitsInBlast,
} from "./combat";
import {
  COLS,
  COVER_FULL,
  COVER_HALF,
  HOLD_SPAWNS,
  HRADBA_RANGE,
  MOVE_PER_AP,
  ROWS,
  SPAWNS,
  TILE_LABEL,
  WEAPONS,
} from "./config";
import {
  ageClock,
  at,
  boards,
  chebyshev,
  coverValue,
  flood,
  hasLineOfSight,
  occupied,
  placeSmoke,
  reconstruct,
  walkable,
} from "./map";
import { firearm, healAmount, sailInfo } from "./orders";
import type { Fx, MarkKind, PaintUnit, View } from "./render";
import { createScene3D, type SceneOverlayCallback } from "./scene3d";
import { project } from "./snapshot";
import { accName, defeatTale, victoryTale } from "./story";
import type {
  AimArcData,
  CameraPreset,
  CoverDir,
  LightingMood,
  MovePreviewData,
  Sim,
  Snapshot,
  Unit,
} from "./types";
import {
  armorLabel,
  createSim,
  gunLoaded,
  hasDefender,
  hasHope,
  living,
  makeSwede,
  markLoaded,
  pushLog,
  syncLoaded,
  unitById,
} from "./units";

type Visual = { x: number; y: number; lunge: number; flash: number };
type Motion = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  done: boolean;
};

const HOVER0 = "Palác za zády. Vltava vpravo.";

export type GameHandle = {
  destroy: () => void;
  begin: () => void;
  unlock: () => void;
  endTurn: () => void;
  reload: () => void;
  prayer: () => void;
  hradba: () => void;
  startRozkaz: () => void;
  sail: () => void;
  setWeapon: (id: string) => void;
  activate: (id: string) => void;
  focusUnit: (id: string) => void;
  centerSelected: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  rotateCamera: (dir: 1 | -1) => void;
  panCamera: (dx: number, dz: number) => void;
  toggleActionCam: () => void;
  setLightingMood: (mood: LightingMood) => void;
  cycleLightingMood: () => void;
  restart: () => void;
  toggleMute: () => void;
};

export function createBriefingSnapshot(): Snapshot {
  return project(
    createSim(),
    {
      selectedId: null,
      mode: "normal",
      hoverText: HOVER0,
      hoverTile: null,
      aimPreview: null,
      movePreview: null,
      busy: false,
      muted: false,
      actionCamEnabled: true,
      cameraPreset: "isometric",
      lightingMood: "auto",
      banner: "",
    },
    null,
  );
}

function computeCoverDirs(sim: Sim, x: number, y: number): CoverDir[] {
  const tile = at(sim.tiles, x, y);
  if (!tile || tile === "wall" || tile === "river") return [];
  const dirs: CoverDir[] = [];
  const cardinals: readonly (readonly [number, number])[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const onHalfTile =
    tile === "cart" ||
    tile === "rubble" ||
    sim.smokes.some((s) => s.x === x && s.y === y);

  for (const [dx, dy] of cardinals) {
    const adj = at(sim.tiles, x + dx, y + dy);
    if (adj === "wall") {
      dirs.push({ dx, dy, amount: COVER_FULL });
    } else if (adj === "cart" || adj === "rubble" || onHalfTile) {
      dirs.push({ dx, dy, amount: COVER_HALF });
    }
  }
  return dirs;
}

export function createGame(
  mountEl: HTMLElement,
  onChange: (snap: Snapshot) => void,
  onOverlayProject: SceneOverlayCallback,
): GameHandle {
  const audio = createMixer();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let epoch = 1;
  let dead = false;
  let state = createSim();
  let visuals: Record<string, Visual> = {};
  let fx: Fx[] = [];
  let shake = 0;
  let time = 0;
  let speed = 1;
  let busy = false;
  let muted = false;
  let actionCamEnabled = !reduce;
  let cameraPreset: CameraPreset = "isometric";
  let lightingMood: LightingMood = "auto";
  let audioOn = false;
  let selectedId: string | null = null;
  let mode: "normal" | "rozkaz" = "normal";
  let hoverText = HOVER0;
  let hover: { x: number; y: number } | null = null;
  let epilogue: Snapshot["epilogue"] = null;
  let motion: Motion | null = null;
  let timer: { left: number; resolve: () => void; token: number } | null = null;
  let waiter: { pred: () => boolean; resolve: () => void; token: number } | null = null;
  let last = performance.now();
  let raf = 0;

  function bootVisuals(sim: Sim): Record<string, Visual> {
    const next: Record<string, Visual> = {};
    for (const u of sim.units) next[u.id] = { x: u.x, y: u.y, lunge: 0, flash: 0 };
    return next;
  }
  visuals = bootVisuals(state);

  function computeAimPreview(hx: number, hy: number): AimArcData | null {
    const sel = unitById(state, selectedId);
    if (!sel || !sel.alive || sel.embarked || sel.faction !== "imperial") return null;
    if (state.turn !== "player" || busy || mode === "rozkaz") return null;
    const armed = sel.weapons[sel.weaponIndex];
    if (!armed) return null;

    const stood = living(state.units).find((u) => u.x === hx && u.y === hy) ?? null;

    if (armed.delivery === "throw") {
      const dist = chebyshev(sel.x, sel.y, hx, hy);
      const stock = sel.stock[armed.id] ?? 0;
      if (stock <= 0 || dist < 1 || dist > armed.range) return null;
      const los = hasLineOfSight(state.tiles, sel.x, sel.y, hx, hy);
      if (!los) return null;
      const chance = hitChance(sel, armed, dist, 0);
      const hasAp = sel.ap >= armed.ap;
      return {
        x0: sel.x,
        y0: sel.y,
        x1: hx,
        y1: hy,
        delivery: "throw",
        chance,
        cover: 0,
        damage: armed.damage,
        weaponName: armed.short,
        valid: hasAp,
        reasonText: hasAp ? `Hod ${chance} % · Oblast 3×3` : "Granát stojí celý tah (2 AP)",
        blastRadius: armed.blast,
      };
    }

    if (armed.delivery === "place") {
      if (at(state.tiles, hx, hy) !== "wall") return null;
      const dist = chebyshev(sel.x, sel.y, hx, hy);
      const stock = sel.stock[armed.id] ?? 0;
      const valid = stock > 0 && dist <= armed.range && sel.ap >= armed.ap;
      return {
        x0: sel.x,
        y0: sel.y,
        x1: hx,
        y1: hy,
        delivery: "place",
        chance: 100,
        cover: 0,
        damage: armed.damage,
        weaponName: armed.short,
        valid,
        reasonText: valid
          ? "Petarda zboří zeď v suť"
          : "Petarda patří na sousední zeď (2 AP)",
        blastRadius: armed.blast,
      };
    }

    if (stood && stood.faction === "swedish") {
      const info = evaluateShot(sel, sel.x, sel.y, stood, state.tiles, state.smokes);
      const w = sel.weapons[info.weaponIndex] ?? armed;
      return {
        x0: sel.x,
        y0: sel.y,
        x1: stood.x,
        y1: stood.y,
        delivery: "shot",
        chance: info.chance,
        cover: info.cover,
        damage: w.damage,
        weaponName: w.short,
        valid: info.reason === "ok",
        reasonText:
          info.reason === "ok"
            ? `${w.short} · Zásah ${info.chance} % · Kryt ${info.cover} %`
            : reasonLine(info, sel),
        blastRadius: 0,
      };
    }

    return null;
  }

  function computeMovePreview(hx: number, hy: number): MovePreviewData | null {
    const sel = unitById(state, selectedId);
    if (!sel || !sel.alive || sel.embarked || sel.faction !== "imperial") return null;
    if (state.turn !== "player" || busy || mode === "rozkaz") return null;
    const body = living(state.units).find((u) => u.x === hx && u.y === hy);
    if (body) return null;

    const nodes = flood(
      state.tiles,
      occupied(state.units, sel.id),
      sel.x,
      sel.y,
      sel.ap * MOVE_PER_AP,
      boards(sel, state.phase),
    );
    const node = nodes.get(`${hx},${hy}`);
    if (!node || node.steps <= 0) return null;

    const costAp: 1 | 2 = node.steps <= MOVE_PER_AP ? 1 : 2;
    const apRemaining = Math.max(0, sel.ap - costAp);
    const isDash = costAp === 2 || sel.ap === 1;

    const dirs = computeCoverDirs(state, hx, hy);
    let maxCov: 0 | 25 | 50 = 0;
    for (const d of dirs) {
      if (d.amount > maxCov) maxCov = d.amount;
    }

    const label =
      sel.ap === 2
        ? costAp === 1
          ? "1. akce · Modrý pohyb"
          : "2. akce · Zlatý chvat"
        : "Poslední akce · Přesun";

    const detail =
      sel.ap === 2
        ? costAp === 1
          ? `Zbude ${apRemaining} AP pro střelbu či rozkaz`
          : "Spotřebuje celý zbývající tah hrdiny!"
        : "Hrdina vyčerpá všechny akční body";

    return {
      x: hx,
      y: hy,
      steps: node.steps,
      apCost: costAp,
      apRemaining,
      isDash,
      cover: maxCov,
      label,
      detail,
    };
  }

  function banner(): string {
    if (state.turn === "enemy") return "TAH ŠVÉDŮ";
    if (state.phase === "dock") return "LOĎKA ČEKÁ";
    if (state.phase === "hold") return `BŘEH · ${state.holdLeft}`;
    return "";
  }

  function emit(): void {
    if (dead) return;
    if (hover && state.phase !== "briefing") {
      hoverText = describe(hover.x, hover.y);
    }
    const aimPreview =
      hover && state.phase !== "briefing" ? computeAimPreview(hover.x, hover.y) : null;
    const movePreview =
      hover && state.phase !== "briefing" ? computeMovePreview(hover.x, hover.y) : null;
    onChange(
      project(
        state,
        {
          selectedId,
          mode,
          hoverText,
          hoverTile: hover,
          aimPreview,
          movePreview,
          busy,
          muted,
          actionCamEnabled,
          cameraPreset,
          lightingMood,
          banner: banner(),
        },
        epilogue,
      ),
    );
  }

  function unlock(): void {
    audio.unlock();
    audioOn = true;
  }

  function nudge(): void {
    if (audioOn) audio.unlock();
  }

  function play(name: SoundName): void {
    if (audioOn) audio.play(name);
  }

  function wait(token: number, sec: number): Promise<void> {
    return new Promise((resolve) => {
      if (token !== epoch) {
        resolve();
        return;
      }
      timer = { left: sec, resolve, token };
    });
  }

  function waitUntil(token: number, pred: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      if (token !== epoch || pred()) {
        resolve();
        return;
      }
      waiter = { pred, resolve, token };
    });
  }

  function update(dt: number): void {
    time += dt;
    if (motion && !motion.done) {
      motion.t += dt * speed;
      const k = Math.min(1, motion.t / motion.dur);
      const e = k * k * (3 - 2 * k);
      const vis = visuals[motion.id];
      if (vis) {
        vis.x = motion.x0 + (motion.x1 - motion.x0) * e;
        vis.y = motion.y0 + (motion.y1 - motion.y0) * e;
      }
      if (motion.t >= motion.dur) motion.done = true;
    }
    for (const item of fx) {
      item.t += dt;
      if (item.kind === "spark") {
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.vy += dt * 1.4;
      }
    }
    fx = fx.filter((item) => item.t < item.life);
    if (shake > 0) shake = Math.max(0, shake - dt * 22);
    for (const vis of Object.values(visuals)) {
      vis.lunge = Math.max(0, vis.lunge - dt * 3.2);
      vis.flash = Math.max(0, vis.flash - dt * 2.4);
    }
    if (timer) {
      if (timer.token !== epoch) {
        const resolve = timer.resolve;
        timer = null;
        resolve();
      } else {
        timer.left -= dt * speed;
        if (timer.left <= 0) {
          const resolve = timer.resolve;
          timer = null;
          resolve();
        }
      }
    }
    if (waiter && (waiter.token !== epoch || waiter.pred())) {
      const resolve = waiter.resolve;
      waiter = null;
      resolve();
    }
  }

  function textFx(x: number, y: number, text: string, color: string): void {
    fx.push({ kind: "text", x, y, text, color, t: 0, life: 1.05 });
  }

  function sparks(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      fx.push({
        kind: "spark",
        x: x + 0.5,
        y: y + 0.5,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -Math.random() * 0.9,
        t: 0,
        life: 0.48,
        color,
      });
    }
  }

  function markDeath(unit: Unit): void {
    if (!unit.alive) return;
    unit.alive = false;
    unit.hp = 0;
    unit.ap = 0;
    unit.overwatch = false;
    if (selectedId === unit.id) selectedId = null;
    state.decals.push({ x: unit.x, y: unit.y });
    play("death");
    if (unit.vip) {
      state.pendingEnd = "colloredo";
      return;
    }
    if (unit.faction === "swedish") {
      state.kills += 1;
      return;
    }
    if (unit.fate === "none") {
      const tile = at(state.tiles, unit.x, unit.y);
      unit.fate =
        state.phase === "hold" || tile === "quay" || tile === "boat" ? "bank" : "alley";
    }
    if (state.pendingEnd === "colloredo") return;
    if (state.phase === "hold") {
      if (!hasDefender(state)) state.pendingEnd = "victory";
    } else if (!hasHope(state)) state.pendingEnd = "nohero";
  }

  function resolvePending(): void {
    if (state.phase === "victory" || state.phase === "defeat") return;
    if (state.pendingEnd === "colloredo") finishDefeat("colloredo");
    else if (state.pendingEnd === "nohero") finishDefeat("nohero");
    else if (state.pendingEnd === "victory") finishVictory();
  }

  function finishDefeat(reason: "colloredo" | "nohero"): void {
    if (state.phase === "victory" || state.phase === "defeat") return;
    const col = state.units.find((u) => u.vip);
    const tile = col ? at(state.tiles, col.x, col.y) : null;
    const spot =
      tile === "boat" || tile === "quay" || (col && col.x >= 11) ? "water" : "street";
    state.pendingEnd = null;
    state.phase = "defeat";
    state.turn = "player";
    epilogue = defeatTale(reason, state.round, spot);
    play("death");
    emit();
  }

  function finishVictory(): void {
    if (state.phase === "victory" || state.phase === "defeat") return;
    const heroes = state.units.filter((u) => u.faction === "imperial" && !u.vip);
    for (const hero of heroes) {
      if (hero.embarked) hero.fate = "sailed";
      else if (hero.fate === "none") hero.fate = hero.alive ? "stood" : "alley";
    }
    state.pendingEnd = null;
    state.phase = "victory";
    state.turn = "player";
    epilogue = victoryTale(heroes, state.round, state.kills);
    play("sail");
    emit();
  }

  function syncDock(): void {
    const col = state.units.find((u) => u.vip);
    if (!col || !col.alive || col.embarked) return;
    if (state.phase !== "flight" && state.phase !== "dock") return;
    const onBoat = at(state.tiles, col.x, col.y) === "boat";
    if (onBoat && state.phase === "flight") {
      state.phase = "dock";
      pushLog(state, "Colloredo stojí v loďce. Přiveďte jednoho hrdinu na nábřeží.");
      play("sail");
    } else if (!onBoat && state.phase === "dock") {
      state.phase = "flight";
      pushLog(state, "Maršál sestoupil zpět na dlažbu.");
    }
  }

  async function glide(token: number, unit: Unit, tx: number, ty: number): Promise<void> {
    const vis = visuals[unit.id];
    if (!vis) return;
    motion = {
      id: unit.id,
      x0: vis.x,
      y0: vis.y,
      x1: tx,
      y1: ty,
      t: 0,
      dur: reduce ? 0.05 : 0.14,
      done: false,
    };
    await waitUntil(token, () => motion == null || motion.done);
    if (token !== epoch) return;
    const next = visuals[unit.id];
    if (next) {
      next.x = tx;
      next.y = ty;
    }
  }

  async function strikeHradba(token: number, enemy: Unit): Promise<boolean> {
    const jakub = state.units.find(
      (u) => u.archetype === "jakub" && u.alive && !u.embarked && u.overwatch,
    );
    if (!jakub || !enemy.alive) return false;
    const now = chebyshev(enemy.x, enemy.y, jakub.x, jakub.y);
    if (now > HRADBA_RANGE) return false;
    if (!hasLineOfSight(state.tiles, jakub.x, jakub.y, enemy.x, enemy.y)) return false;
    jakub.facing = enemy.x >= jakub.x ? 1 : -1;
    if (actionCamEnabled) {
      scene3d.triggerActionCam({
        ax: jakub.x,
        ay: jakub.y,
        tx: enemy.x,
        ty: enemy.y,
        holdSec: 0.45,
      });
    }
    const dmg = WEAPONS.halberd.damage;
    const blow = mitigate(enemy, WEAPONS.halberd, dmg);
    jakub.overwatch = false;
    enemy.ap = 0;
    const vis = visuals[jakub.id];
    if (vis) vis.lunge = 1;
    if (!reduce) shake = 7;
    play("blade");
    textFx(enemy.x, enemy.y, `HRADBA −${blow.dealt}`, "#ead9b8");
    fx.push({ kind: "slash", x: enemy.x, y: enemy.y, t: 0, life: 0.28 });
    if (enemy.hp <= 0) {
      markDeath(enemy);
      pushLog(state, `Hradba. ${enemy.name} naběhl na halapartnu a padl.`);
    } else {
      play("hurt");
      const plate = blow.stopped > 0 ? ` Zbroj ubrala ${blow.stopped}.` : "";
      pushLog(state, `Hradba zastavila ${accName(enemy.name)} (−${blow.dealt}).${plate}`);
    }
    await wait(token, 0.24);
    return true;
  }

  async function performMove(
    token: number,
    unit: Unit,
    destX: number,
    destY: number,
  ): Promise<void> {
    const allowBoat = boards(unit, state.phase);
    const nodes = flood(
      state.tiles,
      occupied(state.units, unit.id),
      unit.x,
      unit.y,
      Math.max(MOVE_PER_AP, unit.ap * MOVE_PER_AP),
      allowBoat,
    );
    const path = reconstruct(nodes, destX, destY);
    if (path.length === 0) {
      if (token === epoch && unit.faction === "imperial")
        pushLog(state, "Tam cesta nevede.");
      return;
    }
    const trimmed = path.slice(0, unit.ap * MOVE_PER_AP);
    const cost = Math.ceil(trimmed.length / MOVE_PER_AP);
    if (trimmed.length === 0 || cost > unit.ap) return;
    unit.ap -= cost;
    if (unit.faction === "imperial") {
      pushLog(state, `${unit.name} postoupil o ${pole(trimmed.length)}.`);
    }
    if (unit.overwatch) {
      unit.overwatch = false;
      pushLog(state, "Hradba povolila — Jakub se pohnul.");
    }
    let prev = { x: unit.x, y: unit.y };
    for (const step of trimmed) {
      if (step.x > prev.x) unit.facing = 1;
      else if (step.x < prev.x) unit.facing = -1;
      await glide(token, unit, step.x, step.y);
      if (token !== epoch) return;
      unit.x = step.x;
      unit.y = step.y;
      const vis = visuals[unit.id];
      if (vis) {
        vis.x = step.x;
        vis.y = step.y;
      }
      if (unit.faction === "swedish") {
        const stopped = await strikeHradba(token, unit);
        if (token !== epoch || stopped || state.pendingEnd) return;
      }
      prev = { x: step.x, y: step.y };
      if (unit.vip) syncDock();
    }
  }

  async function performAttack(
    token: number,
    attacker: Unit,
    defender: Unit,
    weaponIndex: number,
  ): Promise<void> {
    const weapon = attacker.weapons[weaponIndex];
    if (!weapon || !defender.alive || defender.embarked || attacker.ap < weapon.ap) return;
    if (weapon.delivery !== "shot") return;
    if (weapon.firearm && !attacker.ready.includes(weapon.id)) return;
    const dist = chebyshev(attacker.x, attacker.y, defender.x, defender.y);
    if (dist <= 0 || dist > weapon.range) return;
    if (!hasLineOfSight(state.tiles, attacker.x, attacker.y, defender.x, defender.y)) return;
    const cover = coverValue(
      state.tiles,
      state.smokes,
      defender.x,
      defender.y,
      attacker.x,
      attacker.y,
    );
    const chance = hitChance(attacker, weapon, dist, cover);
    attacker.ap -= weapon.ap;
    if (attacker.overwatch) attacker.overwatch = false;
    attacker.facing = defender.x >= attacker.x ? 1 : -1;

    if (actionCamEnabled && (attacker.faction === "imperial" || speed === 1)) {
      scene3d.triggerActionCam({
        ax: attacker.x,
        ay: attacker.y,
        tx: defender.x,
        ty: defender.y,
        holdSec: attacker.faction === "imperial" ? 0.55 : 0.35,
      });
      await wait(token, attacker.faction === "imperial" ? 0.16 : 0.08);
      if (token !== epoch) return;
    }

    const result = rollAttack(state, weapon, chance, attacker.blessing);
    const vis = visuals[attacker.id];
    if (vis) vis.lunge = 1;
    if (weapon.firearm) {
      play(weapon.id === "pistol" ? "pistol" : "shot");
      fx.push({
        kind: "line",
        x0: attacker.x,
        y0: attacker.y,
        x1: defender.x,
        y1: defender.y,
        t: 0,
        life: 0.22,
        color: "#f3e2b0",
      });
    } else {
      play("blade");
      fx.push({ kind: "slash", x: defender.x, y: defender.y, t: 0, life: 0.28 });
    }
    await wait(token, weapon.firearm ? 0.14 : 0.12);
    if (token !== epoch) return;
    commitAttack(state, attacker, defender, weapon, result);
    const deadNow = result.hit && defender.hp <= 0;
    if (result.misfire) {
      textFx(attacker.x, attacker.y, "SELHÁNÍ", "#ead9b8");
      pushLog(state, `${attacker.name}: doutnák sykl ve vlhku. ${weapon.name} selhala.`);
    } else if (result.hit) {
      textFx(defender.x, defender.y, `−${result.damage}`, "#e7b4b0");
      sparks(defender.x, defender.y, "#8f2433");
      if (!reduce) shake = deadNow ? 8 : 4;
      play("hurt");
      const plate = result.stopped > 0 ? ` Zbroj ubrala ${result.stopped}.` : "";
      const torn = result.shredded > 0 ? " Zbroj povolila." : "";
      const tail = deadNow ? " Padá." : "";
      pushLog(
        state,
        result.damage > 0
          ? `${attacker.name} zasáhl ${accName(defender.name)} (${chance} %, −${result.damage}).${plate}${torn}${tail}`
          : `${attacker.name} zasáhl ${accName(defender.name)}, ale zbroj ránu zastavila.${torn}`,
      );
    } else {
      textFx(defender.x, defender.y, "MIMO", "#ead9b8");
      pushLog(state, `${attacker.name} minul ${accName(defender.name)} (${chance} %).`);
    }
    if (defender.hp <= 0) markDeath(defender);
    const hitVis = visuals[defender.id];
    if (hitVis && result.hit) hitVis.flash = 1;
    await wait(token, 0.22);
  }

  function blastLine(
    victims: { name: string; dealt: number; stopped: number; shredded: number }[],
  ): string {
    if (victims.length === 0) return "Nikoho nestrhl.";
    return victims
      .map((v) => {
        const plate = v.stopped > 0 ? `, zbroj −${v.stopped}` : "";
        const torn = v.shredded > 0 ? ", zbroj povolila" : "";
        return `${v.name} −${v.dealt}${plate}${torn}`;
      })
      .join("; ");
  }

  async function performThrow(
    token: number,
    attacker: Unit,
    tx: number,
    ty: number,
    weaponIndex: number,
  ): Promise<void> {
    const weapon = attacker.weapons[weaponIndex];
    if (!weapon || weapon.delivery !== "throw") return;
    if ((attacker.stock[weapon.id] ?? 0) <= 0 || attacker.ap < weapon.ap) return;
    const dist = chebyshev(attacker.x, attacker.y, tx, ty);
    if (dist <= 0 || dist > weapon.range) return;
    if (!hasLineOfSight(state.tiles, attacker.x, attacker.y, tx, ty)) return;
    attacker.ap -= weapon.ap;
    attacker.stock[weapon.id] = (attacker.stock[weapon.id] ?? 1) - 1;
    if (attacker.overwatch) attacker.overwatch = false;
    attacker.facing = tx >= attacker.x ? 1 : -1;

    if (actionCamEnabled) {
      scene3d.triggerActionCam({
        ax: attacker.x,
        ay: attacker.y,
        tx,
        ty,
        holdSec: 0.6,
      });
      await wait(token, 0.16);
      if (token !== epoch) return;
    }

    const chance = hitChance(attacker, weapon, dist, 0);
    let landX = tx;
    let landY = ty;
    let how = "zásah";
    if (!attacker.blessing && weapon.misfire > 0 && state.rng() < weapon.misfire) {
      landX = attacker.x;
      landY = attacker.y;
      how = "selhání";
    } else if (state.rng() * 100 >= chance) {
      const spot = scatterTile(state, tx, ty);
      landX = spot.x;
      landY = spot.y;
      how = "odskok";
    }
    if (attacker.blessing) attacker.blessing = false;
    const vis = visuals[attacker.id];
    if (vis) vis.lunge = 1;
    play("boom");
    if (!reduce) {
      shake = 9;
      scene3d.triggerLightning(0.72);
    }
    fx.push({ kind: "ring", x: landX, y: landY, t: 0, life: 0.45, color: "#e07a3a" });
    sparks(landX, landY, "#ff9d3b");
    await wait(token, 0.14);
    if (token !== epoch) return;
    const hurt: { name: string; dealt: number; stopped: number; shredded: number }[] = [];
    for (const victim of unitsInBlast(state, landX, landY, weapon.blast)) {
      const blow = mitigate(victim, weapon, weapon.damage);
      hurt.push({
        name: accName(victim.name),
        dealt: blow.dealt,
        stopped: blow.stopped,
        shredded: blow.shredded,
      });
      textFx(victim.x, victim.y, blow.dealt > 0 ? `−${blow.dealt}` : "ZBROJ", "#e7b4b0");
      const hitVis = visuals[victim.id];
      if (hitVis) hitVis.flash = 1;
      if (victim.hp <= 0) markDeath(victim);
    }
    placeSmoke(state.smokes, state.clock, landX, landY);
    const where =
      how === "selhání"
        ? "doutnák selhal a granát bouchl u nohou"
        : how === "odskok"
          ? "granát minul pole a odskočil"
          : "granát dopadl";
    pushLog(state, `${attacker.name}: ${where} (${chance} %). ${blastLine(hurt)}`);
    await wait(token, 0.22);
  }

  async function performPetard(
    token: number,
    unit: Unit,
    wx: number,
    wy: number,
  ): Promise<void> {
    const weapon = unit.weapons[unit.weaponIndex];
    if (!weapon || weapon.delivery !== "place") return;
    if ((unit.stock[weapon.id] ?? 0) <= 0 || unit.ap < weapon.ap) return;
    if (at(state.tiles, wx, wy) !== "wall") return;
    if (chebyshev(unit.x, unit.y, wx, wy) > weapon.range) return;
    unit.ap -= weapon.ap;
    unit.stock[weapon.id] = (unit.stock[weapon.id] ?? 1) - 1;
    if (unit.overwatch) unit.overwatch = false;
    unit.facing = wx >= unit.x ? 1 : -1;

    if (actionCamEnabled) {
      scene3d.triggerActionCam({
        ax: unit.x,
        ay: unit.y,
        tx: wx,
        ty: wy,
        holdSec: 0.65,
      });
      await wait(token, 0.16);
      if (token !== epoch) return;
    }

    const blessed = unit.blessing;
    if (unit.blessing) unit.blessing = false;
    if (!blessed && weapon.misfire > 0 && state.rng() < weapon.misfire) {
      const blow = mitigate(unit, weapon, weapon.damage);
      play("boom");
      if (!reduce) shake = 8;
      textFx(unit.x, unit.y, `−${blow.dealt}`, "#e7b4b0");
      if (unit.hp <= 0) markDeath(unit);
      else {
        const vis = visuals[unit.id];
        if (vis) vis.flash = 1;
      }
      pushLog(
        state,
        `Petarda bouchla ${unit.name === "Jakub" ? "Jakubovi" : unit.name} v dlaních (−${blow.dealt}). Zeď stojí.`,
      );
      await wait(token, 0.24);
      return;
    }
    const row = state.tiles[wy];
    if (row) row[wx] = "rubble";
    play("boom");
    if (!reduce) {
      shake = 10;
      scene3d.triggerLightning(0.88);
    }
    fx.push({ kind: "ring", x: wx, y: wy, t: 0, life: 0.5, color: "#c6a15a" });
    sparks(wx, wy, "#e2c27a");
    await wait(token, 0.14);
    if (token !== epoch) return;
    const hurt: { name: string; dealt: number; stopped: number; shredded: number }[] = [];
    for (const victim of unitsInBlast(state, wx, wy, weapon.blast)) {
      const blow = mitigate(victim, weapon, weapon.damage);
      hurt.push({
        name: accName(victim.name),
        dealt: blow.dealt,
        stopped: blow.stopped,
        shredded: blow.shredded,
      });
      textFx(victim.x, victim.y, blow.dealt > 0 ? `−${blow.dealt}` : "ZBROJ", "#e7b4b0");
      const hitVis = visuals[victim.id];
      if (hitVis) hitVis.flash = 1;
      if (victim.hp <= 0) markDeath(victim);
    }
    placeSmoke(state.smokes, state.clock, wx, wy);
    pushLog(state, `Petarda rozrazila zeď. Suť teď kryje napůl. ${blastLine(hurt)}`);
    await wait(token, 0.22);
  }

  function playing(): boolean {
    return (
      !busy &&
      state.turn === "player" &&
      (state.phase === "flight" || state.phase === "dock" || state.phase === "hold") &&
      state.pendingEnd == null
    );
  }

  async function doMove(unit: Unit, x: number, y: number): Promise<void> {
    const token = epoch;
    busy = true;
    emit();
    await performMove(token, unit, x, y);
    if (token !== epoch) return;
    busy = false;
    resolvePending();
    emit();
  }

  async function attackTarget(target: Unit): Promise<void> {
    const sel = unitById(state, selectedId);
    if (!sel || sel.faction !== "imperial" || !sel.alive || sel.embarked) {
      pushLog(state, "Nejprve vyberte císařského.");
      emit();
      return;
    }
    const armed = sel.weapons[sel.weaponIndex];
    if (armed?.delivery === "place") {
      pushLog(state, "Petarda patří na zeď.");
      emit();
      return;
    }
    if (armed?.delivery === "throw") {
      pushLog(state, "Granát se hází na pole v dostřelu, ne na muže mimo něj.");
      emit();
      return;
    }
    if (!playing()) return;
    const info = evaluateShot(sel, sel.x, sel.y, target, state.tiles, state.smokes);
    if (info.reason !== "ok") {
      pushLog(state, reasonLine(info, sel));
      emit();
      return;
    }
    const token = epoch;
    busy = true;
    emit();
    await performAttack(token, sel, target, info.weaponIndex);
    if (token !== epoch) return;
    busy = false;
    resolvePending();
    emit();
  }

  function onTile(x: number, y: number): void {
    unlock();
    if (state.turn === "enemy") {
      speed = 4;
      return;
    }
    if (!playing()) return;
    const stood = living(state.units).find((u) => u.x === x && u.y === y) ?? null;
    if (mode === "rozkaz") {
      const col = unitById(state, selectedId);
      if (
        stood &&
        col?.vip &&
        stood.faction === "imperial" &&
        stood.id !== col.id &&
        !stood.embarked
      ) {
        giveOrder(stood);
        emit();
        return;
      }
      mode = "normal";
      emit();
      return;
    }
    if (stood?.faction === "imperial") {
      selectedId = stood.id;
      hoverText = describe(x, y);
      play("ui");
      emit();
      return;
    }
    if (stood?.faction === "swedish") {
      const sel = unitById(state, selectedId);
      const armed = sel?.weapons[sel.weaponIndex];
      if (
        sel &&
        armed?.delivery === "throw" &&
        (sel.stock[armed.id] ?? 0) > 0 &&
        chebyshev(sel.x, sel.y, x, y) >= 1 &&
        chebyshev(sel.x, sel.y, x, y) <= armed.range &&
        hasLineOfSight(state.tiles, sel.x, sel.y, x, y)
      ) {
        if (sel.ap < armed.ap) {
          pushLog(state, "Granát stojí celý tah.");
          emit();
          return;
        }
        void doThrow(sel, x, y, sel.weaponIndex);
        return;
      }
      void attackTarget(stood);
      return;
    }
    const sel = unitById(state, selectedId);
    if (!sel || sel.faction !== "imperial" || !sel.alive || sel.embarked) return;
    const armed = sel.weapons[sel.weaponIndex];
    if (armed?.delivery === "place" && at(state.tiles, x, y) === "wall") {
      if ((sel.stock[armed.id] ?? 0) <= 0) {
        pushLog(state, "Petarda už je pryč.");
      } else if (chebyshev(sel.x, sel.y, x, y) > armed.range || sel.ap < armed.ap) {
        pushLog(state, "Petarda patří na sousední zeď a stojí celý tah.");
      } else {
        void doPetard(sel, x, y);
      }
      emit();
      return;
    }
    if (
      armed?.delivery === "throw" &&
      (sel.stock[armed.id] ?? 0) > 0 &&
      chebyshev(sel.x, sel.y, x, y) >= 1 &&
      chebyshev(sel.x, sel.y, x, y) <= armed.range &&
      hasLineOfSight(state.tiles, sel.x, sel.y, x, y)
    ) {
      if (sel.ap < armed.ap) {
        pushLog(state, "Granát stojí celý tah.");
        emit();
        return;
      }
      void doThrow(sel, x, y, sel.weaponIndex);
      return;
    }
    const nodes = flood(
      state.tiles,
      occupied(state.units, sel.id),
      sel.x,
      sel.y,
      sel.ap * MOVE_PER_AP,
      boards(sel, state.phase),
    );
    const node = nodes.get(`${x},${y}`);
    if (!node || node.steps <= 0) {
      if (at(state.tiles, x, y) === "boat" && !boards(sel, state.phase)) {
        pushLog(
          state,
          state.phase === "hold" ? "Loďka už odrazila." : "Na loďku smí jen Colloredo.",
        );
        emit();
      }
      return;
    }
    void doMove(sel, x, y);
  }

  function giveOrder(ally: Unit): void {
    const col = unitById(state, selectedId);
    if (
      !col?.vip ||
      col.ap < 1 ||
      ally.id === col.id ||
      !ally.alive ||
      ally.embarked ||
      ally.faction !== "imperial"
    ) {
      mode = "normal";
      return;
    }
    col.ap -= 1;
    ally.ap += 1;
    mode = "normal";
    play("ui");
    textFx(ally.x, ally.y, "+1 AP", "#e2c27a");
    pushLog(state, `Colloredo: „Držte linii.“ ${ally.name} získává 1 akční bod.`);
  }

  async function doThrow(
    unit: Unit,
    x: number,
    y: number,
    weaponIndex: number,
  ): Promise<void> {
    const token = epoch;
    busy = true;
    emit();
    await performThrow(token, unit, x, y, weaponIndex);
    if (token !== epoch) return;
    busy = false;
    resolvePending();
    emit();
  }

  async function doPetard(unit: Unit, x: number, y: number): Promise<void> {
    const token = epoch;
    busy = true;
    emit();
    await performPetard(token, unit, x, y);
    if (token !== epoch) return;
    busy = false;
    resolvePending();
    emit();
  }

  function findSpawn(): { x: number; y: number } | null {
    const blocked = occupied(state.units);
    const pool = state.phase === "hold" ? HOLD_SPAWNS : SPAWNS;
    for (const [x, y] of pool) {
      if (walkable(state.tiles, x, y, false) && !blocked.has(`${x},${y}`)) return { x, y };
    }
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (walkable(state.tiles, x, y, false) && !blocked.has(`${x},${y}`))
          return { x, y };
      }
    }
    return null;
  }

  function spawn(kind: "musketeer" | "pikeman" | "grenadier"): void {
    const spot = findSpawn();
    if (!spot) {
      pushLog(state, "Posila se v uličce zasekla.");
      return;
    }
    const typeName =
      kind === "grenadier"
        ? "Švédský granátník"
        : kind === "musketeer"
          ? "Švédský mušketýr"
          : "Švédský pikenýr";
    const id = `reinf-${state.seq++}`;
    const unit = makeSwede(kind, id, typeName, spot.x, spot.y);
    state.units.push(unit);
    visuals[id] = { x: spot.x, y: spot.y, lunge: 0, flash: 0 };
    pushLog(
      state,
      kind === "grenadier"
        ? "Od paláce se řítí Švédský granátník s granátem."
        : `Od paláce se řítí ${typeName}.`,
    );
  }

  async function runEnemies(token: number): Promise<void> {
    state.turn = "enemy";
    const agedIn = ageClock(state.clock, state.smokes);
    state.clock = agedIn.clock;
    state.smokes = agedIn.smokes;
    for (const unit of state.units) {
      if (unit.faction === "swedish" && unit.alive) unit.ap = unit.maxAp;
    }
    pushLog(state, "Švédové postupují ulicemi.");
    emit();
    const ids = state.units
      .filter((u) => u.faction === "swedish" && u.alive)
      .map((u) => u.id);
    for (const id of ids) {
      if (token !== epoch || state.pendingEnd) return;
      const unit = unitById(state, id);
      if (!unit?.alive) continue;
      for (let n = 0; n < 4; n++) {
        if (token !== epoch || state.pendingEnd || !unit.alive || unit.ap <= 0) break;
        const action = nextAction(state, unit);
        if (!action) break;
        if (action.type === "move") await performMove(token, unit, action.x, action.y);
        else if (action.type === "throw")
          await performThrow(token, unit, action.x, action.y, action.weaponIndex);
        else if (action.type === "reload") {
          const gun = firearm(unit);
          if (!gun || unit.ap < gun.reloadAp) break;
          unit.ap -= gun.reloadAp;
          markLoaded(unit, gun.id);
          play("reload");
          pushLog(state, `${unit.name} nabíjí.`);
          await wait(token, 0.16);
        } else {
          const target = unitById(state, action.targetId);
          if (!target?.alive) break;
          await performAttack(token, unit, target, action.weaponIndex);
        }
        if (token !== epoch) return;
        emit();
      }
    }
    if (token !== epoch) return;
    if (state.pendingEnd === "colloredo") return finishDefeat("colloredo");
    if (state.pendingEnd === "nohero") return finishDefeat("nohero");
    if (state.pendingEnd === "victory") return finishVictory();
    if (state.phase === "hold") {
      state.holdLeft -= 1;
      if (state.holdLeft <= 0) return finishVictory();
      if (state.holdLeft === 2) spawn("pikeman");
      if (state.holdLeft === 1) spawn("grenadier");
      if (!hasDefender(state)) return finishVictory();
      const verb = state.holdLeft === 1 ? "Zbývá" : "Zbývají";
      const word = state.holdLeft === 1 ? "náraz" : "nárazy";
      pushLog(state, `Proud cloumá loďkou. ${verb} ${state.holdLeft} ${word}.`);
    }
    state.turn = "player";
    const agedOut = ageClock(state.clock, state.smokes);
    state.clock = agedOut.clock;
    state.smokes = agedOut.smokes;
    state.round += 1;
    speed = 1;
    for (const unit of state.units) {
      if (unit.faction !== "imperial") continue;
      unit.overwatch = false;
      if (unit.alive && !unit.embarked) unit.ap = unit.maxAp;
    }
  }

  function pole(n: number): string {
    if (n === 1) return "1 pole";
    if (n >= 2 && n <= 4) return `${n} pole`;
    return `${n} polí`;
  }

  function describe(x: number, y: number): string {
    const tile = at(state.tiles, x, y);
    const bits: string[] = [];
    const stood = state.units.find((u) => u.x === x && u.y === y && !u.embarked);
    const body = stood?.alive ? stood : null;
    if (body) {
      bits.push(`${body.name} · ${body.hp}/${body.maxHp}`);
      const plate = armorLabel(body);
      if (plate) bits.push(plate);
    } else if (stood && !stood.alive) bits.push(`${stood.name} · padl`);
    const label = TILE_LABEL[tile ?? ""] ?? "Pole";
    const smoked = state.smokes.some((s) => s.x === x && s.y === y);
    bits.push(smoked ? `${label} · kouř (−25 %)` : label);
    const sel = unitById(state, selectedId);
    const armed = sel?.weapons[sel.weaponIndex];
    if (sel && armed?.delivery === "throw" && sel.faction === "imperial" && sel.alive) {
      const dist = chebyshev(sel.x, sel.y, x, y);
      const left = sel.stock[armed.id] ?? 0;
      if (left <= 0) bits.push("Granát už není");
      else if (
        dist >= 1 &&
        dist <= armed.range &&
        hasLineOfSight(state.tiles, sel.x, sel.y, x, y)
      ) {
        const chance = hitChance(sel, armed, dist, 0);
        const names = unitsInBlast(state, x, y, armed.blast).map((u) => u.name);
        bits.push(
          `Hod ${chance} % · celý tah · ${names.length ? names.join(", ") : "prázdné pole"}`,
        );
        return bits.join(" · ");
      }
    }
    if (sel && armed?.delivery === "place" && tile === "wall") {
      const left = sel.stock[armed.id] ?? 0;
      bits.push(
        left <= 0
          ? "Petarda už není"
          : chebyshev(sel.x, sel.y, x, y) <= armed.range
            ? "Petarda · zeď spadne · nosič ve výbuchu"
            : "Petarda jen na sousední zeď",
      );
      return bits.join(" · ");
    }
    if (sel && body?.alive && body.faction === "swedish" && sel.faction === "imperial") {
      const info = evaluateShot(sel, sel.x, sel.y, body, state.tiles, state.smokes);
      const weapon = sel.weapons[info.weaponIndex];
      if (info.reason === "ok" && weapon) {
        bits.push(`${weapon.short} · zásah ${info.chance} % · kryt ${info.cover} %`);
      } else bits.push(reasonLine(info, sel));
    } else if (sel && sel.faction === "imperial" && sel.alive && !body) {
      const nodes = flood(
        state.tiles,
        occupied(state.units, sel.id),
        sel.x,
        sel.y,
        sel.ap * MOVE_PER_AP,
        boards(sel, state.phase),
      );
      const node = nodes.get(`${x},${y}`);
      if (node && node.steps > 0) {
        const costAp = node.steps <= MOVE_PER_AP ? 1 : 2;
        if (sel.ap === 2) {
          if (costAp === 1) {
            bits.push(
              `Modrý pohyb (1. akce, 1 AP, ${pole(node.steps)}) · zbude 1 AP pro střelbu či rozkaz`,
            );
          } else {
            bits.push(
              `Zlatý chvat (2. akce, 2 AP, ${pole(node.steps)}) · spotřebuje celý zbývající tah hrdiny!`,
            );
          }
        } else {
          bits.push(
            `Poslední přesun (1 AP, ${pole(node.steps)}) · spotřebuje zbývající tah hrdiny`,
          );
        }
      } else if (tile === "boat" && !boards(sel, state.phase)) {
        bits.push(
          state.phase === "hold" ? "Loďka už odrazila" : "Na loďku smí jen Colloredo",
        );
      }
    }
    return bits.join(" · ");
  }

  function buildView(): View {
    const marks: View["marks"] = [];
    const sel = unitById(state, selectedId);
    const showMoves =
      !!sel && sel.alive && !sel.embarked && state.turn === "player" && !busy;
    if (showMoves && sel) {
      const nodes = flood(
        state.tiles,
        occupied(state.units, sel.id),
        sel.x,
        sel.y,
        sel.ap * MOVE_PER_AP,
        boards(sel, state.phase),
      );
      for (const node of nodes.values()) {
        if (node.steps <= 0) continue;
        const kind: MarkKind = node.steps <= MOVE_PER_AP ? "move" : "far";
        marks.push({ x: node.x, y: node.y, kind });
      }
      if (hover) {
        const path = reconstruct(nodes, hover.x, hover.y);
        if (path.length > 0) {
          marks.push({ x: sel.x, y: sel.y, kind: "path" });
          for (const step of path) marks.push({ x: step.x, y: step.y, kind: "path" });
        }
      }
      for (const foe of living(state.units)) {
        if (foe.faction !== "swedish") continue;
        const info = evaluateShot(sel, sel.x, sel.y, foe, state.tiles, state.smokes);
        if (info.reason === "ok" && sel.weapons[info.weaponIndex]?.delivery === "shot") {
          marks.push({ x: foe.x, y: foe.y, kind: "attack" });
        } else if (info.reason === "load" || info.reason === "ap") {
          marks.push({ x: foe.x, y: foe.y, kind: "soft" });
        }
      }
      const armed = sel.weapons[sel.weaponIndex];
      if (
        armed?.delivery === "throw" &&
        (sel.stock[armed.id] ?? 0) > 0 &&
        sel.ap >= armed.ap
      ) {
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            const dist = chebyshev(sel.x, sel.y, x, y);
            if (dist < 1 || dist > armed.range) continue;
            if (!hasLineOfSight(state.tiles, sel.x, sel.y, x, y)) continue;
            marks.push({ x, y, kind: "blast" });
          }
        }
      }
      if (
        armed?.delivery === "place" &&
        (sel.stock[armed.id] ?? 0) > 0 &&
        sel.ap >= armed.ap
      ) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const) {
          const x = sel.x + dx;
          const y = sel.y + dy;
          if (at(state.tiles, x, y) === "wall") marks.push({ x, y, kind: "blast" });
        }
      }
    }
    if (state.phase === "dock" || state.phase === "hold") {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const tile = at(state.tiles, x, y);
          if (tile === "quay" || (tile === "boat" && state.phase === "dock")) {
            marks.push({ x, y, kind: "quay" });
          }
        }
      }
    }
    const jakub = state.units.find(
      (u) => u.archetype === "jakub" && u.overwatch && u.alive && !u.embarked,
    );
    if (jakub) {
      for (let y = jakub.y - 2; y <= jakub.y + 2; y++) {
        for (let x = jakub.x - 2; x <= jakub.x + 2; x++) {
          if (!walkable(state.tiles, x, y, true) && at(state.tiles, x, y) !== "boat")
            continue;
          if (
            chebyshev(x, y, jakub.x, jakub.y) <= HRADBA_RANGE &&
            hasLineOfSight(state.tiles, jakub.x, jakub.y, x, y)
          ) {
            marks.push({ x, y, kind: "zone" });
          }
        }
      }
    }
    if (hover) marks.push({ x: hover.x, y: hover.y, kind: "hover" });
    const units: PaintUnit[] = [];
    for (const unit of state.units) {
      if (unit.embarked) continue;
      const vis = visuals[unit.id] ?? { x: unit.x, y: unit.y, lunge: 0, flash: 0 };
      units.push({
        id: unit.id,
        archetype: unit.archetype,
        faction: unit.faction,
        px: vis.x,
        py: vis.y,
        facing: unit.facing,
        alive: unit.alive,
        hp: unit.hp,
        maxHp: unit.maxHp,
        ap: unit.ap,
        selected: unit.id === selectedId,
        overwatch: unit.overwatch,
        blessing: unit.blessing,
        vip: unit.vip,
        lunge: vis.lunge,
        flash: vis.flash,
        bob: unit.bob,
      });
    }
    return {
      tiles: state.tiles,
      smokes: state.smokes,
      decals: state.decals,
      units,
      marks,
      fx,
      time,
      shake: reduce ? 0 : shake,
      banner: banner(),
      phase: state.phase,
    };
  }

  const scene3d = createScene3D(
    mountEl,
    (tx, ty) => onTile(tx, ty),
    (tile) => {
      hover = tile;
      if (!tile) return;
      const text = describe(tile.x, tile.y);
      hoverText = text;
      emit();
    },
    () => {
      if (mode === "rozkaz") {
        mode = "normal";
        emit();
      }
    },
    onOverlayProject,
    () => play("thunder"),
  );

  function frame(): void {
    if (dead) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);

    const view = buildView();
    const sel = unitById(state, selectedId);
    const hoverCover = hover
      ? { x: hover.x, y: hover.y, dirs: computeCoverDirs(state, hover.x, hover.y) }
      : null;
    const selCover =
      sel && sel.alive && !sel.embarked
        ? { x: sel.x, y: sel.y, dirs: computeCoverDirs(state, sel.x, sel.y) }
        : null;
    const aimArc =
      hover && state.phase !== "briefing" ? computeAimPreview(hover.x, hover.y) : null;

    const unitMeta = new Map<
      string,
      {
        name: string;
        armor: number;
        maxAp: number;
        loaded: boolean | null;
        hitChance: number | null;
        cover: 0 | 25 | 50 | null;
      }
    >();
    for (const u of state.units) {
      const gun = firearm(u);
      let hit: number | null = null;
      let cov: 0 | 25 | 50 | null = null;
      if (
        sel &&
        sel.faction === "imperial" &&
        sel.alive &&
        u.faction === "swedish" &&
        u.alive
      ) {
        const info = evaluateShot(sel, sel.x, sel.y, u, state.tiles, state.smokes);
        if (info.reason === "ok") {
          hit = info.chance;
          cov = info.cover;
        }
      }
      unitMeta.set(u.id, {
        name: u.name,
        armor: u.armor,
        maxAp: u.maxAp,
        loaded: gun ? gunLoaded(u, gun) : null,
        hitChance: hit,
        cover: cov,
      });
    }

    scene3d.updateAndRender(dt, view, hoverCover, selCover, aimArc, unitMeta);

    if (!dead) {
      if (scene3d.isSoftwareGl) {
        scene3d.afterDraw(frame);
      } else {
        raf = requestAnimationFrame(frame);
      }
    }
  }

  const onVis = () => {
    if (document.visibilityState === "visible") nudge();
  };
  document.addEventListener("visibilitychange", onVis);
  void document.fonts?.load("600 16px Cinzel");
  void document.fonts?.load("500 16px Literata");
  emit();
  raf = requestAnimationFrame(frame);

  const api: GameHandle = {
    destroy() {
      dead = true;
      epoch += 1;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      scene3d.dispose();
      audio.close();
      timer?.resolve();
      waiter?.resolve();
      timer = null;
      waiter = null;
    },
    begin() {
      unlock();
      if (state.phase !== "briefing") return;
      state.phase = "flight";
      selectedId = "colloredo";
      const col = unitById(state, "colloredo");
      if (col) scene3d.focusTile(col.x, col.y);
      pushLog(state, "Königsmarkovi muži drží ulice mezi palácem a Vltavou.");
      pushLog(state, "Doveďte Colloreda na loďku. Uveze jen jeho a jednoho hrdinu.");
      pushLog(
        state,
        "Zeď z úhlu kryje naplno. Vůz, suť a kouř kryjí napůl. Kabátec ubere málo, půlzbroj víc — dokud ji granát nestrhne.",
      );
      pushLog(
        state,
        "Martin má jeden granát, Jakub jednu petardu. Granát stojí celý tah. Petarda boří zeď a chytí i nosiče.",
      );
      play("ui");
      emit();
    },
    unlock,
    endTurn() {
      if (!playing()) return;
      const token = epoch;
      busy = true;
      mode = "normal";
      emit();
      void runEnemies(token).then(() => {
        if (token !== epoch || dead) return;
        busy = false;
        resolvePending();
        emit();
      });
    },
    reload() {
      const unit = unitById(state, selectedId);
      const gun = firearm(unit);
      if (!unit || !gun || !playing() || gunLoaded(unit, gun) || unit.ap < gun.reloadAp)
        return;
      unit.ap -= gun.reloadAp;
      markLoaded(unit, gun.id);
      play("reload");
      textFx(unit.x, unit.y, "NABITO", "#e2c27a");
      pushLog(state, `${unit.name} nabíjí. ${gun.short} je připravená.`);
      emit();
    },
    prayer() {
      const unit = unitById(state, selectedId);
      if (
        !unit?.prayer ||
        !playing() ||
        unit.prayerUsed ||
        !unit.alive ||
        unit.embarked
      )
        return;
      const healed = healAmount(unit);
      unit.hp += healed;
      unit.prayerUsed = true;
      unit.blessing = true;
      play("prayer");
      fx.push({ kind: "ring", x: unit.x, y: unit.y, t: 0, life: 0.7, color: "#e2c27a" });
      textFx(unit.x, unit.y, healed > 0 ? `+${healed} HP` : "POŽEHNÁN", "#e2c27a");
      const breath =
        healed > 0
          ? `léčí ${healed === 1 ? "1 život" : `${healed} životy`}`
          : "se chytá dechu";
      pushLog(
        state,
        `„Ježíši, Maria, pomoz!“ ${unit.name} ${breath}. Příští úder povede jistěji.`,
      );
      emit();
    },
    hradba() {
      const unit = unitById(state, selectedId);
      if (
        !unit ||
        unit.archetype !== "jakub" ||
        !playing() ||
        unit.overwatch ||
        unit.ap < 1
      )
        return;
      unit.ap -= 1;
      unit.overwatch = true;
      play("blade");
      textFx(unit.x, unit.y, "HRADBA", "#e2c27a");
      pushLog(state, "Jakub zabodává halapartnu. První Švéd na dvě pole skončí na hrotu.");
      emit();
    },
    startRozkaz() {
      const unit = unitById(state, selectedId);
      if (!unit?.vip || !playing() || unit.ap < 1) return;
      mode = mode === "rozkaz" ? "normal" : "rozkaz";
      play("ui");
      emit();
    },
    sail() {
      const info = sailInfo(state, selectedId, busy);
      if (!info.enabled || !info.hero) return;
      const col = state.units.find((u) => u.vip);
      if (!col) return;
      info.hero.embarked = true;
      info.hero.fate = "sailed";
      col.embarked = true;
      if (selectedId === info.hero.id || selectedId === col.id) selectedId = null;
      state.phase = "hold";
      state.holdLeft = 3;
      const left = state.units.filter(
        (u) => u.faction === "imperial" && !u.vip && u.alive && !u.embarked,
      );
      if (!selectedId && left[0]) selectedId = left[0].id;
      const tail =
        left.length >= 2
          ? "Dva zůstávají na kamenech."
          : left.length === 1
            ? `${left[0]!.name} zůstává na kamenech.`
            : "Na břehu už nikdo nestojí.";
      pushLog(state, `${info.hero.name} skáče do loďky k maršálovi. ${tail}`);
      if (!hasDefender(state)) {
        finishVictory();
        return;
      }
      pushLog(state, "Ještě tři švédské nárazy, než proud odtrhne lano.");
      spawn("musketeer");
      play("sail");
      emit();
    },
    setWeapon(id: string) {
      const unit = unitById(state, selectedId);
      if (!unit || !playing()) return;
      const index = unit.weapons.findIndex((w) => w.id === id);
      if (index < 0) return;
      unit.weaponIndex = index;
      syncLoaded(unit);
      play("ui");
      emit();
    },
    activate(id: string) {
      unlock();
      const unit = unitById(state, id);
      if (!unit) return;
      if (mode === "rozkaz") {
        if (unit.faction === "imperial") giveOrder(unit);
        emit();
        return;
      }
      if (unit.faction === "imperial" && unit.alive && !unit.embarked) {
        selectedId = unit.id;
        scene3d.focusTile(unit.x, unit.y);
        play("ui");
        emit();
        return;
      }
      if (unit.faction === "swedish" && unit.alive) void attackTarget(unit);
    },
    focusUnit(id: string) {
      const unit = unitById(state, id);
      if (unit && unit.alive && !unit.embarked) {
        scene3d.focusTile(unit.x, unit.y);
      }
    },
    centerSelected() {
      const unit = unitById(state, selectedId);
      if (unit && unit.alive && !unit.embarked) {
        scene3d.focusTile(unit.x, unit.y);
      } else {
        scene3d.setCameraPreset("isometric");
      }
    },
    setCameraPreset(preset: CameraPreset) {
      cameraPreset = preset;
      scene3d.setCameraPreset(preset);
      emit();
    },
    rotateCamera(dir: 1 | -1) {
      scene3d.rotateBy(dir * (Math.PI / 4));
    },
    panCamera(dx: number, dz: number) {
      scene3d.panBy(dx, dz);
    },
    toggleActionCam() {
      actionCamEnabled = !actionCamEnabled;
      emit();
    },
    setLightingMood(mood: LightingMood) {
      lightingMood = mood;
      scene3d.setLightingMood(mood);
      play("ui");
      emit();
    },
    cycleLightingMood() {
      const order: LightingMood[] = ["auto", "chiaroscuro", "storm", "siege", "mist"];
      const idx = order.indexOf(lightingMood);
      lightingMood = order[(idx + 1) % order.length] ?? "auto";
      scene3d.setLightingMood(lightingMood);
      play("ui");
      emit();
    },
    restart() {
      epoch += 1;
      const pendingTimer = timer;
      const pendingWait = waiter;
      timer = null;
      waiter = null;
      motion = null;
      state = createSim();
      visuals = bootVisuals(state);
      fx = [];
      shake = 0;
      speed = 1;
      busy = false;
      selectedId = null;
      mode = "normal";
      hoverText = HOVER0;
      epilogue = null;
      scene3d.setCameraPreset("isometric");
      play("ui");
      emit();
      pendingTimer?.resolve();
      pendingWait?.resolve();
    },
    toggleMute() {
      muted = !muted;
      audio.setMuted(muted);
      emit();
    },
  };

  const probe = window as unknown as { __praha?: Record<string, unknown> };
  probe.__praha = {
    click: (x: number, y: number) => onTile(x, y),
    phase: () => state.phase,
    turn: () => state.turn,
    busy: () => busy,
    log: () => state.log.slice(-8),
    units: () =>
      state.units.map((u) => ({
        id: u.id,
        hp: u.hp,
        ap: u.ap,
        x: u.x,
        y: u.y,
        alive: u.alive,
        embarked: u.embarked,
        loaded: u.loaded,
        overwatch: u.overwatch,
      })),
  };
  return api;
}
