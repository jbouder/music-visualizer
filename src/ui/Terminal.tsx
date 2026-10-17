import { useEffect, useRef, useState } from 'react';
import { BOOT_LINES, runCommand } from '../app/terminal';
import { controller } from '../app/controller';
import { prefersReducedMotion } from '../state/persistence';
import { getState, setState } from '../state/store';

/** A green-screen console with a few commands. */
export function Terminal() {
  const reduce = prefersReducedMotion();
  const [lines, setLines] = useState<string[]>(reduce ? BOOT_LINES : []);
  const [typing, setTyping] = useState(!reduce);
  const [input, setInput] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const close = () => setState({ panel: 'none' });

  // Type the login sequence one character at a time.
  useEffect(() => {
    if (!typing) return;
    let line = 0;
    let ch = 0;
    const id = window.setInterval(() => {
      if (line >= BOOT_LINES.length) {
        window.clearInterval(id);
        setTyping(false);
        return;
      }
      const text = BOOT_LINES[line];
      ch++;
      setLines((prev) => {
        const next = prev.slice(0, line);
        next[line] = text.slice(0, ch);
        return next;
      });
      if (ch >= text.length) {
        line++;
        ch = 0;
      }
    }, 18);
    return () => window.clearInterval(id);
  }, [typing]);

  useEffect(() => {
    if (!typing) field.current?.focus();
  }, [typing]);

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [lines]);

  const submit = () => {
    const { lines: out, action } = runCommand(input);
    setLines((prev) => (action?.type === 'clear' ? [] : [...prev, `> ${input}`, ...out]));
    setInput('');
    switch (action?.type) {
      case 'intro':
        controller.launchIntro();
        close();
        break;
      case 'stats':
        setState({ monitor: !getState().monitor });
        break;
      case 'skin':
        setState({ skin: action.skin });
        break;
      case 'game':
        setState({ panel: 'none', game: action.game });
        break;
      case 'exit':
        window.setTimeout(close, 300);
        break;
    }
  };

  return (
    <div className="term-scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="term" role="dialog" aria-modal="true" aria-label="Terminal" onKeyDown={(e) => e.key === 'Escape' && close()}>
        <div className="term-screen" ref={screen} onClick={() => field.current?.focus()}>
          {lines.map((l, i) => (
            <div key={i} className={l.startsWith('ACCESS GRANTED') ? 'term-line term-hot' : 'term-line'}>
              {l || ' '}
            </div>
          ))}
          {!typing && (
            <form
              className="term-prompt"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <span aria-hidden="true">&gt;</span>
              <input
                ref={field}
                aria-label="Command"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
