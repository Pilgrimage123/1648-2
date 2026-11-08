/**
 * Combat Chronicle Feed (/src/components/ui/CombatChronicleFeed.tsx).
 * Plovoucí feed bojových událostí v pravé části obrazovky:
 * - Posledních několik zpráv (výstřely, zásahy, selhání doutnáku, kryty)
 * - Barevné rozlišení podle tónu události
 * - Možnost rozbalit celou historii (svitek) bez blokování bojiště
 */

import { BookOpen, ChevronDown, ChevronUp, History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/useGameStore";

export function CombatChronicleFeed() {
  const combatLog = useGameStore((s) => s.combatLog);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [combatLog, isExpanded]);

  if (combatLog.length === 0) return null;

  // Recent 4 entries for the compact toast feed
  const recentEntries = combatLog.slice(-4);

  const getToneClass = (tone?: string) => {
    switch (tone) {
      case "crit":
        return "text-amber-300 font-bold border-l-2 border-amber-400 bg-amber-950/30";
      case "misfire":
        return "text-orange-400 font-bold border-l-2 border-orange-400 bg-orange-950/30";
      case "hit":
        return "text-rose-200 font-medium border-l-2 border-rose-500 bg-rose-950/20";
      case "overwatch":
        return "text-sky-300 font-medium border-l-2 border-sky-400 bg-sky-950/20";
      case "alert":
        return "text-red-400 font-extrabold border-l-2 border-red-500 bg-red-950/40";
      default:
        return "text-slate-300 border-l-2 border-slate-600 bg-slate-900/40";
    }
  };

  return (
    <aside
      aria-label="Kronika boje"
      className="pointer-events-none fixed top-16 right-4 z-20 flex flex-col items-end gap-1.5 max-w-sm w-full select-none"
    >
      {/* Tlačítko pro rozbalení kompletní historie */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-500/30 backdrop-blur-md text-[11px] font-bold text-slate-300 hover:text-amber-200 transition-all shadow-lg cursor-pointer"
      >
        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
        <span>Kronika ({combatLog.length})</span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {/* 1. Rozbalené plné okno historie */}
      {isExpanded ? (
        <div className="pointer-events-auto w-full bg-slate-950/95 border border-amber-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col max-h-80">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 text-xs font-bold text-amber-300">
            <span className="flex items-center gap-1">
              <History className="w-3.5 h-3.5" />
              Záznam bitvy
            </span>
            <span className="text-[10px] text-slate-400">Malá Strana 1648</span>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 text-xs"
          >
            {combatLog.map((entry) => (
              <div
                key={entry.id}
                className={`py-1 px-2 rounded-r-lg text-[11px] leading-snug transition-all ${getToneClass(
                  entry.tone,
                )}`}
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 2. Plovoucí toast feed (poslední události s automatickým ústupem) */
        <div className="flex flex-col gap-1 w-full items-end pointer-events-none">
          {recentEntries.map((entry, idx) => {
            const isLast = idx === recentEntries.length - 1;
            return (
              <div
                key={entry.id}
                className={`pointer-events-none max-w-xs py-1 px-2.5 rounded-r-lg backdrop-blur-md text-[11px] leading-tight shadow-md transition-all ${getToneClass(
                  entry.tone,
                )} ${isLast ? "opacity-100 scale-100" : "opacity-80 scale-95"}`}
              >
                {entry.text}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
