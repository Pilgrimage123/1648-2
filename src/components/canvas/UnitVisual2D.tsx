/**
 * 2D Billboard Sprite Renderer (/src/components/canvas/UnitVisual2D.tsx).
 * Uses <Billboard> from @react-three/drei with <mesh castShadow receiveShadow>,
 * alphaTest={0.5}, and a custom RGBADepthPacking depth material so 2D sprites
 * cast real 3D silhouette shadows onto the multi-floor battlefield.
 * Includes subtle secondary wind motion (cloak/plume sway) so units breathe during turns.
 */

import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Faction, UnitArchetype } from "../../core/types";
import {
  getSharedDepthMaterial,
  getSharedSpriteTexture,
} from "../../utils/proceduralSprites";

interface UnitVisual2DProps {
  archetype: UnitArchetype;
  faction: Faction;
  hitFlashIntensity: number;
  opacity?: number;
}

export function UnitVisual2D({
  archetype,
  faction,
  hitFlashIntensity,
  opacity = 1,
}: UnitVisual2DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pennantRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(
    () => getSharedSpriteTexture(archetype),
    [archetype],
  );

  const depthMaterial = useMemo(
    () => getSharedDepthMaterial(archetype),
    [archetype],
  );

  // Subtle secondary wind motion on sprite plane & attached 3D cloth ribbon
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      // Gentle wind skew/sway and breathing scale
      meshRef.current.rotation.z = Math.sin(t * 2.2) * 0.022;
      const breath = 1 + Math.sin(t * 3.1) * 0.012;
      meshRef.current.scale.set(1, breath, 1);
    }
    if (pennantRef.current) {
      pennantRef.current.rotation.y = Math.sin(t * 4.8) * 0.28;
      pennantRef.current.rotation.z = Math.cos(t * 3.6) * 0.12;
    }
  });

  const emissiveColor =
    hitFlashIntensity > 0.05
      ? "#ef4444"
      : faction === "player"
        ? "#3b2112"
        : "#122038";

  const ribbonColor =
    faction === "player"
      ? archetype === "sniper"
        ? "#eab308"
        : "#dc2626"
      : "#facc15";

  return (
    // lockX={true} and lockZ={true} keep the miniature figurine standing vertically upright on the floor
    // while turning horizontally (yaw) toward the camera, producing authentic grounded 3D shadows.
    <Billboard follow={true} lockX={true} lockY={false} lockZ={true}>
      <mesh
        ref={meshRef}
        position={[0, 0.94, 0]}
        castShadow
        receiveShadow
        customDepthMaterial={depthMaterial}
      >
        <planeGeometry args={[1.52, 1.88]} />
        <meshStandardMaterial
          map={texture}
          transparent
          opacity={opacity}
          alphaTest={0.5}
          roughness={0.48}
          metalness={0.12}
          emissive={emissiveColor}
          emissiveIntensity={
            hitFlashIntensity > 0.05 ? hitFlashIntensity * 1.8 : 0.22
          }
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Secondary fluttering heraldic sash/streamer in the wind behind unit */}
      <mesh
        ref={pennantRef}
        position={[archetype === "trooper" ? -0.18 : 0.28, archetype === "trooper" ? 1.56 : 1.12, -0.06]}
      >
        <planeGeometry args={[0.34, 0.11]} />
        <meshStandardMaterial
          color={ribbonColor}
          roughness={0.6}
          transparent={opacity < 0.99}
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}
