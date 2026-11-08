/**
 * 3D Model Renderer (/src/components/canvas/UnitVisual3D.tsx).
 * Drop-in companion to UnitVisual2D ready for useGLTF (.glb) assets, currently
 * rendering an articulated composite 3D soldier rig (legs, torso/cuirass, head,
 * headgear, and weapon) that can be hot-swapped at runtime via `renderMode`.
 */

import type { CardinalDir, Faction, UnitArchetype } from "../../core/types";

interface UnitVisual3DProps {
  archetype: UnitArchetype;
  faction: Faction;
  facing: CardinalDir;
  hitFlashIntensity: number;
  opacity?: number;
}

const FACING_ROTATION_Y: Record<CardinalDir, number> = {
  S: 0,
  E: Math.PI * 0.5,
  N: Math.PI,
  W: -Math.PI * 0.5,
};

export function UnitVisual3D({
  archetype,
  faction,
  facing,
  hitFlashIntensity,
  opacity = 1,
}: UnitVisual3DProps) {
  const isPlayer = faction === "player";
  const coatColor =
    hitFlashIntensity > 0.05
      ? "#ef4444"
      : isPlayer
        ? archetype === "sniper"
          ? "#263849"
          : "#8c2332"
        : archetype === "sectoid"
          ? "#1e293b"
          : "#1d4ed8";

  const accentColor = isPlayer ? "#eab308" : "#facc15";
  const steelColor = hitFlashIntensity > 0.05 ? "#fca5a5" : "#94a3b8";
  const transparent = opacity < 0.99;

  return (
    <group rotation={[0, FACING_ROTATION_Y[facing], 0]}>
      {/* Left & Right Boots */}
      <mesh position={[-0.16, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.48, 0.22]} />
        <meshStandardMaterial
          color="#1e1b18"
          roughness={0.7}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0.16, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.48, 0.22]} />
        <meshStandardMaterial
          color="#1e1b18"
          roughness={0.7}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Coat / Torso */}
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.34, 0.68, 12]} />
        <meshStandardMaterial
          color={coatColor}
          roughness={0.5}
          metalness={0.15}
          emissive={hitFlashIntensity > 0.05 ? "#ef4444" : "#000000"}
          emissiveIntensity={hitFlashIntensity * 1.5}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Steel Breastplate / Cuirass */}
      {(archetype === "ranger" || archetype === "sectoid") && (
        <mesh position={[0, 0.84, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.44, 0.28]} />
          <meshStandardMaterial
            color={steelColor}
            roughness={0.3}
            metalness={0.75}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
      )}

      {/* Sash / Cross Belt */}
      <mesh position={[0, 0.82, 0.16]} rotation={[0, 0, 0.55]} castShadow>
        <boxGeometry args={[0.12, 0.56, 0.06]} />
        <meshStandardMaterial
          color={accentColor}
          roughness={0.4}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.28, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.19, 14, 14]} />
        <meshStandardMaterial
          color={hitFlashIntensity > 0.05 ? "#fca5a5" : "#ecc19c"}
          roughness={0.6}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Hat / Helmet */}
      {isPlayer ? (
        // Wide-brimmed Baroque Cavalier Hat + Plume
        <group position={[0, 1.42, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.05, 16]} />
            <meshStandardMaterial
              color="#1c1917"
              roughness={0.8}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.21, 0.18, 14]} />
            <meshStandardMaterial
              color="#292524"
              roughness={0.7}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[-0.16, 0.18, -0.06]} rotation={[0, 0, 0.5]} castShadow>
            <coneGeometry args={[0.07, 0.28, 8]} />
            <meshStandardMaterial
              color={archetype === "sniper" ? "#facc15" : "#dc2626"}
              roughness={0.5}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      ) : (
        // Swedish Morion Helmet / Grenadier Mitre
        <group position={[0, 1.42, 0]}>
          <mesh castShadow receiveShadow>
            <coneGeometry
              args={[0.24, archetype === "sectoid" ? 0.38 : 0.24, 12]}
            />
            <meshStandardMaterial
              color={archetype === "sectoid" ? accentColor : steelColor}
              roughness={0.35}
              metalness={0.65}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      )}

      {/* 3D Musket / Carbine Weapon */}
      <group position={[0.24, 0.84, 0.22]}>
        {/* Wooden Stock */}
        <mesh position={[0, -0.03, -0.12]} castShadow>
          <boxGeometry args={[0.08, 0.11, 0.45]} />
          <meshStandardMaterial
            color="#5c3a21"
            roughness={0.7}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
        {/* Steel Barrel */}
        <mesh
          position={[0, 0.02, 0.36]}
          rotation={[Math.PI * 0.5, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[
              0.03,
              0.035,
              archetype === "sniper" ? 1.15 : 0.85,
              8,
            ]}
          />
          <meshStandardMaterial
            color="#cbd5e1"
            roughness={0.25}
            metalness={0.85}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
      </group>
    </group>
  );
}
