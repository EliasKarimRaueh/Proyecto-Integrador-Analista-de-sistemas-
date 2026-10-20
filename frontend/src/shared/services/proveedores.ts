import { apiRequest } from './api'
import { payloadProveedor, type Proveedor, type ProveedorDraft } from '../../features/proveedores/proveedores'

export const fetchProveedores = () => apiRequest<Proveedor[]>('proveedores')
export const guardarProveedor = (draft: ProveedorDraft, id?: number) => apiRequest<Proveedor>(id === undefined ? 'proveedores' : `proveedores/${id}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(payloadProveedor(draft)) })
export const cambiarEstadoProveedor = (id: number, activar: boolean) => apiRequest<Proveedor>(`proveedores/${id}${activar ? '/reactivar' : ''}`, { method: activar ? 'PUT' : 'DELETE' })
