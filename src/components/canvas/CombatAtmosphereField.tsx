/**
 * Sjednocené částicové pole šerosvitu (Unified Chiaroscuro Combat Atmosphere Field, ADR-0011).
 * Konsoliduje veškeré atmosférické částice bojiště do jediného instancovaného systému:
 * 1. Černoprachový dým (Black-Powder Smoke): měkké překrývající se obláčky s procedurální
 *    Gaussian texturou, které se organicky slévají do souvislých valů bez polygonových švů.
 * 2. Omítkový prach a třísky (Masonry Plaster Dust): jemný pískovcový prach (#d6d3d1),
 *    který se uvolňuje při střelbě a usedá k zemi.
 * 3. Žhavé jiskry a popílek (Blast Embers): stoupající částice z detonací a hořících doutnáků.
 * 4. Chiaroscuro vnitřní rozptyl (Dynamic Light Flash Scattering): aktivní záblesky z fondu
 *    světel (Dynamic Light Flash Pool) vnitřně prosvěcují okolní dým teplou jantarovou září (#f97316).
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { isEnclosedRoofedCoord } from "../../core/GridSystem";
import type { GridCoord } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { gridToWorld } from "./worldCoords";

const MAX_SMOKE_INSTANCES = 380;
const MAX_DEBRIS_INSTANCES = 160;

/**
 * Vytvoří měkkou procedurální Gaussian texturu obláčku dýmu/prachu na 2D canvasu.
 * Zajišťuje plynulé prolnutí částic s terénem bez ostrých polygonových hran.
 */
function createSoftPuffTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") {
    return new THREE.Texture() as THREE.CanvasTexture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(0.28, "rgba(255, 255, 255, 0.82)");
  grad.addColorStop(0.58, "rgba(255, 255, 255, 0.45)");
  grad.addColorStop(0.85, "rgba(255, 255, 255, 0.14)");
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

interface SmokePuffData {
  coord: GridCoord;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  baseRot: number;
  rotSpeed: number;
  phase: number;
  baseColor: THREE.Color;
  isGhosted: boolean;
}

interface DebrisParticleData {
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  color: THREE.Color;
  isEmber: boolean;
  phase: number;
}

export function CombatAtmosphereField() {
  const grid = useGameStore((s) => s.grid);
  const smokeVersion = useGameStore((s) => s.smokeVersion);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const lightFlashes = useGameStore((s) => s.lightFlashes);
  const blastZones = useGameStore((s) => s.blastZones);
  const combatIntensity = useGameStore((s) => s.combatIntensity);

  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const softPuffTexture = useMemo(() => createSoftPuffTexture(), []);

  // 1. Přepočet instancí černoprachového dýmu při změně mřížky / kouře
  const smokePuffs = useMemo(() => {
    void smokeVersion;
    const tilesWithSmoke = grid
      .getAllTiles()
      .filter((t) => t.hasFloor && t.smokeTurns > 0);

    const puffs: SmokePuffData[] = [];
    const offsets = [
      { dx: -0.22, dy: 0.25, dz: 0.16, s: 1.15, c: "#1e293b" },
      { dx: 0.24, dy: 0.42, dz: -0.18, s: 1.05, c: "#334155" },
      { dx: -0.08, dy: 0.62, dz: 0.22, s: 0.92, c: "#475569" },
      { dx: 0.16, dy: 0.78, dz: 0.08, s: 0.82, c: "#64748b" },
    ];

    for (const tile of tilesWithSmoke) {
      if (puffs.length >= MAX_SMOKE_INSTANCES - 4) break;
      const isGhosted = tile.coord.y > activeFloor;

      for (let i = 0; i < offsets.length; i++) {
        const off = offsets[i]!;
        const seed = (tile.coord.x * 7 + tile.coord.z * 13 + i * 17) % 100;
        puffs.push({
          coord: tile.coord,
          offsetX: off.dx + ((seed % 7) - 3) * 0.04,
          offsetY: off.dy,
          offsetZ: off.dz + ((seed % 5) - 2) * 0.04,
          scaleX: off.s * (0.85 + (seed % 3) * 0.12),
          scaleY: off.s * 0.58,
          scaleZ: off.s * (0.85 + (seed % 4) * 0.1),
          baseRot: (seed / 100) * Math.PI * 2,
          rotSpeed: (0.15 + (seed % 5) * 0.08) * (i % 2 === 0 ? 1 : -1),
          phase: (seed / 100) * Math.PI * 2,
          baseColor: new THREE.Color(off.c),
          isGhosted,
        });
      }
    }
    return puffs;
  }, [grid, smokeVersion, activeFloor]);

  // 2. Částice omítkového prachu a jisker
  const debrisParticles = useMemo(() => {
    const list: DebrisParticleData[] = [];
    const count = Math.min(
      MAX_DEBRIS_INSTANCES,
      Math.max(24, (blastZones.length + combatIntensity) * 14),
    );

    for (let i = 0; i < count; i++) {
      const isEmber = i % 3 === 0;
      const seed = i * 1.618;
      // Vybereme zónu exploze nebo výchozí bod boje
      const zone = blastZones[i % Math.max(1, blastZones.length)];
      const anchorCoord: GridCoord = zone ? zone.coord : { x: 10, y: 0, z: 12 };
      const [ax, ay, az] = gridToWorld(anchorCoord);

      const angle = ((i * 13) % 360) * (Math.PI / 180);
      const rad = 0.5 + ((i * 7) % 24) * 0.18;
      const wx = ax + Math.cos(angle) * rad;
      const wz = az + Math.sin(angle) * rad;
      const wy = ay + (isEmber ? 0.3 + Math.random() * 2.2 : 0.15 + Math.random() * 1.4);

      list.push({
        wx,
        wy,
        wz,
        vx: (Math.random() - 0.5) * (isEmber ? 0.4 : 0.25),
        vy: isEmber ? 0.35 + Math.random() * 0.6 : -0.15 - Math.random() * 0.25,
        vz: (Math.random() - 0.5) * (isEmber ? 0.4 : 0.25),
        scale: isEmber ? 0.05 + Math.random() * 0.05 : 0.09 + Math.random() * 0.08,
        color: isEmber
          ? new THREE.Color(i % 2 === 0 ? "#f97316" : "#ea580c")
          : new THREE.Color("#d6d3d1"),
        isEmber,
        phase: seed % (Math.PI * 2),
      });
    }
    return list;
  }, [blastZones, combatIntensity]);

  // Synchronizace počtu aktivních instancí
  useEffect(() => {
    if (smokeMeshRef.current) {
      smokeMeshRef.current.count = smokePuffs.length;
    }
  }, [smokePuffs.length]);

  useEffect(() => {
    if (debrisMeshRef.current) {
      debrisMeshRef.current.count = debrisParticles.length;
    }
  }, [debrisParticles.length]);

  // Animační smyčka: rotace dýmu, vznášení jisker a Chiaroscuro vnitřní rozptyl
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const now = performance.now();

    // Vyhledání aktivních explozivních záblesků pro vnitřní prosvícení
    const activeBlasts = lightFlashes.filter(
      (f) => f.kind === "blast" && now - f.createdAt < f.durationMs,
    );

    // 1. Update Black-Powder Smoke billows (True Camera-Facing Billboards)
    if (smokeMeshRef.current && smokePuffs.length > 0) {
      const mesh = smokeMeshRef.current;

      for (let i = 0; i < smokePuffs.length; i++) {
        const p = smokePuffs[i]!;
        const [wx, wy, wz] = gridToWorld(p.coord);

        // Pomalé víření dýmu
        const driftX = Math.sin(t * 0.65 + p.phase) * 0.12;
        const driftZ = Math.cos(t * 0.55 + p.phase) * 0.12;
        const driftY = Math.sin(t * 0.45 + p.phase) * 0.06;

        dummy.position.set(
          wx + p.offsetX + driftX,
          wy + p.offsetY + driftY,
          wz + p.offsetZ + driftZ,
        );

        // Sférický billboard: čelem ke kameře s rotací kolem osy zraku (ADR-0011)
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(p.baseRot + t * p.rotSpeed);

        // Dynamická expanze obláčku a potlačení kouře na vyšších patrech při cutaway (ghosting)
        const pulse = 1.0 + Math.sin(t * 0.8 + p.phase) * 0.08;
        const ghostScale = p.isGhosted ? 0.35 : 1.0;
        dummy.scale.set(
          p.scaleX * pulse * ghostScale,
          p.scaleY * pulse * ghostScale,
          p.scaleZ * pulse * ghostScale,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Chiaroscuro Dynamic Scattering (ADR-0011):
        // Pokud je v blízkosti aktivní výbuch, dým se zevnitř rozzáří teplou jantarovou barvou
        tempColor.copy(p.baseColor);
        if (p.isGhosted) {
          tempColor.multiplyScalar(0.35);
        }

        for (const blast of activeBlasts) {
          const [bx, by, bz] = gridToWorld(blast.coord);
          const dx = dummy.position.x - bx;
          const dy = dummy.position.y - by;
          const dz = dummy.position.z - bz;
          const distSq = dx * dx + dy * dy + dz * dz;
          const blastRad = blast.radius;

          if (distSq < blastRad * blastRad) {
            const age = now - blast.createdAt;
            const progress = Math.min(1, Math.max(0, age / blast.durationMs));
            const decay = Math.pow(1 - progress, 2);
            const dist = Math.sqrt(distSq);
            const falloff = Math.max(0, 1 - dist / blastRad);
            const scatterIntensity = decay * falloff * 0.95;

            // Přechod ze šedého dýmu do žhnoucího jantaru (#f97316 a #fbbf24)
            tempColor.lerp(new THREE.Color("#fb923c"), scatterIntensity);
          }
        }

        mesh.setColorAt(i, tempColor);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // 2. Update Plaster Dust & Embers
    if (debrisMeshRef.current && debrisParticles.length > 0) {
      const dMesh = debrisMeshRef.current;

      for (let i = 0; i < debrisParticles.length; i++) {
        const dp = debrisParticles[i]!;

        if (dp.isEmber) {
          // Jiskry pomalu stoupají s vířivým pohybem
          const curY = dp.wy + ((t * 0.8 + dp.phase) % 3.0);
          const curX = dp.wx + Math.sin(t * 1.8 + dp.phase) * 0.25;
          const curZ = dp.wz + Math.cos(t * 1.6 + dp.phase) * 0.25;

          dummy.position.set(curX, curY, curZ);
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(dp.phase + t * 1.4);
          const s = dp.scale * (0.8 + Math.sin(t * 7.0 + dp.phase) * 0.2);
          dummy.scale.setScalar(s);
        } else {
          // Omítkový prach jemně víří nízko nad zemí
          const curX = dp.wx + Math.sin(t * 0.4 + dp.phase) * 0.18;
          const curZ = dp.wz + Math.cos(t * 0.45 + dp.phase) * 0.18;
          const curY = Math.max(0.12, dp.wy + Math.sin(t * 0.3 + dp.phase) * 0.14);

          dummy.position.set(curX, curY, curZ);
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(dp.phase + t * 0.4);
          dummy.scale.setScalar(dp.scale);
        }

        dummy.updateMatrix();
        dMesh.setMatrixAt(i, dummy.matrix);
        dMesh.setColorAt(i, dp.color);
      }
      dMesh.instanceMatrix.needsUpdate = true;
      if (dMesh.instanceColor) dMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 1. Hlavní měkké částicové pole černoprachového dýmu */}
      <instancedMesh
        ref={smokeMeshRef}
        args={[undefined, undefined, MAX_SMOKE_INSTANCES]}
        renderOrder={10}
        raycast={() => null}
      >
        <planeGeometry args={[1.95, 1.95]} />
        <meshStandardMaterial
          map={softPuffTexture}
          transparent
          opacity={0.58}
          depthWrite={false}
          roughness={0.95}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* 2. Částicové pole omítkového prachu a žhavých jisker */}
      <instancedMesh
        ref={debrisMeshRef}
        args={[undefined, undefined, MAX_DEBRIS_INSTANCES]}
        renderOrder={12}
        raycast={() => null}
      >
        <planeGeometry args={[0.48, 0.48]} />
        <meshBasicMaterial
          map={softPuffTexture}
          transparent
          opacity={0.78}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
