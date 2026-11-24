import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type FocusEvent, type KeyboardEvent } from 'react'
import type { Product } from '../api/search'
import { MIN_QUERY_LENGTH, useProductSearch, type SearchState } from '../hooks/useProductSearch'
import { buildAd } from '../lib/ad'
import { matchBrand } from '../lib/brands'
import { buildRelatedSearches } from '../lib/related'
import { storeSearchUrl } from '../lib/store'
import { AdSlot } from './AdSlot'
import { SearchIcon } from './icons'
import { ProductCard, ProductCardSkeleton } from './ProductCard'
import { RelatedSearches } from './RelatedSearches'

const SUGGESTED_TERMS = ['shirt', 'shoes', 'top']
const SKELETON_ROWS = 3
const NO_PRODUCTS: Product[] = []

export interface SearchBoxProps {
  /** Espera tras la última tecla antes de buscar (ms). */
  debounceMs?: number
}

/**
 * Buscador del header con desplegable ("cajón"): productos a la izquierda y, a la derecha,
 * búsquedas relacionadas arriba y una publicidad compacta abajo (video si se busca una marca).
 */
export function SearchBox({ debounceMs }: SearchBoxProps) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const { state, searchNow, searchTerm } = useProductSearch(value, { debounceMs })

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const typedQuery = value.trim()
  const isSearchable = typedQuery.length >= MIN_QUERY_LENGTH
  const showPanel = open && isSearchable
  // la query de la búsqueda en curso/resuelta; mientras el hook arranca, la que se escribió
  const activeQuery = state.status === 'idle' ? typedQuery : state.query
  const products = state.status === 'success' ? state.result.products : NO_PRODUCTS
  const ad = useMemo(() => buildAd(activeQuery, products), [activeQuery, products])
  const brand = useMemo(() => matchBrand(activeQuery, products), [activeQuery, products])
  const related = useMemo(() => buildRelatedSearches(activeQuery, products), [activeQuery, products])
  const isLoading = state.status === 'loading' || state.status === 'idle'

  // cerrar con clic fuera del buscador (incluye el overlay oscuro)
  useEffect(() => {
    if (!showPanel) return
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showPanel])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault() // evita que el input type=search borre el texto
      setOpen(false)
      inputRef.current?.focus()
    }
  }

  // cerrar si el foco sale del buscador con el teclado (Tab); los clics los maneja mousedown
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && !rootRef.current?.contains(next)) setOpen(false)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isSearchable) {
      inputRef.current?.focus()
      return
    }
    setOpen(true)
    searchNow()
  }

  // sugerencias (búsquedas relacionadas y chips del estado vacío): llenan el input y buscan ya,
  // sin esperar el debounce; el desplegable sigue abierto
  const applySuggestion = (term: string) => {
    setValue(term)
    setOpen(true)
    searchTerm(term)
    inputRef.current?.focus()
  }

  return (
    <>
      {showPanel && <div className="search-overlay" aria-hidden="true" />}
      <div
        ref={rootRef}
        className={`search${showPanel ? ' search--open' : ''}`}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      >
        <form className="search__form" role="search" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className="search__input"
            type="search"
            name="q"
            value={value}
            placeholder="¿Qué estás buscando hoy?"
            aria-label="Buscar productos"
            aria-controls={showPanel ? panelId : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => {
              setValue(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
          />
          <button className="search__button" type="submit" aria-label="Buscar">
            <SearchIcon />
          </button>
        </form>

        <p className="visually-hidden" role="status" aria-live="polite">
          {showPanel ? statusMessage(state) : ''}
        </p>

        {showPanel && (
          <div id={panelId} className="search-panel" role="region" aria-label="Resultados de búsqueda">
            <section className="search-panel__results" aria-busy={isLoading}>
              <h2 className="search-panel__heading">Productos para “{activeQuery}”</h2>
              <PanelContent state={state} onRetry={searchNow} onSuggestion={applySuggestion} />
            </section>
            {state.status !== 'error' && (
              <div className="search-panel__aside">
                <RelatedSearches terms={related} loading={isLoading} onSelect={applySuggestion} />
                <AdSlot ad={ad} brand={brand} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function PanelContent({
  state,
  onRetry,
  onSuggestion,
}: {
  state: SearchState
  onRetry: () => void
  onSuggestion: (term: string) => void
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <ul className="product-list" aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <li key={i}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="panel-message panel-message--error">
        <p className="panel-message__title">No pudimos cargar los productos</p>
        <p className="panel-message__text">{state.error}</p>
        <button type="button" className="panel-message__action" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    )
  }

  const { products, total } = state.result
  if (products.length === 0) {
    return (
      <div className="panel-message">
        <p className="panel-message__title">No encontramos productos para “{state.query}”</p>
        <p className="panel-message__text">
          El catálogo de demostración está en inglés. Prueba con términos como{' '}
          {SUGGESTED_TERMS.map((term, i) => (
            <span key={term}>
              <button type="button" className="chip" onClick={() => onSuggestion(term)}>
                {term}
              </button>
              {i < SUGGESTED_TERMS.length - 2 ? ', ' : i === SUGGESTED_TERMS.length - 2 ? ' o ' : '.'}
            </span>
          ))}
        </p>
      </div>
    )
  }

  return (
    <>
      <ul className="product-list">
        {products.map((product, i) => (
          <li key={`${product.id}-${i}`}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <a className="search-panel__all" href={storeSearchUrl(state.query)} target="_blank" rel="noopener noreferrer">
        Ver todos los resultados ({total})
      </a>
    </>
  )
}

function statusMessage(state: SearchState): string {
  switch (state.status) {
    case 'idle':
    case 'loading':
      return 'Buscando productos…'
    case 'error':
      return state.error
    case 'success': {
      const { total } = state.result
      if (total === 0 || state.result.products.length === 0) return `No encontramos productos para “${state.query}”.`
      return `${total} ${total === 1 ? 'producto encontrado' : 'productos encontrados'} para “${state.query}”.`
    }
  }
}
