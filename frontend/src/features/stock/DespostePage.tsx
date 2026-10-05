import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Encabezado, ErrorCarga, Vacio } from '../../shared/components/OperacionesUI'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { cantidadInput, cantidadFormato, errorMensaje, validarMotivo } from '../../shared/lib/operaciones'
import { fetchStock, guardarDesposte, type DesposteInput } from '../../shared/services/operaciones'

type Derivado = { key: number; productoId: string; cantidad: string }
export function DespostePage() {
  const stock = useApiResource(fetchStock)
  const productos = (stock.data ?? []).filter(p => p.unidadVenta === 'KILOS')
  const [origen, setOrigen] = useState(''), [cantidad, setCantidad] = useState(''), [merma, setMerma] = useState('0'), [motivo, setMotivo] = useState('')
  const [derivados, setDerivados] = useState<Derivado[]>([{ key: 1, productoId: '', cantidad: '' }])
  const [pending, setPending] = useState<DesposteInput | null>(null), [saving, setSaving] = useState(false)
  const [error, setError] = useState(''), [operacion, setOperacion] = useState('')
  const totalDerivados = derivados.reduce((sum, d) => sum + (Number(d.cantidad.replace(',', '.')) || 0), 0)
  const mermaNumero = Number(merma.replace(',', '.')) || 0
  const balance = (Number(cantidad.replace(',', '.')) || 0) - totalDerivados - mermaNumero
  const productoOrigen = productos.find(p => p.id === Number(origen))
  function preparar(event: FormEvent) {
    event.preventDefault(); setError(''); setOperacion('')
    try {
      if (!productoOrigen) throw new Error('Seleccioná el producto de origen.')
      const cantidadOrigen = cantidadInput(cantidad)
      const mermaValue = cantidadInput(merma || '0', 'KILOS', true)
      const salidas = derivados.map(d => {
        if (!productos.some(p => p.id === Number(d.productoId))) throw new Error('Seleccioná un producto para cada derivado.')
        return { productoId: Number(d.productoId), cantidad: cantidadInput(d.cantidad) }
      })
      if (new Set(salidas.map(d => d.productoId)).size !== salidas.length || salidas.some(d => d.productoId === productoOrigen.id)) throw new Error('Los derivados deben ser distintos entre sí y del origen.')
      if (Math.abs(cantidadOrigen - salidas.reduce((sum, d) => sum + d.cantidad, mermaValue)) > 1e-6) throw new Error('Los kilos de origen deben coincidir con la suma de derivados y merma.')
      setPending({ productoOrigenId: productoOrigen.id, cantidadOrigen, derivados: salidas, merma: mermaValue, motivo: validarMotivo(motivo) })
    } catch (fallo) { setError(errorMensaje(fallo)) }
  }
  async function confirmar() {
    if (!pending || saving) return
    setSaving(true); setError('')
    try {
      const resultado = await guardarDesposte(pending)
      setOperacion(resultado.operacionId); setPending(null); stock.refetch()
      setOrigen(''); setCantidad(''); setMerma('0'); setMotivo(''); setDerivados([{ key: 1, productoId: '', cantidad: '' }])
    } catch (fallo) { setError(errorMensaje(fallo)); setPending(null) } finally { setSaving(false) }
  }
  return <section>
    <Encabezado title="Desposte y fraccionamiento" description="Transformá pollo entero en cortes y registrá la merma de la operación." actions={<Link className="button" to="/stock">Ver inventario</Link>}/>
    <ErrorCarga error={stock.error} retry={stock.refetch}/>
    {operacion && <div className="notice success" role="status"><span>Desposte registrado y existencias actualizadas.</span><Link to={`/movimientos?operacionId=${operacion}`}>Ver movimientos de la operación</Link></div>}
    {stock.loading ? <p role="status">Cargando productos…</p> : productos.length < 2 ? <Vacio>Necesitás al menos dos productos activos medidos en kilos. Registralos en el catálogo para comenzar.</Vacio> : <div className="desposte-layout"><form className="catalog-panel operation-form" onSubmit={preparar}>
      <ErrorCarga error={error}/><fieldset className="operation-fieldset" disabled={saving}><h2>1. Producto de origen</h2><div className="form-grid"><label>Producto<select required value={origen} onChange={e => setOrigen(e.target.value)}><option value="">Seleccionar origen</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} · {cantidadFormato(p.stockActual)} kg</option>)}</select></label><label>Kilos a fraccionar<input required inputMode="decimal" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej. 10"/></label></div>
      <h2 className="operation-section">2. Cortes obtenidos</h2><div className="derived-list">{derivados.map((d, index) => <div className="derived-row" key={d.key}><label>Derivado {index + 1}<select required value={d.productoId} onChange={e => setDerivados(current => current.map(row => row.key === d.key ? { ...row, productoId: e.target.value } : row))}><option value="">Seleccionar corte</option>{productos.filter(p => p.id !== Number(origen) && !derivados.some(row => row.key !== d.key && Number(row.productoId) === p.id)).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label>Kilos del derivado {index + 1}<input required inputMode="decimal" value={d.cantidad} onChange={e => setDerivados(current => current.map(row => row.key === d.key ? { ...row, cantidad: e.target.value } : row))} placeholder="Ej. 4,5"/></label><button type="button" className="icon-button danger-text" disabled={derivados.length === 1} aria-label={`Quitar derivado ${index + 1}`} onClick={() => setDerivados(current => current.filter(row => row.key !== d.key))}>×</button></div>)}</div><button type="button" className="button" disabled={derivados.length >= 100 || derivados.length >= productos.length - 1} onClick={() => setDerivados(current => [...current, { key: Math.max(...current.map(d => d.key)) + 1, productoId: '', cantidad: '' }])}>+ Agregar derivado</button>
      <h2 className="operation-section">3. Merma y justificación</h2><div className="form-grid"><label>Merma (kg)<input inputMode="decimal" value={merma} onChange={e => setMerma(e.target.value)}/></label><label className="full-width">Motivo obligatorio<textarea required maxLength={250} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Desposte del lote de la mañana"/></label></div><div className="modal-footer"><button className="button primary" disabled={saving}>Revisar y registrar</button></div></fieldset>
    </form><aside className="catalog-panel balance-panel"><h2>Balance de kilos</h2><dl className="operation-details"><div><dt>Origen</dt><dd>{cantidadFormato(Number(cantidad.replace(',', '.')) || 0)} kg</dd></div><div><dt>Derivados</dt><dd>{cantidadFormato(totalDerivados)} kg</dd></div><div><dt>Merma</dt><dd>{cantidadFormato(mermaNumero)} kg</dd></div><div><dt>Diferencia</dt><dd className={Math.abs(balance) <= 1e-6 ? 'balance-ok' : 'danger-text'}>{cantidadFormato(Math.abs(balance) <= 1e-6 ? 0 : balance)} kg</dd></div></dl><p className="form-note">La diferencia debe ser cero. El origen, los cortes y la merma se guardan juntos; si una operación falla, no se modifica el stock.</p></aside></div>}
    {pending && <Modal title="Confirmar fraccionamiento" busy={saving} onClose={() => setPending(null)}><p>Se descontarán <strong>{cantidadFormato(pending.cantidadOrigen)} kg</strong> de {productoOrigen?.nombre}, se ingresarán {pending.derivados.length} derivados y se registrarán {cantidadFormato(pending.merma)} kg de merma.</p><div className="modal-footer"><button className="button" disabled={saving} onClick={() => setPending(null)}>Volver</button><button className="button primary" disabled={saving} onClick={confirmar}>{saving ? 'Registrando…' : 'Confirmar desposte'}</button></div></Modal>}
  </section>
}
