import { useEffect } from 'react';
import { controller } from '../app/controller';
import { getState, setState } from '../state/store';
import { toggleFullscreen } from './fullscreen';

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (getState().game) return;
      const panelOpen = getState().panel !== 'none';
      // Inside an open panel, let buttons handle Space and Enter themselves.
      if (panelOpen && e.key !== '?') return;
      if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          void controller.togglePause();
          break;
        case 'n':
        case 'N':
          controller.next();
          break;
        case 'p':
        case 'P':
          controller.previous();
          break;
        case 'r':
        case 'R':
          controller.randomScene();
          break;
        case 't':
        case 'T':
          controller.toggleRetro();
          break;
        case 's':
        case 'S':
          controller.toggleFavorite();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'e':
        case 'E':
          setState((s) => ({ eqOpen: !s.eqOpen }));
          break;
        case 'h':
        case 'H':
          setState((s) => ({ deckHidden: !s.deckHidden }));
          break;
        case '/':
          e.preventDefault();
          setState({ panel: 'picker', deckHidden: false });
          break;
        case '?':
          setState({ panel: 'help' });
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
