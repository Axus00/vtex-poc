// Marcas reconocidas con video promocional para la publicidad del desplegable.
// Si la búsqueda (o la marca del primer resultado) nombra una de estas marcas, la publicidad
// muestra su video en lugar del anuncio de categoría de `buildAd`.
//
// Cada `youtubeId` sale del canal OFICIAL de la marca y se verificó con oEmbed
// (`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json`):
// HTTP 200 = existe y permite inserción, y `author_url` coincide con `channel`.
// Para agregar una marca, ver la sección "Publicidad con video de marca" del README.

import type { Product } from '../api/search'
import { foldText, tokenize } from './text'

export interface BrandTheme {
  /** Fondo de la tarjeta. */
  background: string
  /** Texto sobre el fondo. */
  text: string
  /** Fondo del botón (CTA). */
  accent: string
  /** Texto del botón (CTA). */
  accentText: string
}

export interface Brand {
  /** Identificador estable (minúsculas). */
  id: string
  /** Nombre visible ("Nike"). */
  name: string
  /** Palabras o frases que nombran la marca; se comparan por palabra completa, sin tildes ni mayúsculas. */
  aliases: readonly string[]
  /** ID del video de YouTube (11 caracteres) en el canal oficial. */
  youtubeId: string
  /** Título original del video en YouTube (accesibilidad y trazabilidad). */
  videoTitle: string
  /** Canal oficial donde está publicado el video (author_url de oEmbed). */
  channel: string
  /** Frase corta bajo el video. */
  tagline: string
  theme: BrandTheme
}

export const BRANDS: readonly Brand[] = [
  {
    id: 'nike',
    name: 'Nike',
    aliases: ['nike'],
    youtubeId: 'SmSovuG0kBw',
    videoTitle: 'What If? | Nike',
    channel: 'https://www.youtube.com/@nike',
    tagline: 'Just Do It: equípate para tu próximo reto.',
    theme: { background: '#111111', text: '#ffffff', accent: '#ffffff', accentText: '#111111' },
  },
  {
    id: 'adidas',
    name: 'Adidas',
    aliases: ['adidas'],
    youtubeId: 'FzaS0V_FCrI',
    videoTitle: 'You Got This | adidas',
    channel: 'https://www.youtube.com/@adidas',
    tagline: 'Impossible is Nothing: lo mejor para tu deporte.',
    theme: { background: '#000000', text: '#ffffff', accent: '#ffffff', accentText: '#000000' },
  },
  {
    id: 'puma',
    name: 'Puma',
    aliases: ['puma'],
    youtubeId: 'J4HuXzxaBIY',
    videoTitle: "Live Life, Don't Watch It - a PUMA film",
    channel: 'https://www.youtube.com/@PUMA',
    tagline: 'Forever Faster: estilo y velocidad para cada día.',
    theme: { background: '#1d1d1d', text: '#ffffff', accent: '#e4002b', accentText: '#ffffff' },
  },
  {
    id: 'samsung',
    name: 'Samsung',
    aliases: ['samsung', 'galaxy'],
    youtubeId: '2gYqEi8-am4',
    videoTitle: 'Introducing Galaxy S26 Ultra | Galaxy AI | Samsung',
    channel: 'https://www.youtube.com/@Samsung',
    tagline: 'Conoce el nuevo Galaxy S26 Ultra con Galaxy AI.',
    theme: { background: '#1428a0', text: '#ffffff', accent: '#ffffff', accentText: '#1428a0' },
  },
  {
    id: 'apple',
    name: 'Apple',
    aliases: ['apple', 'iphone', 'ipad', 'macbook', 'airpods'],
    youtubeId: 'Sp54mxnWjUM',
    videoTitle: '“The Dreamer”: An Apple Holiday Film featuring MacBook Neo',
    channel: 'https://www.youtube.com/@Apple',
    tagline: 'Descubre lo nuevo de Apple para esta temporada.',
    theme: { background: '#f5f5f7', text: '#1d1d1f', accent: '#0071e3', accentText: '#ffffff' },
  },
  {
    id: 'sony',
    name: 'Sony',
    aliases: ['sony', 'playstation', 'bravia'],
    youtubeId: 'VJX_aHCiOEk',
    videoTitle: 'Sony’s Branded Sizzle Reel 2026 | Sony Official',
    channel: 'https://www.youtube.com/@Sony',
    tagline: 'Tecnología y entretenimiento que te emocionan.',
    theme: { background: '#000000', text: '#ffffff', accent: '#ffffff', accentText: '#000000' },
  },
  {
    id: 'lenovo',
    name: 'Lenovo',
    aliases: ['lenovo', 'thinkpad', 'thinkbook', 'ideapad'],
    youtubeId: 'rT1R2ux0xxQ',
    videoTitle: 'Meet Lenovo ThinkBook 14x (2026) | Ultra-Thin. Built for Learning.',
    channel: 'https://www.youtube.com/@Lenovo',
    tagline: 'Portátiles livianos para estudiar y trabajar.',
    theme: { background: '#e2231a', text: '#ffffff', accent: '#ffffff', accentText: '#c8102e' },
  },
  {
    id: 'motorola',
    name: 'Motorola',
    aliases: ['motorola', 'razr'],
    youtubeId: 'SVRSG_Yx1MQ',
    videoTitle: 'Say hello to the new motorola razr - 2025',
    channel: 'https://www.youtube.com/@MotorolaUS',
    tagline: 'El nuevo motorola razr: plegable e icónico.',
    theme: { background: '#001428', text: '#ffffff', accent: '#5c92fa', accentText: '#001428' },
  },
]

// Marcas "basura" del catálogo demo (p. ej. "New Offers!!") que no son una marca real.
const JUNK_BRAND = /\b(offers?|ofertas?|promo(cion|tion)?s?|sale|descuentos?|generic[oa]?|default|test|teste|sin marca|no brand)\b/

/**
 * ¿La marca de un producto sirve para mostrarla o sugerirla como búsqueda?
 * Descarta vacías, promocionales ("New Offers!!") o con signos raros.
 */
export function isUsefulBrand(brand: string): boolean {
  const clean = brand.trim()
  if (clean.length < 2 || clean.length > 30) return false
  if (!/[a-z]/.test(foldText(clean))) return false
  if (/[!?*#@$%]/.test(clean)) return false
  return !JUNK_BRAND.test(foldText(clean))
}

/** ¿`tokens` contiene la secuencia `alias` como palabras completas y contiguas? */
function containsPhrase(tokens: readonly string[], alias: readonly string[]): boolean {
  if (alias.length === 0 || alias.length > tokens.length) return false
  for (let start = 0; start + alias.length <= tokens.length; start++) {
    if (alias.every((word, i) => tokens[start + i] === word)) return true
  }
  return false
}

/**
 * Marca nombrada en el texto, comparando palabras completas (sin tildes ni mayúsculas):
 * "zapatillas NIKE" -> Nike, pero "pineapple" no es Apple ni "sonya" es Sony.
 */
export function findBrand(text: string, brands: readonly Brand[] = BRANDS): Brand | undefined {
  const tokens = tokenize(text)
  if (tokens.length === 0) return undefined
  return brands.find((brand) => brand.aliases.some((alias) => containsPhrase(tokens, tokenize(alias))))
}

/**
 * Marca para la publicidad: primero la que nombra la query; si la query no nombra ninguna,
 * la marca del primer resultado (p. ej. "phone" -> producto de Apple -> video de Apple).
 */
export function matchBrand(
  query: string,
  products: readonly Product[] = [],
  brands: readonly Brand[] = BRANDS,
): Brand | undefined {
  const fromQuery = findBrand(query, brands)
  if (fromQuery) return fromQuery
  const topBrand = products[0]?.brand
  return topBrand ? findBrand(topBrand, brands) : undefined
}

export interface EmbedOptions {
  /** false si el usuario prefiere menos movimiento: sin autoplay y con controles para reproducir. */
  autoplay?: boolean
}

/** URL de inserción sin cookies de YouTube: silenciado, en bucle y sin videos relacionados. */
export function brandVideoEmbedUrl(youtubeId: string, { autoplay = true }: EmbedOptions = {}): string {
  const id = encodeURIComponent(youtubeId)
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: '1',
    loop: '1',
    playlist: youtubeId, // necesario para que loop funcione con un solo video
    controls: autoplay ? '0' : '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}
