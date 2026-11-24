import { describe, expect, it } from 'vitest'
import { discountPercent, formatPrice, hasDiscount, hasPrice, stripHtml } from './format'

// Intl usa espacios duros (U+00A0 / U+202F) entre símbolo y número
const normalizeSpaces = (s: string) => s.replace(/[  ]/g, ' ')

describe('stripHtml', () => {
  it('deja intacto el texto plano', () => {
    expect(stripHtml('Colorful star on a tank top')).toBe('Colorful star on a tank top')
  })

  it('quita etiquetas y colapsa espacios', () => {
    expect(stripHtml('<p>Camisa <strong>100%</strong> algodón</p>\n<ul><li>Talla M</li></ul>')).toBe(
      'Camisa 100% algodón Talla M',
    )
  })

  it('separa palabras unidas por <br>', () => {
    expect(stripHtml('Línea uno<br/>Línea dos')).toBe('Línea uno Línea dos')
  })

  it('elimina script y style con su contenido', () => {
    expect(stripHtml('<style>.x{color:red}</style>Hola<script>alert(1)</script> mundo')).toBe('Hola mundo')
  })

  it('decodifica entidades comunes', () => {
    expect(stripHtml('Tom &amp; Jerry&nbsp;&lt;3 &quot;ok&quot; &#39;si&#39; &#x2665;')).toBe(
      'Tom & Jerry <3 "ok" \'si\' ♥',
    )
  })

  it('devuelve "" para vacío, null o undefined', () => {
    expect(stripHtml('')).toBe('')
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(undefined)).toBe('')
    expect(stripHtml('<p>   </p>')).toBe('')
  })
})

describe('formatPrice', () => {
  it('formatea en pesos colombianos sin decimales', () => {
    expect(normalizeSpaces(formatPrice(1234567))).toBe('$ 1.234.567')
  })

  it('redondea los decimales', () => {
    expect(normalizeSpaces(formatPrice(30.99))).toBe('$ 31')
  })
})

describe('hasPrice / hasDiscount / discountPercent', () => {
  it('hasPrice es falso para 0 o valores no finitos', () => {
    expect(hasPrice(45)).toBe(true)
    expect(hasPrice(0)).toBe(false)
    expect(hasPrice(Number.NaN)).toBe(false)
  })

  it('calcula el porcentaje redondeado cuando el precio de lista es mayor', () => {
    expect(hasDiscount(45, 60)).toBe(true)
    expect(discountPercent(45, 60)).toBe(25)
    expect(discountPercent(66.6, 100)).toBe(33)
  })

  it('devuelve 0 sin rebaja real', () => {
    expect(discountPercent(45, 45)).toBe(0)
    expect(discountPercent(60, 45)).toBe(0)
    expect(discountPercent(0, 100)).toBe(0)
    expect(hasDiscount(45, 45)).toBe(false)
  })
})
