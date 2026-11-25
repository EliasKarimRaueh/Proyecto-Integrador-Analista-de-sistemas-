import { createContext } from 'react'
import type { CredencialesLogin, RespuestaAutenticacion, Usuario } from './types'

export type AuthContextValue = {
  usuario: Usuario | null
  accessToken: string | null
  login: (credenciales: CredencialesLogin) => Promise<RespuestaAutenticacion>
  logout: () => Promise<void>
  cargando: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
