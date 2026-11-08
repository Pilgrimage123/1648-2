/**
 * 2D Billboard Sprite Renderer (/src/components/canvas/UnitVisual2D.tsx).
 * Uses <Billboard> from @react-three/drei with <mesh castShadow receiveShadow>,
 * alphaTest={0.5}, and a custom RGBADepthPacking depth material so 2D sprites
 * cast real 3D silhouette shadows onto the multi-floor battlefield.
 */

import { Billboard } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Faction, UnitArchetype } from "../../core/types";
import { getProceduralSpriteDataUri } from "../../utils/proceduralSprites";

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
  const texture = useMemo(() => {
    const uri = getProceduralSpriteDataUri(archetype);
    const loader = new THREE.TextureLoader();
    const tex = loader.load(uri);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [archetype]);

  const depthMaterial = useMemo(() => {
    return new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: texture,
      alphaTest: 0.5,
    });
  }, [texture]);

  useEffect(() => {
    return () => {
      depthMaterial.dispose();
    };
  }, [depthMaterial]);

  const emissiveColor =
    hitFlashIntensity > 0.05
      ? "#ef4444"
      : faction === "player"
        ? "#2a1810"
        : "#101b2e";

  return (
    <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
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
          emissiveIntensity={hitFlashIntensity > 0.05 ? hitFlashIntensity * 1.8 : 0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}
