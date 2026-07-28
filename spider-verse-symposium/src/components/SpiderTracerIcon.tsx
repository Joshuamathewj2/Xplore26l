/* A small spider-tracer/web-shooter emblem — used wherever the site needs
   a marker glyph (list bullets, badge labels) instead of a plain dot or
   dash, so those small touches carry the same brand as everything else. */
export default function SpiderTracerIcon({
  size = 12,
  color = "currentColor",
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={style}
    >
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.1" />
      <path
        d="M8 2V5.2M8 10.8V14M2 8H5.2M10.8 8H14M4.1 4.1L6.3 6.3M11.9 4.1L9.7 6.3M4.1 11.9L6.3 9.7M11.9 11.9L9.7 9.7"
        stroke={color}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="1.3" fill={color} />
    </svg>
  );
}
