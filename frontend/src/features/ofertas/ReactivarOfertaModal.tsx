import { fechaInputOferta } from './fechasOfertas'
import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { reactivarOferta } from '../../shared/services/ofertas'
import { hoyComoFechaInput } from '../../shared/lib/money'
import type { Oferta } from './ofertas'

export function ReactivarOfertaModal({ oferta, onClose, onGuardado }: { oferta: Oferta; onClose: () => void; onGuardado: () => void }) {
  const [desde, setDesde] = useState(hoyComoFechaInput()), [hasta, setHasta] = useState(oferta.fechaFin && fechaInputOferta(oferta.fechaFin) > hoyComoFechaInput() ? fechaInputOferta(oferta.fechaFin) : '')
  const [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const lock = useRef(false)
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setSaving(true); setError('')
    try { await reactivarOferta(oferta.id, { fechaInicio: desde, fechaFin: hasta || null }); onGuardado() }
    catch (fallo) { setError(fallo instanceof Error ? fallo.message : 'No se pudo reactivar la oferta.') }
    finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={`Reactivar ${oferta.nombre}`} onClose={onClose} busy={saving}><form onSubmit={enviar}><ErrorCarga error={error}/><p>Elegí su vigencia. Se comprobarán productos activos, precios y superposiciones con otras promociones antes de reactivarla.</p><fieldset className="operation-fieldset" disabled={saving}><div className="form-grid"><label>Vigente desde<input required type="date" value={desde} onChange={e => setDesde(e.target.value)}/></label><label>Vigente hasta (opcional)<input type="date" min={desde} value={hasta} onChange={e => setHasta(e.target.value)}/><small>Vacío significa sin fecha de finalización.</small></label></div></fieldset><div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Reactivando…' : 'Confirmar reactivación'}</button></div></form></Modal>
}
