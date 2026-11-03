import { apiRequest } from './api'
import { payloadProveedor, type Proveedor, type ProveedorDraft } from '../../features/proveedores/proveedores'

export const fetchProveedores = () => apiRequest<Proveedor[]>('proveedores')
export const guardarProveedor = (draft: ProveedorDraft, id?: number) => apiRequest<Proveedor>(id === undefined ? 'proveedores' : `proveedores/${id}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(payloadProveedor(draft)) })
export const cambiarEstadoProveedor = (id: number, activar: boolean) => apiRequest<Proveedor>(`proveedores/${id}${activar ? '/reactivar' : ''}`, { method: activar ? 'PUT' : 'DELETE' })

export type RelacionProveedor = { productoId: number; proveedorId: number; activo: boolean }
export type CuentaProveedor = { id: number; compraId: number; importePendiente: string; estado: string; compra: { id: number; fechaHora: string; total: string; numeroComprobante: string | null } }
export type PagoProveedor = { id: number; fechaHora: string; importe: string; importePendiente: string; pagosPorCuenta: { cuentaId: number; importeAplicado: string }[] }
export type EstadoCuenta = { proveedor: Proveedor; saldo: string; credito: string; cuentas: { rows: CuentaProveedor[]; count: number }; pagos: { rows: PagoProveedor[]; count: number } }
export const fetchProductosProveedor = (id: number) => apiRequest<RelacionProveedor[]>(`proveedores/${id}/productos`)
export const guardarProductosProveedor = (id: number, productoIds: number[]) => apiRequest<RelacionProveedor[]>(`proveedores/${id}/productos`, { method: 'PUT', body: JSON.stringify({ productoIds }) })
export const fetchCuentaProveedor = (id: number, filtros: { page: number; estado: string; desde: string; hasta: string }) => apiRequest<EstadoCuenta>(`proveedores/${id}/cuenta?${new URLSearchParams({ page: String(filtros.page), estado: filtros.estado, desde: filtros.desde, hasta: filtros.hasta })}`)
export const pagarProveedor = (id: number, importe: string, claveOperacion: string) => apiRequest<{ pago: PagoProveedor; aplicaciones: { cuentaId: number; importeAplicado: string }[] }>(`proveedores/${id}/pagos`, { method: 'POST', body: JSON.stringify({ importe, claveOperacion }) })
export const registrarComprobante = (id: number, datos: { total: string; fecha: string; numeroComprobante: string; claveOperacion: string }) => apiRequest<{ id: number }>(`proveedores/${id}/comprobantes`, { method: 'POST', body: JSON.stringify(datos) })
