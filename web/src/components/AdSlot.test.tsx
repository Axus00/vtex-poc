import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildAd } from '../lib/ad'
import { BRANDS, type Brand } from '../lib/brands'
import { storeSearchUrl } from '../lib/store'
import { AdSlot } from './AdSlot'

const brandById = (id: string): Brand => BRANDS.find((b) => b.id === id)!

const expectedSrc = (id: string, autoplay = true) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&mute=1&loop=1&playlist=${id}` +
  `&controls=${autoplay ? 0 : 1}&playsinline=1&rel=0&modestbranding=1`

describe('AdSlot', () => {
  it('con marca reconocida muestra su video promocional y el CTA a la tienda', () => {
    const nike = brandById('nike')
    render(<AdSlot ad={buildAd('nike')} brand={nike} />)

    const ad = screen.getByRole('complementary', { name: 'Publicidad' })
    expect(within(ad).getByText('Publicidad')).toBeInTheDocument()

    const video = within(ad).getByTitle(`Video promocional de Nike: ${nike.videoTitle}`)
    expect(video.tagName).toBe('IFRAME')
    expect(video).toHaveAttribute('src', expectedSrc(nike.youtubeId))
    expect(video).toHaveAttribute('allow', 'autoplay; encrypted-media; picture-in-picture')
    expect(video).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(video).toHaveAttribute('loading', 'lazy')

    expect(within(ad).getByText('Nike')).toBeInTheDocument()
    expect(within(ad).getByText(nike.tagline)).toBeInTheDocument()
    const cta = within(ad).getByRole('link', { name: 'Ver más de Nike' })
    expect(cta).toHaveAttribute('href', storeSearchUrl('Nike'))
    expect(cta).toHaveAttribute('target', '_blank')
    expect(cta).toHaveAttribute('rel', 'noopener noreferrer sponsored')

    // el anuncio de categoría no se muestra a la vez
    expect(within(ad).queryByRole('link', { name: /Ver ofertas/ })).not.toBeInTheDocument()
  })

  it('sin marca muestra el anuncio de categoría (sin video)', () => {
    const { container } = render(<AdSlot ad={buildAd('shirt')} />)

    const ad = screen.getByRole('complementary', { name: 'Publicidad' })
    expect(within(ad).getByText('Hasta 40% dto. en Shirt')).toBeInTheDocument()
    expect(within(ad).getByRole('link', { name: /Ver ofertas/ })).toHaveAttribute('rel', 'noopener noreferrer sponsored')
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('respeta prefers-reduced-motion: sin autoplay', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const samsung = brandById('samsung')
    render(<AdSlot ad={buildAd('samsung')} brand={samsung} />)

    expect(screen.getByTitle(/Video promocional de Samsung/)).toHaveAttribute('src', expectedSrc(samsung.youtubeId, false))
  })
})
