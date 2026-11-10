/**
 * Combat Chronicle Feed (/src/components/ui/CombatChronicleFeed.tsx).
 * Plovoucí feed bojových událostí v pravé části obrazovky:
 * - Lze chytit a odsunout kamkoliv na obrazovce (useDraggableHud)
 * - 3 režimy zobrazení: Sbaleno (pouze tlačítko), Kompaktní (poslední 2 zprávy), Rozbaleno (plný svitek)
 * - Při přechodu do Režimu míření se automaticky sbalí do hlavičky, aby nepřekážel výhledu
 */

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  History,
  Minus,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { useDraggableHud } from "./useDraggableHud";

type FeedMode = "minimized" | "compact" | "expanded";

export function CombatChronicleFeed() {
  const combatLog = useGameStore((s) => s.combatLog);
  const actionMode = useGameStore((s) => s.actionMode);
  const [mode, setMode] = useState<FeedMode>("compact");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragStyle, onPointerDown, hasMoved, resetOffset } = useDraggableHud();

  useEffect(() => {
    if (mode === "expanded" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [combatLog, mode]);

  if (combatLog.length === 0) return null;

  // V režimu míření sbalíme toast notifikace, pokud hráč výslovně nerozbalil plnou kroniku
  const effectiveMode: FeedMode =
    actionMode === "shoot" && mode === "compact" ? "minimized" : mode;

  const recentEntries = combatLog.slice(-2);

  const getToneClass = (tone?: string) => {
    switch (tone) {
      case "crit":
        return "text-amber-200 font-bold border border-amber-400/80 bg-amber-950/95 shadow-[inset_0_1px_0_rgba(253,230,138,0.3)]";
      case "misfire":
        return "text-orange-200 font-bold border border-orange-500/80 bg-orange-950/95";
      case "hit":
        return "text-rose-100 font-semibold border border-rose-500/80 bg-rose-950/95";
      case "overwatch":
        return "text-sky-100 font-semibold border border-sky-400/70 bg-slate-950/95";
      case "alert":
        return "text-red-100 font-black border border-red-500/90 bg-red-950/95";
      default:
        return "text-amber-100 border border-amber-600/60 bg-slate-950/95";
    }
  };

  return (
    <aside
      aria-label="Kronika boje"
      style={dragStyle}
      className="pointer-events-none relative flex flex-col items-end gap-1.5 max-w-xs w-full select-none z-20"
    >
      {/* Přetahovatelná ovládací kapsle kroniky (Diarium) */}
      <div
        onPointerDown={onPointerDown}
        title="Tažením myší můžete kroniku boje odsunout kamkoliv na obrazovce"
        className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950/95 border border-amber-500/80 text-xs font-cinzel font-black text-amber-200 shadow-[0_4px_16px_rgba(0,0,0,0.85)] cursor-grab active:cursor-grabbing"
      >
        <GripHorizontal className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
        <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <button
          type="button"
          onClick={() =>
            setMode(effectiveMode === "expanded" ? "compact" : "expanded")
          }
          className="px-1 hover:text-amber-100 cursor-pointer"
        >
          Diarium ({combatLog.length})
        </button>

        {hasMoved && (
          <button
            type="button"
            onClick={resetOffset}
            title="Vrátit kroniku na výchozí místo"
            className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        {/* Tlačítko úplného sbalení / kompaktního náhledu */}
        <button
          type="button"
          onClick={() =>
            setMode(effectiveMode === "minimized" ? "compact" : "minimized")
          }
          title={
            effectiveMode === "minimized"
              ? "Zobrazit poslední zprávy"
              : "Minimalizovat zprávy (pouze nadpis)"
          }
          className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Tlačítko plného rozbalení svitku */}
        <button
          type="button"
          onClick={() =>
            setMode(effectiveMode === "expanded" ? "compact" : "expanded")
          }
          title={
            effectiveMode === "expanded"
              ? "Sbalit plnou historii"
              : "Rozbalit kompletní historii boje"
          }
          className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer"
        >
          {effectiveMode === "expanded" ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 1. Rozbalené plné okno historie */}
      {effectiveMode === "expanded" && (
        <div className="pointer-events-auto w-full baroque-cartouche baroque-border rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.95)] flex flex-col max-h-72 bg-slate-950/95 border-amber-500/80">
          <div
            onPointerDown={onPointerDown}
            className="flex items-center justify-between border-b border-amber-900/80 pb-1.5 mb-2 text-xs font-cinzel font-black text-amber-200 cursor-grab active:cursor-grabbing"
          >
            <span className="flex items-center gap-1.5 tracking-wide uppercase">
              <History className="w-3.5 h-3.5 text-amber-400" />
              Diarium Belli Pragensia
            </span>
            <span className="text-[10px] text-amber-400 font-literata italic">
              Anno 1648
            </span>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-literata text-xs"
          >
            {combatLog.map((entry) => (
              <div
                key={entry.id}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] leading-snug transition-all ${getToneClass(
                  entry.tone,
                )}`}
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Kompaktní plovoucí feed (poslední 2 události) */}
      {effectiveMode === "compact" && (
        <div className="flex flex-col gap-1 w-full items-end pointer-events-none">
          {recentEntries.map((entry, idx) => {
            const isLast = idx === recentEntries.length - 1;
            return (
              <div
                key={entry.id}
                className={`pointer-events-auto max-w-xs py-1 px-2.5 rounded-lg font-literata text-[11px] leading-tight shadow-xl transition-all ${getToneClass(
                  entry.tone,
                )} ${isLast ? "opacity-100" : "opacity-85"}`}
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
