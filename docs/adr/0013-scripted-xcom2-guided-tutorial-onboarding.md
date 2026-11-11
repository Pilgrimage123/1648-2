# 0013. Scripted XCOM 2 Guided Tutorial Onboarding

Date: 2026-11-11
Status: Accepted (Supersedes & Extends ADR-0005)

## Context

Mission 1 ("Útěk maršála Colloreda z Velkopřevorského paláce 1648") serves as the initial scenario of *Praha 1648*. While ADR-0005 established a diegetic floating tutorial, player testing revealed that passive floating corner widgets are easily overlooked or misunderstood. Players frequently moved units into open ground without cover, skipped fázové nabíjení, or failed to grasp Colloredo's permanent limp and the Swedish capture mechanic.

In classic turn-based strategy benchmarks such as *XCOM 2 (Operation Gatecrasher)*, the introductory mission is firmly scripted and on-rails for the first two rounds, ensuring players execute core tactics (movement to full cover, flanking elevation shots, explosives against entrenched positions, segmented reloading, and melee finishes) before transitioning to autonomous tactical command.

## Decision

Implement an on-rails, scripted onboarding architecture modeled after XCOM 2:

1. **Guided Tutorial State Machine (`GuidedTutorialSystem.ts`)**:
   - 9 granular micro-steps spanning Rounds 1–3:
     - `step_1_matej_move`: Jan Matěj moves to bedroom balustrade (`[6, 1, 20]`, Blue 1 AP vs Yellow 2 AP, Half/Full Cover).
     - `step_2_colloredo_escort`: Count Colloredo moves to protected escort position (`[5, 1, 21]`, 3-tile limp & Swedish capture/ransom rules).
     - `step_3_vaclav_aim`: Václav z Michalovic targets flanked sentry from 1st-floor arcade (`[12, 1, 10]`, High Ground +15% & Flanking +40% Crit).
     - `step_4_vaclav_shoot`: Aim breakdown verification and cinematic over-the-shoulder shot.
     - `step_5_enemy_turn_react`: Enemy turn demo — Swedish counterfire ricochets off stone balustrade, demonstrating cover efficacy.
     - `step_6_vaclav_reload`: Segmented reloading (`[R]`, 1 AP per step) for black powder firearms.
     - `step_7_keg_explosion`: Bratr Bartoloměj detonates powder keg (`[7, 0, 13]`) via petard `[4]`, destroying heavy cover across 3×3 tiles.
     - `step_8_melee_finish`: Right-click Melee Rush (`PKM`) to eliminate stunned enemy with cold steel without expending powder.
     - `step_9_free_combat`: Multi-floor cutaway (`[V]`) and unconstrained tactical retreat to Čertovka dock (`[3, 0, 2]`).

2. **Top-Center Directive Banner (`TutorialOrderBanner.tsx`)**:
   - Baroque Chiaroscuro cartouche displaying speaker portrait, role, step title, imperative tactical order, and expandable tactical lessons.
   - Live diegetic rejection alerts (`rejectFeedback`) when an invalid tile is targeted.

3. **In-World 3D Guidance (`InstancedBattlefield.tsx` & `TacticalActionRibbon.tsx`)**:
   - Glowing directional waypoint beacons on destination tiles, flanked enemies, powder kegs, and extraction docks.
   - Amber-gold pulsing action ribbon highlights on the designated action button (`[1] Move`, `[2] Shoot`, `[R] Reload`, `[4] Grenade`, `[B / PKM] Melee`).

4. **Input Guard & Veteran Bypass**:
   - Tile movements are constrained to safe tutorial waypoints during Steps 1 & 2.
   - Veteran players can skip the guided sequence at any time via `Shift+H` or the "Přeskočit výcvik" button, instantly unlocking full tactical freedom (`step_9_free_combat`).

## Consequences

- 100% reliable onboarding: Novice players cannot blunder into immediate open-ground deaths.
- Mechanical transparency: Period-authentic 17th-century ballistics and tactical rules are demonstrated directly through gameplay actions.
- Zero friction for returning players via instant one-click skip.
