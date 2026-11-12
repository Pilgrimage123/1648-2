/**
 * 3D Targeting Sightline, Animated Projectiles & Particle VFX (/src/components/canvas/CombatLines3D.tsx).
 * - Draws color-coded 3D Line of Sight to the selected target in Targeting HUD mode
 * - Renders physically grounded 17th-century black-powder shooting & explosion effects:
 *   1. Muzzle Flash, Pan Sparks & Black-Powder Smoke Plume offset at the musket/carbine barrel tip (+0.58m)
 *   2. High-velocity lead musket ball with properly oriented trailing wake (no static laser line!)
 *   3. Wound-severity-scaled Blood Particle System (arterial/venous droplet spray cone, blood aerosol mist,
 *      ground blood spatter, and cuirass armor-shred sparks) on hits
 *   4. Material-specific Obstacle Impact VFX (tumbling sandstone/stucco/walnut timber fragments, billowing
 *      masonry dust clouds, quartz ricochet sparks, and deflected lead musket ball) on missed shots
 *   5. Multi-layered 3D Fireball + Flying Barrel Staves for grenade & chain powder-keg detonations
 */

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { GridCoord } from "../../core/types";
import type { ImpactObstacleKind, ProjectileVisual } from "../../store/useGameStore";
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

function getObstacleDebrisPalette(obstacle: ImpactObstacleKind | undefined): {
  chunkColors: [string, string, string];
  dustColor: string;
  ringColor: string;
} {
  switch (obstacle) {
    case "palace_wood":
      return {
        chunkColors: ["#5c3a21", "#78350f", "#a16207"],
        dustColor: "#bfa07a",
        ringColor: "#d97706",
      };
    case "palace_stucco":
      return {
        chunkColors: ["#e7e5e4", "#d6d3d1", "#9a3412"],
        dustColor: "#e7e5e4",
        ringColor: "#f5f5f4",
      };
    case "high_wall":
    case "pillar":
    case "low_wall":
      return {
        chunkColors: ["#78716c", "#a8a29e", "#57534e"],
        dustColor: "#d6d3d1",
        ringColor: "#cbd5e1",
      };
    case "cobble":
    default:
      return {
        chunkColors: ["#475569", "#64748b", "#334155"],
        dustColor: "#94a3b8",
        ringColor: "#cbd5e1",
      };
  }
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

  const [wx, wy, wz] = useMemo(() => gridToWorld(coord), [coord]);
  const debrisSeeds = useMemo(() => createParticleSeeds(28, 4.8, 0.85), []);

  useFrame(({ clock }) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime();
    }
    const elapsedSec = clock.getElapsedTime() - startTimeRef.current;
    const totalSec = Math.max(0.25, durationMs / 1000);
    const progress = Math.min(1, elapsedSec / totalSec);

    // Explosion erupts right as the projectile reaches the keg (progress >= 0.39)
    const blastT = THREE.MathUtils.clamp((progress - 0.39) / 0.61, 0, 1);
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
  });

  return (
    <group ref={groupRef} position={[wx, wy + 0.15, wz]} visible={false}>
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
  const muzzleSparksRef = useRef<THREE.Group>(null);
  const muzzleSmokeRef = useRef<THREE.Group>(null);

  const impactGroupRef = useRef<THREE.Group>(null);
  const impactRingRef = useRef<THREE.Mesh>(null);
  const impactCoreRef = useRef<THREE.Mesh>(null);
  const impactSmokeRef = useRef<THREE.Group>(null);
  const shrapnelGroupRef = useRef<THREE.Group>(null);

  // Specialized Blood VFX refs (for hits)
  const bloodDropletsRef = useRef<THREE.Group>(null);
  const bloodMistRef = useRef<THREE.Group>(null);
  const bloodPuddleGroupRef = useRef<THREE.Group>(null);
  const armorSparksRef = useRef<THREE.Group>(null);

  // Specialized Obstacle Debris & Ricochet VFX refs (for misses)
  const obstacleDebrisRef = useRef<THREE.Group>(null);
  const obstacleDustRef = useRef<THREE.Group>(null);
  const ricochetBallRef = useRef<THREE.Mesh>(null);

  const isMissedShot =
    projectile.hit === false &&
    projectile.kind !== "grenade" &&
    !projectile.misfired;

  const bloodSeverity: 0 | 1 | 2 | 3 = useMemo(() => {
    if (isMissedShot || projectile.misfired || projectile.kind === "grenade") {
      return 0;
    }
    if (projectile.bloodSeverity !== undefined) {
      return projectile.bloodSeverity;
    }
    if (projectile.critical || projectile.killed) return 3;
    if ((projectile.damage ?? 2) >= 3) return 2;
    if ((projectile.damage ?? 1) >= 1) return 1;
    return 0;
  }, [isMissedShot, projectile]);

  const hasArmorImpact =
    !isMissedShot &&
    !projectile.misfired &&
    ((projectile.armorShredded ?? 0) > 0 ||
      (projectile.armorAbsorbed ?? 0) > 0 ||
      bloodSeverity === 0);

  const muzzleSparkSeeds = useMemo(() => createParticleSeeds(22, 2.8, 0.35), []);
  const smokeSeeds = useMemo(() => createParticleSeeds(12, 1.55, 0.48), []);

  // Blood droplet count & velocity scale directly with wound severity (1 = graze, 2 = medium wound, 3 = critical/arterial)
  const bloodDropletSeeds = useMemo(() => {
    const count =
      bloodSeverity === 3
        ? 58
        : bloodSeverity === 2
          ? 34
          : bloodSeverity === 1
            ? 16
            : 0;
    const spread =
      bloodSeverity === 3
        ? 3.1
        : bloodSeverity === 2
          ? 2.2
          : 1.4;
    return createParticleSeeds(count, spread, 0.48);
  }, [bloodSeverity]);

  const bloodMistSeeds = useMemo(() => {
    const count = bloodSeverity > 0 ? 3 + bloodSeverity * 3 : 0;
    return createParticleSeeds(count, 1.15 + bloodSeverity * 0.35, 0.25);
  }, [bloodSeverity]);

  const armorSparkSeeds = useMemo(
    () => createParticleSeeds(hasArmorImpact ? 18 : 0, 2.6, 0.55),
    [hasArmorImpact],
  );

  // Masonry / Stucco / Walnut Wood obstacle fragments on missed shots
  const obstacleDebrisSeeds = useMemo(
    () => createParticleSeeds(isMissedShot ? 32 : 0, 3.05, 0.72),
    [isMissedShot],
  );
  const obstacleDustSeeds = useMemo(
    () => createParticleSeeds(isMissedShot ? 16 : 0, 1.85, 0.52),
    [isMissedShot],
  );

  const impactSparkSeeds = useMemo(
    () =>
      createParticleSeeds(
        projectile.kind === "grenade" ? 34 : isMissedShot ? 18 : 14,
        projectile.kind === "grenade" ? 4.6 : 2.6,
        0.55,
      ),
    [projectile.kind, isMissedShot],
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

    // Offset muzzle start position to the tip of the musket/carbine barrel (+0.58m forward, +0.14m right)
    const start = rawStart
      .clone()
      .addScaledVector(horizNorm, projectile.kind === "grenade" ? 0.32 : 0.58)
      .addScaledVector(rightNorm, 0.14);

    // On a missed shot, anchor the impact onto the struck cover/wall obstacle (missImpactCoord) or veer past the target
    const missSide = projectile.id % 2 === 0 ? 1 : -1;
    let end = rawTarget;
    if (isMissedShot) {
      if (projectile.missImpactCoord) {
        const [mx, my, mz] = gridToWorld(projectile.missImpactCoord);
        const obsKind = projectile.impactObstacle ?? "cobble";
        const impactHeight =
          obsKind === "high_wall" || obsKind === "pillar" || obsKind === "palace_stucco"
            ? 1.12
            : obsKind === "low_wall" || obsKind === "palace_wood"
              ? 0.68
              : 0.18;
        // Shift slightly toward the shooter along the shot vector so debris erupts from the front face of the wall/cover
        end = new THREE.Vector3(mx, my + impactHeight, mz)
          .addScaledVector(horizNorm, -0.32)
          .addScaledVector(rightNorm, missSide * 0.28);
      } else {
        end = rawTarget
          .clone()
          .addScaledVector(rightNorm, missSide * 0.78)
          .addScaledVector(horizNorm, 0.42)
          .add(new THREE.Vector3(0, -0.34, 0));
      }
    }

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

    // Floor level relative to `end.y` so blood droplets and masonry fragments bounce/settle on the ground surface
    const impactBaseY = isMissedShot && projectile.missImpactCoord
      ? gridToWorld(projectile.missImpactCoord)[1]
      : ty;
    const floorLocalY = impactBaseY + 0.03 - end.y;

    return {
      start,
      end,
      midPoint,
      dirNorm,
      rightNorm,
      missSide,
      distance,
      alignQuat,
      extraEnds,
      grenadeArcPoints,
      floorLocalY,
    };
  }, [projectile, isMissedShot]);

  useFrame(({ clock }) => {
    if (lastIdRef.current !== projectile.id) {
      lastIdRef.current = projectile.id;
      startTimeRef.current = clock.getElapsedTime();
    }
    const elapsedSec =
      clock.getElapsedTime() - (startTimeRef.current ?? clock.getElapsedTime());
    const totalSec = Math.max(0.8, (projectile.durationMs ?? 1780) / 1000);
    const progress = THREE.MathUtils.clamp(elapsedSec / totalSec, 0, 1);
    progressRef.current = progress;

    // Synchronized with TacticalCamera & audio arrival (+90% longer, C2-smooth):
    // Flight occupies first 41% of animation (~730ms), impact occupies 39%..100% (~1050ms)
    const rawFlightT = THREE.MathUtils.clamp(progress / 0.41, 0, 1);
    const flightT =
      THREE.MathUtils.smootherstep(rawFlightT, 0, 1) * 0.32 + rawFlightT * 0.68;
    const rawImpactT = THREE.MathUtils.clamp((progress - 0.39) / 0.61, 0, 1);
    const impactT =
      rawImpactT > 0 ? 1 - Math.pow(1 - rawImpactT, 1.38) : 0;

    const isMelee = projectile.kind === "melee_strike";

    // 1. Muzzle Flash, Barrel Flame Cone & Black Powder Smoke at Musket Tip
    if (muzzleFlashRef.current) {
      if (isMelee) {
        muzzleFlashRef.current.visible = false;
      } else {
        muzzleFlashRef.current.visible = true;
        const flashAlpha = Math.max(0, 1 - progress * 4.2);
        const flashScale = 0.4 + progress * 2.1;
        muzzleFlashRef.current.scale.setScalar(flashScale);
        const mat = muzzleFlashRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = flashAlpha;
      }
    }
    if (muzzleConeRef.current) {
      if (isMelee) {
        muzzleConeRef.current.visible = false;
      } else {
        muzzleConeRef.current.visible = true;
        const coneAlpha = projectile.misfired
          ? 0
          : Math.max(0, 1 - progress * 4.5);
        const coneScale = 0.5 + progress * 2.2;
        muzzleConeRef.current.scale.set(
          coneScale * 0.7,
          coneScale * 1.4,
          coneScale * 0.7,
        );
        const mat = muzzleConeRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = coneAlpha;
      }
    }
    if (muzzleSparksRef.current) {
      if (isMelee) {
        muzzleSparksRef.current.visible = false;
      } else {
        muzzleSparksRef.current.visible = true;
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
    }
    if (muzzleSmokeRef.current) {
      if (isMelee) {
        muzzleSmokeRef.current.visible = false;
      } else {
        muzzleSmokeRef.current.visible = true;
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
    }

    // 2. Traveling Projectile (Bullet / Sniper Bolt / Spinning Grenade) & Dynamic Smoke Wake
    if (bulletGroupRef.current) {
      if (projectile.misfired || isMelee) {
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
      if (projectile.misfired || projectile.kind === "grenade" || isMelee) {
        smokeTrailRef.current.visible = false;
      } else {
        smokeTrailRef.current.visible = true;
        const headFrac = flightT;
        const tailFrac = THREE.MathUtils.clamp((progress - 0.14) / 0.58, 0, 0.95);
        const segLen = Math.max(0.05, (headFrac - tailFrac) * coords.distance);
        const centerFrac = (headFrac + tailFrac) * 0.5;
        smokeTrailRef.current.position.lerpVectors(
          coords.start,
          coords.end,
          centerFrac,
        );
        smokeTrailRef.current.quaternion.copy(coords.alignQuat);
        const widthScale = projectile.kind === "sniper_beam" ? 1.45 : 1.0;
        smokeTrailRef.current.scale.set(widthScale, segLen, widthScale);
        const mat = smokeTrailRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - progress * 1.12) * 0.68);
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

    // 3. Impact Core, Shockwave Ring & Smoke
    if (impactGroupRef.current) {
      const showImpact = !projectile.misfired && impactT > 0;
      impactGroupRef.current.visible = showImpact;
      if (showImpact) {
        impactGroupRef.current.children.forEach((child, idx) => {
          const seed = impactSparkSeeds[idx % impactSparkSeeds.length]!;
          const grav = projectile.kind === "grenade" ? 3.2 : 2.4;
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
            : isMissedShot
              ? 0.95
              : bloodSeverity === 3
                ? 2.35
                : bloodSeverity === 2
                  ? 1.65
                  : 1.15;
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
            : isMissedShot
              ? 0.38
              : 0.45 + bloodSeverity * 0.22;
        const cScale =
          0.22 + Math.sin(Math.min(1, impactT * 1.35) * Math.PI) * coreMax;
        impactCoreRef.current.scale.setScalar(Math.max(0.05, cScale));
        const mat = impactCoreRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - impactT * 1.15) * 0.88);
      }
    }

    // 4. Wound-Severity Blood Particle System (Arterial/Venous Droplets, Fine Mist & Floor Spatter)
    if (bloodDropletsRef.current) {
      const showBlood = bloodSeverity > 0 && impactT > 0;
      bloodDropletsRef.current.visible = showBlood;
      if (showBlood) {
        const severityScale =
          bloodSeverity === 3 ? 1.55 : bloodSeverity === 2 ? 1.2 : 0.92;
        bloodDropletsRef.current.children.forEach((child, idx) => {
          const seed = bloodDropletSeeds[idx % bloodDropletSeeds.length]!;
          // 70% exit-wound forward cone along bullet vector, 30% entry-wound back-spatter
          const coneDir = idx % 3 === 0 ? -0.55 : 1.35;
          const bx =
            (coords.dirNorm.x * coneDir * (0.65 + seed.phase) +
              seed.vx * 0.55) *
            impactT;
          const bz =
            (coords.dirNorm.z * coneDir * (0.65 + seed.phase) +
              seed.vz * 0.55) *
            impactT;
          const rawBy =
            seed.vy * 0.62 * impactT - 0.5 * 4.2 * impactT * impactT;
          const by = Math.max(coords.floorLocalY, rawBy);

          child.position.set(bx, by, bz);

          // Stretch droplets along motion vector in air; flatten into floor spatter once landed
          const landed = rawBy <= coords.floorLocalY + 0.02;
          const baseScale = Math.max(
            0.001,
            seed.scale * severityScale * (1.35 - impactT * 0.55),
          );
          if (landed) {
            child.scale.set(baseScale * 1.85, baseScale * 0.25, baseScale * 1.85);
            child.rotation.set(0, idx, 0);
          } else {
            child.scale.set(baseScale * 0.85, baseScale * 1.65, baseScale * 0.85);
            child.rotation.set(impactT * 5 + idx, idx, impactT * 3);
          }
        });
      }
    }

    if (bloodMistRef.current) {
      const showMist = bloodSeverity > 0 && impactT > 0;
      bloodMistRef.current.visible = showMist;
      if (showMist) {
        bloodMistRef.current.children.forEach((child, idx) => {
          const seed = bloodMistSeeds[idx % bloodMistSeeds.length]!;
          child.position.set(
            coords.dirNorm.x * impactT * 0.55 + seed.vx * impactT * 0.42,
            seed.vy * impactT * 0.28 - 0.15 * impactT,
            coords.dirNorm.z * impactT * 0.55 + seed.vz * impactT * 0.42,
          );
          const mistScale =
            (0.22 + impactT * (0.48 + bloodSeverity * 0.22)) *
            (1 - impactT * 0.15);
          child.scale.setScalar(mistScale);
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(
            0,
            (1 - impactT * 1.05) * (0.28 + bloodSeverity * 0.11),
          );
        });
      }
    }

    if (bloodPuddleGroupRef.current) {
      const showPuddle = bloodSeverity > 0 && impactT > 0.14;
      bloodPuddleGroupRef.current.visible = showPuddle;
      if (showPuddle) {
        const puddleT = THREE.MathUtils.clamp((impactT - 0.14) / 0.86, 0, 1);
        const maxPoolScale =
          bloodSeverity === 3 ? 1.35 : bloodSeverity === 2 ? 0.92 : 0.55;
        bloodPuddleGroupRef.current.children.forEach((child, idx) => {
          const grow = Math.sin(Math.min(1, puddleT * 1.3) * (Math.PI / 2));
          const s = maxPoolScale * grow * (idx === 0 ? 1 : 0.45 + (idx % 3) * 0.15);
          child.scale.set(s, s, 1);
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, (1 - puddleT * 0.35) * 0.78);
        });
      }
    }

    if (armorSparksRef.current) {
      const showArmorSparks = hasArmorImpact && impactT > 0;
      armorSparksRef.current.visible = showArmorSparks;
      if (showArmorSparks) {
        armorSparksRef.current.children.forEach((child, idx) => {
          const seed = armorSparkSeeds[idx % armorSparkSeeds.length]!;
          child.position.set(
            -coords.dirNorm.x * impactT * 0.45 + seed.vx * impactT * 0.85,
            seed.vy * impactT * 0.8 - 1.8 * impactT * impactT,
            -coords.dirNorm.z * impactT * 0.45 + seed.vz * impactT * 0.85,
          );
          child.rotation.set(impactT * 10, impactT * 8, idx);
          const s = Math.max(0.001, seed.scale * 1.35 * (1.2 - impactT));
          child.scale.setScalar(s);
        });
      }
    }

    // 5. Missed Shot Obstacle Impact VFX (Tumbling Stone/Stucco/Timber Chunks, Dust Plume & Ricocheting Bullet)
    if (obstacleDebrisRef.current) {
      const showDebris = isMissedShot && impactT > 0;
      obstacleDebrisRef.current.visible = showDebris;
      if (showDebris) {
        obstacleDebrisRef.current.children.forEach((child, idx) => {
          const seed = obstacleDebrisSeeds[idx % obstacleDebrisSeeds.length]!;
          // Fragments rebound off the struck obstacle face back toward shooter & outward
          const bounceBack = -0.65 - (idx % 4) * 0.22;
          const dx =
            (coords.dirNorm.x * bounceBack + seed.vx * 0.72) * impactT;
          const dz =
            (coords.dirNorm.z * bounceBack + seed.vz * 0.72) * impactT;
          const rawDy =
            seed.vy * 0.85 * impactT - 0.5 * 4.8 * impactT * impactT;
          // Bounce once off the ground plane
          const dy =
            rawDy < coords.floorLocalY
              ? coords.floorLocalY +
                Math.abs(rawDy - coords.floorLocalY) * 0.28 * (1 - impactT)
              : rawDy;

          child.position.set(dx, dy, dz);
          child.rotation.set(
            impactT * 11 + idx,
            impactT * 9 + idx * 0.5,
            impactT * 7,
          );
          const chunkScale = Math.max(
            0.001,
            seed.scale * 1.65 * (1.25 - impactT * 0.65),
          );
          child.scale.set(
            chunkScale * 1.35,
            chunkScale * 0.85,
            chunkScale * 1.05,
          );
        });
      }
    }

    if (obstacleDustRef.current) {
      const showDust = isMissedShot && impactT > 0;
      obstacleDustRef.current.visible = showDust;
      if (showDust) {
        obstacleDustRef.current.children.forEach((child, idx) => {
          const seed = obstacleDustSeeds[idx % obstacleDustSeeds.length]!;
          child.position.set(
            -coords.dirNorm.x * impactT * 0.48 + seed.vx * impactT * 0.62,
            0.08 + impactT * 0.75 + seed.vy * impactT * 0.32,
            -coords.dirNorm.z * impactT * 0.48 + seed.vz * impactT * 0.62,
          );
          const dustScale = (0.24 + impactT * 0.88) * (1 - impactT * 0.15);
          child.scale.set(dustScale * 1.15, dustScale * 0.9, dustScale * 1.15);
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, (1 - impactT * 0.95) * 0.58);
        });
      }
    }

    if (ricochetBallRef.current) {
      const showRicochet = isMissedShot && impactT > 0 && impactT < 0.75;
      ricochetBallRef.current.visible = showRicochet;
      if (showRicochet) {
        const rt = impactT / 0.75;
        const ricochetDirX =
          coords.dirNorm.x * 0.35 + coords.rightNorm.x * coords.missSide * 0.92;
        const ricochetDirZ =
          coords.dirNorm.z * 0.35 + coords.rightNorm.z * coords.missSide * 0.92;
        ricochetBallRef.current.position.set(
          ricochetDirX * rt * 3.4,
          1.45 * rt - 1.9 * rt * rt,
          ricochetDirZ * rt * 3.4,
        );
      }
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

  const obstaclePalette = useMemo(
    () => getObstacleDebrisPalette(projectile.impactObstacle),
    [projectile.impactObstacle],
  );

  const impactColor =
    projectile.kind === "grenade"
      ? "#f97316"
      : isMissedShot
        ? obstaclePalette.ringColor
        : projectile.critical
          ? "#dc2626"
          : "#b91c1c";

  const bloodColors = ["#dc2626", "#991b1b", "#7f1d1d", "#b91c1c"] as const;

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

      {/* 3. Target Impact Burst / Blood Wound Spray / Obstacle Debris & Ricochet */}
      <group position={coords.end}>
        {/* Core Flash / Wound Shock Sphere */}
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
                color={isMissedShot ? obstaclePalette.dustColor : "#cbd5e1"}
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>

        {/* Base Sparks (Grenade Embers / Flint Ricochet Sparks / Kinetic Hit Sparks) */}
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
                    : isMissedShot
                      ? i % 2 === 0
                        ? "#fef08a"
                        : "#fb923c"
                      : i % 2 === 0
                        ? "#dc2626"
                        : "#fbbf24"
                }
              />
            </mesh>
          ))}
        </group>

        {/* 4A. Wound-Severity Blood Droplets (Light / Medium / Heavy-Critical Arterial Spray) */}
        {bloodDropletSeeds.length > 0 && (
          <group ref={bloodDropletsRef} visible={false}>
            {bloodDropletSeeds.map((_, i) => (
              <mesh key={i}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshBasicMaterial
                  color={bloodColors[i % bloodColors.length]}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* 4B. Fine Blood Aerosol Mist Clouds */}
        {bloodMistSeeds.length > 0 && (
          <group ref={bloodMistRef} visible={false}>
            {bloodMistSeeds.map((_, i) => (
              <mesh key={i}>
                <dodecahedronGeometry args={[0.36, 1]} />
                <meshBasicMaterial
                  color={i % 2 === 0 ? "#991b1b" : "#dc2626"}
                  transparent
                  opacity={0.38}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* 4C. Ground Blood Spatter & Puddle at Target's Feet */}
        {bloodSeverity > 0 && (
          <group
            ref={bloodPuddleGroupRef}
            position={[0, coords.floorLocalY, 0]}
            visible={false}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.42, 16]} />
              <meshBasicMaterial
                color="#7f1d1d"
                transparent
                opacity={0.78}
                depthWrite={false}
              />
            </mesh>
            <mesh
              position={[0.26, 0.002, 0.18]}
              rotation={[-Math.PI / 2, 0, 0.5]}
            >
              <circleGeometry args={[0.22, 12]} />
              <meshBasicMaterial
                color="#991b1b"
                transparent
                opacity={0.72}
                depthWrite={false}
              />
            </mesh>
            <mesh
              position={[-0.24, 0.002, -0.2]}
              rotation={[-Math.PI / 2, 0, 1.2]}
            >
              <circleGeometry args={[0.18, 10]} />
              <meshBasicMaterial
                color="#dc2626"
                transparent
                opacity={0.68}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}

        {/* 4D. Cuirass / Steel Armor Shred Shards */}
        {armorSparkSeeds.length > 0 && (
          <group ref={armorSparksRef} visible={false}>
            {armorSparkSeeds.map((_, i) => (
              <mesh key={i}>
                <boxGeometry args={[1.2, 0.35, 0.7]} />
                <meshBasicMaterial
                  color={
                    i % 3 === 0
                      ? "#f8fafc"
                      : i % 3 === 1
                        ? "#fde047"
                        : "#94a3b8"
                  }
                />
              </mesh>
            ))}
          </group>
        )}

        {/* 5A. Missed Shot Obstacle Fragments (Sandstone Masonry / Stucco Plaster / Walnut Splinters) */}
        {obstacleDebrisSeeds.length > 0 && (
          <group ref={obstacleDebrisRef} visible={false}>
            {obstacleDebrisSeeds.map((_, i) => (
              <mesh key={i}>
                {projectile.impactObstacle === "palace_wood" ? (
                  <boxGeometry args={[1.8, 0.38, 0.42]} />
                ) : (
                  <dodecahedronGeometry args={[0.85, 0]} />
                )}
                <meshBasicMaterial
                  color={
                    obstaclePalette.chunkColors[
                      i % obstaclePalette.chunkColors.length
                    ]
                  }
                />
              </mesh>
            ))}
          </group>
        )}

        {/* 5B. Missed Shot Volumetric Mortar/Stone Dust Plume */}
        {obstacleDustSeeds.length > 0 && (
          <group ref={obstacleDustRef} visible={false}>
            {obstacleDustSeeds.map((_, i) => (
              <mesh key={i}>
                <dodecahedronGeometry args={[0.42, 1]} />
                <meshBasicMaterial
                  color={obstaclePalette.dustColor}
                  transparent
                  opacity={0.55}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* 5C. Deflected Ricocheting Lead Musket Ball */}
        {isMissedShot && (
          <mesh ref={ricochetBallRef} visible={false}>
            <sphereGeometry args={[0.085, 8, 8]} />
            <meshBasicMaterial color="#e2e8f0" />
          </mesh>
        )}
      </group>

      {/* 6. Secondary Powder Keg Detonation Fireballs */}
      {(projectile.detonatedKegs ?? []).map((kegCoord, idx) => (
        <KegExplosionVFX
          key={`keg-blast-${idx}-${kegCoord.x}-${kegCoord.z}`}
          coord={kegCoord}
          durationMs={projectile.durationMs ?? 1780}
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
  const visibleMeleeTargets = useGameStore((s) => s.visibleMeleeTargets);
  const units = useGameStore((s) => s.units);
  const activeProjectile = useGameStore((s) => s.activeProjectile);

  const sightlineData = useMemo(() => {
    if (
      (actionMode !== "shoot" && actionMode !== "melee") ||
      !selectedUnitId ||
      !selectedTargetId
    ) {
      return null;
    }
    const attacker = units.find((u) => u.id === selectedUnitId && u.alive);
    if (!attacker) return null;

    if (actionMode === "melee") {
      const meleeEval = visibleMeleeTargets.find(
        (t) => t.targetId === selectedTargetId,
      );
      if (!meleeEval) return null;
      const [ax, ay, az] = gridToWorld(attacker.pos);
      const [tx, ty, tz] = gridToWorld(meleeEval.targetPos);
      return {
        points: [
          [ax, ay + 1.08, az] as [number, number, number],
          [tx, ty + 1.08, tz] as [number, number, number],
        ],
        rayCells: [],
        isFlanked: true,
        hitChance: meleeEval.calculation.hitChance,
        color: "#f59e0b",
      };
    }

    const targetEval = visibleTargets.find(
      (t) => t.targetId === selectedTargetId,
    );
    if (!targetEval) return null;

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
  }, [
    actionMode,
    selectedUnitId,
    selectedTargetId,
    visibleTargets,
    visibleMeleeTargets,
    units,
  ]);

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
