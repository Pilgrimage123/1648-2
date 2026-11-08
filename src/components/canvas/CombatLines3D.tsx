/**
 * 3D Targeting Sightline & Projectile Visualizer (/src/components/canvas/CombatLines3D.tsx).
 * Draws the 3D Bresenham Line of Sight to the selected target in Targeting HUD mode
 * and renders transient bullet tracers / grenade arcs during attacks.
 */

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { useGameStore } from "../../store/useGameStore";
import { gridToWorld } from "./worldCoords";

export function CombatLines3D() {
  const actionMode = useGameStore((s) => s.actionMode);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const units = useGameStore((s) => s.units);
  const activeProjectile = useGameStore((s) => s.activeProjectile);

  const sightlineData = useMemo(() => {
    if (actionMode !== "shoot" || !selectedUnitId || !selectedTargetId) {
      return null;
    }
    const attacker = units.find((u) => u.id === selectedUnitId && u.alive);
    const targetEval = visibleTargets.find(
      (t) => t.targetId === selectedTargetId,
    );
    if (!attacker || !targetEval) return null;

    const [ax, ay, az] = gridToWorld(attacker.pos);
    const [tx, ty, tz] = gridToWorld(targetEval.targetPos);

    return {
      points: [
        [ax, ay + 1.15, az] as [number, number, number],
        [tx, ty + 1.15, tz] as [number, number, number],
      ],
      rayCells: targetEval.losRay.map((c) => {
        const [wx, wy, wz] = gridToWorld(c);
        return [wx, wy + 1.15, wz] as [number, number, number];
      }),
      isFlanked: targetEval.calculation.isFlanked,
    };
  }, [actionMode, selectedUnitId, selectedTargetId, visibleTargets, units]);

  const projectilePoints = useMemo(() => {
    if (!activeProjectile) return null;
    const [ax, ay, az] = gridToWorld(activeProjectile.from);
    const [tx, ty, tz] = gridToWorld(activeProjectile.to);

    if (activeProjectile.kind === "grenade") {
      // Parabolic 9-point arc for thrown grenade
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = ax + (tx - ax) * t;
        const z = az + (tz - az) * t;
        const baseH = (ay + 1.1) * (1 - t) + (ty + 0.2) * t;
        const arcBoost = Math.sin(t * Math.PI) * 2.8;
        pts.push([x, baseH + arcBoost, z]);
      }
      return { pts, color: "#f97316", width: 4 };
    }

    return {
      pts: [
        [ax, ay + 1.15, az] as [number, number, number],
        [tx, ty + 1.15, tz] as [number, number, number],
      ],
      color: "#fef08a",
      width: 4.5,
    };
  }, [activeProjectile]);

  return (
    <group>
      {/* Targeting HUD 3D Line of Sight */}
      {sightlineData && (
        <>
          <Line
            points={sightlineData.points}
            color={sightlineData.isFlanked ? "#facc15" : "#ef4444"}
            lineWidth={2.8}
            dashed
            dashScale={4}
            dashSize={0.5}
            gapSize={0.25}
          />
          {sightlineData.rayCells.map((pt, idx) => (
            <mesh key={idx} position={pt}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshBasicMaterial
                color={sightlineData.isFlanked ? "#facc15" : "#ef4444"}
              />
            </mesh>
          ))}
        </>
      )}

      {/* Active Shot Tracer / Grenade Arc */}
      {projectilePoints && (
        <Line
          points={projectilePoints.pts}
          color={projectilePoints.color}
          lineWidth={projectilePoints.width}
        />
      )}
    </group>
  );
}
