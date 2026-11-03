import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { ApiError } from '../../shared/services/api'
import { guardarRecepcion, type Compra } from '../../shared/services/abastecimiento'
import { cantidadFormato, errorMensaje } from '../../shared/lib/operaciones'
import { numeroInput } from './calculos'

const presentaciones: Record<string, string> = { KILOS: 'KILOS', UNIDADES: 'UNIDAD', CAJONES: 'CAJON', CAJAS: 'CAJA', BOLSAS: 'BOLSA', BULTOS: 'BULTO' }
export function RecepcionModal({ compra, onClose, onGuardado }: { compra: Compra; onClose: () => void; onGuardado: (id: number) => void }) {
  const [lineas, setLineas] = useState(() => compra.detalles.map(d => ({ productoId: d.productoId, cantidad: String(d.cantidadPresentacion ?? d.cantidad), factor: String(d.factorConversion ?? 1), presentacion: d.cantidadPresentacion ? presentaciones[d.presentacion ?? ''] ?? d.presentacion ?? (d.producto?.unidadVenta === 'UNIDADES' ? 'UNIDAD' : 'KILOS') : d.producto?.unidadVenta === 'UNIDADES' ? 'UNIDAD' : 'KILOS' })))
  const [observaciones, setObservaciones] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false)
  const lock = useRef(false)
  const patch = (i: number, cambios: Partial<typeof lineas[number]>) => setLineas(actual => actual.map((l, j) => j === i ? { ...l, ...cambios } : l))
  const diferencias = lineas.some((l, i) => Math.abs(Number((numeroInput(l.cantidad) * numeroInput(l.factor)).toFixed(3)) - Number(compra.detalles[i].cantidad)) > 0.001)
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (lock.current || incierto) return
    setError('')
    try {
      const detalles = lineas.map((l, i) => {
        const cantidadPresentacion = numeroInput(l.cantidad), factorConversion = numeroInput(l.factor)
        const base = Number((cantidadPresentacion * factorConversion).toFixed(3))
        if (!Number.isFinite(base) || !Number.isFinite(cantidadPresentacion) || !Number.isFinite(factorConversion) || cantidadPresentacion <= 0 || factorConversion <= 0 || base <= 0) throw new Error('Indicá cantidades y factores positivos.')
        if (compra.detalles[i].producto?.unidadVenta === 'UNIDADES' && !Number.isSafeInteger(base)) throw new Error('Las existencias por unidad deben ser enteras.')
        return { productoId: l.productoId, presentacion: l.presentacion, cantidadPresentacion, factorConversion }
      })
      if (diferencias && !observaciones.trim()) throw new Error('Justificá las diferencias entre lo comprado y lo recibido.')
      lock.current = true; setSaving(true)
      const resultado = await guardarRecepcion({ compraId: compra.id, observaciones: observaciones.trim(), detalles })
      onGuardado(resultado.recepcion.id)
    } catch (fallo) {
      setError(errorMensaje(fallo))
      if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) setIncierto(true)
    } finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={`Recibir compra #${compra.id}`} onClose={onClose} busy={saving}><form onSubmit={enviar}><ErrorCarga error={error}/><p>Registrá todos los productos en una única recepción. Se actualizarán existencias y costos; la deuda conserva el importe de la compra.</p>
    {incierto && <div role="alert" className="notice error">No se pudo confirmar el resultado. Cerrá esta ventana y revisá el historial de recepciones antes de reintentar.</div>}
    <fieldset className="operation-fieldset" disabled={saving || incierto}><div className="supply-lines">{lineas.map((l, i) => { const d = compra.detalles[i], base = numeroInput(l.cantidad) * numeroInput(l.factor); return <div className="supply-line" key={l.productoId}><h3>{d.producto?.nombre ?? `Producto #${l.productoId}`}</h3><p>Comprado: {cantidadFormato(d.cantidad)} {d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'}</p><div className="form-grid">
      <label>Presentación<select aria-label={`Presentación producto ${i + 1}`} value={l.presentacion} onChange={e => {
        const p = e.target.value, esBase = p === 'KILOS' || p === 'UNIDAD'
        patch(i, { presentacion: p, factor: esBase ? '1' : String(d.factorConversion ?? d.producto?.factorConversion ?? 1), cantidad: '' })
      }}>{[d.producto?.unidadVenta === 'UNIDADES' ? 'UNIDAD' : 'KILOS', 'CAJON', 'CAJA', 'BOLSA', 'BULTO'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Cantidad recibida<input aria-label={`Cantidad recibida producto ${i + 1}`} required inputMode="decimal" value={l.cantidad} onChange={e => patch(i, { cantidad: e.target.value })}/></label>
      <label>Equivalencia por presentación<input aria-label={`Factor producto ${i + 1}`} required disabled={l.presentacion === 'KILOS' || l.presentacion === 'UNIDAD'} inputMode="decimal" value={l.factor} onChange={e => patch(i, { factor: e.target.value })}/><small>Kilos/unidades base por presentación. Usá el peso real para cajones de peso variable.</small></label>
      <p aria-live="polite">Ingresarán <strong>{cantidadFormato(Number.isFinite(base) ? Number(base.toFixed(3)) : 0)} {d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'}</strong> al inventario.</p>
    </div></div> })}</div><label className="supply-observations">Observaciones {diferencias ? '(obligatorias por diferencia)' : ''}<textarea required={diferencias} maxLength={300} rows={3} value={observaciones} onChange={e => setObservaciones(e.target.value)}/></label>{diferencias && <p className="form-note">Hay diferencias de cantidad. Quedarán documentadas en esta recepción.</p>}</fieldset>
    <div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || incierto}>{saving ? 'Registrando…' : 'Confirmar recepción e ingresar stock'}</button></div>
  </form></Modal>
}
