/**
 * Úvodní stránka. Barokní nápis a dvě mise ve stejném jazyce jako taktický HUD:
 * zlatá kartuše, Cinzel, oddělovače · a stužka stavu.
 */

import { Shield, Swords } from "lucide-react";
import type { ReactNode } from "react";
import { text, useLocale } from "../../i18n";
import { useGameStore } from "../../store/useGameStore";

export function TitleScreen() {
  const locale = useLocale();
  const beginScenario = useGameStore((s) => s.beginScenario);

  return (
    <div className="relative min-h-dvh">
      <div className="title-torch pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.78)_78%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-dvh w-full min-w-0 max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10">
        <p className="baroque-cartouche baroque-border flex max-w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl bg-slate-950/88 px-3 py-1.5 text-center font-cinzel text-[10px] font-black uppercase leading-relaxed tracking-wider text-amber-200 shadow-[0_4px_20px_rgba(0,0,0,0.85)] backdrop-blur-md sm:text-[11px]">
          <Swords className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
          <span>{text("ui.title.company", undefined, locale)}</span>
          <span className="text-amber-500/70" aria-hidden="true">
            ·
          </span>
          <span className="text-amber-300">{text("ui.title.motto", undefined, locale)}</span>
          <span className="text-amber-500/70" aria-hidden="true">
            ·
          </span>
          <span>{text("ui.title.date", undefined, locale)}</span>
        </p>

        <header className="baroque-border w-full min-w-0 max-w-xl px-4 py-5 text-center sm:px-12">
          <div className="mb-2 flex items-center justify-center gap-3 text-xs text-amber-500/80">
            <span aria-hidden="true">❖ ✦ ❖</span>
            <span className="font-cinzel text-[11px] font-bold uppercase tracking-[0.35em] text-amber-300">
              {text("ui.title.anno", undefined, locale)}
            </span>
            <span aria-hidden="true">❖ ✦ ❖</span>
          </div>

          <h1 className="leading-none">
            <span className="sr-only">{text("ui.title.aria", undefined, locale)}</span>
            <span
              aria-hidden="true"
              className="block pl-[0.48em] font-cinzel text-lg font-black uppercase tracking-[0.48em] text-amber-100 sm:text-2xl"
            >
              {text("ui.title.place", undefined, locale)}
            </span>
            <span
              aria-hidden="true"
              className="baroque-gold mt-2 block pl-[0.14em] font-cinzel text-6xl font-black tracking-[0.14em] sm:text-8xl"
            >
              {text("ui.title.year", undefined, locale)}
            </span>
            <span
              aria-hidden="true"
              className="mx-auto my-4 block h-px w-48 bg-gradient-to-r from-transparent via-amber-500/70 to-transparent"
            />
            <span
              aria-hidden="true"
              className="block font-literata text-xl italic tracking-wide text-amber-100 sm:text-2xl"
            >
              {text("ui.title.subtitle", undefined, locale)}
            </span>
          </h1>
        </header>

        <p className="font-cinzel text-xs font-bold uppercase tracking-[0.28em] text-amber-400">
          {text("ui.briefing.title", undefined, locale)}
        </p>

        <div className="grid w-full min-w-0 gap-4 md:grid-cols-2">
          <MissionCard
            icon={<Swords className="h-4 w-4 text-amber-300" aria-hidden="true" />}
            indexLabel={text("ui.briefing.mission1.index", undefined, locale)}
            when={text("ui.briefing.mission1.when", undefined, locale)}
            title={text("ui.briefing.mission1.title", undefined, locale)}
            place={text("ui.briefing.mission1.place", undefined, locale)}
            body={text("ui.briefing.mission1.body", undefined, locale)}
            chip={text("ui.mission.boat", undefined, locale)}
            start={text("ui.briefing.start", undefined, locale)}
            onStart={() => beginScenario("mission1")}
          />
          <MissionCard
            icon={<Shield className="h-4 w-4 text-amber-300" aria-hidden="true" />}
            indexLabel={text("ui.briefing.mission2.index", undefined, locale)}
            when={text("ui.briefing.mission2.when", undefined, locale)}
            title={text("ui.briefing.mission2.title", undefined, locale)}
            place={text("ui.briefing.mission2.place", undefined, locale)}
            body={text("ui.briefing.mission2.body", undefined, locale)}
            chip={text("ui.briefing.mission2.chip", undefined, locale)}
            start={text("ui.briefing.start", undefined, locale)}
            onStart={() => beginScenario("mission2")}
          />
        </div>
      </div>
    </div>
  );
}

function MissionCard({
  icon,
  indexLabel,
  when,
  title,
  place,
  body,
  chip,
  start,
  onStart,
}: {
  icon: ReactNode;
  indexLabel: string;
  when: string;
  title: string;
  place: string;
  body: string;
  chip: string;
  start: string;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="title-mission baroque-cartouche baroque-border group flex min-w-0 cursor-pointer flex-col rounded-xl bg-slate-950/90 p-4 text-left text-amber-50 shadow-[0_8px_32px_rgba(0,0,0,0.92)] backdrop-blur-md"
    >
      <span className="flex items-center gap-2 font-cinzel text-[11px] font-black uppercase tracking-wider text-amber-200">
        {icon}
        <span>{indexLabel}</span>
        <span className="text-amber-500/70" aria-hidden="true">
          ·
        </span>
        <span className="text-amber-300">{when}</span>
      </span>

      <span className="baroque-gold mt-3 block font-cinzel text-2xl font-black uppercase tracking-wider">
        {title}
      </span>
      <span className="mt-1 block break-words font-cinzel text-[11px] font-bold uppercase tracking-wide text-amber-400">
        {place}
      </span>
      <span className="mt-2 block flex-1 font-literata text-sm leading-relaxed text-amber-100/90">
        {body}
      </span>

      <span className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-amber-900/70 pt-3">
        <span className="font-cinzel text-[11px] font-black uppercase tracking-wider text-amber-200">
          {chip}
        </span>
        <span className="inline-flex shrink-0 items-center rounded-lg border border-amber-300 bg-amber-500 px-3 py-1.5 font-cinzel text-xs font-bold uppercase tracking-wider text-stone-950 shadow-[0_4px_16px_rgba(245,158,11,0.35)] transition-colors group-hover:bg-amber-400">
          {start}
        </span>
      </span>
    </button>
  );
}
