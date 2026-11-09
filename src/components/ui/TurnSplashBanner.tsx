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
        className={`pointer-events-none select-none flex flex-col items-center justify-center px-10 py-6 rounded-2xl border-2 backdrop-blur-2xl shadow-[0_0_90px_rgba(0,0,0,0.95)] transition-all duration-300 ease-out ${
          isPlayer
            ? "baroque-cartouche baroque-border text-amber-50"
            : "baroque-crimson-cartouche text-rose-100"
        }`}
      >
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-amber-500/80 text-xs">❖ ✦ ❖</span>
          <div className="flex items-center gap-2">
            {isPlayer ? (
              <Swords className="w-5 h-5 text-amber-300" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            )}
            <span className="font-cinzel text-xs font-bold tracking-widest uppercase text-amber-300">
              Kolo {round} · Anno 1648
            </span>
          </div>
          <span className="text-amber-500/80 text-xs">❖ ✦ ❖</span>
        </div>

        <h2
          className={`font-cinzel text-2xl sm:text-3xl font-black uppercase tracking-widest mt-1 ${
            isPlayer ? "baroque-gold" : "text-rose-200"
          }`}
        >
          {isPlayer ? "Útěk maršála Colloreda" : "Přepad Odowalského"}
        </h2>

        <div className="w-48 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent my-2" />

        <p className="font-literata italic text-xs text-amber-200/90 tracking-wide text-center px-4">
          {isPlayer
            ? round === 3
              ? "Polnice z Mostecké ulice! Těžké švédské posily dorazí v kole 5!"
              : round === 4
                ? "POZOR: Švédská jízda obkličuje bránu — posily vtrhnou v příštím kole!"
                : round >= 5
                  ? "POPLACH: Švédská jízda generála Königsmarcka vpadla do zahrady!"
                  : "Eskortujte kulhajícího maršála k rybářské pramici na Čertovce!"
            : "Švédští dragouni prohledávají zahradu Velkopřevorství!"}
        </p>
      </div>
    </div>
  );
}
