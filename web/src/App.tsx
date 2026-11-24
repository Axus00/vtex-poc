import { Header } from './components/Header'

const BENEFITS = [
  { title: 'Envío a todo el país', text: 'Recibe tus compras en casa' },
  { title: 'Compra y recoge', text: 'Retira gratis en tu tienda' },
  { title: 'Paga a cuotas', text: 'Con tus tarjetas favoritas' },
  { title: 'Cambios fáciles', text: 'Tienes 30 días para decidir' },
]

export default function App() {
  return (
    <>
      <Header />
      <main>
        <section className="hero" aria-label="Promoción destacada">
          <div className="hero__inner container">
            <div className="hero__copy">
              <p className="hero__eyebrow">Solo por esta semana</p>
              <h1 className="hero__title">
                Semana de <span>ofertas</span>
              </h1>
              <p className="hero__text">Hasta 50% de descuento en moda, calzado, tecnología y hogar.</p>
              <span className="hero__cta">¡Compra ahora!</span>
            </div>
            <div className="hero__art" aria-hidden="true">
              <span className="hero__blob hero__blob--one" />
              <span className="hero__blob hero__blob--two" />
              <span className="hero__tag">-50%</span>
            </div>
          </div>
        </section>

        <section className="benefits container" aria-label="Beneficios">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="benefit">
              <strong>{benefit.title}</strong>
              <span>{benefit.text}</span>
            </div>
          ))}
        </section>

        <p className="demo-hint container">
          Tip: el catálogo de demostración de VTEX está en inglés. Busca “shirt”, “shoes” o “top” en la barra de arriba.
        </p>
      </main>
      <footer className="site-footer">
        <div className="container">POC de búsqueda sobre VTEX Intelligent Search · API en Go + front en React</div>
      </footer>
    </>
  )
}
