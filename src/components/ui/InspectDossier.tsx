/**
 * Úplný přehled (F1 / 0).
 * List ve stylu Yet Another F1: hlavička, statistiky, výzbroj, schopnosti a stavy.
 * Klepnutí na F1 nebo 0 ukáže vybranou postavu (při míření nepřítele).
 * Podržení a klik ukáže postavu, dveře nebo terén, aniž by vydal rozkaz.
 */

import { GripHorizontal, X } from "lucide-react";
import { buildInspectView, type InspectLabeledValue, type InspectView } from "../../core/inspectView";
import type { StatModifier } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { BaroqueCoverBadge } from "./BaroqueCoverBadge";
import { UnitPortrait } from "./UnitPortrait";
import { useDraggableHud } from "./useDraggableHud";

function ModifierRow({ item }: { item: StatModifier }) {
  const isPositive = item.kind === "bonus" || (item.kind === "base" && item.value > 0);
  const isPenalty = item.kind === "penalty" || item.value < 0;
  const formatted =
    item.unit === "%"
      ? `${item.value > 0 ? `+${item.value}` : item.value} %`
      : `${item.value > 0 ? `+${item.value}` : item.value} ${item.unit}`;

  return (
    <div className="flex items-start justify-between gap-2 py-0.5 text-[11px]">
      <div className="min-w-0">
        <div className="font-cinzel font-bold text-amber-100 leading-tight">{item.label}</div>
        {item.detail && (
          <div className="font-literata italic text-[10px] text-amber-200/75 leading-tight">
            {item.detail}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 font-cinzel font-black tabular-nums ${
          isPositive ? "text-emerald-300" : isPenalty ? "text-rose-300" : "text-amber-200"
        }`}
      >
        {formatted}
      </span>
    </div>
  );
}

function LineList({ lines }: { lines: InspectLabeledValue[] }) {
  return (
    <dl className="space-y-1">
      {lines.map((line) => (
        <div key={line.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-[11px]">
          <dt className="font-cinzel font-bold text-amber-200/70">{line.label}</dt>
          <dd className="font-literata text-amber-50 leading-snug">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="font-cinzel font-black text-[10px] uppercase tracking-wider text-amber-300/90 border-b border-amber-900/70 pb-1 mb-1.5">
      {children}
    </h3>
  );
}

function toneClass(tone: InspectView["tone"]): string {
  if (tone === "crimson") return "border-rose-500/80";
  if (tone === "stone") return "border-stone-500/70";
  return "border-amber-500/75";
}

export function InspectDossier() {
  const inspectOpen = useGameStore((s) => s.inspectOpen);
  const inspectKeyHeld = useGameStore((s) => s.inspectKeyHeld);
  const inspectPin = useGameStore((s) => s.inspectPin);
  const units = useGameStore((s) => s.units);
  const grid = useGameStore((s) => s.grid);
  const gridVersion = useGameStore((s) => s.gridVersion);
  const fogSnapshot = useGameStore((s) => s.fogSnapshot);
  const fogOfWarEnabled = useGameStore((s) => s.fogOfWarEnabled);
  const actionMode = useGameStore((s) => s.actionMode);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const visibleTargets = useGameStore((s) => s.visibleTargets);
  const visibleMeleeTargets = useGameStore((s) => s.visibleMeleeTargets);
  const closeInspect = useGameStore((s) => s.closeInspect);
  const drag = useDraggableHud();

  if (!inspectOpen) return null;

  const shot = visibleTargets.find((target) => target.targetId === selectedTargetId)?.calculation;
  const melee = visibleMeleeTargets.find((target) => target.targetId === selectedTargetId)?.calculation;
  const activeCombat =
    actionMode === "shoot" && shot
      ? {
          mode: "shot" as const,
          targetId: shot.targetId,
          hitChance: shot.hitChance,
          critChance: shot.critChance,
          minDamage: shot.minDamage,
          maxDamage: shot.maxDamage,
          misfireChance: shot.misfireChance,
          armorPierce: shot.armorPierce,
          armorShred: shot.armorShred,
          hitModifiers: shot.hitModifiers,
          critModifiers: shot.critModifiers,
        }
      : actionMode === "melee" && melee
        ? {
            mode: "melee" as const,
            targetId: melee.targetId,
            hitChance: melee.hitChance,
            critChance: melee.critChance,
            minDamage: melee.minDamage,
            maxDamage: melee.maxDamage,
            armorPierce: melee.armorPierce,
            armorShred: melee.armorShred,
            hitModifiers: melee.hitModifiers,
            critModifiers: melee.critModifiers,
          }
        : null;

  const view = buildInspectView({
    units,
    tileAt: (coord) => grid.getTile(coord),
    doorAt: (coord) => grid.getDoor(coord),
    fog: fogSnapshot,
    fogOfWarEnabled,
    pin: inspectPin,
    actionMode,
    selectedUnitId,
    selectedTargetId,
    activeCombat,
  });
  void gridVersion;

  return (
    <div className={`fixed inset-0 z-[70] ${inspectKeyHeld ? "pointer-events-none" : ""}`}>
      <button
        type="button"
        aria-label="Zavřít úplný přehled"
        className={`absolute inset-0 bg-slate-950/40 ${
          inspectKeyHeld ? "pointer-events-none" : "cursor-default"
        }`}
        onClick={() => closeInspect()}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
        <article
          role="dialog"
          aria-modal="false"
          aria-labelledby="inspect-dossier-title"
          style={drag.dragStyle}
          className={`pointer-events-auto w-[min(720px,calc(100vw-1.5rem))] max-h-[min(78dvh,760px)] overflow-hidden flex flex-col baroque-cartouche baroque-border rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.9)] bg-slate-950/95 backdrop-blur-md text-amber-50 ${toneClass(view.tone)}`}
        >
          <header
            onPointerDown={drag.onPointerDown}
            className="flex items-center gap-2 px-3 py-2 border-b border-amber-900/70 cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
            <h2
              id="inspect-dossier-title"
              className="font-cinzel font-black text-sm uppercase tracking-wide text-amber-100 truncate"
            >
              {view.title}
            </h2>
            <span className="ml-auto font-cinzel text-[10px] text-amber-300/70 shrink-0">F1 / 0</span>
            <button
              type="button"
              onClick={() => closeInspect()}
              title="Zavřít [F1 / 0 / Esc]"
              className="p-1 rounded text-amber-300 hover:text-amber-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="min-h-0 overflow-y-auto px-3 py-2.5">
            {view.kind === "empty" && <EmptyBody detail={view.detail} />}
            {view.kind === "contact" && <ContactBody view={view} />}
            {view.kind === "terrain" && <TerrainBody view={view} />}
            {view.kind === "unit" && <UnitBody view={view} />}
          </div>
        </article>
      </div>
    </div>
  );
}

function EmptyBody({ detail }: { detail: string }) {
  return <p className="font-literata text-sm text-amber-100/90 leading-relaxed">{detail}</p>;
}

function ContactBody({ view }: { view: Extract<InspectView, { kind: "contact" }> }) {
  return (
    <div className="space-y-2">
      <p className="font-cinzel font-black text-base text-amber-100">{view.headline}</p>
      <p className="font-literata text-sm text-amber-100/90 leading-relaxed">{view.detail}</p>
      {view.distance && (
        <p className="font-cinzel text-xs text-amber-300 tabular-nums">{view.distance}</p>
      )}
      <p className="font-literata italic text-[11px] text-amber-200/70">
        Jméno, zbraň a schopnosti zůstávají skryté, dokud postavu neuvidíte.
      </p>
    </div>
  );
}

function TerrainBody({ view }: { view: Extract<InspectView, { kind: "terrain" }> }) {
  return (
    <div className="space-y-3">
      <p className="font-literata text-sm text-amber-100/90 leading-relaxed">{view.summary}</p>
      {view.lines.length > 0 && <LineList lines={view.lines} />}
      {view.cover && (
        <div>
          <SectionTitle>Kryt proti střelbě</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {view.cover.map((side) => (
              <div
                key={side.dir}
                className="flex items-center justify-between gap-1 rounded-md bg-slate-900/80 border border-amber-900/50 px-2 py-1"
              >
                <span className="font-cinzel text-[10px] text-amber-200/80">{side.dir}</span>
                <span className="font-literata text-[11px] text-amber-50">{side.label}</span>
                <BaroqueCoverBadge cover={side.level} size="sm" showZero />
              </div>
            ))}
          </div>
        </div>
      )}
      {view.occupant && (
        <p className="font-cinzel text-xs text-amber-200">
          Na poli stojí {view.occupant}. Klepněte na postavu pro její list.
        </p>
      )}
    </div>
  );
}

function UnitBody({ view }: { view: Extract<InspectView, { kind: "unit" }> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <UnitPortrait
          archetype={view.archetype}
          faction={view.faction}
          name={view.name}
          size="xl"
          isVip={view.isVip}
          alive={view.alive}
          isDetained={view.detained}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-cinzel font-black text-lg text-amber-50 leading-tight truncate">
              {view.name}
            </h3>
            <BaroqueCoverBadge cover={view.bestCover} size="sm" showZero />
          </div>
          <p className="font-literata italic text-xs text-amber-200/85 leading-snug">{view.roleTitle}</p>
          <p className="font-cinzel text-[11px] text-amber-300/90 mt-1">
            {view.factionLine} · {view.place} · hledí {view.facing}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {view.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md bg-slate-900/80 border border-amber-900/50 px-2 py-1"
          >
            <div className="font-cinzel text-[9px] uppercase tracking-wide text-amber-300/75">
              {stat.label}
            </div>
            <div className="font-cinzel font-black text-sm text-amber-50 tabular-nums leading-tight">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {view.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {view.conditions.map((chip) => (
            <span
              key={chip}
              className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-700/50 font-cinzel text-[10px] text-amber-100"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section>
          <SectionTitle>Palná zbraň</SectionTitle>
          <p className="font-cinzel font-bold text-xs text-amber-100 mb-1">{view.firearmName}</p>
          <LineList lines={view.firearm} />
        </section>
        <div className="space-y-3">
          {view.meleeName && (
            <section>
              <SectionTitle>Zbraň nablízko</SectionTitle>
              <p className="font-cinzel font-bold text-xs text-amber-100 mb-1">{view.meleeName}</p>
              <LineList lines={view.melee} />
            </section>
          )}
          {(view.ability ||
            (view.passive && !view.conditions.includes(view.passive))) && (
            <section>
              <SectionTitle>Schopnosti a stavy</SectionTitle>
              {view.passive && !view.conditions.includes(view.passive) && (
                <p className="font-literata text-[12px] text-amber-100/90 mb-1.5">{view.passive}</p>
              )}
              {view.ability && (
                <div>
                  <p className="font-cinzel font-bold text-xs text-amber-100">{view.ability.name}</p>
                  <p className="font-literata italic text-[11px] text-amber-200/80">
                    {view.ability.subtitle}
                  </p>
                  <p className="font-literata text-[12px] text-amber-50/95 leading-snug mt-0.5">
                    {view.ability.description}
                  </p>
                  <p className="font-cinzel text-[10px] text-amber-300 mt-1 tabular-nums">
                    {view.ability.meta}
                  </p>
                </div>
              )}
            </section>
          )}
          {view.combat && (
            <section>
              <SectionTitle>{view.combat.title}</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <Metric label="Zásah" value={`${view.combat.hitChance} %`} />
                <Metric label="Krit" value={`${view.combat.critChance} %`} />
                <Metric label="Zranění" value={view.combat.damage} />
                {view.combat.misfire && <Metric label="Selhání" value={view.combat.misfire} />}
              </div>
              <p className="font-cinzel text-[10px] text-amber-300/90 mb-1">{view.combat.pierce}</p>
              <div className="space-y-0.5">
                {view.combat.hitModifiers.map((mod) => (
                  <ModifierRow key={`hit-${mod.id}`} item={mod} />
                ))}
                {view.combat.critModifiers.map((mod) => (
                  <ModifierRow key={`crit-${mod.id}`} item={mod} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-900/80 border border-amber-900/50 px-2 py-1">
      <div className="font-cinzel text-[9px] uppercase text-amber-300/75">{label}</div>
      <div className="font-cinzel font-black text-sm text-amber-50 tabular-nums">{value}</div>
    </div>
  );
}
