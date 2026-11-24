import { useId } from 'react'
import { SearchIcon } from './icons'

const SKELETON_ROWS = 4

export interface RelatedSearchesProps {
  terms: readonly string[]
  /** Mientras carga se muestran líneas de relleno (evita que la lista "salte" al llegar los resultados). */
  loading?: boolean
  onSelect: (term: string) => void
}

/** Lista "Búsquedas relacionadas" (arriba de la publicidad, en la columna derecha). */
export function RelatedSearches({ terms, loading = false, onSelect }: RelatedSearchesProps) {
  const headingId = useId()

  if (!loading && terms.length === 0) return null

  return (
    <nav className="related" aria-labelledby={headingId} aria-busy={loading}>
      <h2 id={headingId} className="related__heading">
        Búsquedas relacionadas
      </h2>
      {loading ? (
        <ul className="related__list" aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <li key={i} className="related__skeleton">
              <span className="skeleton skeleton--line" style={{ width: `${70 - i * 12}%` }} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="related__list">
          {terms.map((term) => (
            <li key={term}>
              <button type="button" className="related__item" onClick={() => onSelect(term)}>
                <SearchIcon size={16} className="related__icon" />
                <span className="related__term">{term}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
