/**
 * Turn Splash Banner (/src/components/ui/TurnSplashBanner.tsx).
 * Krátký (~1.2s) filmový banner uprostřed obrazovky oznamující změnu tahu:
 * - "TAH OBRÁNCŮ PRAHY" (Zlatý/modrý motiv)
 * - "TAH ŠVÉDSKÉ HLÍDKY" (Krvavě červený motiv)
 * Nezasahuje do klikání (pointer-events-none), plynule odezní.
 */

import { ShieldAlert, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/useGameStore";

export function TurnSplashBanner() {
  const turn = useGameStore((s) => s.turn);
  const round = useGameStore((s) => s.round);
  const [visible, setVisible] = useState(false);
  const [bannerTurn, setBannerTurn] = useState(turn);
  const prevTurnRef = useRef(turn);
  const prevRoundRef = useRef(round);

  useEffect(() => {
    // Spustit při změně tahu nebo novém kole
    if (prevTurnRef.current !== turn || prevRoundRef.current !== round) {
      prevTurnRef.current = turn;
      prevRoundRef.current = round;
      setBannerTurn(turn);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
      }, 1300);

      return () => clearTimeout(timer);
    }
  }, [turn, round]);

  if (!visible) return null;

  const isPlayer = bannerTurn === "player";

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center select-none"
    >
      <div
        className={`pointer-events-none select-none flex flex-col items-center justify-center px-10 py-5 rounded-3xl border-2 backdrop-blur-xl shadow-[0_0_80px_rgba(0,0,0,0.9)] transition-all duration-300 ease-out ${
          isPlayer
            ? "bg-slate-950/92 border-amber-500/70 text-slate-100 shadow-amber-950/40"
            : "bg-red-950/92 border-red-500/70 text-white shadow-red-950/60"
        }`}
      >
        <div className="flex items-center gap-3 mb-1">
          {isPlayer ? (
            <Swords className="w-6 h-6 text-amber-400" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-red-400" />
          )}
          <span className="text-[11px] font-extrabold tracking-widest uppercase text-amber-300/90">
            Kolo {round}
          </span>
        </div>

        <h2
          className={`font-serif text-2xl sm:text-3xl font-black uppercase tracking-widest ${
            isPlayer ? "text-amber-300" : "text-rose-100"
          }`}
        >
          {isPlayer ? "Tah obránců Prahy" : "Tah švédské hlídky"}
        </h2>

        <p className="text-xs text-slate-300 tracking-wide mt-1">
          {isPlayer
            ? "Akční body obnoveny · Rozkazujte vojákům"
            : "Nepřítel manévruje v uličkách Malé Strany"}
        </p>
      </div>
    </div>
  );
}
