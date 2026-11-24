// Construcción del anuncio contextual que acompaña los resultados de búsqueda.
// Es una función pura: misma query + productos => mismo anuncio (fácil de testear).

import type { Product } from '../api/search'
import { isUsefulBrand } from './brands'
import { storeSearchUrl } from './store'
import { tokenize } from './text'

export type AdTheme = 'moda' | 'calzado' | 'tecnologia' | 'hogar' | 'deportes' | 'generico'

export interface Ad {
  /** Categoría visible en el anuncio (p. ej. "Moda"). */
  label: string
  title: string
  subtitle: string
  cta: string
  /** Imagen del producto más relevante, si existe. */
  image?: string
  href: string
  theme: AdTheme
}

interface CategoryRule {
  theme: Exclude<AdTheme, 'generico'>
  label: string
  discount: number
  tagline: string
  /** Palabras clave normalizadas (minúsculas, sin tildes), en inglés y español. */
  keywords: string[]
  /**
   * Búsquedas sugeridas para la categoría ("Búsquedas relacionadas"), de la más a la menos útil.
   * Van en inglés porque así está el catálogo demo de VTEX; primero las que sí traen resultados.
   */
  searches: string[]
}

// El orden importa: gana la primera regla que coincida.
const RULES: CategoryRule[] = [
  {
    theme: 'calzado',
    label: 'Calzado',
    discount: 30,
    tagline: 'Pisa fuerte con los estilos de la temporada.',
    searches: ['shoes', 'sneakers', 'boots', 'sandals'],
    keywords: [
      'shoe', 'zapato', 'zapatilla', 'sneaker', 'tenis', 'bota', 'boot', 'sandal', 'sandalia',
      'calzado', 'heel', 'tacon', 'mocasin', 'loafer', 'chancla', 'slipper',
    ],
  },
  {
    theme: 'moda',
    label: 'Moda',
    discount: 40,
    tagline: 'Renueva tu clóset con las últimas tendencias.',
    searches: ['shirt', 'top', 'blouse', 'hoodie', 'shorts', 'sweatshirt'],
    keywords: [
      'shirt', 'camisa', 'camiseta', 'top', 'dress', 'vestido', 'ropa', 'blusa', 'jean', 'pantalon',
      'pant', 'short', 'falda', 'skirt', 'chaqueta', 'jacket', 'hoodie', 'buzo', 'sweater', 'sueter',
      'polo', 'tank', 'moda', 'clothing', 'abrigo', 'coat', 'blouse', 'legging',
    ],
  },
  {
    theme: 'tecnologia',
    label: 'Tecnología',
    discount: 25,
    tagline: 'Lleva la última tecnología a tu casa.',
    searches: ['tv', 'phone', 'camera', 'notebook', 'watch'],
    keywords: [
      'tv', 'televisor', 'television', 'phone', 'celular', 'smartphone', 'iphone', 'laptop', 'portatil',
      'computador', 'computer', 'tablet', 'audifono', 'headphone', 'camara', 'camera', 'consola',
      'console', 'monitor', 'tecnologia', 'smartwatch', 'speaker', 'parlante', 'notebook',
    ],
  },
  {
    theme: 'hogar',
    label: 'Hogar',
    discount: 35,
    tagline: 'Todo para hacer de tu casa tu lugar favorito.',
    searches: ['home', 'chair', 'clock', 'kitchen'],
    keywords: [
      'hogar', 'home', 'sofa', 'mesa', 'table', 'silla', 'chair', 'cama', 'bed', 'colchon', 'cocina',
      'kitchen', 'lampara', 'lamp', 'decoracion', 'decor', 'olla', 'sarten', 'nevera', 'sabana',
      'toalla', 'cojin', 'pillow', 'mueble', 'furniture',
    ],
  },
  {
    theme: 'deportes',
    label: 'Deportes',
    discount: 20,
    tagline: 'Equípate para superar tus metas.',
    searches: ['ball', 'bike', 'yoga', 'fitness'],
    keywords: [
      'bike', 'bicicleta', 'bici', 'ball', 'balon', 'gym', 'yoga', 'deporte', 'sport', 'fitness',
      'running', 'raqueta', 'racket', 'pesa', 'dumbbell', 'bodyboard', 'surf',
    ],
  },
]

const GENERIC_TAGLINE = 'Descubre miles de productos con precios especiales.'
const MAX_QUERY_LENGTH = 28

function tokenMatches(token: string, keyword: string): boolean {
  if (token === keyword) return true
  // palabras cortas ("tv", "top") solo aceptan plural; las largas aceptan prefijo ("camisas", "zapatos")
  if (keyword.length <= 3) return token === `${keyword}s` || token === `${keyword}es`
  return token.startsWith(keyword)
}

function findRule(text: string): CategoryRule | undefined {
  const tokens = tokenize(text)
  if (tokens.length === 0) return undefined
  return RULES.find((rule) => rule.keywords.some((kw) => tokens.some((token) => tokenMatches(token, kw))))
}

/** Detecta la categoría de la query; si no hay match, usa los nombres de los productos devueltos. */
export function detectCategory(query: string, products: readonly Product[] = []): AdTheme {
  return resolveRule(query, products)?.theme ?? 'generico'
}

function resolveRule(query: string, products: readonly Product[]): CategoryRule | undefined {
  return findRule(query) ?? products.slice(0, 3).map((p) => findRule(p.name)).find(Boolean)
}

/** Búsquedas sugeridas de la categoría detectada (misma regla que el anuncio); vacío si no hay categoría. */
export function categorySearches(query: string, products: readonly Product[] = []): readonly string[] {
  return resolveRule(query, products)?.searches ?? []
}

/** "camisa de lino" -> "Camisa de lino" (recortada si es muy larga). */
function displayQuery(query: string): string {
  const clean = query.trim().replace(/\s+/g, ' ')
  const short = clean.length > MAX_QUERY_LENGTH ? `${clean.slice(0, MAX_QUERY_LENGTH - 1).trimEnd()}…` : clean
  return short.charAt(0).toLocaleUpperCase('es-CO') + short.slice(1)
}

export function buildAd(query: string, products: readonly Product[] = []): Ad {
  const rule = resolveRule(query, products)
  const shownQuery = displayQuery(query)
  // primera marca real (sin "New Offers!!" ni similares)
  const topBrand = products.map((p) => p.brand.trim()).find(isUsefulBrand)
  const image = products.find((p) => p.image)?.image

  if (!rule) {
    return {
      label: 'Ofertas',
      title: shownQuery ? `Ofertas imperdibles en ${shownQuery}` : 'Ofertas de la semana',
      subtitle: topBrand ? `Lo mejor de ${topBrand} y más marcas, por tiempo limitado.` : GENERIC_TAGLINE,
      cta: 'Ver ofertas',
      image,
      href: storeSearchUrl(query),
      theme: 'generico',
    }
  }

  return {
    label: rule.label,
    title: `Hasta ${rule.discount}% dto. en ${shownQuery || rule.label}`,
    subtitle: topBrand ? `Lo mejor de ${topBrand} y más marcas en ${rule.label}.` : rule.tagline,
    cta: 'Ver ofertas',
    image,
    href: storeSearchUrl(query),
    theme: rule.theme,
  }
}
