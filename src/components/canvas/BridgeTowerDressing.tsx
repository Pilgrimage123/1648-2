/**
 * Dressing for the Old Town Bridge Tower. The tactical section is three
 * floors (passage, windlass hall, gallery). The real tower is about 47 m
 * above the deck; that shaft is not built. The cap above y = 2 is a steep
 * hip and corner turrets, not Mocker's later spire.
 *
 * The grate is a picture of the victory. Movement is stopped by the ward,
 * not by these bars.
 */
import * as THREE from "three";
import { gridToWorld } from "./worldCoords";
import { useGameStore } from "../../store/useGameStore";

const SANDSTONE = "#7d7267";
const IRON = "#3f3f46";
const GOLD = "#d4a73f";

export function BridgeTowerDressing() {
  const scenario = useGameStore((s) => s.scenario);
  const seated = useGameStore((s) => s.m2?.seated ?? false);
  if (scenario !== "mission2") return null;

  const grateLift = seated ? 0.2 : 2.55;
  const corners: [number, number][] = [
    [10, 10],
    [18, 10],
    [10, 18],
    [18, 18],
  ];

  return (
    <group>
      {corners.map(([x, z]) => {
        const [wx, , wz] = gridToWorld({ x, y: 0, z });
        return (
          <mesh key={`${x}-${z}`} position={[wx, 3.1, wz]} castShadow>
            <cylinderGeometry args={[0.42, 0.5, 6.2, 8]} />
            <meshStandardMaterial color={SANDSTONE} roughness={0.86} />
          </mesh>
        );
      })}
      <mesh position={at(14, 5.6, 14)} castShadow>
        <coneGeometry args={[7.2, 3.4, 4]} />
        <meshStandardMaterial color="#3d342e" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {[12, 13, 14, 15, 16].map((z) => {
        const [wx, , wz] = gridToWorld({ x: 10, y: 0, z });
        return (
          <mesh key={`bar-${z}`} position={[wx, grateLift + 1.05, wz]}>
            <boxGeometry args={[0.08, 2.1, 0.08]} />
            <meshStandardMaterial color={IRON} metalness={0.7} roughness={0.4} />
          </mesh>
        );
      })}
      <mesh position={at(9, 0.08, 14.22)}>
        <boxGeometry args={[0.28, 0.06, 0.18]} />
        <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={at(16.22, 2.7, 14)}>
        <boxGeometry args={[0.06, 0.42, 0.7]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.55} />
      </mesh>
      <mesh position={at(10.2, 2.15, 14)}>
        <boxGeometry args={[0.12, 0.9, 1.6]} />
        <meshStandardMaterial color={SANDSTONE} roughness={0.8} />
      </mesh>
    </group>
  );
}

function at(x: number, y: number, z: number): [number, number, number] {
  const [wx, , wz] = gridToWorld({ x: Math.round(x), y: 0, z: Math.round(z) });
  const dx = (x - Math.round(x)) * 1.6;
  const dz = (z - Math.round(z)) * 1.6;
  return [wx + dx, y, wz + dz];
}
