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

/** Hit impact thud / metal armor shred */
export function playHitSound(isCrit = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Impact thud
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = "triangle";
  thud.frequency.setValueAtTime(isCrit ? 260 : 180, now);
  thud.frequency.exponentialRampToValueAtTime(45, now + 0.15);
  thudGain.gain.setValueAtTime(isCrit ? 0.6 : 0.4, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  thud.connect(thudGain);
  thudGain.connect(ctx.destination);
  thud.start(now);
  thud.stop(now + 0.2);

  // Metallic armor clank
  const clank = ctx.createOscillator();
  const clankGain = ctx.createGain();
  clank.type = "sine";
  clank.frequency.setValueAtTime(isCrit ? 1400 : 850, now);
  clank.frequency.exponentialRampToValueAtTime(400, now + 0.12);
  clankGain.gain.setValueAtTime(isCrit ? 0.45 : 0.2, now);
  clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  clank.connect(clankGain);
  clankGain.connect(ctx.destination);
  clank.start(now);
  clank.stop(now + 0.15);
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
