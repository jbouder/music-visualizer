// Segments a-g for each digit, as a bitmask (a = 1 ... g = 64).
const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

// Segment polygons in a 12 x 22 cell.
const SEGMENTS = [
  '2,1 10,1 9,3 3,3', // a
  '10,2 11,3 11,10 10,11 9,10 9,3', // b
  '10,12 11,13 11,20 10,21 9,19 9,13', // c
  '3,19 9,19 10,21 2,21', // d
  '2,12 3,13 3,19 2,20 1,20 1,13', // e (left-bottom)
  '2,2 3,3 3,10 2,11 1,10 1,3', // f (left-top)
  '2,11 3,10 9,10 10,11 9,12 3,12', // g
];

function Digit({ mask, x }: { mask: number; x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {SEGMENTS.map((pts, i) => (
        <polygon key={i} points={pts} className={mask & (1 << i) ? 'seg-on' : 'seg-off'} />
      ))}
    </g>
  );
}

/** mm:ss in seven-segment digits, like the classic player's time display. */
export function SevenSegTime({ seconds }: { seconds: number }) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.min(99, Math.floor(total / 60));
  const s = total % 60;
  const chars = [Math.floor(m / 10), m % 10, Math.floor(s / 10), s % 10];
  return (
    <svg className="sevenseg" viewBox="0 0 66 22" aria-hidden="true">
      <Digit mask={m < 10 ? 0 : DIGITS[chars[0]]} x={0} />
      <Digit mask={DIGITS[chars[1]]} x={14} />
      <rect x={29.5} y={6} width={2} height={2} className="seg-on" />
      <rect x={29.5} y={14} width={2} height={2} className="seg-on" />
      <Digit mask={DIGITS[chars[2]]} x={36} />
      <Digit mask={DIGITS[chars[3]]} x={50} />
    </svg>
  );
}
