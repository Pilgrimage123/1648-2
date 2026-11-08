/**
 * Top-Level R3F Tactical 3D Scene (/src/components/canvas/TacticalScene.tsx).
 * Configures shadow-casting lights, fog, TacticalCamera, InstancedBattlefield,
 * UnitActor containers, and 3D Line of Sight visualizers.
 */

import { Canvas } from "@react-three/fiber";
import { useGameStore } from "../../store/useGameStore";
import { CombatLines3D } from "./CombatLines3D";
import { InstancedBattlefield } from "./InstancedBattlefield";
import { TacticalCamera } from "./TacticalCamera";
import { UnitActor } from "./UnitActor";

export function TacticalScene() {
  const units = useGameStore((s) => s.units);

  return (
    <div className="relative w-full h-full bg-slate-950 select-none">
      <Canvas
        shadows
        camera={{ fov: 38, near: 0.5, far: 120, position: [14, 18, 14] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0b111e"]} />
        <fog attach="fog" args={["#0b111e", 26, 62]} />

        {/* High-Contrast Moonlight + Warm Baroque Torch Rim Lighting */}
        <ambientLight intensity={0.55} color="#cbd5e1" />
        <hemisphereLight
          color="#93c5fd"
          groundColor="#332218"
          intensity={0.75}
        />

        <directionalLight
          position={[14, 24, 12]}
          intensity={2.2}
          color="#f8fafc"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-camera-near={2}
          shadow-camera-far={55}
          shadow-bias={-0.0005}
        />

        {/* Warm Torch Point Lights in the Ruined Building Courtyard */}
        <pointLight
          position={[-3.5, 2.2, 0]}
          intensity={6}
          distance={14}
          color="#fb923c"
        />
        <pointLight
          position={[3.5, 4.2, -1.5]}
          intensity={6}
          distance={14}
          color="#f59e0b"
        />

        <TacticalCamera />
        <InstancedBattlefield />
        <CombatLines3D />

        {units.map((unit) => (
          <UnitActor key={unit.id} unit={unit} />
        ))}
      </Canvas>
    </div>
  );
}
