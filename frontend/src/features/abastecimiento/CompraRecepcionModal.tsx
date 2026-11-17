import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { ApiError } from '../../shared/services/api'
import { fetchRecepcion, guardarCompra, listarAbastecimiento, type Recepcion } from '../../shared/services/abastecimiento'
import { fetchProveedores } from '../../shared/services/proveedores'
import { formatearMonto } from '../../shared/lib/money'
import { cantidadFormato, errorMensaje } from '../../shared/lib/operaciones'
import { fechaTexto } from './calculos'

export function SeleccionarRecepcionModal({ proveedorId, onSelect, onClose }: { proveedorId?: number; onSelect: (id: number) => void; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const recurso = useApiResource(() => listarAbastecimiento<Recepcion>('recepciones', { page, proveedorId: proveedorId ? String(proveedorId) : undefined }), `${proveedorId}:${page}`)
  return <Modal title="Elegir recepción para registrar compra" onClose={onClose}><ErrorCarga error={recurso.error} retry={recurso.refetch}/><p>La compra debe partir de mercadería ya recibida.</p>{recurso.loading ? <p>Cargando recepciones...</p> : <>{recurso.data?.rows.filter(r => !r.compra).map(r => <p key={r.id}><button className="button" onClick={() => onSelect(r.id)}>Recepción #{r.id} · Pedido #{r.pedidoId} · {r.proveedor?.nombre}</button></p>)}{!recurso.data?.rows.some(r => !r.compra) && <p>No hay recepciones pendientes de compra en esta página.</p>}<div className="operation-actions"><button className="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button><button className="button" disabled={page * 20 >= (recurso.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>Siguiente</button></div></>}</Modal>
}

export function CompraRecepcionModal({ recepcionId, onClose, onGuardado }: { recepcionId: number; onClose: () => void; onGuardado: (id: number) => void }) {
  const recurso = useApiResource(async () => {
    const [recepcion, proveedores] = await Promise.all([fetchRecepcion(recepcionId), fetchProveedores()])
    return { recepcion, proveedor: proveedores.find(p => p.id === recepcion.proveedorId) }
  }, recepcionId)
  const [costos, setCostos] = useState<Record<number, string>>({}), [tipo, setTipo] = useState(''), [numero, setNumero] = useState(''), [observaciones, setObservaciones] = useState('')
  const [formaPago, setFormaPago] = useState<'PAGADO' | 'A CUENTA' | ''>('')
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false)
  const lock = useRef(false), [ahora] = useState(() => new Date().toISOString())
  const recibidos = recurso.data?.recepcion.detalles.filter(d => Number(d.cantidadBase) > 0) ?? []
  const costo = (id: number, cantidad: number, inicial?: string) => costos[id] ?? (cantidad * Number(inicial ?? 0)).toFixed(2)
  const pago = recurso.data?.proveedor?.ctaCte ? formaPago || 'A CUENTA' : 'PAGADO'
  const total = recibidos.reduce((s, d) => s + Math.round(Number(costo(d.productoId, Number(d.cantidadBase), d.producto?.costoActual).replace(',', '.')) * 100), 0) / 100
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (lock.current || incierto) return
    setError('')
    try {
      if (!recibidos.length) throw new Error('La recepción no tiene mercadería aceptada para comprar.')
      const detalles = recibidos.map(d => {
        const valor = costo(d.productoId, Number(d.cantidadBase), d.producto?.costoActual).replace(',', '.')
        if (!/^\d+(\.\d{1,2})?$/.test(valor) || Number(valor) > 99999999.99) throw new Error('Ingresá costos válidos de hasta dos decimales.')
        return { productoId: d.productoId, costo: Number(valor).toFixed(2) }
      })
      lock.current = true; setSaving(true)
      const resultado = await guardarCompra({ recepcionId, formaPago: pago, tipoComprobante: tipo || null, numeroComprobante: numero.trim() || null, observaciones: observaciones.trim(), detalles })
      onGuardado(resultado.compra.id)
    } catch (fallo) { setError(errorMensaje(fallo)); if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) setIncierto(true) }
    finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={`Registrar compra de recepción #${recepcionId}`} onClose={onClose} busy={saving}><ErrorCarga error={recurso.error} retry={recurso.refetch}/>{recurso.loading ? <p>Cargando recepción...</p> : recurso.data && <form onSubmit={enviar} noValidate><ErrorCarga error={error}/>{incierto && <p role="alert">No se pudo confirmar el resultado. Revisá las compras antes de volver a registrarla.</p>}<p>Pedido #{recurso.data.recepcion.pedidoId} · {recurso.data.proveedor?.nombre}</p><p>Fecha y hora actual: {fechaTexto(ahora)}. Se asigna automáticamente al guardar.</p><fieldset className="operation-fieldset" disabled={saving || incierto}><div className="form-grid">
    <label>Tipo de comprobante (opcional)<select value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Sin comprobante</option><option>FACTURA</option><option>REMITO</option><option>OTRO</option></select></label><label>Número de comprobante (opcional)<input maxLength={80} value={numero} onChange={e => setNumero(e.target.value)}/></label>
    <label>Forma de pago<select value={pago} disabled={!recurso.data.proveedor?.ctaCte} onChange={e => setFormaPago(e.target.value as 'PAGADO' | 'A CUENTA')}><option value="PAGADO">PAGADO</option>{recurso.data.proveedor?.ctaCte && <option value="A CUENTA">A CUENTA</option>}</select></label></div>
    <div className="supply-lines">{recibidos.map((d, i) => { const cantidad = Number(d.cantidadBase), valor = costo(d.productoId, cantidad, d.producto?.costoActual); return <div className="supply-line" key={d.productoId}><h3>{d.producto?.nombre}</h3><p>Medir en: {d.presentacion} · Cantidad: {d.cantidadPresentacion} · Factor: {d.factorConversion} · Total: {cantidadFormato(cantidad)} {d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'}</p><label className="compra-costo-label"><span>Costo total</span><input aria-label={`Costo producto ${i + 1}`} inputMode="decimal" value={valor} onChange={e => setCostos(actual => ({ ...actual, [d.productoId]: e.target.value }))}/></label><p>Costo por {d.producto?.unidadVenta === 'UNIDADES' ? 'unidad' : 'kg'}: {formatearMonto(Number(valor.replace(',', '.')) / cantidad)}</p></div> })}</div>
    <label className="supply-observations"><span>Observaciones</span><textarea rows={3} maxLength={300} value={observaciones} onChange={e => setObservaciones(e.target.value)}/></label><div className="receipt-total"><span>Total de la compra</span><strong>{formatearMonto(total)}</strong></div><p>La mercadería ya ingresó al stock en la recepción. Esta compra registra los costos y su pago.</p></fieldset><div className="modal-footer"><button className="button" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || incierto || !recibidos.length}>{saving ? 'Guardando...' : 'Registrar compra'}</button></div></form>}</Modal>
}
