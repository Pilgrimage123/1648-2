/**
 * Combat Chronicle Feed (/src/components/ui/CombatChronicleFeed.tsx).
 * Ephemerální jednořádková kronika boje (Pilíře 1 & 4):
 * - Ve výchozím stavu zobrazuje pouze miniaturní přepínač Diarium (N) a 1 poslední hlášení,
 *   které po 4 sekundách samo ztlumí alfa kanál, aby nezakrývalo bojiště.
 * - V režimu míření přes rameno a při letu projektilu se automaticky skryje (HUD State Machine).
 */

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  History,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { useDraggableHud } from "./useDraggableHud";

export function CombatChronicleFeed() {
  const combatLog = useGameStore((s) => s.combatLog);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const isBusy = useGameStore((s) => s.isBusy);
  const activeMovement = useGameStore((s) => s.activeMovement);

  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragStyle, onPointerDown, hasMoved, resetOffset } = useDraggableHud();

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [combatLog, expanded]);

  // Stavový automat HUDu (Pillar 4): Skrýt v akční kameře přes rameno a při střelbě
  const isHiddenInActionCam =
    actionMode === "shoot" ||
    actionMode === "melee" ||
    activeProjectile !== null ||
    Boolean(isBusy && activeMovement?.isActionCam);

  if (combatLog.length === 0 || isHiddenInActionCam) return null;

  const latestEntry = combatLog[combatLog.length - 1];

  return (
    <aside
      aria-label="Kronika boje"
      style={dragStyle}
      className="pointer-events-none relative flex flex-col items-end gap-1 max-w-xs w-full select-none z-20"
    >
      {/* Kompaktní jednořádková kapsle Diaria + 1 poslední zpráva */}
      <div
        onPointerDown={onPointerDown}
        title="Tažením lze kroniku posunout · Kliknutím rozbalíte historii boje"
        className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/88 border border-amber-500/60 backdrop-blur-md text-[11px] text-amber-100 shadow-[0_4px_16px_rgba(0,0,0,0.85)] cursor-grab active:cursor-grabbing max-w-full"
      >
        <GripHorizontal className="w-3 h-3 text-amber-400/50 shrink-0" />
        <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="font-literata truncate max-w-[200px] text-left hover:text-amber-200 cursor-pointer"
        >
          {latestEntry?.text ?? `Diarium (${combatLog.length})`}
        </button>

        {hasMoved && (
          <button
            type="button"
            onClick={resetOffset}
            title="Vrátit kroniku na výchozí místo"
            className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          title={expanded ? "Sbalit historii boje" : "Rozbalit historii boje"}
          className="p-0.5 rounded text-amber-400 hover:text-amber-100 cursor-pointer shrink-0"
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Rozbalená historie pouze na vyžádání */}
      {expanded && (
        <div className="pointer-events-auto w-full baroque-cartouche baroque-border rounded-xl p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.95)] flex flex-col max-h-60 bg-slate-950/95 border-amber-500/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-amber-900/70 pb-1 mb-1.5 text-[10px] font-cinzel font-black text-amber-200">
            <span className="flex items-center gap-1 uppercase tracking-wide">
              <History className="w-3 h-3 text-amber-400" />
              Diarium Belli ({combatLog.length})
            </span>
            <span className="font-literata italic text-amber-400/80">1648</span>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-1 pr-1 font-literata text-[11px]"
          >
            {combatLog.map((entry) => (
              <div
                key={entry.id}
                className="py-1 px-2 rounded bg-slate-900/90 border border-amber-900/50 text-amber-100/95 leading-snug"
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
