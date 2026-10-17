import { SourceError, describeMediaError, type AudioSource } from './types';

/**
 * Audio from another browser tab via getDisplayMedia. Routed to vizBus only:
 * the captured tab keeps playing through the speakers on its own.
 */
export class TabSource implements AudioSource {
  readonly kind = 'tab';
  label = 'Tab audio';
  private stream: MediaStream | null = null;
  private node: MediaStreamAudioSourceNode | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly vizBus: GainNode,
    private readonly onEnded: () => void,
  ) {}

  /** Desktop browsers with getDisplayMedia; hidden on touch-first devices. */
  static get supported(): boolean {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return false;
    return !window.matchMedia('(pointer: coarse)').matches;
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (err) {
      throw describeMediaError(err, 'Tab capture');
    }
    const audio = this.stream.getAudioTracks()[0];
    if (!audio) {
      this.stop();
      throw new SourceError('No audio was shared. Choose a tab and turn on Share tab audio.');
    }
    const title = this.stream.getVideoTracks()[0]?.label;
    if (title && !/^(screen|window|web-contents-media-stream)/i.test(title)) this.label = `Tab audio · ${title}`;
    audio.addEventListener('ended', this.onEnded);
    this.node = this.ctx.createMediaStreamSource(new MediaStream([audio]));
    this.node.connect(this.vizBus);
  }

  stop(): void {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => {
      t.removeEventListener('ended', this.onEnded);
      t.stop();
    });
    this.node = null;
    this.stream = null;
  }
}
