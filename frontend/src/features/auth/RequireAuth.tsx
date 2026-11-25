import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import type { Rol } from './types'

function destinoDe(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`
}

function Verificando() {
  return <section className="panel"><p role="status">Verificando sesión…</p></section>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <Verificando />
  if (!usuario) return <Navigate to="/login" replace state={{ from: destinoDe(location) }} />
  return children
}

export function RequireRole({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <Verificando />
  if (!usuario) return <Navigate to="/login" replace state={{ from: destinoDe(location) }} />
  if (usuario.rol !== rol) return <Navigate to="/" replace />
  return children
}
