import { useContext } from 'react'
import { AuthContext } from '../../features/auth/authContext'

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return contexto
}
