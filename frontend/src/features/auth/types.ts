/** Roles que el backend acepta en el token JWT. */
export type Rol = 'PROPIETARIO' | 'EMPLEADO'

/** Datos públicos del operador (nunca incluye el hash de la contraseña). */
export type Usuario = {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: Rol
  activo: boolean
}

export type CredencialesLogin = {
  identificador: string
  password: string
  recordarme?: boolean
}

export type RespuestaAutenticacion = {
  accessToken: string
  usuario: Usuario
}

export function nombreCompleto(usuario: Pick<Usuario, 'nombre' | 'apellido'>) {
  return `${usuario.nombre} ${usuario.apellido}`.trim()
}
