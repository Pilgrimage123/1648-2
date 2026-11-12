/**
 * 3D Atmospheric & Combat-Driven Particle System (/src/components/canvas/RainParticles.tsx).
 * Enforces physical realism for enclosed Baroque interiors vs. open courtyard:
 * 1. Falling rain streaks (weather === "rain") strictly respect roofed & enclosed zones:
 *    no rain or snow ever falls inside `isEnclosedRoofedCoord`
 *    (palace y ≤ 1, x 1.5..21.5, z 15.5..27.5, except the open courtyard;
 *    belvedere arcade y < 1, x 8.5..14.5, z 8.5..12.5).
 * 2. Zero arbitrary dust/ash inside the palace before gunfire and explosions begin!
 * 3. Once gunfire, grenades, or powder-keg explosions erupt, plaster dust, ash flakes,
 *    and glowing embers organically spawn at the combat epicenters (`blastZones` & `smokeTiles`)
 *    and progressively expand outward as the battle intensifies.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getMission1EscapeTile,
  GRID_DEPTH,
  GRID_WIDTH,
  isEnclosedRoofedCoord,
} from "../../core/GridSystem";
import { useGameStore } from "../../store/useGameStore";
import {
  evaluateFixture,
  evaluateLantern,
  fixturesForScenario,
  isFixtureDucked,
  matchcordCandidates,
  rainGlintStrength,
} from "./diegeticLights";
import { gridToWorld, TILE_SIZE } from "./worldCoords";

const RAIN_COUNT = 360;
const ASH_COUNT = 140;
const EMBER_COUNT = 72;

// World-to-grid inverse helper matching worldCoords.ts dynamically for GRID_WIDTH × GRID_DEPTH
function worldToGridXZ(wx: number, wz: number): [number, number] {
  const gx = wx / TILE_SIZE + (GRID_WIDTH - 1) * 0.5;
  const gz = wz / TILE_SIZE + (GRID_DEPTH - 1) * 0.5;
  return [gx, gz];
}

// Pick an outdoor world coordinate for rain (never inside the enclosed Grand Priory Palace)
function randomOutdoorRainXZ(): [number, number] {
  for (let attempt = 0; attempt < 8; attempt++) {
    const wx = (Math.random() - 0.5) * 34;
    const wz = (Math.random() - 0.5) * 38;
    const [gx, gz] = worldToGridXZ(wx, wz);
    if (!isEnclosedRoofedCoord(gx, 1, gz)) {
      return [wx, wz];
    }
  }
  // Fallback to open garden / Čertovka canal
  return [(Math.random() - 0.5) * 26, -5 - Math.random() * 7];
}

const TORCH_EMBER_COUNT = 14;
const MATCHCORD_EMBER_CAP = 16;

export function RainParticles() {
  const weather = useGameStore((s) => s.weather);
  const combatIntensity = useGameStore((s) => s.combatIntensity);
  const blastZones = useGameStore((s) => s.blastZones);
  const grid = useGameStore((s) => s.grid);
  const units = useGameStore((s) => s.units);
  const lightFlashes = useGameStore((s) => s.lightFlashes);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const rainColor = useMemo(() => new THREE.Color("#94a3b8"), []);
  const glintColor = useMemo(() => new THREE.Color("#fdba74"), []);
  const dropColor = useMemo(() => new THREE.Color(), []);

  const rainMeshRef = useRef<THREE.InstancedMesh>(null);
  const ashMeshRef = useRef<THREE.InstancedMesh>(null);
  const emberMeshRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 1. Pre-generate rain drops strictly in open-sky outdoor areas
  const rainData = useMemo(() => {
    const data: { x: number; y: number; z: number; speed: number; scaleY: number }[] = [];
    for (let i = 0; i < RAIN_COUNT; i++) {
      const [rx, rz] = randomOutdoorRainXZ();
      data.push({
        x: rx,
        y: Math.random() * 18,
        z: rz,
        speed: 16 + Math.random() * 10,
        scaleY: 1.2 + Math.random() * 1.5,
      });
    }
    return data;
  }, []);

  // 2. Pre-generate combat-driven ash & plaster dust flakes
  const ashData = useMemo(() => {
    const data: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      phase: number;
      scale: number;
      zoneSeed: number;
    }[] = [];
    for (let i = 0; i < ASH_COUNT; i++) {
      data.push({
        x: 0,
        y: -10, // Hidden until spawned by a blastZone
        z: 0,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -0.18 - Math.random() * 0.24,
        vz: (Math.random() - 0.5) * 0.45,
        phase: Math.random() * Math.PI * 2,
        scale: 0.032 + Math.random() * 0.038,
        zoneSeed: i,
      });
    }
    return data;
  }, []);

  // 3. Pre-generate rising glowing embers (torch sparks + combat blast embers)
  const emberData = useMemo(() => {
    const data: {
      x: number;
      y: number;
      z: number;
      vy: number;
      phase: number;
      scale: number;
      seed: number;
    }[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      data.push({
        x: 0,
        y: -20,
        z: 0,
        vy: 0.55 + Math.random() * 0.75,
        phase: Math.random() * Math.PI * 2,
        scale: 0.026 + Math.random() * 0.03,
        seed: i,
      });
    }
    return data;
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const nowMs = performance.now();

    const escape = getMission1EscapeTile(grid);
    const scenario = useGameStore.getState().scenario;
    const litTorches = fixturesForScenario(scenario).filter((fixture) => fixture.kind === "torch")
      .map((fixture) =>
        evaluateFixture(
          fixture,
          weather,
          grid.getTile(fixture.coord)?.damageLevel ?? 0,
          isFixtureDucked(fixture.coord, nowMs, lightFlashes, blastZones),
        ),
      )
      .filter((state) => !state.snuffed && state.coord.y <= activeFloor);
    const lantern = escape
      ? evaluateLantern(
          escape.coord,
          weather,
          grid.getTile(escape.coord)?.damageLevel ?? 0,
          isFixtureDucked(escape.coord, nowMs, lightFlashes, blastZones),
        )
      : null;
    const cords = matchcordCandidates(
      units,
      fogOfWarEnabled,
      fogSnapshot.visibleEnemyIds,
      fogSnapshot.soundContacts,
    );
    const glintSources = [
      ...litTorches.map((torch) => ({
        position: torch.position,
        exposed: torch.exposed && !torch.snuffed,
      })),
      ...(lantern
        ? [
            {
              position: lantern.position,
              exposed: !lantern.snuffed,
            },
          ]
        : []),
      ...cords
        .filter((cord) => !cord.roofed)
        .map((cord) => ({ position: cord.position, exposed: true })),
      ...lightFlashes
        .filter((flash) => nowMs - flash.createdAt < flash.durationMs)
        .filter(
          (flash) =>
            !isEnclosedRoofedCoord(flash.coord.x, flash.coord.y, flash.coord.z),
        )
        .map((flash) => {
          const [gx, gy, gz] = gridToWorld(flash.coord);
          const origin = flash.world ?? {
            x: gx,
            y: gy + (flash.kind === "muzzle" ? 1.05 : 0.6),
            z: gz,
          };
          return { position: origin, exposed: true };
        }),
    ];

    // 1. Update Outdoor Rain (strictly masked from enclosed palace & covered roofs)
    const rainMesh = rainMeshRef.current;
    if (rainMesh && weather === "rain") {
      rainData.forEach((drop, i) => {
        drop.y -= drop.speed * dt;
        drop.x -= dt * 2.2;
        drop.z += dt * 0.9;

        const [gx, gz] = worldToGridXZ(drop.x, drop.z);
        const floorCheck: 0 | 1 = drop.y < 2.25 ? 0 : 1;
        const hitRoofOrPalace = isEnclosedRoofedCoord(gx, floorCheck, gz);

        if (drop.y < -0.2 || hitRoofOrPalace) {
          const [rx, rz] = randomOutdoorRainXZ();
          drop.x = rx;
          drop.z = rz;
          drop.y = 15 + Math.random() * 4;
        }

        dummy.position.set(drop.x, drop.y, drop.z);
        dummy.rotation.set(-0.14, 0, 0.14);
        dummy.scale.set(0.025, drop.scaleY, 0.025);
        dummy.updateMatrix();
        rainMesh.setMatrixAt(i, dummy.matrix);
        const glint = rainGlintStrength(
          { x: drop.x, y: drop.y, z: drop.z },
          glintSources,
        );
        dropColor.copy(rainColor).lerp(glintColor, glint * 0.55);
        rainMesh.setColorAt(i, dropColor);
      });
      rainMesh.instanceMatrix.needsUpdate = true;
      if (rainMesh.instanceColor) rainMesh.instanceColor.needsUpdate = true;
    }

    // 2. Update Combat-Driven Ash & Plaster Dust
    // Before gunfire/explosions start (blastZones.length === 0), 0 ash particles float around!
    // As shots and explosions occur, activeAshCount scales up with combatIntensity and spawns
    // organically inside the expanding radius of each BlastZoneEvent.
    const ashMesh = ashMeshRef.current;
    if (ashMesh) {
      const hasCombatZones = blastZones.length > 0 && combatIntensity > 0;
      const activeAshCount = hasCombatZones
        ? Math.min(
            ASH_COUNT,
            Math.floor(18 + combatIntensity * (ASH_COUNT - 18)),
          )
        : 0;

      ashData.forEach((flake, i) => {
        if (i >= activeAshCount || !hasCombatZones) {
          dummy.position.set(0, -50, 0);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          ashMesh.setMatrixAt(i, dummy.matrix);
          return;
        }

        const zone = blastZones[flake.zoneSeed % blastZones.length]!;
        const [zx, zy, zz] = gridToWorld(zone.coord);
        const ageSec = Math.max(0, (nowMs - zone.createdAt) / 1000);
        // Organic outward diffusion radius (in world meters): starts compact, expands smoothly over time
        const currentRadius =
          Math.min(zone.maxRadius, zone.baseRadius + ageSec * 0.42) * TILE_SIZE;
        const indoor = isEnclosedRoofedCoord(
          zone.coord.x,
          zone.coord.y,
          zone.coord.z,
        );
        // Indoors (inside the palace), air is calmer without outdoor wind; ceiling caps height
        const windFactor = indoor ? 0.18 : 0.75;
        const maxHeight = indoor ? zy + 2.1 : zy + 4.8;

        // Respawn flake inside its assigned blast zone if uninitialized or settled on floor
        const distSq = (flake.x - zx) ** 2 + (flake.z - zz) ** 2;
        if (
          flake.y < zy + 0.06 ||
          flake.y > maxHeight + 0.5 ||
          distSq > (currentRadius + 1.2) ** 2
        ) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * currentRadius;
          flake.x = zx + Math.cos(angle) * r;
          flake.z = zz + Math.sin(angle) * r;
          flake.y = zy + 0.35 + Math.random() * Math.min(2.2, maxHeight - zy);
        } else {
          flake.x +=
            (flake.vx * windFactor +
              Math.sin(t * 1.4 + flake.phase) * 0.16) *
            dt;
          flake.y +=
            (flake.vy + Math.cos(t * 1.9 + flake.phase) * 0.08) * dt;
          flake.z +=
            (flake.vz * windFactor +
              Math.cos(t * 1.2 + flake.phase) * 0.16) *
            dt;
        }

        dummy.position.set(flake.x, flake.y, flake.z);
        dummy.rotation.set(t * 1.4 + flake.phase, t * 1.1, flake.phase);
        dummy.scale.setScalar(flake.scale);
        dummy.updateMatrix();
        ashMesh.setMatrixAt(i, dummy.matrix);
      });
      ashMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Embers rise from a cause: a torch, a burning matchcord, or a blast.
    const emberMesh = emberMeshRef.current;
    if (emberMesh) {
      const torchEmberCount =
        litTorches.length === 0
          ? 0
          : weather === "rain"
            ? 8
            : TORCH_EMBER_COUNT;
      const cordEmberCount = Math.min(MATCHCORD_EMBER_CAP, cords.length * 2);
      const reserved = TORCH_EMBER_COUNT + MATCHCORD_EMBER_CAP;
      const combatEmberCount =
        blastZones.length > 0
          ? Math.min(
              EMBER_COUNT - reserved,
              Math.floor(combatIntensity * (EMBER_COUNT - reserved)),
            )
          : 0;
      const cordStart = TORCH_EMBER_COUNT;
      const combatStart = reserved;

      emberData.forEach((ember, i) => {
        const isTorchEmber = i < torchEmberCount;
        const isCordEmber = i >= cordStart && i < cordStart + cordEmberCount;
        const isCombatEmber =
          i >= combatStart && i < combatStart + combatEmberCount;
        if (!isTorchEmber && !isCordEmber && !isCombatEmber) {
          dummy.position.set(0, -50, 0);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          emberMesh.setMatrixAt(i, dummy.matrix);
          return;
        }

        const rise = isTorchEmber && weather === "rain" ? 0.45 : 1;
        ember.y += ember.vy * rise * dt;
        ember.x += Math.sin(t * 2.6 + ember.phase) * 0.28 * dt;
        ember.z += Math.cos(t * 2.2 + ember.phase) * 0.25 * dt;

        if (isTorchEmber) {
          const torch = litTorches[i % litTorches.length]!;
          const distSq =
            (ember.x - torch.position.x) ** 2 +
            (ember.z - torch.position.z) ** 2;
          const ceiling = weather === "rain" ? 1.3 : 1.6;
          if (ember.y > torch.position.y + ceiling || distSq > 0.8) {
            ember.x = torch.position.x + (Math.random() - 0.5) * 0.16;
            ember.y = torch.position.y + Math.random() * 0.08;
            ember.z = torch.position.z + (Math.random() - 0.5) * 0.16;
          }
        } else if (isCordEmber) {
          const cord = cords[(i - cordStart) % cords.length]!;
          const lock = cord.position;
          const distSq = (ember.x - lock.x) ** 2 + (ember.z - lock.z) ** 2;
          if (ember.y > lock.y + 0.45 || distSq > 0.2) {
            ember.x = lock.x + (Math.random() - 0.5) * 0.04;
            ember.y = lock.y;
            ember.z = lock.z + (Math.random() - 0.5) * 0.04;
          }
        } else {
          const zone = blastZones[ember.seed % blastZones.length]!;
          const [zx, zy, zz] = gridToWorld(zone.coord);
          const ageSec = Math.max(0, (nowMs - zone.createdAt) / 1000);
          const currentRadius =
            Math.min(zone.maxRadius, zone.baseRadius + ageSec * 0.38) *
            TILE_SIZE;
          const maxH = isEnclosedRoofedCoord(
            zone.coord.x,
            zone.coord.y,
            zone.coord.z,
          )
            ? zy + 2.15
            : zy + 4.2;
          const distSq = (ember.x - zx) ** 2 + (ember.z - zz) ** 2;

          if (ember.y > maxH || distSq > (currentRadius + 0.8) ** 2) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * currentRadius * 0.85;
            ember.x = zx + Math.cos(angle) * r;
            ember.z = zz + Math.sin(angle) * r;
            ember.y = zy + 0.15 + Math.random() * 0.55;
          }
        }

        const flicker = 0.72 + Math.sin(t * 8.5 + ember.phase) * 0.32;
        dummy.position.set(ember.x, ember.y, ember.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(ember.scale * flicker * (isCordEmber ? 0.65 : 1));
        dummy.updateMatrix();
        emberMesh.setMatrixAt(i, dummy.matrix);
      });
      emberMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 1. Outdoor Rain Streaks (only when weather === "rain", excluded from enclosed palace) */}
      {weather === "rain" && (
        <instancedMesh
          ref={rainMeshRef}
          args={[undefined, undefined, RAIN_COUNT]}
          raycast={() => null}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
          <meshBasicMaterial
            color="#94a3b8"
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </instancedMesh>
      )}

      {/* 2. Combat-Driven Plaster Dust & Gunpowder Ash Flakes */}
      <instancedMesh
        ref={ashMeshRef}
        args={[undefined, undefined, ASH_COUNT]}
        raycast={() => null}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color="#cbd5e1"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 3. Torch Sparks & Combat Blast Embers */}
      <instancedMesh
        ref={emberMeshRef}
        args={[undefined, undefined, EMBER_COUNT]}
        raycast={() => null}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color="#fb923c"
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
