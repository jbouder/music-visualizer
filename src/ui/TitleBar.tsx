import type { ReactNode } from 'react';

/** Classic player title bar: grooved stripes either side of the title, small buttons on the right. */
export function TitleBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="titlebar">
      <span className="titlebar-grip" aria-hidden="true" />
      <span className="titlebar-title">{title}</span>
      <span className="titlebar-grip" aria-hidden="true" />
      {children && <span className="titlebar-buttons">{children}</span>}
    </div>
  );
}

/** A small-looking button with a full 44 px hit area. */
export function ChipButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button type="button" className="chip" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      <span className="chip-face">{children}</span>
    </button>
  );
}
