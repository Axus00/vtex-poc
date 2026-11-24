import { MenuIcon, PinIcon } from './icons'
import { SearchBox } from './SearchBox'

const CATEGORIES = ['Tecnología', 'Moda', 'Calzado', 'Hogar', 'Deportes', 'Ofertas de la semana']

/** Header amarillo estilo storefront: marca, buscador, tienda y menú de categorías. */
export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__main container">
        <a className="wordmark" href="/" aria-label="vtex·poc, ir al inicio">
          vtex<span className="wordmark__dot" aria-hidden="true" />poc
        </a>
        <SearchBox />
        <button type="button" className="store-picker">
          <PinIcon size={26} />
          <span className="store-picker__text">
            <strong>Compra y recoge</strong>
            <span>Elige tu tienda</span>
          </span>
        </button>
      </div>
      <nav className="site-header__nav container" aria-label="Categorías">
        <button type="button" className="menu-button">
          <MenuIcon />
          Menú
        </button>
        <ul className="category-links">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <a href="#">{category}</a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
