// Cliente tipado del endpoint Go GET /search (expuesto por el proxy de Vite en /api).

/** Producto tal como lo serializa search.Product en Go. */
export interface Product {
  id: string
  name: string
  /** Ruta relativa en la tienda VTEX, p. ej. "/working-shirt/p". */
  link: string
  /** URL absoluta de la imagen principal, o "" si el producto no tiene imágenes. */
  image: string
  /** Texto plano; en algunos productos puede venir con HTML. */
  description: string
  brand: string
  /** sellingPrice.lowPrice */
  price: number
  /** listPrice.lowPrice */
  listPrice: number
}

/** Respuesta de search.Result en Go. */
export interface SearchResult {
  total: number
  products: Product[]
}

export const SEARCH_ENDPOINT = '/api/search'
export const DEFAULT_COUNT = 5

/** Error de búsqueda con un mensaje listo para mostrar al usuario. */
export class SearchError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'SearchError'
    this.status = status
  }
}

export function buildSearchUrl(query: string, count: number = DEFAULT_COUNT): string {
  return `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`
}

export interface SearchOptions {
  signal?: AbortSignal
  count?: number
}

/**
 * Consulta productos en la API de Go.
 * - Si la respuesta no es 2xx, lanza SearchError con el `{error}` del backend o un mensaje genérico.
 * - Si la petición se aborta, propaga el AbortError original (quien llama decide ignorarlo).
 */
export async function searchProducts(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { signal, count = DEFAULT_COUNT } = options

  let response: Response
  try {
    response = await fetch(buildSearchUrl(query, count), {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new SearchError('No pudimos conectar con el servidor de búsqueda. Revisa tu conexión e inténtalo de nuevo.')
  }

  if (!response.ok) {
    const backendMessage = await readErrorMessage(response)
    throw new SearchError(
      backendMessage ?? `No pudimos consultar los productos (HTTP ${response.status}). Inténtalo de nuevo en unos segundos.`,
      response.status,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new SearchError('La respuesta del servidor de búsqueda no es válida.', response.status)
  }
  return normalizeResult(body)
}

export function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'AbortError'
  )
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const data: unknown = await response.json()
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const message = (data as { error: unknown }).error
      if (typeof message === 'string' && message.trim() !== '') return message
    }
  } catch {
    // cuerpo vacío o no-JSON (p. ej. el proxy de Vite sin backend): usamos el genérico
  }
  return null
}

// Defensivo: Go siempre envía todos los campos, pero no confiamos ciegamente en la red.
function normalizeResult(body: unknown): SearchResult {
  const data = (typeof body === 'object' && body !== null ? body : {}) as Partial<{
    total: unknown
    products: unknown
  }>
  const rawProducts = Array.isArray(data.products) ? data.products : []
  const products = rawProducts.map(normalizeProduct)
  const total = typeof data.total === 'number' ? data.total : products.length
  return { total, products }
}

function normalizeProduct(raw: unknown): Product {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    id: str(p.id),
    name: str(p.name),
    link: str(p.link),
    image: str(p.image),
    description: str(p.description),
    brand: str(p.brand),
    price: num(p.price),
    listPrice: num(p.listPrice),
  }
}
