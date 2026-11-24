import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { deferred, jsonResponse, makeProduct } from '../test/fixtures'
import { useProductSearch } from './useProductSearch'

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit]

function stubFetch(impl: (...args: FetchArgs) => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('useProductSearch', () => {
  it('no busca con menos de 2 caracteres', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 0, products: [] }))

    const { result } = renderHook(() => useProductSearch(' s ', { debounceMs: 0 }))

    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.state.status).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aplica debounce: solo busca la última query tras la pausa', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = stubFetch(async () => jsonResponse({ total: 1, products: [makeProduct()] }))
      const { rerender } = renderHook(({ q }) => useProductSearch(q), { initialProps: { q: 'sh' } })

      rerender({ q: 'shi' })
      rerender({ q: 'shirt' })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(299)
      })
      expect(fetchMock).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/search?q=shirt&count=5')
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborta la petición anterior e ignora respuestas fuera de orden', async () => {
    const slow = deferred<Response>()
    const fast = deferred<Response>()
    const signals: AbortSignal[] = []
    const fetchMock = stubFetch((_input, init) => {
      signals.push(init!.signal!)
      return signals.length === 1 ? slow.promise : fast.promise
    })

    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, { debounceMs: 0 }), {
      initialProps: { q: 'shirt' },
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    rerender({ q: 'shoes' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)

    // llega primero la respuesta nueva y después la vieja: la vieja se descarta
    await act(async () => {
      fast.resolve(jsonResponse({ total: 1, products: [makeProduct({ id: 'shoe', name: 'Running Shoes' })] }))
    })
    await act(async () => {
      slow.resolve(jsonResponse({ total: 1, products: [makeProduct({ id: 'shirt', name: 'Work Shirt' })] }))
    })

    await waitFor(() => expect(result.current.state.status).toBe('success'))
    const { state } = result.current
    expect(state.status === 'success' && state.query).toBe('shoes')
    expect(state.status === 'success' && state.result.products[0].name).toBe('Running Shoes')
  })

  it('searchNow busca de inmediato sin esperar el debounce', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 0, products: [] }))
    const { result } = renderHook(() => useProductSearch('shirt', { debounceMs: 10_000 }))

    expect(result.current.state.status).toBe('loading')
    act(() => result.current.searchNow())

    await waitFor(() => expect(result.current.state.status).toBe('success'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('searchTerm busca otro término de inmediato y no lo repite cuando el input se actualiza', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 0, products: [] }))
    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, { debounceMs: 10_000 }), {
      initialProps: { q: 'shirt' },
    })

    act(() => result.current.searchTerm('  shoes '))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/search?q=shoes&count=5')

    // quien llama pone el mismo término en el input: no se programa otra búsqueda
    rerender({ q: 'shoes' })
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    const { state } = result.current
    expect(state.status === 'success' && state.query).toBe('shoes')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('searchTerm ignora términos demasiado cortos', () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 0, products: [] }))
    const { result } = renderHook(() => useProductSearch('', { debounceMs: 0 }))

    act(() => result.current.searchTerm(' s '))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe('idle')
  })

  it('expone el mensaje de error del backend', async () => {
    stubFetch(async () => jsonResponse({ error: 'error consultando VTEX' }, 502))
    const { result } = renderHook(() => useProductSearch('shirt', { debounceMs: 0 }))

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    const { state } = result.current
    expect(state.status === 'error' && state.error).toBe('error consultando VTEX')
  })
})
