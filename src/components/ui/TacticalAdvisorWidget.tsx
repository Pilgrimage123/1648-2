/**
 * Tactical Advisor Widget (/src/components/ui/TacticalAdvisorWidget.tsx).
 * Plovoucí taktický rádce a diegetický tutoriál pro 1. misi ("Útěk maršála Colloreda").
 * Ukotven v levém horním rohu pod MissionStatusChip:
 * - Autentický diegetický hlas průvodců (komorník Martin a mistr zbrojíř Jakub)
 * - 4 postupné milníky základních mechanik (Pohyb a eskorta, Krytí a míření, Počasí a výbušniny, Patra a únik)
 * - Zvýraznění klávesových zkratek ([1], [2], [Tab], [F1], [4], [F], [Space])
 * - Manuální navigace mezi kroky i automatický postup při splnění akcí
 * - Sbalení / minimalizace pomocí klávesy H nebo tlačítka
 */

import {
  Bomb,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Footprints,
  GraduationCap,
  Layers,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore";

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

const TUTORIAL_STEPS: TutorialStepData[] = [
  {
    step: 1,
    title: "Pohyb & Eskorta maršála",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    avatarIcon: "jan",
    dialogue:
      "Vaše Excelence! Po těch sedmi střelných ranách u Lützenu sotva stojíte na nohou! Opřete se o mě — posuňte mě na dlaždici vedle vás a pomohu vám utíkat zahradou k Čertovce! Švédové mají seznam hodnostářů a chtějí vás dostat živého pro obří výkupné!",
    tactics: [
      "Modrá zóna (1 AP): Běžný přesun, po němž můžete ještě střílet nebo hodit petardu.",
      "Žlutá zóna (2 AP): Sprint, který vyčerpá všechny akční body vojáka.",
      "Handicap maršála: Zraněný Colloredo ujde sám jen 3 pole za AP. Jakmile k němu posunete spojence (komorníka Jana Matěje), získá podporu a plných 5 polí/AP!",
      "Kořist a výkupné: Švédové se snaží maršála obklíčit a zajmout živého — nenechte jej padnout do jejich rukou!",
    ],
    keyBadges: [
      { key: "1", label: "Režim pohybu" },
      { key: "Tab", label: "Výběr vojáka" },
      { key: "Q / E", label: "Otočení kamery" },
    ],
    beaconLabel: "Pozice pro podporu maršála",
    beaconCoord: "[7, 0, 14]",
  },
  {
    step: 2,
    title: "Krytí, Obchvat & Míření",
    speaker: "Jan Matěj",
    role: "Osobní komorník velkopřevora",
    avatarIcon: "jan",
    dialogue:
      "Pozor, pane! Švédští jezdci generála Königsmarcka vpadli do zahrady! Zůstaňte za kamennou zídkou — střílejí na nohy, protože vědí, že živý polní maršál jim vynese sto tisíc tolarů výkupného!",
    tactics: [
      "Poloviční kryt (kamenná zídka): Snižuje nepříteli šanci na zásah o 20 %.",
      "Plný kryt (vysoká zeď / roh): Snižuje nepříteli šanci na zásah o 40 %.",
      "Obchvat (Flanking): Útok ze strany ruší soupeřův kryt a přidává +40 % ke kritickému zásahu!",
      "Režim míření [2]: Stiskněte [2] pro zacílení, [Tab] pro cyklení cílů a [F1] pro rozpad matematických šancí.",
    ],
    keyBadges: [
      { key: "2", label: "Míření na cíl" },
      { key: "Tab", label: "Přepínání cílů" },
      { key: "F1", label: "Rozpis šancí" },
      { key: "Enter / ⎵", label: "Výstřel" },
    ],
    beaconLabel: "Krytí a palebný úhel na nepřítele",
  },
  {
    step: 3,
    title: "Počasí & Prachové sudy",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    avatarIcon: "bartolomej",
    dialogue:
      "Milostivý pane! V tomhle nočním dešti zvlhnou švédské doutnáky a mušketýři budou selhávat! Vaše kolečková pistole i mé zbraně vystřelí spolehlivě. U branky jsem připravil prachové sudy — smeteme je Bartolomějovou petardou!",
    tactics: [
      "Noční liják: Doutnákové muškety mají až 35% šanci na selhání zápalu (misfire). Kolečkové zbraně fungují spolehlivě!",
      "Prachové sudy (Powder Kegs): Exploze na ploše 3×3 zničí nízké zdi a způsobí masivní poškození (5 HP a -2 zbroj).",
      "Bartolomějova petarda [4]: Vrhněte výbušninu k sudu, nebo do něj střelte z pistole!",
    ],
    keyBadges: [
      { key: "4", label: "Hod petardou" },
      { key: "3", label: "Hlídka (Overwatch)" },
    ],
    beaconLabel: "Prachový sud k odpálení",
    beaconCoord: "[5, 0, 8]",
  },
  {
    step: 4,
    title: "Patra & Únik k Čertovce",
    speaker: "Bratr Bartoloměj",
    role: "Maltézský zbrojmistr",
    avatarIcon: "bartolomej",
    dialogue:
      "Už vidím rameno Čertovky! Rybář čeká u dřevěného mola. Pozor však — švédští dragouni nám odřezávají ústup! Rozvodněná řeka a vratká pramice neunesou všechny... Jeden z nás bude muset zůstat u branky a koupit maršálovi čas!",
    tactics: [
      "Řez patry (Cutaway) [F]: Přepínejte mezi přízemím a 1. patrem pro odhalení střelců na střeše.",
      "Cíl mise: Doveďte maršála Colloreda na molo [1, 0, 2] k pramici pro záchranu pravého břehu Vltavy.",
      "Dilema oběti: U loďky zvolíte hrdinu, který zůstane krýt ústup a zdrží Švédy u palácové branky!",
    ],
    keyBadges: [
      { key: "F", label: "Řez patry (Cutaway)" },
      { key: "M", label: "Přepínač 2D/3D" },
      { key: "⎵", label: "Ukončení tahu" },
    ],
    beaconLabel: "Rybářská pramice na Čertovce",
    beaconCoord: "[1, 0, 2]",
  },
];

export function TacticalAdvisorWidget() {
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialDismissed = useGameStore((s) => s.tutorialDismissed);
  const setTutorialStep = useGameStore((s) => s.setTutorialStep);
  const advanceTutorialStep = useGameStore((s) => s.advanceTutorialStep);
  const toggleTutorial = useGameStore((s) => s.toggleTutorial);

  // Pokud je tutoriál sbalen klávesou H, zobrazí se pouze miniaturní vyvolávací lišta
  if (tutorialDismissed) {
    return (
      <button
        type="button"
        onClick={toggleTutorial}
        title="Otevřít taktického rádce (klávesa H)"
        className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-500/50 hover:border-amber-400 text-amber-200 shadow-xl backdrop-blur-md text-xs font-bold transition-all select-none cursor-pointer"
      >
        <GraduationCap className="w-4 h-4 text-amber-400" />
        <span>Taktický rádce</span>
        <span className="px-1 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-amber-300 border border-slate-700">
          H
        </span>
      </button>
    );
  }

  // Pokud je tutoriál dokončen a step === null, skryjeme
  if (tutorialStep === null) return null;

  const currentData =
    TUTORIAL_STEPS.find((t) => t.step === tutorialStep) ?? TUTORIAL_STEPS[0]!;

  return (
    <aside
      aria-label="Taktický rádce"
      className="pointer-events-auto w-80 md:w-96 flex flex-col gap-2.5 bg-slate-950/90 border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-slate-100 select-none transition-all animate-in fade-in zoom-in-95 duration-200"
    >
      {/* 1. Horní záhlaví rádce s kroky a tlačítkem minimalizace */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <GraduationCap className="w-3.5 h-3.5" />
          </div>
          <span className="font-serif font-black text-xs uppercase tracking-wider text-amber-200">
            Taktický rádce
          </span>
        </div>

        {/* Přepínání 4 kroků */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
          {TUTORIAL_STEPS.map((s) => {
            const isActive = s.step === tutorialStep;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setTutorialStep(s.step)}
                title={`Krok ${s.step}: ${s.title}`}
                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {s.step}
              </button>
            );
          })}
        </div>

        {/* Minimalizace (H) */}
        <button
          type="button"
          onClick={toggleTutorial}
          title="Minimalizovat rádce (klávesa H)"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Diegetický řečník (Komorník Martin / Mistr Jakub) */}
      <div className="flex items-start gap-2.5 bg-slate-900/70 rounded-xl p-2.5 border border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-slate-850 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300">
          {currentData.avatarIcon === "jan" ? (
            <UserCheck className="w-5 h-5" />
          ) : (
            <Wrench className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-serif font-extrabold text-xs text-amber-300 leading-tight">
              {currentData.speaker}
            </span>
            <span className="text-[10px] text-slate-400 font-medium truncate">
              · {currentData.role}
            </span>
          </div>
          <p className="text-[11px] text-slate-200 italic mt-0.5 leading-relaxed font-serif">
            „{currentData.dialogue}“
          </p>
        </div>
      </div>

      {/* 3. Taktické instrukce a mechaniky */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
          <span className="text-amber-400 font-black">
            Krok {currentData.step}: {currentData.title}
          </span>
          {currentData.beaconCoord && (
            <span className="text-[10px] font-mono text-amber-300/90 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
              Maják: {currentData.beaconCoord}
            </span>
          )}
        </div>

        <ul className="space-y-1 text-[11px] text-slate-300 leading-snug">
          {currentData.tactics.map((point, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold shrink-0">›</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Klávesové zkratky daného kroku */}
      <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
        {currentData.keyBadges.map((badge, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
          >
            <span className="px-1 py-0.2 rounded bg-slate-800 font-mono font-bold text-amber-300 border border-slate-700">
              {badge.key}
            </span>
            <span>{badge.label}</span>
          </div>
        ))}
      </div>

      {/* 5. Navigační patka: Zpět, Další krok, Klávesa H nápověda */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[10px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={tutorialStep <= 1}
            onClick={() =>
              setTutorialStep(
                (Math.max(1, tutorialStep - 1) as 1 | 2 | 3 | 4),
              )
            }
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            <span>Zpět</span>
          </button>

          <button
            type="button"
            onClick={advanceTutorialStep}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-colors"
          >
            <span>
              {tutorialStep < 4 ? "Další krok" : "Rozumím, pokračovat"}
            </span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <span className="text-slate-500 text-[10px]">
          Skrýt: <span className="text-amber-400 font-mono font-bold">[H]</span>
        </span>
      </div>
    </aside>
  );
}
