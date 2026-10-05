import { apiRequest } from './api'

export type Unidad = 'KILOS' | 'UNIDADES'
export type StockProducto = {
  id: number; codigo: string; nombre: string; stockActual: number; stockMinimo: number | null
  margenStock: number | null; unidadVenta: Unidad; estado: 'Normal' | 'Próximo al Mínimo' | 'Crítico'
}
export type ProductoCaja = Omit<StockProducto, 'estado'> & { activo: boolean }
export type Pagina<T> = { rows: T[]; count: number }
export type ListaPrecio = 'MINORISTA' | 'MAYORISTA'
export type LineaVenta = { productoId?: number; ofertaId?: number; cantidad: number; tipoPrecio?: ListaPrecio }
export type DetalleVenta = LineaVenta & { numeroItem?: number; nombre: string; importeUnitario: string | number; subtotal: string | number }
export type Venta = { id: number; fechaHora: string; total: string | number }
export type VentaCompleta = { venta: Venta; detalles: DetalleVenta[] }
export type Cotizacion = { total: string; detalles: DetalleVenta[] }
export type Movimiento = {
  id: number; productoId: number; numeroMovimiento: number; fechaHora: string
  tipo: 'INGRESO' | 'EGRESO'; cantInicial: number; cantMovimiento: number; cantFinal: number
  motivo: string | null; usuarioId: number; ventaId: number | null
}
export type TipoMovimiento = 'INGRESO' | 'EGRESO' | 'AJUSTE' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'MERMA' | 'PERDIDA' | 'VENCIMIENTO' | 'ROTURA'
export type MovimientoInput = { productoId: number; tipo: TipoMovimiento; cantMovimiento?: number; stockObjetivo?: number; motivo: string }
export type DesposteInput = { productoOrigenId: number; cantidadOrigen: number; derivados: { productoId: number; cantidad: number }[]; merma: number; motivo: string }

function consulta(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
  return `${path}?${query}`
}
export async function fetchStock(): Promise<StockProducto[]> {
  // Se recorren todas las páginas; no se recorta el inventario a 1000 filas.
  const productos: StockProducto[] = []
  for (let page = 1; ; page++) {
    const parte = await apiRequest<StockProducto[]>(consulta('stock', { page, limite: 1000 }))
    productos.push(...parte)
    if (parte.length < 1000) return productos
  }
}
export const buscarProductosCaja = (q: string, page = 1, signal?: AbortSignal) => apiRequest<Pagina<ProductoCaja>>(consulta('ventas/productos', { q, page, limite: 20 }), { signal })
export const cotizar = (detalles: LineaVenta[], signal?: AbortSignal) => apiRequest<Cotizacion>('ventas/cotizacion', { method: 'POST', body: JSON.stringify({ detalles }), signal })
export const confirmarVenta = (detalles: LineaVenta[]) => apiRequest<VentaCompleta>('ventas', { method: 'POST', body: JSON.stringify({ detalles }) })
export const guardarMovimiento = (input: MovimientoInput) => apiRequest<Movimiento | null>('stock/movimientos', { method: 'POST', body: JSON.stringify(input) })
export const guardarMinimo = (productoId: number, stockMinimo: number) => apiRequest(`stock/${productoId}/reposicion`, { method: 'PUT', body: JSON.stringify({ stockMinimo }) })
export const guardarDesposte = (input: DesposteInput) => apiRequest<{ operacionId: string; movimientos: Movimiento[]; merma: number }>('stock/fraccionamientos', { method: 'POST', body: JSON.stringify(input) })
export type FiltrosHistorial = { page?: number; limite?: number; fechaDesde?: string; fechaHasta?: string; productoId?: string; tipo?: string; ventaId?: string; operacionId?: string }
export const fetchVentas = (filtros: FiltrosHistorial = {}) => apiRequest<Pagina<VentaCompleta>>(consulta('ventas', { limite: 20, ...filtros }))
export const fetchMovimientos = (filtros: FiltrosHistorial = {}) => apiRequest<Pagina<Movimiento>>(consulta('stock/movimientos', { limite: 20, ...filtros }))
export const fetchVenta = (ventaId: number) => apiRequest<VentaCompleta>(`ventas/${ventaId}`)
