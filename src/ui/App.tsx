import { useEffect, useRef, useState } from 'react';
import { controller } from '../app/controller';
import { setState, useStore } from '../state/store';
import { Deck } from './Deck';
import { Help } from './Help';
import { ScenePicker } from './ScenePicker';
import { Settings } from './Settings';
import { useShortcuts } from './useShortcuts';

const FULLSCREEN_IDLE_MS = 4000;

export function App() {
  const stage = useRef<HTMLDivElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const panel = useStore((s) => s.panel);
  const deckHidden = useStore((s) => s.deckHidden);
  const crt = useStore((s) => s.crt);
  const started = useStore((s) => s.source !== null || s.sourceLabel !== '');
  const seenHelp = useStore((s) => s.seenHelp);
  const [idleHidden, setIdleHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [everStarted, setEverStarted] = useState(false);
  useShortcuts();

  useEffect(() => {
    controller.attachHost(stage.current);
    if (!seenHelp) setState({ panel: 'help' });
  }, []);

  useEffect(() => {
    if (started) setEverStarted(true);
  }, [started]);

  // Keep dropdown panels clear of the deck on desktop.
  useEffect(() => {
    const el = deck.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--deck-height', `${el.offsetHeight + 24}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // In full screen, hide the deck after 4 s without pointer movement.
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      setIdleHidden(false);
      if (document.fullscreenElement) timer = window.setTimeout(() => setIdleHidden(true), FULLSCREEN_IDLE_MS);
    };
    document.addEventListener('pointermove', arm);
    document.addEventListener('fullscreenchange', arm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointermove', arm);
      document.removeEventListener('fullscreenchange', arm);
    };
  }, []);

  // Drag and drop audio files anywhere.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files.length) controller.playFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const hidden = deckHidden || (idleHidden && panel === 'none');

  return (
    <>
      <div
        className="stage"
        ref={stage}
        onClick={() => setState((s) => ({ deckHidden: !s.deckHidden }))}
        aria-label="Visualizer. Click to hide or show the controls."
      >
        {!everStarted && (
          <div className="idle">
            <h1>MUSIC VISUALIZER</h1>
            <p>Press Play demo to start. No files needed.</p>
          </div>
        )}
      </div>
      {crt && <div className="crt" aria-hidden="true" />}
      <Deck hidden={hidden} deckRef={deck} pickerButtonRef={pickerButton} />
      {panel === 'picker' && <ScenePicker />}
      {panel === 'settings' && <Settings />}
      {panel === 'help' && <Help />}
      {dragging && <div className="drop-hint">Drop audio files to play</div>}
    </>
  );
}
