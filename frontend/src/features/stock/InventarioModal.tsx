import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { cantidadFormato, cantidadInput, errorMensaje, unidadCorta } from '../../shared/lib/operaciones'
import { guardarInventario, type StockProducto } from '../../shared/services/operaciones'
import { ApiError } from '../../shared/services/api'
import { normalize } from '../products/products'

export function InventarioModal({ productos, onClose, onGuardado }: { productos: StockProducto[]; onClose: () => void; onGuardado: (ajustes: number) => void }) {
  const [referencia] = useState(() => productos.map(p => ({ ...p })))
  const [conteos, setConteos] = useState<Record<number, string>>({})
  const [buscar, setBuscar] = useState(''), [motivo, setMotivo] = useState('')
  const [confirmar, setConfirmar] = useState(false), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const visibles = referencia.filter(p => normalize(`${p.codigo} ${p.nombre}`).includes(normalize(buscar)))
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (lock.current || incierto) return
    setError('')
    try {
      if (motivo.trim().length < 5 || motivo.trim().length > 200) throw new Error('Indicá un motivo de entre 5 y 200 caracteres.')
      const lineas = referencia.map(p => {
        try { return { productoId: p.id, stockEsperado: p.stockActual, stockContado: cantidadInput(conteos[p.id] ?? '', p.unidadVenta, true) } }
        catch { throw new Error(`Completá un conteo válido para ${p.nombre}. Se permite cero.`) }
      })
      if (!confirmar) { setConfirmar(true); return }
      lock.current = true; setSaving(true)
      const resultado = await guardarInventario(lineas, motivo.trim())
      onGuardado(resultado.ajustes)
    } catch (fallo) {
      if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) {
        setIncierto(true); setError('No se pudo comprobar el resultado. Cerrá el conteo y revisá las existencias y los movimientos antes de registrar otro inventario.')
      } else { setError(errorMensaje(fallo)); setConfirmar(false) }
    } finally { lock.current = false; setSaving(false) }
  }
  return <Modal title="Registrar nuevo inventario" busy={saving} onClose={onClose}>
    <p>Contá todos los productos en su unidad de venta. Ingresá cero cuando no haya existencias. Se registrará un ajuste por cada diferencia.</p>
    <form onSubmit={enviar} noValidate>
      <ErrorCarga error={error}/>
      <fieldset className="operation-fieldset" disabled={saving || incierto || confirmar}>
        <label className="search-field"><input aria-label="Buscar producto en conteo" placeholder="Buscar producto..." value={buscar} onChange={e => setBuscar(e.target.value)}/></label>
        <p>{referencia.filter(p => conteos[p.id]?.trim()).length} de {referencia.length} productos contados</p>
        <div className="table-scroll inventory-count"><table><thead><tr><th>Producto</th><th>Stock registrado</th><th>Stock contado</th></tr></thead><tbody>{visibles.map(p => <tr key={p.id}><td>{p.nombre}</td><td>{cantidadFormato(p.stockActual)} {unidadCorta(p.unidadVenta)}</td><td><input className="precio-input" aria-label={`Stock contado de ${p.nombre}`} inputMode={p.unidadVenta === 'UNIDADES' ? 'numeric' : 'decimal'} value={conteos[p.id] ?? ''} onChange={e => setConteos(actual => ({ ...actual, [p.id]: e.target.value }))}/><span> {unidadCorta(p.unidadVenta)}</span></td></tr>)}</tbody></table></div>
        {!visibles.length && <p>No hay productos para esta búsqueda.</p>}
        <label>Motivo del inventario<textarea value={motivo} maxLength={200} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Conteo físico de cierre"/></label>
      </fieldset>
      {confirmar && !incierto && <p role="status">Se guardará el conteo de los {referencia.length} productos. Se actualizarán todas las diferencias juntas y quedarán registradas en movimientos.</p>}
      <div className="modal-footer"><button className="button" type="button" disabled={saving} onClick={onClose}>{incierto ? 'Cerrar y revisar existencias' : 'Cancelar'}</button>{confirmar && !incierto && <button className="button" type="button" disabled={saving} onClick={() => setConfirmar(false)}>Corregir conteo</button>}<button className="button primary" disabled={saving || incierto}>{saving ? 'Guardando...' : confirmar ? 'Confirmar inventario' : 'Revisar inventario'}</button></div>
    </form>
  </Modal>
}
