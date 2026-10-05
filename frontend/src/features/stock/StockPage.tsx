import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../shared/components/Modal'
import { Encabezado, ErrorCarga, EstadoStock, Vacio, Paginacion } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { cantidadInput, cantidadFormato, unidadCorta, errorMensaje, validarMotivo } from '../../shared/lib/operaciones'
import { fetchStock, guardarMinimo, guardarMovimiento, type StockProducto, type TipoMovimiento } from '../../shared/services/operaciones'
import { normalize } from '../products/products'

const tipos: { value: TipoMovimiento; label: string }[] = [
  { value: 'INGRESO', label: 'Entrada' }, { value: 'EGRESO', label: 'Salida' },
  { value: 'AJUSTE', label: 'Ajuste a stock contado' }, { value: 'AJUSTE_POSITIVO', label: 'Ajuste positivo' },
  { value: 'AJUSTE_NEGATIVO', label: 'Ajuste negativo' }, { value: 'MERMA', label: 'Merma' },
  { value: 'VENCIMIENTO', label: 'Baja por vencimiento' }, { value: 'ROTURA', label: 'Baja por rotura' }, { value: 'PERDIDA', label: 'Otra pérdida' },
]
type Editor = { producto: StockProducto; mode: 'movimiento' | 'minimo' }
export function StockPage() {
  const resource = useApiResource(fetchStock)
  const [search, setSearch] = useState(''), [estado, setEstado] = useState('Todos'), [page, setPage] = useState(1)
  const [editor, setEditor] = useState<Editor | null>(null), [tipo, setTipo] = useState<TipoMovimiento>('INGRESO')
  const [cantidad, setCantidad] = useState(''), [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const productos = resource.data ?? []
  const filtered = productos.filter(p => normalize(`${p.codigo} ${p.nombre}`).includes(normalize(search)) && (estado === 'Todos' || p.estado === estado))
  const visible = filtered.slice((page - 1) * 20, page * 20)
  function abrir(producto: StockProducto, mode: Editor['mode']) {
    setEditor({ producto, mode }); setTipo('INGRESO'); setCantidad(mode === 'minimo' ? String(producto.stockMinimo ?? '') : ''); setMotivo(''); setError(''); setNotice('')
  }
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (!editor || saving) return
    setError('')
    try {
      const value = cantidadInput(cantidad, editor.producto.unidadVenta, editor.mode === 'minimo' || tipo === 'AJUSTE')
      const razon = editor.mode === 'movimiento' ? validarMotivo(motivo) : ''
      setSaving(true)
      if (editor.mode === 'minimo') {
        await guardarMinimo(editor.producto.id, value)
        setNotice('Límite de reposición actualizado.')
      } else {
        const movimiento = await guardarMovimiento({ productoId: editor.producto.id, tipo, motivo: razon, ...(tipo === 'AJUSTE' ? { stockObjetivo: value } : { cantMovimiento: value }) })
        setNotice(movimiento ? 'Movimiento registrado y stock actualizado.' : 'El stock contado coincide con el actual. No se generó un movimiento.')
      }
      setEditor(null); resource.refetch()
    } catch (fallo) { setError(errorMensaje(fallo)) } finally { setSaving(false) }
  }
  return <section>
    <Encabezado title="Inventario" description="Existencias, alertas de reposición y movimientos de mercadería." actions={<><button className="button" onClick={resource.refetch}>Actualizar</button><Link className="button" to="/movimientos">Ver movimientos</Link><Link className="button primary" to="/desposte">Desposte</Link></>} />
    <div className="stats-grid">
      {[['Productos activos', productos.length], ['Próximos al mínimo', productos.filter(p => p.estado === 'Próximo al Mínimo').length], ['Stock crítico', productos.filter(p => p.estado === 'Crítico').length]].map(([label, count]) => <div className="stat" key={label}><div><span>{label}</span><strong>{count}</strong></div></div>)}
    </div>
    <ErrorCarga error={resource.error} retry={resource.refetch}/>
    {notice && <div className="notice success" role="status">{notice}</div>}
    <div className="catalog-panel">
      <div className="filters"><label className="search-field"><input aria-label="Buscar stock por nombre o código" placeholder="Buscar por nombre o código…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}/></label><label className="status-filter">Estado<select value={estado} onChange={e => { setEstado(e.target.value); setPage(1) }}>{['Todos', 'Normal', 'Próximo al Mínimo', 'Crítico'].map(s => <option key={s}>{s}</option>)}</select></label></div>
      {resource.loading ? <p className="operation-loading" role="status">Cargando inventario…</p> : <><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Existencias</th><th>Mínimo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><strong>{p.nombre}</strong><small className="product-description">{p.codigo}</small></td><td>{cantidadFormato(p.stockActual)} {unidadCorta(p.unidadVenta)}</td><td>{p.stockMinimo === null ? 'Sin configurar' : `${cantidadFormato(p.stockMinimo)} ${unidadCorta(p.unidadVenta)}`}</td><td><EstadoStock estado={p.estado}/></td><td><div className="operation-actions"><button className="button" onClick={() => abrir(p, 'movimiento')}>Registrar movimiento</button><button className="icon-button" aria-label={`Configurar mínimo de ${p.nombre}`} title="Configurar mínimo" onClick={() => abrir(p, 'minimo')}>⚙</button><Link className="button" to={`/movimientos?productoId=${p.id}`}>Historial</Link></div></td></tr>)}</tbody></table></div>{!visible.length && <Vacio>{productos.length ? 'No hay productos que coincidan con los filtros.' : 'Registrá productos en el catálogo para comenzar.'}</Vacio>}<Paginacion page={page} count={filtered.length} onChange={setPage}/></>}
    </div>
    {editor && <Modal title={editor.mode === 'minimo' ? `Reposición · ${editor.producto.nombre}` : `Movimiento · ${editor.producto.nombre}`} onClose={() => setEditor(null)} busy={saving}>
      <p>Stock actual: <strong>{cantidadFormato(editor.producto.stockActual)} {unidadCorta(editor.producto.unidadVenta)}</strong></p>
      <form onSubmit={enviar}><ErrorCarga error={error}/><fieldset disabled={saving} className="operation-fieldset"><div className="form-grid">
        {editor.mode === 'movimiento' && <label className="full-width">Tipo de movimiento<select value={tipo} onChange={e => { setTipo(e.target.value as TipoMovimiento); setCantidad(''); setError('') }}>{tipos.map(t => <option value={t.value} key={t.value}>{t.label}</option>)}</select></label>}
        <label className="full-width">{editor.mode === 'minimo' ? 'Stock mínimo' : tipo === 'AJUSTE' ? 'Stock contado' : 'Cantidad'} ({unidadCorta(editor.producto.unidadVenta)})<input autoFocus required inputMode={editor.producto.unidadVenta === 'KILOS' ? 'decimal' : 'numeric'} value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej. 5" /></label>
        {editor.mode === 'movimiento' && <label className="full-width">Motivo obligatorio<textarea required maxLength={250} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explicá el ingreso, salida, ajuste o baja"/></label>}
      </div></fieldset>
      {tipo === 'AJUSTE' && editor.mode === 'movimiento' && <p className="form-note">Ingresá el total encontrado en el conteo. El sistema registrará la diferencia.</p>}
      <div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={() => setEditor(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div></form>
    </Modal>}
  </section>
}
