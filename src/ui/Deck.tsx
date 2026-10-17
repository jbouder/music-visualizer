import { useRef } from 'react';
import { controller } from '../app/controller';
import { getScene } from '../render/registry';
import { isFavorite, setState, useStore } from '../state/store';
import { Display, MiniTime, SeekBar } from './Display';
import { fullscreenSupported, toggleFullscreen } from './fullscreen';
import { ChipButton, ChipGlyph, TitleBar } from './TitleBar';
import { useDraggable } from './useDraggable';

interface Props {
  hidden: boolean;
  deckRef: React.RefObject<HTMLDivElement | null>;
  pickerButtonRef: React.RefObject<HTMLButtonElement | null>;
}

const G = {
  prev: <path d="M3 3h2v10H3zM14 3v10L6 8z" />,
  play: <path d="M4 2v12l10-6z" />,
  pause: <path d="M3 3h4v10H3zM9 3h4v10H9z" />,
  stop: <path d="M3 3h10v10H3z" />,
  next: <path d="M11 3h2v10h-2zM2 3v10l8-5z" />,
  eject: <path d="M8 2l6 7H2zM2 11h12v3H2z" />,
  mic: <path d="M6 1h4v8H6zM3 7h1.5v1a3.5 3.5 0 0 0 7 0V7H13v1a5 5 0 0 1-4.25 4.95V15h-1.5v-2.05A5 5 0 0 1 3 8z" />,
  tab: <path d="M1 2h14v9H1zm2 2v5h10V4zM5 13h6v1.5H5z" />,
  shuffle: <path d="M1 4h3l6 8h3v-2l3 3-3 3v-2h-4L3 6H1zm9 0h3V2l3 3-3 3V6h-2l-1.5 2-1-1.4z" />,
  star: <path d="M8 1l2.1 4.6 5 .5-3.8 3.3 1.1 4.9L8 11.8 3.6 14.3l1.1-4.9L.9 6.1l5-.5z" />,
};

function Glyph({ d }: { d: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {d}
    </svg>
  );
}

/** The main window: title bar, display, volume and toggles, seek bar, transport, scene list bar. */
export function Deck({ hidden, deckRef, pickerButtonRef }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const s = useStore();
  const ref = s.scene;
  const starred = isFavorite(s.favorites, ref);
  const sceneName = getScene(ref.rendererId)?.name ?? ref.rendererId;
  const playLabel = s.source && s.paused ? 'Resume' : 'Play demo';
  const full = useDraggable('deckPos');
  const mini = useDraggable('miniPos');

  if (s.deckMini) {
    return (
      <div className={`deck-wrap is-mini${mini.floating ? ' is-floating' : ''}`} ref={mini.wrap} data-hidden={hidden} inert={hidden}>
        <div className="window mini-window" ref={deckRef} onClick={(e) => e.stopPropagation()}>
          <div className="mini-bar" role="group" aria-label="Compact controls">
            <span className="mini-grip" title="Drag to move. Double-click to dock." {...mini.handleProps} />
            <p className="sr-only" role="status" aria-live="polite">
              {s.message?.text ?? s.sourceLabel}
            </p>
            <div className="mini-lcd" title={s.sceneLabel}>
              <span className={`state-glyph state-${!s.source ? 'stop' : s.paused ? 'pause' : 'play'}`} aria-hidden="true" />
              <MiniTime />
            </div>
            <button type="button" className="tbtn" aria-label="Previous scene" onClick={() => controller.previous()}>
              <Glyph d={G.prev} />
            </button>
            <button type="button" className="tbtn" aria-label={playLabel} aria-pressed={s.source === 'demo' && !s.paused} onClick={() => controller.play()}>
              <Glyph d={G.play} />
            </button>
            <button type="button" className="tbtn" aria-label="Pause" aria-pressed={s.paused} disabled={!s.source} onClick={() => void controller.togglePause()}>
              <Glyph d={G.pause} />
            </button>
            <button type="button" className="tbtn" aria-label="Next scene" onClick={() => controller.next()}>
              <Glyph d={G.next} />
            </button>
            <ChipButton label="Restore controls" onClick={() => setState({ deckMini: false, deckPos: null })}>
              <ChipGlyph name="restore" />
            </ChipButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`deck-wrap${full.floating ? ' is-floating' : ''}`} ref={full.wrap} data-hidden={hidden} inert={hidden}>
      <div className="window main-window" ref={deckRef} onClick={(e) => e.stopPropagation()}>
        <TitleBar title="Music visualizer" handleProps={full.handleProps}>
          {fullscreenSupported() && (
            <ChipButton label="Full screen" onClick={() => toggleFullscreen()}>
              <ChipGlyph name="fullscreen" />
            </ChipButton>
          )}
          <ChipButton label="Minimize controls" onClick={() => setState({ deckMini: true, miniPos: null })}>
            <ChipGlyph name="minimize" />
          </ChipButton>
        </TitleBar>

        <div className="deck">
          <Display />

          <div className="row sliders">
            <label className="volume">
              <span className="sr-only">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={s.volume}
                style={{ '--fill': `${s.volume * 100}%` } as React.CSSProperties}
                onChange={(e) => setState({ volume: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              className="led-btn"
              aria-label="Retro mode"
              aria-pressed={s.retroLook}
              disabled={!s.webgl2}
              title={s.webgl2 ? 'Toggle the Retro look (T)' : 'The Retro look is locked on: WebGL 2 is not available'}
              onClick={() => controller.toggleRetro()}
            >
              <span className="led" aria-hidden="true" />
              Retro
            </button>
            <button
              type="button"
              className="led-btn"
              aria-label="Auto-cycle"
              aria-pressed={s.autoCycle}
              title={`Auto-cycle every ${s.cycleInterval} s`}
              onClick={() => setState({ autoCycle: !s.autoCycle })}
            >
              <span className="led" aria-hidden="true" />
              Auto
            </button>
          </div>

          <SeekBar />

          <div className="row transport" role="group" aria-label="Transport">
            <button type="button" className="tbtn" aria-label="Previous scene" title="Previous scene (P)" onClick={() => controller.previous()}>
              <Glyph d={G.prev} />
            </button>
            <button type="button" className="tbtn" aria-label={playLabel} aria-pressed={s.source === 'demo' && !s.paused} onClick={() => controller.play()}>
              <Glyph d={G.play} />
            </button>
            <button type="button" className="tbtn" aria-label="Pause" aria-pressed={s.paused} disabled={!s.source} onClick={() => void controller.togglePause()}>
              <Glyph d={G.pause} />
            </button>
            <button type="button" className="tbtn" aria-label="Stop" disabled={!s.source} onClick={() => controller.stop()}>
              <Glyph d={G.stop} />
            </button>
            <button type="button" className="tbtn" aria-label="Next scene" title="Next scene (N)" onClick={() => controller.next()}>
              <Glyph d={G.next} />
            </button>
            <button
              type="button"
              className="tbtn"
              aria-label="Open file"
              aria-pressed={s.source === 'file'}
              onClick={() => fileInput.current && controller.openFilePicker(fileInput.current)}
            >
              <Glyph d={G.eject} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={(e) => e.target.files?.length && controller.playFiles(e.target.files)}
            />
            <span className="transport-gap" aria-hidden="true" />
            {controller.micSupported && (
              <button type="button" className="tbtn" aria-label="Microphone" aria-pressed={s.source === 'mic'} onClick={() => controller.startMic()}>
                <Glyph d={G.mic} />
              </button>
            )}
            {controller.tabSupported && (
              <button type="button" className="tbtn" aria-label="Capture tab" aria-pressed={s.source === 'tab'} onClick={() => controller.startTab()}>
                <Glyph d={G.tab} />
              </button>
            )}
            <button type="button" className="tbtn" aria-label="Random scene" title="Random scene (R)" onClick={() => controller.randomScene()}>
              <Glyph d={G.shuffle} />
            </button>
            <button
              type="button"
              className="tbtn"
              aria-label={starred ? 'Unstar this scene' : 'Star this scene'}
              aria-pressed={starred}
              title="Favorite (S)"
              onClick={() => controller.toggleFavorite()}
            >
              <Glyph d={G.star} />
            </button>
          </div>

          {s.source === 'file' && s.fileQueueLength > 1 && (
            <div className="row" role="group" aria-label="Tracks">
              <button type="button" className="sbtn" onClick={() => void controller.previousTrack()}>
                Previous track
              </button>
              <button type="button" className="sbtn" onClick={() => void controller.nextTrack()}>
                Next track
              </button>
            </div>
          )}

          <span
            className="pi"
            aria-hidden="true"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              const open = () => setState({ panel: 'terminal' });
              if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                open();
              } else if (e.pointerType === 'touch') {
                const timer = window.setTimeout(open, 900);
                const cancel = () => window.clearTimeout(timer);
                e.currentTarget.addEventListener('pointerup', cancel, { once: true });
                e.currentTarget.addEventListener('pointerleave', cancel, { once: true });
              }
            }}
          >
            π
          </span>

          <div className="row listbar">
            <button
              ref={pickerButtonRef}
              type="button"
              className="sbtn scene-btn"
              aria-haspopup="dialog"
              aria-expanded={s.panel === 'picker'}
              onClick={() => setState({ panel: 'picker' })}
            >
              <span className="sr-only">Choose scene. Current: </span>
              <span className="scene-name">{sceneName}</span>
              <span aria-hidden="true">▲</span>
            </button>
            <button type="button" className="sbtn" aria-haspopup="dialog" onClick={() => setState({ panel: 'settings' })}>
              Settings
            </button>
            <button type="button" className="sbtn" aria-label="Help" aria-haspopup="dialog" onClick={() => setState({ panel: 'help' })}>
              ?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
