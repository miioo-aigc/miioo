export function FavoriteIcon({
  size = 16,
  color = '#FFFFFFCC',
  filled = false,
  filledColor = '#F0B429',
  strokeWidth = 0.88,
  style,
  ...props
}) {
  const stroke = filled ? filledColor : color;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, ...style }} {...props}>
      <path
        d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z"
        transform="translate(-0.84 -0.84) scale(1.12)"
        fill={filled ? filledColor : 'none'}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeleteIcon({ size = 16, color = '#FFFFFFCC', style, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, ...style }} {...props}>
      <path d="M2.625 2.916V12.834H11.375V2.916H2.625Z" stroke={color} strokeLinejoin="round" />
      <path d="M5.834 5.834V9.625M8.166 5.834V9.625M1.166 2.916H12.834M4.666 2.916L5.626 1.166H8.393L9.334 2.916H4.666Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
