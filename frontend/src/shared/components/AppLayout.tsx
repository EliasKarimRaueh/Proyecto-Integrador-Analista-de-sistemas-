import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { useApiResource } from '../hooks/useApiResource'
import { apiRequest } from '../services/api'

const navigation: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/caja', label: 'Caja y mostrador', icon: 'bag' },
  { to: '/productos', label: 'Productos', icon: 'box' },
  { to: '/ofertas', label: 'Ofertas', icon: 'tag' },
  { to: '/stock', label: 'Inventario', icon: 'archive' },
  { to: '/desposte', label: 'Desposte', icon: 'box' },
  { to: '/ventas', label: 'Ventas', icon: 'calendar' },
  { to: '/movimientos', label: 'Movimientos', icon: 'arrow' },
]

export function AppLayout() {
  const { pathname } = useLocation()
  const health = useApiResource(() => apiRequest<{ status: string }>('health'))
  const current = navigation.find(item => item.to === pathname)?.label ?? 'Gestión'
  
  return (
    <div className="app">
      <a className="skip-link" href="#contenido">Ir al contenido</a>
      <aside className="sidebar">
        {/* ACÁ ESTÁN LOS CAMBIOS DEL LOGO Y EL TEXTO */}
        <NavLink to="/" className="brand" style={{ 
          display: 'flex', 
          flexDirection: 'column', /* <-- ESTO HACE QUE SE PONGAN UNO ARRIBA DEL OTRO */
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '0.5px', /* <-- Achiqué un poco el espacio para que no quede tan descolgado */
          textDecoration: 'none',
          padding: '10px 0' /* Un poquito de aire arriba y abajo */
        }}>
          <span className="brand-mark" aria-hidden="true" style={{ background: 'transparent', padding: 0 }}>
            <img 
              src="/android-chrome-192x192.png" 
              alt="Logo AvixSoft" 
              width="80" 
              height="80" 
              style={{ borderRadius: '6px', objectFit: 'contain' }} 
            />
          </span>
          <span style={{ 
            color: 'rgb(255, 255, 255)', 
            fontSize: '30px', 
            fontWeight: 'bold', 
            letterSpacing: '0.5px',
            textAlign: 'center' /* Para asegurar que el texto quede centrado */
          }}>
            AvixSoft
          </span>
        </NavLink>

        <span className="nav-caption">PRINCIPAL</span>
        <nav aria-label="Navegación principal">
          {navigation.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon name={icon} />
              <span>{label}</span>
              {pathname === to && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sprint-label">
            <span />AvixSoft · Sprint 2<small>Ventas e inventario</small>
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