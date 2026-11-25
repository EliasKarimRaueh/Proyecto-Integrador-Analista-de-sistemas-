import { apiRequest, renovarSesion } from './api'
import type {
  CredencialesLogin,
  RespuestaAutenticacion,
  Usuario,
} from '../../features/auth/types'

export async function login(credenciales: CredencialesLogin): Promise<RespuestaAutenticacion> {
  return apiRequest<RespuestaAutenticacion>('auth/login', {
    method: 'POST',
    body: JSON.stringify(credenciales),
  })
}

export async function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('auth/logout', { method: 'POST' })
}

/** Comparte la renovación con el reintento automático de apiRequest. */
export async function refresh(): Promise<RespuestaAutenticacion> {
  return renovarSesion()
}

export async function me(): Promise<Usuario> {
  return apiRequest<Usuario>('auth/me')
}
