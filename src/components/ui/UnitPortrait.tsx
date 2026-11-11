/**
 * Portrét postavy ze 2D figurky (/src/components/ui/UnitPortrait.tsx).
 * Zobrazuje výřez hlavy, klobouku/přilby a poprsí z procedurálního 2D spritu.
 */

import type { Faction, UnitArchetype } from "../../core/types";
import { getProceduralPortraitDataUri } from "../../utils/proceduralSprites";

interface UnitPortraitProps {
  archetype: UnitArchetype;
  faction?: Faction;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  isVip?: boolean;
  alive?: boolean;
  isDetained?: boolean;
  borderTone?: "gold" | "crimson" | "amber" | "slate" | "auto";
}

const SIZE_CLASSES = {
  xs: "w-6 h-6 rounded-md",
  sm: "w-8 h-8 rounded-lg",
  md: "w-10 h-10 rounded-lg",
  lg: "w-12 h-12 rounded-xl",
  xl: "w-14 h-14 rounded-xl",
};

export function UnitPortrait({
  archetype,
  faction = "player",
  name,
  size = "md",
  className = "",
  isVip = false,
  alive = true,
  isDetained = false,
  borderTone = "auto",
}: UnitPortraitProps) {
  const portraitUri = getProceduralPortraitDataUri(archetype);

  const resolvedTone =
    borderTone !== "auto"
      ? borderTone
      : faction === "enemy"
        ? "crimson"
        : isVip
          ? "gold"
          : "amber";

  const toneClasses =
    resolvedTone === "crimson"
      ? "border-rose-600/80 bg-gradient-to-b from-rose-950/90 via-slate-950 to-stone-950 shadow-[0_0_10px_rgba(225,29,72,0.35)]"
      : resolvedTone === "gold"
        ? "border-amber-400 bg-gradient-to-b from-amber-950 via-slate-950 to-stone-950 shadow-[0_0_12px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/50"
        : resolvedTone === "slate"
          ? "border-slate-700 bg-slate-950 opacity-75"
          : "border-amber-500/80 bg-gradient-to-b from-amber-950/80 via-slate-950 to-stone-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]";

  return (
    <div
      aria-label={name ? `Portrét postavy ${name}` : `Portrét archetype ${archetype}`}
      className={`relative flex items-center justify-center shrink-0 border overflow-hidden baroque-border transition-all ${
        SIZE_CLASSES[size]
      } ${toneClasses} ${
        !alive || isDetained ? "grayscale opacity-60" : ""
      } ${className}`}
    >
      <img
        src={portraitUri}
        alt={name ?? archetype}
        className="w-full h-full object-cover select-none pointer-events-none transform scale-[1.12] translate-y-[2%] drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
      />

      {isVip && alive && (
        <span
          title="VIP Hrdina (Vyžaduje ochranu)"
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 border border-amber-200 rounded-full flex items-center justify-center text-[7px] font-black text-amber-950 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
        >
          ★
        </span>
      )}
    </div>
  );
}
