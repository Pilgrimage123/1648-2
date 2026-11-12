/**
 * 3D Model Renderer (/src/components/canvas/UnitVisual3D.tsx).
 * Renders an articulated composite 3D soldier rig (legs, torso/cuirass, cloak, head,
 * properly fitted headgear pulled down over the brow, class-specific silhouette weapons,
 * and wind-animated plumes/banners).
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type {
  CardinalDir,
  Faction,
  FirearmLockType,
  UnitArchetype,
  WeatherType,
} from "../../core/types";
import { FACING_YAW, LOCK_FORWARD_M, LOCK_HEIGHT_M, LOCK_RIGHT_M } from "./diegeticLights";

interface UnitVisual3DProps {
  archetype: UnitArchetype;
  faction: Faction;
  facing: CardinalDir;
  hitFlashIntensity: number;
  opacity?: number;
  lockType?: FirearmLockType;
  weather?: WeatherType;
  roofed?: boolean;
  unitId?: string;
}

export function MatchcordCoal({
  weather = "clear",
  roofed = false,
}: {
  weather?: WeatherType;
  roofed?: boolean;
}) {
  const coalRef = useRef<THREE.Mesh>(null);
  const sparkA = useRef<THREE.Mesh>(null);
  const sparkB = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const outdoorRain = weather === "rain" && !roofed;
    const flicker = outdoorRain
      ? 0.25 + Math.abs(Math.sin(t * 23.0)) * 1.15
      : 0.78 + Math.sin(t * 9.2) * 0.28;
    for (const mesh of [coalRef.current, sparkA.current, sparkB.current]) {
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2.6 * flicker;
    }
    if (sparkA.current) {
      sparkA.current.position.y = 0.05 + Math.abs(Math.sin(t * 14)) * 0.05;
    }
    if (sparkB.current) {
      sparkB.current.visible = !outdoorRain || Math.sin(t * 19) > -0.2;
    }
  });
  return (
    <group position={[LOCK_RIGHT_M, LOCK_HEIGHT_M, LOCK_FORWARD_M]}>
      <mesh ref={coalRef}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#ea580c"
          emissiveIntensity={2.6}
        />
      </mesh>
      <mesh ref={sparkA} position={[0.02, 0.05, 0.02]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial
          color="#fdba74"
          emissive="#f97316"
          emissiveIntensity={3}
        />
      </mesh>
      <mesh ref={sparkB} position={[-0.015, 0.04, 0.03]}>
        <sphereGeometry args={[0.009, 6, 6]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#ea580c"
          emissiveIntensity={2.4}
        />
      </mesh>
    </group>
  );
}

export function UnitVisual3D({
  archetype,
  faction,
  facing,
  hitFlashIntensity,
  opacity = 1,
  lockType,
  weather = "clear",
  roofed = false,
  unitId,
}: UnitVisual3DProps) {
  const cloakRef = useRef<THREE.Mesh>(null);
  const plumeRef = useRef<THREE.Group>(null);
  const bannerRef = useRef<THREE.Group>(null);

  const isPlayer = faction === "player";
  const isPlachy = unitId === "player-plachy";
  const isHavel = unitId === "player-havel";
  const isOndrej = unitId === "player-ondrej";
  const isHarrier = unitId?.startsWith("enemy-harrier") ?? false;
  const isOccultist = unitId === "enemy-occultist";
  const isPistolUser =
    isPlachy ||
    isHavel ||
    isOndrej ||
    isHarrier ||
    isOccultist ||
    (isPlayer && archetype === "commander");
  const coatColor =
    hitFlashIntensity > 0.05
      ? "#ef4444"
      : isPlachy
        ? "#1c1917"
        : isHavel
          ? "#6b3a2a"
          : isHarrier
            ? "#3f3f46"
            : isPlayer
              ? archetype === "commander"
                ? "#f8fafc" // White baroque nightshirt of Marshal Colloredo
                : archetype === "sniper"
                  ? "#1e3a5f" // Clementinum indigo-slate coat
                  : "#b91c1c" // Rich Imperial Crimson Dragoon coat
              : archetype === "sectoid"
                ? "#1e3a8a" // Elite Carolean dark royal blue
                : "#2563eb"; // Vivid Swedish royal blue

  const accentColor =
    archetype === "commander"
      ? "#dc2626" // Order of Malta crimson sash
      : isPlayer
        ? "#eab308" // Imperial Royal Gold
        : "#facc15"; // Swedish Carolean Gold
  const steelColor = hitFlashIntensity > 0.05 ? "#fca5a5" : "#cbd5e1";
  const transparent = opacity < 0.99;

  // Secondary wind animation for cloaks, plumes, and back banners
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (cloakRef.current) {
      cloakRef.current.rotation.x = 0.18 + Math.sin(t * 3.4) * 0.08;
      cloakRef.current.rotation.z = Math.cos(t * 2.6) * 0.05;
    }
    if (plumeRef.current) {
      plumeRef.current.rotation.z = 0.45 + Math.sin(t * 4.5) * 0.14;
    }
    if (bannerRef.current) {
      bannerRef.current.rotation.y = Math.sin(t * 4.2) * 0.24;
    }
  });

  return (
    <group rotation={[0, FACING_YAW[facing], 0]}>
      {/* Left & Right Boots */}
      <mesh position={[-0.16, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.19, 0.48, 0.23]} />
        <meshStandardMaterial
          color="#1c1613"
          roughness={0.7}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0.16, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.19, 0.48, 0.23]} />
        <meshStandardMaterial
          color="#1c1613"
          roughness={0.7}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Billowing Baroque Cloak in the Wind (Ranger, Sniper, Sectoid) */}
      {(archetype === "ranger" ||
        archetype === "sniper" ||
        archetype === "sectoid") && (
        <mesh
          ref={cloakRef}
          position={[0, 0.72, -0.2]}
          rotation={[0.18, 0, 0]}
          castShadow
        >
          <boxGeometry
            args={[
              archetype === "sniper" ? 0.84 : 0.68,
              0.86,
              0.06,
            ]}
          />
          <meshStandardMaterial
            color={
              isHavel
                ? "#6b3a2a"
                : isHarrier
                  ? "#27272a"
                  : archetype === "ranger"
                    ? "#991b1b"
                    : archetype === "sniper"
                      ? "#15253b"
                      : "#172554"
            }
            roughness={0.65}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
      )}

      {/* Coat / Torso */}
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[
            archetype === "ranger" ? 0.3 : 0.26,
            archetype === "sniper" ? 0.38 : 0.34,
            0.68,
            12,
          ]}
        />
        <meshStandardMaterial
          color={coatColor}
          roughness={0.48}
          metalness={0.15}
          emissive={hitFlashIntensity > 0.05 ? "#ef4444" : "#000000"}
          emissiveIntensity={hitFlashIntensity * 1.5}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Steel Breastplate / Cuirass & Broad Pauldrons (Heavy Silhouette for Ranger & Sectoid) */}
      {(archetype === "ranger" || archetype === "sectoid") &&
        !isHavel &&
        !isHarrier && (
        <group>
          <mesh position={[0, 0.84, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.48, 0.44, 0.29]} />
            <meshStandardMaterial
              color={steelColor}
              roughness={0.25}
              metalness={0.8}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* Left & Right Armored Pauldrons */}
          <mesh position={[-0.31, 1.02, 0]} castShadow>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial
              color={steelColor}
              roughness={0.28}
              metalness={0.78}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0.31, 1.02, 0]} castShadow>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial
              color={steelColor}
              roughness={0.28}
              metalness={0.78}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      )}

      {/* Sash / Cross Belt */}
      <mesh position={[0, 0.82, 0.16]} rotation={[0, 0, 0.55]} castShadow>
        <boxGeometry args={[0.13, 0.58, 0.06]} />
        <meshStandardMaterial
          color={archetype === "ranger" ? "#dc2626" : accentColor}
          roughness={0.35}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Head (Centered at y = 1.24, radius = 0.18 -> top of head = 1.42, brow = 1.28) */}
      <mesh position={[0, 1.24, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial
          color={hitFlashIntensity > 0.05 ? "#fca5a5" : "#ecc19c"}
          roughness={0.55}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Hat / Helmet / Hair — Pulled Snugly Down Over the Head & Brow (y = 1.29) */}
      {isPlayer ? (
        archetype === "commander" ? (
          isPlachy ? (
            <>
              <group position={[0, 1.32, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.34, 0.1, 0.34]} />
                  <meshStandardMaterial color="#1c1917" roughness={0.7} />
                </mesh>
              </group>
              <mesh position={[0, 1.05, 0.08]} castShadow>
                <torusGeometry args={[0.13, 0.028, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.3} />
              </mesh>
            </>
          ) : (
          // Marshal Colloredo: Velvet nightcap + silver hair covering top & sides of head
          <group position={[0, 1.28, 0]}>
            {/* Silver Hair locks framing head */}
            <mesh position={[0, -0.02, -0.03]} castShadow receiveShadow>
              <sphereGeometry args={[0.195, 12, 12]} />
              <meshStandardMaterial
                color="#f8fafc"
                roughness={0.85}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
            {/* Crimson Velvet Cap with Gold Trim sitting snugly on crown */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <cylinderGeometry args={[0.17, 0.195, 0.12, 14]} />
              <meshStandardMaterial
                color="#991b1b"
                roughness={0.6}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
          </group>
          )
        ) : (
          // Wide-Brimmed Baroque Cavalier Hat Pulled Down Over the Brow (y = 1.29)
          <group
            position={[0, 1.29, 0]}
            rotation={[0.06, 0, archetype === "sniper" ? -0.08 : 0.05]}
          >
            {/* Wide Brim Sitting Right at Brow Level */}
            <mesh castShadow receiveShadow>
              <cylinderGeometry
                args={[
                  archetype === "sniper" ? 0.44 : 0.41,
                  archetype === "sniper" ? 0.44 : 0.41,
                  0.04,
                  20,
                ]}
              />
              <meshStandardMaterial
                color="#181310"
                roughness={0.75}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
            {/* Hat Crown Enclosing the Upper Skull */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <cylinderGeometry args={[0.185, 0.21, 0.18, 16]} />
              <meshStandardMaterial
                color="#261f1b"
                roughness={0.7}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
            {/* Royal Gold Hatband */}
            <mesh position={[0, 0.025, 0]}>
              <cylinderGeometry args={[0.212, 0.215, 0.04, 16]} />
              <meshStandardMaterial
                color="#facc15"
                roughness={0.35}
                metalness={0.6}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
            {/* Wind-Animated Ostrich Plume */}
            <group ref={plumeRef} position={[-0.18, 0.14, -0.04]} rotation={[0, 0, 0.45]}>
              <mesh castShadow>
                <coneGeometry args={[0.085, 0.34, 8]} />
                <meshStandardMaterial
                  color={archetype === "sniper" ? "#fef08a" : "#ef4444"}
                  roughness={0.45}
                  transparent={transparent}
                  opacity={opacity}
                />
              </mesh>
            </group>
          </group>
        )
      ) : archetype === "sectoid" ? (
        // Tall Grenadier Mitre Cap Pulled Snugly Over Forehead (y = 1.28)
        <group position={[0, 1.28, 0]}>
          {/* Gold Headband Ring Enclosing Brow */}
          <mesh position={[0, 0.01, 0]} castShadow>
            <cylinderGeometry args={[0.205, 0.205, 0.06, 16]} />
            <meshStandardMaterial
              color="#facc15"
              roughness={0.3}
              metalness={0.7}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* Tall Pointed Mitre Cone */}
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.205, 0.42, 14]} />
            <meshStandardMaterial
              color="#1e3a8a"
              roughness={0.45}
              metalness={0.3}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* Brass Front Plate */}
          <mesh position={[0, 0.18, 0.14]} rotation={[-0.32, 0, 0]}>
            <boxGeometry args={[0.18, 0.28, 0.04]} />
            <meshStandardMaterial
              color="#facc15"
              roughness={0.25}
              metalness={0.8}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      ) : isHarrier ? (
        <group position={[0, 1.3, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#3f3f46" roughness={0.8} />
          </mesh>
        </group>
      ) : (
        // Swedish Pappenheimer / Morion Steel Helmet Pulled Snugly Over Forehead (y = 1.28)
        <group position={[0, 1.28, 0]}>
          {/* Curved Steel Brim Around Brow */}
          <mesh position={[0, 0.01, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.035, 16]} />
            <meshStandardMaterial
              color={steelColor}
              roughness={0.3}
              metalness={0.75}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* Steel Skull Dome Enclosing Top of Head */}
          <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.205, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial
              color={steelColor}
              roughness={0.3}
              metalness={0.75}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* High Golden Helmet Comb / Crest */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.04, 0.16, 0.28]} />
            <meshStandardMaterial
              color="#facc15"
              roughness={0.3}
              metalness={0.7}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      )}

      {/* Class-Specific Silhouette Weapons & Banners */}
      {/* 1. Trooper Towering Vertical Pike / Halberd with Fluttering Pennant (Triangle Silhouette) */}
      {archetype === "trooper" && (
        <group position={[-0.26, 0, 0.1]}>
          <mesh position={[0, 1.15, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.028, 2.3, 8]} />
            <meshStandardMaterial
              color="#78350f"
              roughness={0.7}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* Steel Spearhead */}
          <mesh position={[0, 2.38, 0]} castShadow>
            <coneGeometry args={[0.06, 0.26, 6]} />
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.2}
              metalness={0.85}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          {/* Fluttering Swedish Gold/Blue Pennant */}
          <group ref={bannerRef} position={[0.14, 2.05, 0]}>
            <mesh castShadow>
              <planeGeometry args={[0.32, 0.16]} />
              <meshStandardMaterial
                color="#facc15"
                roughness={0.5}
                side={THREE.DoubleSide}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* 2. Sectoid Asymmetric Back Standard & Raised Lit Grenade */}
      {archetype === "sectoid" && (
        <group>
          {/* Back Banner Pole & Fluttering Standard */}
          <group position={[0.2, 1.45, -0.18]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.02, 0.02, 1.1, 6]} />
              <meshStandardMaterial color="#78350f" roughness={0.7} />
            </mesh>
            <group ref={bannerRef} position={[0.18, 0.32, 0]}>
              <mesh castShadow>
                <planeGeometry args={[0.38, 0.46]} />
                <meshStandardMaterial
                  color="#facc15"
                  roughness={0.5}
                  side={THREE.DoubleSide}
                  transparent={transparent}
                  opacity={opacity}
                />
              </mesh>
            </group>
          </group>
          {/* Raised hand: occultist's censer, otherwise the grenade mesh recolored. */}
          <group position={[-0.34, 1.26, 0.16]}>
            <mesh castShadow>
              <sphereGeometry args={[isOccultist ? 0.09 : 0.1, 10, 10]} />
              <meshStandardMaterial
                color={isOccultist ? "#b45309" : "#1e293b"}
                roughness={0.45}
                metalness={0.65}
              />
            </mesh>
            <mesh position={[0, isOccultist ? 0.02 : 0.11, 0]}>
              <sphereGeometry args={[isOccultist ? 0.05 : 0.045, 8, 8]} />
              <meshStandardMaterial
                color="#f97316"
                emissive="#fb923c"
                emissiveIntensity={isOccultist ? 1.4 : 2.2}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* 3. Primary Firearm (Musket / Carbine / Pistol) */}
      <group position={[0.24, 0.84, 0.22]}>
        {/* Wooden Stock */}
        <mesh position={[0, -0.03, -0.12]} castShadow>
          <boxGeometry
            args={[0.08, 0.11, isPistolUser ? 0.24 : 0.45]}
          />
          <meshStandardMaterial
            color="#5c3a21"
            roughness={0.7}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
        {/* Steel Barrel */}
        <mesh
          position={[0, 0.02, isPistolUser ? 0.15 : 0.38]}
          rotation={[Math.PI * 0.5, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[
              0.03,
              0.035,
              isPistolUser
                ? 0.38
                : archetype === "sniper"
                  ? 1.28
                  : 0.85,
              8,
            ]}
          />
          <meshStandardMaterial
            color="#e2e8f0"
            roughness={0.22}
            metalness={0.85}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
        {archetype === "sniper" && !isOndrej && (
          <group>
            <mesh position={[0, -0.42, 0.55]} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.84, 6]} />
              <meshStandardMaterial color="#78350f" roughness={0.7} />
            </mesh>
          </group>
        )}
      </group>

      {lockType === "matchlock" && (
        <MatchcordCoal weather={weather} roofed={roofed} />
      )}

      {/* 4. Left hand accessory: Jesuit crucifix for Plachý, Marshal's walking cane for Colloredo */}
      {archetype === "commander" && !isPlachy && (
        <mesh position={[-0.28, 0.52, 0.08]} castShadow>
          <cylinderGeometry args={[0.022, 0.02, 1.05, 8]} />
          <meshStandardMaterial
            color="#5c3821"
            roughness={0.7}
            transparent={transparent}
            opacity={opacity}
          />
        </mesh>
      )}
      {isPlachy && (
        <group position={[-0.26, 0.96, 0.22]} rotation={[0.2, 0, -0.15]}>
          {/* Vertical crucifix beam */}
          <mesh castShadow>
            <boxGeometry args={[0.024, 0.28, 0.018]} />
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </mesh>
          {/* Horizontal crucifix crosspiece */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.16, 0.024, 0.018]} />
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </mesh>
          {/* Gilded corpus */}
          <mesh position={[0, 0.04, 0.012]} castShadow>
            <boxGeometry args={[0.06, 0.1, 0.012]} />
            <meshStandardMaterial color="#d4a73f" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
}
