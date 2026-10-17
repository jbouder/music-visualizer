import { useRef } from 'react';
import { controller } from '../app/controller';
import { getScene } from '../render/registry';
import { isFavorite, setState, useStore } from '../state/store';
import {
  IconChevron,
  IconCycle,
  IconExpand,
  IconFile,
  IconGear,
  IconHelp,
  IconMic,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRetro,
  IconSkipBack,
  IconSkipFwd,
  IconStar,
  IconStarFilled,
  IconStop,
  IconTab,
} from './icons';
import { Lcd } from './Lcd';
import { fullscreenSupported, toggleFullscreen } from './fullscreen';

interface Props {
  hidden: boolean;
  deckRef: React.RefObject<HTMLDivElement | null>;
  pickerButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export function Deck({ hidden, deckRef, pickerButtonRef }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const s = useStore();
  const ref = s.scenes[s.mode];
  const starred = isFavorite(s.favorites, ref);
  const sceneName = getScene(ref.rendererId)?.name ?? ref.rendererId;

  return (
    <div className="deck-wrap" data-hidden={hidden} inert={hidden}>
      <div className="deck" ref={deckRef} onClick={(e) => e.stopPropagation()}>
        <Lcd />

        <div className="row" role="group" aria-label="Sources">
          <button type="button" className="btn btn-primary" aria-label="Play demo" aria-pressed={s.source === 'demo'} onClick={() => controller.playDemo()}>
            <IconPlay />
            <span className="label">Play demo</span>
            <span className="label-short">Demo</span>
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Open file"
            aria-pressed={s.source === 'file'}
            onClick={() => fileInput.current && controller.openFilePicker(fileInput.current)}
          >
            <IconFile />
            <span className="label">Open file</span>
            <span className="label-short">File</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(e) => e.target.files?.length && controller.playFiles(e.target.files)}
          />
          {controller.micSupported && (
            <button type="button" className="btn" aria-label="Microphone" aria-pressed={s.source === 'mic'} onClick={() => controller.startMic()}>
              <IconMic />
              <span className="label">Microphone</span>
              <span className="label-short">Mic</span>
            </button>
          )}
          {controller.tabSupported && (
            <button type="button" className="btn" aria-label="Capture tab" aria-pressed={s.source === 'tab'} onClick={() => controller.startTab()}>
              <IconTab />
              <span className="label">Capture tab</span>
              <span className="label-short">Tab</span>
            </button>
          )}
          {s.source === 'file' && s.fileQueueLength > 1 && (
            <>
              <button type="button" className="btn" aria-label="Previous track" onClick={() => void controller.previousTrack()}>
                <IconSkipBack />
              </button>
              <button type="button" className="btn" aria-label="Next track" onClick={() => void controller.nextTrack()}>
                <IconSkipFwd />
              </button>
            </>
          )}
        </div>

        <div className="row" role="group" aria-label="Scenes">
          <button
            type="button"
            className="btn"
            aria-label="Retro mode"
            aria-pressed={s.mode === 'retro'}
            disabled={!s.webgl2}
            title={s.webgl2 ? 'Toggle Retro mode (T)' : 'Retro mode is locked on: WebGL 2 is not available'}
            onClick={() => controller.toggleMode()}
          >
            <IconRetro />
            <span className="label">Retro mode</span>
            <span className="label-short">Retro</span>
          </button>
          <button
            ref={pickerButtonRef}
            type="button"
            className="btn btn-picker grow"
            aria-haspopup="dialog"
            aria-expanded={s.panel === 'picker'}
            onClick={() => setState({ panel: 'picker' })}
          >
            <span>
              <span className="sr-only">Choose scene. Current: </span>
              {sceneName}
            </span>
            <IconChevron />
          </button>
          <button type="button" className="btn" aria-label="Previous scene" title="Previous (P)" onClick={() => controller.previous()}>
            <IconPrev />
          </button>
          <button type="button" className="btn" aria-label="Next scene" title="Next (N)" onClick={() => controller.next()}>
            <IconNext />
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Auto-cycle"
            aria-pressed={s.autoCycle}
            title={`Auto-cycle every ${s.cycleInterval} s`}
            onClick={() => setState({ autoCycle: !s.autoCycle })}
          >
            <IconCycle />
            <span className="label">Auto</span>
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={starred}
            aria-label={starred ? 'Unstar this scene' : 'Star this scene'}
            title="Favorite (S)"
            onClick={() => controller.toggleFavorite()}
          >
            {starred ? <IconStarFilled style={{ color: '#ffd75e' }} /> : <IconStar />}
          </button>
        </div>

        <div className="row row-compact" role="group" aria-label="Playback and app">
          {s.source && (
            <button type="button" className="btn" aria-label={s.paused ? 'Resume' : 'Pause'} aria-pressed={s.paused} onClick={() => void controller.togglePause()}>
              {s.paused ? <IconPlay /> : <IconPause />}
              <span className="label">{s.paused ? 'Resume' : 'Pause'}</span>
              <span className="label-short">{s.paused ? 'Resume' : 'Pause'}</span>
            </button>
          )}
          <button type="button" className="btn" aria-label="Stop" disabled={!s.source} onClick={() => controller.stop()}>
            <IconStop />
            <span className="label">Stop</span>
            <span className="label-short">Stop</span>
          </button>
          <button type="button" className="btn" aria-label="Settings" aria-haspopup="dialog" onClick={() => setState({ panel: 'settings' })}>
            <IconGear />
            <span className="label">Settings</span>
            <span className="label-short">Settings</span>
          </button>
          {fullscreenSupported() && (
            <button type="button" className="btn" aria-label="Full screen" onClick={() => toggleFullscreen()}>
              <IconExpand />
              <span className="label">Full screen</span>
              <span className="label-short">Full</span>
            </button>
          )}
          <button type="button" className="btn" aria-label="Help" aria-haspopup="dialog" onClick={() => setState({ panel: 'help' })}>
            <IconHelp />
            <span className="label">Help</span>
            <span className="label-short">Help</span>
          </button>
        </div>
      </div>
    </div>
  );
}
