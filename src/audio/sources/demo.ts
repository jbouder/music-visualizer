import type { AudioSource } from './types';

const BPM = 122;
const STEP = 60 / BPM / 4; // sixteenth notes
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

// A minor: Am - F - C - G, one bar each.
const PROGRESSION = [
  { root: 45, tones: [57, 60, 64] },
  { root: 41, tones: [53, 57, 60] },
  { root: 48, tones: [55, 60, 64] },
  { root: 43, tones: [55, 59, 62] },
];
const ARP_PATTERNS = [
  [0, 1, 2, 1, 0, 2, 1, 2],
  [0, 2, 1, 2, 0, 1, 2, 3],
  [2, 1, 0, 1, 2, 3, 2, 1],
];
const BASS = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0];

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A generative synth loop built from oscillators and noise, so the app plays with no files. */
export class DemoSource implements AudioSource {
  readonly kind = 'demo';
  readonly label: string;

  private out: GainNode | null = null;
  private timer: number | null = null;
  private noise: AudioBuffer | null = null;
  private step = 0;
  private nextTime = 0;
  private arp = ARP_PATTERNS[0];

  constructor(
    private readonly ctx: AudioContext,
    private readonly master: GainNode,
    private readonly vizBus: GainNode,
    /** Chiptune remix: pulse and triangle voices, fast arpeggios, no pad. */
    private readonly chip = false,
  ) {
    this.label = chip ? 'Demo synth · chiptune remix' : 'Demo synth · generative loop';
  }

  async start(): Promise<void> {
    const out = this.ctx.createGain();
    out.gain.value = 0.7;
    out.connect(this.master);
    out.connect(this.vizBus);
    this.out = out;
    this.noise = this.makeNoise();
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const out = this.out;
    this.out = null;
    if (out) {
      const t = this.ctx.currentTime;
      out.gain.setTargetAtTime(0, t, 0.03);
      window.setTimeout(() => out.disconnect(), 250);
    }
  }

  private makeNoise(): AudioBuffer {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private schedule(): void {
    // A suspended context does not advance, so the scheduler pauses with it.
    while (this.out && this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += STEP;
    }
  }

  private playStep(step: number, t: number): void {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const section = Math.floor(bar / 8) % 4; // 0 intro, 1 full, 2 breakdown, 3 full

    if (s16 === 0 && bar % 4 === 0) {
      this.arp = ARP_PATTERNS[Math.floor(Math.random() * ARP_PATTERNS.length)];
    }
    if (s16 === 0 && !this.chip) this.pad(chord.tones, t, STEP * 16);

    const drums = section !== 2;
    if (drums && s16 % 4 === 0) this.kick(t);
    if (section === 2 && s16 === 0) this.kick(t);
    if (drums && (s16 === 4 || s16 === 12)) this.snare(t);
    if (section !== 0 && s16 % 2 === 0) this.hat(t, s16 % 4 === 2 ? 0.16 : 0.07);
    if (section === 3 && s16 % 2 === 1 && Math.random() < 0.3) this.hat(t, 0.05);

    if (section !== 2 && BASS[s16]) this.bass(chord.root, t, bar);
    if (this.chip) {
      // Fast arpeggio over two octaves, every sixteenth.
      const tones = [...chord.tones, chord.tones[0] + 12, chord.tones[1] + 12];
      this.pluck(tones[(s16 + bar) % tones.length] + 12, t);
      return;
    }
    if (section !== 0 && s16 % 2 === 0) {
      const tone = this.arp[(s16 / 2) % this.arp.length];
      const note = tone === 3 ? chord.tones[0] + 12 : chord.tones[tone] + 12;
      this.pluck(note, t);
    }
  }

  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.out!);
    return g;
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(this.env(t, 1, 0.003, 0.32));
    o.start(t);
    o.stop(t + 0.4);
  }

  private snare(t: number): void {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    n.connect(hp).connect(this.env(t, 0.35, 0.002, 0.16));
    n.start(t, Math.random() * 0.5, 0.2);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    o.connect(this.env(t, 0.25, 0.002, 0.09));
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, level: number): void {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    n.connect(hp).connect(this.env(t, level, 0.001, 0.045));
    n.start(t, Math.random() * 0.5, 0.06);
  }

  private bass(root: number, t: number, bar: number): void {
    const o = this.ctx.createOscillator();
    if (this.chip) {
      o.type = 'triangle';
      o.frequency.value = mtof(root - 12);
      o.connect(this.env(t, 0.5, 0.002, STEP * 1.4));
      o.start(t);
      o.stop(t + STEP * 2);
      return;
    }
    o.type = 'sawtooth';
    o.frequency.value = mtof(root - 12);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 8;
    const sweep = 500 + 900 * (0.5 + 0.5 * Math.sin(bar * 0.7));
    lp.frequency.setValueAtTime(sweep * 2, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + STEP * 1.6);
    o.connect(lp).connect(this.env(t, 0.32, 0.004, STEP * 1.6));
    o.start(t);
    o.stop(t + STEP * 2);
  }

  private pluck(note: number, t: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = mtof(note);
    if (this.chip) {
      o.connect(this.env(t, 0.05, 0.002, STEP * 0.9));
      o.start(t);
      o.stop(t + STEP);
      return;
    }
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.15);
    o.connect(lp).connect(this.env(t, 0.07, 0.003, 0.2));
    o.start(t);
    o.stop(t + 0.25);
  }

  private pad(tones: number[], t: number, len: number): void {
    for (const note of tones) {
      for (const detune of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(note);
        o.detune.value = detune;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.022, t + 0.4);
        g.gain.setValueAtTime(0.022, t + len - 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + len);
        o.connect(lp).connect(g).connect(this.out!);
        o.start(t);
        o.stop(t + len + 0.05);
      }
    }
  }
}
