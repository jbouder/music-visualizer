export type SourceKind = 'demo' | 'file' | 'mic' | 'tab';

export interface AudioSource {
  readonly kind: SourceKind;
  /** Text for the LCD's first line(s). */
  readonly label: string;
  start(): Promise<void>;
  stop(): void;
  pause?(): void;
  resume?(): void;
}

/** An error whose message is safe to show in the LCD as-is. */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}

/** Plain-language messages for getUserMedia / getDisplayMedia failures. */
export function describeMediaError(err: unknown, what: 'Microphone' | 'Tab capture'): SourceError {
  if (err instanceof SourceError) return err;
  const name = err instanceof DOMException ? err.name : '';
  if (what === 'Microphone') {
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return new SourceError('Microphone permission was denied. Allow access and try again.');
      case 'NotFoundError':
      case 'OverconstrainedError':
        return new SourceError('No microphone was found. Connect one and try again.');
      case 'NotReadableError':
        return new SourceError('Another app is using the microphone. Close it and try again.');
    }
    return new SourceError('The microphone could not start. Try again.');
  }
  if (name === 'NotAllowedError') {
    return new SourceError('Tab capture was cancelled. Choose a tab and turn on Share tab audio.');
  }
  return new SourceError('Tab capture could not start. Try again in Chrome or Edge.');
}
