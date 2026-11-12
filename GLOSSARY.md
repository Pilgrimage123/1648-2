# Praha 1648

Turn-based tactical strategy in the spirit of XCOM 2, set in Prague in 1648 during the Swedish assault. The player plays the Jesuit Father Jiří Plachý and through him commands the Železná vigilie, an elite company drawn from different parts of society, with the Clementinum as its base. The work is told from a Catholic perspective and holds faith together with Jesuit learning and the other science of the age (ADR-0014, ADR-0016). The game features two authentic scenarios: Mission 1 (the night assault of July 25/26 on Malá Strana and the palace rescue of Field Marshal Colloredo) and Mission 2 (the morning defense of the Old Town Bridge Tower, the lowering of the portcullis, and the Latin Marian inscription ward on Charles Bridge), both played on a multi-floor 3D grid with hot-swappable 2D billboard sprites and 3D models, and a 17th-century XCOM-2 Aiming HUD and Shot Breakdown.

## Language

### User Interface & HUD

**Tactical Action Ribbon** (*Taktická akční lišta*):
The unified floating bottom-center command strip combining selected soldier vitals, numbered action buttons (`[1] Move`, `[2] Shoot`, `[3] Overwatch`, `[4] Grenade`), turn termination (`[Space]`), and squad quick-select tabs.
_Avoid_: Action bar, bottom command panel, button dock

**Tutorial Order Banner** (*Rozkazový pruh skriptovaného výcviku*):
The floating top-center Baroque cartouche directive strip inspired by XCOM 2 (Operation Gatecrasher) that delivers explicit tactical orders, diegetic speaker portraits, step progression badges, live rejection warnings, and veteran bypass controls (`[Shift+H]`).
_Avoid_: Tutorial popup, tip window, helper banner

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
The four-state dynamic camera director inspired by XCOM 2 that transitions seamlessly between bird's-eye Tactical Isometric View (for 1 AP moves and automatic roof cutaway), low Over-the-Shoulder Sprint Cam (for 2 AP dashes, door breaches, vaults, and staircase climbs), mid-movement Event Interrupts (Pod Reveal & Scramble, Overwatch Slow-Mo), and Cover Settle Reset.
_Avoid_: Follow cam, static chase cam

**Over-the-Shoulder Sprint Cam** (*Filmová kamera za ramenem při sprintu*):
The low-angle third-person camera state triggered during 2 AP dashes and environmental interactions (breaching doors, vaulting low cover, climbing stairs) that flies directly behind the running soldier's shoulder with subtle footstep camera shake and obstacle avoidance.
_Avoid_: Zoomed isometric cam, static shoulder cam

**Pod Reveal & Scramble** (*Odhalení hlídky a rozprchnutí do krytu*):
The mid-movement cinematic interrupt triggered when a moving soldier spots a previously unalerted group of Swedish musketeers in the fog of war: the soldier pauses on the discovery tile while the camera pans and zooms to the revealed patrol as they scramble into nearby cover before returning to the soldier.
_Avoid_: Passive fog reveal, instant enemy spawn

**Overwatch Slow-Mo** (*Zpomalený přepad ze zálohy*):
The mid-movement cinematic interrupt triggered when a moving unit crosses an enemy Overwatch sightline outside full cover: time slows down, the camera frames the ambushing musketeer firing in a cloud of black-powder smoke, and then closely tracks the running soldier as the shot arrives before resuming remaining movement.
_Avoid_: Post-movement reaction shot, instant overwatch hit

**Cover Settle & Reset** (*Zakleknutí do krytu a návrat kamery*):
The concluding movement beat in which a soldier arriving at a cover tile performs a brief kneeling or bracing posture against the obstacle before the camera smoothly returns to Tactical Isometric View.
_Avoid_: Instant camera snap, abrupt stop

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
A 3D discrete position `{ x: number, y: number, z: number }` where `x` is `0..23`, `z` is `0..27`, and `y` is the floor (`0` = ground, `1` = Piano Nobile and belvedere, `2` = Maltese watchtower).
_Avoid_: 2D `{ x, y }` tile coordinate, screen pixel coordinate

**Tile**:
A single cell in the 3D `GridSystem` storing `walkable: boolean`, `isLadder: boolean` (vertical connector across `y = 0`, `1`, and `2`), directional `cover` for all 4 cardinal directions (`N, E, S, W` with `'none' | 'half' | 'full'`), `obstacle` (`'none' | 'low_wall' | 'high_wall' | 'pillar' | 'powder_keg'`), and `smokeTurns: number` (duration of black-powder smoke cloud on the tile).
_Avoid_: Node, cell

**Floor Cutaway** (*Přepínání pater*):
The visual and interactive filter controlled by `activeFloor` (`0 | 1 | 2`) via `V` or `PageUp/PageDown`: when viewing ground floor (`y = 0`), upper floor geometry (`y > 0`) becomes ghosted/hidden and non-intercepting so it does not occlude the interior.
_Avoid_: Roof toggle, camera clip

**Floor Cutaway Fog Blackout** (*Zatemnění neprozkoumaných pater*):
The rule that unvisited and unseen upper floors remain in complete Terra Incognita darkness when the camera cutaway level is raised, preventing camera-based scouting through solid ceilings.
_Avoid_: Black roof, cutaway shroud

**Vertical Light Shaft** (*Vertikální světlík / Průhled šachtou*):
An architectural opening between floors (courtyard well `Cour d'honneur`, open Sala Terrena archway, staircase void) through which light, line of sight, and explosion illumination travel bidirectionally.
_Avoid_: Ceiling hole, vertical window

**Wall Stub** (*Sokl zdi*):
The low (0.35m) perimeter masonry remnant left at ground level when camera-facing walls are culled, preserving tactical room boundary reading and cover lines without occluding interior units.
_Avoid_: Wall footing, cut wall, low border

**Cursor Drop Line** (*Svislá kotva kurzoru*):
The vertical projection beam dropping from an elevated tile cursor or stair span down to the ground plane, preventing isometric vertical parallax errors.
_Avoid_: Cursor pillar, drop tether

**Unit Visual Ghosting** (*Duch jednotky na patře*):
The semi-transparent (~30% opacity) rendering of spotted units positioned on floors above the active cutaway level, maintaining tactical awareness while keeping lower-floor tiles clickable and unobstructed.
_Avoid_: X-ray unit, phantom soldier

**Elevation Badge** (*Výškový štítek*):
The directional tactical badge (`▲ +1`, `▼ -1`) anchored to a unit's health bar indicating elevation difference relative to the current camera floor view, auto-hiding when on the active floor.
_Avoid_: Floor indicator, height tag

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

**Edge Peeking** (*Vyklonění přes balustrádu*):
The tactical rule allowing a unit positioned adjacent to a floor edge or low parapet to lean outward by 0.35m to achieve vertical line of sight into lower courtyards without being blocked by its own floor.
_Avoid_: Balcony peek, edge lean

**High Ground Advantage** (*Výšková převaha*):
The tactical marksmanship modifier granting +15% hit chance and partial cover bypass when firing downward from an elevated floor (`shooter.y > target.y`).
_Avoid_: Elevation bonus, height buff

**Pre-Move LoS Crosshair** (*Prediktivní zaměřovač cílů*):
The dynamic reticle indicator displayed over enemy units and within the Target Ribbon when hovering a potential movement destination, confirming weapon range and line of sight before moving.
_Avoid_: Move target preview, sightline icon

**Smoke Horizon Piercing** (*Průhled z výšky přes přízemní dým*):
The vertical vision rule allowing marksmen stationed on elevated floors (`shooter.y > target.y`, such as the Piano Nobile balcony or Maltese Watchtower) to spot and target enemies through low-lying ground smoke with a reduced -20% accuracy penalty rather than complete LoS blockage.
_Avoid_: Smoke bypass, high vision

**Stairway Recon Preview** (*Predikce průzkumu na schodišti*):
The movement hover indicator calculating anticipated field-of-view and enemy alerts on an unexplored floor before committing an action point to ascend a staircase or ladder.
_Avoid_: Stair preview, ladder check

**Poslední vzepětí** (*Death Throes* / *Mortally Wounded Last Stand*):
The universal agonal state entered by any unit (Swedish soldier or Prague defender) upon suffering lethal damage (reaching $\le 0$ HP without exceeding the instant-death overkill threshold of $\le -(maxHp + 1)$), granting them exactly one final turn of active actions before collapsing dead.
_Avoid_: Bleeding out, downed state, martyr frenzy, second wind

### 17th-Century Aiming HUD & Shot Breakdown System

**Target Ribbon** (*Seznam cílů*):
The horizontal bar of visible enemy icons at the bottom-center of the screen in aiming mode (`Tab` / `Shift+Tab` cycling):
- **Yellow Icon**: Target is **Flanked** (*V obchvatu*) or standing in the open without cover on the incoming fire angle.
- **Red Icon**: Target is protected by **Half Cover** (*Poloviční kryt*: fence, low wall, shallow trench `-20%`) or **Full Cover** (*Plný kryt*: gabion, wagon wall, stone wall `-40%`).
- **Slate/Blue Icon**: Target is visible in **Extreme Range** (*Extrémní dostřel*) with heavy smoothbore distance falloff.

**Shot Calculation Result** (`ShotCalculationResult`):
The structured output of the 17th-century combat calculator containing final metrics (`hitChance`, `critChance`, `minDamage`, `maxDamage`, `armorPierce`, `armorShred`, `misfireChance`, `expectedHpLossMin`, `expectedHpLossMax`, `expectedArmorLoss`) and two itemized arrays of `StatModifier` entries (`hitModifiers` and `critAndArmorModifiers`) for the expandable **Breakdown Wings** (the Rozpad button and its hover).

**Inspect Dossier** (*Úplný přehled*, `F1` / `0`):
The full sheet for a soldier, enemy, door, or tile. A tap shows the selected soldier, or the aimed enemy while targeting. Holding `F1` or `0` and clicking inspects that hero, enemy, or terrain without spending an action or opening a door. A fog-hidden enemy shows only the sound contact. An unexplored tile stays blank.
_Avoid_: Tooltip, breakdown wings

**Black Powder Smoke** (*Kouř z černého prachu*):
A dense cloud left on a tile after firing a black-powder weapon or detonating a grenade. A shooter standing in smoke takes `-10%` aim. A target standing in smoke takes `-15%` to hit (`+15` defense). Firing downward through ground smoke, while the shooter is not in smoke, takes only `-20%` (Smoke Horizon Piercing).

**Cumulative Smoke Concealment** (*Kumulativní clona kouře*):
The tactical visibility rule where a 3D Bresenham line of sight traversing $\ge 2$ consecutive black-powder smoke tiles is completely severed, blocking direct targeting and overwatch reactions. Elevated shooters with High Ground retain partial visibility (Smoke Horizon Piercing) through up to 2 smoke tiles at a `-20%` aim penalty.
_Avoid_: Smoke invisibility, total blindess

**Smoke Overwatch Disruption** (*Přerušení hlídky kouřem*):
The tactical rule where an unbroken line of sight required for an Overwatch reaction shot is immediately broken if the moving target passes into or behind a dense black-powder smoke cloud, suppressing the ambush trigger.
_Avoid_: Smoke dodge, overwatch cancel

**Black-Powder Choking Debuff** (*Zadýmení a záchvat kašle*):
The environmental condition applied to any soldier ending their turn inside an enclosed, unventilated room (`isEnclosedRoofedCoord`) with active black-powder smoke (`smokeTurns > 0`), causing `-1 Mobility` on the following turn due to acrid sulfurous fumes.
_Avoid_: Poison gas, toxic cloud

**Blast Shockwave Displacement** (*Rázová vlna výbuchu*):
The physical blast dynamic where an explosive detonation (powder keg, grenade) instantaneously purges smoke and airborne dust from its epicenter ($r \le 1$), propelling a concentrated ring of smoke, soot, and masonry debris into the surrounding perimeter tiles ($r = 2..3$).
_Avoid_: Explosion blow, smoke despawn

**Indoor Smoke Stagnation** (*Vnitřní stagnace kouře a prachu*):
The environmental rule governed by `isEnclosedRoofedCoord` wherein smoke and masonry plaster dust inside enclosed palace halls persist for 3–4 turns and bleed horizontally through open doorways, whereas outdoor garden smoke dissipates in 2 turns (or 1 turn during rain).
_Avoid_: Indoor persistence, infinite smoke

**Unified Chiaroscuro Particle Field** (*Sjednocené částicové pole šerosvitu*):
The shared instanced soft-particle rendering pipeline blending sulfurous black-powder smoke (`#1e293b` to `#334155`), pale masonry plaster dust (`#d6d3d1`), and explosive amber flashes (`#f97316`) into a depth-faded, non-occluding volumetric atmosphere that honors the 60-30-10 color rule and preserves tactical grid readability.
_Avoid_: Per-tile smoke meshes, billboard sprites

**Combat Atmosphere Field** (`CombatAtmosphereField`):
The consolidated instanced particle manager mounted in `TacticalScene.tsx` managing up to 600 soft-depth quads across three distinct behavioral buffers (dense ground smoke, light tumbling masonry dust, and buoyant embers).
_Avoid_: Particle manager, scene effects container

**Dynamic Light Flash Pool** (*Fond dynamických záblesků*):
The strict hardware-safe lighting queue managing at most 2 concurrent blast point lights (`#f97316`) and 1 muzzle flash point light (`#fde047`) that directly injects position and intensity uniforms into atmospheric shaders for volumetric forward-scattering.
_Avoid_: Explosion light spawner, unlimited point lights

**Point-Blank Proximity Rule** (*Výjimka kontaktního dosahu v kouři*):
The tactical rule permitting units within contact distance ($\le 1.5$ tiles) to maintain direct line of sight and target one another through dense smoke, subject only to close-quarters firearm penalties.
_Avoid_: Smoke melee bypass, blind stab

**Cuirassier Respiratory Resistance** (*Odolnost těžké zbroje proti zadýmení*):
The passive environmental immunity possessed by armored soldiers with intact cuirasses and morion helmets (`armor > 0 && hp === maxHp`), nullifying the indoor Black-Powder Choking mobility debuff.
_Avoid_: Gas mask, poison immunity

**Muzzle Flash & Sound Contact** (*Zábleskový a zvukový kontakt v kouři*):
The tactical Fog of War event triggered when a weapon fires from behind or within dense smoke ($\ge 2$ smoke tiles): direct line of sight remains blocked, but a fleeting sound/flash indicator appears at the source coordinate for 1 round without revealing the unit's exact model, stats, or health.
_Avoid_: Full smoke reveal, invisible gunshot

**Through-Draft Portal Venting** (*Průvanové odvětrávání portálů*):
The environmental dissipation rule wherein smoke tiles within 2 tiles of an open exterior doorway or breached facade (`isDoorOpen === true` bordering garden tiles) dissipate at double speed (decrementing `smokeTurns` by 2 per round) due to natural courtyard cross-drafts.
_Avoid_: Instant smoke clear, draft wind cheat

**Musket Rest / Fork** (*Furketa*):
A fork stand used by the heavy matchlock (`supportsRestFork`). A prepared shot costs `2 AP` and adds no aim bonus. If the shooter has already moved or has only `1 AP` left, the same musket may hip-fire for `1 AP` at `-35%` aim and the shooter becomes Shaken. Swedish muskets and wheellocks fire for `1 AP` and do not use the fork.

**Misfire Chance** (*Šance na selhání výstřelu*):
The probability (`0–100%`) that a 17th-century firearm fails to discharge due to damp black powder or a sputtering matchcord, scaled by lock mechanism (`matchlock` doutnákový vs. `wheellock` kolečkový) and `WeatherState` (`clear` *Jasno*, `fog` *Mlha*, `rain` *Déšť*).

**Armor Cuirass & Pierce/Shred** (*Kyrys, Průraz a Zničení zbroje*):
Armor points (`armor / maxArmor`) worn by 17th-century soldiers (cuirass, morion helmet) that absorb incoming damage unless bypassed by the weapon's `armorPierce` or permanently destroyed by `armorShred`. Armor also reduces incoming critical hit chance by `-8%` per armor point.

### The Iron Vigil and the Clementinum (ADR-0014, ADR-0016)

**Železná vigilie** (*The Iron Vigil / Fidelitas Ferrea*):
The elite company the player commands in Prague in 1648. Jesuit Father Jiří Plachý organizes it from the Clementinum, drawing individuals from different parts of society — university students, seasoned veterans, burghers, artisans, and fighters from Prague's underworld — and binding them by a blood-and-iron oath to hold the Old Town Bridge Tower and Charles Bridge.
_Avoid_: Jesuit militia, student guard, holy order, mercenary band

**Jiří Plachý**:
The Jesuit the player plays. He organizes the Iron Vigil from the Clementinum, inducts its members, and fights with it. If he falls, the mission he is in is lost.
_Avoid_: Commander, Central, off-screen organizer

**Klementinum** (*Clementinum*):
The Jesuit college in Prague's Old Town, and the base of the Iron Vigil.
_Avoid_: Avenger, ship, strategic-layer HQ

**Víra a věda** (*Faith and learning*):
The twin emphasis of the work: Catholic faith, together with Jesuit learning and the other science of the age. The two support each other.
_Avoid_: Faith versus science, reason against the Church, secular research

### Mission 1: Escape of the Grand Prior (Mise 1: Útěk polního maršála)

**Švédské zajetí a výkupné** (*Ransom & High-Value Capture Directive*):
The historical Swedish objective orchestrated by Hans Christoph von Königsmarck and Ernst Odowalsky to encircle and capture Bohemia's supreme commander and wealthy nobility alive for immense ransom (over 100,000 thalers) and strategic paralysis, prioritizing subduing and encircling Colloredo over executing him.
_Avoid_: Assassination target, kill contract

**Paradoxical Martyrdom** (*Paradoxní oběť*):
The tactical and narrative dilemma where the player chooses which escort companion stays behind to hold the palace gate in a suicidal rear-guard action; that companion miraculously survives the carnage, while the other two who boarded the escape skiff perish shielding Marshal Colloredo from Swedish riverbank fire, forging the lone survivor into the Iron Vigil.
_Avoid_: Random death, scripted casualty, cutscene wipe

**Rybářská pramice** (*Fisherman's Skiff / Úniková zóna*):
The wooden skiff moored at the Čertovka dock. Escape tiles are `(3, 0, 2)` and `(4, 0, 2)`. Tiles with `x` `0..18` and `z` `0..2` are canal water and are not walkable. The tutorial beacon and the boat model both bind to the first escape tile, `(3, 0, 2)`.

**Zranění z Lützenu** (*Marshal's Mobility Handicap*):
The permanent war handicap (7 bullet wounds from Lützen 1632) restricting Marshal Colloredo to 3 movement tiles per AP. Standing next to Jan Matěj, Václav z Michalovic, or Bratr Bartoloměj does not raise that pace. While detained, his `movePerAp` drops to 0 until the companions free him.

**Mission 1 abilities**:
No Mission 1 unit is given an activatable special ability. `ability` stays unset, so the `[5]` path (`marshal_command`, `protector_oath`, `klementinum_verdict`, `maltese_shrapnel`) does not run in this scenario. Weapon weight does apply: soldier pace is `7 - mobilityPenalty` (carbine and Swedish musket `5`, heavy musket `4`). Colloredo's limp overrides his pistol's penalty.

**Autorita polního maršála** (*Marshal Command Aura*):
The tactical presence of Bohemia's supreme commander granting a +8% marksmanship modifier to nearby allied imperial soldiers within 7 tiles.

**Prachový sud** (*Explosive Powder Keg*):
Destructible black-powder storage barrels placed on the battlefield that explode in a 3×3 radius (5 damage, 2 armor shred, and thick smoke) when struck by heavy shots, petards, or secondary blast waves.

### Mission 2: The Portcullis (Mise 2: Mříž) (ADR-0016)

**Mise 2: Mříž** (*The Portcullis*):
The defense of the Old Town Bridge Tower on the morning of 26 July 1648. Father Jiří Plachý comes from a vision of St Vitus and St Wenceslas on that tower and fights it with Havel Řezáč and Ondřej Štěrba. No one from Mission 1 is on the field.
_Avoid_: Mission 1 roster, Colloredo's escort

**Havel Řezáč**:
A butcher's journeyman with a cleaver and an apron. He holds the last tiles of the gate mouth that harriers may still reach, and his body blocks the stair. The alarm caught him on the square. He is not yet sworn to the Iron Vigil.
_Avoid_: Mission 1 companion

**Ondřej Štěrba**:
A thief of ropes and roofs. He releases the windlass faster than anyone else on the tower. The alarm caught him on the square. He is not yet sworn to the Iron Vigil.
_Avoid_: Mission 1 companion

**Patra mostecké věže** (*Floors of the Bridge Tower*):
Three floors, `y = 0 | 1 | 2`. Ground is the passage, the Threshold, the near bridge, and Křižovnické náměstí. The middle floor is the windlass chamber, one stair, and the loopholes over the bridge. The gallery under the roof holds the statues of St Vitus, St Wenceslas, and St Sigismund, and the inscription *Signa te, signa…*. West is the bridge. East is the square. There are no side streets, no cellar, and no fourth floor. At the start the harriers are on the bridge and the tower is still held. Rain from the night of Mission 1 still falls on the open bridge. The stair and the windlass chamber are roofed and dry.

**Ochrana věže** (*Tower Ward*):
The holy hold on the Old Town Bridge Tower. While it holds, Swedish harriers cannot cross the threshold into the tower or Křižovnické náměstí; a shimmering golden Marian ward effect manifests along the threshold archway (*Signa te, signa...*). Father Plachý names it grace; the Swedish occultist treats it as a formula he alone can undo.
_Avoid_: Spell slot, magic item, activated trap

**Práh** (*Threshold*):
The outer line of the Tower Ward, on the bridge side of the gate (`x = 9`). Harriers stop on it, shoot across it, and fling pitch from it. The occultist's rite is done on its keystone (`x = 9, y = 0, z = 14`), on the bridge side.
_Avoid_: Trigger volume, hitbox

**Harcovník** (*Swedish Harrier*):
A demonic Swedish skirmisher on foot, without a horse, inhumanly fast, with few hit points, no cuirass, and a short blade. He covers the playable bridge in one action, stands on the Threshold, hurls incendiary pitch at the timber windlass, suppresses the archway, and strikes with cold steel in melee.
_Avoid_: Cavalry, horse, ordinary musketeer

**Švédský okultista** (*Swedish Occultist*):
The one man who can unbind the Tower Ward. He walks slowly, several turns behind the harriers. His silhouette is the sectoid: mitre low on the brow, back-banner, censer, and parchment seals. He is not Arnošt Odowalsky. Father Plachý wears a black mantle, a biretta low on the brow, and the iron gorget, and he does not carry a censer.
_Avoid_: Demon prince, second occultist, Odowalsky

**Obřad** (*Unbinding Rite*):
Three uninterrupted turns by the Swedish occultist on the keystone, marked by billowing sulfurous censer smoke and dark unbinding glyphs. A hit, or being forced off that tile, resets the count. His death ends the rite for the mission.

**Naviják** (*Windlass*):
The timber winch housing on `y = 1` (`x = 11, y = 1, z = 14`). Operating it unpins the safety locking pawl to transfer the full portcullis load onto the hoisting cable. Ondřej Štěrba unpins it in one turn; other defenders need two turns. Incoming wounds stall the active turn's effort rather than wiping past progress. Destroying the windlass (18 HP) before the cable is severed loses the mission.
_Avoid_: Winch engine, automatic crane

**Přetnutí lana** (*Severing the Hoisting Cable*):
The final mechanical act that drops the iron portcullis. Once the windlass pawl is freed, the taut hemp cable on `y = 1` (`x = 12, y = 1, z = 14`) can be severed for 1 AP by Father Plachý (or any defender wielding a knife or cleaver), immediately dropping the gate.
_Avoid_: Rope cut quicktime, cord pull

**Smolná láhev** (*Incendiary Pitch Flask*):
A throwable ceramic vessel filled with burning black pitch used by Swedish harriers at the threshold. Deals 3 ongoing burn damage per round to the wooden windlass across a 3-tile range unless doused by an adjacent defender on `y = 1` for 1 AP.
_Avoid_: Molotov cocktail, fire grenade

**Střílny a podsebití věže** (*Machicolation Loopholes*):
The western embrasures and plunging floor openings on `y = 1` and `y = 2` that give defenders half-cover and clear line of sight with High Ground Advantage (+15% aim) down onto the bridge deck and threshold.
_Avoid_: Balcony window, sniper ledge

**Pokleknutí u nápisu** (*Kneeling at the Inscription*):
Once in the mission, Father Plachý spends 1 AP to kneel at the inscription on `y = 2`. The ward then requires one more turn of the rite. It is a tile, not a ribbon ability.

**Mříž** (*Portcullis*):
The iron grate over the passage. Seating it while the Tower Ward still holds wins the morning. The occultist is then dead or shut on the bridge. Harriers left beyond the iron are not cleared.
_Avoid_: Spell barrier, magic gate, bridge cleanup

**Prohra Mříže** (*Loss of the Portcullis*):
The rite finishes before the grate seats, or Father Plachý falls, or every defender falls, or the windlass is destroyed before release. A fallen ward ends the mission at once.
_Avoid_: Second phase, interior mop-up

**Přísaha po Mříži** (*Oath after the Tower*):
In the Clementinum afterwards, Plachý offers the blood-and-iron oath to Havel Řezáč and Ondřej Štěrba if they live. The player accepts both, either, or neither. Refusal leaves the man named. Death enters the chronicle. Plachý receives oaths. He does not swear as a novice.

### Baroque Art Direction, Environmental Biomes & Ballistics (ADR-0007)

**Barokní šerosvit** (*Chiaroscuro Lighting*):
The Caravaggio/Rembrandt lighting hierarchy contrasting the brightly illuminated playable mid-ground (golden God-rays, warm torchlight) against deeply shadowed non-playable map borders and foreground vignettes.

**Praktické světlo** (*Practical Light*):
Illumination that begins at a visible flame or flash — a beeswax candelabrum in Colloredo's house, a wrought-iron torch, the skiff lantern, a burning matchcord, or a muzzle flash — and falls off with distance. Rain gutters flames that stand in the open. Candles under the palace roof keep their strength. A wheellock stays dark until it fires.
_Avoid_: Ambient fill, orphan point light, global sun

**Pravidlo barev 60-30-10** (*60-30-10 Color Rule*):
The strict color allocation across the scene: 60% desaturated calm ground & atmosphere (slate, mud, ash, warm muted limestone parquet), 30% secondary architectural structures (weathered sandstone, palace stucco, dark timber rafters), and 10% saturated tactical/heraldic accents (royal gold, scarlet crimson, cobalt blue, warm torch orange) restricted exclusively to units, active cover, explosive hazards, and objectives.

**Jazyk tvarů** (*Top-Down Class Silhouettes*):
The rule that all 5 unit archetypes (`ranger`, `sniper`, `trooper`, `sectoid`, `commander`) are immediately distinguishable from a bird's-eye view by their silhouette (tall triangular polearms, wide plumed cavalier hats with capes, square cuirassier pauldrons with morions, asymmetric back-banners with censers) and that all headgear sits physically low on the brow covering the upper cranium.

**Nevypleněný honosný palác** (*Unplundered Opulent Palace Biome*):
The intact interior of the Grand Priory Palace (`x: 2..21`, `z: 16..27`, `damageLevel === 0`) characterized by warm polished limestone parquet (`stone_floor`), a central cardinal-burgundy royal runner (`palace_carpet`) with flat gold brocade borders, cream-stucco masonry, gilded Corinthian pillar capitals, carved walnut furniture barricades, and framed Chiaroscuro oil paintings. The Piano Nobile occupies the same footprint at `y = 1`. The garden belvedere is `y = 1`, `x: 9..14`, `z: 9..12`. The Maltese watchtower is `y = 2`, `x: 4..8`, `z: 17..19`.

**Zaprášená malostranská ulice a nádvoří** (*Dusty Street & Courtyard Biome*):
The Grand Priory garden (`z: 5..15`, `x: 1..22`, `damageLevel === 0`) characterized by cool matte slate-mud cobblestones (`cobble`), weathered mossy sandstone walls, and rough field stone gabions. The Čertovka canal is `z: 0..4`.

**Zdevastovaná rozstřílená ruina** (*Devastated Shot-Up & Scorched Ruin Biome*):
The dynamic battle-scarred state (`damageLevel: 1 | 2`, `rubble` / `scorched_ruin`) applied to any tile struck by gunfire (`damageLevel = 1`, fallen plaster/mortar rubble) or a 3×3 explosion (`damageLevel = 2`, charred soot crater, glowing ember cracks, blackened neighboring walls, and low-profile perimeter debris that keeps the tile center clear for tactical grid readability).

**Krytý palácový interiér** (*Enclosed Roofed Masking* / `isEnclosedRoofedCoord`):
The spatial boundary excluding enclosed rooms from outdoor rain and snow. Palace halls count when `y ≤ 1`, `x` is `1.5..21.5`, and `z` is `15.5..27.5`, except the open courtyard (`x` `9.6..13.4`, `z` `17.6..20.4`). The ground-floor belvedere arcade counts when `y < 1`, `x` is `8.5..14.5`, and `z` is `8.5..12.5`. Ash and dust stay at zero indoors until gunfire or explosions create `blastZones` and `smokeTiles`.

**Organické šíření prachu a dýmu** (*Causal Combat Diffusion* / `blastZones`):
The physical rule that indoor and courtyard ash, plaster dust, embers, and creeping ground mist start at zero before combat and expand radially outward ($R(t) = \min(R_{\max}, R_0 + v_{\text{diff}} \cdot \Delta t)$) exclusively from actual gunfire and explosion epicenters.

