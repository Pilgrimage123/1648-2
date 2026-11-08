/**
 * Horní taktická lišta (/src/components/ui/TopBar.tsx).
 * Zobrazuje indikátor aktuálního tahu, přepínač počasí 17. století (Jasno / Mlha / Déšť),
 * přepínač patra kamery (Patro 0 / Patro 1), rotaci kamery (Q / E) a přepínač 2D Sprity / 3D Modely.
 */

import {
  Box,
  CloudFog,
  CloudRain,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Sun,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore";

export function TopBar() {
  const round = useGameStore((s) => s.round);
  const turn = useGameStore((s) => s.turn);
  const weather = useGameStore((s) => s.weather);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const renderMode = useGameStore((s) => s.renderMode);
  const units = useGameStore((s) => s.units);
  const setActiveFloor = useGameStore((s) => s.setActiveFloor);
  const setRenderMode = useGameStore((s) => s.setRenderMode);
  const cycleWeather = useGameStore((s) => s.cycleWeather);
  const rotateCamera = useGameStore((s) => s.rotateCamera);
  const resetGame = useGameStore((s) => s.resetGame);

  const enemiesAlive = units.filter(
    (u) => u.faction === "enemy" && u.alive,
  ).length;

  const weatherLabel =
    weather === "rain"
      ? "Prudký déšť (-10 % zásah, +selhání doutnáku)"
      : weather === "fog"
        ? "Ranní mlha (-10 % zásah)"
        : "Jasná noc (bez postihu)";

  return (
    <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/85 border-b border-amber-500/30 backdrop-blur-md text-slate-100 shadow-xl">
      {/* Vlevo: Název hry, Kolo a Indikátor tahu */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-widest text-amber-300">
              Praha 1648 · XCOM 2.5D
            </h1>
            <p className="text-[11px] text-slate-400">
              Kolo {round} · Zbývá nepřátel: {enemiesAlive}
            </p>
          </div>
        </div>

        {/* Indikátor aktuálního tahu */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
            turn === "player"
              ? "bg-sky-950/90 border-sky-400 text-sky-200"
              : "bg-red-950/90 border-red-400 text-red-200 animate-pulse"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>
            {turn === "player"
              ? "Tah hráče (Obránci)"
              : "Aktivita vetřelců (Švédové)"}
          </span>
        </div>
      </div>

      {/* Vpravo: Počasí, Přepínač patra, Rotace kamery Q/E, 2D/3D Modely a Restart */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Přepínač počasí (ovlivňuje šanci na zásah a selhání doutnákového zámku) */}
        <button
          type="button"
          onClick={cycleWeather}
          title={`Kliknutím změňte počasí na bojišti: ${weatherLabel}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
        >
          {weather === "rain" ? (
            <CloudRain className="w-3.5 h-3.5 text-sky-400" />
          ) : weather === "fog" ? (
            <CloudFog className="w-3.5 h-3.5 text-slate-300" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>
            Počasí:{" "}
            <strong className="text-amber-300">
              {weather === "rain"
                ? "Déšť"
                : weather === "fog"
                  ? "Mlha"
                  : "Jasno"}
            </strong>
          </span>
        </button>

        {/* Přepínač patra kamery (Roof/Floor Cutaway) */}
        <div
          className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700"
          title="Přepínání viditelnosti pater (Roof/Floor Cutaway — klávesa F)"
        >
          <span className="flex items-center gap-1 px-2 text-[11px] font-semibold text-slate-400">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Patro:
          </span>
          <button
            type="button"
            onClick={() => setActiveFloor(0)}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
              activeFloor === 0
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Patro 0
          </button>
          <button
            type="button"
            onClick={() => setActiveFloor(1)}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
              activeFloor === 1
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Patro 1
          </button>
        </div>

        {/* Rotace kamery po 90° krocích (Q / E) */}
        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => rotateCamera(-1)}
            title="Otočit kameru o 90° doleva (klávesa Q)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>Q</span>
          </button>
          <button
            type="button"
            onClick={() => rotateCamera(1)}
            title="Otočit kameru o 90° doprava (klávesa E)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <span>E</span>
            <RotateCw className="w-3.5 h-3.5 text-sky-400" />
          </button>
        </div>

        {/* Přepínač 2D Sprity / 3D Modely */}
        <div
          className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-amber-500/40"
          title="Okamžitá výměna 2D billboard spritů za 3D modely (klávesa M)"
        >
          <button
            type="button"
            onClick={() => setRenderMode("2D_SPRITE")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              renderMode === "2D_SPRITE"
                ? "bg-sky-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>2D Sprity</span>
          </button>
          <button
            type="button"
            onClick={() => setRenderMode("3D_MODEL")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              renderMode === "3D_MODEL"
                ? "bg-sky-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Modely</span>
          </button>
        </div>

        {/* Restart mise */}
        <button
          type="button"
          onClick={resetGame}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 transition-colors"
        >
          Restart
        </button>
      </div>
    </header>
  );
}
