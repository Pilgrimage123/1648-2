/**
 * Tactical Utilities Capsule (/src/components/ui/TacticalUtilitiesCapsule.tsx).
 * Minimalistická plovoucí kapsle v pravém horním rohu:
 * - Rotace taktické kamery po 90° krocích (klávesy Q / E)
 * - Přepínač patra budov (Roof/Floor Cutaway — klávesa F)
 * - Přepínač 2D billboard spritů a 3D modelů (klávesa M)
 * - Restart mise
 */

import {
  Box,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  RotateCw,
  RefreshCw,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore";

export function TacticalUtilitiesCapsule() {
  const activeFloor = useGameStore((s) => s.activeFloor);
  const renderMode = useGameStore((s) => s.renderMode);
  const toggleFloor = useGameStore((s) => s.toggleFloor);
  const toggleRenderMode = useGameStore((s) => s.toggleRenderMode);
  const rotateCamera = useGameStore((s) => s.rotateCamera);
  const resetGame = useGameStore((s) => s.resetGame);

  return (
    <nav
      aria-label="Taktické nástroje a kamera"
      className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/85 border border-amber-500/40 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md text-slate-100 select-none"
    >
      {/* 1. Rotace kamery (Q / E) */}
      <div className="flex items-center bg-slate-900/80 rounded-xl p-0.5 border border-slate-800">
        <button
          type="button"
          onClick={() => rotateCamera(-1)}
          title="Otočit kameru o 90° doleva (klávesa Q)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[10px] text-amber-300 font-mono">Q</span>
        </button>
        <button
          type="button"
          onClick={() => rotateCamera(1)}
          title="Otočit kameru o 90° doprava (klávesa E)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <span className="text-[10px] text-amber-300 font-mono">E</span>
          <RotateCw className="w-3.5 h-3.5 text-sky-400" />
        </button>
      </div>

      {/* 2. Patro kamery (Roof / Floor Cutaway — F) */}
      <button
        type="button"
        onClick={toggleFloor}
        title="Přepnout viditelnost pater (Cutaway — klávesa F)"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all ${
          activeFloor === 1
            ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm"
            : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
        }`}
      >
        <Layers className="w-3.5 h-3.5 text-amber-400" />
        <span>P{activeFloor}</span>
        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-amber-300 font-mono border border-slate-700">
          F
        </span>
      </button>

      {/* 3. 2D Billboard Sprity / 3D Modely (M) */}
      <button
        type="button"
        onClick={toggleRenderMode}
        title="Přepnout zobrazení jednotek: 2D sprity / 3D modely (klávesa M)"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all"
      >
        {renderMode === "2D_SPRITE" ? (
          <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
        ) : (
          <Box className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <span>{renderMode === "2D_SPRITE" ? "2D" : "3D"}</span>
        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-amber-300 font-mono border border-slate-700">
          M
        </span>
      </button>

      {/* 4. Restart mise */}
      <button
        type="button"
        onClick={resetGame}
        title="Restartovat aktuální bitvu"
        className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </nav>
  );
}
