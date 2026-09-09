import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const navigation: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/productos', label: 'Productos', icon: 'box' },
  { to: '/pedidos', label: 'Pedidos', icon: 'bag' },
  { to: '/stock', label: 'Stock', icon: 'archive' },
  { to: '/clientes', label: 'Clientes', icon: 'users' },
]
export function AppLayout() {
  const { pathname } = useLocation()
  const current = navigation.find(item => item.to === pathname)?.label ?? 'Gestión'
  return (
    <div className="app">
      <a className="skip-link" href="#contenido">Ir al contenido</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand"><span className="brand-mark" aria-hidden="true">🐔</span><span>LA NENA<small>POLLERÍA</small></span></NavLink>
        <span className="nav-caption">PRINCIPAL</span>
        <nav aria-label="Navegación principal">{navigation.map(({ to, label, icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} /><span>{label}</span>{pathname === to && <span className="nav-dot" />}</NavLink>)}</nav>
        <div className="sidebar-bottom"><div className="sprint-label"><span />Sprint 1<small>Gestión del catálogo</small></div><NavLink to="/login" className="account"><span className="avatar"><Icon name="users" /></span><span>Acceso al sistema<small>Iniciar sesión</small></span><Icon name="arrow" size={16} /></NavLink></div>
      </aside>
      <div className="workspace"><header className="topbar"><div><strong>{current.toUpperCase()}</strong><p>Sistema de gestión · La Nena</p></div><span className="workspace-tag"><span />Entorno de demostración</span></header><main id="contenido" className="container" tabIndex={-1}><Outlet /></main><footer className="app-footer">La Nena · Pollería<span>Sistema de gestión / Catálogo</span></footer></div>
    </div>
  )
}
