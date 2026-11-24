import { describe, expect, it } from 'vitest'
import { foldText, termKey, tokenize } from './text'

describe('text', () => {
  it('foldText quita tildes y pasa a minúsculas', () => {
    expect(foldText('Cámara ÑANDÚ')).toBe('camara nandu')
  })

  it('tokenize separa por cualquier signo', () => {
    expect(tokenize('  Zapatos-NIKE, talla 42! ')).toEqual(['zapatos', 'nike', 'talla', '42'])
    expect(tokenize('!!')).toEqual([])
  })

  it('termKey iguala mayúsculas, tildes, espacios y plural simple', () => {
    expect(termKey(' Camisas  ')).toBe(termKey('camisa'))
    expect(termKey('SHOES')).toBe(termKey('shoe'))
    expect(termKey('dress')).toBe('dress')
    expect(termKey('tv')).toBe('tv')
    expect(termKey('New Offers!!')).toBe('new offer')
  })
})
