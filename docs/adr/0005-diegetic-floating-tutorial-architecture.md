# 0005. Diegetic Floating Tutorial Architecture

Date: 2026-11-08
Status: Accepted

## Context

Mission 1 ("Útěk maršála Colloreda") serves as the introductory scenario of *Praha 1648*. The game introduces intricate tactical mechanics:
- Action point (AP) expenditure zones (1 AP move vs. 2 AP sprint).
- Severe character handicaps (Colloredo's Lützen wound reducing base movement to 3 tiles/AP).
- The escort assistance mechanic (moving an aide adjacent restores full 5 tiles/AP mobility).
- Environmental cover, flanking bonuses (+40% crit), and aim breakdown mathematics.
- 17th-century period weather mechanics (rain dampening matchlocks while wheellock pistols remain functional).
- Destructible powder kegs and vertical roof combat with floor cutaway (`[F]`).

Traditional intrusive full-screen tutorial popups break immersion, halt the dramatic escape from the Great Prior's Palace, and frustrate experienced turn-based strategy players.

## Decision

Implement a diegetic, floating, and non-blocking tutorial architecture that integrates directly with the XCOM-style peripheral HUD and 3D battlefield:

1. **Tactical Advisor Widget (`TacticalAdvisorWidget.tsx`)**:
   - Anchored on the upper-left, directly beneath `MissionStatusChip`.
   - Diegetic narrative voice: Colloredo's personal servants (Valet Martin & Master Gunsmith Jakub) offer urgent, in-character advice alongside clear mechanical instructions.
   - Prominent keyboard/mouse shortcut badges (`[1]`, `[2]`, `[Tab]`, `[F1]`, `[4]`, `[F]`).
   - Dismissible and togglable at any time using the `[H]` hotkey or the graduation cap icon in the `TacticalUtilitiesCapsule`.
2. **In-World Tutorial Waypoint Beacons (`InstancedBattlefield.tsx`)**:
   - Render pulsing 3D glowing rings on key objectives (escort tile next to Colloredo, powder keg, fisherman's boat).
   - Keeps the player oriented without obscuring tactical vision.
3. **Tactical Action Ribbon Glowing Guides (`TacticalActionRibbon.tsx`)**:
   - Recommended action buttons pulse with an amber/gold border glow during the relevant step (`[1] Move` in Step 1, `[2] Shoot` in Step 2, `[4] Grenade` in Step 3).
4. **Four Progressive Milestones**:
   - **Step 1: Pohyb & Eskorta**: Explains AP movement zones, Colloredo's handicap, and moving Martin adjacent to unlock *Podepřen komorníkem*.
   - **Step 2: Krytí, Obchvat & Míření**: Explains half/full cover, flanking, switching to Aim Mode (`[2]`), target cycling (`[Tab]`), and inspecting shot modifiers (`[F1]`).
   - **Step 3: Počasí & Prachové sudy**: Explains wheellock vs. matchlock reliability in rain and petard/shooting detonation of powder kegs (`[4]`).
   - **Step 4: Patra & Únik**: Explains vertical floor toggling (`[F]`), elevated roof sentries, and guiding Colloredo to the Fisherman's Skiff on Čertovka.
5. **Dual Progression Mechanism**:
   - Steps advance automatically when trigger conditions occur (escorting Colloredo, entering aim mode, exploding kegs).
   - A manual advance button (`[Další krok →]`) is always available to ensure the player is never soft-locked if they choose an alternative tactical approach.

## Consequences

- Players learn authentic 17th-century tactical mechanics naturally within the flow of gameplay.
- Zero screen locking or intrusive modal interruptions.
- Full accessibility for both novice and experienced players.
