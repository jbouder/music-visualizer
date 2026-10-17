/** Whether the screensaver should start now. Pure, so the rules are easy to test. */
export function shouldStartScreensaver(opts: {
  delayMinutes: number;
  idleMs: number;
  active: boolean;
  audioReady: boolean;
  busy: boolean;
}): boolean {
  if (opts.delayMinutes <= 0 || opts.active || !opts.audioReady || opts.busy) return false;
  return opts.idleMs >= opts.delayMinutes * 60_000;
}
