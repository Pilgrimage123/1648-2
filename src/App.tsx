/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Flame,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useEffect } from "react";
import { TacticalScene } from "./components/canvas/TacticalScene";
import { CombatChronicleFeed } from "./components/ui/CombatChronicleFeed";
import { MissionStatusChip } from "./components/ui/MissionStatusChip";
import { TacticalActionRibbon } from "./components/ui/TacticalActionRibbon";
import { TacticalAdvisorWidget } from "./components/ui/TacticalAdvisorWidget";
import { TacticalUtilitiesCapsule } from "./components/ui/TacticalUtilitiesCapsule";
import { TurnSplashBanner } from "./components/ui/TurnSplashBanner";
import { useGameStore } from "./store/useGameStore";

export default function App() {
  const outcome = useGameStore((s) => s.outcome);
  const victoryReason = useGameStore((s) => s.victoryReason);
  const round = useGameStore((s) => s.round);
  const resetGame = useGameStore((s) => s.resetGame);
  const units = useGameStore((s) => s.units);
  const sacrificeDilemmaOpen = useGameStore((s) => s.sacrificeDilemmaOpen);
  const ironVigilPerk = useGameStore((s) => s.ironVigilPerk);
  const chooseSacrifice = useGameStore((s) => s.chooseSacrifice);

  // Globální klávesové zkratky pro minimalistické taktické velení (XCOM Style):
  // - 1: Režim pohybu
  // - 2: Režim střelby (pokud jsou viditelné cíle)
  // - 3: Overwatch (hlídkování)
  // - 4: Hod granátem / petardou
  // - Tab / Shift+Tab: Cyklení cílů při střelbě NEBO cyklení vojáků čety při pohybu
  // - F1: Rozbalení / sbalení postranních křídel matematického rozpisu (Breakdown Wings)
  // - Space / Enter: Potvrzení výstřelu v Režimu míření / Ukončení tahu v běžném režimu
  // - Escape: Návrat z Režimu míření nebo granátu zpět do pohybu
  // - F: Přepínání pater budov (Roof/Floor Cutaway)
  // - M: Přepínání 2D billboard spritů a 3D modelů
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const state = useGameStore.getState();

      if (state.sacrificeDilemmaOpen || state.outcome !== "ongoing") {
        return;
      }

      if (e.key === "Escape") {
        state.setActionMode("move");
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        state.toggleBreakdown();
        return;
      }

      // F: Přepínání patra (Floor Cutaway)
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        state.toggleFloor();
        return;
      }

      // M: Přepínání 2D / 3D vizuálního módu
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        state.toggleRenderMode();
        return;
      }

      // H: Přepínání Taktického rádce (Tutoriál)
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        state.toggleTutorial();
        return;
      }

      // Klávesové zkratky akcí (1 = Pohyb, 2 = Střelba, 3 = Overwatch, 4 = Granát)
      if (state.turn === "player" && !state.isBusy) {
        if (e.key === "1") {
          e.preventDefault();
          state.setActionMode("move");
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          if (state.visibleTargets.length > 0) {
            state.setActionMode("shoot");
          }
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          state.activateOverwatch();
          return;
        }
        if (e.key === "4") {
          e.preventDefault();
          state.setActionMode("grenade");
          return;
        }
      }

      // Tab / Shift+Tab: Cyklení cílů (při střelbě) nebo cyklení vojáků (při pohybu)
      if (e.key === "Tab" && state.turn === "player" && !state.isBusy) {
        e.preventDefault();
        if (state.actionMode === "shoot") {
          if (state.visibleTargets.length > 0) {
            state.cycleTarget(e.shiftKey ? -1 : 1);
          }
        } else {
          // Cyklení živých vojáků hráče
          const playerUnits = state.units.filter(
            (u) => u.faction === "player" && u.alive,
          );
          if (playerUnits.length > 1) {
            const currentIdx = playerUnits.findIndex(
              (u) => u.id === state.selectedUnitId,
            );
            const delta = e.shiftKey ? -1 : 1;
            const nextIdx =
              (currentIdx + delta + playerUnits.length) % playerUnits.length;
            const nextUnit = playerUnits[nextIdx];
            if (nextUnit) state.selectUnit(nextUnit.id);
          }
        }
        return;
      }

      // Space / Enter: Potvrzení výstřelu v režimu míření, nebo ukončení tahu v klidu
      if (state.turn === "player" && !state.isBusy) {
        if (state.actionMode === "shoot" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          state.executeShoot();
          return;
        }
        if (state.actionMode !== "shoot" && e.key === " ") {
          e.preventDefault();
          state.endTurn();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-slate-950 select-none">
      {/* 1. Fullscreen 2.5D React Three Fiber Taktická scéna (100% plocha obrazovky) */}
      <div className="absolute inset-0">
        <TacticalScene />
      </div>

      {/* 2. Filmový středový banner změny tahu */}
      <TurnSplashBanner />

      {/* 3. Plovoucí periferní HUD widgety (XCOM Architecture) */}
      {/* Levý horní roh: Stav mise, kolo, počasí a Taktický rádce (Tutorial) */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col gap-2.5">
        <MissionStatusChip />
        <TacticalAdvisorWidget />
      </div>

      {/* Pravý horní roh: Kapsle nástrojů kamery, pater a 2D/3D zobrazení */}
      <div className="pointer-events-none absolute top-3 right-3 z-20">
        <TacticalUtilitiesCapsule />
      </div>

      {/* Pravá část: Plovoucí feed kroniky boje */}
      <CombatChronicleFeed />

      {/* Spodní střed: Sjednocená taktická akční lišta (Tactical Action Ribbon & Aiming HUD) */}
      <TacticalActionRibbon />

      {/* 4. Dilema oběti u pramice na Čertovce (Paradoxní oběť) */}
      {sacrificeDilemmaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="max-w-2xl w-full bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="font-serif text-xl md:text-2xl font-black uppercase tracking-wider text-amber-200">
                  Dilema oběti: Kdo zadrží Švédy u palácové branky?
                </h2>
                <div className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mt-0.5">
                  26. července 1648, 02:45 · Rameno Čertovky u Velkopřevorství
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
              Švédští dragouni generála Königsmarcka vpadli do zahrady a střílejí
              ze všech stran! Rozvodněná Vltava a malá rybářská pramice neunesou
              všechny.{" "}
              <strong className="text-amber-300">
                Jeden z vašich věrných společníků musí zůstat u palácové branky a
                odpálit sudy s prachem
              </strong>
              , aby maršál Colloredo mohl bezpečně odrazit do proudu řeky. Koho
              pověříte tímto osudovým úkolem?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Možnost 1: Jan Matěj */}
              {units.some((u) => u.id === "player-jan-matej" && u.alive) && (
                <button
                  type="button"
                  onClick={() => chooseSacrifice("player-jan-matej")}
                  className="flex flex-col justify-between p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-400 text-left transition-all group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      <span className="font-serif font-black text-sm text-white group-hover:text-amber-200">
                        Jan Matěj
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">
                      Osobní komorník
                    </span>
                    <p className="text-xs text-slate-300 italic font-serif leading-snug mb-3">
                      „Můj život už patří minulosti, milostivý pane. Odražte s maršálem!“
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300 font-bold">
                    Perk: Ocelová věrnost
                    <span className="block text-[10px] text-slate-400 font-normal">
                      +20 % odolnost proti šoku, +1 AP při záchraně raněného
                    </span>
                  </div>
                </button>
              )}

              {/* Možnost 2: Bratr Bartoloměj */}
              {units.some((u) => u.id === "player-bartolomej" && u.alive) && (
                <button
                  type="button"
                  onClick={() => chooseSacrifice("player-bartolomej")}
                  className="flex flex-col justify-between p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-400 text-left transition-all group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      <span className="font-serif font-black text-sm text-white group-hover:text-amber-200">
                        Bratr Bartoloměj
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">
                      Maltézský zbrojmistr
                    </span>
                    <p className="text-xs text-slate-300 italic font-serif leading-snug mb-3">
                      „Zasypu branku olovem a odpálím zbrojnici i se Švédy!“
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300 font-bold">
                    Perk: Maltézský pyrotechnik
                    <span className="block text-[10px] text-slate-400 font-normal">
                      +2 dosah granátů, výbuchy prachu o +1 silnější
                    </span>
                  </div>
                </button>
              )}

              {/* Možnost 3: Václav z Michalovic */}
              {units.some((u) => u.id === "player-vaclav-michalovic" && u.alive) && (
                <button
                  type="button"
                  onClick={() => chooseSacrifice("player-vaclav-michalovic")}
                  className="flex flex-col justify-between p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-400 text-left transition-all group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-serif font-black text-sm text-white group-hover:text-amber-200">
                        Václav z Michalovic
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">
                      Klementinský klerik & písař
                    </span>
                    <p className="text-xs text-slate-300 italic font-serif leading-snug mb-3">
                      „Bůh mě ochraňuj, zdržím je s křížem a karabinou!“
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300 font-bold">
                    Perk: Klementinský zápal
                    <span className="block text-[10px] text-slate-400 font-normal">
                      +10 % k zásahu z výšky, spolehlivost v dešti
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Modální okno výsledku bitvy */}
      {outcome !== "ongoing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="max-w-xl w-full bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-400 text-amber-300">
              {outcome === "victory" ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <Skull className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl font-black uppercase tracking-wider text-white">
                {outcome === "victory"
                  ? victoryReason === "boat_escape"
                    ? "Útěk na Vltavě dokonán & Zrod Železné vigilie"
                    : "Přepadový oddíl zničen!"
                  : "Vrchní velitel padl do zajetí"}
              </h2>
              <div className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mt-1">
                {outcome === "victory"
                  ? `Mise splněna v ${round}. kole · 26. července 1648`
                  : `Katastrofa v ${round}. kole · Praha padla`}
              </div>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed text-left bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
              {outcome === "victory" ? (
                victoryReason === "boat_escape" ? (
                  <>
                    <div>
                      <strong className="text-amber-300 block mb-0.5">
                        1. Smrt v loďce a záchrana maršála:
                      </strong>
                      Když pramice odrazila do temného proudu Vltavy, švédští mušketýři spustili ze břehu prudkou palbu. Dva věrní společníci v loďce vlastním tělem zakryli maršála Colloreda v noční košili. Na staroměstském břehu u křižovnického kláštera předali zraněného velitele strážím a v kalužích krve a nočního deště vydechli naposledy. Stráž na Staroměstské mostecké věži spustila železnou mříž doslova před nosem švédských dragounů!
                    </div>

                    <div>
                      <strong className="text-amber-400 block mb-0.5">
                        2. Zázrak u palácové branky (Paradoxní oběť):
                      </strong>
                      Mezitím u palácové branky {ironVigilPerk?.heroName ?? "obětovaný hrdina"} odpálil sudy s prachem. Ohlušující detonace smetla švédský předvoj a tlaková vlna jej odmrštila do rozvodněné Čertovky. Zraněný, popálený, ale živý se v temnotě proplížil podél Kampy a přeplaval řeku na Staré Město!
                    </div>

                    <div>
                      <strong className="text-sky-300 block mb-0.5">
                        3. Přijetí do ŽELEZNÉ VIGILIE Klementinských jezuitů:
                      </strong>
                      Polomrtvého hrdinu na schodech Klementina zvedl sám Pater Jiří Plachý. Když spatřil jeho odvahu, vtiskl mu do rukou posvěcenou zbraň a zahalil jej černým pláštěm: <em>„Tvá oběť z tebe smyla strach. Od této chvíle jsi mečem Železné vigilie.“</em>
                    </div>

                    {ironVigilPerk && (
                      <div className="bg-amber-950/70 border border-amber-400/60 rounded-xl p-3 flex items-start gap-3 mt-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                            Nový člen Železné vigilie: {ironVigilPerk.heroName}
                          </div>
                          <div className="text-xs font-bold text-white mt-0.5">
                            Trvalý perk: {ironVigilPerk.name}
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            {ironVigilPerk.desc}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <strong className="text-amber-300 block mb-1">
                      Odowalského zrada odražena:
                    </strong>
                    Švédský přepadový oddíl byl v zahradě Velkopřevorství do jednoho
                    pobit! Cesta k rybářské pramici na Čertovce je zcela volná. Maršál
                    Colloredo bezpečně přeplouvá rozvodněnou Vltavu, aby na pravém
                    břehu zorganizoval legendární obranu Prahy.
                  </>
                )
              ) : (
                <>
                  <strong className="text-rose-400 block mb-1">
                    Tragický pád vrchního velitele:
                  </strong>
                  Polní maršál Rudolf Colloredo byl švédskými dragouny dopaden v noční
                  košili dříve, než stačil dosáhnout loďky. Bez vrchního velitele
                  nikdo nezorganizoval posádku na Karlově mostě včas — švédská jízda
                  překonala řeku a celá Praha padla do rukou generála Königsmarcka.
                </>
              )}
            </div>

            <button
              type="button"
              onClick={resetGame}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Hrát znovu</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
