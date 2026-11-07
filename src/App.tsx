/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Flag,
  Heart,
  RotateCcw,
  RotateCw,
  Shield,
  Ship,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createBriefingSnapshot, createGame, type GameHandle } from "./game/main";
import { pole } from "./game/orders";
import type {
  CameraPreset,
  HudUnit,
  ProjectedFloatingText,
  ProjectedUnitPlate,
  Snapshot,
} from "./game/types";

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot>(() => createBriefingSnapshot());
  const [plates, setPlates] = useState<ProjectedUnitPlate[]>([]);
  const [floats, setFloats] = useState<ProjectedFloatingText[]>([]);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [rosterTab, setRosterTab] = useState<"imperial" | "swedish">("imperial");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    let lastEmit = 0;
    const game = createGame(mountEl, setSnap, (nextPlates, nextFloats) => {
      const now = performance.now();
      if (now - lastEmit < 28 && nextFloats.length === 0) return;
      lastEmit = now;
      setPlates(nextPlates);
      setFloats(nextFloats);
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snap.log]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const g = gameRef.current;
      if (!g) return;
      const key = e.key.toLowerCase();

      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (snap.mode === "rozkaz") g.startRozkaz();
      } else if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        const w = snap.weaponButtons[idx];
        if (w) g.setWeapon(w.id);
      } else if (key === "r") {
        if (snap.reload.enabled) g.reload();
      } else if (key === "h") {
        setDockCollapsed((prev) => !prev);
      } else if (key === "c") {
        g.centerSelected();
      } else if (key === "v") {
        g.toggleActionCam();
      } else if (key === "l") {
        g.cycleLightingMood();
      } else if (key === "q") {
        g.rotateCamera(-1);
      } else if (key === "e") {
        g.rotateCamera(1);
      } else if (key === "w" || e.key === "ArrowUp") {
        g.panCamera(0, 1.4);
      } else if (key === "s" || e.key === "ArrowDown") {
        g.panCamera(0, -1.4);
      } else if (key === "a" || e.key === "ArrowLeft") {
        g.panCamera(-1.4, 0);
      } else if (key === "d" || e.key === "ArrowRight") {
        g.panCamera(1.4, 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snap.mode, snap.weaponButtons, snap.reload.enabled, helpOpen]);

  const api = () => gameRef.current;
  const imperials = snap.units.filter((u) => u.faction === "imperial");
  const swedes = snap.units.filter((u) => u.faction === "swedish");
  const selectedUnit = snap.units.find((u) => u.id === snap.selectedId) ?? null;
  const playable =
    snap.phase === "flight" || snap.phase === "dock" || snap.phase === "hold";

  const cycleCameraPreset = () => {
    const order: CameraPreset[] = ["isometric", "street", "overhead"];
    const idx = order.indexOf(snap.cameraPreset);
    const next = order[(idx + 1) % order.length] ?? "isometric";
    api()?.setCameraPreset(next);
  };

  const presetLabel =
    snap.cameraPreset === "overhead"
      ? "Nadhlavní"
      : snap.cameraPreset === "street"
        ? "Z ulice"
        : "3D Taktický";

  const moodLabel =
    snap.lightingMood === "chiaroscuro"
      ? "Šerosvit"
      : snap.lightingMood === "storm"
        ? "Bouře"
        : snap.lightingMood === "siege"
          ? "Obléhání"
          : snap.lightingMood === "mist"
            ? "Mlha"
            : "Atmosféra";

  return (
    <main className="app-viewport">
      {/* Isolated Three.js WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="webgl-stage"
        aria-label="3D Taktická mapa Malé Strany 1648"
      />

      {/* World-Projected 3D Unit Plates & Floating Combat Numbers */}
      {snap.phase !== "briefing" && !snap.epilogue ? (
        <div className="world-overlay">
          {plates.map((plate) =>
            plate.visible ? (
              <button
                key={plate.id}
                type="button"
                className="unit-plate"
                data-side={plate.faction}
                data-selected={plate.selected}
                style={{
                  transform: `translate3d(${Math.round(plate.screenX)}px, ${Math.round(plate.screenY)}px, 0) translate(-50%, -100%)`,
                }}
                onClick={() => api()?.activate(plate.id)}
              >
                <div className="unit-plate-top">
                  {plate.vip ? <span className="vip-tag">MARŠÁL</span> : null}
                  {plate.overwatch ? <span className="ow-tag">HRADBA</span> : null}
                  <span className="unit-plate-name">{plate.name}</span>
                  <span className="unit-plate-hp-num">
                    {plate.hp}/{plate.maxHp}
                  </span>
                  {plate.armor > 0 ? (
                    <span className="unit-plate-armor" title="Zbroj">
                      🛡{plate.armor}
                    </span>
                  ) : null}
                </div>

                <div className="unit-plate-bar" data-side={plate.faction}>
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, (plate.hp / plate.maxHp) * 100))}%`,
                    }}
                  />
                </div>

                <div className="unit-plate-bottom">
                  <span className="unit-plate-pips">
                    {Array.from({ length: Math.max(plate.maxAp, plate.ap) }, (_, i) => (
                      <i key={i} data-on={i < plate.ap} />
                    ))}
                  </span>
                  {plate.hitChance !== null ? (
                    <span className="unit-plate-chance">
                      {plate.hitChance} %
                      {plate.cover ? ` · kryt ${plate.cover}%` : ""}
                    </span>
                  ) : null}
                </div>
              </button>
            ) : null,
          )}

          {floats.map((f) => (
            <div
              key={f.id}
              className="floating-fx-text"
              style={{
                color: f.color,
                opacity: f.alpha,
                transform: `translate3d(${Math.round(f.screenX)}px, ${Math.round(f.screenY)}px, 0) translate(-50%, -50%)`,
              }}
            >
              {f.text}
            </div>
          ))}
        </div>
      ) : null}

      {/* Top Bar Contract: Zone 1 (Brand) — Zone 2 (Unboxed Metadata) — Zone 3 (Camera & Utility Actions) */}
      <header className="top-hud-bar">
        <span className="brand-wordmark">Malá Strana 1648</span>

        <div className="top-telemetry">
          <span>26. července 1648</span>
          <span aria-hidden="true">·</span>
          <span className="telemetry-highlight">{snap.phaseLabel}</span>
          <span aria-hidden="true">·</span>
          <span>Kolo {snap.round}</span>
          <span aria-hidden="true">·</span>
          <span>{snap.turn === "player" ? "Tah císařských" : "Tah Švédů"}</span>
          <span aria-hidden="true">·</span>
          <span>Nepřátel {snap.enemiesAlive}</span>
        </div>

        <div className="top-controls">
          <button
            type="button"
            className="hud-icon-btn"
            aria-label="Otočit kameru doleva (Q)"
            title="Otočit kameru doleva (Q)"
            onClick={() => api()?.rotateCamera(-1)}
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            className="hud-icon-btn"
            aria-label="Otočit kameru doprava (E)"
            title="Otočit kameru doprava (E)"
            onClick={() => api()?.rotateCamera(1)}
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            className="hud-ctrl-btn"
            title="Přepnout pohled kamery"
            onClick={cycleCameraPreset}
          >
            <Compass className="size-3.5" />
            <span>{presetLabel}</span>
          </button>
          <button
            type="button"
            className="hud-ctrl-btn"
            data-active={snap.actionCamEnabled}
            title="Akční kamera při útoku (V)"
            onClick={() => api()?.toggleActionCam()}
          >
            <Camera className="size-3.5" />
            <span>Akční kam.</span>
          </button>
          <button
            type="button"
            className="hud-ctrl-btn"
            data-active={snap.lightingMood !== "auto"}
            title="Přepnout atmosféru a osvětlení (L)"
            onClick={() => api()?.cycleLightingMood()}
          >
            <Sparkles className="size-3.5" />
            <span>{moodLabel}</span>
          </button>
          <button
            type="button"
            className="hud-ctrl-btn"
            title="Jak se velí"
            onClick={() => setHelpOpen(true)}
          >
            <BookOpen className="size-3.5" />
            <span>Jak se velí</span>
          </button>
          <button
            type="button"
            className="hud-icon-btn"
            aria-label={snap.muted ? "Zapnout zvuk" : "Ztlumit"}
            onClick={() => api()?.toggleMute()}
          >
            {snap.muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
          <button
            type="button"
            className="hud-icon-btn"
            aria-label="Nová mise"
            title="Restartovat misi"
            onClick={() => api()?.restart()}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </header>

      {/* Phase / Enemy Turn Banner & XCOM Target Sightline Callout */}
      <div className="center-banners">
        {snap.banner ? <div className="phase-banner">{snap.banner}</div> : null}

        {snap.aimPreview ? (
          <div
            className="xcom-aim-callout"
            data-valid={snap.aimPreview.valid}
          >
            <Crosshair className="size-4 shrink-0" />
            <div className="xcom-aim-body">
              <strong>{snap.aimPreview.weaponName}</strong>
              <span>·</span>
              <span>Zásah {snap.aimPreview.chance} %</span>
              <span>·</span>
              <span>Škoda {snap.aimPreview.damage}</span>
              {snap.aimPreview.cover > 0 ? (
                <>
                  <span>·</span>
                  <span>Kryt −{snap.aimPreview.cover} %</span>
                </>
              ) : null}
              {!snap.aimPreview.valid ? (
                <>
                  <span>·</span>
                  <span className="aim-warn">{snap.aimPreview.reasonText}</span>
                </>
              ) : null}
            </div>
          </div>
        ) : !snap.aimPreview && snap.movePreview ? (
          <div
            className="xcom-move-callout"
            data-dash={snap.movePreview.isDash}
          >
            <Compass className="size-4 shrink-0" />
            <div className="xcom-move-body">
              <span
                className="move-badge"
                data-dash={snap.movePreview.isDash}
              >
                {snap.movePreview.apCost === 1 ? "1. AKCE (1 AP)" : "2. AKCE / CHVAT (2 AP)"}
              </span>
              <span>·</span>
              <strong>{snap.movePreview.label}</strong>
              <span>·</span>
              <span>Přesun o {pole(snap.movePreview.steps)}</span>
              <span>·</span>
              <span>
                {snap.movePreview.cover > 0
                  ? `🛡 Kryt ${snap.movePreview.cover} %`
                  : "Bez krytu"}
              </span>
              <span>·</span>
              <span className={snap.movePreview.isDash ? "move-warn" : "move-info"}>
                {snap.movePreview.detail}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Unified Collapsible Bottom Tactical Command Dock */}
      <section
        className="bottom-dock-wrapper"
        data-collapsed={dockCollapsed}
        aria-label="Taktický panel rozkazů"
      >
        <div className="dock-handle-row">
          <div className="dock-hover-bar" aria-live="polite">
            <span className="hover-coords">
              {snap.hoverTile
                ? `[${snap.hoverTile.x + 1}, ${snap.hoverTile.y + 1}]`
                : "3D MAPA"}
            </span>
            <span>{snap.hoverText}</span>
          </div>
          <button
            type="button"
            className="dock-collapse-btn"
            onClick={() => setDockCollapsed((prev) => !prev)}
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="size-3.5" />
                <span>Zobrazit velení (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                <span>Skrýt velení (H)</span>
              </>
            )}
          </button>
        </div>

        <div className="bottom-dock">
          {/* Column 1: Roster Strip with Faction Switcher */}
          <div className="dock-col dock-roster-col">
            <div className="dock-col-header">
              <div className="segmented-tabs">
                <button
                  type="button"
                  className="seg-tab"
                  data-active={rosterTab === "imperial"}
                  onClick={() => setRosterTab("imperial")}
                >
                  Císařští ({imperials.filter((u) => u.alive && !u.embarked).length})
                </button>
                <button
                  type="button"
                  className="seg-tab"
                  data-active={rosterTab === "swedish"}
                  onClick={() => setRosterTab("swedish")}
                >
                  Švédové ({swedes.filter((u) => u.alive).length})
                </button>
              </div>
              <button
                type="button"
                className="center-unit-btn"
                title="Vycentrovat kameru na vybraného muže (C)"
                onClick={() => api()?.centerSelected()}
              >
                Střed (C)
              </button>
            </div>

            <div className="roster-grid">
              {(rosterTab === "imperial" ? imperials : swedes).map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  selected={snap.selectedId === unit.id}
                  onPick={() => api()?.activate(unit.id)}
                  onFocus={() => api()?.focusUnit(unit.id)}
                />
              ))}
            </div>
          </div>

          {/* Column 2: Active Unit Weapons & Tactical Orders */}
          <div className="dock-col dock-orders-col">
            <div className="dock-col-header">
              <span className="dock-section-title">
                {selectedUnit
                  ? `${selectedUnit.name} — ${selectedUnit.title}`
                  : "Rozkazy a výzbroj"}
              </span>
              {selectedUnit && selectedUnit.alive && !selectedUnit.embarked ? (
                <div className="selected-ap-group">
                  <span className="selected-ap-readout">
                    {apLabel(selectedUnit.ap)}
                  </span>
                  <span className="reach-hint">
                    {selectedUnit.ap >= 2
                      ? "Dosah: 1. akce 4 pole · 2. akce 8 polí"
                      : "Dosah: max 4 pole"}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="dock-objective">{snap.objective}</p>

            {playable ? (
              <div className="dock-actions">
                {snap.weaponButtons.length > 0 ? (
                  <div className="weapon-row">
                    {snap.weaponButtons.map((weapon, idx) => (
                      <button
                        key={weapon.id}
                        type="button"
                        className="btn weapon-btn"
                        data-on={weapon.active}
                        disabled={snap.busy || snap.turn !== "player"}
                        onClick={() => api()?.setWeapon(weapon.id)}
                      >
                        <span className="hotkey-hint">{idx + 1}</span>
                        <span>{weapon.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="ability-row">
                  {snap.reload.visible ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={!snap.reload.enabled}
                      onClick={() => api()?.reload()}
                    >
                      <span className="hotkey-hint">R</span>
                      <span>{snap.reload.label}</span>
                    </button>
                  ) : null}

                  {snap.prayer.visible ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={!snap.prayer.enabled}
                      onClick={() => api()?.prayer()}
                    >
                      <Heart className="size-4 shrink-0" />
                      <span>{snap.prayer.label}</span>
                    </button>
                  ) : null}

                  {snap.rozkaz.visible ? (
                    <button
                      type="button"
                      className="btn"
                      data-on={snap.mode === "rozkaz"}
                      disabled={!snap.rozkaz.enabled}
                      onClick={() => api()?.startRozkaz()}
                    >
                      <Flag className="size-4 shrink-0" />
                      <span>{snap.rozkaz.label}</span>
                    </button>
                  ) : null}

                  {snap.hradba.visible ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={!snap.hradba.enabled}
                      onClick={() => api()?.hradba()}
                    >
                      <Shield className="size-4 shrink-0" />
                      <span>{snap.hradba.label}</span>
                    </button>
                  ) : null}

                  {snap.sail.visible ? (
                    <button
                      type="button"
                      className="btn btn-blood"
                      disabled={!snap.sail.enabled}
                      onClick={() => api()?.sail()}
                    >
                      <Ship className="size-4 shrink-0" />
                      <span>{snap.sail.label}</span>
                    </button>
                  ) : null}

                  {snap.endTurn.visible ? (
                    <button
                      type="button"
                      className="btn btn-gold"
                      disabled={!snap.endTurn.enabled}
                      onClick={() => api()?.endTurn()}
                    >
                      <span>{snap.endTurn.label}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="dock-hint">
                Vyberte muže na 3D mapě nebo v seznamu. Zlatá pole značí pohyb, rudé terče útok.
              </p>
            )}
          </div>

          {/* Column 3: Tactical Combat Log */}
          <div className="dock-col dock-log-col">
            <div className="dock-col-header">
              <span className="dock-section-title">Kronika boje</span>
              <span className="cam-hint">Myš: otáčení / zoom · WASD: posun</span>
            </div>
            <div ref={logRef} className="log" aria-live="polite">
              {snap.log.length === 0 ? (
                <p>Rozkaz ještě nepadl.</p>
              ) : (
                snap.log.map((line, i) => <p key={`${i}-${line}`}>{line}</p>)
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tactical Rules Modal ("Jak se velí") */}
      {helpOpen ? (
        <div className="overlay" onClick={() => setHelpOpen(false)}>
          <article className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header-row">
              <div>
                <p className="kicker">Taktická příručka · 3D XCOM Režim</p>
                <h2>Jak se velí v Malé Straně</h2>
              </div>
              <button
                type="button"
                className="sheet-close-btn"
                onClick={() => setHelpOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="sheet-body">
              <ul>
                <li>
                  <strong>3D Kamera a atmosféra:</strong> Tažením myší (nebo klávesami <strong>Q / E</strong>) otáčíte bojištěm, kolečkem přibližujete a klávesami <strong>WASD / šipkami</strong> posouváte pohled. Klávesa <strong>L</strong> přepíná noční atmosféru a osvětlení (Šerosvit, Bouře, Obléhání, Mlha). Klávesa <strong>H</strong> skryje spodní panel.
                </li>
                <li>
                  <strong>Pohyb a 1. vs. 2. akce:</strong> Modrá pole (1 až 4 pole) značí <strong>1. akci (1 AP)</strong> — po přesunu můžete ještě vystřelit, nabít či zaútočit. Zlatá pole (5 až 8 polí) značí <strong>2. akci / chvat (2 AP)</strong> — spotřebuje celý zbývající tah hrdiny! Zlaté 3D štíty u hran polí ukazují poloviční kryt (−25 %: vůz, suť, kouř) a plný kryt (−50 %: kamenná zeď).
                </li>
                <li>
                  <strong>Palba a dým:</strong> Klepněte na Švéda v dostřelu. 3D oblouk ukáže dráhu střely a šanci zásahu. Po výstřelu z palné zbraně musíte nabít (klávesa <strong>R</strong>). Kouř na vašem poli kryje jako vůz.
                </li>
                <li>
                  <strong>Zbroj a průraz:</strong> Kabátec ubere 1 život zbraním s malým průrazem, půlzbroj 2. Mušketa plát prorazí. Granát a petarda zbroj strhnou.
                </li>
                <li>
                  <strong>Granát a Petarda:</strong> Vyberte granát a klepněte na pole v dostřelu — výbuch zasáhne 3×3 okolí. Petardu položte na sousední kamennou zeď: 3D zeď se zřítí v suť a zprůchodní ulici.
                </li>
                <li>
                  <strong>Rozkaz, Modlitba a Hradba:</strong> Rozkaz maršála Colloreda přidá spojenci 1 AP. Modlitba jednou za noc vrátí 3 životy a přidá +25 % k příštímu úderu. Jakubova Hradba zastaví a bodne prvního Švéda, který vstoupí na dvě pole.
                </li>
              </ul>
            </div>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => setHelpOpen(false)}
            >
              Zpět do boje
            </button>
          </article>
        </div>
      ) : null}

      {/* Mission Briefing Overlay */}
      {snap.phase === "briefing" ? (
        <div className="overlay">
          <article className="sheet">
            <div className="sheet-body">
              <p className="kicker">26. července 1648 · 3D Taktická Edice</p>
              <h2>Noc na Malé Straně</h2>
              <p>
                Švédský generál Königsmark přepadl Prahu. Maršál Rudolf Colloredo je odříznut mezi palácem a Vltavou.
                Loďka u nábřeží uveze jen jeho a jednoho muže. Druzí dva zůstanou na břehu a tři nárazy drží posily.
              </p>
              <ul>
                <li>Colloredo nemá zbraň. Rozkaz dá spojenci další akční bod. Padne-li, noc končí.</li>
                <li>V prvním tahu ho schovejte za 3D zeď u paláce. Zlaté štíty u zdi značí plný kryt.</li>
                <li>Martin nese kolečkovou pistoli, karabinu, rapír a jeden granát. Klávesy 1–4 přepínají zbraně.</li>
                <li>Václav má doutnákovou mušketu. Nabití stojí celý tah a ve vlhku od řeky občas selže. Prorazí půlzbroj.</li>
                <li>Jakub drží halapartnu a petardu. Hradba zastaví prvního Švéda. Petarda zboří 3D kamennou zeď v suť.</li>
              </ul>
            </div>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => {
                api()?.unlock();
                api()?.begin();
              }}
            >
              Vstoupit do ulic
            </button>
          </article>
        </div>
      ) : null}

      {/* Epilogue Overlay */}
      {snap.epilogue ? (
        <div className="overlay">
          <article className="sheet" data-outcome={snap.epilogue.outcome}>
            <div className="sheet-body">
              <p className="kicker">{snap.epilogue.kicker}</p>
              <h2>{snap.epilogue.title}</h2>
              {snap.epilogue.paragraphs.map((paragraph, i) => (
                <p key={`${i}-${paragraph}`}>{paragraph}</p>
              ))}
              {snap.epilogue.martyrs.length > 0 ? (
                <div className="martyrs">
                  {snap.epilogue.martyrs.map((martyr) => (
                    <div key={martyr.name}>
                      <h3>{martyr.name}</h3>
                      <p>{martyr.line}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-blood"
              onClick={() => api()?.restart()}
            >
              Nová noc
            </button>
          </article>
        </div>
      ) : null}
    </main>
  );
}

function apLabel(n: number): string {
  const m = Math.abs(n) % 100;
  if (m === 1) return `${n} akční bod`;
  if (m >= 2 && m <= 4) return `${n} akční body`;
  return `${n} akčních bodů`;
}

function UnitCard({
  unit,
  selected,
  onPick,
  onFocus,
}: {
  unit: HudUnit;
  selected: boolean;
  onPick: () => void;
  onFocus: () => void;
}) {
  const pips = Math.max(unit.maxAp, unit.ap);
  const width = `${Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))}%`;
  const inactive = !unit.alive || unit.embarked;

  return (
    <button
      type="button"
      className="card"
      data-on={selected}
      data-dead={inactive}
      disabled={inactive}
      onClick={onPick}
      onDoubleClick={onFocus}
    >
      <span
        className="seal"
        data-side={unit.faction === "swedish" ? "swedish" : "imperial"}
      >
        {unit.faction === "swedish"
          ? unit.archetype === "musketeer"
            ? "M"
            : unit.archetype === "pikeman"
              ? "P"
              : "Š"
          : unit.name.slice(0, 1)}
      </span>
      <span className="card-body">
        <span className="card-title-row">
          <strong>{unit.name}</strong>
          <span className="card-hp-num">
            {unit.hp}/{unit.maxHp}
          </span>
        </span>
        <small>
          {unit.status || unit.title}
        </small>
        <span className="hp" data-side={unit.faction}>
          <span style={{ width }} />
        </span>
        {unit.alive && !unit.embarked ? (
          <span className="pips" aria-label={apLabel(unit.ap)}>
            {Array.from({ length: pips }, (_, i) => (
              <i key={i} data-on={i < unit.ap} />
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}
