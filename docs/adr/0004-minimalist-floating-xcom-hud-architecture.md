# 0004. Minimalist Floating XCOM HUD Architecture

Date: 2026-11-08
Status: Accepted

## Context

The initial game interface used rigid, full-width desktop headers (`TopBar`) and a tall three-column footer (`BottomCommandPanel`), which consumed up to 25% of vertical screen space, obstructed the 3D Malá Strana battlefield, and broke immersion during aim mode transitions.

## Decision

Adopt a minimalist, floating peripheral HUD architecture inspired by *XCOM: Enemy Unknown / XCOM 2*:

1. **Full-Canvas Viewport (100% 3D immersion)**: All fixed full-width bars are eliminated. The 3D R3F canvas extends edge-to-edge.
2. **Floating Peripheral HUD Islands**:
   - **Mission Status Chip (Top-Left)**: Compact badge displaying round, turn state, remaining enemies, and weather.
   - **Tactical Utilities Capsule (Top-Right)**: Minimalist button cluster with hotkey badges (`Q/E` camera, `F` floor cutaway, `M` 2D/3D sprites).
   - **Combat Chronicle Feed (Mid/Top-Right)**: Ephemeral, auto-fading toast notifications for rolls and tactical events with an expandable history drawer.
   - **Tactical Action Ribbon (Bottom-Center)**: A unified, streamlined command ribbon containing selected soldier status, squad quick-select pills directly attached above the soldier badge, and numbered ability buttons (`[1] Move`, `[2] Shoot`, `[3] Overwatch`, `[4] Grenade`, `[Space] End Turn`).
3. **In-Place Morphing Targeting HUD**: Entering aim mode (`shoot`) smoothly morphs the Tactical Action Ribbon into the Target Ribbon with the shooter badge anchored on the left, central shot odds floating directly above, and expandable mathematical Breakdown Wings (`F1`), avoiding abrupt layout shifts.
4. **Cinematic Turn Splash Banner**: High-contrast, ephemeral (~1s) center-screen banner announcing faction initiative transitions ("Tah obránců Prahy", "Tah švédské hlídky") before fading into the top-left chip.
5. **Primary In-World Readability**: Tactical state (cover shields, armor/HP pips, AP dots) is conveyed primarily in 3D world-space through overhead unit plates and dynamic tile hover previews (`1 AP` vs `2 AP SPRINT` with dynamic cover shield).

## Consequences

- Dramatically increased tactical visibility and period atmosphere.
- Unified keyboard-first navigation aligned with standard tactical game conventions.
