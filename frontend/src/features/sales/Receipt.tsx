import { formatearMonto } from '../../shared/lib/money'
import { cantidadFormato, fechaHoraLocal } from '../../shared/lib/operaciones'
import type { VentaCompleta } from '../../shared/services/operaciones'
export function Receipt({ data }: { data: VentaCompleta }) {
  return <div className="receipt"><div className="receipt-heading"><strong>LA NENA · POLLERÍA</strong><h3>Venta #{data.venta.id}</h3><p>{fechaHoraLocal(data.venta.fechaHora)}</p></div><div className="table-scroll"><table><thead><tr><th>Artículo</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{data.detalles.map((d, i) => <tr key={d.numeroItem ?? i}><td>{d.nombre}</td><td>{cantidadFormato(d.cantidad)}</td><td>{formatearMonto(d.importeUnitario)}</td><td>{formatearMonto(d.subtotal)}</td></tr>)}</tbody></table></div><div className="receipt-total"><span>Total</span><strong>{formatearMonto(data.venta.total)}</strong></div><p className="subtle">Comprobante interno de venta.</p></div>
}
