import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { COLS, COVER_FULL, COVER_HALF, LOOK, ROWS } from "./config";
import { at, hash01 } from "./map";
import type { Fx, MarkKind, PaintUnit, View } from "./render";
import type {
  AimArcData,
  Archetype,
  CameraPreset,
  CoverDir,
  LightingMood,
  ProjectedFloatingText,
  ProjectedUnitPlate,
  TileKind,
} from "./types";

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

export const TILE_3D = 2.0;

// Reusable module-scope math & color objects (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _planeIntersect = new THREE.Vector3();
const _mouseNdc = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

const SPRITE_URLS: Record<Archetype, string> = {
  colloredo: colloredoUrl,
  martin: martinUrl,
  vaclav: vaclavUrl,
  jakub: jakubUrl,
  musketeer: musketeerUrl,
  pikeman: pikemanUrl,
};

const SPRITE_WORLD_H: Record<Archetype, number> = {
  colloredo: 1.85,
  martin: 1.76,
  vaclav: 1.74,
  jakub: 1.9,
  musketeer: 1.76,
  pikeman: 1.98,
};

export function tileToWorldX(tx: number): number {
  return (tx - (COLS - 1) / 2) * TILE_3D;
}

export function tileToWorldZ(ty: number): number {
  return (ty - (ROWS - 1) / 2) * TILE_3D;
}

export function worldToTile(wx: number, wz: number): { x: number; y: number } | null {
  const x = Math.round(wx / TILE_3D + (COLS - 1) / 2);
  const y = Math.round(wz / TILE_3D + (ROWS - 1) / 2);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return { x, y };
}

export function groundHeightAt(kind: TileKind | null): number {
  if (kind === "palace") return 0.18;
  if (kind === "quay") return -0.06;
  if (kind === "river" || kind === "boat") return -0.28;
  return 0.0;
}

export type ActionCamShot = {
  ax: number;
  ay: number;
  tx: number;
  ty: number;
  holdSec: number;
};

export type SceneOverlayCallback = (
  plates: ProjectedUnitPlate[],
  floats: ProjectedFloatingText[],
) => void;

type UnitRig3D = {
  group: THREE.Group;
  plinthRing: THREE.Mesh;
  facingChevron: THREE.Mesh;
  selectRing: THREE.Mesh;
  selectBeam: THREE.Mesh;
  overwatchRing: THREE.Mesh;
  blessingRing: THREE.Mesh;
  vipCrown: THREE.Mesh | null;
  spritePivot: THREE.Group;
  spriteMesh: THREE.Mesh;
  spriteGeoRight: THREE.PlaneGeometry;
  spriteGeoLeft: THREE.PlaneGeometry;
  spriteMat: THREE.MeshStandardMaterial;
  depthMat: THREE.MeshDepthMaterial;
  archetype: Archetype;
};

type TileCell3D = {
  x: number;
  y: number;
  kind: TileKind;
  propGroup: THREE.Group | null;
};

export type Scene3DHandle = {
  updateAndRender: (
    dt: number,
    view: View,
    coverTile: { x: number; y: number; dirs: CoverDir[] } | null,
    selectedCover: { x: number; y: number; dirs: CoverDir[] } | null,
    aimArc: AimArcData | null,
    unitMeta: Map<
      string,
      {
        name: string;
        armor: number;
        maxAp: number;
        loaded: boolean | null;
        hitChance: number | null;
        cover: 0 | 25 | 50 | null;
      }
    >,
  ) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setLightingMood: (mood: LightingMood) => void;
  triggerLightning: (intensity?: number) => void;
  focusTile: (tx: number, ty: number) => void;
  rotateBy: (angleRad: number) => void;
  panBy: (dx: number, dz: number) => void;
  triggerActionCam: (shot: ActionCamShot) => void;
  afterDraw: (cb: () => void) => void;
  isSoftwareGl: boolean;
  dispose: () => void;
};

type MoodPalette = {
  fogColor: number;
  fogDensity: number;
  exposure: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  moonColor: number;
  moonIntensity: number;
  moonPos: readonly [number, number, number];
  rimColor: number;
  rimIntensity: number;
  riverColor: number;
  riverIntensity: number;
  mistColor: number;
  mistOpacity: number;
  godRayScale: number;
  torchBoost: number;
  rainOpacity: number;
};

const MOOD_PALETTES: Record<Exclude<LightingMood, "auto">, MoodPalette> = {
  chiaroscuro: {
    fogColor: 0x130c1c,
    fogDensity: 0.0132,
    exposure: 1.38,
    hemiSky: 0x8eb4e6,
    hemiGround: 0x4a2a1e,
    hemiIntensity: 1.32,
    moonColor: 0xe4eeff,
    moonIntensity: 2.1,
    moonPos: [-11, 24, 15],
    rimColor: 0xffb85c,
    rimIntensity: 1.4,
    riverColor: 0x3898b8,
    riverIntensity: 0.82,
    mistColor: 0x6c88b4,
    mistOpacity: 0.18,
    godRayScale: 1.0,
    torchBoost: 1.0,
    rainOpacity: 0.24,
  },
  mist: {
    fogColor: 0x102030,
    fogDensity: 0.0168,
    exposure: 1.34,
    hemiSky: 0x9cd0f2,
    hemiGround: 0x263844,
    hemiIntensity: 1.42,
    moonColor: 0xd8f0ff,
    moonIntensity: 2.35,
    moonPos: [-7, 25, 13],
    rimColor: 0xffc978,
    rimIntensity: 1.15,
    riverColor: 0x52c4e0,
    riverIntensity: 1.25,
    mistColor: 0x8ec4e2,
    mistOpacity: 0.3,
    godRayScale: 1.32,
    torchBoost: 0.96,
    rainOpacity: 0.18,
  },
  storm: {
    fogColor: 0x0b1020,
    fogDensity: 0.0155,
    exposure: 1.28,
    hemiSky: 0x6a8fc4,
    hemiGround: 0x241d28,
    hemiIntensity: 1.08,
    moonColor: 0xc8deff,
    moonIntensity: 1.75,
    moonPos: [-14, 23, 17],
    rimColor: 0xffa448,
    rimIntensity: 1.25,
    riverColor: 0x2d7ca0,
    riverIntensity: 0.95,
    mistColor: 0x627ea8,
    mistOpacity: 0.22,
    godRayScale: 0.85,
    torchBoost: 1.12,
    rainOpacity: 0.38,
  },
  siege: {
    fogColor: 0x210c14,
    fogDensity: 0.0148,
    exposure: 1.44,
    hemiSky: 0xc87a68,
    hemiGround: 0x5c2218,
    hemiIntensity: 1.38,
    moonColor: 0xffe2c6,
    moonIntensity: 1.85,
    moonPos: [-9, 22, 16],
    rimColor: 0xff5a2e,
    rimIntensity: 2.15,
    riverColor: 0xd46a38,
    riverIntensity: 1.05,
    mistColor: 0xc46e52,
    mistOpacity: 0.24,
    godRayScale: 1.18,
    torchBoost: 1.28,
    rainOpacity: 0.26,
  },
};

function makeGodRayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255,255,255,0.65)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.32)");
  grad.addColorStop(0.85, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(canvas);
}

function makeSoftMistTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,0.65)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.28)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function isContextSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext | null): boolean {
  try {
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function makeProceduralTileTexture(
  kind: "cobble" | "palace" | "wall" | "quay" | "water",
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  if (kind === "cobble") {
    // Rich multi-toned Baroque Prague porphyry, slate-blue, ochre & rose granite cobbles
    ctx.fillStyle = "#1d1518";
    ctx.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 12; r++) {
      const off = (r % 2) * 21;
      for (let c = -1; c < 13; c++) {
        const sx = Math.floor(c * 42.6 + off);
        const sy = Math.floor(r * 42.6);
        const h = hash01(c, r, 11);
        const huePick = hash01(c, r, 23);
        const base = Math.floor(58 + h * 36);
        let red = base + 14;
        let green = base + 4;
        let blue = base;
        if (huePick > 0.68) {
          // Warm Bohemian rose-ochre granite
          red += 18;
          green += 6;
        } else if (huePick < 0.32) {
          // Cool slate-sapphire cobble
          blue += 16;
          green += 6;
        }
        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.beginPath();
        ctx.roundRect(sx + 3, sy + 3, 37, 36, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,228,175,0.22)";
        ctx.fillRect(sx + 5, sy + 4, 33, 4);
        ctx.fillStyle = "rgba(12,6,10,0.45)";
        ctx.fillRect(sx + 4, sy + 35, 35, 4);
      }
    }
  } else if (kind === "palace") {
    // Opulent Rosso Verona & Imperial Ivory-Gold Marble Checkerboard Parterre
    ctx.fillStyle = "#3a1d24";
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 128) {
      for (let x = 0; x < 512; x += 128) {
        const alt = ((x + y) / 128) % 2 === 0;
        const grad = ctx.createLinearGradient(x, y, x + 128, y + 128);
        if (alt) {
          grad.addColorStop(0, "#682632");
          grad.addColorStop(0.5, "#7d303d");
          grad.addColorStop(1, "#521c26");
        } else {
          grad.addColorStop(0, "#4c382c");
          grad.addColorStop(0.5, "#634938");
          grad.addColorStop(1, "#3d2c22");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x + 3, y + 3, 122, 122);

        // Gilded brass inlay frame + Baroque rosette diamond
        ctx.strokeStyle = "rgba(242, 198, 100, 0.62)";
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x + 8, y + 8, 112, 112);

        ctx.beginPath();
        ctx.moveTo(x + 64, y + 20);
        ctx.lineTo(x + 108, y + 64);
        ctx.lineTo(x + 64, y + 108);
        ctx.lineTo(x + 20, y + 64);
        ctx.closePath();
        ctx.strokeStyle = "rgba(242, 198, 100, 0.28)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  } else if (kind === "wall") {
    // Warm Golden Bohemian Sandstone Ashlar Masonry
    ctx.fillStyle = "#2b211b";
    ctx.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 10; r++) {
      const y = Math.floor(r * 51.2);
      const off = (r % 2) * 48;
      for (let x = -48; x < 512; x += 96) {
        const h = hash01(x, r, 19);
        const t = Math.floor(92 + h * 34);
        ctx.fillStyle = `rgb(${t + 24},${t + 10},${t - 8})`;
        ctx.fillRect(x + off + 3, y + 3, 90, 45);
        ctx.fillStyle = "rgba(255,238,195,0.22)";
        ctx.fillRect(x + off + 3, y + 3, 90, 5);
      }
    }
  } else if (kind === "quay") {
    // Vltava Dressed Blue-Grey & Ochre Granite Blocks
    ctx.fillStyle = "#2c343d";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      ctx.fillStyle = i % 2 === 0 ? "#515e6b" : "#434f5c";
      ctx.fillRect(0, y + 3, 512, 58);
      ctx.fillStyle = "rgba(255, 224, 165, 0.18)";
      ctx.fillRect(0, y + 3, 512, 5);
    }
  } else {
    // Rich Emerald-Sapphire Vltava River with Golden Torch Ripples
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, "#0d3149");
    grad.addColorStop(0.5, "#1b5672");
    grad.addColorStop(1, "#0f2c42");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20; i++) {
      const y = i * 25 + 8;
      ctx.strokeStyle =
        i % 3 === 0 ? "rgba(255, 210, 125, 0.22)" : "rgba(140, 225, 255, 0.18)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(160, y - 14, 340, y + 14, 512, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeBumpTexture(
  kind: "cobble" | "wall" | "quay",
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#303030";
  ctx.fillRect(0, 0, 256, 256);

  if (kind === "cobble") {
    for (let r = 0; r < 8; r++) {
      const off = (r % 2) * 16;
      for (let c = -1; c < 9; c++) {
        const sx = c * 32 + off;
        const sy = r * 32;
        const tone = Math.floor(175 + hash01(c, r, 31) * 65);
        ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
        ctx.beginPath();
        ctx.roundRect(sx + 2, sy + 2, 28, 27, 4);
        ctx.fill();
      }
    }
  } else if (kind === "wall") {
    for (let r = 0; r < 8; r++) {
      const y = r * 32;
      const off = (r % 2) * 32;
      for (let x = -32; x < 256; x += 64) {
        ctx.fillStyle = "#d8d8d8";
        ctx.fillRect(x + off + 2, y + 2, 60, 28);
      }
    }
  } else {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#d0d0d0" : "#b0b0b0";
      ctx.fillRect(0, i * 32 + 2, 256, 28);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeBaroqueBannerTexture(
  faction: "imperial" | "swedish",
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  if (faction === "imperial") {
    grad.addColorStop(0, "#8f1d2c");
    grad.addColorStop(0.5, "#6d1420");
    grad.addColorStop(1, "#4a0c15");
  } else {
    grad.addColorStop(0, "#1c4a8a");
    grad.addColorStop(0.5, "#15386b");
    grad.addColorStop(1, "#0e2447");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  // Ornate gold brocade border
  ctx.strokeStyle = "#f5ca64";
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 112, 240);

  // Center Baroque Medallion & Crest
  ctx.fillStyle = "#f5ca64";
  ctx.beginPath();
  ctx.arc(64, 110, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = faction === "imperial" ? "#5a101b" : "#123262";
  ctx.beginPath();
  ctx.arc(64, 110, 26, 0, Math.PI * 2);
  ctx.fill();

  // Golden cross / crown emblem inside medallion
  ctx.fillStyle = "#ffe699";
  ctx.fillRect(58, 90, 12, 40);
  ctx.fillRect(44, 104, 40, 12);

  // Gold fringe tassels at bottom
  for (let x = 12; x < 116; x += 12) {
    ctx.fillRect(x, 236, 6, 16);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeFallbackUnitTexture(
  arch: Archetype,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  const pal = LOOK[arch];

  ctx.save();
  ctx.translate(128, 250);
  ctx.scale(4.2, 4.2);

  if (arch === "colloredo") {
    ctx.fillStyle = "#7a1b2c";
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

  ctx.fillStyle = pal.coat;
  ctx.beginPath();
  ctx.moveTo(-11, -8);
  ctx.lineTo(-13, 14);
  ctx.lineTo(13, 14);
  ctx.lineTo(11, -8);
  ctx.quadraticCurveTo(0, -18, -11, -8);
  ctx.fill();

  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(0, -16, 6.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.hat;
  ctx.beginPath();
  ctx.ellipse(0, -21, 12, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5, -30, 10, 10);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, "rgba(0,0,0,0.82)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.4)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function makeShieldTexture(full: boolean, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 240;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 192, 240);

  ctx.save();
  ctx.shadowColor = full ? "rgba(255, 224, 120, 0.95)" : "rgba(240, 180, 90, 0.78)";
  ctx.shadowBlur = 18;

  // Baroque Escutcheon Shield Silhouette
  ctx.beginPath();
  ctx.moveTo(24, 20);
  ctx.lineTo(168, 20);
  ctx.lineTo(168, 120);
  ctx.quadraticCurveTo(168, 192, 96, 224);
  ctx.quadraticCurveTo(24, 192, 24, 120);
  ctx.closePath();

  const bgGrad = ctx.createLinearGradient(0, 20, 0, 224);
  if (full) {
    bgGrad.addColorStop(0, "rgba(92, 22, 34, 0.94)");
    bgGrad.addColorStop(1, "rgba(32, 10, 16, 0.94)");
  } else {
    bgGrad.addColorStop(0, "rgba(42, 26, 18, 0.88)");
    bgGrad.addColorStop(1, "rgba(20, 12, 10, 0.88)");
  }
  ctx.fillStyle = bgGrad;
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = full ? "#ffe596" : "#e2b262";
  ctx.stroke();
  ctx.restore();

  if (full) {
    ctx.beginPath();
    ctx.moveTo(42, 40);
    ctx.lineTo(150, 40);
    ctx.lineTo(150, 118);
    ctx.quadraticCurveTo(150, 174, 96, 200);
    ctx.quadraticCurveTo(42, 174, 42, 118);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 40, 0, 200);
    grad.addColorStop(0, "rgba(255, 228, 145, 0.72)");
    grad.addColorStop(1, "rgba(212, 156, 60, 0.42)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "#fff8df";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(62, 102);
    ctx.lineTo(96, 72);
    ctx.lineTo(130, 102);
    ctx.moveTo(62, 138);
    ctx.lineTo(96, 108);
    ctx.lineTo(130, 138);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(38, 116);
    ctx.lineTo(154, 116);
    ctx.quadraticCurveTo(154, 178, 96, 204);
    ctx.quadraticCurveTo(38, 178, 38, 116);
    ctx.closePath();
    ctx.fillStyle = "rgba(235, 185, 98, 0.78)";
    ctx.fill();

    ctx.strokeStyle = "#ffe596";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(44, 114);
    ctx.lineTo(148, 114);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createFlippedPlaneGeometry(w: number, h: number, flipX: boolean): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  if (flipX) {
    const uv = geo.attributes.uv;
    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        uv.setX(i, 1 - uv.getX(i));
      }
      uv.needsUpdate = true;
    }
  }
  return geo;
}

export function createScene3D(
  mountEl: HTMLElement,
  onTileClick: (x: number, y: number) => void,
  onTileHover: (tile: { x: number; y: number } | null) => void,
  onCancelMode: () => void,
  onOverlayProject: SceneOverlayCallback,
  onThunder?: () => void,
): Scene3DHandle {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  const isSoftwareGl = isContextSoftwareGl(renderer.getContext());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.38;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  mountEl.innerHTML = "";
  mountEl.appendChild(renderer.domElement);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Declare unitRigs BEFORE any async/cached texture loaders run
  const unitRigs = new Map<string, UnitRig3D>();

  const scene = new THREE.Scene();
  // Rich Baroque Chiaroscuro Royal Indigo-Plum Night Atmosphere
  const fogColor = new THREE.Color(0x130c1c);
  const sceneFog = new THREE.FogExp2(0x130c1c, 0.0132);
  scene.background = fogColor;
  scene.fog = sceneFog;

  // Studio Environment Reflection (RoomEnvironment)
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  // Perspective Tactical Camera
  const initW = Math.max(64, mountEl.clientWidth || window.innerWidth || 1280);
  const initH = Math.max(64, mountEl.clientHeight || window.innerHeight || 720);
  const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.5, 160);
  camera.position.set(0, 17.2, 16.2);
  renderer.setSize(initW, initH, false);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.43;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.minDistance = 6.5;
  controls.maxDistance = 35;
  controls.target.set(0, 0.2, 0.4);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.update();

  // High-Baroque Chiaroscuro Multi-Light Rig (Sapphire Moonlight + Golden Candlelight + Crimson Siege Glow)
  const hemiLight = new THREE.HemisphereLight(0x8eb4e6, 0x4a2a1e, 1.35);
  hemiLight.position.set(0, 32, 0);
  scene.add(hemiLight);

  const moonKeyLight = new THREE.DirectionalLight(0xe4eeff, 2.15);
  moonKeyLight.position.set(-11, 24, 15);
  moonKeyLight.castShadow = !isSoftwareGl;
  moonKeyLight.shadow.mapSize.width = 2048;
  moonKeyLight.shadow.mapSize.height = 2048;
  const d = 19;
  moonKeyLight.shadow.camera.left = -d;
  moonKeyLight.shadow.camera.right = d;
  moonKeyLight.shadow.camera.top = d;
  moonKeyLight.shadow.camera.bottom = -d;
  moonKeyLight.shadow.camera.near = 2;
  moonKeyLight.shadow.camera.far = 54;
  moonKeyLight.shadow.bias = -0.0005;
  moonKeyLight.shadow.normalBias = 0.02;
  scene.add(moonKeyLight);

  const palaceWarmRim = new THREE.DirectionalLight(0xffb85c, 1.45);
  palaceWarmRim.position.set(-18, 11, -5);
  scene.add(palaceWarmRim);

  const riverTealBacklight = new THREE.DirectionalLight(0x3898b8, 0.85);
  riverTealBacklight.position.set(20, 8, 4);
  scene.add(riverTealBacklight);

  // Dynamic Torch, Palace & Lantern Point Lights with Organic Sway Anchors
  const palaceTorchLightNorth = new THREE.PointLight(0xffa238, 11.0, 20, 1.45);
  const northTorchBase = new THREE.Vector3(tileToWorldX(0) - 0.8, 2.8, tileToWorldZ(2));
  palaceTorchLightNorth.position.copy(northTorchBase);
  scene.add(palaceTorchLightNorth);

  const palaceTorchLightSouth = new THREE.PointLight(0xff9430, 11.0, 20, 1.45);
  const southTorchBase = new THREE.Vector3(tileToWorldX(0) - 0.8, 2.8, tileToWorldZ(6));
  palaceTorchLightSouth.position.copy(southTorchBase);
  scene.add(palaceTorchLightSouth);

  const streetCenterLight = new THREE.PointLight(0xffb454, 8.2, 18, 1.45);
  const streetTorchBase = new THREE.Vector3(tileToWorldX(5), 3.1, tileToWorldZ(4));
  streetCenterLight.position.copy(streetTorchBase);
  scene.add(streetCenterLight);

  const quayBrazierLight = new THREE.PointLight(0xffa844, 9.2, 18, 1.45);
  const quayTorchBase = new THREE.Vector3(tileToWorldX(11), 2.3, tileToWorldZ(1));
  quayBrazierLight.position.copy(quayTorchBase);
  scene.add(quayBrazierLight);

  const boatLanternLight = new THREE.PointLight(0xffcf6e, 9.8, 18, 1.4);
  boatLanternLight.position.set(tileToWorldX(14), 1.6, tileToWorldZ(3));
  scene.add(boatLanternLight);

  // Dynamic Atmospheric Mood & Storm Lightning State
  let currentLightingMood: LightingMood = "auto";
  let lightningFlash = 0;
  let lightningPulseTimer = 0;
  let nextLightningCooldown = 8.5;
  let lightningAzimuth = -1;
  let currentGodRayScale = 1.0;
  let currentRainOpacity = 0.24;

  // Texture loader with procedural base + bump maps
  const texLoader = new THREE.TextureLoader();
  const procTex = {
    cobble: makeProceduralTileTexture("cobble", maxAniso),
    palace: makeProceduralTileTexture("palace", maxAniso),
    wall: makeProceduralTileTexture("wall", maxAniso),
    quay: makeProceduralTileTexture("quay", maxAniso),
    water: makeProceduralTileTexture("water", maxAniso),
  };
  const bumpTex = {
    cobble: makeBumpTexture("cobble", maxAniso),
    wall: makeBumpTexture("wall", maxAniso),
    quay: makeBumpTexture("quay", maxAniso),
  };
  const bannerImperialTex = makeBaroqueBannerTexture("imperial", maxAniso);
  const bannerSwedishTex = makeBaroqueBannerTexture("swedish", maxAniso);
  const godRayTex = makeGodRayTexture();
  const softMistTex = makeSoftMistTexture();

  const loadArtTex = (url: string, target: THREE.CanvasTexture, blendAlpha = 0.58) => {
    texLoader.load(url, (loaded) => {
      const canvas = target.image;
      const ctx = canvas.getContext("2d");
      if (ctx && loaded.image) {
        ctx.save();
        ctx.globalAlpha = blendAlpha;
        ctx.drawImage(
          loaded.image as CanvasImageSource,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        ctx.restore();
        target.needsUpdate = true;
      }
    });
  };
  loadArtTex(cobbleUrl, procTex.cobble, 0.52);
  loadArtTex(palaceUrl, procTex.palace, 0.35);
  loadArtTex(wallUrl, procTex.wall, 0.5);
  loadArtTex(quayUrl, procTex.quay, 0.55);
  loadArtTex(waterUrl, procTex.water, 0.45);

  const unitTextures: Record<Archetype, THREE.Texture> = {
    colloredo: makeFallbackUnitTexture("colloredo", maxAniso),
    martin: makeFallbackUnitTexture("martin", maxAniso),
    vaclav: makeFallbackUnitTexture("vaclav", maxAniso),
    jakub: makeFallbackUnitTexture("jakub", maxAniso),
    musketeer: makeFallbackUnitTexture("musketeer", maxAniso),
    pikeman: makeFallbackUnitTexture("pikeman", maxAniso),
  };

  (Object.keys(SPRITE_URLS) as Archetype[]).forEach((arch) => {
    texLoader.load(SPRITE_URLS[arch], (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      unitTextures[arch] = tex;
      for (const rig of unitRigs.values()) {
        if (rig.archetype === arch) {
          rig.spriteMat.map = tex;
          rig.spriteMat.emissiveMap = tex;
          rig.spriteMat.needsUpdate = true;
          rig.depthMat.map = tex;
          rig.depthMat.needsUpdate = true;
        }
      }
    });
  });

  const contactShadowTex = makeContactShadowTexture();
  const halfShieldTex = makeShieldTexture(false, maxAniso);
  const fullShieldTex = makeShieldTexture(true, maxAniso);

  // Shared High-Baroque Materials Library
  const mats = {
    cobble: new THREE.MeshStandardMaterial({
      map: procTex.cobble,
      bumpMap: bumpTex.cobble,
      bumpScale: 0.042,
      roughness: 0.38,
      metalness: 0.16,
    }),
    puddle: new THREE.MeshStandardMaterial({
      color: 0x22384d,
      emissive: new THREE.Color(0x1b3048),
      emissiveIntensity: 0.25,
      roughness: 0.04,
      metalness: 0.9,
      transparent: true,
      opacity: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    curbStone: new THREE.MeshStandardMaterial({
      color: 0x5c4738,
      roughness: 0.55,
      metalness: 0.22,
    }),
    palaceFloor: new THREE.MeshStandardMaterial({
      map: procTex.palace,
      roughness: 0.26,
      metalness: 0.32,
    }),
    quayFloor: new THREE.MeshStandardMaterial({
      map: procTex.quay,
      bumpMap: bumpTex.quay,
      bumpScale: 0.035,
      roughness: 0.46,
      metalness: 0.18,
    }),
    wallStone: new THREE.MeshStandardMaterial({
      map: procTex.wall,
      bumpMap: bumpTex.wall,
      bumpScale: 0.05,
      roughness: 0.7,
      metalness: 0.1,
    }),
    wallCoping: new THREE.MeshStandardMaterial({
      color: 0xb89668,
      roughness: 0.44,
      metalness: 0.24,
    }),
    // Prague Baroque Terracotta Rose-Ochre Stucco
    palaceWall: new THREE.MeshStandardMaterial({
      color: 0x7a3934,
      roughness: 0.58,
      metalness: 0.12,
    }),
    // Gilded 24k Gold & Sandstone Trim
    palaceTrim: new THREE.MeshStandardMaterial({
      color: 0xefc468,
      roughness: 0.26,
      metalness: 0.78,
    }),
    // Oxidized Verdigris Copper Dome & Mansard Roof
    copperVerdigris: new THREE.MeshStandardMaterial({
      color: 0x2e7d6b,
      roughness: 0.38,
      metalness: 0.52,
    }),
    palaceRoof: new THREE.MeshStandardMaterial({
      color: 0x782822,
      roughness: 0.56,
      metalness: 0.15,
    }),
    crimsonVelvet: new THREE.MeshStandardMaterial({
      color: 0x981b2b,
      roughness: 0.62,
      metalness: 0.12,
    }),
    royalBlueVelvet: new THREE.MeshStandardMaterial({
      color: 0x1d4b8f,
      roughness: 0.58,
      metalness: 0.16,
    }),
    windowLitGold: new THREE.MeshStandardMaterial({
      color: 0xffe49e,
      emissive: new THREE.Color(0xffa438),
      emissiveIntensity: 2.2,
      roughness: 0.18,
    }),
    windowLitRuby: new THREE.MeshStandardMaterial({
      color: 0xff9488,
      emissive: new THREE.Color(0xff4238),
      emissiveIntensity: 1.85,
      roughness: 0.2,
    }),
    windowStainedSapphire: new THREE.MeshStandardMaterial({
      color: 0x74b8ff,
      emissive: new THREE.Color(0x2868c8),
      emissiveIntensity: 1.4,
      roughness: 0.2,
    }),
    flameMat: new THREE.MeshBasicMaterial({
      color: 0xffc858,
    }),
    woodDark: new THREE.MeshStandardMaterial({
      color: 0x59341e,
      roughness: 0.68,
      metalness: 0.08,
    }),
    woodLight: new THREE.MeshStandardMaterial({
      color: 0x966338,
      roughness: 0.56,
      metalness: 0.14,
    }),
    canvasSack: new THREE.MeshStandardMaterial({
      color: 0xb89262,
      roughness: 0.82,
      metalness: 0.04,
    }),
    ironRim: new THREE.MeshStandardMaterial({
      color: 0x424954,
      roughness: 0.34,
      metalness: 0.86,
    }),
    bronzeStatue: new THREE.MeshStandardMaterial({
      color: 0x8c6d3e,
      roughness: 0.32,
      metalness: 0.82,
    }),
    bannerImperial: new THREE.MeshStandardMaterial({
      map: bannerImperialTex,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
    bannerSwedish: new THREE.MeshStandardMaterial({
      map: bannerSwedishTex,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
    water: new THREE.MeshStandardMaterial({
      map: procTex.water,
      color: 0x1e6080,
      emissive: new THREE.Color(0x0c2838),
      emissiveIntensity: 0.3,
      roughness: 0.12,
      metalness: 0.82,
    }),
    decalBlood: new THREE.MeshBasicMaterial({
      color: 0x8c1622,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    smokePuff: new THREE.MeshStandardMaterial({
      color: 0xd8dce6,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
  };

  const godRayRefs: { mat: THREE.MeshBasicMaterial; baseOpacity: number }[] = [];
  function makeVolumetricRayMat(colorHex: number, baseOpacity: number): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      map: godRayTex,
      color: colorHex,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    godRayRefs.push({ mat, baseOpacity });
    return mat;
  }

  const mistSharedMat = new THREE.MeshBasicMaterial({
    map: softMistTex,
    color: 0x6c88b4,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Root groups
  const worldGroup = new THREE.Group();
  const boardGroup = new THREE.Group();
  const propsGroup = new THREE.Group();
  const marksGroup = new THREE.Group();
  const shieldsGroup = new THREE.Group();
  const unitsGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  scene.add(worldGroup);
  scene.add(boardGroup);
  scene.add(propsGroup);
  scene.add(marksGroup);
  scene.add(shieldsGroup);
  scene.add(unitsGroup);
  scene.add(fxGroup);

  const torchFlameMeshes: THREE.Mesh[] = [];
  const palaceBannerMeshes: THREE.Mesh[] = [];

  function createTorchBrazier(x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    // Gilded pedestal base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.18, 8),
      mats.palaceTrim,
    );
    base.position.y = 0.09;
    g.add(base);

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.16, 0.95, 8),
      mats.ironRim,
    );
    stand.position.y = 0.52;
    g.add(stand);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.14, 0.24, 10),
      mats.palaceTrim,
    );
    bowl.position.y = 1.04;
    g.add(bowl);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.52, 8),
      mats.flameMat,
    );
    flame.position.y = 1.34;
    g.add(flame);
    torchFlameMeshes.push(flame);

    return g;
  }

  function createBaroqueStatuePedestal(x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.35, 0.85),
      mats.wallCoping,
    );
    plinth.position.y = 0.68;
    plinth.castShadow = !isSoftwareGl;
    g.add(plinth);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.16, 0.98),
      mats.palaceTrim,
    );
    cap.position.y = 1.42;
    g.add(cap);

    const figureBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.28, 1.15, 10),
      mats.bronzeStatue,
    );
    figureBody.position.y = 2.05;
    figureBody.castShadow = !isSoftwareGl;
    g.add(figureBody);

    const figureHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      mats.bronzeStatue,
    );
    figureHead.position.y = 2.75;
    g.add(figureHead);

    // Golden Saint Halo (St. John of Nepomuk style)
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.025, 8, 20),
      mats.windowLitGold,
    );
    halo.position.set(0, 2.82, -0.05);
    g.add(halo);

    return g;
  }

  // Build Opulent High-Baroque Surroundings, Colloredo Palace, St. Nicholas Dome & Charles Bridge
  function buildOuterEnvironment(): void {
    // Extended cobblestone street north/south/west
    const streetSurroundGeo = new THREE.BoxGeometry(40, 0.5, 38);
    const streetSurround = new THREE.Mesh(streetSurroundGeo, mats.cobble);
    streetSurround.position.set(-4.5, -0.34, 0);
    streetSurround.receiveShadow = true;
    worldGroup.add(streetSurround);

    // Extended Vltava river basin to the east
    const riverPlaneGeo = new THREE.PlaneGeometry(30, 48, 24, 24);
    const riverMesh = new THREE.Mesh(riverPlaneGeo, mats.water);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(tileToWorldX(14) + 10.0, -0.28, 0);
    riverMesh.receiveShadow = true;
    worldGroup.add(riverMesh);

    // Luminous Harvest Moon & Golden Corona + Volumetric Lunar God-Rays in the Northern Sky
    const moonGroup = new THREE.Group();
    moonGroup.position.set(8, 24, -28);
    const moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff3d1 }),
    );
    moonGroup.add(moonDisc);
    const moonHalo = new THREE.Mesh(
      new THREE.RingGeometry(2.7, 5.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffcf78,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    moonGroup.add(moonHalo);
    worldGroup.add(moonGroup);

    // Volumetric Lunar Light Shafts descending across Malá Strana & the Vltava
    const moonShaftMat = makeVolumetricRayMat(0xc2dcff, 0.08);
    for (const [sx, sz, rotZ, rotX, scaleW] of [
      [-3.5, -5.5, 0.22, 0.36, 1.15],
      [4.5, -2.5, 0.14, 0.34, 1.35],
      [12.5, 1.2, 0.08, 0.32, 1.45],
    ] as const) {
      const shaftGeo = new THREE.CylinderGeometry(1.1 * scaleW, 3.8 * scaleW, 24, 16, 1, true);
      const shaftMesh = new THREE.Mesh(shaftGeo, moonShaftMat);
      shaftMesh.position.set(sx, 11.2, sz);
      shaftMesh.rotation.set(rotX, 0, rotZ);
      worldGroup.add(shaftMesh);
    }

    // Grand Baroque Colloredo Palace Wing along Western Perimeter
    const palaceFacade = new THREE.Group();
    const westX = tileToWorldX(0) - TILE_3D * 0.86;
    palaceFacade.position.set(westX, 0, 0);

    const mainWing = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 5.8, ROWS * TILE_3D + 4.8),
      mats.palaceWall,
    );
    mainWing.position.set(-1.0, 2.9, 0);
    mainWing.castShadow = !isSoftwareGl;
    mainWing.receiveShadow = true;
    palaceFacade.add(mainWing);

    // Rusticated Sandstone Ground Plinth
    const plinthWall = new THREE.Mesh(
      new THREE.BoxGeometry(2.78, 1.15, ROWS * TILE_3D + 5.0),
      mats.wallCoping,
    );
    plinthWall.position.set(-0.98, 0.58, 0);
    palaceFacade.add(plinthWall);

    // Gilded Entablature Cornice Ledge + Baroque Rooftop Balustrade
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(2.95, 0.36, ROWS * TILE_3D + 5.2),
      mats.palaceTrim,
    );
    cornice.position.set(-0.9, 5.85, 0);
    palaceFacade.add(cornice);

    // Pitched Terracotta Mansard Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 2.5, 4),
      mats.palaceRoof,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, (ROWS * TILE_3D + 4.8) / 3.1);
    roof.position.set(-1.0, 7.15, 0);
    palaceFacade.add(roof);

    // Majestic Verdigris Green Copper Baroque Cupola Dome & Golden Lantern Spire
    const domeDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.35, 2.2, 16),
      mats.wallCoping,
    );
    domeDrum.position.set(-2.6, 7.4, -2.5);
    palaceFacade.add(domeDrum);

    const copperDome = new THREE.Mesh(
      new THREE.SphereGeometry(2.25, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mats.copperVerdigris,
    );
    copperDome.position.set(-2.6, 8.4, -2.5);
    palaceFacade.add(copperDome);

    const cupolaLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.65, 1.35, 10),
      mats.palaceTrim,
    );
    cupolaLantern.position.set(-2.6, 10.8, -2.5);
    palaceFacade.add(cupolaLantern);

    const cupolaOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      mats.windowLitGold,
    );
    cupolaOrb.position.set(-2.6, 11.7, -2.5);
    palaceFacade.add(cupolaOrb);

    // Grand Baroque Portal Archway + Gilded Balcony in Center
    const portalFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.8, 2.4),
      mats.palaceTrim,
    );
    portalFrame.position.set(0.35, 1.4, 0);
    palaceFacade.add(portalFrame);

    const portalDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 2.35, 1.75),
      mats.woodDark,
    );
    portalDoor.position.set(0.38, 1.18, 0);
    palaceFacade.add(portalDoor);

    const balconySlab = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.22, 2.8),
      mats.palaceTrim,
    );
    balconySlab.position.set(0.58, 2.92, 0);
    palaceFacade.add(balconySlab);

    // Fluttering Imperial Silk Banners on the Palace Facade
    for (const bz of [-5.0, 5.0]) {
      const bannerCloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 2.1, 2, 6),
        mats.bannerImperial,
      );
      bannerCloth.rotation.y = Math.PI / 2;
      bannerCloth.position.set(0.48, 3.35, bz);
      palaceFacade.add(bannerCloth);
      palaceBannerMeshes.push(bannerCloth);

      const crossbar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8),
        mats.palaceTrim,
      );
      crossbar.rotation.x = Math.PI / 2;
      crossbar.position.set(0.48, 4.42, bz);
      palaceFacade.add(crossbar);
    }

    const rayGoldMat = makeVolumetricRayMat(0xffc864, 0.14);
    const rayRubyMat = makeVolumetricRayMat(0xff5848, 0.12);
    const raySapphireMat = makeVolumetricRayMat(0x58a6ff, 0.12);

    // Pilasters, Gilded Capitals, Pediments & Colourful Stained-Glass Baroque Windows
    for (let i = -4; i <= 4; i++) {
      const z = i * TILE_3D;
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 5.6, 0.38),
        mats.palaceTrim,
      );
      pilaster.position.set(0.32, 2.8, z + TILE_3D * 0.5);
      palaceFacade.add(pilaster);

      // Rooftop Baroque Urn Finials along the balustrade
      const roofUrn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 0.52, 8),
        mats.palaceTrim,
      );
      roofUrn.position.set(0.28, 6.25, z + TILE_3D * 0.5);
      palaceFacade.add(roofUrn);

      for (const floorY of [1.85, 4.05]) {
        if (i === 0 && floorY < 2.5) continue;
        const winFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 1.28, 0.82),
          mats.palaceTrim,
        );
        winFrame.position.set(0.34, floorY, z);
        palaceFacade.add(winFrame);

        const pediment = new THREE.Mesh(
          new THREE.ConeGeometry(0.52, 0.32, 4),
          mats.palaceTrim,
        );
        pediment.rotation.y = Math.PI / 4;
        pediment.scale.set(0.42, 1, 1.28);
        pediment.position.set(0.38, floorY + 0.76, z);
        palaceFacade.add(pediment);

        const winPick = (Math.abs(i * 3) + Math.round(floorY)) % 3;
        const paneMat =
          winPick === 0
            ? mats.windowLitGold
            : winPick === 1
              ? mats.windowLitRuby
              : mats.windowStainedSapphire;

        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 1.04, 0.62),
          paneMat,
        );
        pane.position.set(0.37, floorY, z);
        palaceFacade.add(pane);

        // Volumetric Stained-Glass Light Shafts streaming from Palace Windows onto the Street
        const winRayMat =
          winPick === 0 ? rayGoldMat : winPick === 1 ? rayRubyMat : raySapphireMat;
        const rayLen = floorY > 3 ? 5.6 : 3.4;
        const winRayGeo = new THREE.CylinderGeometry(0.24, 0.92, rayLen, 12, 1, true);
        const winRay = new THREE.Mesh(winRayGeo, winRayMat);
        winRay.rotation.z = Math.PI * 0.31;
        winRay.position.set(0.38 + rayLen * 0.41, floorY - rayLen * 0.26, z);
        palaceFacade.add(winRay);
      }
    }
    worldGroup.add(palaceFacade);

    // Palace Entrance Braziers, Street Corner Braziers & Quay Watch Braziers
    worldGroup.add(
      createTorchBrazier(tileToWorldX(0) - 0.52, 0.18, tileToWorldZ(2)),
    );
    worldGroup.add(
      createTorchBrazier(tileToWorldX(0) - 0.52, 0.18, tileToWorldZ(6)),
    );
    worldGroup.add(
      createTorchBrazier(tileToWorldX(5), 0.0, tileToWorldZ(0) - 1.15),
    );
    worldGroup.add(
      createTorchBrazier(tileToWorldX(5), 0.0, tileToWorldZ(8) + 1.15),
    );
    worldGroup.add(
      createTorchBrazier(tileToWorldX(11) + 0.65, -0.06, tileToWorldZ(0) - 0.55),
    );
    worldGroup.add(
      createTorchBrazier(tileToWorldX(11) + 0.65, -0.06, tileToWorldZ(8) + 0.55),
    );

    // Baroque Nepomuk Saint Statues flanking the Street & Quay
    worldGroup.add(
      createBaroqueStatuePedestal(tileToWorldX(1), 0, tileToWorldZ(0) - 1.35),
    );
    worldGroup.add(
      createBaroqueStatuePedestal(tileToWorldX(10), 0, tileToWorldZ(8) + 1.35),
    );

    // Charles Bridge (Karlův most) with Baroque Statues & Old Town Bridge Tower
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(tileToWorldX(14) + 5.5, -0.25, -13.5);
    for (let a = -3; a <= 3; a++) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 2.3, 1.9),
        mats.wallStone,
      );
      pier.position.set(a * 3.4, 0.95, 0);
      bridgeGroup.add(pier);

      // Bridge statues along parapet
      const statue = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.25, 1.1, 8),
        mats.bronzeStatue,
      );
      statue.position.set(a * 3.4, 2.85, 0.65);
      bridgeGroup.add(statue);
    }
    const bridgeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(25, 0.65, 1.75),
      mats.wallCoping,
    );
    bridgeDeck.position.set(0, 2.15, 0);
    bridgeGroup.add(bridgeDeck);

    const bridgeTower = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 7.4, 2.9),
      mats.palaceWall,
    );
    bridgeTower.position.set(9.5, 3.7, 0);
    bridgeGroup.add(bridgeTower);

    const towerSpire = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 3.8, 4),
      mats.copperVerdigris,
    );
    towerSpire.rotation.y = Math.PI / 4;
    towerSpire.position.set(9.5, 9.1, 0);
    bridgeGroup.add(towerSpire);
    worldGroup.add(bridgeGroup);
  }
  buildOuterEnvironment();

  // 3D Falling Rain Streaks + Rising Golden Fire Embers
  const RAIN_COUNT = isSoftwareGl ? 65 : 150;
  const rainPositions = new Float32Array(RAIN_COUNT * 6);
  const rainDrops: { x: number; y: number; z: number; speed: number }[] = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainDrops.push({
      x: (hash01(i, 1, 7) - 0.5) * 34,
      y: hash01(i, 2, 13) * 14,
      z: (hash01(i, 3, 29) - 0.5) * 24,
      speed: 12.5 + hash01(i, 4, 37) * 5.5,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xa8c8ee,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  worldGroup.add(rainLines);

  // Rising Golden Baroque Fire Embers
  const EMBER_COUNT = isSoftwareGl ? 24 : 55;
  const emberGeo = new THREE.DodecahedronGeometry(0.055, 0);
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xffba42,
    transparent: true,
    opacity: 0.88,
  });
  const emberInstanced = new THREE.InstancedMesh(emberGeo, emberMat, EMBER_COUNT);
  const emberData: { x: number; y: number; z: number; vy: number; phase: number }[] = [];
  const _emberDummy = new THREE.Object3D();
  for (let i = 0; i < EMBER_COUNT; i++) {
    emberData.push({
      x: (hash01(i, 5, 17) - 0.5) * 30,
      y: hash01(i, 6, 19) * 6.5,
      z: (hash01(i, 7, 23) - 0.5) * 18,
      vy: 0.65 + hash01(i, 8, 29) * 0.9,
      phase: hash01(i, 9, 31) * Math.PI * 2,
    });
  }
  worldGroup.add(emberInstanced);

  // Forked Storm Lightning Bolt in the Northern Horizon Sky
  const lightningBoltMat = new THREE.MeshBasicMaterial({
    color: 0xe8f4ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const lightningBoltGroup = new THREE.Group();
  lightningBoltGroup.position.set(-4, 18, -25);
  const boltPoints = [
    new THREE.Vector3(0, 8, 0),
    new THREE.Vector3(-1.2, 4.5, 0.4),
    new THREE.Vector3(0.6, 1.8, -0.2),
    new THREE.Vector3(-0.9, -2.2, 0.3),
    new THREE.Vector3(0.3, -6.5, 0),
  ];
  const boltCurve = new THREE.CatmullRomCurve3(boltPoints);
  const boltMesh = new THREE.Mesh(
    new THREE.TubeGeometry(boltCurve, 16, 0.14, 6, false),
    lightningBoltMat,
  );
  lightningBoltGroup.add(boltMesh);
  worldGroup.add(lightningBoltGroup);

  // Drifting Low-Lying Street & River Mist Illuminated by Nearby Lights
  const MIST_COUNT = isSoftwareGl ? 10 : 18;
  const mistGeo = new THREE.PlaneGeometry(5.8, 5.8);
  mistGeo.rotateX(-Math.PI / 2);
  const mistPlanes: {
    mesh: THREE.Mesh;
    baseX: number;
    baseY: number;
    baseZ: number;
    speed: number;
    seed: number;
  }[] = [];
  for (let i = 0; i < MIST_COUNT; i++) {
    const mesh = new THREE.Mesh(mistGeo, mistSharedMat);
    const isRiverMist = i >= Math.floor(MIST_COUNT * 0.65);
    const bx = isRiverMist
      ? tileToWorldX(12) + hash01(i, 11, 41) * 10
      : (hash01(i, 12, 43) - 0.5) * 26;
    const bz = (hash01(i, 13, 47) - 0.5) * 17;
    const by = isRiverMist ? -0.12 + (i % 3) * 0.08 : 0.12 + (i % 4) * 0.09;
    mesh.position.set(bx, by, bz);
    const sc = 0.85 + hash01(i, 14, 53) * 0.65;
    mesh.scale.set(sc * 1.25, 1, sc);
    worldGroup.add(mesh);
    mistPlanes.push({
      mesh,
      baseX: bx,
      baseY: by,
      baseZ: bz,
      speed: 0.35 + hash01(i, 15, 59) * 0.45,
      seed: i * 2.1,
    });
  }

  // Composite 3D Prop Builders (3-12 parts per prop, bottom-center pivot)
  function createWallGroup(x: number, y: number): THREE.Group {
    const g = new THREE.Group();
    const basePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_3D * 0.98, 0.28, TILE_3D * 0.98),
      mats.wallCoping,
    );
    basePlinth.position.y = 0.14;
    basePlinth.castShadow = !isSoftwareGl;
    basePlinth.receiveShadow = true;
    g.add(basePlinth);

    const coreWall = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_3D * 0.88, 1.78, TILE_3D * 0.88),
      mats.wallStone,
    );
    coreWall.position.y = 0.28 + 1.78 / 2;
    coreWall.castShadow = !isSoftwareGl;
    coreWall.receiveShadow = true;
    g.add(coreWall);

    // Gilded Baroque Relief Escutcheon Plaque on Front & Back of Wall
    for (const sideZ of [-0.89, 0.89]) {
      const crest = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8),
        mats.palaceTrim,
      );
      crest.rotation.x = Math.PI / 2;
      crest.position.set(0, 1.18, sideZ);
      g.add(crest);
    }

    const topCoping = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_3D * 1.0, 0.22, TILE_3D * 1.0),
      mats.palaceRoof,
    );
    topCoping.position.y = 2.12;
    topCoping.castShadow = !isSoftwareGl;
    topCoping.receiveShadow = true;
    g.add(topCoping);

    // Corner sandstone buttress pillars
    for (const [cx, cz] of [
      [-0.76, -0.76],
      [0.76, -0.76],
      [-0.76, 0.76],
      [0.76, 0.76],
    ] as const) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 2.26, 0.38),
        mats.wallCoping,
      );
      pillar.position.set(cx, 1.13, cz);
      pillar.castShadow = !isSoftwareGl;
      g.add(pillar);
    }

    // Gilded Baroque Urn Finial on alternating wall segments
    if ((x + y) % 2 === 0) {
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.28, 0.24, 8),
        mats.palaceTrim,
      );
      pedestal.position.y = 2.34;
      g.add(pedestal);

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        mats.palaceTrim,
      );
      orb.position.y = 2.56;
      g.add(orb);
    }
    return g;
  }

  function createRubbleGroup(x: number, y: number): THREE.Group {
    const g = new THREE.Group();
    const mound = new THREE.Mesh(
      new THREE.CylinderGeometry(0.74, 0.95, 0.26, 10),
      mats.wallStone,
    );
    mound.position.y = 0.13;
    mound.receiveShadow = true;
    g.add(mound);

    const offsets = [
      [-0.36, 0.2, -0.22, 0.45, 0.32, 0.38],
      [0.34, 0.22, 0.24, 0.5, 0.36, 0.4],
      [-0.12, 0.28, 0.36, 0.38, 0.3, 0.34],
      [0.2, 0.18, -0.36, 0.42, 0.26, 0.32],
      [0.0, 0.36, 0.0, 0.36, 0.34, 0.36],
    ];
    offsets.forEach(([ox, oy, oz, sx, sy, sz], i) => {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.28, 0),
        i % 3 === 0 ? mats.palaceTrim : i % 2 === 0 ? mats.wallStone : mats.wallCoping,
      );
      rock.position.set(ox!, oy!, oz!);
      rock.scale.set(sx! * 2.2, sy! * 2.2, sz! * 2.2);
      rock.rotation.set(x + i, y * 0.7, i * 1.1);
      rock.castShadow = !isSoftwareGl;
      rock.receiveShadow = true;
      g.add(rock);
    });
    return g;
  }

  function createCartGroup(x: number, y: number): THREE.Group {
    const g = new THREE.Group();
    g.rotation.y = ((x * 3 + y) % 2 === 0 ? 1 : -1) * 0.22;

    // Painted Baroque Supply Wagon Bed
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 0.16, 0.94),
      mats.woodDark,
    );
    bed.position.y = 0.48;
    bed.castShadow = !isSoftwareGl;
    bed.receiveShadow = true;
    g.add(bed);

    // Crimson & Gold Side Panels
    for (const side of [-0.43, 0.43]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.38, 0.09),
        mats.crimsonVelvet,
      );
      rail.position.set(0, 0.7, side);
      rail.castShadow = !isSoftwareGl;
      g.add(rail);

      const goldTrim = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 0.06, 0.11),
        mats.palaceTrim,
      );
      goldTrim.position.set(0, 0.88, side);
      g.add(goldTrim);
    }

    // Pulling shafts in front
    for (const side of [-0.26, 0.26]) {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, 0.58, 6),
        mats.woodLight,
      );
      shaft.rotation.z = Math.PI / 2.3;
      shaft.position.set(0.86, 0.34, side);
      g.add(shaft);
    }

    // Spoked Wheels + Gilded Hubs
    for (const side of [-0.5, 0.5]) {
      const wheelRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.058, 8, 18),
        mats.ironRim,
      );
      wheelRing.position.set(0, 0.39, side);
      wheelRing.castShadow = !isSoftwareGl;
      g.add(wheelRing);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.15, 8),
        mats.palaceTrim,
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, 0.39, side);
      g.add(hub);

      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.045, 0.035),
          mats.woodLight,
        );
        spoke.rotation.z = (s * Math.PI) / 4;
        spoke.position.set(0, 0.39, side);
        g.add(spoke);
      }
    }

    // Colourful Merchant Bales & Brass-Bound Gunpowder Barrel
    const sack = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 10, 8),
      mats.royalBlueVelvet,
    );
    sack.scale.set(1.25, 0.88, 0.95);
    sack.position.set(-0.24, 0.74, 0.05);
    sack.castShadow = !isSoftwareGl;
    g.add(sack);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.52, 12),
      mats.woodLight,
    );
    barrel.position.set(0.28, 0.78, -0.06);
    barrel.castShadow = !isSoftwareGl;
    g.add(barrel);

    // Glowing Wagon Lantern
    const wagonLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      mats.windowLitGold,
    );
    wagonLantern.position.set(0.72, 0.92, 0.42);
    g.add(wagonLantern);

    return g;
  }

  // Baroque Noble Escape Skiff 3D Model
  const boatGroup = new THREE.Group();
  function buildBoatModel(): void {
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.74, 0.52, 2.5, 14, 1, false, 0, Math.PI),
      mats.woodDark,
    );
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.scale.set(1.0, 0.75, 0.72);
    hull.position.y = 0.28;
    hull.castShadow = !isSoftwareGl;
    boatGroup.add(hull);

    // Gilded Gunwale Trim
    const gunwale = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.068, 8, 22),
      mats.palaceTrim,
    );
    gunwale.rotation.x = Math.PI / 2;
    gunwale.scale.set(0.67, 1.36, 1);
    gunwale.position.y = 0.37;
    boatGroup.add(gunwale);

    // Crimson Velvet Cushioned Benches
    for (const bz of [-0.38, 0.3]) {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.085, 0.26),
        mats.crimsonVelvet,
      );
      bench.position.set(0, 0.33, bz);
      boatGroup.add(bench);
    }

    // Wooden oars resting across the gunwales
    for (const side of [-1, 1]) {
      const oar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, 1.65, 6),
        mats.woodLight,
      );
      oar.rotation.x = Math.PI / 2.2;
      oar.rotation.z = side * 0.32;
      oar.position.set(side * 0.52, 0.42, 0.05);
      boatGroup.add(oar);
    }

    // Gilded Baroque Prow Scroll & Lantern Post
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.052, 1.02, 8),
      mats.palaceTrim,
    );
    post.position.set(0, 0.8, -0.84);
    boatGroup.add(post);

    const lanternBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      mats.windowLitGold,
    );
    lanternBulb.position.set(0, 1.3, -0.84);
    boatGroup.add(lanternBulb);
  }
  buildBoatModel();
  propsGroup.add(boatGroup);

  // Tile Grid & Dynamic Props Storage
  let tileKey = "";
  const tileCells: TileCell3D[] = [];

  // Invisible fast ground raycast plane on Layer 1
  const raycastPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * TILE_3D, ROWS * TILE_3D),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  raycastPlane.rotation.x = -Math.PI / 2;
  raycastPlane.layers.set(1);
  scene.add(raycastPlane);

  function rebuildMapGeometry(tiles: TileKind[][]): void {
    const nextKey = tiles.map((r) => r.join("")).join("|");
    if (nextKey === tileKey) return;
    tileKey = nextKey;

    while (boardGroup.children.length > 0) {
      boardGroup.remove(boardGroup.children[0]!);
    }
    for (const cell of tileCells) {
      if (cell.propGroup) propsGroup.remove(cell.propGroup);
    }
    tileCells.length = 0;

    const tileGeo = new THREE.BoxGeometry(TILE_3D * 0.98, 0.36, TILE_3D * 0.98);
    const curbFrameGeo = new THREE.RingGeometry(0.92, 0.98, 4);
    curbFrameGeo.rotateX(-Math.PI / 2);
    curbFrameGeo.rotateY(Math.PI / 4);
    const stepEdgeGeo = new THREE.BoxGeometry(0.18, 0.3, TILE_3D * 0.98);
    const puddleGeo = new THREE.CircleGeometry(0.54, 12);
    puddleGeo.rotateX(-Math.PI / 2);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const kind = at(tiles, x, y) ?? "cobble";
        const wx = tileToWorldX(x);
        const wz = tileToWorldZ(y);
        const h = groundHeightAt(kind);

        if (kind !== "river" && kind !== "boat") {
          const mat =
            kind === "palace"
              ? mats.palaceFloor
              : kind === "quay"
                ? mats.quayFloor
                : mats.cobble;
          const block = new THREE.Mesh(tileGeo, mat);
          block.position.set(wx, h - 0.18, wz);
          block.receiveShadow = true;
          boardGroup.add(block);

          // Gilded curb on palace tiles, stone bevel on streets
          const curb = new THREE.Mesh(
            curbFrameGeo,
            kind === "palace" ? mats.palaceTrim : mats.curbStone,
          );
          curb.position.set(wx, h + 0.004, wz);
          boardGroup.add(curb);

          // Rain puddle specular reflections on cobblestone tiles
          if (kind === "cobble" && hash01(x, y, 43) > 0.64) {
            const puddle = new THREE.Mesh(puddleGeo, mats.puddle);
            puddle.position.set(
              wx + (hash01(x, y, 47) - 0.5) * 0.35,
              h + 0.008,
              wz + (hash01(x, y, 53) - 0.5) * 0.35,
            );
            puddle.scale.set(1.12, 1, 0.8);
            boardGroup.add(puddle);
          }

          if (kind === "quay") {
            const timber = new THREE.Mesh(stepEdgeGeo, mats.palaceTrim);
            timber.position.set(wx + TILE_3D * 0.46, h - 0.04, wz);
            boardGroup.add(timber);

            if (y % 2 === 1) {
              const bollard = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.15, 0.52, 10),
                mats.palaceTrim,
              );
              bollard.position.set(wx + TILE_3D * 0.38, h + 0.26, wz + 0.65);
              bollard.castShadow = !isSoftwareGl;
              boardGroup.add(bollard);
            }
          }
        } else {
          const riverTile = new THREE.Mesh(
            new THREE.PlaneGeometry(TILE_3D, TILE_3D, 4, 4),
            mats.water,
          );
          riverTile.rotation.x = -Math.PI / 2;
          riverTile.position.set(wx, -0.27, wz);
          riverTile.receiveShadow = true;
          boardGroup.add(riverTile);
        }

        let propGroup: THREE.Group | null = null;
        if (kind === "wall") {
          propGroup = createWallGroup(x, y);
          propGroup.position.set(wx, h, wz);
          propsGroup.add(propGroup);
        } else if (kind === "rubble") {
          propGroup = createRubbleGroup(x, y);
          propGroup.position.set(wx, h, wz);
          propsGroup.add(propGroup);
        } else if (kind === "cart") {
          propGroup = createCartGroup(x, y);
          propGroup.position.set(wx, h, wz);
          propsGroup.add(propGroup);
        }

        tileCells.push({ x, y, kind, propGroup });
      }
    }
  }

  // Pooled 3D Tactical Tile Overlays, Cover Shields & Aim Arc
  const markFrameGeo = new THREE.RingGeometry(0.68, 0.88, 4);
  markFrameGeo.rotateX(-Math.PI / 2);
  markFrameGeo.rotateY(Math.PI / 4);

  const markFillGeo = new THREE.PlaneGeometry(TILE_3D * 0.84, TILE_3D * 0.84);
  markFillGeo.rotateX(-Math.PI / 2);

  const markColors: Record<MarkKind, { fill: number; rim: number; fillAlpha: number }> = {
    move: { fill: 0x165ac8, rim: 0x64b8ff, fillAlpha: 0.38 }, // 1. akce (1 AP): Imperial Azure
    far: { fill: 0xd68e18, rim: 0xffd266, fillAlpha: 0.32 },  // 2. akce (2 AP / chvat): Royal Amber / Gold
    attack: { fill: 0xc22238, rim: 0xff6e7c, fillAlpha: 0.44 },
    soft: { fill: 0x8a2030, rim: 0xd86874, fillAlpha: 0.22 },
    path: { fill: 0x64b8ff, rim: 0xd8f0ff, fillAlpha: 0.46 },
    quay: { fill: 0xe6b85c, rim: 0xffe28a, fillAlpha: 0.28 },
    zone: { fill: 0x2880d8, rim: 0x7ac4ff, fillAlpha: 0.26 },
    hover: { fill: 0xfff0cc, rim: 0xffffff, fillAlpha: 0.38 },
    blast: { fill: 0xe86824, rim: 0xffb258, fillAlpha: 0.42 },
  };

  const markPool: {
    group: THREE.Group;
    fill: THREE.Mesh;
    fillMat: THREE.MeshBasicMaterial;
    rim: THREE.Mesh;
    rimMat: THREE.MeshBasicMaterial;
  }[] = [];

  function getMarkMesh(idx: number) {
    let item = markPool[idx];
    if (!item) {
      const group = new THREE.Group();
      const fillMat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const rimMat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      const fill = new THREE.Mesh(markFillGeo, fillMat);
      const rim = new THREE.Mesh(markFrameGeo, rimMat);
      rim.position.y = 0.01;
      group.add(fill);
      group.add(rim);
      marksGroup.add(group);
      item = { group, fill, fillMat, rim, rimMat };
      markPool.push(item);
    }
    item.group.visible = true;
    return item;
  }

  // 3D Waypoint Path Ribbon — initialized with valid points
  const pathLineMat = new THREE.LineBasicMaterial({
    color: 0xffea9f,
    transparent: true,
    opacity: 0.96,
  });
  const pathLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.1, 0),
    new THREE.Vector3(0, 0.2, 0),
  ]);
  const pathLine = new THREE.Line(pathLineGeo, pathLineMat);
  pathLine.visible = false;
  marksGroup.add(pathLine);

  // 3D Aiming / Parabolic Grenade Trajectory Tube
  const aimCurveMat = new THREE.MeshBasicMaterial({
    color: 0xff5252,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  let aimTubeMesh: THREE.Mesh | null = null;

  const targetLockRingGeo = new THREE.RingGeometry(0.62, 0.8, 28);
  targetLockRingGeo.rotateX(-Math.PI / 2);
  const targetLockMat = new THREE.MeshBasicMaterial({
    color: 0xff5a64,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const targetLockMesh = new THREE.Mesh(targetLockRingGeo, targetLockMat);
  targetLockMesh.visible = false;
  marksGroup.add(targetLockMesh);

  const blastRingGeo = new THREE.RingGeometry(TILE_3D * 1.38, TILE_3D * 1.48, 32);
  blastRingGeo.rotateX(-Math.PI / 2);
  const blastRingMat = new THREE.MeshBasicMaterial({
    color: 0xff9438,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const blastRingMesh = new THREE.Mesh(blastRingGeo, blastRingMat);
  blastRingMesh.visible = false;
  marksGroup.add(blastRingMesh);

  // 3D Directional Cover Shield Pool
  const shieldGeo = new THREE.PlaneGeometry(0.74, 0.92);
  const halfShieldMat = new THREE.MeshBasicMaterial({
    map: halfShieldTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const fullShieldMat = new THREE.MeshBasicMaterial({
    map: fullShieldTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shieldPool: THREE.Mesh[] = [];

  function getShieldMesh(idx: number, full: boolean): THREE.Mesh {
    let m = shieldPool[idx];
    if (!m) {
      m = new THREE.Mesh(shieldGeo, full ? fullShieldMat : halfShieldMat);
      shieldsGroup.add(m);
      shieldPool.push(m);
    }
    m.material = full ? fullShieldMat : halfShieldMat;
    m.visible = true;
    return m;
  }

  // Blood Decals & 3D Smoke Puffs Pools
  const decalGeo = new THREE.CircleGeometry(0.55, 12);
  decalGeo.rotateX(-Math.PI / 2);
  const decalPool: THREE.Mesh[] = [];

  const smokeSpheresGeo = new THREE.SphereGeometry(0.46, 10, 8);
  const smokePool: THREE.Group[] = [];

  function getOrCreateUnitRig(u: PaintUnit): UnitRig3D {
    let rig = unitRigs.get(u.id);
    if (rig) return rig;

    const group = new THREE.Group();

    // Soft radial contact shadow
    const shadowDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 1.55),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    group.add(shadowDisc);

    // Gilded Baroque Heraldic Plinth Base (Imperial Crimson vs. Swedish Royal Blue)
    const plinthColor = u.faction === "imperial" ? 0x921d2e : 0x1e4a8c;
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.62, 0.13, 16),
      new THREE.MeshStandardMaterial({
        color: plinthColor,
        roughness: 0.36,
        metalness: 0.42,
      }),
    );
    plinth.position.y = 0.065;
    plinth.castShadow = !isSoftwareGl;
    plinth.receiveShadow = true;
    group.add(plinth);

    const plinthRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.044, 8, 28),
      new THREE.MeshStandardMaterial({
        color: u.faction === "imperial" ? 0xf5cd70 : 0xff6464,
        roughness: 0.24,
        metalness: 0.85,
      }),
    );
    plinthRing.rotation.x = Math.PI / 2;
    plinthRing.position.y = 0.11;
    group.add(plinthRing);

    // 3D Directional Facing Chevron on Plinth Edge
    const facingChevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.22, 3),
      new THREE.MeshBasicMaterial({
        color: u.faction === "imperial" ? 0xffe89e : 0xff8282,
      }),
    );
    facingChevron.rotation.z = -Math.PI / 2;
    facingChevron.position.set(0.64, 0.11, 0);
    group.add(facingChevron);

    // Selection glow ring + Volumetric Golden God-Ray Spotlight Pillar
    const selectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.66, 0.82, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffea98,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.position.y = 0.045;
    selectRing.visible = false;
    group.add(selectRing);

    const selectBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.68, 2.6, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe28a,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    selectBeam.position.y = 1.32;
    selectBeam.visible = false;
    group.add(selectBeam);

    // Overwatch (Hradba) ring
    const overwatchRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.94, 6),
      new THREE.MeshBasicMaterial({
        color: 0x6ac4ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    );
    overwatchRing.rotation.x = -Math.PI / 2;
    overwatchRing.position.y = 0.055;
    overwatchRing.visible = false;
    group.add(overwatchRing);

    // Blessing halo ring
    const blessingRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.032, 8, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffea98,
        transparent: true,
        opacity: 0.92,
      }),
    );
    blessingRing.rotation.x = Math.PI / 2;
    blessingRing.position.y = 2.06;
    blessingRing.visible = false;
    group.add(blessingRing);

    // VIP Marshal Colloredo Floating Golden Baroque Star Emblem
    let vipCrown: THREE.Mesh | null = null;
    if (u.vip) {
      vipCrown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe694 }),
      );
      vipCrown.position.y = 2.22;
      group.add(vipCrown);
    }

    // Upright HD-2D Character Sprite Billboard with Normal-Safe Flipped Geometries
    const spritePivot = new THREE.Group();
    spritePivot.position.y = 0.11;
    group.add(spritePivot);

    const h = SPRITE_WORLD_H[u.archetype];
    const w = h * 0.82;
    const spriteGeoRight = createFlippedPlaneGeometry(w, h, false);
    const spriteGeoLeft = createFlippedPlaneGeometry(w, h, true);

    const tex = unitTextures[u.archetype];
    const spriteMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: 0.44,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.5,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: tex,
      alphaTest: 0.2,
    });

    const spriteMesh = new THREE.Mesh(spriteGeoRight, spriteMat);
    spriteMesh.castShadow = !isSoftwareGl;
    spriteMesh.receiveShadow = true;
    spriteMesh.customDepthMaterial = depthMat;
    spritePivot.add(spriteMesh);

    unitsGroup.add(group);
    rig = {
      group,
      plinthRing,
      facingChevron,
      selectRing,
      selectBeam,
      overwatchRing,
      blessingRing,
      vipCrown,
      spritePivot,
      spriteMesh,
      spriteGeoRight,
      spriteGeoLeft,
      spriteMat,
      depthMat,
      archetype: u.archetype,
    };
    unitRigs.set(u.id, rig);
    return rig;
  }

  // 3D Combat FX (Tracers, Slash Arcs, Shockwave Rings, Sparks)
  const sparkGeo = new THREE.BoxGeometry(0.095, 0.095, 0.095);
  const sparkPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];

  // Camera Choreography State
  let activeActionCam: {
    camPos: THREE.Vector3;
    lookTarget: THREE.Vector3;
    savedPos: THREE.Vector3;
    savedTarget: THREE.Vector3;
    timeLeft: number;
    returning: boolean;
    returnTimer: number;
  } | null = null;

  let desiredCamPos: THREE.Vector3 | null = null;
  let desiredLookTarget: THREE.Vector3 | null = null;

  controls.addEventListener("start", () => {
    desiredCamPos = null;
    desiredLookTarget = null;
  });

  // Pointer Raycasting & Drag Disambiguation
  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);
  let downPos = { x: 0, y: 0 };
  let lastHoverRayTime = 0;

  function pickTileFromEvent(event: PointerEvent): { x: number; y: number } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(_mouseNdc, camera);
    if (raycaster.ray.intersectPlane(_groundPlane, _planeIntersect)) {
      return worldToTile(_planeIntersect.x, _planeIntersect.z);
    }
    return null;
  }

  const onPointerDown = (e: PointerEvent) => {
    downPos = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 2) {
      onCancelMode();
      return;
    }
    if (e.button !== 0) return;
    const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (dist > 10) return;
    const tile = pickTileFromEvent(e);
    if (tile) onTileClick(tile.x, tile.y);
  };

  const onPointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - lastHoverRayTime < 28) return;
    lastHoverRayTime = now;
    const tile = pickTileFromEvent(e);
    onTileHover(tile);
  };

  const onPointerLeave = () => {
    onTileHover(null);
  };

  const onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown, true);
  renderer.domElement.addEventListener("pointerup", onPointerUp, true);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("contextmenu", onContextMenu);

  const resizeObserver = new ResizeObserver(() => {
    const w = Math.max(64, mountEl.clientWidth || window.innerWidth || 1280);
    const h = Math.max(64, mountEl.clientHeight || window.innerHeight || 720);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  resizeObserver.observe(mountEl);

  function updateCameraRig(dt: number, shake: number, time: number): void {
    if (activeActionCam) {
      controls.enabled = false;
      if (!activeActionCam.returning) {
        activeActionCam.timeLeft -= dt;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          activeActionCam.camPos.x,
          7.5,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          activeActionCam.camPos.y,
          7.5,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          activeActionCam.camPos.z,
          7.5,
          dt,
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          activeActionCam.lookTarget.x,
          9,
          dt,
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          activeActionCam.lookTarget.y,
          9,
          dt,
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          activeActionCam.lookTarget.z,
          9,
          dt,
        );
        if (activeActionCam.timeLeft <= 0) {
          activeActionCam.returning = true;
          activeActionCam.returnTimer = 0.42;
        }
      } else {
        activeActionCam.returnTimer -= dt;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          activeActionCam.savedPos.x,
          8,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          activeActionCam.savedPos.y,
          8,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          activeActionCam.savedPos.z,
          8,
          dt,
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          activeActionCam.savedTarget.x,
          8,
          dt,
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          activeActionCam.savedTarget.y,
          8,
          dt,
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          activeActionCam.savedTarget.z,
          8,
          dt,
        );
        if (activeActionCam.returnTimer <= 0) {
          activeActionCam = null;
          controls.enabled = true;
        }
      }
      camera.lookAt(controls.target);
    } else if (desiredCamPos && desiredLookTarget) {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamPos.x, 6, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamPos.y, 6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamPos.z, 6, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredLookTarget.x, 6, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredLookTarget.y, 6, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredLookTarget.z, 6, dt);
      controls.update();
      if (
        camera.position.distanceToSquared(desiredCamPos) < 0.02 &&
        controls.target.distanceToSquared(desiredLookTarget) < 0.02
      ) {
        desiredCamPos = null;
        desiredLookTarget = null;
      }
    } else {
      controls.update();
    }

    if (shake > 0) {
      const s = shake * 0.022;
      camera.position.x += Math.sin(time * 48) * s;
      camera.position.y += Math.cos(time * 39) * s * 0.6;
    }
  }

  let syncTimer = 0;
  if (!isSoftwareGl) {
    try {
      renderer.compile(scene, camera);
    } catch {
      // Ignore pre-compile fallback
    }
  }

  return {
    isSoftwareGl,

    afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || typeof gl.fenceSync !== "function") {
        syncTimer = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          syncTimer = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          syncTimer = window.setTimeout(cb, 80);
        }
      };
      syncTimer = window.setTimeout(poll, 5);
    },

    setCameraPreset(preset: CameraPreset) {
      activeActionCam = null;
      controls.enabled = true;
      const cx = controls.target.x;
      const cz = controls.target.z;
      if (preset === "overhead") {
        desiredLookTarget = new THREE.Vector3(0, 0, 0);
        desiredCamPos = new THREE.Vector3(0, 26, 3.2);
      } else if (preset === "street") {
        desiredLookTarget = new THREE.Vector3(cx, 0.8, cz);
        desiredCamPos = new THREE.Vector3(cx - 8.5, 6.2, cz + 10.5);
      } else {
        desiredLookTarget = new THREE.Vector3(0, 0.2, 0.4);
        desiredCamPos = new THREE.Vector3(0, 17.2, 16.2);
      }
    },

    focusTile(tx: number, ty: number) {
      const wx = tileToWorldX(tx);
      const wz = tileToWorldZ(ty);
      const offset = _vec3A.copy(camera.position).sub(controls.target);
      desiredLookTarget = new THREE.Vector3(wx, 0.4, wz);
      desiredCamPos = new THREE.Vector3(
        wx + offset.x,
        Math.max(8, camera.position.y),
        wz + offset.z,
      );
    },

    rotateBy(angleRad: number) {
      const offset = _vec3A.copy(camera.position).sub(controls.target);
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const nx = offset.x * cos - offset.z * sin;
      const nz = offset.x * sin + offset.z * cos;
      desiredLookTarget = controls.target.clone();
      desiredCamPos = new THREE.Vector3(
        controls.target.x + nx,
        camera.position.y,
        controls.target.z + nz,
      );
    },

    panBy(dx: number, dz: number) {
      _vec3A.copy(camera.position).sub(controls.target);
      _vec3A.y = 0;
      _vec3A.normalize();
      const rx = _vec3A.z;
      const rz = -_vec3A.x;
      const moveX = rx * dx - _vec3A.x * dz;
      const moveZ = rz * dx - _vec3A.z * dz;
      controls.target.x = THREE.MathUtils.clamp(controls.target.x + moveX, -15, 15);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z + moveZ, -10, 10);
      camera.position.x += moveX;
      camera.position.z += moveZ;
    },

    triggerActionCam(shot: ActionCamShot) {
      const ax = tileToWorldX(shot.ax);
      const az = tileToWorldZ(shot.ay);
      const tx = tileToWorldX(shot.tx);
      const tz = tileToWorldZ(shot.ty);

      _vec3A.set(tx - ax, 0, tz - az);
      if (_vec3A.lengthSq() < 0.01) _vec3A.set(1, 0, 0);
      _vec3A.normalize();

      const sideX = -_vec3A.z;
      const sideZ = _vec3A.x;

      const camPos = new THREE.Vector3(
        ax - _vec3A.x * 3.4 + sideX * 1.65,
        2.65,
        az - _vec3A.z * 3.4 + sideZ * 1.65,
      );
      const lookTarget = new THREE.Vector3(
        (ax + tx) * 0.5,
        1.05,
        (az + tz) * 0.5,
      );

      activeActionCam = {
        camPos,
        lookTarget,
        savedPos: activeActionCam ? activeActionCam.savedPos : camera.position.clone(),
        savedTarget: activeActionCam
          ? activeActionCam.savedTarget
          : controls.target.clone(),
        timeLeft: shot.holdSec,
        returning: false,
        returnTimer: 0,
      };
    },

    setLightingMood(mood: LightingMood) {
      currentLightingMood = mood;
      if (mood === "storm") {
        lightningFlash = prefersReducedMotion ? 0.45 : 1.0;
        lightningPulseTimer = 0.36;
        lightningAzimuth = (Math.random() - 0.5) * 14;
        onThunder?.();
      }
    },

    triggerLightning(intensity = 1.0) {
      lightningFlash = prefersReducedMotion ? Math.min(0.45, intensity * 0.5) : intensity;
      lightningPulseTimer = 0.38;
      lightningAzimuth = (Math.random() - 0.5) * 16;
      onThunder?.();
    },

    updateAndRender(dt, view, coverTile, selectedCover, aimArc, unitMeta) {
      // Animate Vltava River caustics & current flow
      procTex.water.offset.set(
        Math.sin(view.time * 0.22) * 0.08,
        (view.time * 0.04) % 1,
      );
      rebuildMapGeometry(view.tiles);

      // 1. Resolve Active Atmospheric Mood (Phase-Driven Auto or Manual HUD Override)
      const resolvedMoodKey: Exclude<LightingMood, "auto"> =
        currentLightingMood !== "auto"
          ? currentLightingMood
          : view.phase === "dock" || view.phase === "victory"
            ? "mist"
            : view.phase === "hold" || view.phase === "defeat"
              ? "siege"
              : "chiaroscuro";
      const targetPal = MOOD_PALETTES[resolvedMoodKey];

      // 2. Storm Lightning State Machine (Periodic in Storm/Hold + Double-Pulse Envelope)
      const stormActive =
        currentLightingMood === "storm" ||
        (currentLightingMood === "auto" && view.phase === "hold");
      if (stormActive) {
        nextLightningCooldown -= dt;
        if (nextLightningCooldown <= 0) {
          nextLightningCooldown =
            currentLightingMood === "storm"
              ? 5.5 + Math.random() * 6.5
              : 8.0 + Math.random() * 8.0;
          lightningFlash = prefersReducedMotion ? 0.4 : 0.95;
          lightningPulseTimer = 0.36;
          lightningAzimuth = (Math.random() - 0.5) * 16;
          onThunder?.();
        }
      }

      if (lightningPulseTimer > 0) {
        lightningPulseTimer = Math.max(0, lightningPulseTimer - dt);
        const doublePulse = prefersReducedMotion
          ? lightningPulseTimer / 0.36
          : Math.sin((1 - lightningPulseTimer / 0.36) * Math.PI * 2.5);
        lightningFlash = Math.max(0, Math.abs(doublePulse) * (lightningPulseTimer / 0.36));
      } else {
        lightningFlash = THREE.MathUtils.damp(lightningFlash, 0, 8, dt);
      }

      // Dynamic water & rain puddle reflections during lightning flash
      mats.puddle.emissiveIntensity = 0.25 + lightningFlash * 0.95;
      mats.water.emissiveIntensity = 0.3 + lightningFlash * 0.7;

      // Show sky lightning bolt during peak strike
      if (lightningFlash > 0.25 && !prefersReducedMotion) {
        lightningBoltGroup.position.x = lightningAzimuth;
        lightningBoltMat.opacity = Math.min(0.95, lightningFlash * 1.15);
      } else {
        lightningBoltMat.opacity = 0;
      }

      // 3. Smoothly Interpolate Scene Fog, Sky, Moon, Rim, Mist & Exposure
      const dampRate = 2.8;
      _colorA.setHex(targetPal.fogColor);
      if (lightningFlash > 0.01) {
        _colorB.setHex(0x8ab4e8);
        _colorA.lerp(_colorB, lightningFlash * 0.45);
      }
      fogColor.lerp(_colorA, 1 - Math.exp(-dampRate * dt));
      sceneFog.color.copy(fogColor);
      sceneFog.density = THREE.MathUtils.damp(
        sceneFog.density,
        targetPal.fogDensity,
        dampRate,
        dt,
      );

      _colorA.setHex(targetPal.hemiSky);
      hemiLight.color.lerp(_colorA, 1 - Math.exp(-dampRate * dt));
      _colorB.setHex(targetPal.hemiGround);
      hemiLight.groundColor.lerp(_colorB, 1 - Math.exp(-dampRate * dt));
      hemiLight.intensity =
        THREE.MathUtils.damp(hemiLight.intensity, targetPal.hemiIntensity, dampRate, dt) +
        lightningFlash * 1.4;

      _colorA.setHex(targetPal.moonColor);
      if (lightningFlash > 0.01) {
        _colorB.setHex(0xeaf4ff);
        _colorA.lerp(_colorB, lightningFlash * 0.7);
      }
      moonKeyLight.color.lerp(_colorA, 1 - Math.exp(-dampRate * dt));
      moonKeyLight.intensity =
        THREE.MathUtils.damp(moonKeyLight.intensity, targetPal.moonIntensity, dampRate, dt) +
        lightningFlash * 4.2;

      moonKeyLight.position.x = THREE.MathUtils.damp(
        moonKeyLight.position.x,
        targetPal.moonPos[0] + lightningFlash * lightningAzimuth * 0.4,
        dampRate,
        dt,
      );
      moonKeyLight.position.y = THREE.MathUtils.damp(
        moonKeyLight.position.y,
        targetPal.moonPos[1],
        dampRate,
        dt,
      );
      moonKeyLight.position.z = THREE.MathUtils.damp(
        moonKeyLight.position.z,
        targetPal.moonPos[2],
        dampRate,
        dt,
      );

      _colorA.setHex(targetPal.rimColor);
      palaceWarmRim.color.lerp(_colorA, 1 - Math.exp(-dampRate * dt));
      palaceWarmRim.intensity = THREE.MathUtils.damp(
        palaceWarmRim.intensity,
        targetPal.rimIntensity,
        dampRate,
        dt,
      );

      _colorA.setHex(targetPal.riverColor);
      riverTealBacklight.color.lerp(_colorA, 1 - Math.exp(-dampRate * dt));
      riverTealBacklight.intensity = THREE.MathUtils.damp(
        riverTealBacklight.intensity,
        targetPal.riverIntensity,
        dampRate,
        dt,
      );

      renderer.toneMappingExposure =
        THREE.MathUtils.damp(renderer.toneMappingExposure, targetPal.exposure, dampRate, dt) +
        lightningFlash * 0.22;

      currentGodRayScale = THREE.MathUtils.damp(
        currentGodRayScale,
        targetPal.godRayScale,
        dampRate,
        dt,
      );
      godRayRefs.forEach((gr, idx) => {
        const pulse = 0.92 + Math.sin(view.time * 1.4 + idx * 1.1) * 0.1;
        gr.mat.opacity = gr.baseOpacity * currentGodRayScale * pulse;
      });

      _colorA.setHex(targetPal.mistColor);
      mistSharedMat.color.lerp(_colorA, 1 - Math.exp(-dampRate * dt));
      mistSharedMat.opacity = THREE.MathUtils.damp(
        mistSharedMat.opacity,
        targetPal.mistOpacity,
        dampRate,
        dt,
      );

      currentRainOpacity = THREE.MathUtils.damp(
        currentRainOpacity,
        targetPal.rainOpacity,
        dampRate,
        dt,
      );
      rainMat.opacity = currentRainOpacity;

      // 4. Organic Multi-Harmonic Torch Flicker & Baroque Cloth Banners
      const t = view.time;
      const tb = targetPal.torchBoost;
      const swayScale = prefersReducedMotion ? 0.015 : 0.085;

      const fNorth =
        Math.sin(t * 5.7) * 0.45 + Math.sin(t * 12.9) * 0.32 + Math.cos(t * 21.4) * 0.23;
      const fSouth =
        Math.cos(t * 5.2 + 1.1) * 0.45 +
        Math.sin(t * 11.8 + 2.0) * 0.32 +
        Math.cos(t * 19.7) * 0.23;
      const fStreet =
        Math.sin(t * 4.8 + 2.4) * 0.45 +
        Math.cos(t * 10.6 + 0.7) * 0.35 +
        Math.sin(t * 17.2) * 0.2;
      const fQuay =
        Math.sin(t * 5.5 + 3.5) * 0.45 +
        Math.cos(t * 13.4 + 1.4) * 0.32 +
        Math.sin(t * 22.1) * 0.23;

      palaceTorchLightNorth.intensity = (9.4 + fNorth * 1.85) * tb;
      palaceTorchLightNorth.position.set(
        northTorchBase.x + Math.sin(t * 4.3) * swayScale,
        northTorchBase.y + fNorth * 0.045,
        northTorchBase.z + Math.cos(t * 3.7) * swayScale,
      );
      _colorA.setHex(0xff8c28);
      _colorB.setHex(0xffcf68);
      palaceTorchLightNorth.color.copy(_colorA).lerp(_colorB, 0.5 + fNorth * 0.4);

      palaceTorchLightSouth.intensity = (9.4 + fSouth * 1.85) * tb;
      palaceTorchLightSouth.position.set(
        southTorchBase.x + Math.cos(t * 4.1) * swayScale,
        southTorchBase.y + fSouth * 0.045,
        southTorchBase.z + Math.sin(t * 3.9) * swayScale,
      );
      palaceTorchLightSouth.color.copy(_colorA).lerp(_colorB, 0.5 + fSouth * 0.4);

      streetCenterLight.intensity = (7.4 + fStreet * 1.45) * tb;
      streetCenterLight.color.setHex(0xffaa44);
      streetCenterLight.position.set(
        streetTorchBase.x + Math.sin(t * 3.5) * swayScale,
        streetTorchBase.y + fStreet * 0.04,
        streetTorchBase.z + Math.cos(t * 4.2) * swayScale,
      );

      quayBrazierLight.intensity = (8.5 + fQuay * 1.65) * tb;
      quayBrazierLight.position.set(
        quayTorchBase.x + Math.cos(t * 4.6) * swayScale,
        quayTorchBase.y + fQuay * 0.04,
        quayTorchBase.z + Math.sin(t * 3.8) * swayScale,
      );

      boatLanternLight.intensity = (9.6 + Math.cos(t * 4.3) * 1.1) * tb;

      torchFlameMeshes.forEach((flame, idx) => {
        const s = 0.94 + Math.sin(t * 11 + idx * 2.1) * 0.16;
        flame.scale.set(s, 0.92 + Math.cos(t * 9 + idx) * 0.22, s);
        flame.rotation.z = Math.sin(t * 7.5 + idx * 1.7) * 0.12;
      });

      palaceBannerMeshes.forEach((banner, idx) => {
        banner.rotation.z = Math.sin(t * 2.6 + idx * 1.3) * (prefersReducedMotion ? 0.008 : 0.045);
        banner.rotation.y = Math.cos(t * 1.9 + idx) * (prefersReducedMotion ? 0.01 : 0.06);
      });

      // Animate Drifting Low-Lying Street Mist Planes
      for (let i = 0; i < mistPlanes.length; i++) {
        const m = mistPlanes[i]!;
        const driftX = Math.sin(t * 0.22 * m.speed + m.seed) * 1.35;
        const driftZ = Math.cos(t * 0.18 * m.speed + m.seed) * 0.95;
        m.mesh.position.set(
          m.baseX + driftX,
          m.baseY + Math.sin(t * 0.9 + m.seed) * 0.035,
          m.baseZ + driftZ,
        );
      }

      // Animate 3D Falling Rain Streaks
      const posAttr = rainGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const drop = rainDrops[i]!;
        drop.y -= drop.speed * dt;
        drop.x -= 1.1 * dt;
        if (drop.y < -0.2) {
          drop.y = 13.5;
          drop.x = (hash01(i, Math.floor(view.time * 10), 7) - 0.5) * 34;
        }
        const i6 = i * 6;
        rainPositions[i6] = drop.x;
        rainPositions[i6 + 1] = drop.y;
        rainPositions[i6 + 2] = drop.z;
        rainPositions[i6 + 3] = drop.x + 0.05;
        rainPositions[i6 + 4] = drop.y + 0.62;
        rainPositions[i6 + 5] = drop.z;
      }
      posAttr.needsUpdate = true;

      // Animate Rising Golden Baroque Embers
      for (let i = 0; i < EMBER_COUNT; i++) {
        const em = emberData[i]!;
        em.y += em.vy * dt;
        if (em.y > 7.5) {
          em.y = 0.15;
        }
        const swayX = Math.sin(view.time * 1.8 + em.phase) * 0.35;
        const swayZ = Math.cos(view.time * 1.5 + em.phase) * 0.35;
        _emberDummy.position.set(em.x + swayX, em.y, em.z + swayZ);
        const pulse = 0.7 + Math.sin(view.time * 6 + em.phase) * 0.35;
        _emberDummy.scale.setScalar(pulse);
        _emberDummy.updateMatrix();
        emberInstanced.setMatrixAt(i, _emberDummy.matrix);
      }
      emberInstanced.instanceMatrix.needsUpdate = true;

      // Update Escape Rowboat Position & Bobbing
      let boatSpot: { x: number; y: number } | null = null;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (view.tiles[y]?.[x] === "boat") {
            boatSpot = { x, y };
            break;
          }
        }
      }
      if (boatSpot && view.phase !== "victory") {
        boatGroup.visible = true;
        const driftX = view.phase === "hold" ? 1.35 : 0;
        const bx = tileToWorldX(boatSpot.x) + driftX;
        const bz = tileToWorldZ(boatSpot.y);
        boatGroup.position.set(
          bx,
          -0.23 + Math.sin(view.time * 2.2) * 0.045,
          bz,
        );
        boatGroup.rotation.z = Math.sin(view.time * 1.7) * 0.045;
        boatLanternLight.position.set(bx, 1.45, bz - 0.7);
      } else {
        boatGroup.visible = false;
      }

      // Update 3D Tile Marks & Path Ribbon
      for (const m of markPool) m.group.visible = false;
      const pathPoints: THREE.Vector3[] = [];

      view.marks.forEach((mark, i) => {
        const item = getMarkMesh(i);
        const kindAt = at(view.tiles, mark.x, mark.y);
        const h = groundHeightAt(kindAt);
        const wx = tileToWorldX(mark.x);
        const wz = tileToWorldZ(mark.y);
        item.group.position.set(wx, h + 0.025, wz);

        const style = markColors[mark.kind];
        item.fillMat.color.setHex(style.fill);
        item.fillMat.opacity = style.fillAlpha;
        item.rimMat.color.setHex(style.rim);
        item.rimMat.opacity = mark.kind === "hover" ? 0.98 : 0.85;

        if (mark.kind === "move") {
          item.fill.scale.set(0.96, 0.96, 1);
          item.rim.scale.set(1.0, 1.0, 1);
        } else if (mark.kind === "far") {
          item.fill.scale.set(0.88, 0.88, 1);
          item.rim.scale.set(0.94, 0.94, 1);
        } else {
          item.fill.scale.set(0.94, 0.94, 1);
          item.rim.scale.set(1.0, 1.0, 1);
        }

        if (mark.kind === "path") {
          pathPoints.push(new THREE.Vector3(wx, h + 0.09, wz));
        }
      });

      if (pathPoints.length >= 2) {
        pathLineGeo.setFromPoints(pathPoints);
        pathLine.visible = true;
        const lastPt = pathPoints[pathPoints.length - 1]!;
        const destMark = view.marks.find(
          (m) =>
            Math.abs(tileToWorldX(m.x) - lastPt.x) < 0.25 &&
            Math.abs(tileToWorldZ(m.y) - lastPt.z) < 0.25 &&
            (m.kind === "move" || m.kind === "far"),
        );
        if (destMark?.kind === "far") {
          pathLineMat.color.setHex(0xffcb52); // Gold glow for 2. akce (chvat)
        } else {
          pathLineMat.color.setHex(0x64b8ff); // Azure glow for 1. akce (pohyb)
        }
      } else {
        pathLine.visible = false;
      }

      // Update 3D Directional Cover Shields (Hovered tile + Selected unit tile)
      for (const s of shieldPool) s.visible = false;
      let shieldIdx = 0;
      const renderCoverSet = (entry: { x: number; y: number; dirs: CoverDir[] } | null) => {
        if (!entry) return;
        const h = groundHeightAt(at(view.tiles, entry.x, entry.y));
        const wx = tileToWorldX(entry.x);
        const wz = tileToWorldZ(entry.y);
        for (const dir of entry.dirs) {
          const mesh = getShieldMesh(shieldIdx++, dir.amount === COVER_FULL);
          mesh.position.set(
            wx + dir.dx * (TILE_3D * 0.42),
            h + 0.56 + Math.sin(view.time * 3.2) * 0.035,
            wz + dir.dy * (TILE_3D * 0.42),
          );
          mesh.rotation.y = Math.atan2(dir.dx, dir.dy);
        }
      };
      renderCoverSet(coverTile);
      if (
        selectedCover &&
        (!coverTile ||
          coverTile.x !== selectedCover.x ||
          coverTile.y !== selectedCover.y)
      ) {
        renderCoverSet(selectedCover);
      }

      // Update 3D Aiming Sightline / Parabolic Grenade Trajectory Arc
      if (aimTubeMesh) {
        marksGroup.remove(aimTubeMesh);
        aimTubeMesh.geometry.dispose();
        aimTubeMesh = null;
      }
      blastRingMesh.visible = false;
      targetLockMesh.visible = false;

      if (aimArc) {
        const x0 = tileToWorldX(aimArc.x0);
        const z0 = tileToWorldZ(aimArc.y0);
        const y0 = groundHeightAt(at(view.tiles, aimArc.x0, aimArc.y0)) + 1.18;

        const x1 = tileToWorldX(aimArc.x1);
        const z1 = tileToWorldZ(aimArc.y1);
        const groundY1 = groundHeightAt(at(view.tiles, aimArc.x1, aimArc.y1));
        const y1 = groundY1 + (aimArc.delivery === "shot" ? 1.08 : 0.12);

        const peakH =
          aimArc.delivery === "throw"
            ? Math.max(y0, y1) + 2.65
            : (y0 + y1) * 0.5 + 0.18;
        const mid = new THREE.Vector3((x0 + x1) * 0.5, peakH, (z0 + z1) * 0.5);
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(x0, y0, z0),
          mid,
          new THREE.Vector3(x1, y1, z1),
        );
        const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.044, 8, false);
        const arcColor = !aimArc.valid
          ? 0x9c8e80
          : aimArc.delivery === "shot"
            ? 0xff5a68
            : 0xffae42;
        aimCurveMat.color.setHex(arcColor);
        aimTubeMesh = new THREE.Mesh(tubeGeo, aimCurveMat);
        marksGroup.add(aimTubeMesh);

        targetLockMesh.visible = true;
        targetLockMat.color.setHex(arcColor);
        targetLockMesh.position.set(x1, groundY1 + 0.06, z1);
        targetLockMesh.rotation.z = view.time * 1.8;

        if (aimArc.blastRadius > 0) {
          blastRingMesh.visible = true;
          blastRingMesh.position.set(x1, groundY1 + 0.06, z1);
        }
      }

      // Update Blood Decals
      decalPool.forEach((d) => (d.visible = false));
      view.decals.forEach((dec, idx) => {
        let mesh = decalPool[idx];
        if (!mesh) {
          mesh = new THREE.Mesh(decalGeo, mats.decalBlood);
          boardGroup.add(mesh);
          decalPool.push(mesh);
        }
        mesh.visible = true;
        const h = groundHeightAt(at(view.tiles, dec.x, dec.y));
        mesh.position.set(tileToWorldX(dec.x), h + 0.015, tileToWorldZ(dec.y));
      });

      // Update 3D Volumetric Smoke Plumes
      smokePool.forEach((s) => (s.visible = false));
      view.smokes.forEach((sm, idx) => {
        let g = smokePool[idx];
        if (!g) {
          g = new THREE.Group();
          for (let p = 0; p < 5; p++) {
            const puff = new THREE.Mesh(smokeSpheresGeo, mats.smokePuff);
            g.add(puff);
          }
          propsGroup.add(g);
          smokePool.push(g);
        }
        g.visible = true;
        const h = groundHeightAt(at(view.tiles, sm.x, sm.y));
        g.position.set(tileToWorldX(sm.x), h, tileToWorldZ(sm.y));
        g.children.forEach((child, p) => {
          const angle = view.time * 0.65 + p * 1.25 + sm.x;
          child.position.set(
            Math.cos(angle) * 0.36,
            0.48 + p * 0.16 + Math.sin(view.time * 1.4 + p) * 0.08,
            Math.sin(angle) * 0.36,
          );
          const sc = 0.85 + p * 0.18;
          child.scale.set(sc, sc * 0.8, sc);
        });
      });

      // Update Camera Rig before Billboard orientation & Screen Projection
      updateCameraRig(dt, view.shake, view.time);

      // Update HD-2D Character Rigs & Project Floating HUD Plates
      const activeIds = new Set<string>();
      const projectedPlates: ProjectedUnitPlate[] = [];
      const canvasW = renderer.domElement.clientWidth || window.innerWidth;
      const canvasH = renderer.domElement.clientHeight || window.innerHeight;

      for (const u of view.units) {
        activeIds.add(u.id);
        const rig = getOrCreateUnitRig(u);
        rig.group.visible = true;

        const tileX = Math.round(u.px);
        const tileY = Math.round(u.py);
        const h = groundHeightAt(at(view.tiles, tileX, tileY));
        const wx = tileToWorldX(u.px) + u.facing * u.lunge * 0.32;
        const wz = tileToWorldZ(u.py);

        rig.group.position.set(wx, h, wz);

        rig.facingChevron.visible = u.alive;
        rig.facingChevron.position.x = u.facing * 0.64;
        rig.facingChevron.rotation.z = u.facing === 1 ? -Math.PI / 2 : Math.PI / 2;

        rig.selectRing.visible = u.selected && u.alive;
        rig.selectBeam.visible = u.selected && u.alive;
        if (rig.selectRing.visible) {
          rig.selectRing.rotation.z = view.time * 1.4;
        }
        rig.overwatchRing.visible = u.overwatch && u.alive;
        rig.blessingRing.visible = u.blessing && u.alive;

        if (rig.vipCrown) {
          rig.vipCrown.visible = u.alive;
          rig.vipCrown.rotation.y = view.time * 1.8;
          rig.vipCrown.position.y = 2.22 + Math.sin(view.time * 3.0) * 0.05;
        }

        // Cylindrical Y-axis billboarding toward camera
        _vec3B.subVectors(camera.position, rig.group.position);
        const yaw = Math.atan2(_vec3B.x, _vec3B.z);
        rig.spritePivot.rotation.set(0, yaw, 0);

        // Normal-safe facing swap using UV-flipped geometry
        const targetGeo = u.facing === -1 ? rig.spriteGeoLeft : rig.spriteGeoRight;
        if (rig.spriteMesh.geometry !== targetGeo) {
          rig.spriteMesh.geometry = targetGeo;
        }

        const palScale = LOOK[u.archetype].scale;
        if (u.alive) {
          const bobY = Math.sin(view.time * 2.1 + u.bob) * 0.032;
          rig.spriteMesh.position.y = bobY;
          rig.spriteMesh.rotation.z = 0;
          rig.spriteMesh.scale.set(palScale, palScale, 1);
          rig.spriteMat.opacity = 1;
        } else {
          rig.spriteMesh.position.y = -0.04;
          rig.spriteMesh.rotation.z = -1.25;
          rig.spriteMesh.scale.set(palScale, palScale, 1);
          rig.spriteMat.opacity = 0.72;
        }

        if (u.flash > 0 && u.alive) {
          rig.spriteMat.emissive.setHex(0xff4228);
          rig.spriteMat.emissiveIntensity = 0.45 + u.flash * 1.6;
        } else {
          rig.spriteMat.emissive.setHex(0xffffff);
          rig.spriteMat.emissiveIntensity = u.selected ? 0.58 : 0.44;
        }

        if (u.alive) {
          _projVec.set(wx, h + SPRITE_WORLD_H[u.archetype] + 0.38, wz);
          _projVec.project(camera);
          const screenX = ((_projVec.x + 1) * 0.5) * canvasW;
          const screenY = ((-_projVec.y + 1) * 0.5) * canvasH;
          const meta = unitMeta.get(u.id);
          projectedPlates.push({
            id: u.id,
            name: meta?.name ?? u.id,
            faction: u.faction,
            hp: u.hp,
            maxHp: u.maxHp,
            ap: u.ap,
            maxAp: meta?.maxAp ?? 2,
            armor: meta?.armor ?? 0,
            vip: u.vip,
            overwatch: u.overwatch,
            blessing: u.blessing,
            loaded: meta?.loaded ?? null,
            selected: u.selected,
            screenX,
            screenY,
            visible: _projVec.z < 1 && screenX >= -60 && screenX <= canvasW + 60,
            hitChance: meta?.hitChance ?? null,
            cover: meta?.cover ?? null,
          });
        }
      }

      for (const [id, rig] of unitRigs.entries()) {
        if (!activeIds.has(id)) rig.group.visible = false;
      }

      // Render 3D transient FX (with proper geometry/material disposal) & project floating combat text
      while (fxGroup.children.length > 0) {
        const child = fxGroup.children[0] as THREE.Mesh;
        fxGroup.remove(child);
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      sparkPool.forEach((s) => (s.mesh.visible = false));
      let sparkIdx = 0;
      const projectedFloats: ProjectedFloatingText[] = [];

      view.fx.forEach((item: Fx, idx: number) => {
        const k = Math.min(1, item.t / item.life);
        const alpha = 1 - k;

        if (item.kind === "text") {
          const wx = tileToWorldX(item.x);
          const wz = tileToWorldZ(item.y);
          const wy =
            groundHeightAt(at(view.tiles, Math.round(item.x), Math.round(item.y))) +
            1.88 +
            k * 0.85;
          _projVec.set(wx, wy, wz);
          _projVec.project(camera);
          if (_projVec.z < 1) {
            projectedFloats.push({
              id: `fx-${idx}-${item.text}`,
              text: item.text,
              color: item.color,
              screenX: ((_projVec.x + 1) * 0.5) * canvasW,
              screenY: ((-_projVec.y + 1) * 0.5) * canvasH,
              alpha,
            });
          }
        } else if (item.kind === "line") {
          const p0 = new THREE.Vector3(
            tileToWorldX(item.x0),
            1.15,
            tileToWorldZ(item.y0),
          );
          const p1 = new THREE.Vector3(
            tileToWorldX(item.x1),
            1.15,
            tileToWorldZ(item.y1),
          );
          const curve = new THREE.LineCurve3(p0, p1);
          const tracerGeo = new THREE.TubeGeometry(curve, 4, 0.05, 6, false);
          const tracerMat = new THREE.MeshBasicMaterial({
            color: 0xfff5cc,
            transparent: true,
            opacity: alpha,
          });
          fxGroup.add(new THREE.Mesh(tracerGeo, tracerMat));

          // Muzzle flash burst sphere at shooter
          const flashGeo = new THREE.SphereGeometry(0.32 * (1 - k * 0.45), 10, 10);
          const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffd878,
            transparent: true,
            opacity: alpha,
          });
          const flashMesh = new THREE.Mesh(flashGeo, flashMat);
          flashMesh.position.copy(p0);
          fxGroup.add(flashMesh);

          // Temporarily boost street light for muzzle flash illumination
          streetCenterLight.position.set(p0.x, p0.y + 0.4, p0.z);
          streetCenterLight.color.setHex(0xffd070);
          streetCenterLight.intensity = Math.max(streetCenterLight.intensity, alpha * 22.0);
        } else if (item.kind === "ring" || item.kind === "slash") {
          const r = item.kind === "ring" ? 0.3 + k * 1.65 : 0.25 + k * 0.8;
          const ringGeo = new THREE.RingGeometry(r, r + 0.18, 28);
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: item.kind === "ring" ? item.color : "#ffe8b8",
            transparent: true,
            opacity: alpha,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          const wx = tileToWorldX(item.x);
          const wz = tileToWorldZ(item.y);
          ringMesh.position.set(wx, 0.35, wz);
          fxGroup.add(ringMesh);

          if (item.kind === "ring") {
            streetCenterLight.position.set(wx, 1.55, wz);
            streetCenterLight.color.set(item.color);
            streetCenterLight.intensity = Math.max(streetCenterLight.intensity, alpha * 28.0);
          }
        } else if (item.kind === "spark") {
          let sp = sparkPool[sparkIdx++];
          if (!sp) {
            const mat = new THREE.MeshBasicMaterial({ transparent: true });
            const mesh = new THREE.Mesh(sparkGeo, mat);
            scene.add(mesh);
            sp = { mesh, mat };
            sparkPool.push(sp);
          }
          sp.mesh.visible = true;
          sp.mat.color.set(item.color);
          sp.mat.opacity = alpha;
          sp.mesh.position.set(
            tileToWorldX(item.x - 0.5),
            0.95 - item.vy * 0.4,
            tileToWorldZ(item.y - 0.5),
          );
        }
      });

      onOverlayProject(projectedPlates, projectedFloats);
      renderer.render(scene, camera);
    },

    dispose() {
      window.clearTimeout(syncTimer);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown, true);
      renderer.domElement.removeEventListener("pointerup", onPointerUp, true);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      controls.dispose();
      godRayTex.dispose();
      softMistTex.dispose();
      envTex.dispose();
      renderer.dispose();
    },
  };
}
