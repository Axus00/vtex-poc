import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BRANDS } from '../lib/brands'
import { STORE_BASE_URL } from '../lib/store'
import { deferred, jsonResponse, makeProduct } from '../test/fixtures'
import { SearchBox } from './SearchBox'

function stubFetch(impl: (input: RequestInfo | URL) => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setup() {
  const user = userEvent.setup()
  render(
    <>
      <SearchBox debounceMs={20} />
      <button type="button">fuera</button>
    </>,
  )
  return { user, input: screen.getByRole('searchbox', { name: 'Buscar productos' }) }
}

/** URL esperada del video de la marca (youtube-nocookie, silenciado, en bucle, con autoplay). */
function brandVideoSrc(brandId: string) {
  const id = BRANDS.find((b) => b.id === brandId)!.youtubeId
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&modestbranding=1`
}

const relatedTerms = () =>
  within(screen.getByRole('navigation', { name: 'Búsquedas relacionadas' }))
    .getAllByRole('button')
    .map((button) => button.textContent)

/** Párrafo del estado vacío (sus chips repiten algunos términos de las búsquedas relacionadas). */
const emptyStateHint = () => screen.getByText(/El catálogo de demostración está en inglés/)

const products = [
  makeProduct({
    id: '1',
    name: 'Work Shirt',
    description: '<p>Wanna look <b>awesome</b> at work?</p>',
    brand: 'New Offers!!',
    image: 'https://storecomponents.vtexassets.com/arquivos/ids/155580/work-shirt.jpg',
    link: '/working-shirt/p',
    price: 45,
    listPrice: 60,
  }),
  makeProduct({
    id: '2',
    name: 'Top Star Color Shirt',
    description: 'Colorful star on a tank top',
    brand: 'Kawasaki',
    image: '',
    link: '/star-color-top/p',
    price: 30.99,
    listPrice: 30.99,
  }),
]

describe('SearchBox', () => {
  it('al escribir muestra tarjetas de producto, búsquedas relacionadas y la publicidad', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 8, products }))
    const { user, input } = setup()

    await user.type(input, 'shirt')

    const panel = await screen.findByRole('region', { name: 'Resultados de búsqueda' })
    expect(within(panel).getByRole('heading', { name: 'Productos para “shirt”' })).toBeInTheDocument()

    // tarjeta 1: imagen VTEX, nombre, descripción sin HTML, marca, precios y descuento
    const img = await within(panel).findByRole('img', { name: 'Work Shirt' })
    expect(img).toHaveAttribute('src', products[0].image)
    expect(img).toHaveAttribute('loading', 'lazy')
    const card = img.closest('a')!
    expect(card).toHaveAttribute('href', `${STORE_BASE_URL}/working-shirt/p`)
    expect(card).toHaveAttribute('target', '_blank')
    expect(card).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(card).getByText('Work Shirt')).toBeInTheDocument()
    expect(within(card).getByText('Wanna look awesome at work?')).toBeInTheDocument()
    expect(within(card).getByText('New Offers!!')).toBeInTheDocument()
    expect(within(card).getByText('-25%')).toBeInTheDocument()

    // tarjeta 2: sin imagen -> placeholder accesible y sin descuento
    expect(within(panel).getByRole('img', { name: 'Top Star Color Shirt (sin imagen)' })).toBeInTheDocument()
    expect(within(panel).getByText('Colorful star on a tank top')).toBeInTheDocument()
    expect(within(panel).getAllByText(/^-\d+%$/)).toHaveLength(1)

    expect(within(panel).getByRole('link', { name: 'Ver todos los resultados (8)' })).toBeInTheDocument()

    // publicidad en la columna derecha, relacionada con la búsqueda
    const ad = within(panel).getByRole('complementary', { name: 'Publicidad' })
    expect(within(ad).getByText('Publicidad')).toBeInTheDocument()
    expect(within(ad).getByText('Hasta 40% dto. en Shirt')).toBeInTheDocument()
    expect(within(ad).getByText('Moda')).toBeInTheDocument()
    expect(within(ad).getByRole('link', { name: /Ver ofertas/ })).toHaveAttribute('rel', 'noopener noreferrer sponsored')
    // sin marca reconocida ("New Offers!!", "Kawasaki") no hay video
    expect(panel.querySelector('iframe')).toBeNull()

    // búsquedas relacionadas: marcas útiles de los resultados + términos de la categoría, sin la query
    expect(relatedTerms()).toEqual(['Kawasaki', 'top', 'blouse', 'hoodie', 'shorts'])

    expect(fetchMock).toHaveBeenLastCalledWith('/api/search?q=shirt&count=5', expect.anything())
    expect(screen.getByRole('status')).toHaveTextContent('8 productos encontrados para “shirt”.')
  })

  it('muestra el estado vacío con sugerencias', async () => {
    stubFetch(async () => jsonResponse({ total: 0, products: [] }))
    const { user, input } = setup()

    await user.type(input, 'camisa')

    expect(await screen.findByText('No encontramos productos para “camisa”')).toBeInTheDocument()
    expect(within(emptyStateHint()).getByRole('button', { name: 'shirt' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument()
    // también se muestran búsquedas relacionadas (de la categoría de la query)
    expect(relatedTerms()).toEqual(['shirt', 'top', 'blouse', 'hoodie', 'shorts'])
  })

  it('una sugerencia del estado vacío lanza esa búsqueda', async () => {
    const fetchMock = stubFetch(async (input) =>
      String(input).includes('q=shoes')
        ? jsonResponse({ total: 1, products: [makeProduct({ id: 's', name: 'Running Shoes' })] })
        : jsonResponse({ total: 0, products: [] }),
    )
    const { user, input } = setup()

    await user.type(input, 'zapatos')
    await screen.findByText('No encontramos productos para “zapatos”')
    await user.click(within(emptyStateHint()).getByRole('button', { name: 'shoes' }))

    expect(input).toHaveValue('shoes')
    expect(await screen.findByText('Running Shoes')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/search?q=shoes&count=5', expect.anything())
  })

  it('muestra el error del backend y oculta la publicidad', async () => {
    stubFetch(async () => jsonResponse({ error: 'error consultando VTEX' }, 502))
    const { user, input } = setup()

    await user.type(input, 'shirt')

    expect(await screen.findByText('error consultando VTEX', { selector: 'p.panel-message__text' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Búsquedas relacionadas' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('no abre el desplegable con menos de 2 caracteres', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 0, products: [] }))
    const { user, input } = setup()

    await user.type(input, 's')

    expect(screen.queryByRole('region', { name: 'Resultados de búsqueda' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Enter busca de inmediato; Escape y clic fuera cierran el desplegable', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 1, products: [products[0]] }))
    const user = userEvent.setup()
    render(
      <>
        <SearchBox debounceMs={60_000} />
        <button type="button">fuera</button>
      </>,
    )
    const input = screen.getByRole('searchbox', { name: 'Buscar productos' })

    await user.type(input, 'shirt{Enter}')
    expect(await screen.findByText('Work Shirt')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Resultados de búsqueda' })).not.toBeInTheDocument()
    expect(input).toHaveValue('shirt')

    await user.click(input)
    expect(screen.getByRole('region', { name: 'Resultados de búsqueda' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'fuera' }))
    expect(screen.queryByRole('region', { name: 'Resultados de búsqueda' })).not.toBeInTheDocument()
  })

  it('el botón de buscar dispara la búsqueda', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ total: 1, products: [products[0]] }))
    const user = userEvent.setup()
    render(<SearchBox debounceMs={60_000} />)

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), 'shirt')
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Work Shirt')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('si la búsqueda nombra una marca reconocida, la publicidad es su video', async () => {
    stubFetch(async () => jsonResponse({ total: 0, products: [] }))
    const { user, input } = setup()

    await user.type(input, 'nike')

    expect(await screen.findByText('No encontramos productos para “nike”')).toBeInTheDocument()
    const ad = screen.getByRole('complementary', { name: 'Publicidad' })
    const video = within(ad).getByTitle(/^Video promocional de Nike/)
    expect(video.tagName).toBe('IFRAME')
    expect(video).toHaveAttribute('src', brandVideoSrc('nike'))
    expect(within(ad).getByRole('link', { name: 'Ver más de Nike' })).toHaveAttribute(
      'rel',
      'noopener noreferrer sponsored',
    )
    expect(within(ad).queryByRole('link', { name: /Ver ofertas/ })).not.toBeInTheDocument()

    // sin productos, las búsquedas relacionadas son términos populares del catálogo demo
    expect(relatedTerms()).toEqual(['shirt', 'shoes', 'top', 'samsung', 'mizuno'])
  })

  it('si la query no nombra marca, usa la del primer resultado para el video', async () => {
    stubFetch(async () =>
      jsonResponse({ total: 1, products: [makeProduct({ id: 'p', name: 'Vintage Phone 100%', brand: 'Apple' })] }),
    )
    const { user, input } = setup()

    await user.type(input, 'phone')

    expect(await screen.findByText('Vintage Phone 100%')).toBeInTheDocument()
    const ad = screen.getByRole('complementary', { name: 'Publicidad' })
    expect(within(ad).getByTitle(/^Video promocional de Apple/)).toHaveAttribute('src', brandVideoSrc('apple'))
    expect(relatedTerms()[0]).toBe('Apple')
  })

  it('una búsqueda relacionada llena el input y busca de inmediato sin cerrar el desplegable', async () => {
    const fetchMock = stubFetch(async (input) =>
      String(input).includes('q=top')
        ? jsonResponse({ total: 1, products: [makeProduct({ id: 't', name: 'Tank', brand: 'BWE' })] })
        : jsonResponse({ total: 8, products }),
    )
    const user = userEvent.setup()
    // debounce enorme: si la búsqueda esperara el debounce, el test fallaría
    render(<SearchBox debounceMs={60_000} />)
    const input = screen.getByRole('searchbox', { name: 'Buscar productos' })

    await user.type(input, 'shirt{Enter}')
    const related = screen.getByRole('navigation', { name: 'Búsquedas relacionadas' })
    await user.click(await within(related).findByRole('button', { name: 'top' }))

    expect(input).toHaveValue('top')
    expect(input).toHaveFocus()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/search?q=top&count=5', expect.anything())
    expect(await screen.findByText('Tank')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Resultados de búsqueda' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('mientras carga, las búsquedas relacionadas muestran relleno', async () => {
    const pending = deferred<Response>()
    stubFetch(() => pending.promise)
    const { user, input } = setup()

    await user.type(input, 'shirt')

    const related = await screen.findByRole('navigation', { name: 'Búsquedas relacionadas' })
    expect(related).toHaveAttribute('aria-busy', 'true')
    expect(within(related).queryAllByRole('button')).toHaveLength(0)

    pending.resolve(jsonResponse({ total: 2, products }))
    expect(await within(related).findByRole('button', { name: 'Kawasaki' })).toBeInTheDocument()
    expect(related).toHaveAttribute('aria-busy', 'false')
  })
})
