# Malá Strana 1648

Turn-based 2.5D tactical strategy in the spirit of XCOM 2, set on the night of July 26, 1648 in Prague's Malá Strana during the Thirty Years' War, featuring a multi-floor 3D battlefield, hot-swappable 2D billboard sprites (casting 3D shadows) and 3D models, and a 17th-century XCOM-2 Aiming HUD & Shot Breakdown System.

## Language

### User Interface & HUD

**Tactical Action Ribbon** (*Taktická akční lišta*):
The unified floating bottom-center command strip combining selected soldier vitals, numbered action buttons (`[1] Move`, `[2] Shoot`, `[3] Overwatch`, `[4] Grenade`), turn termination (`[Space]`), and squad quick-select tabs.
_Avoid_: Action bar, bottom command panel, button dock

**Combat Chronicle Feed** (*Plovoucí kronika boje*):
The floating, auto-fading toast log anchored in the upper-right corner that displays recent combat rolls and event feedback with an expandable full-scroll history drawer.
_Avoid_: Combat log box, message console

**Mission Status Chip** (*Stavový štítek mise*):
The compact floating top-left HUD chip indicating current round, active faction turn banner, remaining enemies, and battlefield weather condition.
_Avoid_: TopBar, header

**Tactical Utilities Capsule** (*Kapsle taktických nástrojů*):
The floating top-right HUD island with discrete icon shortcuts and keybind indicators for camera rotation (`Q/E`), floor cutaway (`V` / `PageUp` / `PageDown`), visual render mode (`M`), cinematic action cam toggle (`C`), and fullscreen (`F`).
_Avoid_: Camera controls bar, settings bar

**Cinematic Action Cam** (*Kinematická akční kamera*):
The dynamic third-person tracking and over-the-shoulder camera system inspired by XCOM 2 that follows moving soldiers along their path, closes in during multi-floor staircase climbs, and cuts into dramatic reaction shots during Overwatch ambushes.
_Avoid_: Follow cam, chase cam

**Turn Splash Banner** (*Filmový banner tahu*):
The brief (~1s) center-screen floating banner announcing initiative transitions ("Tah obránců Prahy", "Tah švédské hlídky") before gracefully dissolving into the Mission Status Chip.
_Avoid_: Turn alert popup, turn modal

**Tile Hover Indicator** (*Kurzorový náhled dlaždice*):
The 3D in-world cursor projection displaying anticipated cover shield (full, half, or flanked) against visible enemies alongside action point expenditure (`1 AP` move vs. `2 AP` dash) before moving.
_Avoid_: Cursor tooltip, tile highlight info

**Tactical Advisor Widget** (*Taktický rádce*):
The collapsible floating HUD card anchored in the upper-left area providing progressive diegetic guidance from the Marshal's escort, tutorial step milestones, and dual keyboard/mouse action prompts.
_Avoid_: Tutorial popup, help box, walk-through dialog

**Tutorial Waypoint Beacon** (*Naváděcí maják tutoriálu*):
The pulsing 3D in-world ring indicator highlighting recommended action tiles (escort positioning, explosive keg targets, or the fisherman's skiff) during active tutorial milestones.
_Avoid_: Mission pointer, quest arrow

### Architecture & Rendering

**Grid Coordinate** (`GridCoord`):
A 3D discrete position `{ x: number, y: number, z: number }` where `x` and `z` are horizontal grid coordinates (`0..15`) and `y` is the vertical elevation floor (`0` = ground floor, `1` = first floor / roof).
_Avoid_: 2D `{ x, y }` tile coordinate, screen pixel coordinate

**Tile**:
A single cell in the 3D `GridSystem` storing `walkable: boolean`, `isLadder: boolean` (vertical connector between `y = 0` and `y = 1`), directional `cover` for all 4 cardinal directions (`N, E, S, W` with `'none' | 'half' | 'full'`), `obstacle` (`'none' | 'low_wall' | 'high_wall' | 'pillar'`), and `smokeTurns: number` (duration of black-powder smoke cloud on the tile).
_Avoid_: Node, cell

**Floor Cutaway** (*Přepínání pater*):
The visual and interactive filter controlled by `activeFloor` (`0 | 1 | 2`) via `V` or `PageUp/PageDown`: when viewing ground floor (`y = 0`), upper floor geometry (`y > 0`) becomes ghosted/hidden and non-intercepting so it does not occlude the interior.
_Avoid_: Roof toggle, camera clip

**Unit Actor** (`UnitActor`):
The 3D container component responsible for world position interpolation along an A* path, walk-cycle bobbing and tilt, attack lunge, hit flash/shake, and the floating `<Html>` tactical plate (including blinking HP & Armor loss preview when targeted), while delegating visual rendering to either `UnitVisual2D` or `UnitVisual3D`.
_Avoid_: Monolithic unit mesh

**Render Mode** (`RenderMode`):
The runtime switch (`'2D_SPRITE' | '3D_MODEL'`) that swaps every `UnitActor`'s visual child between `UnitVisual2D` (shadow-casting billboard sprite) and `UnitVisual3D` (3D model / composite rig) without touching game state or actor animation logic.

### Turn, Movement & Combat

**Action Point (AP)**:
A unit of tactical effort (2 AP per turn by default) spent to move, shoot, enter Overwatch, or throw a Grenade.

**Blue Zone (1 AP Move)**:
Reachable tiles within a unit's 1-AP movement allowance (`movePerAp`), leaving 1 AP to shoot, enter Overwatch, or throw a grenade.
_Avoid_: Short move, walk zone

**Yellow Zone (2 AP Dash)**:
Reachable tiles requiring all 2 AP, consuming the unit's entire turn.
_Avoid_: Far mark, run zone

**Line of Sight (LoS)**:
Pure 3D Bresenham voxel traversal over the `GridSystem` data grid (never `THREE.Raycaster`), blocked by `high_wall`, `pillar`, and solid upper floors.

### 17th-Century Aiming HUD & Shot Breakdown System

**Target Ribbon** (*Seznam cílů*):
The horizontal bar of visible enemy icons at the bottom-center of the screen in aiming mode (`Tab` / `Shift+Tab` cycling):
- **Yellow Icon**: Target is **Flanked** (*V obchvatu*) or standing in the open without cover on the incoming fire angle.
- **Red Icon**: Target is protected by **Half Cover** (*Poloviční kryt*: fence, low wall, shallow trench `-20%`) or **Full Cover** (*Plný kryt*: gabion, wagon wall, stone wall `-40%`).
- **Slate/Blue Icon**: Target is visible in **Extreme Range** (*Extrémní dostřel*) with heavy smoothbore distance falloff.

**Shot Calculation Result** (`ShotCalculationResult`):
The structured output of the 17th-century combat calculator containing final metrics (`hitChance`, `critChance`, `minDamage`, `maxDamage`, `armorPierce`, `armorShred`, `misfireChance`, `expectedHpLossMin`, `expectedHpLossMax`, `expectedArmorLoss`) and two itemized arrays of `StatModifier` entries (`hitModifiers` and `critAndArmorModifiers`) for the expandable **Breakdown Wings** (`F1`).

**Black Powder Smoke** (*Kouř z černého prachu*):
A dense cloud left on a tile after firing a black-powder weapon or detonating a grenade, inflicting a `-20%` accuracy penalty when the shooter or target stands in smoke.

**Musket Rest / Fork** (*Furketa*):
A fork stand used by heavy matchlock musketeers; grants a `+15%` accuracy bonus (`hasRestFork`) when the shooter has not moved yet during the current turn (`movedThisTurn === false`).

**Misfire Chance** (*Šance na selhání výstřelu*):
The probability (`0–100%`) that a 17th-century firearm fails to discharge due to damp black powder or a sputtering matchcord, scaled by lock mechanism (`matchlock` doutnákový vs. `wheellock` kolečkový) and `WeatherState` (`clear` *Jasno*, `fog` *Mlha*, `rain` *Déšť*).

**Armor Cuirass & Pierce/Shred** (*Kyrys, Průraz a Zničení zbroje*):
Armor points (`armor / maxArmor`) worn by 17th-century soldiers (cuirass, morion helmet) that absorb incoming damage unless bypassed by the weapon's `armorPierce` or permanently destroyed by `armorShred`. Heavy cuirass also reduces incoming critical hit chance (`-10%` per armor point).

### Mission 1: Escape of the Grand Prior (Mise 1: Útěk polního maršála)

**Železná vigilie** (*The Iron Vigil / Fidelitas Ferrea*):
The clandestine elite shock brotherhood forged by Jesuit Father Jiří Plachý in the Clementinum, binding university students, seasoned veterans, burghers, artisans, and Prague underworld fighters by a blood-and-iron oath to defend the Old Town Bridge Tower and Charles Bridge to the last drop of blood.
_Avoid_: Jesuit militia, student guard, holy order

**Švédské zajetí a výkupné** (*Ransom & High-Value Capture Directive*):
The historical Swedish objective orchestrated by Hans Christoph von Königsmarck and Ernst Odowalsky to encircle and capture Bohemia's supreme commander and wealthy nobility alive for immense ransom (over 100,000 thalers) and strategic paralysis, prioritizing subduing and encircling Colloredo over executing him.
_Avoid_: Assassination target, kill contract

**Paradoxical Martyrdom** (*Paradoxní oběť*):
The tactical and narrative dilemma where the player chooses which escort companion stays behind to hold the palace gate in a suicidal rear-guard action; that companion miraculously survives the carnage, while the other two who boarded the escape skiff perish shielding Marshal Colloredo from Swedish riverbank fire, forging the lone survivor into the Iron Vigil.
_Avoid_: Random death, scripted casualty, cutscene wipe

**Rybářská pramice** (*Fisherman's Skiff / Úniková zóna*):
The wooden skiff moored at the Čertovka canal dock (`x: 1, z: 2`) serving as the extraction objective for Field Marshal Rudolf Count Colloredo-Wallsee.

**Zranění z Lützenu & Podepření komorníkem** (*Marshal's Mobility Handicap & Escort Assist*):
The permanent war handicap (7 bullet wounds from Lützen 1632) restricting Marshal Colloredo to 3 movement tiles per AP, which increases to 5 tiles per AP whenever an escort servant (Martin, Václav, or Jakub) remains adjacent (distance 1).

**Autorita polního maršála** (*Marshal Command Aura*):
The tactical presence of Bohemia's supreme commander granting a +8% marksmanship modifier to nearby allied imperial soldiers within 7 tiles.

**Prachový sud** (*Explosive Powder Keg*):
Destructible black-powder storage barrels placed on the battlefield that explode in a 3×3 radius (5 damage, 2 armor shred, and thick smoke) when struck by heavy shots, petards, or secondary blast waves.

### Baroque Art Direction, Environmental Biomes & Ballistics (ADR-0007)

**Barokní šerosvit** (*Chiaroscuro Lighting*):
The Caravaggio/Rembrandt lighting hierarchy contrasting the brightly illuminated playable mid-ground (golden God-rays, warm torchlight) against deeply shadowed non-playable map borders and foreground vignettes.

**Pravidlo barev 60-30-10** (*60-30-10 Color Rule*):
The strict color allocation across the scene: 60% desaturated calm ground & atmosphere (slate, mud, ash, warm muted limestone parquet), 30% secondary architectural structures (weathered sandstone, palace stucco, dark timber rafters), and 10% saturated tactical/heraldic accents (royal gold, scarlet crimson, cobalt blue, warm torch orange) restricted exclusively to units, active cover, explosive hazards, and objectives.

**Jazyk tvarů** (*Top-Down Class Silhouettes*):
The rule that all 5 unit archetypes (`ranger`, `sniper`, `trooper`, `sectoid`, `commander`) are immediately distinguishable from a bird's-eye view by their silhouette (tall triangular polearms, wide plumed cavalier hats with capes, square cuirassier pauldrons with morions, asymmetric back-banners with censers) and that all headgear sits physically low on the brow covering the upper cranium.

**Nevypleněný honosný palác** (*Unplundered Opulent Palace Biome*):
The intact interior of the Grand Priory Palace (`x: 2..13, z: 12..15`, `damageLevel === 0`) characterized by warm polished limestone parquet (`stone_floor`), a central cardinal-burgundy royal runner (`palace_carpet`) with flat gold brocade borders, cream-stucco masonry, gilded Corinthian pillar capitals, carved walnut furniture barricades, and framed Chiaroscuro oil paintings.

**Zaprášená malostranská ulice a nádvoří** (*Dusty Street & Courtyard Biome*):
The outdoor section of the battlefield (`z: 3..11`, `damageLevel === 0`) characterized by cool matte slate-mud cobblestones (`cobble`), worn carriage tracks, weathered mossy sandstone walls, and rough field stone gabions.

**Zdevastovaná rozstřílená ruina** (*Devastated Shot-Up & Scorched Ruin Biome*):
The dynamic battle-scarred state (`damageLevel: 1 | 2`, `rubble` / `scorched_ruin`) applied to any tile struck by gunfire (`damageLevel = 1`, fallen plaster/mortar rubble) or a 3×3 explosion (`damageLevel = 2`, charred soot crater, glowing ember cracks, blackened neighboring walls, and low-profile perimeter debris that keeps the tile center clear for tactical grid readability).

**Krytý palácový interiér** (*Enclosed Roofed Masking* / `isEnclosedRoofedCoord`):
The spatial boundary excluding enclosed palace halls and roofed ground-floor arcades from outdoor rain/snow and pre-combat floating dust or smoke.

**Organické šíření prachu a dýmu** (*Causal Combat Diffusion* / `blastZones`):
The physical rule that indoor and courtyard ash, plaster dust, embers, and creeping ground mist start at zero before combat and expand radially outward ($R(t) = \min(R_{\max}, R_0 + v_{\text{diff}} \cdot \Delta t)$) exclusively from actual gunfire and explosion epicenters.

