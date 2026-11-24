import { describe, expect, it } from 'vitest'
import { makeProduct } from '../test/fixtures'
import { BRANDS, brandVideoEmbedUrl, findBrand, isUsefulBrand, matchBrand } from './brands'

const idOf = (text: string) => findBrand(text)?.id

describe('findBrand', () => {
  it.each([
    ['nike', 'nike'],
    ['Zapatillas NIKE', 'nike'],
    ['Níke air', 'nike'], // sin tildes
    ['adidas originals', 'adidas'],
    ['tenis-puma', 'puma'], // separadores que no son espacio
    ['samsung tv', 'samsung'],
    ['Galaxy S24', 'samsung'], // alias
    ['iPhone 15', 'apple'],
    ['SONY', 'sony'],
    ['lenovo thinkpad', 'lenovo'],
    ['motorola razr', 'motorola'],
  ])('"%s" -> %s', (text, expected) => {
    expect(idOf(text)).toBe(expected)
  })

  it.each(['pineapple', 'sonya', 'espuma', 'snikers', 'samsungs', 'pantalla', 'shirt', '', '   '])(
    'no confunde subcadenas con marcas: "%s"',
    (text) => {
      expect(findBrand(text)).toBeUndefined()
    },
  )

  it('acepta alias de varias palabras como frase completa', () => {
    const brands = [{ ...BRANDS[0], id: 'nb', aliases: ['New Balance'] }]
    expect(findBrand('tenis new balance 574', brands)?.id).toBe('nb')
    expect(findBrand('new tenis balance', brands)).toBeUndefined()
  })
})

describe('matchBrand', () => {
  const apple = makeProduct({ name: 'Vintage Phone 100%', brand: 'Apple' })
  const kawasaki = makeProduct({ name: 'Chair Bla', brand: 'Kawasaki' })
  const samsung = makeProduct({ name: 'Trendy Sweatshirt Pretty', brand: 'Samsung' })

  it('prioriza la marca nombrada en la query sobre la del primer resultado', () => {
    expect(matchBrand('nike', [apple])?.id).toBe('nike')
  })

  it('si la query no nombra marca, usa la marca del primer resultado', () => {
    expect(matchBrand('phone', [apple, samsung])?.id).toBe('apple')
  })

  it('solo mira el primer resultado', () => {
    expect(matchBrand('chair', [kawasaki, samsung])).toBeUndefined()
  })

  it('sin marca reconocida no hay video', () => {
    expect(matchBrand('shirt')).toBeUndefined()
    expect(matchBrand('shirt', [makeProduct({ brand: 'New Offers!!' })])).toBeUndefined()
  })
})

describe('isUsefulBrand', () => {
  it.each([
    ['Kawasaki', true],
    ['AOC', true],
    ['BWE', true],
    ['New Offers!!', false],
    ['Promo Navidad', false],
    ['Sin marca', false],
    ['', false],
    ['   ', false],
    ['123', false],
  ])('"%s" -> %s', (brand, expected) => {
    expect(isUsefulBrand(brand)).toBe(expected)
  })
})

describe('brandVideoEmbedUrl', () => {
  it('arma la URL sin cookies, silenciada, en bucle y con autoplay', () => {
    expect(brandVideoEmbedUrl('SmSovuG0kBw')).toBe(
      'https://www.youtube-nocookie.com/embed/SmSovuG0kBw?autoplay=1&mute=1&loop=1&playlist=SmSovuG0kBw&controls=0&playsinline=1&rel=0&modestbranding=1',
    )
  })

  it('sin autoplay (movimiento reducido) muestra controles para reproducir a mano', () => {
    const url = new URL(brandVideoEmbedUrl('SmSovuG0kBw', { autoplay: false }))
    expect(url.searchParams.get('autoplay')).toBe('0')
    expect(url.searchParams.get('controls')).toBe('1')
    expect(url.searchParams.get('mute')).toBe('1')
  })
})

describe('BRANDS', () => {
  it('incluye las marcas pedidas', () => {
    const ids = BRANDS.map((b) => b.id)
    expect(ids).toEqual(expect.arrayContaining(['nike', 'adidas', 'puma', 'samsung', 'apple', 'sony']))
  })

  it('tiene datos consistentes', () => {
    expect(new Set(BRANDS.map((b) => b.id)).size).toBe(BRANDS.length)
    expect(new Set(BRANDS.map((b) => b.youtubeId)).size).toBe(BRANDS.length)
    const aliases = BRANDS.flatMap((b) => b.aliases.map((a) => a.toLowerCase()))
    expect(new Set(aliases).size).toBe(aliases.length)

    for (const brand of BRANDS) {
      expect(brand.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/)
      expect(brand.channel).toMatch(/^https:\/\/www\.youtube\.com\/@\w+$/)
      expect(brand.tagline.trim()).not.toBe('')
      expect(brand.videoTitle.trim()).not.toBe('')
      // el propio nombre de la marca la encuentra
      expect(findBrand(brand.name)?.id).toBe(brand.id)
    }
  })
})
