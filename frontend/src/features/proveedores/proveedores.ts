import { normalize } from '../products/products'

export const diasEntrega = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export type DiaEntrega = typeof diasEntrega[number]
export type Proveedor = {
  id: number
  nombre: string
  cuil: string | null
  telefono: string | null
  email: string | null
  descripcion: string | null
  direccion: string | null
  diasEntrega: DiaEntrega[]
  ctaCte: boolean
  activo: boolean
  fechaBaja: string | null
}
export type ProveedorDraft = {
  nombre: string; cuil: string; telefono: string; email: string
  descripcion: string; direccion: string; diasEntrega: DiaEntrega[]; ctaCte: boolean
}
export const nuevoProveedor = (): ProveedorDraft => ({ nombre: '', cuil: '', telefono: '', email: '', descripcion: '', direccion: '', diasEntrega: [], ctaCte: false })
export function editarProveedor(p: Proveedor): ProveedorDraft {
  return { nombre: p.nombre, cuil: p.cuil ?? '', telefono: p.telefono ?? '', email: p.email ?? '', descripcion: p.descripcion ?? '', direccion: p.direccion ?? '', diasEntrega: p.diasEntrega ?? [], ctaCte: p.ctaCte }
}
export function payloadProveedor(draft: ProveedorDraft) {
  return { ...draft, nombre: draft.nombre.trim(), cuil: draft.cuil.replace(/[\s-]/g, ''), telefono: draft.telefono.replace(/[\s()+-]/g, ''), email: draft.email.trim().toLowerCase(), descripcion: draft.descripcion.trim(), direccion: draft.direccion.trim() }
}
export function validarProveedor(draft: ProveedorDraft, proveedores: Proveedor[], id?: number) {
  const p = payloadProveedor(draft)
  const errores: Partial<Record<keyof ProveedorDraft, string>> = {}
  if (!p.nombre || p.nombre.length > 50) errores.nombre = 'Ingresá una razón social de hasta 50 caracteres.'
  if (p.cuil && !/^\d{11}$/.test(p.cuil)) errores.cuil = 'El CUIT debe contener 11 dígitos.'
  if (p.telefono && !/^\d{10,15}$/.test(p.telefono)) errores.telefono = 'El teléfono debe contener entre 10 y 15 dígitos.'
  if (p.email && !/^[^\s@]+@[^\s@]+\.com$/.test(p.email)) errores.email = 'Ingresá un email válido terminado en .com.'
  if (p.direccion.length > 200) errores.direccion = 'La dirección admite hasta 200 caracteres.'
  if (p.descripcion.length > 300) errores.descripcion = 'La descripción admite hasta 300 caracteres.'
  for (const campo of ['cuil', 'telefono', 'email'] as const) {
    if (p[campo] && proveedores.some(otro => otro.id !== id && normalize(otro[campo] ?? '') === normalize(p[campo]))) errores[campo] = 'Este dato ya está registrado, incluso entre proveedores inactivos.'
  }
  return errores
}
