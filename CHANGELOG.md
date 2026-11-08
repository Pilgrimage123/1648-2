# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-11-08

### Added
- **Minimalist Floating XCOM-Style HUD Architecture (ADR-0004)**:
  - **Full-Canvas 3D Viewport**: Removed full-width headers and footers to give 100% screen real estate to the 3D Malá Strana battlefield.
  - **Tactical Action Ribbon (`TacticalActionRibbon.tsx`)**: Unified floating bottom-center command strip combining squad quick-select pills, anchored soldier card (vitals, HP/armor pips, AP dots, cover badge), and action buttons (`[1] Move`, `[2] Shoot`, `[3] Overwatch`, `[4] Grenade`, `[Space] End Turn`).
  - **In-Place Morphing Targeting HUD**: Entering aim mode smoothly morphs the center action bar into the Target Ribbon (visible enemy cards with Tab/Shift+Tab cycling) with the 4 key shot metrics (Hit %, Crit %, Damage/Pierce, Misfire %) hovering directly above and expandable mathematical Breakdown Wings (`F1`).
  - **Mission Status Chip (`MissionStatusChip.tsx`)**: Floating top-left HUD chip displaying current round, active faction turn banner, remaining enemies count, and battlefield weather toggle.
  - **Tactical Utilities Capsule (`TacticalUtilitiesCapsule.tsx`)**: Floating top-right HUD island with hotkey shortcuts for 90° camera rotation (`Q`/`E`), floor cutaway (`F`: P0/P1), 2D/3D render mode (`M`), and mission restart.
  - **Combat Chronicle Feed (`CombatChronicleFeed.tsx`)**: Ephemeral, floating top-right toast feed displaying roll results with event tones and an expandable full-scroll history drawer.
  - **Turn Splash Banner (`TurnSplashBanner.tsx`)**: Center-screen (~1.2s) cinematic banner announcing initiative transitions (*"TAH OBRÁNCŮ PRAHY"* vs. *"TAH ŠVÉDSKÉ HLÍDKY"*).
  - **In-World Tile Hover Indicator (`InstancedBattlefield.tsx`)**: 3D in-world cursor projection displaying anticipated cover shield (full, half, or flanked) and action point expenditure (`1 AP` move vs. `2 AP SPRINT`) directly above hovered reachable tiles.

### Fixed
- **Tile Hover Pointer Interception**: Added `style={{ pointerEvents: 'none' }}`, `zIndexRange={[10, 0]}`, and `distanceFactor={18}` to Drei's `<Html>` wrapper in `InstancedBattlefield.tsx`, preventing pointer event hijacking and enabling seamless tile clicks for unit movement.
- **Empty Target List Safeguard**: Added fallback message and `Zpět k pohybu (Esc)` button in `TacticalActionRibbon.tsx` when aim mode is entered with zero visible enemies in LoS.
- **Duplicate Icon Import & State Sync**: Replaced duplicate `RotateCcw` import with `RefreshCw` and linked floor/render mode switches directly to `toggleFloor()` and `toggleRenderMode()` in `useGameStore`.
- **Pass-through Click for Combat Toasts**: Set `pointer-events-none` on toast feed elements so player clicks on 3D tiles behind notifications are never blocked.
- **Turn Banner Transitions**: Replaced unbundled animation utilities with native Tailwind CSS transitions and enforced `pointer-events-none` across all banner layers.

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
    - `1`, `2`, `3`, `4`: Select actions (Move, Shoot, Overwatch, Grenade).
    - `Tab` / `Shift+Tab`: Cycle visible targets.
    - `F1`: Toggle breakdown wings.
    - `Enter` / `Space`: Confirm shot.
    - `Esc`: Cancel aiming / return to move mode.
    - `Q` / `E`: 90-degree camera step rotation.
    - `F`: Toggle floor cutaway view (Floor 0 / Floor 1).
    - `M`: Toggle 2D Sprites vs. 3D Models.

### Fixed
- **Obstacle Destruction Synchronization**:
  - Added `gridVersion` reactive tracking in Zustand so destroyed obstacles (e.g. from grenades) trigger immediate `InstancedMesh` re-population.
  - Set `mesh.count = list.length` on all obstacle instanced meshes, eliminating phantom 3D meshes after demolition.
  - Rewrote `bakeCoverFromObstacles()` to reset dynamic obstacle cover before recalculating, ensuring demolished walls stop granting cover to adjacent units.
- **Flanking & Cover Angle Precision**:
  - Refined `resolveTargetCoverAgainstShot()` so lateral walls no longer erroneously protect targets against steep orthogonal shots (fixing false cover bonuses when flanking).
- **Movement Pathfinding Performance**:
  - Replaced $O(V^2 \log V)$ queue sorting inside `computeReachableTiles()` with linear $O(V + E)$ BFS index traversal, completely eliminating lag during mouse hover.
  - Increased `zoneMeshRef` instance capacity from 256 to 512 to prevent buffer overflows.
- **Memory & Resource Leaks**:
  - Implemented shared texture and depth material singletons in `proceduralSprites.ts` to prevent WebGL texture and shader leaks during sprite re-rendering and 2D/3D mode toggling.
  - Reused static sphere geometry for 3D smoke puffs to prevent garbage collector churn.
  - Fixed billboard vertical orientation (`lockX={true}, lockZ={true}, lockY={false}`) so soldiers stand upright as tabletop miniatures with realistic silhouette shadows.
- **Morale Recovery**:
  - Restored composure (`isShaken: false`) at the beginning of each faction's turn so suppression does not permanently cripple units for the entire match.
- **UI & Layout Collision Fixes**:
  - Swapped bottom UI in `App.tsx` between `BottomCommandPanel` and `TargetingHud` in shoot mode, placing the Target Ribbon cleanly at the bottom of the screen without panel overlap.
  - Added active shooter summary badge directly inside the Targeting HUD.
- **Build & TypeScript Strictness**:
  - Enabled `"strict": true` in `tsconfig.json` with zero type errors.
  - Upgraded `vite.config.ts` to use `import.meta.dirname` instead of deprecated `__dirname`, resolving Vite native config warnings.
  - Removed obsolete Three.js addon references from `optimizeDeps.include`.
  - Updated `clean` script in `package.json` to be cross-platform.
