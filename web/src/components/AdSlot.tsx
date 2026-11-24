import type { CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { Ad } from '../lib/ad'
import { brandVideoEmbedUrl, type Brand } from '../lib/brands'
import { storeSearchUrl } from '../lib/store'
import { ArrowIcon } from './icons'

export interface AdSlotProps {
  /** Anuncio de categoría/genérico (se usa si no hay marca reconocida). */
  ad: Ad
  /** Marca reconocida en la búsqueda: si existe, se muestra su video promocional. */
  brand?: Brand
}

/**
 * Espacio publicitario compacto de la columna derecha del desplegable: video de la marca
 * si la búsqueda nombra una marca reconocida; si no, el anuncio de la categoría.
 */
export function AdSlot({ ad, brand }: AdSlotProps) {
  return (
    <aside className="ad-slot" aria-label="Publicidad">
      <span className="ad-slot__label">Publicidad</span>
      {brand ? <BrandVideoAd brand={brand} /> : <CategoryAd ad={ad} />}
    </aside>
  )
}

function CategoryAd({ ad }: { ad: Ad }) {
  return (
    <a
      className={`ad-card ad-card--${ad.theme}`}
      href={ad.href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-theme={ad.theme}
    >
      <span className="ad-card__category">{ad.label}</span>
      <span className="ad-card__title">{ad.title}</span>
      <span className="ad-card__subtitle">{ad.subtitle}</span>
      <span className="ad-card__art">
        {ad.image ? (
          <img src={ad.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="ad-card__shape" aria-hidden="true" />
        )}
      </span>
      <span className="ad-card__cta">
        {ad.cta}
        <ArrowIcon />
      </span>
    </a>
  )
}

function BrandVideoAd({ brand }: { brand: Brand }) {
  const reducedMotion = usePrefersReducedMotion()
  const style = {
    '--ad-bg': brand.theme.background,
    '--ad-fg': brand.theme.text,
    '--ad-cta-bg': brand.theme.accent,
    '--ad-cta-fg': brand.theme.accentText,
  } as CSSProperties

  return (
    <div className="ad-video" style={style} data-brand={brand.id}>
      <div className="ad-video__frame">
        {/* key: si cambia la marca se monta un iframe nuevo en vez de navegar el anterior */}
        <iframe
          key={brand.youtubeId}
          src={brandVideoEmbedUrl(brand.youtubeId, { autoplay: !reducedMotion })}
          title={`Video promocional de ${brand.name}: ${brand.videoTitle}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
      <div className="ad-video__body">
        <span className="ad-video__brand">{brand.name}</span>
        <span className="ad-video__tagline">{brand.tagline}</span>
        <a
          className="ad-video__cta"
          href={storeSearchUrl(brand.name)}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          {/* el nombre de la marca ya se ve al lado; el lector de pantalla oye "Ver más de Nike" */}
          Ver más <span className="visually-hidden">de {brand.name}</span>
          <ArrowIcon size={14} />
        </a>
      </div>
    </div>
  )
}
