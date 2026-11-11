/**
 * Top-Level R3F Tactical 3D Scene (/src/components/canvas/TacticalScene.tsx).
 * Implements Pillar 1 (Baroque Chiaroscuro / Caravaggio-Rembrandt Lighting) & Pillar 4 (Living Battlefield):
 * - Strong contrast of warm golden-amber light in the playable mid-ground against deep slate shadow at map edges.
 * - Volumetric light shafts (god-rays) piercing through the battlefield smoke.
 * - Real-time flickering torch & altar point lights.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { WeatherType } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { CombatAtmosphereField } from "./CombatAtmosphereField";
import { CombatLines3D } from "./CombatLines3D";
import { InstancedBattlefield } from "./InstancedBattlefield";
import { RainParticles } from "./RainParticles";
import { TacticalCamera } from "./TacticalCamera";
import { UnitActor } from "./UnitActor";
import { gridToWorld } from "./worldCoords";

function ChiaroscuroLightingRig({ weather }: { weather: WeatherType }) {
  const torch1Ref = useRef<THREE.PointLight>(null);
  const torch2Ref = useRef<THREE.PointLight>(null);
  const torch3Ref = useRef<THREE.PointLight>(null);
  const beam1Ref = useRef<THREE.Mesh>(null);
  const beam2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (torch1Ref.current) {
      torch1Ref.current.intensity =
        8.5 + Math.sin(t * 7.3) * 1.4 + Math.cos(t * 13.1) * 0.8;
    }
    if (torch2Ref.current) {
      torch2Ref.current.intensity =
        8.5 + Math.cos(t * 6.7 + 1.2) * 1.5 + Math.sin(t * 15.4) * 0.7;
    }
    if (torch3Ref.current) {
      torch3Ref.current.intensity =
        7.2 + Math.sin(t * 8.9 + 2.4) * 1.3 + Math.cos(t * 11.8) * 0.6;
    }
    if (beam1Ref.current) {
      (beam1Ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.055 + Math.sin(t * 1.4) * 0.015;
    }
    if (beam2Ref.current) {
      (beam2Ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.048 + Math.cos(t * 1.1 + 1.5) * 0.014;
    }
  });

  return (
    <group>
      {/* Controlled low ambient so shadows stay deep and dramatic (Caravaggio Chiaroscuro) */}
      <ambientLight
        intensity={weather === "fog" ? 0.32 : 0.45}
        color="#64748b"
      />
      <hemisphereLight
        color="#93c5fd"
        groundColor="#1c140f"
        intensity={0.68}
      />

      {/* Primary Dramatic Key Light Illuminating the Playable Courtyard Mid-Ground */}
      <directionalLight
        position={[14, 28, 13]}
        intensity={2.65}
        color="#fef3c7"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={2}
        shadow-camera-far={65}
        shadow-bias={-0.0005}
      />

      {/* Flickering Warm Baroque Torch & Brazier Point Lights in Playable Center */}
      <pointLight
        ref={torch1Ref}
        position={[-3.2, 2.5, 0.5]}
        intensity={8.5}
        distance={16}
        color="#f97316"
      />
      <pointLight
        ref={torch2Ref}
        position={[3.4, 4.2, -1.5]}
        intensity={8.5}
        distance={16}
        color="#fbbf24"
      />
      <pointLight
        ref={torch3Ref}
        position={[4.2, 2.1, 7.5]}
        intensity={7.2}
        distance={14}
        color="#ea580c"
      />

      {/* Mystic Golden Relic / Marshal Spotlight in Courtyard South */}
      <pointLight
        position={[2.0, 3.2, 11.5]}
        intensity={5.5}
        distance={12}
        color="#facc15"
      />

      {/* Volumetric Chiaroscuro Light Shafts (Rays of Golden Light Piercing Through Smoke) */}
      <mesh
        ref={beam1Ref}
        position={[0.5, 6.2, 1.5]}
        rotation={[0.18, 0, -0.26]}
        raycast={() => null}
      >
        <cylinderGeometry args={[1.2, 4.8, 14, 18, 1, true]} />
        <meshBasicMaterial
          color="#fde047"
          transparent
          opacity={0.055}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        ref={beam2Ref}
        position={[3.2, 5.8, 7.2]}
        rotation={[0.15, 0, -0.22]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.9, 3.8, 13, 18, 1, true]} />
        <meshBasicMaterial
          color="#fb923c"
          transparent
          opacity={0.048}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer Non-Playable Map Perimeter Shadow Ring (Ground Framing in Deep Shadow) */}
      <mesh
        position={[0, -0.15, 0]}
        rotation={[-Math.PI * 0.5, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[18.5, 52, 36]} />
        <meshBasicMaterial
          color="#05080f"
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Fond dynamických záblesků (Dynamic Light Flash Pool, ADR-0011):
 * Spravuje max 2 explozivní bodová světla a 1 světlo záblesku hlavně s kvadratickým útlumem.
 */
function DynamicLightFlashPool() {
  const lightFlashes = useGameStore((s) => s.lightFlashes);
  const flash1Ref = useRef<THREE.PointLight>(null);
  const flash2Ref = useRef<THREE.PointLight>(null);
  const muzzleRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const now = performance.now();
    const blasts = lightFlashes.filter((f) => f.kind === "blast");
    const muzzles = lightFlashes.filter((f) => f.kind === "muzzle");

    if (flash1Ref.current) {
      const b = blasts[0];
      if (b) {
        const age = now - b.createdAt;
        const p = Math.min(1, Math.max(0, age / b.durationMs));
        const decay = Math.pow(1 - p, 2);
        flash1Ref.current.visible = decay > 0.01;
        flash1Ref.current.intensity = b.intensity * decay;
        flash1Ref.current.distance = b.radius;
        const [wx, wy, wz] = gridToWorld(b.coord);
        flash1Ref.current.position.set(wx, wy + 0.6, wz);
      } else {
        flash1Ref.current.visible = false;
      }
    }

    if (flash2Ref.current) {
      const b = blasts[1];
      if (b) {
        const age = now - b.createdAt;
        const p = Math.min(1, Math.max(0, age / b.durationMs));
        const decay = Math.pow(1 - p, 2);
        flash2Ref.current.visible = decay > 0.01;
        flash2Ref.current.intensity = b.intensity * decay;
        flash2Ref.current.distance = b.radius;
        const [wx, wy, wz] = gridToWorld(b.coord);
        flash2Ref.current.position.set(wx, wy + 0.6, wz);
      } else {
        flash2Ref.current.visible = false;
      }
    }

    if (muzzleRef.current) {
      const m = muzzles[0];
      if (m) {
        const age = now - m.createdAt;
        const p = Math.min(1, Math.max(0, age / m.durationMs));
        const decay = Math.pow(1 - p, 2);
        muzzleRef.current.visible = decay > 0.01;
        muzzleRef.current.intensity = m.intensity * decay;
        muzzleRef.current.distance = m.radius;
        const [wx, wy, wz] = gridToWorld(m.coord);
        muzzleRef.current.position.set(wx, wy + 1.2, wz);
      } else {
        muzzleRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      <pointLight ref={flash1Ref} color="#f97316" decay={2} visible={false} />
      <pointLight ref={flash2Ref} color="#f97316" decay={2} visible={false} />
      <pointLight ref={muzzleRef} color="#fde047" decay={2} visible={false} />
    </group>
  );
}

export function TacticalScene() {
  const units = useGameStore((s) => s.units);
  const weather = useGameStore((s) => s.weather);

  const fogColor = weather === "fog" ? "#161e2b" : "#070b12";
  const fogFar = weather === "fog" ? 44 : 68;

  return (
    <div className="relative w-full h-full bg-slate-950 select-none overflow-hidden">
      <Canvas
        shadows="percentage"
        camera={{ fov: 38, near: 0.5, far: 120, position: [14, 18, 14] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[fogColor]} />
        <fog attach="fog" args={[fogColor, 18, fogFar]} />

        <ChiaroscuroLightingRig weather={weather} />
        <DynamicLightFlashPool />

        {/* Sjednocené částicové pole černoprachového dýmu, omítkového prachu a jisker (ADR-0011) */}
        <CombatAtmosphereField />

        {/* Atmospheric 3D Rain, Drifting Ash & Rising Torch Embers */}
        <RainParticles />

        <TacticalCamera />
        <InstancedBattlefield />
        <CombatLines3D />

        {units.map((unit) => (
          <UnitActor key={unit.id} unit={unit} />
        ))}
      </Canvas>

      {/* Baroque Chiaroscuro Edge Vignette (Darkens non-playable periphery & camera foreground while keeping center vivid) */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 72% 68% at 50% 48%, rgba(7,11,18,0) 52%, rgba(7,11,18,0.48) 80%, rgba(3,5,9,0.82) 100%)",
        }}
      />
    </div>
  );
}
