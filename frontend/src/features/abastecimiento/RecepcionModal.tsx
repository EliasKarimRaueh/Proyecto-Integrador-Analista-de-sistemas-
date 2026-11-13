import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { ApiError } from '../../shared/services/api'
import { guardarRecepcion, type Compra, type DetalleAbastecimiento } from '../../shared/services/abastecimiento'
import { cantidadFormato, errorMensaje } from '../../shared/lib/operaciones'
import { formatearMonto } from '../../shared/lib/money'
import { numeroInput } from './calculos'

const presentaciones: Record<string, string> = { KILOS: 'KILOS', UNIDADES: 'UNIDAD', CAJONES: 'CAJON', CAJAS: 'CAJA', BOLSAS: 'BOLSA', BULTOS: 'BULTO' }
const redondear = (n: number) => Number(n.toFixed(3))
const unidadBase = (d: DetalleAbastecimiento) => d.producto?.unidadVenta === 'UNIDADES' ? 'UNIDAD' : 'KILOS'
const unidadCorta = (d: DetalleAbastecimiento) => d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'
const costoBase = (d: DetalleAbastecimiento) => Number(d.importeUnitario ?? d.costoUnitario ?? 0)

type Linea = { productoId: number; presentacion: string; cantidad: string; rechazado: string; factor: string; motivo: string }

export function RecepcionModal({ compra, onClose, onGuardado }: { compra: Compra; onClose: () => void; onGuardado: (id: number) => void }) {
  const [lineas, setLineas] = useState<Linea[]>(() => compra.detalles.map(d => ({
    productoId: d.productoId,
    presentacion: d.cantidadPresentacion ? presentaciones[d.presentacion ?? ''] ?? d.presentacion ?? unidadBase(d) : unidadBase(d),
    cantidad: String(d.cantidadPresentacion ?? d.cantidad),
    rechazado: '0',
    factor: String(d.factorConversion ?? 1),
    motivo: '',
  })))
  const [observaciones, setObservaciones] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false)
  const lock = useRef(false)
  const patch = (i: number, cambios: Partial<Linea>) => setLineas(actual => actual.map((l, j) => j === i ? { ...l, ...cambios } : l))
  const calculos = lineas.map((l, i) => calcularLinea(l, compra.detalles[i]))
  const totalDescuento = calculos.reduce((suma, c) => suma + c.descuento, 0)
  const totalIngreso = calculos.reduce((suma, c) => suma + c.aceptada, 0)

  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (lock.current || incierto) return
    setError('')
    try {
      const detalles = lineas.map((l, i) => {
        const d = compra.detalles[i], factor = numeroInput(l.factor)
        const aceptada = redondear(numeroInput(l.cantidad) * factor), rechazada = redondear(numeroInput(l.rechazado) * factor)
        if (!Number.isFinite(factor) || factor <= 0) throw new Error('Indicá una equivalencia por presentación positiva.')
        if (!Number.isFinite(aceptada) || aceptada < 0 || !Number.isFinite(rechazada) || rechazada < 0) throw new Error('Indicá cantidades aceptadas y rechazadas válidas; pueden ser cero.')
        if (aceptada + rechazada - Number(d.cantidad) > 0.001) throw new Error(`En ${d.producto?.nombre ?? `producto ${i + 1}`} lo aceptado más lo rechazado no puede superar lo comprado.`)
        if (d.producto?.unidadVenta === 'UNIDADES' && (!Number.isSafeInteger(aceptada) || !Number.isSafeInteger(rechazada))) throw new Error('Las existencias por unidad deben ser enteras.')
        const faltante = redondear(Math.max(0, Number(d.cantidad) - aceptada - rechazada))
        if ((rechazada > 0.001 || faltante > 0.001) && !l.motivo.trim() && !observaciones.trim()) throw new Error('Indicá el motivo de las diferencias de cada producto.')
        return { productoId: l.productoId, presentacion: l.presentacion, cantidadPresentacion: numeroInput(l.cantidad), factorConversion: factor, cantidadRechazadaBase: rechazada, motivo: l.motivo.trim() || undefined }
      })
      lock.current = true; setSaving(true)
      const resultado = await guardarRecepcion({ compraId: compra.id, observaciones: observaciones.trim(), detalles })
      onGuardado(resultado.recepcion.id)
    } catch (fallo) {
      setError(errorMensaje(fallo))
      if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) setIncierto(true)
    } finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={`Recibir compra #${compra.id}`} onClose={onClose} busy={saving}><form onSubmit={enviar}><ErrorCarga error={error}/><p>Registrá lo que realmente llegó. Ingresan al inventario solo las cantidades aceptadas y la deuda del proveedor se ajusta por lo rechazado o faltante.</p>
    {incierto && <div role="alert" className="notice error">No se pudo confirmar el resultado. Cerrá esta ventana y revisá el historial de recepciones antes de reintentar.</div>}
    <fieldset className="operation-fieldset" disabled={saving || incierto}><div className="supply-lines">{lineas.map((l, i) => { const d = compra.detalles[i], c = calculos[i]; return <div className="supply-line" key={l.productoId}><h3>{d.producto?.nombre ?? 'Producto no disponible'}</h3><p>Comprado: {cantidadFormato(Number(d.cantidad))} {unidadCorta(d)}</p><div className="form-grid">
      <label>Presentación<select aria-label={`Presentación producto ${i + 1}`} value={l.presentacion} onChange={e => {
        const p = e.target.value, esBase = p === 'KILOS' || p === 'UNIDAD'
        patch(i, { presentacion: p, factor: esBase ? '1' : String(d.factorConversion ?? d.producto?.factorConversion ?? 1), cantidad: '', rechazado: '0' })
      }}>{[unidadBase(d), 'CAJON', 'CAJA', 'BOLSA', 'BULTO'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Cantidad aceptada<input aria-label={`Cantidad aceptada producto ${i + 1}`} inputMode="decimal" value={l.cantidad} onChange={e => patch(i, { cantidad: e.target.value })}/></label>
      <label>Cantidad rechazada<input aria-label={`Cantidad rechazada producto ${i + 1}`} inputMode="decimal" value={l.rechazado} onChange={e => patch(i, { rechazado: e.target.value })}/><small>Mercadería vencida o dañada. No ingresa al inventario.</small></label>
      <label>Equivalencia por presentación<input aria-label={`Factor producto ${i + 1}`} required disabled={l.presentacion === 'KILOS' || l.presentacion === 'UNIDAD'} inputMode="decimal" value={l.factor} onChange={e => patch(i, { factor: e.target.value })}/><small>Kilos/unidades base por presentación. Usá el peso real para cajones de peso variable.</small></label>
    </div>
    <p aria-live="polite">Aceptado: <strong>{cantidadFormato(c.aceptada)} {unidadCorta(d)}</strong> · Rechazado: {cantidadFormato(c.rechazada)} · Faltante: {cantidadFormato(c.faltante)} · Ingresa al inventario: <strong>{cantidadFormato(c.aceptada)} {unidadCorta(d)}</strong></p>
    {c.diferencia && <label>Motivo de la diferencia (producto {i + 1})<input aria-label={`Motivo producto ${i + 1}`} maxLength={200} required={!observaciones.trim()} value={l.motivo} onChange={e => patch(i, { motivo: e.target.value })} placeholder="Ej.: llegó vencido, faltó un cajón…"/></label>}
    </div> })}</div>
    {totalDescuento > 0 && <p className="form-note">Se descontará {formatearMonto(totalDescuento)} de la cuenta corriente por lo no recibido. Ingresarán {cantidadFormato(redondear(totalIngreso))} al inventario.</p>}
    <label className="supply-observations">Observaciones (opcional)<textarea maxLength={300} rows={3} value={observaciones} onChange={e => setObservaciones(e.target.value)}/></label></fieldset>
    <div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || incierto}>{saving ? 'Registrando…' : 'Confirmar recepción e ingresar stock'}</button></div>
  </form></Modal>
}

function calcularLinea(l: Linea, d: DetalleAbastecimiento) {
  const factor = numeroInput(l.factor), comprada = Number(d.cantidad)
  const aceptada = Number.isFinite(numeroInput(l.cantidad)) ? redondear(numeroInput(l.cantidad) * (Number.isFinite(factor) ? factor : 0)) : 0
  const rechazada = Number.isFinite(numeroInput(l.rechazado)) ? redondear(numeroInput(l.rechazado) * (Number.isFinite(factor) ? factor : 0)) : 0
  const faltante = redondear(Math.max(0, comprada - aceptada - rechazada))
  const diferencia = rechazada > 0.001 || faltante > 0.001
  const descuento = redondear((rechazada + faltante) * costoBase(d))
  return { aceptada, rechazada, faltante, diferencia, descuento }
}
