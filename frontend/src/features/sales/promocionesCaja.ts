import { subtotalListaCentavos } from '../../shared/lib/money'
import type { OfertaConProductos } from '../ofertas/ofertas'
import type { Precio } from '../precios/precios'
import type { ListaPrecio } from '../../shared/services/operaciones'

export function resumenOfertaCaja(oferta: OfertaConProductos, precios: Precio[], lista: ListaPrecio) {
  const componentes = oferta.productos.filter(p => p.activo)
  if (!componentes.length) return null
  if (oferta.precioFinal != null) {
    const total = Number(oferta.precioFinal)
    return Number.isFinite(total) && total > 0 ? { subtotal: total, descuento: 0, total } : null
  }
  if (oferta.descuentoPorcentaje == null) {
    const total = componentes.reduce((s, p) => s + Math.round(Number(p.precioOferta) * 100), 0)
    return Number.isFinite(total) ? { subtotal: total / 100, descuento: 0, total: total / 100 } : null
  }
  let subtotal = 0
  for (const p of componentes) {
    const precio = precios.find(i => i.productoId === p.productoId)
    const monto = lista === 'MINORISTA' ? precio?.precioMinorista : precio?.precioMayorista
    if (monto == null) return null
    subtotal += subtotalListaCentavos(String(monto), p.cantidad ?? 1)
  }
  const descuento = Number((BigInt(subtotal) * BigInt(Math.round(Number(oferta.descuentoPorcentaje) * 100)) + 5000n) / 10000n)
  return { subtotal: subtotal / 100, descuento: descuento / 100, total: (subtotal - descuento) / 100 }
}
