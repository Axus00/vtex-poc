import { describe, expect, it } from 'vitest'
import { makeProduct } from '../test/fixtures'
import { buildAd, categorySearches, detectCategory } from './ad'
import { STORE_BASE_URL } from './store'

describe('detectCategory', () => {
  it.each([
    ['shirt', 'moda'],
    ['Camisas de lino', 'moda'],
    ['tank top', 'moda'],
    ['shoes', 'calzado'],
    ['Zapatos negros', 'calzado'],
    ['tenis running', 'calzado'], // gana la primera regla (calzado antes que deportes)
    ['Televisor 55"', 'tecnologia'],
    ['TV', 'tecnologia'],
    ['cámara', 'tecnologia'], // "camara" no debe caer en hogar por el prefijo "cama"
    ['sofá cama', 'hogar'],
    ['kitchen', 'hogar'],
    ['bicicleta', 'deportes'],
    ['qwerty', 'generico'],
  ] as const)('"%s" -> %s', (query, expected) => {
    expect(detectCategory(query)).toBe(expected)
  })

  it('no confunde palabras cortas con prefijos (top != topografía)', () => {
    expect(detectCategory('topografía')).toBe('generico')
  })

  it('si la query no coincide, usa el nombre de los productos devueltos', () => {
    const products = [makeProduct({ name: 'Top Star Color Shirt', brand: 'Kawasaki' })]
    expect(detectCategory('kawasaki', products)).toBe('moda')
  })
})

describe('buildAd', () => {
  it('arma un anuncio de la categoría mencionando la query', () => {
    const ad = buildAd('shirt', [makeProduct({ brand: 'Kawasaki', image: 'https://img/1.jpg' })])

    expect(ad).toEqual({
      label: 'Moda',
      title: 'Hasta 40% dto. en Shirt',
      subtitle: 'Lo mejor de Kawasaki y más marcas en Moda.',
      cta: 'Ver ofertas',
      image: 'https://img/1.jpg',
      href: `${STORE_BASE_URL}/shirt?_q=shirt&map=ft`,
      theme: 'moda',
    })
  })

  it('usa temas distintos por categoría', () => {
    const themes = ['shirt', 'shoes', 'laptop', 'lamp', 'yoga', 'zzz'].map((q) => buildAd(q).theme)
    expect(new Set(themes).size).toBe(themes.length)
  })

  it('sin productos usa el tagline de la categoría y no trae imagen', () => {
    const ad = buildAd('zapatos')
    expect(ad.theme).toBe('calzado')
    expect(ad.title).toBe('Hasta 30% dto. en Zapatos')
    expect(ad.subtitle).toBe('Pisa fuerte con los estilos de la temporada.')
    expect(ad.image).toBeUndefined()
  })

  it('toma la primera imagen y la primera marca no vacías', () => {
    const ad = buildAd('shirt', [
      makeProduct({ id: 'a', image: '', brand: '  ' }),
      makeProduct({ id: 'b', image: 'https://img/b.jpg', brand: 'Marca B' }),
    ])
    expect(ad.image).toBe('https://img/b.jpg')
    expect(ad.subtitle).toContain('Marca B')
  })

  it('cae en un anuncio genérico cuando no reconoce la búsqueda', () => {
    const ad = buildAd('  qwerty  ')
    expect(ad.theme).toBe('generico')
    expect(ad.label).toBe('Ofertas')
    expect(ad.title).toBe('Ofertas imperdibles en Qwerty')
    expect(ad.cta).toBe('Ver ofertas')
    expect(ad.href).toBe(`${STORE_BASE_URL}/qwerty?_q=qwerty&map=ft`)
  })

  it('no menciona marcas basura del catálogo ("New Offers!!")', () => {
    const ad = buildAd('shirt', [makeProduct({ id: 'a', brand: 'New Offers!!' }), makeProduct({ id: 'b', brand: 'Kawasaki' })])
    expect(ad.subtitle).toBe('Lo mejor de Kawasaki y más marcas en Moda.')
    expect(buildAd('shirt', [makeProduct({ brand: 'New Offers!!' })]).subtitle).toBe(
      'Renueva tu clóset con las últimas tendencias.',
    )
  })

  it('recorta queries muy largas y codifica el href', () => {
    const query = 'camisa de lino manga larga para hombre talla m'
    const ad = buildAd(query)
    expect(ad.title.length).toBeLessThan(`Hasta 40% dto. en ${query}`.length)
    expect(ad.title.endsWith('…')).toBe(true)
    expect(ad.href).toContain(encodeURIComponent(query))
  })
})

describe('categorySearches', () => {
  it('devuelve las búsquedas sugeridas de la categoría de la query', () => {
    expect(categorySearches('camisas')).toEqual(['shirt', 'top', 'blouse', 'hoodie', 'shorts', 'sweatshirt'])
    expect(categorySearches('televisor')[0]).toBe('tv')
  })

  it('usa los productos si la query no tiene categoría, y vacío si nada coincide', () => {
    expect(categorySearches('mizuno', [makeProduct({ name: 'Classic Shoes' })])[0]).toBe('shoes')
    expect(categorySearches('qwerty')).toEqual([])
  })
})
