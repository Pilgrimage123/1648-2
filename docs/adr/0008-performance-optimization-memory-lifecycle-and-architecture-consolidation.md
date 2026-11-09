# 8. Optimalizace výkonu, paměťový životní cyklus a konsolidace architektury

Datum: 2026-11-09

## Stav

Přijato (vyplynulo z /grill-with-docs auditu chyb, nekonzistencí a výkonu)

## Kontext

Projekt *Praha 1648* kombinuje bezhlavé taktické jádro (GridSystem, CombatSystem, Pathfinding, FogOfWar) s 3D vizualizací v React Three Fiber a plovoucími diegetickými HUD komponentami.
Během hloubkového auditu byly identifikovány klíčové výkonnostní a konzistenční problémy:
1. **Monolitické moduly a bundle size**: `InstancedBattlefield.tsx` (>2300 řádků) a `useGameStore.ts` (>3700 řádků) vytvářely masivní komponentní stromy a chunk o velikosti 1.45 MB.
2. **Three.js VRAM & Raycast overhead**: Tisíce statických meshů bez `raycast={() => null}` a `matrixAutoUpdate={false}` zatěžovaly pointer raycasting při 60/120 Hz.
3. **Web Audio Garbage Churn**: Opakované alokace `new Float32Array` v `createNoiseBuffer` při každém výstřelu/explozi zatěžovaly audio thread a GC.
4. **Alokace v horkých smyčkách (GC Stutter)**: Řetězcové klíče `${x},${y},${z}` v `coordKey` při výpočtech `computeFogOfWar` a `computeReachableTiles`.
5. **Nekonzistence ovládání**: Dokumentace `GLOSSARY.md` uváděla `[F]` pro přepínání pater, zatímco implementace měla `[F]` pro Fullscreen a `[V]` / `[PageUp/Down]` pro patra.
6. **Robustnost HUD přetahování**: `useDraggableHud` postrádal obsluhu `pointercancel` a spolehlivý unmount cleanup.

## Rozhodnutí

1. **Audio Engine Optimization**:
   - Vytvořit statický předpočítaný šumový buffer (Noise Buffer Cache) o délce 2 sekund v `audioSystem.ts`, eliminovat alokace při každém zvuku výstřelu/exploze.
2. **Raycasting & GPU Overhead Elimination**:
   - Všem statickým dekorativním meshům (rámy obrazů, ozdobné lišty, sloupy, světelné kužely, sutiny) nastavit `raycast={() => null}` a u nepohyblivých geometrických celků optimalizovat maticové updaty.
3. **Sjednocení klávesových zkratek & GLOSSARY.md**:
   - Kanonizovat klávesové zkratky: `[V]` a `[PageUp]` / `[PageDown]` pro patra budovy (Floor Cutaway), `[F]` pro celoobrazovkový režim (Fullscreen). Aktualizovat `GLOSSARY.md` a nápovědy v UI.
4. **Stabilizace useDraggableHud**:
   - Přidat posluchač pro událost `pointercancel`, resetovat `isDragging` při blur/unmountu.
5. **Zpřesnění 3D Line of Sight a Bresenham voxel traversalu**:
   - Zajistit konzistentní detekci hran podlah, dveří a překážek mezi patry P0, P1 a P2.

## Důsledky

### Pozitivní
- Hladký běh bez micro-stutteringu při pohybu myši nad bojištěm.
- Eliminace paměťového churnu v audio threadu při salvách a explozích.
- 100% soulad mezi dokumentací `GLOSSARY.md`, tooltipy v UI a chováním klávesnice.
- Bezpečné zacházení s gesty přetahování bez uváznutí stavu.

### Negativní / Rizika
- Nutnost dodržovat pravidlo `raycast={() => null}` pro veškeré nové dekorativní 3D elementy.
