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
const SANDSTONE_COPING = "#948779";
const SANDSTONE_ARCH = "#5c5248";
const IRON = "#3f3f46";
const GOLD = "#d4a73f";
const TIMBER = "#5c3d28";

export function BridgeTowerDressing() {
  const scenario = useGameStore((s) => s.scenario);
  const seated = useGameStore((s) => s.m2?.seated ?? false);
  const activeFloor = useGameStore((s) => s.activeFloor);
  if (scenario !== "mission2") return null;

  const grateLift = seated ? 0.2 : 2.55;
  const showFullRoof = activeFloor >= 2;
  const corners: [number, number][] = [
    [10, 10],
    [18, 10],
    [10, 18],
    [18, 18],
  ];

  // Charles Bridge spans x = 1..9, z = 11..16 (center x = 5, length = 9 * 1.6 = 14.4 m)
  const [bridgeCenterX, , bridgeNorthZ] = at(5, 0, 10.52);
  const [, , bridgeSouthZ] = at(5, 0, 16.48);

  return (
    <group>
      {/* 1370s Parléř Sandstone Bridge Parapets (North z=11N & South z=16S, matching baked half-cover) */}
      {[bridgeNorthZ, bridgeSouthZ].map((pz, idx) => (
        <group key={`bridge-parapet-${idx}`} position={[bridgeCenterX, 0, pz]}>
          {/* Main ashlar sandstone parapet wall */}
          <mesh position={[0, 0.36, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[14.4, 0.72, 0.28]} />
            <meshStandardMaterial color={SANDSTONE} roughness={0.82} />
          </mesh>
          {/* Beveled sandstone coping cap */}
          <mesh position={[0, 0.76, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[14.48, 0.1, 0.36]} />
            <meshStandardMaterial color={SANDSTONE_COPING} roughness={0.74} />
          </mesh>
        </group>
      ))}

      {/* Gothic Bridge Spandrel Skirt & Triangular Vltava Icebreakers (Ledolamy) at piers x = 3 and x = 7 */}
      {[bridgeNorthZ - 0.08, bridgeSouthZ + 0.08].map((sz, idx) => (
        <mesh
          key={`bridge-spandrel-${idx}`}
          position={[bridgeCenterX, -0.14, sz]}
          receiveShadow
          raycast={() => null}
        >
          <boxGeometry args={[14.4, 0.28, 0.18]} />
          <meshStandardMaterial color={SANDSTONE_ARCH} roughness={0.88} />
        </mesh>
      ))}
      {[3, 7].map((pierX) => {
        const [px] = at(pierX, 0, 13.5);
        return (
          <group key={`bridge-pier-${pierX}`}>
            {/* North upstream/downstream cutwater */}
            <mesh
              position={[px, -0.12, bridgeNorthZ - 0.42]}
              rotation={[0, Math.PI * 0.25, 0]}
              castShadow
              receiveShadow
              raycast={() => null}
            >
              <cylinderGeometry args={[0.52, 0.68, 0.56, 4]} />
              <meshStandardMaterial color={SANDSTONE} roughness={0.85} />
            </mesh>
            {/* South cutwater */}
            <mesh
              position={[px, -0.12, bridgeSouthZ + 0.42]}
              rotation={[0, Math.PI * 0.25, 0]}
              castShadow
              receiveShadow
              raycast={() => null}
            >
              <cylinderGeometry args={[0.52, 0.68, 0.56, 4]} />
              <meshStandardMaterial color={SANDSTONE} roughness={0.85} />
            </mesh>
          </group>
        );
      })}

      {/* Old Town Bridge Tower 4 corner turrets with hexagonal Gothic spires */}
      {corners.map(([x, z]) => {
        const [wx, , wz] = gridToWorld({ x, y: 0, z });
        return (
          <group key={`turret-${x}-${z}`} position={[wx, 0, wz]}>
            {/* Turret shaft projecting from corner masonry */}
            <mesh
              position={[0, showFullRoof ? 3.1 : 1.45, 0]}
              castShadow={showFullRoof}
              raycast={() => null}
            >
              <cylinderGeometry args={[0.42, 0.5, showFullRoof ? 6.2 : 2.9, 8]} />
              <meshStandardMaterial color={SANDSTONE} roughness={0.86} />
            </mesh>
            {/* Stone corbel bracket under turret */}
            <mesh position={[0, 0.45, 0]} castShadow raycast={() => null}>
              <cylinderGeometry args={[0.52, 0.22, 0.6, 8]} />
              <meshStandardMaterial color={SANDSTONE_ARCH} roughness={0.9} />
            </mesh>
            {/* Gothic pyramidal turret spire with gilded finial */}
            {showFullRoof && (
              <group position={[0, 6.4, 0]}>
                <mesh castShadow raycast={() => null}>
                  <coneGeometry args={[0.54, 2.1, 6]} />
                  <meshStandardMaterial color="#2d2926" roughness={0.88} />
                </mesh>
                <mesh position={[0, 1.15, 0]} raycast={() => null}>
                  <sphereGeometry args={[0.07, 8, 8]} />
                  <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* Steep Gothic Hip Roof (Authentic 1648 Parléř profile prior to Mocker 1874) */}
      <group position={at(14, 0, 14)}>
        {/* Parapet balustrade walk around roof base */}
        {showFullRoof && (
          <mesh position={[0, 4.88, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[13.2, 0.52, 13.2]} />
            <meshStandardMaterial color={SANDSTONE_COPING} roughness={0.78} />
          </mesh>
        )}

        {/* Steep truncated pyramid roof base (dark weathered slate/timber) */}
        <mesh
          position={[0, 6.1, 0]}
          rotation={[0, Math.PI * 0.25, 0]}
          castShadow={showFullRoof}
          raycast={() => null}
        >
          <cylinderGeometry args={[2.8, 8.8, 2.5, 4]} />
          <meshStandardMaterial
            color="#322d28"
            roughness={0.92}
            side={THREE.DoubleSide}
            transparent={!showFullRoof}
            opacity={showFullRoof ? 1 : 0.04}
            depthWrite={showFullRoof}
          />
        </mesh>

        {/* Steep Gothic upper ridge hip with timber dormers */}
        <mesh
          position={[0, 8.2, 0]}
          rotation={[0, Math.PI * 0.25, 0]}
          castShadow={showFullRoof}
          raycast={() => null}
        >
          <coneGeometry args={[4.2, 3.6, 4]} />
          <meshStandardMaterial
            color="#27221d"
            roughness={0.9}
            side={THREE.DoubleSide}
            transparent={!showFullRoof}
            opacity={showFullRoof ? 1 : 0.04}
            depthWrite={showFullRoof}
          />
        </mesh>

        {/* Copper ridge crest & gilded finial */}
        {showFullRoof && (
          <group position={[0, 10.1, 0]}>
            <mesh castShadow raycast={() => null}>
              <cylinderGeometry args={[0.08, 0.12, 0.9, 6]} />
              <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.52, 0]} raycast={() => null}>
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        )}

        {/* West and East dormer windows (lucarnes) */}
        {showFullRoof && (
          <>
            <mesh position={[-3.6, 6.6, 0]} rotation={[0, 0, 0.35]} castShadow raycast={() => null}>
              <boxGeometry args={[0.8, 1.1, 0.9]} />
              <meshStandardMaterial color="#2d2926" roughness={0.85} />
            </mesh>
            <mesh position={[3.6, 6.6, 0]} rotation={[0, 0, -0.35]} castShadow raycast={() => null}>
              <boxGeometry args={[0.8, 1.1, 0.9]} />
              <meshStandardMaterial color="#2d2926" roughness={0.85} />
            </mesh>
          </>
        )}
      </group>

      {/* Iron portcullis bars at West Gate (x = 10, z = 12..16) */}
      {[12, 13, 14, 15, 16].map((z) => {
        const [wx, , wz] = gridToWorld({ x: 10, y: 0, z });
        return (
          <mesh
            key={`bar-${z}`}
            position={[wx, grateLift + 1.05, wz]}
            castShadow
            receiveShadow
            raycast={() => null}
          >
            <boxGeometry args={[0.08, 2.1, 0.08]} />
            <meshStandardMaterial color={IRON} metalness={0.7} roughness={0.4} />
          </mesh>
        );
      })}

      {/* Keystone / Petard placement marker at (9, 0, 14) before the West Gate */}
      <group position={at(9, 0.04, 14)}>
        <mesh position={[0, 0.03, 0]} receiveShadow raycast={() => null}>
          <boxGeometry args={[0.56, 0.06, 0.56]} />
          <meshStandardMaterial color={SANDSTONE_COPING} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.07, 0.22]} raycast={() => null}>
          <boxGeometry args={[0.32, 0.06, 0.2]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>

      {/* Windlass mechanism (Rumpál) at (11, 1, 14) on P1 */}
      {activeFloor >= 1 && (
        <group position={at(11, 2.6, 14)}>
          <mesh
            position={[0, 0.42, 0]}
            rotation={[Math.PI * 0.5, 0, 0]}
            castShadow
            raycast={() => null}
          >
            <cylinderGeometry args={[0.24, 0.24, 0.88, 10]} />
            <meshStandardMaterial color={TIMBER} roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.24, -0.46]} castShadow raycast={() => null}>
            <boxGeometry args={[0.18, 0.48, 0.14]} />
            <meshStandardMaterial color={TIMBER} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.24, 0.46]} castShadow raycast={() => null}>
            <boxGeometry args={[0.18, 0.48, 0.14]} />
            <meshStandardMaterial color={TIMBER} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.42, 0]} raycast={() => null}>
            <boxGeometry args={[0.08, 0.62, 0.08]} />
            <meshStandardMaterial color={ GOLD } metalness={0.65} roughness={0.35} />
          </mesh>
        </group>
      )}

      {/* Marian Latin inscription plaque on P2 gallery (x = 16, y = 2, z = 14) */}
      {activeFloor >= 2 && (
        <mesh position={at(16.22, 5.15, 14)} raycast={() => null}>
          <boxGeometry args={[0.06, 0.42, 0.7]} />
          <meshStandardMaterial color="#e7e5e4" roughness={0.55} />
        </mesh>
      )}
      {/* St. Vitus / Old Town heraldic relief above West Gate arch */}
      <mesh position={at(10.2, 2.15, 14)} raycast={() => null}>
        <boxGeometry args={[0.12, 0.9, 1.6]} />
        <meshStandardMaterial color={SANDSTONE} roughness={0.8} />
      </mesh>

      {/* 3D Tactical Field Works & Defense Cover on Bridge & Křižovnické náměstí */}
      <group>
        {/* Timber Barricade at East Gate exit to Křižovnické náměstí (x = 19, z = 12) */}
        <group position={at(19.2, 0, 12.2)}>
          <mesh position={[0, 0.38, 0]} rotation={[0, 0.12, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[0.32, 0.76, 1.35]} />
            <meshStandardMaterial color={TIMBER} roughness={0.85} />
          </mesh>
          <mesh position={[0.08, 0.52, -0.32]} rotation={[0.2, 0, 0]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.18, 0.2, 0.65, 8]} />
            <meshStandardMaterial color="#4a3b2c" roughness={0.75} metalness={0.2} />
          </mesh>
        </group>

        {/* Oak Casks and Sandstone Rubble Barricade on South approach of the square (x = 21, z = 16.5) */}
        <group position={at(21, 0, 16.4)}>
          <mesh position={[0, 0.4, 0]} rotation={[0, -0.18, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[1.25, 0.74, 0.35]} />
            <meshStandardMaterial color={TIMBER} roughness={0.88} />
          </mesh>
          <mesh position={[-0.35, 0.36, 0.18]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.22, 0.24, 0.72, 8]} />
            <meshStandardMaterial color="#3d2817" roughness={0.8} />
          </mesh>
        </group>

        {/* Masonry Corbel & Balustrade Defense Emplacement on Bridge Deck (x = 3.5, z = 11.4) */}
        <group position={at(3.5, 0, 11.3)}>
          <mesh position={[0, 0.38, 0]} rotation={[0, 0.08, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[0.85, 0.72, 0.28]} />
            <meshStandardMaterial color={SANDSTONE} roughness={0.82} />
          </mesh>
          <mesh position={[0.15, 0.32, 0.22]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.16, 0.18, 0.62, 8]} />
            <meshStandardMaterial color="#4a3b2c" roughness={0.78} />
          </mesh>
        </group>

        {/* South Pier Supply Barricade on Bridge Deck (x = 7.5, z = 15.7) */}
        <group position={at(7.5, 0, 15.7)}>
          <mesh position={[0, 0.38, 0]} rotation={[0, -0.06, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[0.92, 0.72, 0.28]} />
            <meshStandardMaterial color={SANDSTONE} roughness={0.82} />
          </mesh>
          <mesh position={[-0.2, 0.32, -0.22]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.16, 0.18, 0.62, 8]} />
            <meshStandardMaterial color="#4a3b2c" roughness={0.78} />
          </mesh>
        </group>
      </group>

      {/* Surrounding Prague 1648 Environment & River Banks (ADR-0007 / ThreeJS natural perimeters) */}
      <group>
        {/* Old Town Quay Sandstone Embankment Wall (East x = 18.8..23.5) */}
        <mesh position={at(21, -0.15, 8.8)} receiveShadow raycast={() => null}>
          <boxGeometry args={[9.6, 0.45, 1.8]} />
          <meshStandardMaterial color={SANDSTONE_ARCH} roughness={0.92} />
        </mesh>
        <mesh position={at(21, -0.15, 19.4)} receiveShadow raycast={() => null}>
          <boxGeometry args={[9.6, 0.45, 1.8]} />
          <meshStandardMaterial color={SANDSTONE_ARCH} roughness={0.92} />
        </mesh>

        {/* Monastery of the Knights of the Cross with the Red Star (Křižovníci, x = 23.5, z = 8.5) */}
        <group position={at(24.5, 0, 7.5)}>
          <mesh position={[0, 2.2, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[4.2, 4.4, 4.8]} />
            <meshStandardMaterial color="#7a7064" roughness={0.85} />
          </mesh>
          <mesh position={[0, 4.8, 0]} rotation={[0, Math.PI * 0.25, 0]} castShadow raycast={() => null}>
            <coneGeometry args={[2.4, 2.2, 4]} />
            <meshStandardMaterial color="#322d28" roughness={0.9} />
          </mesh>
        </group>

        {/* Old Town Townhouses & Portals along Křižovnické náměstí (x = 24.5, z = 19.5) */}
        <group position={at(24.5, 0, 20.5)}>
          <mesh position={[0, 2.0, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[4.2, 4.0, 5.2]} />
            <meshStandardMaterial color="#6e655a" roughness={0.88} />
          </mesh>
          <mesh position={[0, 4.4, 0]} rotation={[0, 0, -0.2]} castShadow raycast={() => null}>
            <boxGeometry args={[4.4, 1.2, 5.0]} />
            <meshStandardMaterial color="#42221b" roughness={0.85} />
          </mesh>
        </group>

        {/* Distant Malá Strana Bridgehead & Judith Tower Silhouette across western Vltava (x = -7.5, z = 13.5) */}
        <group position={at(-7.5, 0, 13.5)}>
          {/* Western bridge arch and pier extension */}
          <mesh position={[2.5, -0.15, 0]} receiveShadow raycast={() => null}>
            <boxGeometry args={[5.2, 0.42, 9.8]} />
            <meshStandardMaterial color={SANDSTONE_ARCH} roughness={0.9} />
          </mesh>
          {/* Malá Strana lower Judith Tower profile */}
          <mesh position={[-0.8, 2.8, -3.8]} castShadow raycast={() => null}>
            <boxGeometry args={[3.2, 5.6, 3.2]} />
            <meshStandardMaterial color="#544c43" roughness={0.88} />
          </mesh>
          <mesh position={[-0.8, 6.2, -3.8]} castShadow raycast={() => null}>
            <coneGeometry args={[1.9, 2.2, 4]} />
            <meshStandardMaterial color="#2d2926" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function at(x: number, y: number, z: number): [number, number, number] {
  const [wx, , wz] = gridToWorld({ x: Math.round(x), y: 0, z: Math.round(z) });
  const dx = (x - Math.round(x)) * 1.6;
  const dz = (z - Math.round(z)) * 1.6;
  return [wx + dx, y, wz + dz];
}
