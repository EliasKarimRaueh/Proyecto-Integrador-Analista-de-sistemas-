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
        <NavLink to="/" className="brand"><span className="brand-mark" aria-hidden="true">🐔</span><span>LA NENA<small>POLLERÍA</small></span></NavLink>
        <span className="nav-caption">PRINCIPAL</span>
        <nav aria-label="Navegación principal">{navigation.map(({ to, label, icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} /><span>{label}</span>{pathname === to && <span className="nav-dot" />}</NavLink>)}</nav>
        <div className="sidebar-bottom"><div className="sprint-label"><span />AvixSoft · Sprint 2<small>Ventas e inventario</small></div></div>
      </aside>
      <div className="workspace"><header className="topbar"><div><strong>{current.toUpperCase()}</strong><p>Sistema de gestión · La Nena</p></div><button className={`workspace-tag connection-state ${health.error ? 'offline' : ''}`} onClick={health.refetch} title="Comprobar conexión"><span />{health.loading ? 'Conectando…' : health.error ? 'API sin conexión · reintentar' : 'API conectada'}</button></header><main id="contenido" className="container" tabIndex={-1}><Outlet /></main><footer className="app-footer">La Nena · Pollería<span>AvixSoft / Ventas e inventario</span></footer></div>
    </div>
  )
}
