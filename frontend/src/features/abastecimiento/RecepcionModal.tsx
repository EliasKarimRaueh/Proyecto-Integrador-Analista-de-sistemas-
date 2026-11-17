import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fetchProducts, ApiError } from '../../shared/services/api'
import { fetchProductosProveedor } from '../../shared/services/proveedores'
import { guardarRecepcion, type PedidoCompra } from '../../shared/services/abastecimiento'
import { cantidadFormato, cantidadInput, errorMensaje } from '../../shared/lib/operaciones'
import { fechaTexto } from './calculos'

const presentaciones: Record<string, string> = { KILOS: 'KILOS', UNIDADES: 'UNIDAD', CAJONES: 'CAJON', CAJAS: 'CAJA', BOLSAS: 'BOLSA', BULTOS: 'BULTO' }
type Linea = { productoId: number; presentacion: string; cantidad: string; rechazado: string; factor: string; motivo: string }
const redondear = (n: number) => Number(n.toFixed(3))

export function RecepcionModal({ pedido, onClose, onGuardado }: { pedido: PedidoCompra; onClose: () => void; onGuardado: (id: number) => void }) {
  const productos = useApiResource(fetchProducts)

  const relaciones = useApiResource(
    () => pedido.proveedorId != null
      ? fetchProductosProveedor(Number(pedido.proveedorId))
      : Promise.resolve([]),
    pedido.proveedorId
  )

  const disponibles = (productos.data ?? []).filter(p =>
    p.active &&
    (relaciones.data ?? []).some(r =>
      r.activo && r.productoId === Number(p.id)
    )
  )
  
  const [lineas, setLineas] = useState<Linea[]>(() => pedido.detalles.map(d => ({ productoId: d.productoId, presentacion: d.cantidadPresentacion != null ? presentaciones[d.presentacion ?? ''] ?? d.presentacion ?? 'KILOS' : d.producto?.unidadVenta === 'UNIDADES' ? 'UNIDAD' : 'KILOS', cantidad: String(d.cantidadPresentacion ?? d.cantidad), rechazado: '0', factor: String(d.factorConversion ?? 1), motivo: '' })))
  const [extra, setExtra] = useState(''), [observaciones, setObservaciones] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false)
  const [ahora] = useState(() => new Date().toISOString()), lock = useRef(false)
  const patch = (i: number, cambios: Partial<Linea>) => setLineas(actual => actual.map((l, j) => i === j ? { ...l, ...cambios } : l))
  function datos(l: Linea) {
    const detalle = pedido.detalles.find(d => d.productoId === l.productoId)
    const producto = productos.data?.find(p => Number(p.id) === l.productoId)
    const unit = producto?.unit ?? (detalle?.producto?.unidadVenta === 'UNIDADES' ? 'unidad' : 'kg')
    const pedida = Number(detalle?.cantidad ?? 0), factor = Number(l.factor.replace(',', '.'))
    const aceptada = redondear(Number(l.cantidad.replace(',', '.')) * factor), rechazada = redondear(Number(l.rechazado.replace(',', '.')) * factor)
    return { nombre: producto?.name ?? detalle?.producto?.nombre ?? `Producto #${l.productoId}`, unit, pedida, factor, aceptada, rechazada, faltante: redondear(Math.max(0, pedida - aceptada - rechazada)), sobrante: redondear(Math.max(0, aceptada + rechazada - pedida)), producto }
  }
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (lock.current || incierto) return
    setError('')
    try {
      const detalles = lineas.map(l => {
        const d = datos(l)
        if (!l.cantidad.trim() || !l.rechazado.trim() || !Number.isFinite(d.factor) || d.factor <= 0) throw new Error('Indicá cantidades y una equivalencia válidas.')
        cantidadInput(String(d.aceptada), d.unit === 'unidad' ? 'UNIDADES' : 'KILOS', true)
        cantidadInput(String(d.rechazada), d.unit === 'unidad' ? 'UNIDADES' : 'KILOS', true)
        if ((d.faltante > 0 || d.rechazada > 0) && !l.motivo.trim() && !observaciones.trim()) throw new Error('Indicá el motivo de los faltantes o rechazos.')
        return { productoId: l.productoId, presentacion: l.presentacion, cantidadPresentacion: Number(l.cantidad.replace(',', '.')), factorConversion: d.factor, cantidadRechazadaBase: d.rechazada, motivo: l.motivo.trim() || undefined }
      })
      lock.current = true; setSaving(true)
      const resultado = await guardarRecepcion({ pedidoId: pedido.id, observaciones: observaciones.trim(), detalles })
      onGuardado(resultado.recepcion.id)
    } catch (fallo) { setError(errorMensaje(fallo)); if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) setIncierto(true) }
    finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={`Recibir pedido #${pedido.id}`} onClose={onClose} busy={saving}><form onSubmit={enviar} noValidate>
    <ErrorCarga error={error}/><ErrorCarga error={productos.error} retry={productos.refetch}/><ErrorCarga error={relaciones.error} retry={relaciones.refetch}/>
    <p>Pedido de origen: #{pedido.id} · Fecha y hora actual: {fechaTexto(ahora)} · Recibe: Dueño</p>
    <p>Se toma la fecha y hora automáticamente al confirmar. Solo lo aceptado ingresa al stock; la compra se registra después.</p>
    {incierto && <p role="alert">No se pudo confirmar el resultado. Revisá el historial de recepciones antes de volver a registrarla.</p>}
    <fieldset className="operation-fieldset" disabled={saving || incierto}>
      <div className="supply-lines">{lineas.map((l, i) => { const d = datos(l); return <div className="supply-line" key={l.productoId}><h3>{d.nombre}</h3><p>Pedido: {cantidadFormato(d.pedida)} {d.unit === 'unidad' ? 'un.' : 'kg'}</p><div className="form-grid">
        <label>Presentación<select aria-label={`Presentación producto ${i + 1}`} value={l.presentacion} onChange={e => { const p = e.target.value; patch(i, { presentacion: p, factor: p === 'KILOS' || p === 'UNIDAD' ? '1' : String(d.producto?.factorConversion ?? 1) }) }}>{[d.unit === 'unidad' ? 'UNIDAD' : 'KILOS', 'CAJON', 'CAJA', 'BOLSA', 'BULTO'].map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Cantidad aceptada<input aria-label={`Cantidad aceptada producto ${i + 1}`} inputMode="decimal" value={l.cantidad} onChange={e => patch(i, { cantidad: e.target.value })}/></label>
        <label>Cantidad rechazada<input aria-label={`Cantidad rechazada producto ${i + 1}`} inputMode="decimal" value={l.rechazado} onChange={e => patch(i, { rechazado: e.target.value })}/></label>
        <label>Equivalencia por presentación<input aria-label={`Factor producto ${i + 1}`} disabled={l.presentacion === 'KILOS' || l.presentacion === 'UNIDAD'} inputMode="decimal" value={l.factor} onChange={e => patch(i, { factor: e.target.value })}/></label>
      </div><p aria-live="polite">Aceptado: {cantidadFormato(d.aceptada)} {d.unit === 'unidad' ? 'un.' : 'kg'} · Rechazado: {cantidadFormato(d.rechazada)} · {d.sobrante > 0 ? `Sobrante: ${cantidadFormato(d.sobrante)}` : `Faltante: ${cantidadFormato(d.faltante)}`} · Ingresa al inventario: {cantidadFormato(d.aceptada)} {d.unit === 'unidad' ? 'un.' : 'kg'}</p>
      {(d.faltante > 0 || d.rechazada > 0 || d.sobrante > 0) && <label>Motivo de la diferencia<input aria-label={`Motivo producto ${i + 1}`} maxLength={200} value={l.motivo} onChange={e => patch(i, { motivo: e.target.value })}/></label>}
      {!pedido.detalles.some(p => p.productoId === l.productoId) && <button className="button" type="button" onClick={() => setLineas(actual => actual.filter(p => p.productoId !== l.productoId))}>Quitar producto extra</button>}
      </div> })}</div>
      <div className="form-grid"><label>Producto no incluido en el pedido<select aria-label="Producto adicional recibido" value={extra} onChange={e => setExtra(e.target.value)}>
        <option value="">Seleccionar producto</option>
      {disponibles
        .filter(p => !lineas.some(l => l.productoId === Number(p.id)))
        .map(p => (
          <option key={p.id} value={p.id}>
          {p.name}
        </option>
        ))}
      </select></label><button type="button" className="button" disabled={!extra} onClick={() => { const p = disponibles.find(p => Number(p.id) === Number(extra)); if (!p) return; setLineas(actual => [...actual, { productoId: Number(extra), cantidad: '1', rechazado: '0', factor: '1', presentacion: p.unit === 'unidad' ? 'UNIDAD' : 'KILOS', motivo: '' }]); setExtra('') }}>Agregar producto recibido</button></div>
      <label>Observaciones (opcional)<textarea rows={3} maxLength={300} value={observaciones} onChange={e => setObservaciones(e.target.value)}/></label>
    </fieldset><div className="modal-footer"><button className="button" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || incierto || productos.loading || !!productos.error}>{saving ? 'Registrando...' : 'Confirmar recepción e ingresar stock'}</button></div>
  </form></Modal>
}
