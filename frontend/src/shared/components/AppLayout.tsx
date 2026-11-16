import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { useApiResource } from '../hooks/useApiResource'
import { apiRequest } from '../services/api'

type NavItem = { to: string; label: string; icon: IconName }
type NavSection = { id: string; label: string; items: NavItem[] }

const navigation: NavSection[] = [
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { to: '/', label: 'Inicio', icon: 'home' },
      { to: '/caja', label: 'Caja y mostrador', icon: 'bag' },
      { to: '/ventas', label: 'Ventas', icon: 'calendar' },
      { to: '/movimientos', label: 'Movimientos', icon: 'arrow' },
    ],
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    items: [
      { to: '/productos', label: 'Productos y precios', icon: 'tag' },
      { to: '/ofertas', label: 'Ofertas', icon: 'percent' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    items: [
      { to: '/stock', label: 'Inventario', icon: 'archive' },
      { to: '/desposte', label: 'Desposte', icon: 'cut' },
    ],
  },
  {
    id: 'abastecimiento',
    label: 'Abastecimiento',
    items: [
      { to: '/proveedores', label: 'Proveedores', icon: 'users' },
      { to: '/reposicion', label: 'Reposición', icon: 'refresh' },
      { to: '/pedidos', label: 'Pedidos', icon: 'cart' },
      { to: '/compras', label: 'Compras', icon: 'calendar' },
      { to: '/recepciones', label: 'Recepciones', icon: 'check' },
    ],
  },
]

export function AppLayout() {
  const { pathname } = useLocation()
  const health = useApiResource(() => apiRequest<{ status: string }>('health'))
  const current = navigation
    .flatMap(section => section.items)
    .find(item => item.to === pathname)?.label ?? 'Gestión'

  return (
    <div className="app">
      <a className="skip-link" href="#contenido">Ir al contenido</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <img src="/android-chrome-192x192.png" alt="" width="40" height="40" />
          </span>
          <span className="brand-text">
            <strong>AvixSoft</strong>
            <small>La Nena · Pollería</small>
          </span>
        </NavLink>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigation.map(section => (
            <div className="nav-group" key={section.id} role="group" aria-labelledby={`nav-${section.id}`}>
              <span className="nav-caption" id={`nav-${section.id}`}>{section.label}</span>
              {section.items.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} end={to === '/'}>
                  <Icon name={icon} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sprint-label">
            <span />AvixSoft · Sprint 4<small>Compras y reposición</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <strong>{current.toUpperCase()}</strong>
            <p>Sistema de gestión de Pollerias</p>
          </div>
          <button className={`workspace-tag connection-state ${health.error ? 'offline' : ''}`} onClick={health.refetch} title="Comprobar conexión">
            <span />{health.loading ? 'Conectando…' : health.error ? 'API sin conexión · reintentar' : 'API conectada'}
          </button>
        </header>
        <main id="contenido" className="container" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          La Nena · Pollería<span>AvixSoft / Ventas e inventario</span>
        </footer>
      </div>
    </div>
  )
}
