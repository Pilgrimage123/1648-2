/**
 * Tactical Advisor Widget (/src/components/ui/TacticalAdvisorWidget.tsx).
 * Plovoucí taktický rádce a diegetický tutoriál pro 1. misi ("Útěk maršála Colloreda").
 * - Lze libovolně odsunout stranou přetažením za záhlaví (useDraggableHud)
 * - Lze sbalit do kompaktního jednořádkového režimu nebo zcela minimalizovat klávesou [H]
 * - Při přechodu do Režimu míření se automaticky přepne do kompaktního náhledu,
 *   aby nikdy nepřekrýval panel šancí zásahu a postranní křídla rozpisu (F1)
 */

import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GraduationCap,
  GripHorizontal,
  RotateCcw,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { useGameStore } from "../../store/useGameStore";
import { useDraggableHud } from "./useDraggableHud";

interface TutorialStepData {
  step: 1 | 2 | 3 | 4;
  title: string;
  speaker: string;
  role: string;
  avatarIcon: "jan" | "bartolomej";
  dialogue: string;
  tactics: string[];
  keyBadges: { key: string; label: string }[];
  beaconLabel?: string;
  beaconCoord?: string;
}

const PLAYABLE_HERO_IDS = [
  "player-jan-matej",
  "player-vaclav-michalovic",
  "player-bartolomej",
] as const;

const TUTORIAL_STEPS: TutorialStepData[] = [
  {
    step: 1,
    title: "Pohyb, Eskorta & Přísaha komorníka",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    avatarIcon: "jan",
    dialogue:
      "Vaše Excelence! Po těch sedmi střelných ranách u Lützenu sotva stojíte na nohou! Opřete se o mě — přehodím přes vás svůj plášť [5], posunu se vedle vás a pomohu vám utíkat zahradou k Čertovce!",
    tactics: [
      "Modrá zóna (1 AP): Běžný přesun, po němž můžete ještě střílet nebo hodit petardu.",
      "Handicap maršála: Zraněný Colloredo ujde sám jen 3 pole za AP. S doprovodem spojence získá plných 5 polí/AP!",
      "Schopnost Jana Matěje [5] — Přísaha komorníka (0 AP): Přiskočí k maršálovi, přehodí přes něj plášť (+2 Zbroj, +3 HP, +1 AP, kouřová clona 3×3 a vyproštění ze zadržení) a sám získá +1 Zbroj a +1 AP!",
      "Taktický tlak (Kolo 5): V 5. kole vtrhnou z Mostecké ulice těžké švédské posily! Pospěšte přes zahradu k pramici, zbytečně neotálejte v paláci.",
    ],
    keyBadges: [
      { key: "5", label: "Zvláštní schopnost" },
      { key: "1", label: "Režim pohybu" },
      { key: "Tab", label: "Výběr vojáka" },
    ],
    beaconLabel: "Pozice pro podporu maršála",
    beaconCoord: "[9, 0, 19]",
  },
  {
    step: 2,
    title: "Krytí, Míření & Svatováclavské soustředění",
    speaker: "Václav z Michalovic",
    role: "Klementinský klerik & písař",
    avatarIcon: "jan",
    dialogue:
      "Pozor, pane! Švédští jezdci generála Königsmarcka vpadli do zahrady! Ukryji doutnák své muškety pod klobouk [5] — ani v tomhle lijáku mi prach na pánvičce neselže!",
    tactics: [
      "Kryt (−20 / −40): Barokní štít s číslem udává snížení šance nepřítele na zásah (20 % poloviční kryt, 40 % plný kryt).",
      "Obchvat (Flanking): Útok ze strany ruší soupeřův kryt a přidává +40 % ke kritickému zásahu!",
      "Schopnost Václava [5] — Svatováclavské soustředění (0 AP): Zruší selhání doutnáku (0 % Misfire), ignoruje kryt zídek, přidá +35 % Zásah, +45 % Krit, +3 DMG, +2 Průraz zbroje a vrátí +1 AP!",
    ],
    keyBadges: [
      { key: "5", label: "Soustředění (0 AP)" },
      { key: "2", label: "Míření na cíl" },
      { key: "F1", label: "Rozpis šancí" },
    ],
    beaconLabel: "Krytí a palebný úhel na nepřítele",
  },
  {
    step: 3,
    title: "Počasí, Sudy & Maltézská šrapnelová salva",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    avatarIcon: "bartolomej",
    dialogue:
      "Milostivý pane! Mám v brašně speciální šrapnelové patrony z naší maltézské zbrojnice [5]! Jedním výstřelem zahalím naše pozice dýmem a zasypu Švédy sekaným olovem!",
    tactics: [
      "Noční liják: Doutnákové muškety mají až 35% šanci na selhání zápalu (misfire). Kolečkové zbraně fungují spolehlivě!",
      "Prachové sudy (Powder Kegs): Exploze na ploše 3×3 zničí nízké zdi a způsobí masivní poškození (5 HP a -2 zbroj).",
      "Schopnost Bartoloměje [5] — Maltézská šrapnelová salva (1 AP): Zasáhne nepřátele v okruhu (3 HP, -2 zbroj, omráčení), vytvoří clonu dýmu (3×3), odpálí sudy a doplní si +1 granát!",
    ],
    keyBadges: [
      { key: "5", label: "Šrapnelová salva" },
      { key: "4", label: "Hod petardou" },
      { key: "3", label: "Hlídka (Overwatch)" },
    ],
    beaconLabel: "Prachový sud k odpálení",
    beaconCoord: "[6, 0, 11]",
  },
  {
    step: 4,
    title: "Schodiště, Patra paláce & Únik k Čertovce",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    avatarIcon: "bartolomej",
    dialogue:
      "Za zahradou teče mlýnská stoka Čertovka! Rybář čeká s pramicí u vzdáleného dřevěného mola. Můžete využít přímá i točitá schodiště do 1. patra (Piano Nobile) a na Maltézskou věž (2. patro) pro palebnou převahu!",
    tactics: [
      "Přímá a točitá schodiště [V / PgUp / PgDn]: Vystoupejte po kamenných schodištích do 1. patra paláce či zahradního belvederu (P1) nebo až na Maltézskou strážní věž (P2) pro bonus +15 % k zásahu z výšky!",
      "Celá obrazovka [F]: Stiskněte klávesu F pro pohlcující zobrazení bitvy přes celou obrazovku.",
      "Cíl mise: Doveďte maršála Colloreda přes Velkopřevorskou zahradu na molo [2, 0, 2] k pramici na Čertovce a zvolte hrdinu, který zůstane krýt ústup!",
      "Vyhnutí se posilám: Pokud dorazíte k pramici do 4. kola, maršál unikne dříve, než dorazí švédská jízda z Mostecké ulice!",
    ],
    keyBadges: [
      { key: "V", label: "Patra P0/P1/P2" },
      { key: "F", label: "Celá obrazovka" },
      { key: "⎵", label: "Ukončení tahu" },
    ],
    beaconLabel: "Rybářská pramice na Čertovce",
    beaconCoord: "[2, 0, 2]",
  },
];

export function TacticalAdvisorWidget() {
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const units = useGameStore((s) => s.units);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const turn = useGameStore((s) => s.turn);
  const isBusy = useGameStore((s) => s.isBusy);
  const actionMode = useGameStore((s) => s.actionMode);
  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const demonstratedAbilities = useGameStore((s) => s.demonstratedAbilities);

  const setTutorialStep = useGameStore((s) => s.setTutorialStep);
  const advanceTutorialStep = useGameStore((s) => s.advanceTutorialStep);
  const toggleTutorial = useGameStore((s) => s.toggleTutorial);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const activateSpecialAbility = useGameStore((s) => s.activateSpecialAbility);

  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [forceExpandedInAim, setForceExpandedInAim] = useState(false);
  const { dragStyle, onPointerDown, hasMoved, resetOffset } = useDraggableHud();

  const isAiming = actionMode === "shoot" || activeProjectile !== null;
  // Během míření a střelby se rádce automaticky skryje, aby vůbec nezakrýval střeleckou kameru
  if (isAiming && !forceExpandedInAim) {
    return null;
  }

  const isCompact = manualCollapsed;

  const handleToggleCompact = () => {
    if (isAiming) {
      setForceExpandedInAim((prev) => !prev);
      setManualCollapsed(false);
    } else {
      setManualCollapsed((prev) => !prev);
    }
  };

  if (tutorialDismissed) {
    return (
      <div style={dragStyle} className="pointer-events-auto flex items-center gap-1">
        <button
          type="button"
          onClick={toggleTutorial}
          title="Otevřít taktického rádce (klávesa H)"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 hover:bg-slate-900 border border-amber-500/80 hover:border-amber-400 text-amber-200 shadow-2xl backdrop-blur-md text-xs font-cinzel font-black transition-all select-none cursor-pointer"
        >
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <span>Rádce</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-900 text-[10px] font-cinzel font-black text-amber-300 border border-amber-500/50">
            H
          </span>
        </button>
      </div>
    );
  }

  if (tutorialStep === null) return null;

  const currentData =
    TUTORIAL_STEPS.find((t) => t.step === tutorialStep) ?? TUTORIAL_STEPS[0]!;

  const playableHeroes = PLAYABLE_HERO_IDS.map((id) =>
    units.find((u) => u.id === id),
  ).filter((u): u is NonNullable<typeof u> => !!u);

  const stepPreferredHeroId =
    tutorialStep === 1
      ? "player-jan-matej"
      : tutorialStep === 2
        ? "player-vaclav-michalovic"
        : "player-bartolomej";

  const selectedPlayableHero = playableHeroes.find(
    (h) => h.id === selectedUnitId,
  );
  const showcaseHero =
    selectedPlayableHero ??
    playableHeroes.find((h) => h.id === stepPreferredHeroId) ??
    playableHeroes[0] ??
    null;

  const showcaseAbility = showcaseHero?.ability;
  const canDemonstrateNow =
    turn === "player" &&
    !isBusy &&
    !!showcaseHero &&
    showcaseHero.alive &&
    showcaseHero.hp > 0 &&
    !!showcaseAbility &&
    showcaseAbility.currentCooldown === 0 &&
    showcaseHero.ap >= showcaseAbility.apCost;

  const demonstratedCount = playableHeroes.filter(
    (h) => demonstratedAbilities[h.id],
  ).length;

  return (
    <aside
      aria-label="Taktický rádce"
      style={dragStyle}
      className="pointer-events-auto w-80 md:w-96 flex flex-col gap-2 baroque-cartouche baroque-border rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.95)] text-amber-50 select-none bg-slate-950/95 border-amber-500/80 max-h-[calc(100dvh-230px)] overflow-y-auto"
    >
      {/* 1. Přetahovatelné záhlaví (Drag Handle) + přepínač kroků + sbalení / zavření */}
      <div
        onPointerDown={onPointerDown}
        title="Tažením myší můžete kartu rádce odsunout kamkoliv na obrazovce"
        className="flex items-center justify-between gap-1.5 border-b border-amber-900/80 pb-1.5 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-4 h-4 text-amber-400/70 shrink-0" />
          <span className="font-cinzel font-black text-xs uppercase tracking-wider text-amber-200 truncate">
            Rádce · Krok {currentData.step}/4
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Přepínání 4 kroků */}
          <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-md border border-amber-900/80">
            {TUTORIAL_STEPS.map((s) => {
              const isActive = s.step === tutorialStep;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setTutorialStep(s.step)}
                  title={`Krok ${s.step}: ${s.title}`}
                  className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-cinzel font-black transition-all cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                      : "text-amber-300/80 hover:text-amber-100 hover:bg-amber-950/80"
                  }`}
                >
                  {s.step}
                </button>
              );
            })}
          </div>

          {hasMoved && (
            <button
              type="button"
              onClick={resetOffset}
              title="Vrátit kartu na výchozí místo"
              className="p-1 rounded text-amber-400 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sbalit / rozbalit obsah karty */}
          <button
            type="button"
            onClick={handleToggleCompact}
            title={isCompact ? "Rozbalit podrobnosti rádce" : "Sbalit do kompaktní lišty"}
            className="p-1 rounded text-amber-400 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
          >
            {isCompact ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          {/* Úplné skrytí do tlačítka (H) */}
          <button
            type="button"
            onClick={toggleTutorial}
            title="Skrýt rádce (klávesa H)"
            className="p-1 rounded text-amber-400 hover:text-amber-100 hover:bg-amber-950/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isCompact ? (
        /* KOMPAKTNÍ REŽIM: Pouze název kroku a rychlá navigace (žádné překrývání s bojištěm či mířením) */
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-cinzel font-bold text-amber-300 truncate">
            {currentData.title}
          </span>
          <button
            type="button"
            onClick={handleToggleCompact}
            className="px-2 py-0.5 rounded baroque-bronze-btn text-[10px] font-cinzel font-bold text-amber-200 hover:text-amber-100 shrink-0 cursor-pointer"
          >
            Detail
          </button>
        </div>
      ) : (
        <>
          {/* 2. Diegetický řečník */}
          <div className="flex items-start gap-2.5 bg-slate-900/90 rounded-lg p-2 border border-amber-900/80">
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-500/60 flex items-center justify-center shrink-0 text-amber-300">
              {currentData.avatarIcon === "jan" ? (
                <UserCheck className="w-4 h-4" />
              ) : (
                <Wrench className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-cinzel font-black text-xs text-amber-300 leading-tight">
                  {currentData.speaker}
                </span>
                <span className="text-[10px] text-amber-400/90 font-literata truncate font-medium">
                  · {currentData.role}
                </span>
              </div>
              <p className="font-literata italic text-[11px] text-amber-100 mt-0.5 leading-snug font-medium">
                „{currentData.dialogue}“
              </p>
            </div>
          </div>

          {/* 3. INTERAKTIVNÍ UKÁZKA SCHOPNOSTÍ 3 HRDINŮ */}
          {showcaseHero && showcaseAbility && (
            <div className="rounded-lg bg-amber-950/50 border border-amber-500/60 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-cinzel text-[10px] font-black uppercase tracking-wider text-amber-300">
                    Zvláštní schopnosti ({demonstratedCount}/3)
                  </span>
                </div>
                <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-400/50">
                  Klávesa [5]
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {playableHeroes.map((hero) => {
                  const isSelected = hero.id === showcaseHero.id;
                  const isDone = !!demonstratedAbilities[hero.id];
                  return (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => selectUnit(hero.id)}
                      className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-[10px] font-cinzel font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-600/40 border-amber-400 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                          : "baroque-bronze-btn text-amber-200 hover:text-amber-100"
                      }`}
                    >
                      <span className="truncate">{hero.name}</span>
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="text-[9px] font-cinzel text-amber-400 shrink-0 font-black">
                          [5]
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-900/90 rounded p-2 border border-amber-900/80 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-cinzel font-black text-xs text-amber-200">
                    {showcaseAbility.name}
                  </span>
                  <span className="text-[9px] font-cinzel font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/60">
                    {showcaseAbility.apCost} AP · CD {showcaseAbility.cooldownTurns}
                  </span>
                </div>
                <p className="font-literata text-[10px] text-amber-100/90 leading-snug font-medium">
                  {showcaseAbility.description}
                </p>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="font-literata text-[10px] italic text-amber-300 font-medium">
                    {demonstratedAbilities[showcaseHero.id]
                      ? "✓ Osvojeno v boji"
                      : "Vyzkoušejte schopnost:"}
                  </span>
                  <button
                    type="button"
                    disabled={!canDemonstrateNow}
                    onClick={() => activateSpecialAbility(showcaseHero.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-stone-950 disabled:text-slate-500 text-[10px] font-cinzel font-black uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>
                      {showcaseAbility.currentCooldown > 0
                        ? `Obnova (${showcaseAbility.currentCooldown} k.)`
                        : `Demonstrovat [5]`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Taktické instrukce a mechaniky */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-amber-100">
              <span className="font-cinzel font-black text-amber-300">
                {currentData.title}
              </span>
              {currentData.beaconCoord && (
                <span className="text-[10px] font-cinzel font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/50">
                  Maják: {currentData.beaconCoord}
                </span>
              )}
            </div>

            <ul className="space-y-1 font-literata text-[11px] text-amber-100 leading-snug font-medium">
              {currentData.tactics.map((point, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-extrabold shrink-0">❖</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 5. Navigační patka */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-900/80 text-[10px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={tutorialStep <= 1}
                onClick={() =>
                  setTutorialStep(
                    (Math.max(1, tutorialStep - 1) as 1 | 2 | 3 | 4),
                  )
                }
                className="flex items-center gap-1 px-2 py-1 rounded baroque-bronze-btn text-amber-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer font-cinzel font-bold"
              >
                <ChevronLeft className="w-3 h-3 text-amber-400" />
                <span>Zpět</span>
              </button>

              <button
                type="button"
                onClick={advanceTutorialStep}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-cinzel font-black transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
              >
                <span>
                  {tutorialStep < 4 ? "Další krok" : "Rozumím"}
                </span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <span className="text-amber-400 font-literata text-[10px] font-medium">
              Skrýt: <span className="text-amber-300 font-cinzel font-black">[H]</span>
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
