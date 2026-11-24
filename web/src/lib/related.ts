// "Búsquedas relacionadas" de la columna derecha del desplegable.
// VTEX (search_suggestions) no devuelve términos para el catálogo demo, así que se derivan
// aquí, en el front, con una función pura: misma query + productos => mismas sugerencias.

import type { Product } from '../api/search'
import { categorySearches } from './ad'
import { isUsefulBrand } from './brands'
import { termKey } from './text'

export const MAX_RELATED_SEARCHES = 5
/** Cuántas marcas de los resultados van antes de los términos de la categoría. */
const LEADING_BRANDS = 2

/**
 * Términos populares que sí traen resultados en el catálogo demo de VTEX (en inglés).
 * Completan la lista cuando no hay productos ni categoría reconocida.
 */
export const POPULAR_SEARCHES: readonly string[] = ['shirt', 'shoes', 'top', 'samsung', 'mizuno', 'sony']

/**
 * Hasta `max` búsquedas relacionadas, sin repetir y sin la query actual (ni sus variantes
 * de mayúsculas, tildes o plural). Orden de prioridad:
 * 1. hasta 2 marcas de los resultados (las útiles, en orden de aparición);
 * 2. términos de la categoría detectada (misma taxonomía que la publicidad, `ad.ts`);
 * 3. el resto de marcas de los resultados;
 * 4. búsquedas populares del catálogo demo (sobre todo cuando no hubo productos).
 */
export function buildRelatedSearches(
  query: string,
  products: readonly Product[] = [],
  max: number = MAX_RELATED_SEARCHES,
): string[] {
  const seen = new Set<string>([termKey(query)])
  const result: string[] = []

  const add = (term: string) => {
    const clean = term.trim().replace(/\s+/g, ' ')
    const key = termKey(clean)
    if (result.length >= max || key === '' || seen.has(key)) return
    seen.add(key)
    result.push(clean)
  }

  // marcas útiles sin repetir, conservando la primera aparición
  const brandKeys = new Set<string>()
  const brands: string[] = []
  for (const { brand } of products) {
    const clean = brand.trim()
    const key = termKey(clean)
    if (!isUsefulBrand(clean) || brandKeys.has(key)) continue
    brandKeys.add(key)
    brands.push(clean)
  }

  brands.slice(0, LEADING_BRANDS).forEach(add)
  categorySearches(query, products).forEach(add)
  brands.slice(LEADING_BRANDS).forEach(add)
  POPULAR_SEARCHES.forEach(add)
  return result
}
