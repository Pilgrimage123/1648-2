# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-11-08

### Added
- **2.5D XCOM-2 Style Tactical Engine & Architecture**:
  - Pure TypeScript headless core (`src/core/`): zero dependencies on React/Three.js.
  - Multi-floor 3D grid system (`GridSystem.ts`) with coordinates `{ x, y, z }`, floor level cutaway support (`activeFloor`), ladders, directional cover (`N, E, S, W`), and destructible obstacles.
  - 3D Bresenham Line of Sight traversal algorithm (`bresenham3D`, `checkLineOfSight3D`) evaluating obstacle height and multi-level floor slabs.
  - A* pathfinding and Dijkstra movement range calculation divided into Blue Zone (1 AP - Move + Shoot) and Yellow Zone (2 AP - Dash/Sprint).
  - Modern reactive state store using Zustand (`useGameStore.ts`).
  - Render layer using `@react-three/fiber` and `@react-three/drei` with `THREE.InstancedMesh` for floor tiles and cover obstacles to maximize performance.
  - Modular character representation (`UnitActor.tsx`) featuring instant hot-swap between 2D Billboard Sprites (`UnitVisual2D.tsx`) with real 3D shadows and 3D Models (`UnitVisual3D.tsx`).
  - Procedural SVG/Canvas textures generated on the fly (`proceduralSprites.ts`) for Imperial and Swedish combatants.

- **17th-Century Aiming HUD & Shot Breakdown System**:
  - **Data Architecture (`ShotCalculationResult`, `StatModifier`)**:
    - Itemized breakdown structures providing transparent math for every modifier.
    - Full weapon catalog representing Thirty Years' War arms (wheellock dragoon carbines, heavy matchlock muskets with rest forks, trench arquebuses, officer wheellocks).
    - Authentic armor mechanics: steel cuirass absorbing damage and mitigating critical hits; armor piercing (`armorPierce`) and permanent cuirass shredding (`armorShred`).
    - Black powder smoke mechanics (`smokeTurns`): firearm salvos and grenades spawn smoke clouds inflicting a -20% accuracy penalty.
    - Weather system (`clear`, `fog`, `rain`) influencing visibility and matchlock ignition reliability.
  - **Target Ribbon (Bottom Bar)**:
    - Period helmet and skull icons colored by tactical status: Yellow (`flanked` / exposed), Red (`covered`), and Blue/Slate (`extreme_range`).
    - Seamless target cycling using mouse clicks or `Tab` / `Shift+Tab`.
  - **Central Summary Panel**:
    - Instant overview displaying Hit Chance (%), Critical/Penetration Chance (%), Damage Range + Armor Pierce/Shred, and Misfire Chance (%).
  - **Expandable Breakdown Wings (`F1`)**:
    - Left Wing: Itemized hit chance modifiers (Base marksmanship, weapon balance, point-blank bonus vs. smoothbore range penalty, directional cover, high ground, gunpowder smoke, rain/fog, musket fork stabilization, and suppressed morale).
    - Right Wing: Critical & armor modifiers (Base weapon crit, flanking +40%, point-blank crit +15%, cuirass absorption, armor pierce, and armor shred).
  - **Over-the-Shoulder Tactical Camera (`TacticalCamera.tsx`)**:
    - Automatically glides over the shooter's right shoulder aiming toward the selected target during targeting mode.
    - Smoothly transitions between targets when cycling and returns to isometric orbit view on `Esc` or after firing.
  - **Blinking HP & Armor Loss Preview (`UnitActor.tsx`)**:
    - Enemy overhead nameplate dynamically pulses the exact cuirass pips and health bars that will be lost upon a successful hit.
  - **Keyboard Shortcuts & Tactical Controls**:
    - `Tab` / `Shift+Tab`: Cycle visible targets.
    - `F1`: Toggle breakdown wings.
    - `Enter` / `Space`: Confirm shot.
    - `Esc`: Cancel aiming / return to move mode.
    - `Q` / `E`: 90-degree camera step rotation.
    - `F`: Toggle floor cutaway view (Floor 0 / Floor 1).
    - `M`: Toggle 2D Sprites vs. 3D Models.
