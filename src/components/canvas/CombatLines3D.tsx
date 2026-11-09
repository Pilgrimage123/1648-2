/**
 * 3D Targeting Sightline, Animated Projectiles & Particle VFX (/src/components/canvas/CombatLines3D.tsx).
 * - Draws color-coded 3D Line of Sight to the selected target in Targeting HUD mode
 * - Renders physically grounded 17th-century black-powder shooting & explosion effects:
 *   1. Muzzle Flash, Pan Sparks & Black-Powder Smoke Plume offset at the musket/carbine barrel tip (not inside the shooter's torso)
 *   2. High-velocity lead musket ball with properly oriented trailing wake (no static laser line!)
 *   3. Distinct Miss vs. Hit ballistics: missed shots veer past the target and ricochet off masonry with stone dust;
 *      hits erupt on the target with crimson/gold armor-piercing sparks and shockwaves
 *   4. Multi-layered 3D Fireball + Flying Barrel Staves for grenade & chain powder-keg detonations
 */

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { GridCoord } from "../../core/types";
import type { ProjectileVisual } from "../../store/useGameStore";
import { useGameStore } from "../../store/useGameStore";
import { gridToWorld } from "./worldCoords";

interface ParticleSeed {
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  phase: number;
}

function createParticleSeeds(
  count: number,
  spread: number,
  upBias = 0.6,
): ParticleSeed[] {
  const seeds: ParticleSeed[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.41;
    const elev = ((i * 7) % 11) / 11;
    const speed = (0.45 + ((i * 13) % 17) / 17) * spread;
    seeds.push({
      vx: Math.cos(angle) * speed * (0.65 + elev * 0.5),
      vy: (elev * 1.15 + upBias) * speed * 0.75,
      vz: Math.sin(angle) * speed * (0.65 + elev * 0.5),
      scale: 0.055 + ((i * 5) % 9) * 0.012,
      phase: (i % 5) * 0.15,
    });
  }
  return seeds;
}

/**
 * Dedicated 3D Fireball & Flying Barrel Staves for detonated Powder Kegs.
 */
function KegExplosionVFX({
  coord,
  durationMs,
}: {
  coord: GridCoord;
  durationMs: number;
}) {
  const startTimeRef = useRef<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerPlumeRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const debrisGroupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const [wx, wy, wz] = useMemo(() => gridToWorld(coord), [coord]);
  const debrisSeeds = useMemo(() => createParticleSeeds(28, 4.8, 0.85), []);

  useFrame(({ clock }) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime();
    }
    const elapsedSec = clock.getElapsedTime() - startTimeRef.current;
    const totalSec = Math.max(0.25, durationMs / 1000);
    const progress = Math.min(1, elapsedSec / totalSec);

    // Explosion erupts right as the projectile reaches the keg (progress >= 0.34)
    const blastT = THREE.MathUtils.clamp((progress - 0.34) / 0.66, 0, 1);
    const active = blastT > 0;

    if (groupRef.current) {
      groupRef.current.visible = active;
    }
    if (!active) return;

    if (coreRef.current) {
      const s = 0.35 + Math.sin(Math.min(1, blastT * 1.4) * Math.PI) * 2.8;
      coreRef.current.scale.setScalar(Math.max(0.05, s));
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - blastT) * 0.92,
      );
    }
    if (outerPlumeRef.current) {
      const s = 0.5 + blastT * 3.4;
      outerPlumeRef.current.scale.set(s, s * 0.85, s);
      outerPlumeRef.current.position.y = 0.6 + blastT * 1.6;
      (outerPlumeRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - blastT * 0.92) * 0.65);
    }
    if (ringRef.current) {
      const r = 0.4 + blastT * 4.6;
      ringRef.current.scale.set(r, r, 1);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - blastT) * 0.95,
      );
    }
    if (debrisGroupRef.current) {
      debrisGroupRef.current.children.forEach((child, idx) => {
        const seed = debrisSeeds[idx % debrisSeeds.length]!;
        child.position.set(
          seed.vx * blastT,
          0.35 + seed.vy * blastT - 2.6 * blastT * blastT,
          seed.vz * blastT,
        );
        child.rotation.set(blastT * 8, blastT * 6, idx);
        const s = Math.max(0.001, seed.scale * 1.45 * (1.2 - blastT));
        child.scale.setScalar(s);
      });
    }
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, (1 - blastT) * 14);
    }
  });

  return (
    <group ref={groupRef} position={[wx, wy + 0.15, wz]} visible={false}>
      <pointLight
        ref={lightRef}
        color="#f97316"
        distance={12}
        decay={2}
        intensity={12}
      />
      <mesh ref={coreRef} position={[0, 0.55, 0]}>
        <dodecahedronGeometry args={[0.65, 1]} />
        <meshBasicMaterial color="#fef08a" transparent opacity={0.9} />
      </mesh>
      <mesh ref={outerPlumeRef} position={[0, 0.75, 0]}>
        <dodecahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial
          color="#ea580c"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.58, 32]} />
        <meshBasicMaterial
          color="#fbbf24"
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
      <group ref={debrisGroupRef}>
        {debrisSeeds.map((_, i) => (
          <mesh key={i}>
            <boxGeometry args={[1.4, 0.5, 0.5]} />
            <meshBasicMaterial
              color={
                i % 3 === 0 ? "#fde047" : i % 3 === 1 ? "#f97316" : "#78350f"
              }
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ActiveProjectileVFX({ projectile }: { projectile: ProjectileVisual }) {
  const startTimeRef = useRef<number | null>(null);
  const lastIdRef = useRef<number>(-1);
  const progressRef = useRef<number>(0);

  const bulletGroupRef = useRef<THREE.Group>(null);
  const smokeTrailRef = useRef<THREE.Mesh>(null);
  const muzzleFlashRef = useRef<THREE.Mesh>(null);
  const muzzleConeRef = useRef<THREE.Mesh>(null);
  const muzzleLightRef = useRef<THREE.PointLight>(null);
  const muzzleSparksRef = useRef<THREE.Group>(null);
  const muzzleSmokeRef = useRef<THREE.Group>(null);

  const impactGroupRef = useRef<THREE.Group>(null);
  const impactRingRef = useRef<THREE.Mesh>(null);
  const impactCoreRef = useRef<THREE.Mesh>(null);
  const impactSmokeRef = useRef<THREE.Group>(null);
  const impactLightRef = useRef<THREE.PointLight>(null);
  const shrapnelGroupRef = useRef<THREE.Group>(null);

  const muzzleSparkSeeds = useMemo(() => createParticleSeeds(22, 2.8, 0.35), []);
  const smokeSeeds = useMemo(() => createParticleSeeds(12, 1.55, 0.48), []);
  const impactSparkSeeds = useMemo(
    () =>
      createParticleSeeds(
        projectile.kind === "grenade" ? 34 : 24,
        projectile.kind === "grenade" ? 4.6 : 2.9,
        0.55,
      ),
    [projectile.kind],
  );
  const impactSmokeSeeds = useMemo(() => createParticleSeeds(8, 1.4, 0.65), []);
  const shrapnelSeeds = useMemo(() => createParticleSeeds(16, 1.5, 0.12), []);

  const coords = useMemo(() => {
    const [ax, ay, az] = gridToWorld(projectile.from);
    const [tx, ty, tz] = gridToWorld(projectile.to);

    const rawStart = new THREE.Vector3(ax, ay + 1.06, az);
    const rawTarget = new THREE.Vector3(
      tx,
      ty + (projectile.kind === "grenade" ? 0.22 : 1.04),
      tz,
    );

    const horizVec = new THREE.Vector3(
      rawTarget.x - rawStart.x,
      0,
      rawTarget.z - rawStart.z,
    );
    const horizDist = Math.max(0.001, horizVec.length());
    const horizNorm = horizVec.clone().divideScalar(horizDist);
    const rightNorm = new THREE.Vector3(-horizNorm.z, 0, horizNorm.x);

    // Offset muzzle start position to the tip of the musket/carbine barrel (in front of shooter, slightly right)
    const start = rawStart
      .clone()
      .addScaledVector(horizNorm, projectile.kind === "grenade" ? 0.32 : 0.58)
      .addScaledVector(rightNorm, 0.14);

    // If the shot missed (hit === false), deflect the endpoint laterally and past/above so it visibly misses the soldier!
    const isMissedShot =
      projectile.hit === false &&
      projectile.kind !== "grenade" &&
      !projectile.misfired;
    const missSide = projectile.id % 2 === 0 ? 1 : -1;
    const end = isMissedShot
      ? rawTarget
          .clone()
          .addScaledVector(rightNorm, missSide * 0.82)
          .addScaledVector(horizNorm, 0.45)
          .add(new THREE.Vector3(0, -0.32, 0))
      : rawTarget;

    const dir = end.clone().sub(start);
    const distance = Math.max(0.001, dir.length());
    const dirNorm = dir.clone().normalize();
    const midPoint = start.clone().lerp(end, 0.5);

    // Orientation quaternion aligning +Y with dirNorm (for cylindrical smoke trail & muzzle cone)
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dirNorm,
    );

    const extraEnds = (projectile.extraTargets ?? []).map((c) => {
      const [ex, ey, ez] = gridToWorld(c);
      return new THREE.Vector3(ex, ey + 1.05, ez);
    });

    // Parabolic arc preview for grenade only
    const grenadeArcPoints: [number, number, number][] = [];
    if (projectile.kind === "grenade") {
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        const x = THREE.MathUtils.lerp(start.x, end.x, u);
        const z = THREE.MathUtils.lerp(start.z, end.z, u);
        const y =
          THREE.MathUtils.lerp(start.y, end.y, u) + Math.sin(u * Math.PI) * 3.1;
        grenadeArcPoints.push([x, y, z]);
      }
    }

    return {
      start,
      end,
      midPoint,
      dirNorm,
      distance,
      alignQuat,
      extraEnds,
      grenadeArcPoints,
    };
  }, [projectile]);

  useFrame(({ clock }) => {
    if (lastIdRef.current !== projectile.id) {
      lastIdRef.current = projectile.id;
      startTimeRef.current = clock.getElapsedTime();
    }
    const elapsedSec =
      clock.getElapsedTime() - (startTimeRef.current ?? clock.getElapsedTime());
    const totalSec = Math.max(0.45, (projectile.durationMs ?? 680) / 1000);
    const progress = THREE.MathUtils.clamp(elapsedSec / totalSec, 0, 1);
    progressRef.current = progress;

    // Flight occupies first 36% of animation (~245ms), impact occupies 34%..100% (~435ms)
    const flightT = THREE.MathUtils.clamp(progress / 0.36, 0, 1);
    const impactT = THREE.MathUtils.clamp((progress - 0.34) / 0.66, 0, 1);

    // 1. Muzzle Flash, Barrel Flame Cone & Black Powder Smoke at Musket Tip
    if (muzzleFlashRef.current) {
      const flashAlpha = Math.max(0, 1 - progress * 4.2);
      const flashScale = 0.4 + progress * 2.1;
      muzzleFlashRef.current.scale.setScalar(flashScale);
      const mat = muzzleFlashRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = flashAlpha;
    }
    if (muzzleConeRef.current) {
      const coneAlpha = projectile.misfired
        ? 0
        : Math.max(0, 1 - progress * 4.5);
      const coneScale = 0.5 + progress * 2.2;
      muzzleConeRef.current.scale.set(coneScale * 0.7, coneScale * 1.4, coneScale * 0.7);
      const mat = muzzleConeRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = coneAlpha;
    }
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = Math.max(
        0,
        (1 - progress * 3.8) * (projectile.misfired ? 4.5 : 9.5),
      );
    }
    if (muzzleSparksRef.current) {
      muzzleSparksRef.current.children.forEach((child, idx) => {
        const seed = muzzleSparkSeeds[idx % muzzleSparkSeeds.length]!;
        const st = Math.min(1, progress * 2.4);
        const forwardMult = projectile.misfired ? 0.25 : 1.75;
        child.position.set(
          coords.dirNorm.x * st * forwardMult + seed.vx * st * 0.48,
          seed.vy * st * (projectile.misfired ? 0.85 : 0.5) - 0.85 * st * st,
          coords.dirNorm.z * st * forwardMult + seed.vz * st * 0.48,
        );
        const s = Math.max(0.001, seed.scale * (1 - st * 0.85));
        child.scale.setScalar(s);
      });
    }
    if (muzzleSmokeRef.current) {
      muzzleSmokeRef.current.children.forEach((child, idx) => {
        const seed = smokeSeeds[idx % smokeSeeds.length]!;
        const st = progress;
        child.position.set(
          coords.dirNorm.x * st * 1.25 + seed.vx * st * 0.65,
          0.1 + st * 0.95 + seed.vy * st * 0.35,
          coords.dirNorm.z * st * 1.25 + seed.vz * st * 0.65,
        );
        const puffScale = (0.22 + st * 0.78) * (1 - st * 0.2);
        child.scale.set(puffScale * 1.15, puffScale * 0.85, puffScale * 1.15);
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - st * 0.95) * 0.62);
      });
    }

    // 2. Traveling Projectile (Bullet / Sniper Bolt / Spinning Grenade) & Dynamic Smoke Wake
    if (bulletGroupRef.current) {
      if (projectile.misfired) {
        bulletGroupRef.current.visible = false;
      } else {
        bulletGroupRef.current.visible = flightT < 0.99;
        if (projectile.kind === "grenade") {
          const x = THREE.MathUtils.lerp(coords.start.x, coords.end.x, flightT);
          const z = THREE.MathUtils.lerp(coords.start.z, coords.end.z, flightT);
          const y =
            THREE.MathUtils.lerp(coords.start.y, coords.end.y, flightT) +
            Math.sin(flightT * Math.PI) * 3.1;
          bulletGroupRef.current.position.set(x, y, z);
          bulletGroupRef.current.rotation.x = flightT * Math.PI * 6;
          bulletGroupRef.current.rotation.z = flightT * Math.PI * 4;
        } else {
          bulletGroupRef.current.position.lerpVectors(
            coords.start,
            coords.end,
            flightT,
          );
          bulletGroupRef.current.lookAt(coords.end);
        }
      }
    }

    // Dynamic Gunpowder Vapor Wake along shot trajectory (expands during flight and fades after impact)
    if (smokeTrailRef.current) {
      if (projectile.misfired || projectile.kind === "grenade") {
        smokeTrailRef.current.visible = false;
      } else {
        smokeTrailRef.current.visible = true;
        const headFrac = flightT;
        const tailFrac = THREE.MathUtils.clamp((progress - 0.14) / 0.55, 0, 0.95);
        const segLen = Math.max(0.05, (headFrac - tailFrac) * coords.distance);
        const centerFrac = (headFrac + tailFrac) * 0.5;
        smokeTrailRef.current.position.lerpVectors(
          coords.start,
          coords.end,
          centerFrac,
        );
        smokeTrailRef.current.quaternion.copy(coords.alignQuat);
        const widthScale =
          projectile.kind === "sniper_beam" ? 1.45 : 1.0;
        smokeTrailRef.current.scale.set(widthScale, segLen, widthScale);
        const mat = smokeTrailRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - progress * 1.15) * 0.65);
      }
    }

    // 2b. Shrapnel Pellet Cone
    if (shrapnelGroupRef.current) {
      shrapnelGroupRef.current.visible =
        projectile.kind === "shrapnel_burst" && flightT < 0.98;
      shrapnelGroupRef.current.children.forEach((child, idx) => {
        const seed = shrapnelSeeds[idx % shrapnelSeeds.length]!;
        const targetVec =
          coords.extraEnds.length > 0
            ? coords.extraEnds[idx % coords.extraEnds.length]!
            : coords.end;
        const x =
          THREE.MathUtils.lerp(coords.start.x, targetVec.x, flightT) +
          seed.vx * flightT * 0.55;
        const y =
          THREE.MathUtils.lerp(coords.start.y, targetVec.y, flightT) +
          seed.vy * flightT * 0.25;
        const z =
          THREE.MathUtils.lerp(coords.start.z, targetVec.z, flightT) +
          seed.vz * flightT * 0.55;
        child.position.set(x, y, z);
      });
    }

    // 3. Impact Explosion / Hit Sparks / Ricochet Stone Dust at Target
    if (impactGroupRef.current) {
      const showImpact = !projectile.misfired && impactT > 0;
      impactGroupRef.current.visible = showImpact;
      if (showImpact) {
        impactGroupRef.current.children.forEach((child, idx) => {
          const seed = impactSparkSeeds[idx % impactSparkSeeds.length]!;
          const grav = projectile.kind === "grenade" ? 3.2 : 2.2;
          child.position.set(
            seed.vx * impactT,
            seed.vy * impactT - 0.5 * grav * impactT * impactT,
            seed.vz * impactT,
          );
          const s = Math.max(0.001, seed.scale * (1.4 - impactT * 1.15));
          child.scale.setScalar(s);
        });
      }
    }

    if (impactSmokeRef.current) {
      const showSmoke = !projectile.misfired && impactT > 0;
      impactSmokeRef.current.visible = showSmoke;
      if (showSmoke) {
        impactSmokeRef.current.children.forEach((child, idx) => {
          const seed = impactSmokeSeeds[idx % impactSmokeSeeds.length]!;
          child.position.set(
            seed.vx * impactT * 0.65,
            0.15 + impactT * 0.85 + seed.vy * impactT * 0.35,
            seed.vz * impactT * 0.65,
          );
          const s = (0.2 + impactT * 0.65) * (1 - impactT * 0.2);
          child.scale.setScalar(s);
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, (1 - impactT) * 0.5);
        });
      }
    }

    if (impactRingRef.current) {
      const showRing = !projectile.misfired && impactT > 0;
      impactRingRef.current.visible = showRing;
      if (showRing) {
        const maxRadius =
          projectile.kind === "grenade"
            ? 3.9
            : projectile.hit === false
              ? 0.75
              : projectile.critical
                ? 2.25
                : 1.45;
        const ringScale = 0.2 + impactT * maxRadius;
        impactRingRef.current.scale.set(ringScale, ringScale, 1);
        const mat = impactRingRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - impactT) * 0.9);
      }
    }

    if (impactCoreRef.current) {
      const showCore = !projectile.misfired && impactT > 0 && impactT < 0.85;
      impactCoreRef.current.visible = showCore;
      if (showCore) {
        const coreMax =
          projectile.kind === "grenade"
            ? 2.5
            : projectile.hit === false
              ? 0.35
              : 0.92;
        const cScale =
          0.22 + Math.sin(Math.min(1, impactT * 1.35) * Math.PI) * coreMax;
        impactCoreRef.current.scale.setScalar(Math.max(0.05, cScale));
        const mat = impactCoreRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - impactT * 1.15) * 0.88);
      }
    }

    if (impactLightRef.current) {
      impactLightRef.current.intensity =
        !projectile.misfired && impactT > 0
          ? Math.max(
              0,
              (1 - impactT) *
                (projectile.kind === "grenade"
                  ? 12
                  : projectile.hit === false
                    ? 2.5
                    : 6.5),
            )
          : 0;
    }
  });

  const primaryColor =
    projectile.kind === "sniper_beam"
      ? "#fde047"
      : projectile.kind === "grenade"
        ? "#f97316"
        : projectile.kind === "shrapnel_burst"
          ? "#fb7185"
          : "#fef08a";

  const impactColor =
    projectile.kind === "grenade"
      ? "#f97316"
      : projectile.hit === false
        ? "#cbd5e1"
        : projectile.critical
          ? "#fbbf24"
          : "#ef4444";

  return (
    <group>
      {/* Parabolic dashed trajectory for thrown grenades */}
      {!projectile.misfired && projectile.kind === "grenade" && (
        <Line
          points={coords.grenadeArcPoints}
          color={primaryColor}
          lineWidth={2.5}
          transparent
          opacity={0.5}
          dashed
          dashScale={4}
          dashSize={0.35}
          gapSize={0.2}
        />
      )}

      {/* Dynamic Traveling Tracer & Smoke Wake for Firearms */}
      <mesh ref={smokeTrailRef} visible={false}>
        <cylinderGeometry args={[0.035, 0.012, 1, 8]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>

      {/* 1. Muzzle Flash, Barrel Flame Cone, Dynamic Light, Sparks & Black Powder Smoke at Barrel Tip */}
      <group position={coords.start}>
        <pointLight
          ref={muzzleLightRef}
          color={projectile.misfired ? "#fb923c" : "#fef08a"}
          distance={7.5}
          decay={2}
          intensity={7}
        />
        <mesh ref={muzzleFlashRef}>
          <dodecahedronGeometry args={[0.24, 0]} />
          <meshBasicMaterial
            color={projectile.misfired ? "#f97316" : "#fef9c3"}
            transparent
            opacity={0.95}
          />
        </mesh>

        {/* Directional Muzzle Flame Cone along Barrel Vector */}
        <mesh
          ref={muzzleConeRef}
          position={[
            coords.dirNorm.x * 0.32,
            coords.dirNorm.y * 0.32,
            coords.dirNorm.z * 0.32,
          ]}
          quaternion={coords.alignQuat}
        >
          <coneGeometry args={[0.18, 0.65, 10]} />
          <meshBasicMaterial
            color="#fb923c"
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>

        {/* Flying Muzzle Sparks */}
        <group ref={muzzleSparksRef}>
          {muzzleSparkSeeds.map((_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial
                color={i % 2 === 0 ? "#fde047" : "#f97316"}
              />
            </mesh>
          ))}
        </group>

        {/* Expanding Black Powder Smoke Puffs */}
        <group ref={muzzleSmokeRef}>
          {smokeSeeds.map((_, i) => (
            <mesh key={i}>
              <dodecahedronGeometry args={[0.38, 1]} />
              <meshBasicMaterial
                color={projectile.misfired ? "#475569" : "#cbd5e1"}
                transparent
                opacity={0.55}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* 2. Traveling 3D Projectile */}
      <group ref={bulletGroupRef} position={coords.start}>
        {projectile.kind === "grenade" ? (
          <group>
            {/* Cast-iron 17th-century petard body */}
            <mesh>
              <dodecahedronGeometry args={[0.21, 1]} />
              <meshStandardMaterial
                color="#1c1917"
                roughness={0.35}
                metalness={0.85}
              />
            </mesh>
            {/* Burning fuse spark */}
            <mesh position={[0, 0.22, 0]}>
              <sphereGeometry args={[0.095, 8, 8]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
          </group>
        ) : (
          <group>
            {/* Glowing lead musket ball / golden sniper core */}
            <mesh>
              <sphereGeometry
                args={[projectile.kind === "sniper_beam" ? 0.14 : 0.1, 10, 10]}
              />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Properly oriented supersonic tail cone (wide base at ball z=0, pointed tail trailing behind at z=-0.9) */}
            <mesh position={[0, 0, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry
                args={[
                  projectile.kind === "sniper_beam" ? 0.14 : 0.095,
                  projectile.kind === "sniper_beam" ? 1.25 : 0.85,
                  8,
                ]}
              />
              <meshBasicMaterial
                color={primaryColor}
                transparent
                opacity={0.88}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* 2b. Shrapnel Burst Pellet Cloud */}
      <group ref={shrapnelGroupRef}>
        {shrapnelSeeds.map((_, i) => (
          <mesh key={i}>
            <dodecahedronGeometry args={[0.085, 0]} />
            <meshBasicMaterial color={i % 2 === 0 ? "#fde047" : "#fb7185"} />
          </mesh>
        ))}
      </group>

      {/* 3. Target Impact Burst / Fireball / Stone Ricochet */}
      <group position={coords.end}>
        <pointLight
          ref={impactLightRef}
          color={impactColor}
          distance={projectile.kind === "grenade" ? 10 : 5.5}
          decay={2}
          intensity={0}
        />

        {/* Core Flash / Fireball Sphere */}
        <mesh ref={impactCoreRef} visible={false}>
          <dodecahedronGeometry args={[0.52, 1]} />
          <meshBasicMaterial
            color={projectile.kind === "grenade" ? "#fde047" : impactColor}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* Horizontal Shockwave Ring */}
        <mesh
          ref={impactRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.32, 0.5, 28]} />
          <meshBasicMaterial
            color={impactColor}
            side={THREE.DoubleSide}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* Impact Dust / Black Powder Smoke Puffs */}
        <group ref={impactSmokeRef} visible={false}>
          {impactSmokeSeeds.map((_, i) => (
            <mesh key={i}>
              <dodecahedronGeometry args={[0.32, 1]} />
              <meshBasicMaterial
                color={projectile.hit === false ? "#94a3b8" : "#cbd5e1"}
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>

        {/* Bursting Sparks / Blood / Armor Shards / Stone Ricochet Chips */}
        <group ref={impactGroupRef} visible={false}>
          {impactSparkSeeds.map((_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial
                color={
                  projectile.kind === "grenade"
                    ? i % 3 === 0
                      ? "#fde047"
                      : i % 3 === 1
                        ? "#f97316"
                        : "#ef4444"
                    : projectile.hit === false
                      ? i % 3 === 0
                        ? "#fef08a"
                        : "#94a3b8"
                      : i % 2 === 0
                        ? "#fbbf24"
                        : "#dc2626"
                }
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* 4. Secondary Powder Keg Detonation Fireballs */}
      {(projectile.detonatedKegs ?? []).map((kegCoord, idx) => (
        <KegExplosionVFX
          key={`keg-blast-${idx}-${kegCoord.x}-${kegCoord.z}`}
          coord={kegCoord}
          durationMs={projectile.durationMs ?? 680}
        />
      ))}
    </group>
  );
}

export function CombatLines3D() {
  const actionMode = useGameStore((s) => s.actionMode);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const units = useGameStore((s) => s.units);
  const activeProjectile = useGameStore((s) => s.activeProjectile);

  const sightlineData = useMemo(() => {
    if (actionMode !== "shoot" || !selectedUnitId || !selectedTargetId) {
      return null;
    }
    const attacker = units.find((u) => u.id === selectedUnitId && u.alive);
    const targetEval = visibleTargets.find(
      (t) => t.targetId === selectedTargetId,
    );
    if (!attacker || !targetEval) return null;

    const [ax, ay, az] = gridToWorld(attacker.pos);
    const [tx, ty, tz] = gridToWorld(targetEval.targetPos);

    const hitChance = targetEval.calculation.hitChance;
    const isFlanked = targetEval.calculation.isFlanked;

    const lineColor = isFlanked
      ? "#f59e0b"
      : hitChance >= 70
        ? "#10b981"
        : hitChance >= 40
          ? "#f59e0b"
          : "#f43f5e";

    return {
      points: [
        [ax, ay + 1.08, az] as [number, number, number],
        [tx, ty + 1.08, tz] as [number, number, number],
      ],
      rayCells: targetEval.losRay.map((c) => {
        const [wx, wy, wz] = gridToWorld(c);
        return [wx, wy + 1.08, wz] as [number, number, number];
      }),
      isFlanked,
      hitChance,
      color: lineColor,
    };
  }, [actionMode, selectedUnitId, selectedTargetId, visibleTargets, units]);

  return (
    <group>
      {/* Targeting HUD 3D Line of Sight */}
      {sightlineData && !activeProjectile && (
        <>
          <Line
            points={sightlineData.points}
            color={sightlineData.color}
            lineWidth={3.5}
            dashed
            dashScale={5}
            dashSize={0.5}
            gapSize={0.2}
          />
          {sightlineData.rayCells.map((pt, idx) => (
            <mesh key={idx} position={pt}>
              <sphereGeometry args={[0.065, 8, 8]} />
              <meshBasicMaterial color={sightlineData.color} />
            </mesh>
          ))}
        </>
      )}

      {/* Animated 3D Projectile & Particle Effects */}
      {activeProjectile && (
        <ActiveProjectileVFX
          key={activeProjectile.id}
          projectile={activeProjectile}
        />
      )}
    </group>
  );
}
