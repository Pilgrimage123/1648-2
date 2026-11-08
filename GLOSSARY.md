# Malá Strana 1648

Turn-based 2.5D tactical strategy in the spirit of XCOM 2, set on the night of July 26, 1648 in Prague's Malá Strana during the Thirty Years' War, featuring a multi-floor 3D battlefield, hot-swappable 2D billboard sprites (casting 3D shadows) and 3D models, and a 17th-century XCOM-2 Aiming HUD & Shot Breakdown System.

## Language

### Architecture & Rendering

**Grid Coordinate** (`GridCoord`):
A 3D discrete position `{ x: number, y: number, z: number }` where `x` and `z` are horizontal grid coordinates (`0..15`) and `y` is the vertical elevation floor (`0` = ground floor, `1` = first floor / roof).
_Avoid_: 2D `{ x, y }` tile coordinate, screen pixel coordinate

**Tile**:
A single cell in the 3D `GridSystem` storing `walkable: boolean`, `isLadder: boolean` (vertical connector between `y = 0` and `y = 1`), directional `cover` for all 4 cardinal directions (`N, E, S, W` with `'none' | 'half' | 'full'`), `obstacle` (`'none' | 'low_wall' | 'high_wall' | 'pillar'`), and `smokeTurns: number` (duration of black-powder smoke cloud on the tile).
_Avoid_: Node, cell

**Floor Cutaway** (*Přepínání pater*):
The visual and interactive filter controlled by `activeFloor` (`0 | 1`): when viewing ground floor (`y = 0`), upper floor geometry (`y > 0`) becomes ghosted/hidden and non-intercepting so it does not occlude the interior.
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
