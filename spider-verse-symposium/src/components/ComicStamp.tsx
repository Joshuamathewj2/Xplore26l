/* A rotated comic sound-effect sticker ("THWIP!", "POW!") — decorative
   only, so it's always aria-hidden and never intercepts a click. Position
   it with `style` from the call site (each use case needs its own spot). */
export default function ComicStamp({
  text,
  rotate = -8,
  bg = "var(--main-red)",
  fg = "var(--paper-white)",
  border = "var(--paper-white)",
  shadow = "var(--velvet-black)",
  style,
}: {
  text: string;
  rotate?: number;
  bg?: string;
  fg?: string;
  border?: string;
  shadow?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        display: "inline-block",
        fontFamily: "var(--font-brutal)",
        fontSize: "clamp(0.9rem, 2.2vw, 1.4rem)",
        letterSpacing: "0.03em",
        color: fg,
        background: bg,
        border: `3px solid ${border}`,
        boxShadow: `4px 4px 0 ${shadow}`,
        padding: "4px 11px",
        transform: `rotate(${rotate}deg)`,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text}
    </span>
  );
}
