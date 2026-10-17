import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'sheet' | 'dropdown';
  /** Element to focus first; defaults to the close button. */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

/** A modal sheet on phones and a centered panel (or dropdown) on desktop. */
export function Sheet({ title, onClose, children, variant = 'sheet', initialFocus }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (initialFocus?.current ?? closeBtn.current)?.focus();
    return () => previous?.focus?.();
  }, [initialFocus]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
    if (e.key === 'Tab' && panel.current) {
      const focusables = panel.current.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="scrim" data-variant={variant} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel} onKeyDown={onKeyDown}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button ref={closeBtn} type="button" className="btn" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <IconClose />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
