import { describe, expect, it } from 'vitest'
import { makeProduct } from '../test/fixtures'
import { buildRelatedSearches, MAX_RELATED_SEARCHES, POPULAR_SEARCHES } from './related'
import { termKey } from './text'

const withBrands = (...brands: string[]) =>
  brands.map((brand, i) => makeProduct({ id: String(i), name: 'Work Shirt', brand }))

describe('buildRelatedSearches', () => {
  it('sin productos ni categoría usa las búsquedas populares del catálogo demo', () => {
    expect(buildRelatedSearches('nike')).toEqual(POPULAR_SEARCHES.slice(0, MAX_RELATED_SEARCHES))
  })

  it('excluye la query actual sin importar mayúsculas, tildes, espacios ni plural', () => {
    expect(buildRelatedSearches('  Samsung ')).toEqual(['shirt', 'shoes', 'top', 'mizuno', 'sony'])
    for (const query of ['SHIRT', 'shírts', ' shirt  ']) {
      const related = buildRelatedSearches(query)
      expect(related.map(termKey)).not.toContain('shirt')
      expect(related).toHaveLength(MAX_RELATED_SEARCHES)
    }
  })

  it('pone primero las marcas de los resultados y luego los términos de la categoría', () => {
    const products = withBrands('New Offers!!', 'Kawasaki', 'BWE', 'Samsung')
    // Samsung (3.ª marca) queda después de la categoría y ya no cabe
    expect(buildRelatedSearches('shirt', products)).toEqual(['Kawasaki', 'BWE', 'top', 'blouse', 'hoodie'])
  })

  it('descarta marcas basura o vacías ("New Offers!!", "  ")', () => {
    const related = buildRelatedSearches('shirt', withBrands('New Offers!!', '  ', 'Promo', 'Sin marca'))
    expect(related).toEqual(['top', 'blouse', 'hoodie', 'shorts', 'sweatshirt'])
  })

  it('no repite términos aunque vengan de fuentes distintas o con otra capitalización', () => {
    const related = buildRelatedSearches('shirt', withBrands('Kawasaki', 'KAWASAKI', 'kawasaki ', 'Top'))
    expect(related).toEqual(['Kawasaki', 'Top', 'blouse', 'hoodie', 'shorts'])
    expect(new Set(related.map(termKey)).size).toBe(related.length)
  })

  it('si la query no tiene categoría, la toma de los nombres de los productos', () => {
    const products = [makeProduct({ name: 'Classic Shoes', brand: 'Kawasaki' })]
    // la marca coincide con la query: no se sugiere; la categoría sale de "Classic Shoes"
    expect(buildRelatedSearches('kawasaki', products)).toEqual(['shoes', 'sneakers', 'boots', 'sandals', 'shirt'])
  })

  it('completa con búsquedas populares cuando faltan sugerencias', () => {
    const related = buildRelatedSearches('qwerty', [makeProduct({ name: 'Gadget X', brand: 'Mizuno' })])
    expect(related).toEqual(['Mizuno', 'shirt', 'shoes', 'top', 'samsung'])
  })

  it('respeta el máximo pedido', () => {
    expect(buildRelatedSearches('shirt', [], 3)).toEqual(['top', 'blouse', 'hoodie'])
    expect(buildRelatedSearches('shirt', [], 0)).toEqual([])
  })
})
