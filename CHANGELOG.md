# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-11-11

### Added
- **Poslední vzepětí (Death Throes) & Prahy záporného zdraví (ADR-0012)**:
  - **Snížení základního zdraví nepřátel**: Švédští mušketýři mají nově **8 HP** (+1 zbroj), velitel Arnošt Odowalsky **10 HP** (+2 zbroj). Zbraně družiny (těžká mušketa 12–16 HP, odlehčená mušketa 8–12 HP, karabina 7–10 HP) spolehlivě způsobují smrtelný zásah na 1–2 rány.
  - **Univerzální mechanika Posledního vzepětí**: Jakákoliv jednotka (švédský voják i hrdina obrany Prahy), jejíž HP klesne na $\le 0$, nepadá okamžitě mrtva, ale získává přesně jeden dodatečný tah plné akceschopnosti před definitivním skonem.
  - **Zákaz zajetí pro umírající nepřátele**: Nepřátelé v Posledním vzepětí mají přísně zakázáno zajmout maršála Colloreda. Pokud mají vybitou mušketu, přednostně zaútočí pažbou zblízka (`swedish_musket_butt`) místo zdlouhavého 2 AP přebíjení.
  - **Práh okamžité smrti (Instant Overkill)**: Jednotka padne okamžitě mrtev bez Posledního vzepětí pouze tehdy, klesne-li její HP na $\le -(maxHp + 1)$ (např. $\le -9$ HP pro 8 HP mušketýra, $\le -11$ HP pro Odowalského, $\le -13$ HP pro Václava, $\le -15$ HP pro Colloreda a Jana Matěje, $\le -17$ HP pro Bartoloměje). Další poškození se kumuluje do záporných HP.
  - **Časování skonu**: Jednotka padá mrtev na konci své vlastní aktivace. Hrabě Colloredo v Posledním vzepětí má 1 tah na záchranu úprkem do pramice; pokud nedorazí, nastává porážka. Společníci v agónii jsou aktivními záchranci a mohou maršála osvobodit.
  - **Vizuální a HUD indikace**: Odznak s prasklou lebkou 💀, pulzující fialovo-rudá lišta zdraví s výpisem záporných HP a nová telemetry hlášení v Combat Chronicle (`OKAMŽITĚ PADL!`, `POSLEDNÍ VZEPĚTÍ!`).
  - **Testovací pokrytí**: Přidána Sekce 29 do `scripts/test-mission1.ts` a ověření v `scripts/test-inspect.ts`.

- **Dynamic Smoke, Blast Shockwave & Chiaroscuro Lighting System (ADR-0011)**:
  - **Unified Chiaroscuro Combat Atmosphere Field (`CombatAtmosphereField.tsx`)**: Replaced disjoint per-tile meshes with an instanced soft-depth particle manager ($\le 600$ particles total). Uses true spherical camera-facing billboarding (`camera.quaternion`) and a procedural 128×128 multi-stage Gaussian radial alpha texture with mipmapping, ensuring seamless multi-tile blending without polygonal terrain intersections. Supports three material buffers: dense black powder (`#1e293b` to `#334155`), masonry plaster dust (`#d6d3d1`), and floating embers (`#ea580c`).
  - **Dynamic Light Flash Pool (`useGameStore.ts`, `TacticalScene.tsx`)**: Implemented a strictly budgeted FIFO point-light pool (max 2 blast lights `#f97316` + 1 muzzle flash light `#fde047` with quadratic decay $I(t) = I_0 (1 - t/T)^2$) that physically illuminates the scene and injects internal amber forward-scattering (`#fb923c` / `#f97316`) into local smoke volumes during detonations.
  - **Blast Shockwave Displacement (`GridSystem.ts`)**: Explosions from powder kegs and petards instantaneously clear smoke and airborne dust from the epicenter ($r = 0$, setting `smokeTurns = 0`), creating scorched craters while violently compressing displaced smoke into perimeter rings ($r = 1..2$, `smokeTurns = 3` indoors, `2` outdoors, `1` during rain).
  - **Cumulative Smoke Concealment (`CombatSystem.ts`)**: 3D Bresenham sightlines crossing $\ge 2$ consecutive smoke tiles are completely severed, breaking direct targeting and Swedish Overwatch ambush sightlines.
  - **Point-Blank Proximity Rule (`CombatSystem.ts`)**: Units within contact melee range (distance $\le 1.5$ tiles) bypass smoke concealment, maintaining direct line of sight subject only to close-quarters penalties.
  - **High Ground Smoke Piercing (`CombatSystem.ts`)**: Elevated marksmen (`from.y > to.y`) overlook ground smoke and pierce up to 2 consecutive smoke tiles (severed if $> 2$).
  - **Indoor Stagnation & Through-Draft Portal Venting (`GridSystem.ts`)**: Smoke in enclosed palace rooms (`isEnclosedRoofedCoord`) lingers 3–4 turns; smoke within $\le 2$ tiles of open exterior doors dissipates at double speed ($-2$ per round) via natural cross-drafts. Outdoor smoke clears twice as fast in rain.
  - **Black-Powder Choking & Cuirassier Respiratory Resistance (`CombatSystem.ts`, `useGameStore.ts`)**: Unarmored or wounded troops ending their turn inside enclosed palace smoke suffer `-1 Mobility` next round. Armored soldiers with intact cuirasses and morions (`armor > 0 && hp === maxHp`, such as Marshal Colloredo) are immune.
  - **Legacy Cleanup**: Removed obsolete `CreepingSmokeTile` and per-tile mesh instances from `InstancedBattlefield.tsx`.
  - **Automated Test Suite**: Added Section 28 to `scripts/test-mission1.ts`, verifying all new tactical and environmental rules.

### Fixed
- Holding `F1` or `0` and clicking a distant door, a stair that is not a legal move, or a soldier on a higher floor opens the dossier. Those clicks do not open the door or change the viewed floor. A held right-click stays in aim mode.
- Tutorial step 3 now beacons the palace-side powder keg `(7, 0, 13)`. Step 4 and the advisor text beacon the Čertovka escape dock `(3, 0, 2)`, the same tile the skiff model uses. Both come from the live grid.
- The skiff label hides only when that beacon sits on the escape tile.
- Soldier `movePerAp` is `7 - weapon.mobilityPenalty`. The carbine penalty is 2, matching the Swedish musket (5 tiles) and the heavy musket (4 tiles). Colloredo stays at 3 from his limp.
- Shot breakdown for the marshal aura now says the bonus applies within 7 tiles.
- Garden and reinforcement musketeers no longer use dragoon or cuirassier ids.
- Glossary, ADRs, and `AGENTS.md` now match the 24×28×3 map, the current names, smoke penalties, fork rules, armor crit, and indoor mask.

### Added
- **Inspect dossier (`F1` / `0`)**: A tap opens the full sheet for the selected soldier, or for the aimed enemy while targeting. Hold either key and click a hero, enemy, door, or tile to inspect it without moving, firing, or opening the door. Fog-hidden enemies show only the sound contact. Unexplored tiles stay blank. Shot breakdown wings stay on the Rozpad button.
- **4-State XCOM 2 Camera State Machine & Mid-Movement Event Interrupts (ADR-0009, `CameraDirector.ts`)**:
  - **Headless Camera State Machine (`CameraDirector.ts`)**: Pure TypeScript camera director managing prioritized transitions across `TACTICAL_ISO`, `ACTION_OTS_FOLLOW`, `INTERRUPT_POD_REVEAL`, `INTERRUPT_OVERWATCH_SLOWMO`, `COVER_SETTLE_RESET`, `AIM_OTS`, and `PROJECTILE_TRACK`, backed by zero-allocation 60–144 Hz `liveMovementTelemetry`.
  - **Tactical Isometric View (`TACTICAL_ISO`) & Dynamic Indoor Cutaway**: Real-time camera tracking during 1 AP (`Blue Zone`) movement and automatic roof/upper-floor cutaway (`resolveDynamicRoofCutawayFloor`) whenever the tracked soldier steps into an enclosed building (`isEnclosedRoofedCoord`).
  - **Over-the-Shoulder Sprint & Interaction Action Cam (`ACTION_OTS_FOLLOW`)**: Low chase camera behind the soldier's shoulder (`2.6m` behind, `1.65m` height, `FOV 44°`) triggered automatically on 2 AP sprints (`Yellow Zone` / Dash) or environmental interactions (`detectPathInteractions`: kicking open closed wooden doors mid-run, parabolic vaulting over low cover, and climbing stairs), featuring smart wall/pillar shoulder switching (`chooseSmartSprintCamRig`) and footstep/impact camera shake.
  - **Mid-Movement Pod Reveal & Scramble Interrupt (`INTERRUPT_POD_REVEAL`)**: Stepping onto a tile that reveals unspotted Swedish musketeers in the Fog of War pauses movement on that exact tile, pans & zooms onto the newly revealed group, triggers their **Scramble** animation (`computeScrambleDestination`) into nearby cover (1–2 tiles), and smoothly returns to the soldier.
  - **Overwatch Slow-Mo Interrupt (`INTERRUPT_OVERWATCH_SLOWMO`)**: Triggering enemy Overwatch fire mid-movement slows down global animation time (`timeScale = 0.25`), frames the reacting shooter in a cloud of black-powder smoke (`SHOOTER_FOCUS`), and then tracks the running soldier in slow motion (`RUNNER_TRACK`) as the musket ball arrives.
  - **Cover Settle & Reset (`COVER_SETTLE_RESET`)**: Upon reaching a destination tile with cover (`half` / `full`), the soldier kneels and braces into the primary cover direction (`resolvePrimaryCoverDirection`) before the camera smoothly resets to `TACTICAL_ISO`.
- **Automatic Door Breaching on the Move (`Pathfinding.ts`)**:
  - Units can now path directly through closed wooden doors during movement and kick them open mid-stride (`door_breach`) without requiring a separate manual click prior to moving.
- **Smart Shooter Auto-Switch**:
  - Clicking `[2] Střelba` when the currently selected unit has an empty firearm or no targets in LoS automatically switches to a ready squadmate with a valid target in range.
  - Mission 1 does not grant activatable special abilities. `marshal_command` and the companion `[5]` abilities stay in the combat and audio code and do not run while `ability` is unset.
- **Segmented Firearm Reload & Melee Combat System**:
  - Reload spends 1 AP per step (`[R]`). A heavy musket needs 4 AP in total. A Swedish musket or carbine needs 2 AP. Marshal Colloredo's wheellock pistol is a single shot and cannot be reloaded. Melee is `[B]` or `[6]` (`MELEE_CATALOG`).

### Added (2026-11-09)
- **Multi-Floor Vertical Combat & Fog of War System (ADR-0010)**:
  - **Edge Peeking & 3D Vertical Line of Sight**: 3D Bresenham LoS in `CombatSystem.ts` now supports automatic 0.35m Edge Peeking over balustrades and floor perimeters, enabling steep downward sightlines into courtyards without floor slab obstruction.
  - **High Ground Advantage (+15%)**: Firing downward from an elevated floor (`attacker.y > target.y`) grants a +15% marksmanship bonus and degrades target half-cover to none (flanked from above).
  - **Upward Fire Defense**: Elevated defenders behind balustrades/low walls receive guaranteed full cover (-40%) against incoming fire from lower floors.
  - **Pre-Move LoS Target Crosshairs**: Hovering candidate movement tiles in `actionMode === "move"` evaluates line of sight in real time via `previewReconFromTile` and displays animated `🎯 V muškách po přesunu` crosshairs over targetable enemies in 3D and highlights matching cards in the Target Ribbon.
  - **Stairway Recon Preview**: Hovering staircases or ladders to unvisited floors communicates anticipated newly revealable tiles and enemy threat alerts in `TileHoverIndicator`.
  - **Floor Cutaway Fog Blackout**: Unvisited upper floors in camera cutaway remain in pitch-black Terra Incognita, preventing camera-based scouting through solid ceilings.
  - **Smoke Horizon Piercing**: Elevated snipers peering down through low-lying black-powder ground smoke suffer only a -20% accuracy penalty instead of complete LoS blockage.
  - **Three-Tier Visual Hierarchy & Unit Ghosting**: Spotted units on higher floors render as semi-transparent ghosts (30% opacity) with ground anchor discs, while unrevealed enemies in Fog of War remain completely hidden (only sound/matchcord contacts). Lower floor units render with 40% desaturation for Chiaroscuro depth.
  - **3D Cursor Drop Line & Ground Anchoring**: Eliminated isometric parallax error using persistent foot pedestals and vertical dashed drop lines projecting elevated units and cursors down to the ground plane.
  - **Raycast Movement Pass-Through**: Pointer raycasts for movement pass through ghosted upper-floor units (`pointerEvents: none`), preventing accidental clicks, while allowing direct targeting in `actionMode === "shoot"`.
  - **Smart Wall Culling & 0.35m Wall Stubs**: Front-facing walls obstructing the view into palace interiors automatically drop to 0.35m Wall Stubs with weathered sandstone coping via `InstancedMesh` matrix transforms, keeping rear and side walls at full 2.4m height without runtime garbage collection.
  - **Auto Camera Floor Tracking**: Moving units across floor boundaries or cycling units via `Tab` smoothly adapts the camera's `activeFloor`.


### Added
- **XCOM 2 Cinematic Action Cam & Tracking System (ADR-0009)**:
  - **Dynamic Movement Tracking Cam**: Camera smoothly locks onto moving units during their movement interpolation (`activeMovement`), lowers viewing distance by ~28% and adopts an action pitch (45°) matching XCOM 2 action cam.
  - **Multi-Floor Staircase Transition Tracking**: Smoothly ascends and descends along straight and spiral stairs with vertical height compensation (`y * FLOOR_HEIGHT`).
  - **Overwatch Reaction Cut-In Cam**: Automatically cuts behind reacting overwatch shooters with camera shake during reaction volleys.
  - **Player Toggle**: Added `actionCamEnabled` state toggleable via key `[C]` and top-right HUD island button (`TacticalUtilitiesCapsule`).
- **Interactive Door Handling for AI**:
  - Swedish AI (`computeEnemyAiDecision`) now detects closed doors along its path and opens them as a free 0 AP action, preventing broken pathfinding when players close palace doors.
- **Dynamic Escape Zone Binding**:
  - 3D fisherman's skiff and tutorial waypoint beacon at Čertovka are now dynamically bound to `tile.isEscapeZone` rather than hardcoded coordinates.

### Changed & Fixed
- **Performance Optimization & Memory Lifecycle (ADR-0008)**:
  - **Audio Garbage Churn Elimination**: Replaced dynamic allocations of `Float32Array` in Web Audio with a shared 2-second pre-computed `getSharedNoiseBuffer` in `audioSystem.ts`.
  - **Raycast Overhead Fix**: Added `raycast={() => null}` to hundreds of static decorative 3D elements (stair steps, balusters, trim, pictures) in `InstancedBattlefield.tsx` to eliminate raycasting stutter at 60/120 Hz.
  - **Keybind Consistency**: Canonicalized `[V]` / `[PageUp]` / `[PageDown]` for floor cutaways and `[F]` for Fullscreen across `GLOSSARY.md`, `TacticalUtilitiesCapsule.tsx`, and `App.tsx`.
  - **HUD Dragging Robustness**: Added `pointercancel` and window `blur` handlers to `useDraggableHud.ts` to prevent dragging lockups when the cursor exits the window.
  - **Type-Safe Sub-Grid Coordinates**: Added `continuousGridToWorld` in `worldCoords.ts` and removed all `as any` coordinate casts.
  - **Automated Cover Re-Baking**: `damageTile` and `setObstacle` in `GridSystem.ts` now automatically invoke `bakeCoverFromObstacles()`, preventing phantom cover bonuses after wall destruction.

### Added
- **Paradoxical Martyrdom & Induction into the Clementinum Iron Vigil (ADR-0006)**:
  - **Three Historically Grounded Companion Personas**:
    - `Jan Matěj` (*Osobní komorník*): Colloredo's faithful valet assisting his mobility handicap with wheellock carbine.
    - `Bratr Bartoloměj` (*Maltézský zbrojmistr & konventní vartýř*): Heavy armor, blunderbuss, and petards.
    - `Václav z Michalovic` (*Klementinský klerik & písař*): Student of philosophy at the Jesuit Clementinum university and Grand Prior scribe, marksman with musket and rest fork.
  - **Paradoxical Martyrdom Dilemma Modal (`App.tsx`)**:
    - Triggered upon extraction at a Čertovka escape tile (`(3, 0, 2)` or `(4, 0, 2)`) when Odowalsky's Swedish musketeers close in.
    - Player must designate which companion stays behind at the palace gate to detonate the powder barrels.
    - **The Narrative Twist**: The two companions on the skiff take the Swedish bullets shielding Colloredo and perish upon arrival on the Old Town bank. The sacrificed companion miraculously survives the explosion, swims the Vltava, and is found on the steps of the Clementinum by Father Jiří Plachý.
  - **The Iron Vigil (*Železná vigilie*) Archetype Perks**:
    - The sole survivor is inducted into the clandestine Iron Vigil, permanently unlocking an exclusive perk based on his identity:
      - Jan Matěj: *Ocelová věrnost* (+20% shock/panic resistance, +1 AP when rescuing a downed ally).
      - Bratr Bartoloměj: *Maltézský pyrotechnik* (+2 grenade throw range, +1 powder keg blast damage).
      - Václav z Michalovic: *Klementinský zápal* (+10% height accuracy, 0% misfire chance in rain).
  - **Updated Tactical Advisor & Lore Voices (`TacticalAdvisorWidget.tsx`)**:
    - Dialogue and tactical tips now voiced by Jan Matěj (Steps 1–2) and Bratr Bartoloměj (Steps 3–4), foreshadowing the sacrificial choice at the canal.
  - **Swedish High-Value Capture Directive ("Zajmout pro tučné výkupné")**:
    - The Swedish patrol operates under explicit orders not to kill Marshal Colloredo, but to encircle, subdue, and capture him alive for a massive ransom (100,000 thalers) and strategic paralysis (as occurred with over 200 nobles in Malá Strana).
    - Enemy AI actively prioritizes intercepting and surrounding Colloredo (`computeEnemyAiDecision`), aiming to disable his limbs rather than kill him.
    - If Colloredo is subdued (HP 0), the defeat screen and battle chronicle explicitly chronicle his capture into Swedish chains and the subsequent fall of Prague.

- **Diegetic Floating Tutorial Architecture & Mission 1 Onboarding (ADR-0005)**:
  - **Tactical Advisor Widget (`TacticalAdvisorWidget.tsx`)**:
    - Floating, non-blocking HUD card anchored in the upper-left directly below `MissionStatusChip`.
    - Authentic period voices (Jan Matěj, Václav z Michalovic, and Bratr Bartoloměj) giving urgent diegetic instructions alongside clear tactical advice and key shortcut badges (`[1]`, `[2]`, `[Tab]`, `[F1]`, `[4]`, `[R]`, `[V]`).
    - 4 progressive milestones explaining core mechanics:
      - *Step 1: Pohyb & Eskorta*: Explaining AP movement zones (1 AP move vs. 2 AP sprint) and Colloredo's permanent Lützen limp (3 tiles per AP).
      - *Step 2: Střelba a zteč*: Explaining aim mode (`[2]`), target selection, and right-click melee.
      - *Step 3: Nabíjení, petardy a sudy*: Explaining segmented reload and throwing Bartoloměj's petard (`[4]`) or shooting to detonate powder kegs on a 3×3 area. The beacon marks `(7, 0, 13)`.
      - *Step 4: Patra & Únik*: Explaining floor cutaway (`[V]` / `PageUp` / `PageDown`), the +15% high-ground bonus, and guiding Colloredo to the escape dock `(3, 0, 2)`. `[F]` toggles fullscreen.
    - Dual progression: steps advance automatically upon completing actions or can be navigated manually via `[Další krok →]` / `[← Zpět]`.
    - Collapsible and togglable at any time using keyboard shortcut `[H]` or the graduation cap icon in `TacticalUtilitiesCapsule`.
  - **Tutorial Waypoint Beacon (`InstancedBattlefield.tsx`)**:
    - Pulsing 3D in-world glowing rings on the live step-3 powder keg and the step-4 escape dock.
  - **Action Ribbon Glowing Highlights (`TacticalActionRibbon.tsx`)**:
    - Recommended action buttons pulse with an animated golden border glow (`[1] Move` in Step 1, `[2] Shoot` & `[F1]` in Step 2, `[4] Grenade` in Step 3).

- **Mission 1: Escape of Grand Prior Rudolf Count Colloredo-Wallsee (Útěk z Velkopřevorského paláce)**:
  - **Authentic Historical Setting & Objectives**:
    - July 26, 1648, 02:30 AM: Ernst Odowalsky betrays Prague, breaching Strahov gate for Königsmarck's Swedish cavalry.
    - 63-year-old Grand Prior and Field Marshal Rudolf Colloredo escapes his bed in a nightshirt (`noční košile`) and red Maltese cross sash (`Maltézský kříž`) with Jan Matěj, Václav z Michalovic, and Bratr Bartoloměj.
    - Charles Bridge is cut off by dragoons; the primary tactical objective is to escort the wounded Marshal through the palace garden to the fisherman's skiff (`Rybářská pramice`) moored at the Čertovka canal to cross to Staré Město before the Swedish net closes.
  - **VIP Mobility Handicap ("Zranění z Lützenu")**:
    - Colloredo's 7 bullet wounds from the Battle of Lützen (1632) permanently limit his movement to 3 tiles/AP. An adjacent companion does not raise that pace.
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
    - Black powder smoke mechanics (`smokeTurns`): a shooter in smoke takes -10% aim, and a target in smoke takes -15% to hit. Downward fire through ground smoke takes -20%.
    - Weather system (`clear`, `fog`, `rain`) influencing visibility and matchlock ignition reliability.
  - **Target Ribbon (Bottom Bar)**:
    - Period helmet and skull icons colored by tactical status: Yellow (`flanked` / exposed), Red (`covered`), and Blue/Slate (`extreme_range`).
    - Seamless target cycling using mouse clicks or `Tab` / `Shift+Tab`.
  - **Central Summary Panel**:
    - Instant overview displaying Hit Chance (%), Critical/Penetration Chance (%), Damage Range + Armor Pierce/Shred, and Misfire Chance (%).
  - **Expandable Breakdown Wings (`F1`)**:
    - Left Wing: Itemized hit chance modifiers (Base marksmanship, weapon balance, point-blank bonus vs. smoothbore range penalty, directional cover, high ground, gunpowder smoke, rain/fog, prepared 2 AP fork shot vs 1 AP hip-fire, and suppressed morale).
    - Right Wing: Critical & armor modifiers (Base weapon crit, flanking +40%, point-blank crit +15%, cuirass absorption, armor pierce, and armor shred).
  - **Over-the-Shoulder Tactical Camera (`TacticalCamera.tsx`)**:
    - Automatically glides over the shooter's right shoulder aiming toward the selected target during targeting mode.
    - Smoothly transitions between targets when cycling and returns to isometric orbit view on `Esc` or after firing.
  - **Blinking HP & Armor Loss Preview (`UnitActor.tsx`)**:
    - Enemy overhead nameplate dynamically pulses the exact cuirass pips and health bars that will be lost upon a successful hit.
  - **Keyboard Shortcuts & Tactical Controls**:
    - `1`, `2`, `3`, `4`: Select actions (Move, Shoot, Overwatch, Grenade).
    - `Tab` / `Shift+Tab`: Cycle visible targets.
    - `F1` / `0`: Open the inspect dossier. Breakdown wings stay on the Rozpad button.
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
