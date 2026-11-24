import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeProduct } from '../test/fixtures'
import { buildSearchUrl, searchProducts, SearchError } from './search'

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('buildSearchUrl', () => {
  it('usa /api/search con count=5 por defecto', () => {
    expect(buildSearchUrl('shirt')).toBe('/api/search?q=shirt&count=5')
  })

  it('codifica la query', () => {
    expect(buildSearchUrl('camisa & jean/azul ñ', 3)).toBe('/api/search?q=camisa%20%26%20jean%2Fazul%20%C3%B1&count=3')
  })
})

describe('searchProducts', () => {
  it('llama al endpoint con la URL esperada y devuelve el resultado tipado', async () => {
    const product = makeProduct()
    const fetchMock = stubFetch(async () => jsonResponse({ total: 12, products: [product] }))
    const controller = new AbortController()

    const result = await searchProducts('work shirt', { signal: controller.signal })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/search?q=work%20shirt&count=5')
    expect(init?.signal).toBe(controller.signal)
    expect(result).toEqual({ total: 12, products: [product] })
  })

  it('normaliza respuestas incompletas (products null, campos faltantes)', async () => {
    stubFetch(async () => jsonResponse({ total: 0, products: null }))
    await expect(searchProducts('x y')).resolves.toEqual({ total: 0, products: [] })

    stubFetch(async () => jsonResponse({ products: [{ id: '9', name: 'Solo nombre' }] }))
    await expect(searchProducts('x y')).resolves.toEqual({
      total: 1,
      products: [
        { id: '9', name: 'Solo nombre', link: '', image: '', description: '', brand: '', price: 0, listPrice: 0 },
      ],
    })
  })

  it('expone el mensaje {error} del backend con el status HTTP', async () => {
    stubFetch(async () => jsonResponse({ error: 'error consultando VTEX' }, 502))

    const err = await searchProducts('shirt').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(SearchError)
    expect((err as SearchError).message).toBe('error consultando VTEX')
    expect((err as SearchError).status).toBe(502)
  })

  it('usa un mensaje genérico si el error no trae JSON', async () => {
    stubFetch(async () => new Response('Bad Gateway', { status: 500 }))

    await expect(searchProducts('shirt')).rejects.toThrow(/No pudimos consultar los productos \(HTTP 500\)/)
  })

  it('traduce fallas de red a SearchError', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(searchProducts('shirt')).rejects.toBeInstanceOf(SearchError)
  })

  it('propaga el AbortError sin envolverlo', async () => {
    stubFetch(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError')
    })

    await expect(searchProducts('shirt')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
