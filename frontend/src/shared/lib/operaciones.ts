import type { Unidad } from '../services/operaciones'

export function cantidadInput(value: string, unidad: Unidad = 'KILOS', permiteCero = false): number {
  const normalizado = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,6})?$/.test(normalizado)) throw new Error('Ingresá una cantidad válida con hasta 6 decimales, usando coma o punto.')
  const n = Number(normalizado)
  if (!Number.isFinite(n) || (permiteCero ? n < 0 : n <= 0)) throw new Error(permiteCero ? 'La cantidad no puede ser negativa.' : 'La cantidad debe ser mayor a cero.')
  if (unidad === 'UNIDADES' && !Number.isSafeInteger(n)) throw new Error('Los productos por unidad requieren cantidades enteras.')
  return n
}
export const unidadCorta = (unidad: Unidad) => unidad === 'KILOS' ? 'kg' : 'un.'
export const cantidadFormato = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6 }).format(n)
export function fechaHoraLocal(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso))
}
// El selector representa el día del negocio, inclusive, en Argentina.
export function rangoDelDia(desde: string, hasta: string) {
  if (desde && hasta && desde > hasta) throw new Error('La fecha inicial debe ser anterior o igual a la final.')
  return { fechaDesde: desde ? `${desde}T00:00:00.000-03:00` : undefined, fechaHasta: hasta ? `${hasta}T23:59:59.999-03:00` : undefined }
}
export function errorMensaje(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación. Intentá nuevamente.'
}
export function validarMotivo(value: string) {
  if (!value.trim() || value.trim().length > 250) throw new Error('Ingresá un motivo de hasta 250 caracteres.')
  return value.trim()
}
