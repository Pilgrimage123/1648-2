# 0007. Baroque Art Direction, Environmental Biomes, and Physical Ballistics

Date: 2026-11-09
Status: Accepted

## Context

As a turn-based tactical strategy game in the spirit of XCOM set in the mystical and epic Baroque world of the Thirty Years' War (Prague, July 26, 1648), *Malá Strana 1648* requires strict visual hierarchy, unmistakable top-down tactical readability, authentic physical behavior of enclosed interiors versus open exteriors, and clear environmental storytelling distinguishing an unplundered noble palace from a dusty street or a battle-scarred ruin.

## Decision

All current and future visual elements, locations, biomes, unit sprites/models, lighting setups, particle systems, and user interface components MUST strictly obey the following six pillars:

---

### Pillar 1: Composition & Battlefield Readability (Priority #1)
1. **Calm Ground Zones vs. High-Detail Cover & Units**:
   - Walkable ground surfaces (mud, cobblestone, marble parquet, royal carpet, snow, water) MUST remain low-contrast and texturally calm so they never compete with the tactical grid, movement zones (`Blue 1 AP` / `Gold 2 AP`), or sightlines.
   - High geometric and material detail is reserved strictly for cover obstacles (pillars, walls, barricades, powder kegs) and units.
   - Any battle-damage debris (fallen stucco, masonry fragments, charred beams, crater rims) MUST be positioned along tile perimeters/corners (`±0.35m` from tile center) with near-zero vertical profile in the tile center so unit footing and grid lines stay 100% legible.
2. **Baroque Chiaroscuro (Caravaggio / Rembrandt Lighting)**:
   - Use strong contrast between light and shadow: the playable mid-ground is illuminated by directional moonlight/sunbeams, warm flickering torchlight (`#f97316`), and golden volumetric God-rays (`#fde68a`), while non-playable map edges and camera foreground sink into deep shadow (`#04060b` fog and peripheral vignettes).

---

### Pillar 2: The 60-30-10 Color Rule
1. **60% — Dominant Calm Ground & Atmosphere**:
   - Desaturated earthy and slate tones (slate grey, cool mist, dark mud, ash, muted limestone parquet, deep muted burgundy runner).
2. **30% — Secondary Architectural Structures**:
   - Weathered Baroque sandstone masonry, palace cream-stucco walls, dark timber rafters, rusted iron, and soiled canvas.
3. **10% — Tactical & Heraldic Accents**:
   - Saturated **Royal Gold** (`#facc15` / `#d4a73f` — mystical energy, relics, VIP command, gilded Corinthian capitals), **Scarlet Crimson** (`#dc2626` / `#b91c1c` — heraldic colors, blood, explosive powder kegs, danger), **Cobalt Heraldic Blue** (`#2563eb`), and **Warm Torch/Musket Orange** (`#f97316`).
   - These saturated 10% accent colors are strictly restricted to **units, active cover badges, explosive hazards, and mission objectives**.

---

### Pillar 3: Shape Language (Top-Down Unit Silhouettes & Hat Geometry)
Every unit archetype MUST be immediately recognizable from a bird's-eye view by its silhouette alone, and all headgear MUST sit physically on the brow (`y ≈ 1.48–1.54`) covering the upper cranium in both 2D sprites (`UnitVisual2D.tsx`) and 3D rigs (`UnitVisual3D.tsx`):
1. **Pikemen / Halberdiers / Heavy Armourers (`ranger` — e.g., Bratr Bartoloměj, Jan Matěj)**:
   - Tall, sharp vertical triangles or broad-shouldered silhouettes with long weapons or wide-brimmed hats (`šířka krempy 0.88m`) and fluttering cloaks.
2. **Musketeers / Marksmen (`sniper` / `trooper` — e.g., Václav z Michalovic, Švédský mušketýr)**:
   - Wide silhouettes defined by cavalier hats with sweeping feathers, billowing capes, and long horizontal musket barrels supported by a rest fork (*furketa*).
3. **Heavy Infantry / Cuirassiers (`ranger` heavy / armored vanguard)**:
   - Massive square and rounded forms with broad pauldrons (`0.22m`), heavy breastplates (*kyrys*), and ridged morion helmets seated low over the forehead.
4. **Mystics / Inquisitors / Traitors (`sectoid` — e.g., Arnošt Odowalsky)**:
   - Asymmetric, twisted, or floating silhouettes featuring iron back-banners (*praporec na zádech*), swinging censers (*kadidelnice*), fluttering parchment seals, and tall conical/feathered hats.
5. **High Commanders (`commander` — Field Marshal Colloredo)**:
   - Distinct regalia silhouette: sweeping scarlet-and-ermine mantle, golden Maltese cross, raised command rapier, and a broad plumed cavalier hat.

---

### Pillar 4: Living Battlefield (Secondary Motion)
The battlefield must breathe continuously during turns without heavy GPU overhead:
- Creeping low-lying black-powder smoke hugging the ground (`CreepingSmokeTile` & `mistPatches`).
- Fluttering capes, plumes, and back-banners on units (`capeRef`, `plumeRef` in `UnitVisual3D`) and cloth banners on pillars (`BaroqueLivingDecor`).
- Flickering wrought-iron torches, votive altar candles, sizzling powder-keg fuses, and volumetric light cones.

---

### Pillar 5: Environmental Biomes & Dynamic Battle Devastation
The battlefield must visually distinguish intact noble interiors from dusty streets and battle-scarred ruins while preserving Pillar 1 (low-contrast ground) and Pillar 2 (60-30-10 rule):
1. **Biome 1 — Unplundered Opulent Baroque Palace (`Velkopřevorský palác`, `x: 2..21, z: 16..27`, `damageLevel === 0`)**:
   - *Ground (60%)*: Polished warm Bohemian limestone & porphyry parquet (`#3d342e` / `#342c27`) + central **Royal Tapestry Runner** (`surface: "palace_carpet"`, muted cardinal burgundy `#4a2226` / `#3f1d20` with flat gold brocade edge strips `#c89d3c`).
   - *Structures (30%)*: Intact cream-sandstone Baroque stucco walls (`#7d7267`), polished warm marble columns (`#8c7b6b`) topped with **gilded Corinthian capitals** (`#d4a73f`), carved walnut furniture barricades (`#5c3a21`) with brass trim, and framed Chiaroscuro oil paintings on interior walls.
2. **Biome 2 — Dusty Malá Strana Garden (`z: 5..15`, `x: 1..22`, `damageLevel === 0`)**:
   - *Ground (60%)*: Cool desaturated slate-mud cobblestones (`#1c222a` / `#171c23`) and dusty carriage tracks (`#242a33`).
   - *Structures (30%)*: Weathered dark sandstone masonry (`#4e4841`), mossy courtyard pillars (`#696158`), and rough field stone low walls (`#61584f`).
3. **Biome 3 — Devastated Shot-Up & Scorched Ruins (`damageLevel === 1 | 2`, `rubble` / `scorched_ruin`)**:
   - **Ballistic Scarring (`damageLevel = 1` via `grid.damageTile(c, 1)`)**: Triggered automatically whenever a bullet or shrapnel impacts a tile. Converts pristine floor into mortar/stucco rubble (`#453d37` in palace, `#38332f` outdoors), chips adjacent walls, and spawns corner plaster fragments.
   - **Scorched Crater Ruin (`damageLevel = 2` via `grid.damageTile(c, 2)`)**: Triggered automatically across the `3×3` blast zone of any petard or powder keg explosion (`processExplosions`). Converts floor into charred soot (`#221a17` / `#1a1311`), blackens neighboring walls/pillars (`#2b231f`), tilts nearby palace paintings, and spawns a low-profile charred crater rim, glowing ember cracks, and splintered beams at the tile corners.

---

### Pillar 6: Enclosed Interior Physics & Authentic 17th-Century Ballistics
1. **Spatial Masking of Roofed Interiors (`isEnclosedRoofedCoord(x, y, z)`)**:
   - Rain and snow (`RainParticles.tsx`) MUST NEVER fall inside enclosed palace interiors (`y ≤ 1`, `x: 1.5..21.5`, `z: 15.5..27.5`, except the open courtyard `x: 9.6..13.4`, `z: 17.6..20.4`) or under the belvedere arcade (`y < 1`, `x: 8.5..14.5`, `z: 8.5..12.5`).
   - Before gunfire and explosions begin (`combatIntensity === 0 && blastZones.length === 0`), zero arbitrary ash, plaster dust, or black-powder smoke may float inside the enclosed palace.
   - Once combat begins, ash, plaster dust, embers, and ground mist spawn causally at actual `blastZones` and `smokeTiles`, expanding organically outward over time:
     $$R(t) = \min\bigl(R_{\max},\; R_0 + v_{\text{diff}} \cdot \Delta t\bigr) \cdot \text{TILE\_SIZE}$$
2. **17th-Century Firearm Ballistics & Recoil (`CombatLines3D.tsx`, `UnitActor.tsx`, `useGameStore.ts`)**:
   - Muzzle flash, directional flame cone, pan sparks, and black-powder smoke MUST erupt at the **barrel tip** (`+0.58m` forward along the firing vector, `+0.14m` right), never inside the shooter's torso.
   - Firearms MUST NOT render a static full-distance laser line; they fire a high-velocity lead ball with a properly oriented trailing cone (`rotation={[-Math.PI / 2, 0, 0]}`) and a dynamic dissipating vapor wake.
   - Shooters experience a sharp **backward recoil kickback** (`-0.24m` along firing direction with upward muzzle climb `rotation.x = -0.22`), never a forward melee lunge.
   - **Synchronized Impact Timing**: Sound effects (`playHitSound`, `playExplosionSound`), unit hit shake, floating damage banners, and tile scarring (`damageTile`) MUST fire at the exact moment the projectile reaches the target ($t_{\text{impact}} \approx 240\,\text{ms}$, i.e., $36\%$ of `680ms`).
   - **Miss vs. Hit**: Missed shots (`hit === false`) deflect past the target (`0.68m` lateral offset) and kick up grey stone ricochet dust rather than exploding on the target's chest.

## Consequences

- Guarantees immediate visual clarity and historical-artistic cohesion across all current and future missions.
- Provides dynamic environmental storytelling: the player watches the opulent Grand Priory Palace and courtyard organically accumulate smoke, plaster dust, bullet scars, and charred craters as the battle unfolds.
