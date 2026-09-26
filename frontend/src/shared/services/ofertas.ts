import { apiRequest } from './api'
import {
  normalizarDetalle,
  normalizarOfertaProducto,
  type Oferta,
  type OfertaConProductos,
  type OfertaProducto,
} from '../../features/ofertas/ofertas'

/** Offers that were not soft deleted. A pollería will not reach 1000. */
export async function fetchOfertas(): Promise<Oferta[]> {
  const query = new URLSearchParams({ limite: '1000' })
  return await apiRequest<Oferta[]>(`ofertas?${query.toString()}`)
}

export async function fetchOferta(id: string): Promise<OfertaConProductos> {
  const detalle = await apiRequest<OfertaConProductos>(`ofertas/${id}`)
  return normalizarDetalle(detalle)
}

type PayloadOferta = {
  nombre: string
  descripcion: string
  fechaInicio: string
  fechaFin: string
  productos: { productoId: number; precioOferta: string }[]
}

type PayloadActualizacion = Omit<PayloadOferta, 'productos'>

/** Creates the offer and all of its products in one transaction. */
export async function crearOferta(payload: PayloadOferta): Promise<OfertaConProductos> {
  const detalle = await apiRequest<OfertaConProductos>('ofertas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizarDetalle(detalle)
}

/** Updates the offer header. Its products are managed on their own routes. */
export async function actualizarOferta(
  id: string,
  payload: PayloadActualizacion
): Promise<OfertaConProductos> {
  const detalle = await apiRequest<OfertaConProductos>(`ofertas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return normalizarDetalle(detalle)
}

export async function desactivarOferta(id: string): Promise<Oferta> {
  return await apiRequest<Oferta>(`ofertas/${id}`, { method: 'DELETE' })
}

export async function fetchProductosDeOferta(id: string): Promise<OfertaProducto[]> {
  const productos = await apiRequest<OfertaProducto[]>(`ofertas/${id}/productos`)
  return productos.map(normalizarOfertaProducto)
}

export async function actualizarPrecioEnOferta(
  ofertaId: string,
  productoId: number,
  precioOferta: string
): Promise<{ ofertaId: string; productoId: number; precioOferta: string; activo: boolean }> {
  return await apiRequest(`ofertas/${ofertaId}/productos/${productoId}`, {
    method: 'PUT',
    body: JSON.stringify({ precioOferta }),
  })
}

export async function quitarProductoDeOferta(
  ofertaId: string,
  productoId: number
): Promise<{ ofertaId: string; productoId: number; activo: boolean; fechaBaja: string | null }> {
  return await apiRequest(`ofertas/${ofertaId}/productos/${productoId}`, { method: 'DELETE' })
}
