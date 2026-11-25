import { apiRequest } from './api'
import type { Rol, Usuario } from '../../features/auth/types'

export type FiltrosUsuarios = {
  q?: string
  rol?: Rol | ''
  activo?: boolean | ''
}

/** Campos que el backend acepta para alta y edición. Nunca incluye passwordHash. */
export type UsuarioDraft = {
  nombre: string
  apellido: string
  email: string
  rol: Rol
  password?: string
}

function queryDe(filtros: FiltrosUsuarios) {
  const params = new URLSearchParams()
  if (filtros.q?.trim()) params.set('q', filtros.q.trim())
  if (filtros.rol) params.set('rol', filtros.rol)
  if (filtros.activo === true || filtros.activo === false) params.set('activo', String(filtros.activo))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchUsuarios(filtros: FiltrosUsuarios = {}): Promise<Usuario[]> {
  return apiRequest<Usuario[]>(`usuarios${queryDe(filtros)}`)
}

export async function fetchUsuario(id: number): Promise<Usuario> {
  return apiRequest<Usuario>(`usuarios/${id}`)
}

export async function crearUsuario(draft: UsuarioDraft): Promise<Usuario> {
  return apiRequest<Usuario>('usuarios', { method: 'POST', body: JSON.stringify(draft) })
}

export async function actualizarUsuario(id: number, draft: UsuarioDraft): Promise<Usuario> {
  return apiRequest<Usuario>(`usuarios/${id}`, { method: 'PUT', body: JSON.stringify(draft) })
}

export async function darDeBajaUsuario(id: number): Promise<Usuario> {
  return apiRequest<Usuario>(`usuarios/${id}`, { method: 'DELETE' })
}

export async function reactivarUsuario(id: number): Promise<Usuario> {
  return apiRequest<Usuario>(`usuarios/${id}/reactivar`, { method: 'PUT' })
}
