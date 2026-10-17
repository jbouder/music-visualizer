import { SourceError, type AudioSource } from './types';

export interface QueueItem {
  file: File;
  name: string;
}

export function trackName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
}

/** Local files from the picker or drag-and-drop, played through one media element with a queue. */
export class FileSource implements AudioSource {
  readonly kind = 'file';
  private index = 0;
  private url: string | null = null;
  private onEndedBound = () => this.next();

  constructor(
    private readonly el: HTMLAudioElement,
    private readonly node: MediaElementAudioSourceNode,
    private readonly master: GainNode,
    private readonly vizBus: GainNode,
    private readonly queue: QueueItem[],
    private readonly onTrackChange: (src: FileSource) => void,
  ) {}

  get label(): string {
    const item = this.queue[this.index];
    if (!item) return 'No file';
    const pos = this.queue.length > 1 ? ` (${this.index + 1}/${this.queue.length})` : '';
    return item.name + pos;
  }

  get currentTime(): number {
    return this.el.currentTime;
  }
  get duration(): number | null {
    return Number.isFinite(this.el.duration) ? this.el.duration : null;
  }
  seek(seconds: number): void {
    if (this.duration !== null) this.el.currentTime = Math.min(this.duration, Math.max(0, seconds));
  }

  get hasNext(): boolean {
    return this.index < this.queue.length - 1;
  }
  get hasPrevious(): boolean {
    return this.index > 0;
  }

  async start(): Promise<void> {
    if (!this.queue.length) throw new SourceError('Choose an audio file to play.');
    this.node.connect(this.master);
    this.node.connect(this.vizBus);
    this.el.addEventListener('ended', this.onEndedBound);
    await this.load(0);
  }

  stop(): void {
    this.el.removeEventListener('ended', this.onEndedBound);
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    try {
      this.node.disconnect();
    } catch {
      /* already disconnected */
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  pause(): void {
    this.el.pause();
  }
  resume(): void {
    void this.el.play().catch(() => {});
  }

  async next(): Promise<void> {
    if (this.hasNext) await this.load(this.index + 1);
  }

  async previous(): Promise<void> {
    if (this.el.currentTime > 3 || !this.hasPrevious) {
      this.el.currentTime = 0;
      return;
    }
    await this.load(this.index - 1);
  }

  private async load(i: number): Promise<void> {
    this.index = i;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(this.queue[i].file);
    this.el.src = this.url;
    this.onTrackChange(this);
    try {
      await this.el.play();
    } catch {
      throw new SourceError(`This browser cannot play ${this.queue[i].file.name}. Try an MP3, M4A, OGG or WAV file.`);
    }
  }
}
