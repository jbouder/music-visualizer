import { AudioEngine } from '../audio/AudioEngine';
import { DemoSource } from '../audio/sources/demo';
import { FileSource, trackName, type QueueItem } from '../audio/sources/file';
import { MicSource } from '../audio/sources/mic';
import { TabSource } from '../audio/sources/tab';
import { SourceError, type AudioSource, type SourceKind } from '../audio/sources/types';
import type { AudioFrame } from '../audio/types';
import { Engine, hasWebGL2 } from '../render/Engine';
import type { Renderer } from '../render/Renderer';
import { DEFAULT_SCENE, SCENES, getScene, type SceneEntry } from '../render/registry';
import { RetroLook } from '../render/retroLook';
import {
  getState,
  isFavorite,
  setState,
  showMessage,
  toggleFavorite,
  useStore,
  type SceneRef,
} from '../state/store';
import { formatHash, parseHash } from './deeplink';

const PRESET_BLEND = 2.5;
const PRESET_BLEND_REDUCED = 4;
const PRESET_HISTORY = 50;
const INFO_MESSAGE_MS = 4000;

/**
 * Wires the store, the audio engine and the render engine together. Plain
 * TypeScript: React components call these functions and read the store.
 */
class Controller {
  readonly audio = new AudioEngine();
  private engine: Engine | null = null;
  private host: HTMLElement | null = null;
  private fileEl: HTMLAudioElement | null = null;
  private fileNode: MediaElementAudioSourceNode | null = null;
  private presetHistory: string[] = [];
  /** Seconds of eligible playback since the last scene change. */
  private cycleElapsed = 0;
  private messageTimer = 0;
  private sceneLoad: Promise<void> = Promise.resolve();
  private sourceStart = 0;
  readonly tabSupported = TabSource.supported;
  readonly micSupported = MicSource.supported;

  init(): void {
    const webgl2 = hasWebGL2();
    const fromHash = parseHash(location.hash);
    setState((s) => {
      const next: Partial<typeof s> = { webgl2 };
      let scene = s.scene;
      if (fromHash && getScene(fromHash.rendererId)) {
        scene = fromHash.presetId ? { rendererId: fromHash.rendererId, presetId: fromHash.presetId } : { rendererId: fromHash.rendererId };
        if (fromHash.retro !== undefined) next.retroLook = fromHash.retro;
      }
      // Drop scenes that no longer exist (renamed in an update) or need WebGL 2 we don't have.
      const entry = getScene(scene?.rendererId);
      if (!entry || (!webgl2 && entry.family === 'gpu' && !entry.retro)) scene = { rendererId: DEFAULT_SCENE[webgl2 ? 'gpu' : 'retro'] };
      next.scene = scene;
      if (!webgl2) next.retroLook = true;
      return next;
    });
    if (!webgl2) showMessage('WebGL 2 is not available, so scenes play in the Retro look and MilkDrop presets are off.', 'error');
    this.updateSceneLabel();

    useStore.subscribe((s, prev) => {
      const rc = this.engine?.rc;
      if (rc) {
        rc.palette = s.palette;
        rc.reduceFlashing = s.reduceFlashing;
        rc.options = s.rendererOptions;
      }
      if (s.volume !== prev.volume) this.audio.setVolume(s.volume);
      if (s.quality !== prev.quality) this.applyQuality();
      if (s.message !== prev.message) {
        window.clearTimeout(this.messageTimer);
        if (s.message?.tone === 'info') {
          this.messageTimer = window.setTimeout(() => setState({ message: null }), INFO_MESSAGE_MS);
        }
      }
    });
    this.audio.setVolume(getState().volume);

    window.setInterval(() => this.autoCycleTick(), 500);
    window.addEventListener('hashchange', (e) => {
      // Read the event's URL: a scene finishing its load may already have
      // replaced location.hash before this event is dispatched.
      const ref = parseHash(new URL(e.newURL).hash);
      if (!ref || !getScene(ref.rendererId)) return;
      if (ref.retro !== undefined && ref.retro !== getState().retroLook) this.setRetroLook(ref.retro);
      void this.selectScene(ref.rendererId, ref.presetId);
    });
    // Some browsers keep the context suspended after a drop; any later tap resumes it.
    window.addEventListener('pointerdown', () => {
      const ctx = this.audio.ctx;
      if (ctx && ctx.state === 'suspended' && !getState().paused && getState().source) void ctx.resume();
    });
  }

  attachHost(el: HTMLElement | null): void {
    this.host = el;
  }

  // ── Sources ────────────────────────────────────────────────

  /** Must be called directly from a click/tap handler. */
  playDemo(): void {
    const ctx = this.audio.unlock();
    this.start(new DemoSource(ctx, this.audio.master!, this.audio.vizBus!));
  }

  /** Chiptune remix of the demo plus the intro scene. */
  launchIntro(): void {
    const ctx = this.audio.unlock();
    this.start(new DemoSource(ctx, this.audio.master!, this.audio.vizBus!, true));
    setState({ deckHidden: true });
    void this.selectScene('intro');
  }

  startMic(): void {
    const ctx = this.audio.unlock();
    this.start(new MicSource(ctx, this.audio.vizBus!));
  }

  startTab(): void {
    const ctx = this.audio.unlock();
    this.start(new TabSource(ctx, this.audio.vizBus!, () => this.onSourceEnded('Tab sharing ended.')));
  }

  /** Unlocks audio inside the gesture, then opens the picker (iOS needs this order). */
  openFilePicker(input: HTMLInputElement): void {
    this.audio.unlock();
    input.value = '';
    input.click();
  }

  playFiles(files: FileList | File[]): void {
    const list = Array.from(files).filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(f.name));
    if (!list.length) {
      showMessage('Those files are not audio. Choose an MP3, M4A, OGG or WAV file.', 'error');
      return;
    }
    const ctx = this.audio.unlock();
    if (!this.fileEl) {
      this.fileEl = new Audio();
      this.fileEl.preload = 'auto';
      this.fileNode = ctx.createMediaElementSource(this.fileEl);
    }
    const queue: QueueItem[] = list.map((file) => ({ file, name: trackName(file) }));
    const src = new FileSource(this.fileEl, this.fileNode!, this.audio.master!, this.audio.vizBus!, queue, (s) => {
      if (this.audio.currentSource === s) setState({ sourceLabel: s.label });
    });
    setState({ fileQueueLength: queue.length });
    this.start(src);
  }

  async nextTrack(): Promise<void> {
    const s = this.audio.currentSource;
    if (s instanceof FileSource) await s.next().catch((e) => this.fail(e));
  }

  async previousTrack(): Promise<void> {
    const s = this.audio.currentSource;
    if (s instanceof FileSource) await s.previous().catch((e) => this.fail(e));
  }

  /** Play: resume when paused, otherwise start the demo if nothing is playing. */
  play(): void {
    const s = getState();
    if (s.source && s.paused) void this.togglePause();
    else if (!s.source) this.playDemo();
  }

  /** Elapsed seconds and, for files, the track duration. */
  playback(): { elapsed: number; duration: number | null } {
    const src = this.audio.currentSource;
    if (src instanceof FileSource) return { elapsed: src.currentTime, duration: src.duration };
    if (!src || !this.audio.ctx) return { elapsed: 0, duration: null };
    return { elapsed: Math.max(0, this.audio.ctx.currentTime - this.sourceStart), duration: null };
  }

  seek(seconds: number): void {
    const src = this.audio.currentSource;
    if (src instanceof FileSource) src.seek(seconds);
  }

  /** The most recent AudioFrame, for the deck's mini analyzer. */
  get frame(): AudioFrame | null {
    return this.engine?.lastFrame ?? null;
  }

  get sampleRate(): number {
    return this.audio.ctx?.sampleRate ?? 48000;
  }

  stop(): void {
    this.audio.stopSource();
    setState({ source: null, sourceLabel: '', paused: false, fileQueueLength: 0, message: null });
  }

  async togglePause(): Promise<void> {
    if (!getState().source) return;
    const paused = !getState().paused;
    await this.audio.setPaused(paused);
    setState({ paused });
  }

  private start(source: AudioSource): void {
    this.ensureEngine();
    setState({ message: null, sourceLabel: 'Starting…', paused: false });
    // play() calls source.start() synchronously, keeping the user activation
    // that getDisplayMedia needs.
    this.audio
      .play(source)
      .then(() => {
        if (this.audio.currentSource !== source) return;
        this.sourceStart = this.audio.ctx?.currentTime ?? 0;
        setState({ source: source.kind as SourceKind, sourceLabel: source.label });
      })
      .catch((err) => {
        if (this.audio.currentSource === null) setState({ source: null, sourceLabel: '' });
        this.fail(err);
      });
  }

  private onSourceEnded(text: string): void {
    this.stop();
    showMessage(text);
  }

  private fail(err: unknown): void {
    console.error(err);
    const text = err instanceof SourceError ? err.message : 'Something went wrong starting audio. Try again.';
    showMessage(text, 'error');
  }

  // ── Engine and scenes ──────────────────────────────────────

  private ensureEngine(): void {
    if (this.engine || !this.host) return;
    const s = getState();
    this.engine = new Engine(
      this.host,
      this.audio,
      {
        quality: s.quality === 'auto' ? s.autoScale : s.quality,
        reduceFlashing: s.reduceFlashing,
        retroLook: s.retroLook,
        palette: s.palette,
        options: s.rendererOptions,
      },
      {
        onSceneChange: (r) => this.onSceneChange(r),
        onQualityStep: (scale) => {
          setState({ autoScale: scale });
          showMessage(`Quality lowered to ${Math.round(scale * 100)}% to keep motion smooth.`);
        },
        onError: (text) => showMessage(text, 'error'),
      },
    );
    this.applyQuality();
    this.engine.start();
    void this.selectScene(s.scene.rendererId, s.scene.presetId);
  }

  private applyQuality(): void {
    const s = getState();
    this.engine?.setQuality(s.quality === 'auto' ? 'auto' : s.quality, s.autoScale);
  }

  get renderer(): Renderer | null {
    return this.engine?.renderer ?? null;
  }

  get transitioning(): boolean {
    return this.engine?.transitioning ?? false;
  }

  /** Loads a scene (or switches preset within the active one). Before audio starts, only records the choice. */
  selectScene(rendererId: string, presetId?: string, blend = PRESET_BLEND, reload = false): Promise<void> {
    const entry = getScene(rendererId);
    if (!entry) return Promise.resolve();
    if (entry.family === 'gpu' && !entry.retro && !getState().webgl2) {
      showMessage('GPU scenes need WebGL 2, which this browser does not have.', 'error');
      return Promise.resolve();
    }
    this.cycleElapsed = 0;

    const active = this.renderer;
    if (!reload && active && active.id === rendererId && presetId && active.setPreset) {
      if (active.currentPreset && active.currentPreset !== presetId) this.pushHistory(active.currentPreset);
      active.setPreset(presetId, blend);
      this.onSceneChange(active);
      return Promise.resolve();
    }

    this.rememberScene({ rendererId, presetId });
    if (!this.engine) {
      this.updateSceneLabel();
      return Promise.resolve();
    }
    setState({ sceneLabel: `Loading ${entry.name}…` });
    const engine = this.engine;
    this.sceneLoad = engine
      .setScene(rendererId, presetId)
      .then(() => undefined)
      .catch((err) => {
        console.error(err);
        showMessage(`${entry.name} could not start on this device. Pick another scene.`, 'error');
        if (engine.renderer) this.onSceneChange(engine.renderer);
      });
    return this.sceneLoad;
  }

  next(auto = false): void {
    const s = getState();
    if (auto && s.favoritesOnly) {
      const favs = s.favorites.filter((f) => this.available().some((e) => e.id === f.rendererId));
      if (favs.length) {
        const cur = this.currentRef();
        const i = favs.findIndex((f) => cur && f.rendererId === cur.rendererId && (f.presetId ?? '') === (cur.presetId ?? ''));
        const pick = favs[(i + 1) % favs.length];
        void this.selectScene(pick.rendererId, pick.presetId, this.blendTime(auto));
        return;
      }
    }
    const r = this.renderer;
    if (r && r.presets?.length && r.setPreset) {
      const base = (r instanceof RetroLook ? r.inner : r) as Renderer & { randomPresetId?(x?: string): string | undefined };
      const pick = base.randomPresetId?.(r.currentPreset);
      if (pick) {
        void this.selectScene(r.id, pick, this.blendTime(auto));
        return;
      }
    }
    this.stepScene(1);
  }

  previous(): void {
    const r = this.renderer;
    if (r && r.setPreset && this.presetHistory.length) {
      const id = this.presetHistory.pop()!;
      r.setPreset(id, PRESET_BLEND);
      this.onSceneChange(r);
      this.cycleElapsed = 0;
      return;
    }
    this.stepScene(-1);
  }

  randomScene(): void {
    const list = this.available();
    const cur = getState().scene.rendererId;
    const options = list.filter((e) => e.id !== cur);
    const pick = options[Math.floor(Math.random() * options.length)] ?? list[0];
    void this.selectScene(pick.id);
  }

  /** Toggles the Retro look; the current scene stays and re-renders in the other look. */
  toggleRetro(): void {
    if (!getState().webgl2) {
      showMessage('The Retro look is locked on because WebGL 2 is not available.', 'error');
      return;
    }
    this.setRetroLook(!getState().retroLook);
  }

  private setRetroLook(on: boolean): void {
    setState({ retroLook: on });
    if (this.engine) this.engine.rc.retroLook = on;
    const s = getState();
    history.replaceState(null, '', formatHash(s.scene, on));
    // GPU scenes swap between direct and wrapped rendering; canvas scenes switch look in place.
    if (this.engine && getScene(s.scene.rendererId)?.family === 'gpu') {
      void this.selectScene(s.scene.rendererId, this.renderer?.currentPreset ?? s.scene.presetId, 0, true);
    }
  }

  toggleFavorite(): void {
    const ref = this.currentRef();
    if (!ref) return;
    const was = isFavorite(getState().favorites, ref);
    setState((s) => ({ favorites: toggleFavorite(s.favorites, ref) }));
    showMessage(was ? 'Removed from favorites.' : 'Added to favorites.');
  }

  currentRef(): SceneRef | null {
    return getState().scene ?? null;
  }

  /** Every scene this browser can run. Without WebGL 2: canvas scenes and GPU scenes with a classic counterpart. */
  available(): SceneEntry[] {
    const all = SCENES.filter((e) => !e.hidden);
    return getState().webgl2 ? all : all.filter((e) => e.family === 'retro' || e.retro);
  }

  private stepScene(dir: 1 | -1): void {
    const list = this.available();
    const i = list.findIndex((e) => e.id === getState().scene.rendererId);
    const pick = list[(i + dir + list.length) % list.length];
    void this.selectScene(pick.id);
  }

  private blendTime(auto: boolean): number {
    return auto && getState().reduceFlashing ? PRESET_BLEND_REDUCED : PRESET_BLEND;
  }

  private pushHistory(id: string): void {
    this.presetHistory.push(id);
    if (this.presetHistory.length > PRESET_HISTORY) this.presetHistory.shift();
  }

  private rememberScene(ref: SceneRef): void {
    setState({ scene: ref });
    history.replaceState(null, '', formatHash(ref, getState().retroLook));
  }

  private onSceneChange(r: Renderer): void {
    const ref: SceneRef = r.currentPreset ? { rendererId: r.id, presetId: r.currentPreset } : { rendererId: r.id };
    this.rememberScene(ref);
    setState({ presets: r.presets ?? [] });
    this.updateSceneLabel();
  }

  private updateSceneLabel(): void {
    const ref = getState().scene;
    const entry = getScene(ref.rendererId);
    const name = entry?.name ?? ref.rendererId;
    setState({ sceneLabel: ref.presetId ? `${name} · ${ref.presetId}` : name });
  }

  private autoCycleTick(): void {
    const s = getState();
    if (!s.autoCycle || !s.source || s.paused || s.searchFocused || s.panel === 'picker') return;
    if (!this.engine || this.engine.transitioning || document.hidden) return;
    this.cycleElapsed += 0.5;
    if (this.cycleElapsed >= s.cycleInterval) this.next(true);
  }
}

export const controller = new Controller();
