import { formatearMonto } from '../../shared/lib/money'
import type { OfertaConProductos } from './ofertas'

export function ResumenOferta({ detalle }: { detalle: OfertaConProductos }) {
  if (detalle.descuentoPorcentaje == null) {
    const total = detalle.productos.filter(p => p.activo).reduce((s, p) => s + Math.round(Number(p.precioOferta) * 100), 0)
    return <div className="precio-cell"><strong>{formatearMonto(total / 100)}</strong><small>Combo con precio anterior</small></div>
  }
  if (!detalle.resumen) return <span className="field-error">{detalle.errorPrecio || 'Sin precio de lista disponible'}</span>
  return <div className="precio-cell"><small>Subtotal de lista: {formatearMonto(detalle.resumen.subtotalLista)}</small><small>Descuento {Number(detalle.descuentoPorcentaje)}%: −{formatearMonto(detalle.resumen.descuento)}</small><strong>Total: {formatearMonto(detalle.resumen.total)}</strong></div>
}
