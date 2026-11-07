export type SoundName =
  | "shot"
  | "pistol"
  | "blade"
  | "reload"
  | "prayer"
  | "ui"
  | "death"
  | "sail"
  | "hurt"
  | "boom"
  | "thunder";

export type Mixer = {
  unlock: () => void;
  play: (name: SoundName) => void;
  setMuted: (muted: boolean) => void;
  close: () => void;
};

export function createMixer(): Mixer {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;

  function ensure(): AudioContext | null {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain();
      master.gain.value = muted ? 0.0001 : 0.9;
      sfx = ctx.createGain();
      sfx.gain.value = 0.8;
      sfx.connect(master);
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 0.65);
      noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function envGain(at: number, peak: number, dur: number): GainNode | null {
    if (!ctx || !sfx) return null;
    const g = ctx.createGain();
    g.connect(sfx);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    return g;
  }

  function tone(freq: number, dur: number, type: OscillatorType, peak: number, slide = 1): void {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = envGain(t, peak, dur);
    if (!g) return;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(32, freq * slide), t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  function burst(dur: number, peak: number, rate: number, freq: number): void {
    if (!ctx || !noise || !sfx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = rate;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(110, t + dur);
    const g = envGain(t, peak, dur);
    if (!g) return;
    src.connect(filter);
    filter.connect(g);
    src.start(t);
    src.stop(t + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  return {
    unlock() {
      try {
        ensure();
      } catch {
        ctx = null;
      }
    },
    setMuted(next: boolean) {
      muted = next;
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(next ? 0.0001 : 0.9, ctx.currentTime, 0.03);
    },
    close() {
      void ctx?.close();
      ctx = null;
      master = null;
      sfx = null;
      noise = null;
    },
    play(name: SoundName) {
      if (muted) return;
      try {
        if (!ensure()) return;
      } catch {
        return;
      }
      const wobble = 0.94 + Math.random() * 0.12;
      if (name === "shot") {
        burst(0.22, 0.55, wobble, 1400);
        tone(120, 0.18, "sine", 0.35, 0.4);
      } else if (name === "pistol") {
        burst(0.12, 0.4, wobble * 1.2, 1800);
        tone(180, 0.1, "sine", 0.22, 0.5);
      } else if (name === "blade") {
        burst(0.09, 0.22, 1.6, 2400);
        tone(640, 0.08, "triangle", 0.08, 1.4);
      } else if (name === "reload") {
        tone(180, 0.07, "square", 0.05, 0.8);
        tone(90, 0.12, "sine", 0.08, 1);
      } else if (name === "prayer") {
        tone(392, 0.35, "sine", 0.07, 1);
        tone(494, 0.4, "sine", 0.05, 1);
        tone(587, 0.45, "triangle", 0.04, 1);
      } else if (name === "ui") {
        tone(520, 0.05, "sine", 0.04, 1.2);
      } else if (name === "death") {
        tone(110, 0.35, "sine", 0.2, 0.45);
      } else if (name === "sail") {
        tone(262, 0.28, "triangle", 0.06, 1);
        tone(330, 0.36, "sine", 0.05, 1);
      } else if (name === "hurt") {
        tone(90, 0.12, "sine", 0.16, 0.7);
      } else if (name === "boom") {
        burst(0.36, 0.72, 0.65, 520);
        tone(68, 0.3, "sine", 0.42, 0.32);
      } else if (name === "thunder") {
        burst(0.62, 0.34, 0.38 * wobble, 280);
        tone(54, 0.55, "sine", 0.22, 0.52);
        tone(82, 0.42, "triangle", 0.1, 0.48);
      }
    },
  };
}

