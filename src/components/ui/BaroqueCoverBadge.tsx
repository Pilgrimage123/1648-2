/**
 * Srozumitelná barokní heraldická ikona krytu s číslem (/src/components/ui/BaroqueCoverBadge.tsx).
 * Nahrazuje textové nápisy ("PLNÝ KRYT", "POLOVIČNÍ KRYT") okamžitě čitelným
 * barokním štítem (plný ocelově-modrý štít se zlatým lemem = 40, poloviční jantarový štít = 20,
 * přeškrtnutý prázdný štít = 0).
 */

import type { CoverLevel } from "../../core/types";
import { text, useLocale } from "../../i18n";

interface BaroqueCoverBadgeProps {
  cover: CoverLevel;
  size?: "sm" | "md" | "lg";
  showZero?: boolean;
  showPercentSign?: boolean;
  className?: string;
}

export function BaroqueCoverBadge({
  cover,
  size = "md",
  showZero = false,
  showPercentSign = false,
  className = "",
}: BaroqueCoverBadgeProps) {
  const locale = useLocale();
  if (cover === "none" && !showZero) return null;

  const value = cover === "full" ? 40 : cover === "half" ? 20 : 0;
  const title =
    cover === "full"
      ? text("ui.cover.full", undefined, locale)
      : cover === "half"
        ? text("ui.cover.half", undefined, locale)
        : text("ui.cover.none", undefined, locale);

  const dims =
    size === "sm"
      ? "h-5 px-1 gap-0.5 text-[10px]"
      : size === "lg"
        ? "h-7 px-2 gap-1.5 text-xs"
        : "h-6 px-1.5 gap-1 text-[11px]";

  const svgSize =
    size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-4.5 h-4.5" : "w-4 h-4";

  const palette =
    cover === "full"
      ? "bg-sky-950/95 border-sky-400 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.45)]"
      : cover === "half"
        ? "bg-amber-950/95 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
        : "bg-slate-950/90 border-slate-600 text-slate-400";

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-md border font-cinzel font-black tabular-nums leading-none select-none shrink-0 ${dims} ${palette} ${className}`}
    >
      {/* Barokní heraldická kartuše / štít */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={`${svgSize} shrink-0`}
        aria-hidden="true"
      >
        {/* Vnější barokní tvar štítu s horními výkroji */}
        <path
          d="M12 2L4 5.5V11.5C4 16.8 7.4 20.9 12 22.5C16.6 20.9 20 16.8 20 11.5V5.5L12 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill={cover === "full" ? "currentColor" : "rgba(15,23,42,0.85)"}
          fillOpacity={cover === "full" ? 0.35 : 0.9}
        />

        {/* Výplň podle úrovně krytu */}
        {cover === "full" && (
          <>
            {/* Plný heraldický štít s barokním křížem */}
            <path
              d="M12 4.2L6 6.8V11.4C6 15.6 8.6 18.9 12 20.3C15.4 18.9 18 15.6 18 11.4V6.8L12 4.2Z"
              fill="currentColor"
              fillOpacity="0.85"
            />
            <path
              d="M12 6V18M7.5 11H16.5"
              stroke="#082f49"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        )}

        {cover === "half" && (
          <>
            {/* Poloviční barokní štít (spodní/levá diagonální polovina plná) */}
            <path
              d="M6 11.5H18C17.8 15.6 15.3 18.9 12 20.3C8.7 18.9 6.2 15.6 6 11.5Z"
              fill="currentColor"
              fillOpacity="0.9"
            />
            <line
              x1="5.5"
              y1="11.5"
              x2="18.5"
              y2="11.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </>
        )}

        {cover === "none" && (
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>

      <span>
        {value > 0 ? `−${value}` : "0"}
        {showPercentSign ? "%" : ""}
      </span>
    </span>
  );
}
