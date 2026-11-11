import { apiRequest } from './api'
import { rangoDelDia } from '../lib/operaciones'
import type { Unidad } from './operaciones'

export type ProductoAbastecimiento = {
  id: number; codigo: string; nombre: string; unidadCompra: string; unidadVenta: Unidad
  factorConversion: number; costoActual: string; stockActual: number; stockMinimo: number | null
  estado: string; faltante: number; cantidadSugerida: number; proveedorHabitualId: number | null
  proveedores: { id: number; nombre: string }[]
}
export type DetalleAbastecimiento = {
  id?: number; productoId: number; cantidad: number; costoEstimado?: string; costoUnitario?: string
  subtotal: string; producto?: { id: number; nombre: string; unidadCompra: string; unidadVenta: Unidad; factorConversion: number }
  presentacion?: string; cantidadPresentacion?: number | null; factorConversion?: number | null; cantidadBase?: number
}
export type PedidoCompra = {
  id: number; proveedorId: number; proveedor?: { nombre: string }; fechaHora: string
  estado: 'REALIZADO' | 'CANCELADO' | 'RECIBIDO'; totalEstimado: string; observaciones: string | null; compra?: { id: number } | null; detalles: DetalleAbastecimiento[]
}
export type Compra = {
  id: number; proveedorId: number; proveedor?: { nombre: string }; pedidoId: number | null; fechaHora: string
  estado: 'PENDIENTE_RECEPCION' | 'RECIBIDA'; tipoComprobante: string; numeroComprobante: string | null
  total: string; observaciones: string | null; detalles: DetalleAbastecimiento[]; recepcion?: { id: number } | null
}
export type Recepcion = {
  id: number; compraId: number; proveedorId: number; proveedor?: { nombre: string }; fechaHora: string
  observaciones: string | null; detalles: DetalleAbastecimiento[]; movimientosStock?: { id: number; productoId: number; cantMovimiento: number; cantFinal: number }[]
}
export type FiltrosAbastecimiento = { page?: number; proveedorId?: string; estado?: string; desde?: string; hasta?: string; q?: string; incluirProximos?: boolean; soloHabitual?: boolean }
export async function listarAbastecimiento<T>(ruta: string, filtros: FiltrosAbastecimiento) {
  const { desde, hasta, ...resto } = filtros
  if (desde && hasta && desde > hasta) throw new Error('La fecha inicial no puede superar la final.')
  const params = new URLSearchParams({ limite: '20' })
  for (const [key, value] of Object.entries({ ...resto, ...rangoDelDia(desde ?? '', hasta ?? '') })) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const meta: { total?: number } = {}
  const rows = await apiRequest<T[]>(`${ruta}?${params}`, {}, meta)
  return { rows, count: meta.total ?? rows.length }
}
export const fetchPedido = (id: number) => apiRequest<PedidoCompra>(`pedidos/${id}`)
export const fetchCompra = (id: number) => apiRequest<{ compra: Compra; cuenta: { importePendiente: string; estado: string } | null }>(`compras/${id}`)
export const fetchRecepcion = (id: number) => apiRequest<Recepcion>(`recepciones/${id}`)
export const cancelarPedido = (id: number) => apiRequest(`pedidos/${id}/cancelar`, { method: 'POST' })
export const guardarHabitual = (id: number, proveedorId: number | null) => apiRequest(`stock/${id}/proveedor-habitual`, { method: 'PUT', body: JSON.stringify({ proveedorId }) })
export type LineaAbastecimientoInput = { productoId: number; cantidad: number; costoUnitario?: string; costoEstimado?: string; presentacion?: string; cantidadPresentacion?: number; factorConversion?: number }
export const guardarPedido = (datos: { proveedorId: number; fechaHora: string; observaciones: string; detalles: LineaAbastecimientoInput[] }) => apiRequest<{ pedido: PedidoCompra }>('pedidos', { method: 'POST', body: JSON.stringify(datos) })
export const guardarCompra = (datos: { proveedorId: number; pedidoId?: number; fechaHora: string; tipoComprobante: string; numeroComprobante: string; observaciones: string; detalles: LineaAbastecimientoInput[] }) => apiRequest<{ compra: Compra }>('compras', { method: 'POST', body: JSON.stringify(datos) })
export const guardarRecepcion = (datos: { compraId: number; observaciones: string; detalles: { productoId: number; presentacion: string; cantidadPresentacion: number; factorConversion: number }[] }) => apiRequest<{ recepcion: Recepcion }>('recepciones', { method: 'POST', body: JSON.stringify(datos) })
