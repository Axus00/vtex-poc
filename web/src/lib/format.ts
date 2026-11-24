// Utilidades de presentación: texto plano, precios y descuentos.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/**
 * Convierte HTML (o texto plano) en una sola línea de texto plano:
 * elimina <script>/<style> con su contenido, quita etiquetas, decodifica entidades
 * comunes y colapsa espacios. React escapa el resultado al renderizar.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return ''
  const withoutBlocks = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
  const withoutTags = withoutBlocks.replace(/<\/?[a-z!][^>]*>/gi, ' ')
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim()
}

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/** Formatea un precio en pesos colombianos sin decimales, p. ej. "$ 45.000". */
export function formatPrice(value: number): string {
  return copFormatter.format(value)
}

/** Hay precio mostrable (VTEX usa 0 cuando el producto no está disponible). */
export function hasPrice(price: number): boolean {
  return Number.isFinite(price) && price > 0
}

/** Hay rebaja real: el precio de lista es mayor que el de venta. */
export function hasDiscount(price: number, listPrice: number): boolean {
  return hasPrice(price) && Number.isFinite(listPrice) && listPrice > price
}

/** Porcentaje de descuento redondeado (0 si no hay rebaja). */
export function discountPercent(price: number, listPrice: number): number {
  if (!hasDiscount(price, listPrice)) return 0
  return Math.round((1 - price / listPrice) * 100)
}
