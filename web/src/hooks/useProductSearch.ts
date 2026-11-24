import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_COUNT, isAbortError, searchProducts, SearchError, type SearchResult } from '../api/search'

export const MIN_QUERY_LENGTH = 2
export const DEBOUNCE_MS = 300

export type SearchState =
  | { status: 'idle'; query: '' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; result: SearchResult }
  | { status: 'error'; query: string; error: string }

export interface UseProductSearchOptions {
  debounceMs?: number
  count?: number
  minLength?: number
}

const IDLE: SearchState = { status: 'idle', query: '' }

/**
 * Búsqueda con debounce sobre la API de Go.
 * - Queries con menos de `minLength` caracteres (sin espacios) dejan el estado en `idle`.
 * - Cada búsqueda nueva aborta la anterior (AbortController) y además se descarta
 *   cualquier respuesta que no sea la de la última petición (respuestas fuera de orden).
 * - `searchNow()` salta el debounce (Enter o botón de buscar).
 * - `searchTerm(term)` busca otro término de inmediato (sugerencias); quien llama debe poner
 *   ese mismo término en el input para que el efecto no lo vuelva a programar.
 */
export function useProductSearch(rawQuery: string, options: UseProductSearchOptions = {}) {
  const { debounceMs = DEBOUNCE_MS, count = DEFAULT_COUNT, minLength = MIN_QUERY_LENGTH } = options
  const query = rawQuery.trim()
  const isSearchable = query.length >= minLength

  const [state, setState] = useState<SearchState>(IDLE)
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Query de la última búsqueda programada o ejecutada (evita repetir la misma). */
  const scheduledQueryRef = useRef('')

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const cancelInFlight = () => {
    requestIdRef.current += 1 // invalida cualquier respuesta pendiente
    controllerRef.current?.abort()
    controllerRef.current = null
  }

  const run = useCallback(
    (q: string) => {
      clearTimer()
      cancelInFlight()
      const controller = new AbortController()
      controllerRef.current = controller
      const requestId = requestIdRef.current
      scheduledQueryRef.current = q
      setState({ status: 'loading', query: q })

      searchProducts(q, { signal: controller.signal, count }).then(
        (result) => {
          if (requestId !== requestIdRef.current) return
          controllerRef.current = null
          setState({ status: 'success', query: q, result })
        },
        (err: unknown) => {
          if (requestId !== requestIdRef.current || isAbortError(err)) return
          controllerRef.current = null
          const message =
            err instanceof SearchError ? err.message : 'Ocurrió un error inesperado al buscar. Inténtalo de nuevo.'
          setState({ status: 'error', query: q, error: message })
        },
      )
    },
    [count],
  )

  useEffect(() => {
    if (!isSearchable) {
      clearTimer()
      cancelInFlight()
      scheduledQueryRef.current = ''
      setState(IDLE)
      return
    }
    if (query === scheduledQueryRef.current) return // p. ej. solo cambió un espacio al final

    // mostramos "cargando" desde ya para que el panel no quede vacío durante el debounce
    cancelInFlight()
    scheduledQueryRef.current = query
    setState({ status: 'loading', query })
    clearTimer()
    timerRef.current = setTimeout(() => run(query), debounceMs)
  }, [query, isSearchable, debounceMs, run])

  // al desmontar: sin timers ni peticiones colgando. Se olvida la query programada para que
  // un re-montaje (p. ej. StrictMode en desarrollo) vuelva a lanzar la búsqueda.
  useEffect(
    () => () => {
      clearTimer()
      cancelInFlight()
      scheduledQueryRef.current = ''
    },
    [],
  )

  const searchNow = useCallback(() => {
    if (isSearchable) run(query)
  }, [isSearchable, query, run])

  const searchTerm = useCallback(
    (term: string) => {
      const q = term.trim()
      if (q.length >= minLength) run(q)
    },
    [minLength, run],
  )

  return { state, searchNow, searchTerm }
}
