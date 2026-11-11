# 0005. Diegetic Floating Tutorial Architecture

Date: 2026-11-08
Status: Accepted

## Context

Mission 1 ("Útěk maršála Colloreda") serves as the introductory scenario of *Praha 1648*. The game introduces intricate tactical mechanics:
- Action point (AP) expenditure zones (1 AP move vs. 2 AP sprint).
- Severe character handicaps (Colloredo's Lützen wound permanently limiting movement to 3 tiles/AP).
- Environmental cover, flanking bonuses (+40% crit), and aim breakdown mathematics.
- 17th-century period weather mechanics (rain dampening matchlocks while wheellock pistols remain functional).
- Destructible powder kegs and vertical combat with floor cutaway (`[V]` / `PageUp` / `PageDown`; `[F]` is fullscreen).

Traditional intrusive full-screen tutorial popups break immersion, halt the dramatic escape from the Great Prior's Palace, and frustrate experienced turn-based strategy players.

## Decision

Implement a diegetic, floating, and non-blocking tutorial architecture that integrates directly with the XCOM-style peripheral HUD and 3D battlefield:

1. **Tactical Advisor Widget (`TacticalAdvisorWidget.tsx`)**:
   - Anchored on the upper-left, directly beneath `MissionStatusChip`.
   - Diegetic narrative voice: Jan Matěj (step 1), Václav z Michalovic (step 2), and Bratr Bartoloměj (steps 3–4) offer urgent, in-character advice alongside clear mechanical instructions.
   - Prominent keyboard/mouse shortcut badges (`[1]`, `[2]`, `[4]`, `[R]`, `[V]`). `F1` and `0` open the inspect dossier and are not a tutorial pulse.
   - Dismissible and togglable at any time using the `[H]` hotkey or the graduation cap icon in the `TacticalUtilitiesCapsule`.
2. **In-World Tutorial Waypoint Beacons (`InstancedBattlefield.tsx`)**:
   - Render pulsing 3D glowing rings on the live powder keg (step 3, palace-side keg `(7, 0, 13)`) and the Čertovka escape dock (step 4, `(3, 0, 2)`). Both coordinates are read from the grid, not hardcoded.
   - Keeps the player oriented without obscuring tactical vision.
3. **Tactical Action Ribbon Glowing Guides (`TacticalActionRibbon.tsx`)**:
   - Recommended action buttons pulse with an amber/gold border glow during the relevant step (`[1] Move` in Step 1, `[2] Shoot` in Step 2, `[4] Grenade` in Step 3).
4. **Four Progressive Milestones**:
   - **Step 1: Pohyb & Eskorta**: Explains mouse selection, blue/yellow movement, Colloredo's permanent 3-tile limp, and the Swedish capture rule.
   - **Step 2: Střelba a zteč**: Explains aim mode (`[2]`), head-icon target selection, and right-click melee.
   - **Step 3: Nabíjení, petardy a sudy**: Explains segmented reload (`[R]`, heavy musket 4 AP, Swedish musket 2 AP, 1 AP per step) and detonating powder kegs (`[4]`). The beacon sits on a real keg.
   - **Step 4: Patra a únik**: Explains floor cutaway (`[V]` / `PageUp` / `PageDown`), the +15% high-ground bonus, and guiding Colloredo to the escape dock `(3, 0, 2)`.
5. **Dual Progression Mechanism**:
   - Steps advance automatically when trigger conditions occur (escorting Colloredo, entering aim mode, exploding kegs).
   - A manual advance button (`[Další krok →]`) is always available to ensure the player is never soft-locked if they choose an alternative tactical approach.

## Consequences

- Players learn authentic 17th-century tactical mechanics naturally within the flow of gameplay.
- Zero screen locking or intrusive modal interruptions.
- Full accessibility for both novice and experienced players.
