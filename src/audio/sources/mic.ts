import { describeMediaError, type AudioSource } from './types';

/** Microphone input. Routed to vizBus only, never to the speakers, so it cannot feed back. */
export class MicSource implements AudioSource {
  readonly kind = 'mic';
  readonly label = 'Microphone · live input';
  private stream: MediaStream | null = null;
  private node: MediaStreamAudioSourceNode | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly vizBus: GainNode,
  ) {}

  static get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      throw describeMediaError(err, 'Microphone');
    }
    this.node = this.ctx.createMediaStreamSource(this.stream);
    this.node.connect(this.vizBus);
  }

  stop(): void {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node = null;
    this.stream = null;
  }
}
