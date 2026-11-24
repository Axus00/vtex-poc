import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

// jsdom y algunos navegadores viejos no tienen matchMedia: en ese caso se asume "sin preferencia".
function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null
}

function subscribe(onChange: () => void): () => void {
  const mql = mediaQuery()
  if (!mql || typeof mql.addEventListener !== 'function') return () => {}
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const getSnapshot = () => mediaQuery()?.matches ?? false
const getServerSnapshot = () => false

/** true si el sistema pide reducir el movimiento (p. ej. no reproducir videos solos). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
