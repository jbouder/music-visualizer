import { FrameAnalyzer } from './analyzer';
import { FFT_SIZE, createSilentFrame, type AudioFrame } from './types';
import type { AudioSource } from './sources/types';

/**
 * Owns the single AudioContext and the routing every source shares:
 *
 *   source ─┬─► master ─► speakers   (demo and file only)
 *           └─► vizBus ─► analyser   (every source; Butterchurn taps vizBus too)
 */
export class AudioEngine {
  private _ctx: AudioContext | null = null;
  private _master: GainNode | null = null;
  private _vizBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyzer: FrameAnalyzer | null = null;
  private source: AudioSource | null = null;
  private volume = 0.9;
  private readonly idleFrame = createSilentFrame();

  get ctx(): AudioContext | null {
    return this._ctx;
  }
  get vizBus(): GainNode | null {
    return this._vizBus;
  }
  get master(): GainNode | null {
    return this._master;
  }
  get currentSource(): AudioSource | null {
    return this.source;
  }

  /**
   * Creates (once) and resumes the AudioContext. Call this synchronously inside
   * a user gesture: iOS Safari only unlocks audio there, and it must run before
   * any file picker opens.
   */
  unlock(): AudioContext {
    if (!this._ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(ctx.destination);
      const vizBus = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      vizBus.connect(analyser);
      this._ctx = ctx;
      this._master = master;
      this._vizBus = vizBus;
      this.analyser = analyser;
      this.analyzer = new FrameAnalyzer(ctx.sampleRate);
    }
    if (this._ctx.state !== 'running') void this._ctx.resume();
    return this._ctx;
  }

  /** Stops the current source and starts the next one. */
  async play(source: AudioSource): Promise<void> {
    this.stopSource();
    this.source = source;
    try {
      await source.start();
    } catch (err) {
      if (this.source === source) this.source = null;
      source.stop();
      throw err;
    }
  }

  stopSource(): void {
    const s = this.source;
    this.source = null;
    s?.stop();
    this.analyzer?.reset();
  }

  get paused(): boolean {
    return this._ctx?.state === 'suspended';
  }

  async setPaused(paused: boolean): Promise<void> {
    if (!this._ctx) return;
    if (paused) {
      this.source?.pause?.();
      await this._ctx.suspend();
    } else {
      await this._ctx.resume();
      this.source?.resume?.();
    }
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this._master && this._ctx) {
      this._master.gain.setTargetAtTime(this.volume, this._ctx.currentTime, 0.02);
    }
  }

  /** One AudioFrame per animation frame. Returns silence before audio starts. */
  readFrame(): AudioFrame {
    if (!this._ctx || !this.analyser || !this.analyzer) return this.idleFrame;
    const frame = this.analyzer.frame;
    this.analyser.getByteFrequencyData(frame.freq as Uint8Array<ArrayBuffer>);
    this.analyser.getByteTimeDomainData(frame.wave as Uint8Array<ArrayBuffer>);
    return this.analyzer.update(this._ctx.currentTime);
  }
}
