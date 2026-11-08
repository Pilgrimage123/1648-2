/**
 * Mission Status Chip (/src/components/ui/MissionStatusChip.tsx).
 * Minimalistický plovoucí widget v levém horním rohu:
 * - Kolo a aktivní tah (Obránci Prahy vs. Švédská hlídka)
 * - Počet zbývajících nepřátel na bojišti
 * - Interaktivní štítek počasí s tooltipem dopadu na střelbu
 */

import {
  CloudFog,
  CloudRain,
  ShieldAlert,
  Sun,
  Swords,
  Users,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore";

export function MissionStatusChip() {
  const round = useGameStore((s) => s.round);
  const turn = useGameStore((s) => s.turn);
  const weather = useGameStore((s) => s.weather);
  const units = useGameStore((s) => s.units);
  const cycleWeather = useGameStore((s) => s.cycleWeather);

  const enemiesAlive = units.filter(
    (u) => u.faction === "enemy" && u.alive,
  ).length;

  const weatherLabel =
    weather === "rain"
      ? "Prudký déšť: -10 % k zásahu, zvýšené selhání doutnákového zámku"
      : weather === "fog"
        ? "Ranní mlha: -10 % k zásahu"
        : "Jasná noc: optimální podmínky pro střelbu";

  return (
    <aside
      aria-label="Stav mise a kolo"
      className="pointer-events-auto flex items-center gap-2.5 bg-slate-950/85 border border-amber-500/40 rounded-2xl px-3.5 py-2 shadow-2xl backdrop-blur-md text-slate-100 select-none transition-all"
    >
      {/* 1. Kolo & Frakce na tahu */}
      <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all ${
            turn === "player"
              ? "bg-sky-950/90 border-sky-400 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
              : "bg-red-950/90 border-red-400 text-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]"
          }`}
        >
          {turn === "player" ? (
            <Swords className="w-4 h-4" />
          ) : (
            <ShieldAlert className="w-4 h-4" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-serif font-black text-xs tracking-wider text-amber-300 uppercase">
              Kolo {round}
            </span>
            <span className="text-[10px] text-slate-500">·</span>
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wide ${
                turn === "player" ? "text-sky-300" : "text-rose-400"
              }`}
            >
              {turn === "player" ? "Obránci" : "Švédové"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            {turn === "player" ? "Tvůj tah" : "Nepřátelská aktivita..."}
          </div>
        </div>
      </div>

      {/* 2. Počet zbývajících Švédů */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-bold text-slate-200">
        <Users className="w-3.5 h-3.5 text-rose-400" />
        <span>
          Zbývá: <strong className="text-white font-extrabold">{enemiesAlive}</strong>
        </span>
      </div>

      {/* 3. Počasí (kliknutím lze přepínat) */}
      <button
        type="button"
        onClick={cycleWeather}
        title={`Kliknutím přepnete počasí: ${weatherLabel}`}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-[11px] font-bold text-slate-200 transition-all cursor-pointer"
      >
        {weather === "rain" ? (
          <CloudRain className="w-3.5 h-3.5 text-sky-400" />
        ) : weather === "fog" ? (
          <CloudFog className="w-3.5 h-3.5 text-slate-300" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className="hidden sm:inline text-amber-300">
          {weather === "rain" ? "Déšť" : weather === "fog" ? "Mlha" : "Jasno"}
        </span>
      </button>
    </aside>
  );
}
