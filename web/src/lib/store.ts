// Enlaces hacia la tienda VTEX de demostración que respalda la API de Go.

export const STORE_BASE_URL = 'https://storecomponents.vtexcommercestable.com.br'

/** URL absoluta de la página de producto a partir del `link` relativo de VTEX. */
export function productUrl(link: string): string {
  if (/^https?:\/\//i.test(link)) return link
  if (!link) return STORE_BASE_URL
  return STORE_BASE_URL + (link.startsWith('/') ? link : `/${link}`)
}

/** URL de búsqueda full-text de la tienda (patrón de VTEX IO: /<término>?_q=<término>&map=ft). */
export function storeSearchUrl(query: string): string {
  const term = encodeURIComponent(query.trim())
  return `${STORE_BASE_URL}/${term}?_q=${term}&map=ft`
}
