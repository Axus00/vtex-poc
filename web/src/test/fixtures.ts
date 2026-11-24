import type { Product, SearchResult } from '../api/search'

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Work Shirt',
    link: '/working-shirt/p',
    image: 'https://storecomponents.vtexassets.com/arquivos/ids/155580/work-shirt_verde.jpg',
    description: 'Wanna look awesome at your work place?',
    brand: 'New Offers!!',
    price: 45,
    listPrice: 60,
    ...overrides,
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function resultOf(products: Product[], total = products.length): SearchResult {
  return { total, products }
}

/** Promesa controlable desde el test (para simular respuestas lentas o fuera de orden). */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
