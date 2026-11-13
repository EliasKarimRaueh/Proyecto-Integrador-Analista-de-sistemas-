import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fetchProducts } from '../../shared/services/api'
import { ApiError } from '../../shared/services/api'
import { fetchProductosProveedor } from '../../shared/services/proveedores'
import { guardarCompra, guardarPedido } from '../../shared/services/abastecimiento'
import { hoyComoFechaInput, formatearMonto } from '../../shared/lib/money'
import { errorMensaje, cantidadFormato } from '../../shared/lib/operaciones'
import type { Proveedor } from '../proveedores/proveedores'
import { datosLinea, validarLineas, type LineaEditor } from './calculos'

export type InicioFormulario = { proveedorId?: number; pedidoId?: number; lineas?: LineaEditor[] }
export function FormularioAbastecimiento({ modo, inicio, proveedores, onClose, onGuardado }: { modo: 'pedido' | 'compra'; inicio: InicioFormulario; proveedores: Proveedor[]; onClose: () => void; onGuardado: (id: number) => void }) {
  const [proveedorId, setProveedorId] = useState(String(inicio.proveedorId ?? ''))
  const [lineas, setLineas] = useState<LineaEditor[]>(inicio.lineas ?? [])
  const [fecha, setFecha] = useState(hoyComoFechaInput()), [tipo, setTipo] = useState('FACTURA'), [numero, setNumero] = useState(''), [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false)
  const lock = useRef(false)
  const productos = useApiResource(fetchProducts)
  const relaciones = useApiResource(() => proveedorId ? fetchProductosProveedor(Number(proveedorId)) : Promise.resolve([]), proveedorId)
  const disponibles = (productos.data ?? []).filter(p => p.active && (relaciones.data ?? []).some(r => r.activo && r.productoId === Number(p.id)))
  const patch = (index: number, cambios: Partial<LineaEditor>) => setLineas(actual => actual.map((l, i) => i === index ? { ...l, ...cambios } : l))
  const total = lineas.reduce((s, l) => s + datosLinea(l, productos.data ?? []).subtotal, 0)
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (lock.current || incierto) return
    setError('')
    try {
      if (!proveedores.some(p => p.id === Number(proveedorId) && p.activo)) throw new Error('Seleccioná un proveedor activo.')
      if (!fecha) throw new Error('Indicá una fecha.')
      if (relaciones.loading || relaciones.error) throw new Error('Esperá a que carguen los productos del proveedor.')
      const detalles = validarLineas(lineas, productos.data ?? [])
      if (detalles.some(d => !disponibles.some(p => Number(p.id) === d.productoId))) throw new Error(`${modo === 'pedido' ? 'El pedido' : 'La compra'} solo admite productos asociados al proveedor.`)
      if (modo === 'compra' && !numero.trim()) throw new Error('Ingresá el número de factura o remito.')
      if (!Number.isFinite(total) || total > 99999999.99) throw new Error('El total supera el máximo permitido.')
      lock.current = true; setSaving(true)
      const datos = { proveedorId: Number(proveedorId), fechaHora: `${fecha}T12:00:00-03:00`, observaciones: observaciones.trim(), detalles }
      const id = modo === 'pedido'
        ? (await guardarPedido(datos)).pedido.id
        : (await guardarCompra({ ...datos, pedidoId: inicio.pedidoId, tipoComprobante: tipo, numeroComprobante: numero.trim() })).compra.id
      onGuardado(id)
    } catch (fallo) {
      setError(errorMensaje(fallo))
      if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) setIncierto(true)
    } finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={modo === 'pedido' ? 'Nuevo pedido al proveedor' : inicio.pedidoId ? `Registrar compra del pedido #${inicio.pedidoId}` : 'Registrar compra'} onClose={onClose} busy={saving}>
    <form onSubmit={enviar}><ErrorCarga error={error}/><ErrorCarga error={productos.error} retry={productos.refetch}/><ErrorCarga error={relaciones.error} retry={relaciones.refetch}/>
      {incierto && <div className="notice error" role="alert">No se pudo confirmar el resultado. Revisá el <Link to={modo === 'pedido' ? '/pedidos' : '/compras'} onClick={onClose}>historial</Link> antes de volver a registrar la operación.</div>}
      <fieldset disabled={saving || incierto} className="operation-fieldset"><div className="form-grid">
        <label>Proveedor<select aria-label="Proveedor" required disabled={!!inicio.pedidoId} value={proveedorId} onChange={e => { setProveedorId(e.target.value); setLineas([]) }}><option value="">Seleccionar proveedor</option>{proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <label>Fecha<input type="date" required value={fecha} onChange={e => setFecha(e.target.value)}/></label>
        {modo === 'compra' && <><label>Tipo de comprobante<select value={tipo} onChange={e => setTipo(e.target.value)}><option>FACTURA</option><option>REMITO</option><option>OTRO</option></select></label><label>Número de comprobante<input required maxLength={50} value={numero} onChange={e => setNumero(e.target.value)}/></label></>}
      </div>
      <div className="supply-lines">{lineas.map((l, i) => {
        const d = datosLinea(l, productos.data ?? [])
        return <div className="supply-line" key={i}><div className="form-grid"><label className="full-width">Producto {i + 1}<select required aria-label={`Producto ${i + 1}`} value={l.productoId} onChange={e => {
          const p = disponibles.find(p => p.id === e.target.value)
          patch(i, { productoId: e.target.value, cantidad: '1', unidad: 'VENTA', costo: Number(p?.costoActual ?? 0).toFixed(2), factorConversion: undefined, presentacion: undefined })
        }}><option value="">Seleccionar producto</option>{disponibles.filter(p => p.id === l.productoId || !lineas.some(otra => otra.productoId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Medir en<select aria-label={`Medir producto ${i + 1} en`} value={l.unidad} onChange={e => { const unidad = e.target.value as LineaEditor['unidad']; patch(i, { unidad, cantidad: '1', costo: ((Number(d.producto?.costoActual ?? 0)) * (unidad === 'COMPRA' ? d.producto?.factorConversion ?? 1 : 1)).toFixed(2) }) }}><option value="VENTA">Venta · {d.producto?.unit ?? 'kg/un.'}</option><option value="COMPRA">Compra · {d.producto?.unidadCompra ?? 'presentación'}</option></select></label>
          <label>Cantidad<input aria-label={`Cantidad producto ${i + 1}`} required inputMode="decimal" value={l.cantidad} onChange={e => patch(i, { cantidad: e.target.value })}/></label>
          <label>{modo === 'pedido' ? 'Costo estimado' : 'Costo'} por {l.unidad === 'COMPRA' ? 'presentación' : d.producto?.unit ?? 'unidad'}<input aria-label={`Costo producto ${i + 1}`} required inputMode="decimal" value={l.costo} onChange={e => patch(i, { costo: e.target.value })}/></label>
          <div><small>Subtotal</small><strong className="supply-amount">{formatearMonto(Number.isFinite(d.subtotal) ? d.subtotal : 0)}</strong></div>
        </div><div className="operation-actions"><small>{cantidadFormato(d.cantidadBase || 0)} {d.producto?.unit} de inventario · costo base {formatearMonto(d.costoBase || 0)}</small><button type="button" className="button" onClick={() => setLineas(actual => actual.filter((_, j) => j !== i))}>Quitar producto {i + 1}</button></div></div>
      })}</div>
      <button type="button" className="button" disabled={!proveedorId || productos.loading || relaciones.loading || lineas.length >= 100} onClick={() => setLineas(actual => [...actual, { productoId: '', cantidad: '1', costo: '0.00', unidad: 'VENTA' }])}>Agregar producto</button>
      {!productos.loading && proveedorId && !relaciones.loading && !disponibles.length && <p>Este proveedor no tiene productos activos asociados. Asociálos desde Proveedores.</p>}
      <label className="supply-observations">Observaciones<textarea maxLength={300} value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}/></label>
      <div className="receipt-total" aria-live="polite"><span>Total {modo === 'pedido' ? 'estimado' : 'de la compra'}</span><strong>{formatearMonto(Number.isFinite(total) ? total : 0)}</strong></div>
      {modo === 'compra' && <p className="form-note">La compra genera deuda en la cuenta corriente. El stock se actualiza al registrar la recepción física.</p>}
      </fieldset><div className="modal-footer"><button type="button" className="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="button primary" disabled={saving || incierto || productos.loading || !!productos.error || !lineas.length}>{saving ? 'Guardando…' : modo === 'pedido' ? 'Registrar pedido' : 'Registrar compra'}</button></div>
    </form>
  </Modal>
}
