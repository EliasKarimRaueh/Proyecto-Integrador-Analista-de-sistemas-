import { Link } from 'react-router-dom'

const modules = [
  { to: '/productos', title: 'Productos', description: 'Consultá, registrá, modificá y da de baja productos del catálogo.' },
  { to: '/pedidos', title: 'Pedidos', description: 'Registro y seguimiento de pedidos.' },
  { to: '/stock', title: 'Stock', description: 'Control de productos y existencias.' },
  { to: '/clientes', title: 'Clientes', description: 'Administración de datos de clientes.' },
  { to: '/login', title: 'Acceso', description: 'Autenticación de usuarios del sistema.' },
]

export function HomePage() {
  return (
    <section>
      <p className="eyebrow">Sistema de gestión</p>
      <h1>Administración de la pollería</h1>
      <p>Seleccioná una sección para comenzar.</p>
      <div className="module-grid">
        {modules.map(({ to, title, description }) => (
          <Link className="module-card" key={to} to={to}>
            <h2>{title}</h2>
            <p>{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
