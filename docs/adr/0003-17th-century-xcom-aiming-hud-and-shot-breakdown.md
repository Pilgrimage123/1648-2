# 0003. 17th-Century XCOM-2 Aiming HUD & Shot Breakdown System

Date: 2026-11-08
Status: Accepted

## Context

In a Thirty Years' War (1618–1648) tactical strategy, ranged combat involves period-authentic factors beyond modern XCOM cover: smoothbore point-blank bonuses vs. long-range falloff, matchlock vs. wheellock misfires in rain/fog, black-powder smoke clouds from previous volleys, resting heavy muskets on a fork (*furketa*), morale suppression (*Shaken*), and steel cuirasses (*armor pierce* & *armor shred*). Players need both an immediate central summary and expandable mathematical breakdown wings (the Rozpad button and its hover) plus an over-the-shoulder camera and blinking HP/Armor loss preview on the target. `F1` and `0` open the inspect dossier.

## Decision

1. **Data Architecture (`ShotCalculationResult` & `StatModifier` in `/src/core/types.ts`)**:
   - Every modifier is represented as a typed `StatModifier` (`id`, `label`, `description`, `value`, `unit: '%' | 'HP' | 'ARMOR'`, `kind: 'bonus' | 'penalty' | 'base' | 'neutral'`).
   - `ShotCalculationResult` exposes both clamped aggregate percentages (`hitChance`, `critChance`, `misfireChance`, `minDamage`, `maxDamage`, `armorPierce`, `armorShred`, `expectedHpLossMin`, `expectedHpLossMax`, `expectedArmorLoss`, `ribbonCategory: 'flanked' | 'covered' | 'extreme_range'`) and itemized arrays (`hitModifiers: StatModifier[]`, `critModifiers: StatModifier[]`) for the left and right Breakdown Wings.
2. **Modular 17th-Century Combat Calculator (`CombatCalculator` in `/src/core/CombatSystem.ts`)**:
   - Evaluates `Shooter`, `Target`, `Weapon`, and `BattlefieldState` (`grid`, `weather`, `smoke`, elevation, cover, `movedThisTurn`, `isShaken`) to produce a deterministic `ShotCalculationResult`.
   - Resolves misfires first (`roll < misfireChance`), then hit (`roll < hitChance`), then critical hit (`roll < critChance`), applying `armorShred` and `armorPierce` before subtracting remaining HP.
3. **Aiming UI & Over-the-Shoulder Camera (`/src/components/ui/TargetingHud.tsx`, `/src/components/canvas/TacticalCamera.tsx`, `/src/components/canvas/UnitActor.tsx`)**:
   - Bottom-center **Target Ribbon** with period helmet/skull icons colored by tactical state (`yellow` = Flanked/Exposed, `red` = Covered, `slate/blue` = Extreme Range) and `Tab` / `Shift+Tab` cycling.
   - Smooth **Over-the-Shoulder Camera** transition behind the shooter facing the active target in `shoot` mode.
   - Expandable Left (`Hit Modifiers`) and Right (`Crit & Armor Modifiers`) **Breakdown Wings** toggled by the Rozpad button and its hover. `F1` and `0` open the inspect dossier and leave the wings alone.
   - Blinking **HP & Armor loss preview** on the targeted enemy's overhead `<Html>` bar.

## Consequences

- Players have 100% mathematical transparency into every 17th-century modifier affecting their shot.
- Adding new period weapons (arquebus, wheellock pistol, field falconet) or weather/stance effects automatically populates the Breakdown Wings without UI code changes.
