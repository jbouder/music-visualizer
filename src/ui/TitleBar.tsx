import type { ReactNode } from 'react';

/** Classic player title bar: grooved stripes either side of the title, small buttons on the right. */
export function TitleBar({
  title,
  children,
  handleProps,
}: {
  title: string;
  children?: ReactNode;
  /** Makes the bar a drag handle for its window. */
  handleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div className="titlebar" data-handle={!!handleProps} title={handleProps ? 'Drag to move. Double-click to dock.' : undefined} {...handleProps}>
      <span className="titlebar-grip" aria-hidden="true" />
      <span className="titlebar-title">{title}</span>
      <span className="titlebar-grip" aria-hidden="true" />
      {children && <span className="titlebar-buttons">{children}</span>}
    </div>
  );
}

/** Pixel-art glyphs for title bar buttons, drawn on a 10 x 10 grid. */
const CHIP_GLYPHS = {
  minimize: <path d="M2 7h6v2H2z" />,
  restore: <path d="M1 1h8v8H1zm1 3v4h6V4z" />,
  fullscreen: <path d="M1 1h3v1H2v2H1zM6 1h3v3H8V2H6zM1 6h1v2h2v1H1zM8 6h1v3H6V8h2z" />,
  close: <path d="M1 1h2v1h1v1h2V2h1V1h2v2H8v1H7v2h1v1h1v2H7V8H6V7H4v1H3v1H1V7h1V6h1V4H2V3H1z" />,
};

export function ChipGlyph({ name }: { name: keyof typeof CHIP_GLYPHS }) {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" shapeRendering="crispEdges">
      {CHIP_GLYPHS[name]}
    </svg>
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
