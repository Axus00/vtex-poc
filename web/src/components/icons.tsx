// Íconos SVG inline (sin dependencias). Son decorativos: el texto accesible va en el control.

interface IconProps {
  size?: number
  className?: string
}

export function SearchIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.6" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}

export function PinIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function MenuIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function BagIcon({ size = 32, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 8h14l-1 12H6L5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function ArrowIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
