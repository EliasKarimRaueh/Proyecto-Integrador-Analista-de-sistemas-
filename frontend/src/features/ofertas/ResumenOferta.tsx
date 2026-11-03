import { formatearMonto, subtotalListaCentavos } from '../../shared/lib/money'
import type { OfertaConProductos } from './ofertas'
import type { Precio } from '../precios/precios'

export function ResumenOferta({ detalle, precios = [] }: { detalle: OfertaConProductos; precios?: Precio[] }) {
  const productos = detalle.productos.filter(p => p.activo)
  const referencias = productos.map(p => p.precioLista ?? precios.find(precio => precio.productoId === p.productoId)?.precioMinorista)
  const subtotal = detalle.resumen?.subtotalLista ?? (productos.length && referencias.every(p => p != null)
    ? productos.reduce((s, p, i) => s + subtotalListaCentavos(String(referencias[i]), p.cantidad ?? 1), 0) / 100
    : null)
  const total = detalle.precioFinal ?? (detalle.descuentoPorcentaje == null
    ? productos.reduce((s, p) => s + Math.round(Number(p.precioOferta) * 100), 0) / 100
    : detalle.resumen?.total)
  if (total == null) return <span className="field-error">{detalle.errorPrecio || 'Sin precio de lista disponible'}</span>
  return <div className="precio-cell offer-price-summary"><small>Subtotal: {formatearMonto(subtotal)}</small><strong>Total: {formatearMonto(total)}</strong></div>
}
