/**
 * Zero-dependency Procedural Web Audio Engine (/src/utils/audioSystem.ts).
 * Synthesizes historically grounded, punchy, visceral sound effects:
 * - Matchlock & wheellock gunshots with black powder thunder
 * - Cannon / petard / powder keg sub-bass detonations
 * - Wet misfire sizzles and hammer clicks
 * - Heroic special ability fanfares (Cathedral bells, Maltese shrapnel barrage, Protector shield clank, Marshal fanfare)
 * - Critical hits, armor shred cracks, and cobblestone footsteps
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

let cachedNoiseBuffer: AudioBuffer | null = null;

/** Helper to get or create a shared reusable white noise buffer (prevents audio thread allocations & GC churn) */
function getSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const durationSec = 2.0; // 2 seconds of high quality white noise
  const bufferSize = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

/** Black powder gunshot (Wheellock pistol or Matchlock musket) */
export function playGunshotSound(isWheellock = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Transient sharp click / hammer fall
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = "triangle";
  clickOsc.frequency.setValueAtTime(isWheellock ? 1200 : 700, now);
  clickOsc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
  clickGain.gain.setValueAtTime(0.35, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);
  clickOsc.start(now);
  clickOsc.stop(now + 0.05);

  // 2. Black powder explosion noise body
  const noise = ctx.createBufferSource();
  noise.buffer = getSharedNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.42);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.65, now + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now + 0.005);
  noise.stop(now + 0.46);

  // 3. Sub-bass boom
  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = "sine";
  boom.frequency.setValueAtTime(150, now);
  boom.frequency.exponentialRampToValueAtTime(38, now + 0.35);
  boomGain.gain.setValueAtTime(0.5, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
  boom.connect(boomGain);
  boomGain.connect(ctx.destination);
  boom.start(now);
  boom.stop(now + 0.4);
}

/** Heavy explosion (Petard grenade or powder keg detonation) */
export function playExplosionSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Deep sub-bass blast
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(180, now);
  sub.frequency.exponentialRampToValueAtTime(26, now + 0.65);
  subGain.gain.setValueAtTime(0.85, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  sub.connect(subGain);
  subGain.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.72);

  // 2. Heavy distorted roar / debris noise
  const noise = ctx.createBufferSource();
  noise.buffer = getSharedNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(90, now + 0.8);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.75, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.86);
}

/** Misfire sizzle / damp powder click */
export function playMisfireSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Metallic click
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = "sine";
  click.frequency.setValueAtTime(900, now);
  click.frequency.exponentialRampToValueAtTime(300, now + 0.05);
  clickGain.gain.setValueAtTime(0.25, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.06);

  // Wet steam/powder fizz
  const noise = ctx.createBufferSource();
  noise.buffer = getSharedNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2200, now);
  filter.Q.value = 3.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now + 0.02);
  noise.stop(now + 0.32);
}

/** Hit impact thud / flesh splatter / metal armor shred */
export function playHitSound(isCrit = false, severity: 0 | 1 | 2 | 3 = 2) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Heavy body impact thud
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = "triangle";
  thud.frequency.setValueAtTime(isCrit || severity >= 3 ? 260 : 185, now);
  thud.frequency.exponentialRampToValueAtTime(42, now + 0.16);
  thudGain.gain.setValueAtTime(
    isCrit || severity >= 3 ? 0.65 : severity === 2 ? 0.48 : 0.35,
    now,
  );
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
  thud.connect(thudGain);
  thudGain.connect(ctx.destination);
  thud.start(now);
  thud.stop(now + 0.21);

  // 2. Wet visceral blood / flesh tear transient (when severity >= 1)
  if (severity >= 1) {
    const noise = ctx.createBufferSource();
    noise.buffer = getSharedNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(severity >= 3 ? 1150 : 1450, now);
    filter.Q.value = 2.2;
    const splatterGain = ctx.createGain();
    splatterGain.gain.setValueAtTime(0.18 + severity * 0.11, now);
    splatterGain.gain.exponentialRampToValueAtTime(
      0.001,
      now + 0.12 + severity * 0.04,
    );
    noise.connect(filter);
    filter.connect(splatterGain);
    splatterGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.28);
  }

  // 3. Metallic armor clank
  const clank = ctx.createOscillator();
  const clankGain = ctx.createGain();
  clank.type = "sine";
  clank.frequency.setValueAtTime(isCrit ? 1400 : 850, now);
  clank.frequency.exponentialRampToValueAtTime(400, now + 0.12);
  clankGain.gain.setValueAtTime(isCrit ? 0.45 : 0.22, now);
  clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  clank.connect(clankGain);
  clankGain.connect(ctx.destination);
  clank.start(now);
  clank.stop(now + 0.15);
}

/** Missed shot ricochet whine + stone masonry / timber crack */
export function playRicochetSound(isWood = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Stone / brick / wood crack noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = getSharedNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(isWood ? 950 : 2400, now);
  filter.Q.value = isWood ? 1.8 : 2.6;

  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.42, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  noise.connect(filter);
  filter.connect(crackGain);
  crackGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.18);

  // 2. Deflected lead ball ricochet whistle ("pew-zing")
  if (!isWood) {
    const whine = ctx.createOscillator();
    const whineGain = ctx.createGain();
    whine.type = "sine";
    whine.frequency.setValueAtTime(1950, now + 0.01);
    whine.frequency.exponentialRampToValueAtTime(580, now + 0.22);
    whineGain.gain.setValueAtTime(0.18, now + 0.01);
    whineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    whine.connect(whineGain);
    whineGain.connect(ctx.destination);
    whine.start(now + 0.01);
    whine.stop(now + 0.24);
  }
}

/**
 * Impressive heroic soundscapes for each character's special ability!
 */
export function playSpecialAbilitySound(
  abilityId: "protector_oath" | "klementinum_verdict" | "maltese_shrapnel" | "marshal_command",
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (abilityId === "protector_oath") {
    // Jan Matěj: Deep heroic shield clang + rising guard chord (D-F#-A)
    const notes = [146.83, 220.0, 293.66, 440.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.04 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.7);
    });

    // Heavy iron shield clank
    const clank = ctx.createOscillator();
    const clankGain = ctx.createGain();
    clank.type = "square";
    clank.frequency.setValueAtTime(620, now);
    clank.frequency.exponentialRampToValueAtTime(140, now + 0.25);
    clankGain.gain.setValueAtTime(0.35, now);
    clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    clank.connect(clankGain);
    clankGain.connect(ctx.destination);
    clank.start(now);
    clank.stop(now + 0.3);
    return;
  }

  if (abilityId === "klementinum_verdict") {
    // Václav z Michalovic: Sacred Clementinum bell resonance + sniper focus whoosh
    const bellFrequencies = [587.33, 880.0, 1174.66, 1760.0];
    bellFrequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.22 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    });

    // Rising high-precision deadeye chime
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = "triangle";
    sweep.frequency.setValueAtTime(350, now);
    sweep.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
    sweepGain.gain.setValueAtTime(0.25, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.start(now);
    sweep.stop(now + 0.38);
    return;
  }

  if (abilityId === "maltese_shrapnel") {
    // Bratr Bartoloměj: Sizzling fuse into double explosion boom + shrapnel ring
    const noise = ctx.createBufferSource();
    noise.buffer = getSharedNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2800, now);
    const fuseGain = ctx.createGain();
    fuseGain.gain.setValueAtTime(0.3, now);
    fuseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    noise.connect(filter);
    filter.connect(fuseGain);
    fuseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.16);

    // Blast delayed slightly by 80ms
    setTimeout(() => {
      playExplosionSound();
    }, 80);
    return;
  }

  if (abilityId === "marshal_command") {
    // Hrabě Colloredo: Imperial Austrian military fanfare (C4 - E4 - G4 - C5 brass blast)
    const fanfare = [
      { f: 261.63, t: 0.0, d: 0.14 },
      { f: 329.63, t: 0.12, d: 0.14 },
      { f: 392.0, t: 0.24, d: 0.16 },
      { f: 523.25, t: 0.38, d: 0.45 },
    ];
    fanfare.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(n.f, now + n.t);

      const fFilter = ctx.createBiquadFilter();
      fFilter.type = "lowpass";
      fFilter.frequency.setValueAtTime(950, now + n.t);
      fFilter.frequency.linearRampToValueAtTime(1900, now + n.t + 0.08);

      gain.gain.setValueAtTime(0, now + n.t);
      gain.gain.linearRampToValueAtTime(0.32, now + n.t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(fFilter);
      fFilter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.05);
    });
  }
}

/** Visceral melee attack sound (Blade slash/steel clash or heavy walnut pistol-butt thud) */
export function playMeleeSound(
  kind: "blade" | "butt" = "blade",
  isHit = true,
  isCrit = false,
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (kind === "butt") {
    // Heavy wooden pistol butt dull thud with metallic brass resonance
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(isCrit ? 160 : 120, now);
    thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
    thudGain.gain.setValueAtTime(0.55, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.22);

    if (isHit) {
      // Wood knock / brass plate click
      const woodOsc = ctx.createOscillator();
      const woodGain = ctx.createGain();
      woodOsc.type = "triangle";
      woodOsc.frequency.setValueAtTime(450, now);
      woodOsc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
      woodGain.gain.setValueAtTime(0.4, now);
      woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      woodOsc.connect(woodGain);
      woodGain.connect(ctx.destination);
      woodOsc.start(now);
      woodOsc.stop(now + 0.1);
    }
    return;
  }

  // Steel sword / rapier / dagger whoosh & sharp metal slash
  const whoosh = ctx.createBufferSource();
  whoosh.buffer = getSharedNoiseBuffer(ctx);
  const whooshFilter = ctx.createBiquadFilter();
  whooshFilter.type = "bandpass";
  whooshFilter.frequency.setValueAtTime(800, now);
  whooshFilter.frequency.exponentialRampToValueAtTime(2200, now + 0.12);
  whooshFilter.Q.value = 3.5;
  const whooshGain = ctx.createGain();
  whooshGain.gain.setValueAtTime(0.45, now);
  whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  whoosh.connect(whooshFilter);
  whooshFilter.connect(whooshGain);
  whooshGain.connect(ctx.destination);
  whoosh.start(now);
  whoosh.stop(now + 0.18);

  if (isHit) {
    // Sharp blade steel ring & flesh cut
    const clang = ctx.createOscillator();
    const clangGain = ctx.createGain();
    clang.type = "sine";
    clang.frequency.setValueAtTime(isCrit ? 1450 : 920, now + 0.04);
    clang.frequency.exponentialRampToValueAtTime(280, now + 0.25);
    clangGain.gain.setValueAtTime(0.5, now + 0.04);
    clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    clang.connect(clangGain);
    clangGain.connect(ctx.destination);
    clang.start(now + 0.04);
    clang.stop(now + 0.3);
  }
}

