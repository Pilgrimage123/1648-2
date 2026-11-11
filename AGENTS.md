# AGENTS.md

## Agent skills

### Issue tracker

GitHub Issues at https://github.com/Pilgrimage123/1648-2. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

---

## Baroque Art Direction & Physical Environment Rules (Mandatory Constitution)

All visual, spatial, and combat changes MUST strictly obey `docs/adr/0007-baroque-art-direction-and-biome-states.md`:

1. **Composition & Tactical Grid Readability (Pillar 1)**:
   - Ground surfaces (mud, cobbles, palace marble parquet, royal carpet, snow, water) must be texturally calm and low-contrast so the tactical grid and movement zones (`Blue 1 AP`, `Gold 2 AP`) remain 100% legible.
   - High geometric detail belongs exclusively to cover obstacles and units. Any battle-damage debris (fallen stucco, charred beams, crater rims) must sit at tile perimeters (`±0.35m` from center), never cluttering tile centers.
   - **Baroque Chiaroscuro**: Strong Caravaggio/Rembrandt light-shadow contrast — illuminated playable mid-ground (torchlight, God-rays) vs. deeply shadowed map borders and foreground.

2. **60-30-10 Color Rule (Pillar 2)**:
   - **60% (Calm Dominant)**: Desaturated earthy/slate tones (slate grey, dark mud, ash, warm muted palace limestone `#3d342e`, muted cardinal carpet `#4a2226`).
   - **30% (Secondary Structures)**: Weathered sandstone masonry, palace cream-stucco (`#7d7267`), dark timber rafters, rusted iron.
   - **10% (Tactical & Heraldic Accents)**: Saturated Royal Gold (`#facc15` / `#d4a73f`), Scarlet Crimson (`#dc2626` / `#b91c1c`), Heraldic Cobalt (`#2563eb`), and warm torch/musket orange (`#f97316`). Reserved strictly for **units, active cover badges, explosive powder kegs, and mission objectives**.

3. **Top-Down Class Silhouettes & Headgear Placement (Pillar 3)**:
   - All 5 unit archetypes (`ranger`, `sniper`, `trooper`, `sectoid`, `commander`) must have unmistakable top-down silhouettes (triangles/polearms, wide plumed cavalier hats + capes, broad square cuirassier pauldrons + morions, asymmetric back-banners + censers).
   - Hats and helmets in both `UnitVisual2D` and `UnitVisual3D` must sit low on the forehead (`y ≈ 1.48–1.54`) with proper Z-order covering the upper head.

4. **Living Battlefield Secondary Motion (Pillar 4)**:
   - Continuous subtle motion: creeping black-powder ground smoke, swaying unit capes/plumes/banners in the wind, and flickering torches, votive altar candles, and light cones.

5. **Environmental Biome Differentiation & Dynamic Devastation (Pillar 5)**:
   - **Unplundered Opulent Palace (`x: 2..21, z: 16..27, damageLevel === 0`)**: Warm polished limestone parquet (`stone_floor`), cardinal-burgundy royal runner (`palace_carpet`) with flat gold brocade borders, cream-stucco walls, gilded Corinthian pillar capitals, walnut furniture barricades, and framed Chiaroscuro oil paintings. Piano Nobile is the same footprint at `y = 1`. The watchtower is `y = 2`, `x: 4..8`, `z: 17..19`.
   - **Dusty Malá Strana Garden (`z: 5..15, damageLevel === 0`)**: Cool matte slate-mud cobblestones (`cobble`), weathered mossy sandstone walls, and rough field gabions. The Čertovka canal is `z: 0..4`. The garden belvedere is `y = 1`, `x: 9..14`, `z: 9..12`.
   - **Devastated Shot-Up & Scorched Ruins (`damageLevel === 1 | 2`, `rubble` / `scorched_ruin`)**: Gunfire impacts (`grid.damageTile(c, 1)`) scar tiles with fallen plaster/mortar rubble; explosions (`grid.damageTile(c, 2)` in `3×3` blast zones) turn tiles into charred soot craters with glowing ember cracks, blackened walls, and perimeter debris.

6. **Enclosed Interior Physics & 17th-Century Ballistics (Pillar 6)**:
   - **Indoor Masking (`isEnclosedRoofedCoord`)**: Rain and snow never fall inside the palace when `y ≤ 1`, `x` is `1.5..21.5`, and `z` is `15.5..27.5`, except the open courtyard (`x` `9.6..13.4`, `z` `17.6..20.4`). They also never fall under the belvedere arcade (`y < 1`, `x` `8.5..14.5`, `z` `8.5..12.5`). Zero ash or dust floats indoors before combat starts; once gunfire or explosions occur, ash, embers, and ground mist spread organically outward from `blastZones` and `smokeTiles`.
   - **Ballistics**: Muzzle flash/smoke erupts at the barrel tip (`+0.58m` forward), projectiles use a trailing wake (never a static laser line), shooters kick backward with firearm recoil (`-0.24m`), missed shots ricochet off stone behind the target, and sound/hit reactions fire at the exact moment of bullet arrival (`~240ms`).

