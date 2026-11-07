# Atmospheric Dynamic Lighting — Malá Strana 1648

Delivers a rich, reactive Baroque chiaroscuro lighting and atmosphere system for the 1648 Prague night battlefield, uniting transient combat illumination, volumetric light shafts, storm lightning, organic torch sway, wet surface shaders, and phase-reactive mood presets.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core lighting and atmospheric preferences have been confirmed in Phase 1. Review the architectural synthesis below and click **Proceed** to begin implementation.

- **Confirmed Decision 1 — Full Dynamic Lighting Suite**: Implement transient point lights for gunfire and explosions, volumetric god-ray shafts from the harvest moon and palace windows, periodic and event-driven storm lightning flashes with dramatic shadow sweeps, and organic multi-frequency torch flicker with positional shadow sway.
- **Confirmed Decision 2 — Phase-Driven & Manual HUD Mood Control**: Support an **Auto (Phase-Driven)** lighting mode that smoothly interpolates the scene atmosphere across *Flight* (Baroque Chiaroscuro), *Dock* (Vltava River Mist), and *Hold* (Crimson Siege Storm), alongside a HUD lighting cycle control (and hotkey `L`) to manually preview or lock any mood preset at any time.
- **Confirmed Decision 3 — Bloom, Wet Surfaces & Street Mist**: Add GPU post-processing bloom (`EffectComposer` + `UnrealBloomPass` + `OutputPass`, with automatic zero-overhead fallback on software WebGL), rain-rippled specular puddles and river shimmer via custom `onBeforeCompile` shaders, and drifting low-lying street mist that absorbs nearby light colors.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the 3D tactical map of Malá Strana into a living 17th-century nightscape where every musket volley, grenade blast, torch brazier, stained-glass window, and passing storm cloud dynamically illuminates the wet cobblestones, Vltava river, and HD-2D soldiers.
- **Target Audience / Persona**: Tactical strategy players who appreciate dramatic historical atmosphere (reminiscent of Baroque chiaroscuro paintings and HD-2D tactical RPGs) without sacrificing board legibility or tactical clarity.
- **Key Value**: Heightens combat impact and narrative tension as Marshal Colloredo retreats from the palace toward the Vltava boat, while giving players direct control over atmospheric mood presets from the top bar.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Phase-Reactive Atmosphere Progression**: As the player advances from *Útěk z paláce* (`flight`) to *Nábřeží* (`dock`) and *Poslední břeh* (`hold`), the sky fog, hemisphere fill, moonlight angle, river mist density, and distant siege fire glow smoothly transition via exponential damping.
  2. **HUD Lighting Mode Selector**: Clicking the new atmosphere control in the top command bar (or pressing `L`) cycles through **Auto (Dle fáze)**, **Barokní šerosvit** (Chiaroscuro Night), ** Bouře nad Vltavou** (Storm & Lightning), **Krvavé obléhání** (Crimson Siege Fire), and **Měsíční mlha** (Silver Moonlight Mist).
  3. **Reactive Combat Illumination**: Firing a pistol, carbine, or musket erupts a warm-white muzzle flash point light that casts brief high-contrast highlights across adjacent walls and puddles; throwing a grenade or detonating a petard triggers a high-intensity amber-crimson blast light with radial shockwave illumination and rising embers.
  4. **Storm Lightning Events**: Periodic natural lightning (and immediate flashes on major explosions or storm preset selection) briefly spikes directional sky illumination from a shifting cloud azimuth, casting long, dramatic shadows across the street and triggering a low distant thunder roll in the audio synthesizer.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-Baroque Chiaroscuro meets crisp tactical readability—inspired by Caravaggio and Karel Škréta night paintings.
  - *Color Palette & Mood*:
    - `--color-ink` (`#140b18`): Deep indigo-plum night sky and exponential horizon fog base.
    - `--color-gold` (`#e6ba5c`) & `--color-gold-bright` (`#ffe699`): Warm candlelight, torch braziers, gilded palace trim, and muzzle flash cores.
    - `--color-blood` (`#9e2032`): Burning siege horizon glow during the final hold phase and explosive petard/grenade light pulses.
    - `--color-cobalt` (`#1f4d8f`): Cool sapphire moonlight, stained-glass shafts, and lightning zenith flashes.
  - *Typography & Hierarchy*: Retains `Cinzel` display headers and `Literata` body copy with `tabular-nums` telemetry readouts.
  - *Component Styling & Layout*: Keeps the 100% unobstructed 3D tactical viewport and collapsible bottom command dock; adds a single compact single-line lighting mood button (`whitespace-nowrap shrink-0`) in the top utility bar with no floating side cards or decorative status dots.

- **Interactive Feedback & Motion**:
  - All mood transitions use frame-rate-independent exponential damping (`THREE.MathUtils.damp`) so colors, fog density, and light intensities glide smoothly over ~1.2 seconds.
  - Respects `prefers-reduced-motion: reduce` by suppressing rapid lightning strobes and keeping torch sway gentle.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pooled Transient Combat Point Lights vs. Dynamic Light Allocation**
  - *Chosen Approach*: Pre-allocate a fixed pool of reusable `THREE.PointLight` nodes for muzzle flashes, grenade/petard explosions, and blade clashes that are positioned and decayed per frame without adding or removing scene lights at runtime.
  - *Why*: Adding/removing lights in Three.js triggers expensive WebGL shader program recompilation mid-combat. A fixed pre-allocated pool with `intensity = 0` when idle guarantees zero shader stutter and zero GC allocation during attacks.
  - *Alternatives Considered*: Spawning `new THREE.PointLight()` per effect, which causes frame hitches on first shot.

- **Decision 2: Volumetric Light Shafts via Custom Fresnel-Fade Shader Cones**
  - *Chosen Approach*: Build additive, view-angle-softened volumetric beam geometries (`ShaderMaterial` with smooth edge Fresnel, vertical height attenuation, and animated dust-mote shimmer) for the harvest moon and stained-glass palace windows.
  - *Why*: Delivers unmistakable golden/ruby/sapphire window beams and silver moonbeams across the street at a fraction of the GPU cost of full-screen raymarched volumetrics, working smoothly on both desktop GPUs and fallback environments.
  - *Alternatives Considered*: Full-screen depth-buffer raymarching, which can alias heavily on alpha-tested unit sprites.

- **Decision 3: Hardware-Guarded Post-Processing Bloom**
  - *Chosen Approach*: Wire `EffectComposer` + `RenderPass` + `UnrealBloomPass` + `OutputPass` with a tuned high threshold (`0.78`) and soft radius (`0.45`) so only emissive flames, windows, lightning, and gunfire bloom, while keeping unit plates and ground markings crisp. Automatically bypass composer passes when `isSoftwareGl` is detected.
  - *Why*: Preserves razor-sharp tactical readability while giving torches, stained glass, and explosions a genuine luminous halo on hardware GPUs.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Top HUD Bar & Keyboard (L)                        │
│     [ Lighting Mood Button: Auto · Šerosvit · Bouře · Obléhání ]        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ setLightingMood() / Snapshot
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Game Controller & State                         │
│  • Tracks active LightingMood ("auto" | "chiaroscuro" | "storm" | ...)  │
│  • Emits combat light triggers (muzzle flash, blast, lightning, thunder)│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ updateAndRender(dt, view, ...)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    3D Atmospheric Lighting Engine                       │
├───────────────────────────────────┬─────────────────────────────────────┤
│  1. Mood & Sky Interpolator       │  2. Dynamic Light Rig & Pools       │
│  • Smoothly damps FogExp2,        │  • Swaying Torch Braziers (Perlin)  │
│    Hemisphere, Moon Key, Siege    │  • Pooled Combat Flash PointLights  │
│    Rim & Exposure per phase/mood  │  • Storm Lightning Directional Spike│
├───────────────────────────────────┼─────────────────────────────────────┤
│  3. Volumetric & Mist Shaders     │  4. Wet Surface & Bloom Pipeline    │
│  • Stained-Glass & Moon God-Rays  │  • Rain-Ripple Puddle PBR Shader    │
│    (Fresnel + dust-mote GLSL)     │  • Dynamic Vltava Specular Shimmer  │
│  • Drifting Street Mist Billboards│  • EffectComposer + UnrealBloomPass │
└───────────────────────────────────┴─────────────────────────────────────┘
```

- **Data Model & State**:
  - `LightingMood`: `"auto" | "chiaroscuro" | "storm" | "siege" | "mist"` stored in UI state and exposed on `Snapshot` (`lightingMood` and `lightingMoodLabel`).
  - `CombatLightEvent`: Lightweight descriptor derived from active `Fx` items (`line` for firearm muzzle + impact flash, `ring` for grenade/petard explosion light, `slash` for steel spark glint) mapped onto a 4-light transient pool.
  - `LightningState`: Tracks `nextStrikeTimer`, `flashIntensity`, `doublePulsePhase`, and `strikeAzimuth` to drive sky background flashes, directional shadow sweeps, and synthesized thunder rumbles.

- **Interactive Component & State Mapping**:
  - **Top HUD Lighting Control (`App.tsx` → `GameHandle.cycleLightingMood`)**: Clicking the button or pressing `L` advances `lightingMood`, updates the Czech label in the header, and immediately notifies the 3D scene.When switched to `"storm"`, triggers an immediate dramatic introductory lightning flash.
  - **Phase-Driven Auto Transitions (`scene3d.ts`)**: When `lightingMood === "auto"`, the target palette responds to `view.phase` (`briefing`/`flight` → Chiaroscuro, `dock` → Vltava Mist, `hold` → Crimson Siege Storm with heightened lightning frequency).
  - **Audio Integration (`audio.ts`)**: Adds a procedural `thunder` sound synthesis routine (filtered low-frequency brown-noise rumble with exponential decay) triggered on major lightning strikes when audio is unmuted.
