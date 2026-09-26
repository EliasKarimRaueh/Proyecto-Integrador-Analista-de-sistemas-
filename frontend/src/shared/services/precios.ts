import { apiRequest } from './api'
import { normalizarPrecio, type Precio, type PrecioApi } from '../../features/precios/precios'

/** Appends query params, skipping the ones that were not provided. */
function conQuery(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined) query.set(clave, String(valor))
  }
  const cadena = query.toString()
  return cadena ? `${path}?${cadena}` : path
}

/**
 * The current price of every product, in one request.
 *
 * The endpoint returns at most one row per product, which is what the
 * price column needs. Asking product by product would be one request per
 * row, and a product with no price answers 404.
 */
export async function fetchPreciosVigentes(): Promise<Precio[]> {
  const precios = await apiRequest<PrecioApi[]>(conQuery('precios', { limite: 1000 }))
  return precios.map(normalizarPrecio)
}

export async function fetchHistorialPrecios(
  productoId: number,
  page = 1,
  limite = 20
): Promise<Precio[]> {
  const precios = await apiRequest<PrecioApi[]>(
    conQuery(`precios/productos/${productoId}`, { page, limite })
  )
  return precios.map(normalizarPrecio)
}

type PayloadPrecio = {
  productoId: number
  precioMinorista: string
  precioMayorista: string | null
  fechaDesde?: string
}

/**
 * Registers a new price. The API closes the price that was open and
 * leaves the new one as the only current one, in a single transaction.
 */
export async function registrarPrecio(payload: PayloadPrecio): Promise<Precio> {
  const precio = await apiRequest<PrecioApi>('precios', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizarPrecio(precio)
}

/** Corrects the amounts of an existing price without touching its dates. */
export async function actualizarPrecio(
  id: string,
  montos: Pick<PayloadPrecio, 'precioMinorista' | 'precioMayorista'>
): Promise<Precio> {
  const precio = await apiRequest<PrecioApi>(`precios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(montos),
  })
  return normalizarPrecio(precio)
}

export async function desactivarPrecio(id: string): Promise<Precio> {
  const precio = await apiRequest<PrecioApi>(`precios/${id}`, { method: 'DELETE' })
  return normalizarPrecio(precio)
}
