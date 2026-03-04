export default function SvgIcon({ name, color = 'currentColor', size = 16, ...rest }) {
  const finalSize = typeof size === 'number' ? `${size}px` : size

  return (
    <svg
      aria-hidden="true"
      width={finalSize}
      height={finalSize}
      fill={color}
      {...rest}
    >
      {/* 配合 vite-plugin-svg-icons，symbolId: icon-[name] */}
      <use href={`#icon-${name}`} />
    </svg>
  )
}

