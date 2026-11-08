/**
 * 2D Billboard Sprite Renderer (/src/components/canvas/UnitVisual2D.tsx).
 * Uses <Billboard> from @react-three/drei with <mesh castShadow receiveShadow>,
 * alphaTest={0.5}, and a custom RGBADepthPacking depth material so 2D sprites
 * cast real 3D silhouette shadows onto the multi-floor battlefield.
 * Shares GPU texture and depth material caches across all units to avoid VRAM leaks.
 */

import { Billboard } from "@react-three/drei";
import { useMemo } from "react";
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
  const texture = useMemo(
    () => getSharedSpriteTexture(archetype),
    [archetype],
  );

  const depthMaterial = useMemo(
    () => getSharedDepthMaterial(archetype),
    [archetype],
  );

  const emissiveColor =
    hitFlashIntensity > 0.05
      ? "#ef4444"
      : faction === "player"
        ? "#2a1810"
        : "#101b2e";

  return (
    // lockX={true} and lockZ={true} keep the miniature figurine standing vertically upright on the floor
    // while turning horizontally (yaw) toward the camera, producing authentic grounded 3D shadows.
    <Billboard follow={true} lockX={true} lockY={false} lockZ={true}>
      <mesh
        position={[0, 0.92, 0]}
        castShadow
        receiveShadow
        customDepthMaterial={depthMaterial}
      >
        <planeGeometry args={[1.45, 1.82]} />
        <meshStandardMaterial
          map={texture}
          transparent
          opacity={opacity}
          alphaTest={0.5}
          roughness={0.55}
          metalness={0.1}
          emissive={emissiveColor}
          emissiveIntensity={
            hitFlashIntensity > 0.05 ? hitFlashIntensity * 1.8 : 0.18
          }
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}
