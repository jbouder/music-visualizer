import { useLayoutEffect, useRef, useState } from 'react';

/** Scrolling title text. Errors and short text stay still; reduced motion never scrolls. */
export function Marquee({ text, tone }: { text: string; tone: 'info' | 'error' }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scroll, setScroll] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      if (box.current && inner.current) setScroll(tone === 'info' && inner.current.scrollWidth > box.current.clientWidth);
    };
    setScroll(false);
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [text, tone]);

  const seconds = Math.max(6, text.length * 0.22);
  return (
    <div className="marquee" ref={box} data-tone={tone} data-scroll={scroll} aria-hidden="true">
      <span ref={inner} className="marquee-inner" style={{ animationDuration: `${seconds}s` }}>
        {text}
        {scroll && <span className="marquee-gap">{'  ***  '}{text}{'  ***  '}</span>}
      </span>
    </div>
  );
}
