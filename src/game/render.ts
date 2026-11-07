import { LOOK, TILE, VIEW_H, VIEW_W } from "./config";
import { hash01 } from "./map";
import type { Archetype, Faction, Phase, TileKind } from "./types";
import boatUrl from "./art/boat.png";
import cartUrl from "./art/cart.png";
import cobbleUrl from "./art/cobble.png";
import colloredoUrl from "./art/colloredo.png";
import jakubUrl from "./art/jakub.png";
import martinUrl from "./art/martin.png";
import musketeerUrl from "./art/musketeer.png";
import palaceUrl from "./art/palace.png";
import pikemanUrl from "./art/pikeman.png";
import quayUrl from "./art/quay.png";
import vaclavUrl from "./art/vaclav.png";
import wallUrl from "./art/wall.png";
import waterUrl from "./art/water.png";

export type PaintUnit = {
  id: string;
  archetype: Archetype;
  faction: Faction;
  px: number;
  py: number;
  facing: 1 | -1;
  alive: boolean;
  hp: number;
  maxHp: number;
  ap: number;
  selected: boolean;
  overwatch: boolean;
  blessing: boolean;
  vip: boolean;
  lunge: number;
  flash: number;
  bob: number;
};

export type Fx =
  | { kind: "text"; x: number; y: number; text: string; color: string; t: number; life: number }
  | { kind: "line"; x0: number; y0: number; x1: number; y1: number; t: number; life: number; color: string }
  | { kind: "slash"; x: number; y: number; t: number; life: number }
  | { kind: "ring"; x: number; y: number; t: number; life: number; color: string }
  | { kind: "spark"; x: number; y: number; vx: number; vy: number; t: number; life: number; color: string };

export type MarkKind = "move" | "far" | "attack" | "soft" | "path" | "quay" | "zone" | "hover" | "blast";

export type View = {
  tiles: TileKind[][];
  smokes: { x: number; y: number }[];
  decals: { x: number; y: number }[];
  units: PaintUnit[];
  marks: { x: number; y: number; kind: MarkKind }[];
  fx: Fx[];
  time: number;
  shake: number;
  banner: string;
  phase: Phase;
};

let plate: HTMLCanvasElement | null = null;
let plateKey = "";

const GROUND: Record<string, string> = {
  cobble: cobbleUrl,
  wall: wallUrl,
  palace: palaceUrl,
  water: waterUrl,
  quay: quayUrl,
  cart: cartUrl,
  boat: boatUrl,
};

const SPRITE: Record<Archetype, string> = {
  colloredo: colloredoUrl,
  martin: martinUrl,
  vaclav: vaclavUrl,
  jakub: jakubUrl,
  musketeer: musketeerUrl,
  pikeman: pikemanUrl,
};

const SPRITE_H: Record<Archetype, number> = {
  colloredo: 46,
  martin: 44,
  vaclav: 44,
  jakub: 48,
  musketeer: 44,
  pikeman: 52,
};

const images = new Map<string, HTMLImageElement>();

function artImage(src: string): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function artReady(): boolean {
  return Object.values(GROUND).every((src) => artImage(src));
}

export function paint(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  if (view.shake > 0) {
    ctx.translate(Math.sin(view.time * 46) * view.shake, Math.cos(view.time * 37) * view.shake * 0.6);
  }
  ctx.drawImage(staticPlate(view.tiles), 0, 0);
  drawShimmer(ctx, view);
  drawMarks(ctx, view, "ground");
  drawBoats(ctx, view);
  drawDecals(ctx, view.decals);
  drawSmoke(ctx, view);
  drawUnits(ctx, view);
  const vignette = ctx.createRadialGradient(480, 300, 220, 480, 300, 620);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawMarks(ctx, view, "rim");
  drawHud(ctx, view);
  drawFx(ctx, view);
  drawLabels(ctx);
  if (view.banner) {
    ctx.fillStyle = "rgba(16,8,12,0.82)";
    ctx.fillRect(310, 8, 340, 28);
    ctx.strokeStyle = "rgba(198,161,90,0.85)";
    ctx.strokeRect(310.5, 8.5, 339, 27);
    ctx.fillStyle = "#e2c27a";
    ctx.font = "600 13px Cinzel, Palatino, serif";
    ctx.textAlign = "center";
    ctx.fillText(view.banner, 480, 27);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = "600 13px Cinzel, Palatino, serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(8,4,6,0.7)";
  ctx.fillText("PALÁC", 15, 23);
  ctx.fillStyle = "rgba(234,217,184,0.88)";
  ctx.fillText("PALÁC", 14, 22);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(8,4,6,0.7)";
  ctx.fillText("VLTAVA", VIEW_W - 13, 23);
  ctx.fillStyle = "rgba(234,217,184,0.88)";
  ctx.fillText("VLTAVA", VIEW_W - 14, 22);
  ctx.restore();
}

function staticPlate(tiles: TileKind[][]): HTMLCanvasElement {
  const key = `${tiles.map((row) => row.join("")).join("\n")}|${artReady() ? "art3" : "flat"}`;
  if (plate && plateKey === key) return plate;
  plateKey = key;
  plate = document.createElement("canvas");
  plate.width = VIEW_W;
  plate.height = VIEW_H;
  const g = plate.getContext("2d");
  if (!g) return plate;
  g.fillStyle = "#10080c";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) drawTile(g, tiles, x, y);
  }
  return plate;
}

function neighbor(tiles: TileKind[][], x: number, y: number): TileKind | null {
  return tiles[y]?.[x] ?? null;
}

function drawTile(g: CanvasRenderingContext2D, tiles: TileKind[][], x: number, y: number): void {
  const kind = tiles[y]?.[x] ?? "cobble";
  const px = x * TILE;
  const py = y * TILE;
  const near = (dx: number, dy: number) => neighbor(tiles, x + dx, y + dy);
  if (artReady()) {
    drawPaintedTile(g, kind, px, py, near);
    return;
  }
  if (kind === "wall") {
    drawWall(g, px, py);
    return;
  }
  if (kind === "river" || kind === "boat") {
    const water = g.createLinearGradient(px, py, px, py + TILE);
    water.addColorStop(0, "#102838");
    water.addColorStop(1, "#0c3a52");
    g.fillStyle = water;
    g.fillRect(px, py, TILE, TILE);
    g.fillStyle = "rgba(180,210,220,0.05)";
    g.fillRect(px, py + 8, TILE, 2);
  } else if (kind === "palace") {
    drawPalace(g, px, py, x, y, near);
  } else if (kind === "quay") {
    drawQuay(g, px, py, near);
  } else {
    drawCobble(g, px, py, x, y);
  }
  if (kind === "cart") drawCart(g, px, py);
  if (kind === "rubble") drawRubble(g, px, py);
}

function drawPaintedTile(
  g: CanvasRenderingContext2D,
  kind: TileKind,
  px: number,
  py: number,
  near: (dx: number, dy: number) => TileKind | null,
): void {
  const cobble = artImage(GROUND.cobble);
  const wall = artImage(GROUND.wall);
  const palace = artImage(GROUND.palace);
  const water = artImage(GROUND.water);
  const quay = artImage(GROUND.quay);
  const cart = artImage(GROUND.cart);
  const boat = artImage(GROUND.boat);
  if (!cobble || !wall || !palace || !water || !quay || !cart || !boat) return;
  if (kind === "wall") {
    g.drawImage(wall, px, py, TILE, TILE);
    return;
  }
  if (kind === "river" || kind === "boat") g.drawImage(water, px, py, TILE, TILE);
  else if (kind === "palace") {
    g.drawImage(palace, px, py, TILE, TILE);
    if (near(0, -1) !== "palace") {
      g.fillStyle = "#c6a15a";
      g.fillRect(px, py, TILE, 3);
      g.fillStyle = "rgba(255,220,170,0.35)";
      g.fillRect(px, py + 3, TILE, 1);
    }
    if (near(0, 1) !== "palace") {
      g.fillStyle = "rgba(8,6,8,0.55)";
      g.fillRect(px, py + TILE - 7, TILE, 7);
    }
  } else if (kind === "quay") {
    g.drawImage(quay, px, py, TILE, TILE);
    const riverSide =
      near(1, 0) === "river" || near(1, 0) === "boat"
        ? 1
        : near(-1, 0) === "river" || near(-1, 0) === "boat"
          ? -1
          : near(0, 1) === "river"
            ? 2
            : 0;
    g.fillStyle = "#5c4024";
    if (riverSide === 1) g.fillRect(px + TILE - 5, py, 5, TILE);
    else if (riverSide === -1) g.fillRect(px, py, 5, TILE);
    else if (riverSide === 2) g.fillRect(px, py + TILE - 5, TILE, 5);
  } else g.drawImage(cobble, px, py, TILE, TILE);

  if (kind === "rubble") drawRubble(g, px, py);

  if (kind === "cart") {
    const h = 42;
    const w = h * (cart.width / cart.height);
    g.drawImage(cart, px + (TILE - w) / 2, py + TILE - h - 4, w, h);
  }
}

function drawRubble(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.fillStyle = "rgba(40,28,22,0.45)";
  g.beginPath();
  g.moveTo(px + 8, py + 46);
  g.lineTo(px + 22, py + 28);
  g.lineTo(px + 34, py + 44);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(90,70,52,0.7)";
  g.fillRect(px + 36, py + 34, 16, 10);
  g.fillStyle = "rgba(20,12,10,0.55)";
  g.fillRect(px + 14, py + 48, 28, 6);
}

function drawCobble(g: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
  g.save();
  g.beginPath();
  g.rect(px, py, TILE, TILE);
  g.clip();
  g.fillStyle = "#1a1412";
  g.fillRect(px, py, TILE, TILE);
  for (let r = 0; r < 4; r++) {
    const off = (r % 2) * 8;
    for (let c = -1; c < 5; c++) {
      const sx = px + c * 16 + off;
      const sy = py + r * 16;
      const j = hash01(x * 3 + c, y * 5 + r, r + c + 2);
      const tone = 38 + j * 22;
      g.fillStyle = `rgb(${tone + 8},${tone},${tone - 4})`;
      g.fillRect(sx + 1, sy + 1, 14, 13);
      g.fillStyle = "rgba(255,220,180,0.07)";
      g.fillRect(sx + 1, sy + 1, 14, 2);
    }
  }
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.fillRect(px, py + TILE - 3, TILE, 3);
  g.restore();
}

function drawWall(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.save();
  g.beginPath();
  g.rect(px, py, TILE, TILE);
  g.clip();
  g.fillStyle = "#161412";
  g.fillRect(px, py, TILE, TILE);
  const course = 16;
  const first = Math.floor(py / course) * course;
  for (let wy = first; wy < py + TILE; wy += course) {
    const row = Math.floor(wy / course);
    g.fillStyle = row % 2 === 0 ? "#4a4338" : "#3a342c";
    g.fillRect(px - 4, wy + 1, TILE + 8, course - 3);
    g.fillStyle = "rgba(255,220,180,0.06)";
    g.fillRect(px, wy + 1, TILE, 2);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(px, wy + course - 3, TILE, 2);
    const stagger = (row % 2) * 18;
    g.fillStyle = "rgba(0,0,0,0.32)";
    for (let vx = px - 36 + stagger; vx < px + TILE; vx += 32) {
      g.fillRect(vx, wy + 1, 2, course - 4);
    }
  }
  g.fillStyle = "rgba(234,217,184,0.16)";
  g.fillRect(px, py, TILE, 2);
  g.restore();
}

function drawPalace(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  near: (dx: number, dy: number) => TileKind | null,
): void {
  const up = near(0, -1) === "palace";
  const down = near(0, 1) === "palace";
  g.fillStyle = "#241c20";
  g.fillRect(px, py, TILE, TILE);
  g.fillStyle = "#2e2428";
  g.fillRect(px + 4, py + (up ? 0 : 12), TILE - 8, TILE - (up ? 4 : 12) - (down ? 0 : 8));
  if (!up) {
    g.fillStyle = "#3a2c28";
    g.fillRect(px, py, TILE, 10);
    g.fillStyle = "#c6a15a";
    g.fillRect(px, py + 9, TILE, 2);
  }
  if (!down) {
    g.fillStyle = "#120e10";
    g.fillRect(px, py + TILE - 8, TILE, 8);
  }
  const lit = hash01(x, y, 2) > 0.4;
  for (const ox of [16, 38]) {
    const wy = py + (up ? 18 : 22);
    g.fillStyle = "#140e10";
    g.fillRect(px + ox, wy, 12, 18);
    g.fillStyle = lit ? "#e6b15a" : "#2a1a14";
    g.fillRect(px + ox + 2, wy + 2, 8, 10);
    if (lit) {
      g.fillStyle = "rgba(255,180,80,0.35)";
      g.fillRect(px + ox - 2, wy + 14, 16, 6);
    }
  }
}

function drawQuay(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  near: (dx: number, dy: number) => TileKind | null,
): void {
  g.fillStyle = "#3a4248";
  g.fillRect(px, py, TILE, TILE);
  g.strokeStyle = "rgba(20,16,14,0.45)";
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = py + 8 + i * 14;
    g.beginPath();
    g.moveTo(px, yy);
    g.lineTo(px + TILE, yy);
    g.stroke();
  }
  const riverSide =
    near(1, 0) === "river" || near(1, 0) === "boat"
      ? 1
      : near(-1, 0) === "river" || near(-1, 0) === "boat"
        ? -1
        : near(0, 1) === "river"
          ? 2
          : 0;
  g.fillStyle = "#6a5030";
  if (riverSide === 1) g.fillRect(px + TILE - 6, py, 6, TILE);
  else if (riverSide === -1) g.fillRect(px, py, 6, TILE);
  else if (riverSide === 2) g.fillRect(px, py + TILE - 6, TILE, 6);
}

function drawCart(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.fillStyle = "#5c3a22";
  g.fillRect(px + 12, py + 28, 40, 14);
  g.fillStyle = "#7a5230";
  g.fillRect(px + 14, py + 22, 36, 8);
  g.fillStyle = "#8d6238";
  g.beginPath();
  g.ellipse(px + 32, py + 20, 10, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#c6a15a";
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = "#1a120e";
  g.beginPath();
  g.arc(px + 20, py + 46, 6, 0, Math.PI * 2);
  g.arc(px + 44, py + 46, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#8a8070";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(px + 20, py + 46, 3, 0, Math.PI * 2);
  g.arc(px + 44, py + 46, 3, 0, Math.PI * 2);
  g.stroke();
}

function drawBoat(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.fillStyle = "#4a2e1c";
  g.beginPath();
  g.moveTo(px + 8, py + 36);
  g.quadraticCurveTo(px + 32, py + 56, px + 56, py + 36);
  g.lineTo(px + 50, py + 30);
  g.quadraticCurveTo(px + 32, py + 26, px + 14, py + 30);
  g.closePath();
  g.fill();
  g.strokeStyle = "#e2c27a";
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = "#6a4428";
  g.fillRect(px + 22, py + 32, 20, 4);
  g.fillStyle = "#ead9b8";
  g.fillRect(px + 30, py + 16, 3, 16);
  g.fillStyle = "#ffb45a";
  g.beginPath();
  g.arc(px + 31.5, py + 14, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff1c8";
  g.beginPath();
  g.arc(px + 31.5, py + 14, 2, 0, Math.PI * 2);
  g.fill();
}

function drawShimmer(ctx: CanvasRenderingContext2D, view: View): void {
  const moon = ctx.createRadialGradient(70, 30, 8, 160, 90, 540);
  moon.addColorStop(0, "rgba(186,206,230,0.08)");
  moon.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.strokeStyle = "rgba(190,220,230,0.2)";
  ctx.lineWidth = 1;
  for (let y = 0; y < view.tiles.length; y++) {
    const row = view.tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "river") continue;
      const px = x * TILE;
      const py = y * TILE;
      for (let i = 0; i < 3; i++) {
        const base = py + 16 + i * 16;
        ctx.beginPath();
        ctx.moveTo(px, base + Math.sin(px * 0.05 + view.time * 1.3 + i) * 2);
        ctx.lineTo(px + TILE, base + Math.sin((px + TILE) * 0.05 + view.time * 1.3 + i) * 2);
        ctx.stroke();
      }
    }
  }
  const boat = boatAnchor(view.tiles);
  if (boat && view.phase !== "victory") {
    const glow = (view.phase === "hold" ? 0.28 : 0.42) + Math.sin(view.time * 4) * 0.08;
    const lampAt = boatLamp(boat.x, boat.y, view.phase);
    const lamp = ctx.createRadialGradient(lampAt.x, lampAt.y, 2, lampAt.x, lampAt.y, 36);
    lamp.addColorStop(0, `rgba(255,210,140,${glow})`);
    lamp.addColorStop(0.45, "rgba(255,140,40,0.08)");
    lamp.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(lampAt.x - 40, lampAt.y - 40, 80, 80);
  }
  drawRain(ctx, view.time);
}

function boatAnchor(tiles: TileKind[][]): { x: number; y: number } | null {
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) if (row[x] === "boat") return { x, y };
  }
  return null;
}

function castOff(phase: Phase): number {
  if (phase === "hold") return 34;
  if (phase === "victory") return 96;
  return 0;
}

function boatBox(x: number, y: number, phase: Phase): { dx: number; dy: number; w: number; h: number } {
  const boat = artImage(GROUND.boat);
  const h = 40;
  const w = boat ? h * (boat.width / boat.height) : 96;
  let dx = x * TILE + (TILE - w) / 2;
  dx = Math.max(2, Math.min(dx, VIEW_W - w - 2));
  dx += castOff(phase);
  return { dx, dy: y * TILE + 12, w, h };
}

function boatLamp(x: number, y: number, phase: Phase): { x: number; y: number } {
  const box = boatBox(x, y, phase);
  return { x: box.dx + box.w * 0.56, y: box.dy + box.h * 0.37 };
}

function drawBoats(ctx: CanvasRenderingContext2D, view: View): void {
  if (view.phase === "victory") return;
  const spot = boatAnchor(view.tiles);
  if (!spot) return;
  const boat = artImage(GROUND.boat);
  ctx.save();
  if (view.phase === "hold") ctx.globalAlpha = 0.92;
  if (boat) {
    const box = boatBox(spot.x, spot.y, view.phase);
    ctx.drawImage(boat, box.dx, box.dy, box.w, box.h);
  } else {
    drawBoat(ctx, spot.x * TILE + castOff(view.phase), spot.y * TILE);
  }
  ctx.restore();
}

function drawRain(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(186,206,220,0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const x = ((i * 137 + time * 70) % (VIEW_W + 30)) - 10;
    const y = ((i * 89 + time * 180) % (VIEW_H + 24)) - 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.5, y + 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarks(ctx: CanvasRenderingContext2D, view: View, layer: "ground" | "rim"): void {
  for (const mark of view.marks) {
    const x = mark.x * TILE;
    const y = mark.y * TILE;
    if (layer === "ground") {
      if (mark.kind === "move") ctx.fillStyle = "rgba(24,100,216,0.44)"; // 1. akce: Azure
      else if (mark.kind === "far") ctx.fillStyle = "rgba(214,142,24,0.34)"; // 2. akce: Gold
      else if (mark.kind === "attack") ctx.fillStyle = "rgba(143,36,51,0.4)";
      else if (mark.kind === "soft") ctx.fillStyle = "rgba(143,36,51,0.2)";
      else if (mark.kind === "path") ctx.fillStyle = "rgba(100,184,255,0.44)";
      else if (mark.kind === "zone") ctx.fillStyle = "rgba(40,128,216,0.24)";
      else if (mark.kind === "blast") ctx.fillStyle = "rgba(196,92,42,0.4)";
      else if (mark.kind === "quay") ctx.fillStyle = "rgba(198,161,90,0.18)";
      else ctx.fillStyle = "rgba(234,217,184,0.08)";
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      continue;
    }
    const ink =
      mark.kind === "move"
        ? "rgba(100,184,255,0.95)"
        : mark.kind === "far"
          ? "rgba(255,210,102,0.95)"
          : mark.kind === "attack" || mark.kind === "soft"
            ? "rgba(232,140,140,0.95)"
            : mark.kind === "blast"
              ? "rgba(224,140,70,0.95)"
              : mark.kind === "zone"
                ? "rgba(120,195,255,0.95)"
                : "rgba(234,217,184,0.92)";
    if (mark.kind === "move" || mark.kind === "attack" || mark.kind === "zone" || mark.kind === "path" || mark.kind === "blast") {
      ctx.strokeStyle = ink;
      ctx.lineWidth = mark.kind === "path" ? 1.5 : 2.5;
      ctx.strokeRect(x + 5.5, y + 5.5, TILE - 11, TILE - 11);
    } else if (mark.kind === "hover" || mark.kind === "quay" || mark.kind === "far" || mark.kind === "soft") {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 5.5, y + 5.5, TILE - 11, TILE - 11);
    }
  }
}

function drawDecals(ctx: CanvasRenderingContext2D, decals: { x: number; y: number }[]): void {
  for (const d of decals) {
    ctx.fillStyle = "rgba(90,12,18,0.72)";
    ctx.beginPath();
    ctx.ellipse(d.x * TILE + 34, d.y * TILE + 42, 16, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(40,6,8,0.8)";
    ctx.beginPath();
    ctx.ellipse(d.x * TILE + 28, d.y * TILE + 40, 5, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSmoke(ctx: CanvasRenderingContext2D, view: View): void {
  for (const s of view.smokes) {
    const cx = s.x * TILE + TILE / 2;
    const cy = s.y * TILE + TILE / 2 - 6;
    for (let i = 0; i < 4; i++) {
      const ox = Math.sin(view.time * 0.8 + i * 2 + s.x) * 8;
      const oy = Math.cos(view.time * 0.6 + i) * 4;
      ctx.fillStyle = `rgba(210,210,214,${0.1 + i * 0.045})`;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, 10 + i * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawUnits(ctx: CanvasRenderingContext2D, view: View): void {
  const list = view.units.slice().sort((a, b) => Number(a.alive) - Number(b.alive) || a.py - b.py);
  for (const unit of list) {
    const x = unit.px * TILE + TILE / 2 + unit.facing * unit.lunge * 8;
    const y = unit.py * TILE + TILE / 2 + 8;
    const pal = LOOK[unit.archetype];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!unit.alive) {
      ctx.rotate(-1.15);
      ctx.globalAlpha = 0.8;
    }
    if (unit.selected && unit.alive) {
      ctx.strokeStyle = "#e2c27a";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -view.time * 18;
      ctx.beginPath();
      ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (unit.blessing && unit.alive) {
      ctx.strokeStyle = `rgba(226,194,122,${0.45 + Math.sin(view.time * 4) * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (unit.alive) ctx.translate(0, Math.sin(view.time * 1.7 + unit.bob) * 0.7);
    ctx.scale(unit.facing * pal.scale, pal.scale);
    const sprite = artImage(SPRITE[unit.archetype]);
    if (sprite) {
      const scale = Math.abs(pal.scale) || 1;
      const originY = y + (unit.alive ? Math.sin(view.time * 1.7 + unit.bob) * 0.7 : 0);
      let h = SPRITE_H[unit.archetype];
      if (unit.alive && originY + (22 - h) * scale < 2) h = 22 - (2 - originY) / scale;
      drawSprite(ctx, sprite, Math.max(28, h));
    } else drawBody(ctx, unit.archetype, pal);
    if (unit.flash > 0 && unit.alive) {
      ctx.fillStyle = `rgba(255,90,70,${unit.flash * 0.55})`;
      ctx.beginPath();
      ctx.arc(0, -2, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, view: View): void {
  for (const unit of view.units) {
    if (!unit.alive) continue;
    const bx = unit.px * TILE + TILE / 2;
    const by = unit.py * TILE + TILE - 7;
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(bx - 16, by, 32, 5);
    const ratio = Math.max(0, unit.hp) / unit.maxHp;
    ctx.fillStyle = ratio < 0.34 ? "#e7b4b0" : unit.faction === "imperial" ? "#e2c27a" : "#c44848";
    ctx.fillRect(bx - 15, by + 1, 30 * ratio, 3);
    if (unit.vip) {
      ctx.fillStyle = "#e2c27a";
      ctx.beginPath();
      ctx.moveTo(bx - 22, by + 2);
      ctx.lineTo(bx - 18, by - 2);
      ctx.lineTo(bx - 14, by + 2);
      ctx.lineTo(bx - 18, by + 6);
      ctx.fill();
    }
    if (unit.overwatch) {
      ctx.strokeStyle = "#e2c27a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by - 2);
      ctx.lineTo(bx, by - 8);
      ctx.lineTo(bx + 8, by - 2);
      ctx.stroke();
    }
  }
}

function drawSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement, h: number): void {
  const w = h * (img.width / img.height);
  ctx.drawImage(img, -w / 2, 22 - h, w, h);
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  arch: Archetype,
  pal: (typeof LOOK)[Archetype],
): void {
  if (arch === "colloredo") {
    ctx.fillStyle = "#5c1824";
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-16, 18);
    ctx.lineTo(14, 18);
    ctx.lineTo(8, -4);
    ctx.fill();
  }
  ctx.strokeStyle = pal.legs;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 8);
  ctx.lineTo(-7, 20);
  ctx.moveTo(4, 8);
  ctx.lineTo(8, 20);
  ctx.stroke();
  ctx.strokeStyle = "#0c0a0a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(-10, 23);
  ctx.moveTo(8, 18);
  ctx.lineTo(11, 23);
  ctx.stroke();

  ctx.fillStyle = pal.coat;
  ctx.beginPath();
  ctx.moveTo(-11, -8);
  ctx.lineTo(-13, 14);
  ctx.lineTo(13, 14);
  ctx.lineTo(11, -8);
  ctx.quadraticCurveTo(0, -18, -11, -8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,226,190,0.14)";
  ctx.fillRect(-10, -6, 5, 12);

  if (arch === "colloredo" || arch === "martin") {
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-9, -1);
    ctx.lineTo(9, 11);
    ctx.stroke();
  }
  if (arch === "jakub") {
    ctx.fillStyle = "#c4a574";
    ctx.beginPath();
    ctx.moveTo(-7, -2);
    ctx.lineTo(-8, 14);
    ctx.lineTo(8, 14);
    ctx.lineTo(7, -2);
    ctx.fill();
    ctx.fillStyle = "#6a4a28";
    ctx.fillRect(-1.5, 1, 3, 7);
  }
  if (arch === "vaclav") {
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-7, -6, 14, 3);
  }
  if (arch === "musketeer" || arch === "pikeman") {
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-12, 0, 5, 9);
    ctx.fillRect(7, 0, 5, 9);
  }

  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(0, -16, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a120e";
  ctx.fillRect(2, -17, 1.6, 1.6);

  ctx.fillStyle = pal.hat;
  if (arch === "colloredo") {
    ctx.beginPath();
    ctx.ellipse(0, -21, 12, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-5, -32, 10, 12);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-5, -24, 10, 2);
  } else if (arch === "martin" || arch === "musketeer") {
    ctx.beginPath();
    ctx.ellipse(0, -20, 12, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-4, -28, 8, 9);
  } else if (arch === "vaclav") {
    ctx.fillRect(-8, -26, 16, 7);
  } else if (arch === "pikeman") {
    ctx.beginPath();
    ctx.arc(0, -18, 7.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-1, -28, 2, 10);
    ctx.fillStyle = pal.metal;
    ctx.fillRect(-6, -20, 12, 2);
  } else {
    ctx.beginPath();
    ctx.arc(0, -20, 7, Math.PI, 0);
    ctx.fill();
  }

  ctx.lineCap = "round";
  if (arch === "colloredo") return;
  if (arch === "martin") {
    ctx.strokeStyle = pal.metal;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(18, 4);
    ctx.stroke();
    ctx.strokeStyle = "#d7c08a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(18, 22);
    ctx.stroke();
    return;
  }
  if (arch === "vaclav" || arch === "musketeer") {
    ctx.strokeStyle = "#6b4a2c";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(22, 8);
    ctx.stroke();
    ctx.strokeStyle = pal.metal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 6);
    ctx.lineTo(32, 10);
    ctx.stroke();
    return;
  }
  if (arch === "jakub") {
    ctx.strokeStyle = "#6b4a2c";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(8, 12);
    ctx.lineTo(14, -22);
    ctx.stroke();
    ctx.fillStyle = pal.metal;
    ctx.beginPath();
    ctx.moveTo(8, -22);
    ctx.lineTo(22, -16);
    ctx.lineTo(14, -10);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.strokeStyle = pal.metal;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.lineTo(8, -30);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(4, -30);
  ctx.lineTo(12, -26);
  ctx.stroke();
}

function drawFx(ctx: CanvasRenderingContext2D, view: View): void {
  for (const fx of view.fx) {
    const k = Math.min(1, fx.t / fx.life);
    ctx.globalAlpha = 1 - k;
    if (fx.kind === "text") {
      ctx.fillStyle = fx.color;
      ctx.font = "700 16px Literata, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(fx.text, fx.x * TILE + TILE / 2, fx.y * TILE + 18 - k * 22);
      ctx.textAlign = "left";
    } else if (fx.kind === "line") {
      ctx.strokeStyle = "rgba(255,244,210,0.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(fx.x0 * TILE + TILE / 2, fx.y0 * TILE + TILE / 2);
      ctx.lineTo(fx.x1 * TILE + TILE / 2, fx.y1 * TILE + TILE / 2);
      ctx.stroke();
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (fx.kind === "slash") {
      ctx.strokeStyle = "#ead9b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x * TILE + TILE / 2, fx.y * TILE + TILE / 2, 10 + k * 16, -0.8, 0.9);
      ctx.stroke();
    } else if (fx.kind === "ring") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x * TILE + TILE / 2, fx.y * TILE + TILE / 2, 8 + k * 28, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = fx.color;
      ctx.fillRect(fx.x * TILE, fx.y * TILE, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}
