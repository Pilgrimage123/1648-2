/**
 * Top-Level R3F Tactical 3D Scene (/src/components/canvas/TacticalScene.tsx).
 * Baroque chiaroscuro (ADR-0007, ADR-0015): a cool low moon, and warm light
 * only from a visible flame — candelabra, torches, the skiff lantern, a
 * matchcord, or a muzzle flash.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getMission1EscapeTile } from "../../core/GridSystem";
import type { WeatherType } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { CombatAtmosphereField } from "./CombatAtmosphereField";
import { CombatLines3D } from "./CombatLines3D";
import {
  evaluateFixture,
  evaluateLantern,
  fixturesForScenario,
  isFixtureDucked,
  matchcordCandidates,
  MAX_CANDELABRA_SLOTS,
  MAX_MATCHCORD_SLOTS,
  MAX_TORCH_SLOTS,
  selectSteadySlots,
  type PracticalSample,
} from "./diegeticLights";
import { BridgeTowerDressing } from "./BridgeTowerDressing";
import { InstancedBattlefield } from "./InstancedBattlefield";
import { RainParticles } from "./RainParticles";
import { TacticalCamera } from "./TacticalCamera";
import { UnitActor } from "./UnitActor";
import { continuousGridToWorld, gridToWorld } from "./worldCoords";

function assignSlot(
  light: THREE.PointLight | null,
  sample: PracticalSample | undefined,
  t: number,
  weather: WeatherType,
) {
  if (!light) return;
  if (!sample || sample.intensity <= 0.01) {
    light.visible = false;
    return;
  }
  const speed =
    sample.kind === "candelabrum" ? 4.2 : sample.kind === "matchcord" ? 11 : 8.4;
  const amp =
    sample.kind === "matchcord" && weather === "rain" && sample.exposed
      ? 0.42
      : sample.exposed && weather === "rain"
        ? 0.26
        : sample.kind === "candelabrum"
          ? 0.07
          : 0.13;
  const phase = sample.position.x * 0.7 + sample.position.z;
  const wave = Math.sin(t * speed + phase);
  light.visible = true;
  light.color.set(sample.color);
  light.intensity = sample.intensity * (1 + wave * amp);
  light.distance = sample.radius;
  light.position.set(sample.position.x, sample.position.y, sample.position.z);
}

function DiegeticLightingRig({ weather }: { weather: WeatherType }) {
  const candleRefs = useRef<(THREE.PointLight | null)[]>([]);
  const torchRefs = useRef<(THREE.PointLight | null)[]>([]);
  const cordRefs = useRef<(THREE.PointLight | null)[]>([]);
  const beamCourtRef = useRef<THREE.Mesh>(null);
  const beamGardenRef = useRef<THREE.Mesh>(null);

  const grid = useGameStore((s) => s.grid);
  const units = useGameStore((s) => s.units);
  const scenario = useGameStore((s) => s.scenario);
  const blastZones = useGameStore((s) => s.blastZones);
  const lightFlashes = useGameStore((s) => s.lightFlashes);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);

  const courtBeam = useMemo(() => continuousGridToWorld(11.5, 0, 19), []);
  const gardenBeam = useMemo(() => continuousGridToWorld(11, 0, 8), []);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const now = performance.now();
    const escape = getMission1EscapeTile(grid);
    const damageAt = (coord: { x: number; y: 0 | 1 | 2; z: number }) =>
      grid.getTile(coord)?.damageLevel ?? 0;
    const duckedAt = (coord: { x: number; y: 0 | 1 | 2; z: number }) =>
      isFixtureDucked(coord, now, lightFlashes, blastZones);

    const fixtures = fixturesForScenario(scenario).map((fixture) =>
      evaluateFixture(
        fixture,
        weather,
        damageAt(fixture.coord),
        duckedAt(fixture.coord),
      ),
    );
    const lantern = evaluateLantern(
      escape ? escape.coord : null,
      weather,
      escape ? damageAt(escape.coord) : 0,
      escape ? duckedAt(escape.coord) : false,
    );
    const cords = matchcordCandidates(
      units,
      fogOfWarEnabled,
      fogSnapshot.visibleEnemyIds,
      fogSnapshot.soundContacts,
    );
    const slots = selectSteadySlots(
      [...fixtures, lantern],
      cords,
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      activeFloor,
      weather,
    );
    const candles = slots.filter((slot) => slot.kind === "candelabrum");
    const torches = slots.filter(
      (slot) => slot.kind === "torch" || slot.kind === "lantern",
    );
    const matchcords = slots.filter((slot) => slot.kind === "matchcord");

    for (let i = 0; i < MAX_CANDELABRA_SLOTS; i++) {
      assignSlot(candleRefs.current[i] ?? null, candles[i], t, weather);
    }
    for (let i = 0; i < MAX_TORCH_SLOTS; i++) {
      assignSlot(torchRefs.current[i] ?? null, torches[i], t, weather);
    }
    for (let i = 0; i < MAX_MATCHCORD_SLOTS; i++) {
      assignSlot(cordRefs.current[i] ?? null, matchcords[i], t, weather);
    }

    const shaftOpacity =
      weather === "fog" ? 0 : weather === "rain" ? 0.016 : 0.042;
    if (beamCourtRef.current) {
      beamCourtRef.current.visible = scenario !== "mission2" && shaftOpacity > 0;
      (beamCourtRef.current.material as THREE.MeshBasicMaterial).opacity =
        shaftOpacity + Math.sin(t * 1.3) * 0.006;
    }
    if (beamGardenRef.current) {
      beamGardenRef.current.visible = scenario !== "mission2" && shaftOpacity > 0;
      (beamGardenRef.current.material as THREE.MeshBasicMaterial).opacity =
        shaftOpacity * 0.85 + Math.cos(t * 1.1) * 0.005;
    }
  });

  const moon =
    weather === "fog" ? 0.42 : weather === "rain" ? 0.7 : 0.92;

  return (
    <group>
      <ambientLight
        intensity={weather === "fog" ? 0.18 : 0.26}
        color="#64748b"
      />
      <hemisphereLight
        color="#9db4c8"
        groundColor="#1c140f"
        intensity={0.38}
      />

      {/* Cool night moon. The bedroom is lit by its candelabra, not by this. */}
      <directionalLight
        position={[14, 28, 13]}
        intensity={moon}
        color="#9db4c8"
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

      {Array.from({ length: MAX_CANDELABRA_SLOTS }, (_, i) => (
        <pointLight
          key={`candle-slot-${i}`}
          ref={(el) => {
            candleRefs.current[i] = el;
          }}
          color="#fde68a"
          decay={2}
          intensity={0}
          visible={false}
        />
      ))}
      {Array.from({ length: MAX_TORCH_SLOTS }, (_, i) => (
        <pointLight
          key={`torch-slot-${i}`}
          ref={(el) => {
            torchRefs.current[i] = el;
          }}
          color="#f97316"
          decay={2}
          intensity={0}
          visible={false}
        />
      ))}
      {Array.from({ length: MAX_MATCHCORD_SLOTS }, (_, i) => (
        <pointLight
          key={`cord-slot-${i}`}
          ref={(el) => {
            cordRefs.current[i] = el;
          }}
          color="#ea580c"
          decay={2}
          intensity={0}
          visible={false}
        />
      ))}

      {/* Shafts only over the open courtyard well and the garden sky. */}
      <mesh
        ref={beamCourtRef}
        position={[courtBeam[0], 7.2, courtBeam[2]]}
        rotation={[0.08, 0, -0.12]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.9, 3.4, 12, 18, 1, true]} />
        <meshBasicMaterial
          color="#fde68a"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={beamGardenRef}
        position={[gardenBeam[0], 7.4, gardenBeam[2]]}
        rotation={[0.12, 0, -0.18]}
        raycast={() => null}
      >
        <cylinderGeometry args={[1.1, 4.2, 13, 18, 1, true]} />
        <meshBasicMaterial
          color="#e7eef6"
          transparent
          opacity={0.034}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

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
        const origin = b.world ?? { x: wx, y: wy + 0.6, z: wz };
        flash1Ref.current.position.set(origin.x, origin.y, origin.z);
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
        const origin = b.world ?? { x: wx, y: wy + 0.6, z: wz };
        flash2Ref.current.position.set(origin.x, origin.y, origin.z);
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
        const origin = m.world ?? { x: wx, y: wy + 1.05, z: wz };
        muzzleRef.current.position.set(origin.x, origin.y, origin.z);
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

        <DiegeticLightingRig weather={weather} />
        <DynamicLightFlashPool />

        {/* Sjednocené částicové pole černoprachového dýmu, omítkového prachu a jisker (ADR-0011) */}
        <CombatAtmosphereField />

        {/* Atmospheric 3D Rain, Drifting Ash & Rising Torch Embers */}
        <RainParticles />

        <TacticalCamera />
        <InstancedBattlefield />
        <BridgeTowerDressing />
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
