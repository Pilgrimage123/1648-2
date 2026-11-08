# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-11-08

### Added
- **Paradoxical Martyrdom & Induction into the Clementinum Iron Vigil (ADR-0006)**:
  - **Three Historically Grounded Companion Personas**:
    - `Jan Matěj` (*Osobní komorník*): Colloredo's faithful valet assisting his mobility handicap with wheellock carbine.
    - `Bratr Bartoloměj` (*Maltézský zbrojmistr & konventní vartýř*): Heavy armor, blunderbuss, and petards.
    - `Václav z Michalovic` (*Klementinský klerik & písař*): Student of philosophy at the Jesuit Clementinum university and Grand Prior scribe, marksman with musket and rest fork.
  - **Paradoxical Martyrdom Dilemma Modal (`App.tsx`)**:
    - Triggered upon extraction at the Čertovka dock (`[1, 0, 2]`) when Odowalsky's Swedish cavalry closes in.
    - Player must designate which companion stays behind at the palace gate to detonate the powder barrels.
    - **The Narrative Twist**: The two companions on the skiff take the Swedish bullets shielding Colloredo and perish upon arrival on the Old Town bank. The sacrificed companion miraculously survives the explosion, swims the Vltava, and is found on the steps of the Clementinum by Father Jiří Plachý.
  - **The Iron Vigil (*Železná vigilie*) Archetype Perks**:
    - The sole survivor is inducted into the clandestine Iron Vigil, permanently unlocking an exclusive perk based on his identity:
      - Jan Matěj: *Ocelová věrnost* (+20% shock/panic resistance, +1 AP when rescuing a downed ally).
      - Bratr Bartoloměj: *Maltézský pyrotechnik* (+2 grenade throw range, +1 powder keg blast damage).
      - Václav z Michalovic: *Klementinský zápal* (+10% height accuracy, 0% misfire chance in rain).
  - **Updated Tactical Advisor & Lore Voices (`TacticalAdvisorWidget.tsx`)**:
    - Dialogue and tactical tips now voiced by Jan Matěj (Steps 1–2) and Bratr Bartoloměj (Steps 3–4), foreshadowing the sacrificial choice at the canal.

- **Diegetic Floating Tutorial Architecture & Mission 1 Onboarding (ADR-0005)**:
  - **Tactical Advisor Widget (`TacticalAdvisorWidget.tsx`)**:
    - Floating, non-blocking HUD card anchored in the upper-left directly below `MissionStatusChip`.
    - Authentic period voices (valet Martin and armorer Jakub) giving urgent diegetic instructions alongside clear tactical advice and key shortcut badges (`[1]`, `[2]`, `[Tab]`, `[F1]`, `[4]`, `[F]`).
    - 4 progressive milestones explaining core mechanics:
      - *Step 1: Pohyb & Eskorta*: Explaining AP movement zones (1 AP move vs. 2 AP sprint), Colloredo's Lützen wound handicap (3 AP), and moving valet Martin adjacent to restore full mobility (5 AP).
      - *Step 2: Krytí, Obchvat & Míření*: Explaining half/full cover, flanking bonuses (+40% crit), aim mode (`[2]`), target cycling (`[Tab]`), and inspecting mathematical modifiers via Breakdown Wings (`[F1]`).
      - *Step 3: Počasí & Prachové sudy*: Explaining matchlock vs. wheellock reliability in rain, and throwing Jakub's petard (`[4]`) or shooting to detonate powder kegs on 3×3 AoE.
      - *Step 4: Patra & Únik*: Explaining floor cutaway (`[F]`), elevated roof sentries (+10% height bonus), and guiding Colloredo to the fisherman's skiff on Čertovka.
    - Dual progression: steps advance automatically upon completing actions or can be navigated manually via `[Další krok →]` / `[← Zpět]`.
    - Collapsible and togglable at any time using keyboard shortcut `[H]` or the graduation cap icon in `TacticalUtilitiesCapsule`.
  - **Tutorial Waypoint Beacon (`InstancedBattlefield.tsx`)**:
    - Pulsing 3D in-world gold and emerald glowing rings and floating `<Html>` badges highlighting recommended target tiles for each active milestone (Step 1 escort support tile at `[7, 0, 14]`, Step 3 powder keg at `[5, 0, 8]`, and Step 4 fisherman's skiff at `[1, 0, 2]`).
  - **Action Ribbon Glowing Highlights (`TacticalActionRibbon.tsx`)**:
    - Recommended action buttons pulse with an animated golden border glow (`[1] Move` in Step 1, `[2] Shoot` & `[F1]` in Step 2, `[4] Grenade` in Step 3).

- **Mission 1: Escape of Grand Prior Rudolf Count Colloredo-Wallsee (Útěk z Velkopřevorského paláce)**:
  - **Authentic Historical Setting & Objectives**:
    - July 26, 1648, 02:30 AM: Ernst Odowalsky betrays Prague, breaching Strahov gate for Königsmarck's Swedish cavalry.
    - 63-year-old Grand Prior and Field Marshal Rudolf Colloredo escapes his bed in a nightshirt (`noční košile`) and red Maltese cross sash (`Maltézský kříž`) with 3 faithful servants (chamberlain Martin, page Václav, armorer Jakub).
    - Charles Bridge is cut off by dragoons; the primary tactical objective is to escort the wounded Marshal through the palace garden to the fisherman's skiff (`Rybářská pramice`) moored at the Čertovka canal to cross to Staré Město before the Swedish net closes.
  - **VIP Escort & Mobility Handicap ("Zranění z Lützenu" & "Podepření komorníkem")**:
    - Colloredo's 7 bullet wounds from the Battle of Lützen (1632) limit his base movement to 3 tiles/AP.
    - When an escort servant stands adjacent (distance 1), Colloredo is physically supported and gains a +2 movement buff (5 tiles/AP).
    - If Colloredo is captured or killed, the mission ends in defeat ("Praha ztratila svého vrchního velitele").
  - **Marshal Command Aura ("Autorita polního maršála")**:
    - Colloredo's presence inspires imperial troops within 7 tiles, granting a +8% marksmanship bonus in shot calculations and immune composure against suppression.
  - **Explosive Powder Kegs ("Prachové sudy")**:
    - Destructible interactive black powder barrels placed in garden corners that detonate in a 3×3 AoE (5 damage, 2 armor shred, demolition of adjacent low walls, and thick black powder smoke) when hit by petards or ignited by heavy weapon hits.
  - **Čertovka River Canal & 3D Fisherman's Skiff**:
    - Beautiful deep-water canal tiles (`water`) and wooden dock (`wood_dock`) on the north-west border.
    - 3D wooden skiff model with bow lantern, oars, glowing emerald water beacon, and `<Html>` extraction tag (`⛵ Rybářská pramice`).
  - **New Character Archetype & Visuals**:
    - Added `"commander"` archetype with custom procedural SVG sprite (white nightshirt, silver hair/beard, red Maltese cross ribbon, walking cane, and personal wheellock pistol) and companion 3D articulated rig in `UnitVisual3D.tsx`.
    - Added period weapons `colloredo_wheellock_pistol` and `odowalsky_carbine`.
    - Authentic torrential night rain default weather (`rain`), favoring wheellock reliability over sputtering matchlocks.
    - Dual victory conditions (Boat extraction vs. total Swedish vanguard elimination) with detailed historical outcome chronicles.

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
