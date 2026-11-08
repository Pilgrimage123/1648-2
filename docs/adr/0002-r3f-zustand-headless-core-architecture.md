# 0002. Headless Core + Zustand + React Three Fiber 2.5D Architecture

Date: 2026-11-08
Status: Accepted

## Context

The initial version of *Praha 1648* coupled 2D grid rules, turn sequencing, and a 3,400-line imperative Three.js renderer inside `src/game/main.ts` and `src/game/scene3d.ts`. Adding multi-floor elevation (`y = 0, 1`), ladders, 3D Bresenham Line of Sight, XCOM-2-style flanking/height bonuses, instanced tile rendering, and hot-swappable 2D sprites vs. 3D `.glb` models required a strict separation of concerns.

## Decision

We adopt a three-layer architecture:

1. **Headless Core (`/src/core/`) — Pure TypeScript (Zero React / Three.js imports)**:
   - `GridSystem.ts`: 3D grid (`16×2×16`) with `{ x, y, z }` coordinates (`y` = floor `0 | 1`), `walkable`, `isLadder`, cardinal `cover` (`N, E, S, W`: `'none' | 'half' | 'full'`), and `obstacle` (`'none' | 'low_wall' | 'high_wall' | 'pillar'`).
   - `Pathfinding.ts`: 3D A* pathfinding across floors via `isLadder` tiles, plus Dijkstra flood-fill partitioning reachable tiles into **Blue Zone** (`1 AP`) and **Yellow Zone** (`2 AP` Dash).
   - `CombatSystem.ts`: 3D Bresenham Line of Sight over `GridSystem` and XCOM-2 Hit/Crit calculation (`half = -20%`, `full = -40%`, height advantage `+15%`, flanking `+25%` crit).
2. **State Management (`/src/store/useGameStore.ts`) — Zustand**:
   - Bridges `/src/core/` with React UI and the R3F 3D scene, managing unit selection, `activeFloor` (`0 | 1`), `renderMode` (`'2D_SPRITE' | '3D_MODEL'`), targeting mode, movement/attack animation queues, Overwatch reactions, and enemy AI turns.
3. **Declarative 3D Scene & UI (`/src/components/canvas/` & `/src/components/ui/`) — React Three Fiber + Drei**:
   - Floor tiles and Blue/Yellow movement zones rendered via `THREE.InstancedMesh` with roof/floor cutaway for `y > activeFloor`.
   - `TacticalCamera.tsx` providing smooth WASD/right-drag panning, wheel zoom, and 90° step rotation (`Q` / `E`).
   - `UnitActor.tsx` separated into container (A* path interpolation, walk bob/tilt, lunge, hit flash/shake, `<Html>` overhead badge) and swappable visual (`UnitVisual2D.tsx` billboard casting real 3D shadows vs. `UnitVisual3D.tsx` 3D rig/GLTF placeholder).

## Consequences

- **Pure testability**: All grid, pathfinding, LoS, and combat math in `/src/core/` runs without DOM or WebGL.
- **Instant 2D/3D swap**: Switching from 2D sprites to 3D models requires toggling `renderMode` (or replacing `UnitVisual3D.tsx` internals with `useGLTF`) without modifying `UnitActor.tsx` or `/src/core/`.
- **Minimal draw calls**: `THREE.InstancedMesh` handles the 16×16 multi-floor grid and movement highlights in a handful of draw calls.
