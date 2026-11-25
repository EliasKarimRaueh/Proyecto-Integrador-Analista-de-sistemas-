import type { UsuarioDraft } from '../../shared/services/usuarios'
import type { Rol, Usuario } from '../auth/types'
import { normalize } from '../products/products'

export type { UsuarioDraft } from '../../shared/services/usuarios'

export type ErroresUsuario = Partial<Record<keyof UsuarioDraft, string>>

export type FiltrosUsuariosLocales = {
  q?: string
  rol?: Rol | ''
  activo?: boolean | ''
}

export function nombreCompleto(usuario: Pick<Usuario, 'nombre' | 'apellido'>) {
  return `${usuario.nombre} ${usuario.apellido}`.trim()
}

export function validarUsuario(draft: UsuarioDraft, editando = false): ErroresUsuario {
  const errores: ErroresUsuario = {}
  if (!draft.nombre.trim()) errores.nombre = 'Ingresá el nombre.'
  if (!draft.apellido.trim()) errores.apellido = 'Ingresá el apellido.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errores.email = 'Ingresá un email válido.'
  if (draft.rol !== 'PROPIETARIO' && draft.rol !== 'EMPLEADO') errores.rol = 'Elegí un rol.'
  const password = draft.password?.trim() ?? ''
  if ((!editando || password !== '') && password.length < 8) {
    errores.password = 'La contraseña debe tener al menos 8 caracteres.'
  }
  return errores
}

export function filtrarUsuarios(usuarios: Usuario[], filtros: FiltrosUsuariosLocales): Usuario[] {
  const termino = normalize(filtros.q ?? '')
  return usuarios.filter(usuario => {
    if (termino && !normalize(`${nombreCompleto(usuario)} ${usuario.email}`).includes(termino)) return false
    if (filtros.rol && usuario.rol !== filtros.rol) return false
    if (filtros.activo === true && !usuario.activo) return false
    if (filtros.activo === false && usuario.activo) return false
    return true
  })
}
