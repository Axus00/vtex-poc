import { useState } from 'react'
import type { Product } from '../api/search'
import { discountPercent, formatPrice, hasDiscount, hasPrice, stripHtml } from '../lib/format'
import { productUrl } from '../lib/store'
import { BagIcon } from './icons'

function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span className="product-card__media product-card__media--empty" role="img" aria-label={`${alt} (sin imagen)`}>
        <BagIcon />
      </span>
    )
  }
  return (
    <span className="product-card__media">
      <img src={src} alt={alt} loading="lazy" decoding="async" width={80} height={80} onError={() => setFailed(true)} />
    </span>
  )
}

/** Tarjeta de producto del desplegable: foto a la izquierda, datos a la derecha. */
export function ProductCard({ product }: { product: Product }) {
  const description = stripHtml(product.description)
  const discount = discountPercent(product.price, product.listPrice)

  return (
    <a className="product-card" href={productUrl(product.link)} target="_blank" rel="noopener noreferrer">
      <ProductImage src={product.image} alt={product.name} />
      <span className="product-card__body">
        <span className="product-card__name">{product.name}</span>
        {description && <span className="product-card__description">{description}</span>}
        {product.brand && <span className="product-card__brand">{product.brand}</span>}
        <span className="product-card__prices">
          {hasPrice(product.price) ? (
            <span className="product-card__price">{formatPrice(product.price)}</span>
          ) : (
            <span className="product-card__price product-card__price--na">Precio no disponible</span>
          )}
          {hasDiscount(product.price, product.listPrice) && (
            <s className="product-card__list-price">
              <span className="visually-hidden">Antes: </span>
              {formatPrice(product.listPrice)}
            </s>
          )}
          {discount > 0 && <span className="product-card__badge">-{discount}%</span>}
        </span>
      </span>
    </a>
  )
}

/** Placeholder animado mientras llega la respuesta. */
export function ProductCardSkeleton() {
  return (
    <span className="product-card product-card--skeleton" aria-hidden="true">
      <span className="product-card__media skeleton" />
      <span className="product-card__body">
        <span className="skeleton skeleton--line" style={{ width: '70%' }} />
        <span className="skeleton skeleton--line" style={{ width: '95%' }} />
        <span className="skeleton skeleton--line" style={{ width: '40%' }} />
      </span>
    </span>
  )
}
