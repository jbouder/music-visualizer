import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { getState, setState, useStore, type WindowPos } from '../state/store';

type Key = 'deckPos' | 'miniPos';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bounds of the windows inside a docked wrapper (which itself spans the screen width). */
function stackRect(el: HTMLElement): DOMRect {
  const kids = Array.from(el.children) as HTMLElement[];
  const rects = kids.map((k) => k.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * Lets a window be dragged by a handle. The position is stored as fractions of
 * the free space (viewport minus window size), so it survives resizes. A
 * double-click on the handle docks the window again.
 */
export function useDraggable(key: Key) {
  const wrap = useRef<HTMLDivElement>(null);
  const pos = useStore((s) => s[key]);

  const place = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const p = getState()[key];
    if (!p) {
      el.style.left = el.style.top = '';
      return;
    }
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.round(p.x * Math.max(0, innerWidth - r.width))}px`;
    el.style.top = `${Math.round(p.y * Math.max(0, innerHeight - r.height))}px`;
  }, [key]);

  useLayoutEffect(place, [pos, place]);

  useEffect(() => {
    const el = wrap.current;
    window.addEventListener('resize', place);
    const ro = new ResizeObserver(place);
    if (el) ro.observe(el);
    return () => {
      window.removeEventListener('resize', place);
      ro.disconnect();
    };
  }, [place]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const el = wrap.current;
    if (!el || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    // The whole stack moves together (equalizer and player).
    const start = el.classList.contains('is-floating') ? el.getBoundingClientRect() : stackRect(el);
    const dx = e.clientX - start.left;
    const dy = e.clientY - start.top;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    let last: WindowPos | null = null;

    const move = (ev: PointerEvent) => {
      const maxX = Math.max(0, innerWidth - start.width);
      const maxY = Math.max(0, innerHeight - start.height);
      const x = clamp(ev.clientX - dx, 0, maxX);
      const y = clamp(ev.clientY - dy, 0, maxY);
      el.classList.add('is-floating');
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      last = { x: maxX ? x / maxX : 0, y: maxY ? y / maxY : 0 };
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (last) setState({ [key]: last });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const dock = () => setState({ [key]: null });

  return { wrap, floating: pos !== null, handleProps: { onPointerDown, onDoubleClick: dock } };
}
