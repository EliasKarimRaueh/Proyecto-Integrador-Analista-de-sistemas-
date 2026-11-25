import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { configurarSesionApi, guardarTokenEnMemoria } from '../../shared/services/api'
import { login as loginRequest, logout as logoutRequest, refresh as refreshRequest } from '../../shared/services/auth'
import { AuthContext, type AuthContextValue } from './authContext'
import type { CredencialesLogin, RespuestaAutenticacion, Usuario } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const aplicarSesion = useCallback((sesion: RespuestaAutenticacion) => {
    guardarTokenEnMemoria(sesion.accessToken)
    setAccessToken(sesion.accessToken)
    setUsuario(sesion.usuario)
  }, [])

  const finalizarSesion = useCallback(() => {
    guardarTokenEnMemoria(null)
    setAccessToken(null)
    setUsuario(null)
  }, [])

  // Se configura durante el render para que las peticiones de las páginas
  // hijas ya viajen con el token cuando se ejecutan sus efectos.
  configurarSesionApi({
    onTokenRenovado: (token, usuario) => aplicarSesion({ accessToken: token, usuario }),
    onSesionFinalizada: finalizarSesion,
  })

  useEffect(() => {
    let vigente = true
    refreshRequest()
      .then(sesion => { if (vigente) aplicarSesion(sesion) })
      .catch(() => { if (vigente) finalizarSesion() })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [aplicarSesion, finalizarSesion])

  const login = useCallback(async (credenciales: CredencialesLogin) => {
    const sesion = await loginRequest(credenciales)
    if (!sesion.usuario?.activo) {
      finalizarSesion()
      throw new Error('El usuario está inactivo. Contactá con el propietario.')
    }
    aplicarSesion(sesion)
    return sesion
  }, [aplicarSesion, finalizarSesion])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      finalizarSesion()
    }
  }, [finalizarSesion])

  const value: AuthContextValue = { usuario, accessToken, login, logout, cargando }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
