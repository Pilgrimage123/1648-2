/**
 * Visible flames for the diegetic census. The point lights in TacticalScene
 * sit on these meshes. A scorched tile (damageLevel 2) snuffs the flame.
 * Piano Nobile candelabra hide when that floor is cut away.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { GridCoord } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import {
  evaluateFixture,
  fixturesForScenario,
  isFixtureDucked,
  type FixtureState,
} from "./diegeticLights";

function FlameCone({
  position,
  color,
  lit,
  phase,
  coord,
}: {
  position: [number, number, number];
  color: string;
  lit: boolean;
  phase: number;
  coord: GridCoord;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!lit) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const { lightFlashes, blastZones } = useGameStore.getState();
    const ducked = isFixtureDucked(
      coord,
      performance.now(),
      lightFlashes,
      blastZones,
    );
    const t = clock.getElapsedTime();
    const flicker =
      (ducked ? 0.45 : 0.86) +
      Math.sin(t * 11 + phase) * 0.14 +
      Math.cos(t * 17 + phase) * 0.06;
    mesh.scale.set(flicker, flicker * 1.15, flicker);
  });
  return (
    <mesh ref={ref} position={position} visible={lit}>
      <coneGeometry args={[0.045, 0.16, 7]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={lit ? 2.4 : 0}
      />
    </mesh>
  );
}

function WallSconce({ state }: { state: FixtureState }) {
  const { position, snuffed } = state;
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI * 0.5]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.28, 6]} />
        <meshStandardMaterial color="#d4a73f" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.022, 0.12, 6]} />
        <meshStandardMaterial color="#f3e6c8" roughness={0.55} />
      </mesh>
      <FlameCone
        position={[0, 0.02, 0]}
        color="#fde68a"
        lit={!snuffed}
        phase={position.x}
        coord={state.coord}
      />
    </group>
  );
}

function Candelabrum({ state }: { state: FixtureState }) {
  const { position, snuffed } = state;
  const lit = !snuffed;
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh position={[0, -0.72, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.06, 8]} />
        <meshStandardMaterial color="#8a6a32" metalness={0.72} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.38, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.62, 7]} />
        <meshStandardMaterial color="#d4a73f" metalness={0.8} roughness={0.28} />
      </mesh>
      {[0, 2.1, 4.2].map((angle, i) => {
        const arm = 0.16;
        const x = Math.cos(angle) * arm;
        const z = Math.sin(angle) * arm;
        return (
          <group key={angle} position={[x, 0, z]}>
            <mesh position={[0, -0.06, 0]}>
              <cylinderGeometry args={[0.02, 0.022, 0.14, 6]} />
              <meshStandardMaterial color="#f3e6c8" roughness={0.55} />
            </mesh>
            <FlameCone
              position={[0, 0.06, 0]}
              color="#fde68a"
              lit={lit}
              phase={i * 1.4 + position.x}
              coord={state.coord}
            />
          </group>
        );
      })}
    </group>
  );
}

function TorchCresset({ state }: { state: FixtureState }) {
  const { position, snuffed } = state;
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh position={[0, -0.22, 0]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.02, 0.36, 6]} />
        <meshStandardMaterial color="#1c1917" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.04, 0.04]}>
        <cylinderGeometry args={[0.05, 0.045, 0.08, 7]} />
        <meshStandardMaterial color="#292524" metalness={0.55} roughness={0.5} />
      </mesh>
      <FlameCone
        position={[0, 0.08, 0.04]}
        color="#f97316"
        lit={!snuffed}
        phase={position.z}
        coord={state.coord}
      />
    </group>
  );
}

export function PracticalFlames() {
  const grid = useGameStore((s) => s.grid);
  const weather = useGameStore((s) => s.weather);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const scenario = useGameStore((s) => s.scenario);
  const states: FixtureState[] = fixturesForScenario(scenario).map((fixture) =>
    evaluateFixture(
      fixture,
      weather,
      grid.getTile(fixture.coord)?.damageLevel ?? 0,
      false,
    ),
  );

  return (
    <group>
      {states.map((state) => {
        if (state.coord.y > activeFloor) return null;
        if (state.id.startsWith("sconce")) {
          return <WallSconce key={state.id} state={state} />;
        }
        if (state.kind === "candelabrum") {
          return <Candelabrum key={state.id} state={state} />;
        }
        return <TorchCresset key={state.id} state={state} />;
      })}
    </group>
  );
}
