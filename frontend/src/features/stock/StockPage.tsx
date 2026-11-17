import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../shared/components/Modal'
import { Encabezado, ErrorCarga, EstadoStock, Vacio, Paginacion } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { cantidadInput, cantidadFormato, unidadCorta, errorMensaje, validarMotivo } from '../../shared/lib/operaciones'
import { fetchStock, guardarMinimo, guardarMovimiento, type StockProducto, type TipoMovimiento } from '../../shared/services/operaciones'
import { normalize } from '../products/products'
import { InventarioModal } from './InventarioModal'

const tipos: { value: TipoMovimiento; label: string }[] = [
  { value: 'INGRESO', label: 'Entrada' }, { value: 'EGRESO', label: 'Salida' },
  { value: 'AJUSTE', label: 'Ajuste a stock contado' }, { value: 'AJUSTE_POSITIVO', label: 'Ajuste positivo' },
  { value: 'AJUSTE_NEGATIVO', label: 'Ajuste negativo' }, { value: 'MERMA', label: 'Merma' },
  { value: 'VENCIMIENTO', label: 'Baja por vencimiento' }, { value: 'ROTURA', label: 'Baja por rotura' }, { value: 'PERDIDA', label: 'Otra pérdida' },
]

function AlertaVerde() {
  return (
    <svg className="stat-alert-badge" viewBox="0 0 100 100" aria-label="Alerta verde: 1 signo de exclamación" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#67c75c" />
      <rect x="43.5" y="22" width="13" height="34" rx="6.5" fill="#ffffff" />
      <circle cx="50" cy="70.5" r="6.5" fill="#ffffff" />
    </svg>
  )
}

function AlertaAmarilla() {
  return (
    <svg className="stat-alert-badge" viewBox="0 0 100 100" aria-label="Alerta amarilla: 2 signos de exclamación" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#ffae31" />
      <rect x="34.5" y="22" width="13" height="34" rx="6.5" fill="#ffffff" />
      <circle cx="41" cy="70.5" r="6.5" fill="#ffffff" />
      <rect x="52.5" y="22" width="13" height="34" rx="6.5" fill="#ffffff" />
      <circle cx="59" cy="70.5" r="6.5" fill="#ffffff" />
    </svg>
  )
}

function AlertaRoja() {
  return (
    <svg className="stat-alert-badge" viewBox="0 0 100 100" aria-label="Alerta roja: 3 signos de exclamación" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#ff2630" />
      <rect x="25" y="22" width="12" height="34" rx="6" fill="#ffffff" />
      <circle cx="31" cy="70.5" r="6" fill="#ffffff" />
      <rect x="44" y="22" width="12" height="34" rx="6" fill="#ffffff" />
      <circle cx="50" cy="70.5" r="6" fill="#ffffff" />
      <rect x="63" y="22" width="12" height="34" rx="6" fill="#ffffff" />
      <circle cx="69" cy="70.5" r="6" fill="#ffffff" />
    </svg>
  )
}

function IconoRuedita() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

type Editor = { producto: StockProducto; mode: 'movimiento' | 'minimo' }
export function StockPage() {
  const resource = useApiResource(fetchStock)
  const [inventario, setInventario] = useState(false)
  const [search, setSearch] = useState(''), [estado, setEstado] = useState('Todos'), [page, setPage] = useState(1)
  const [editor, setEditor] = useState<Editor | null>(null), [tipo, setTipo] = useState<TipoMovimiento>('INGRESO')
  const [cantidad, setCantidad] = useState(''), [motivo, setMotivo] = useState('')
  const [unidad, setUnidad] = useState<'COMPRA' | 'VENTA'>('VENTA')
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const productos = resource.data ?? []
  const filtered = productos.filter(p => normalize(`${p.codigo} ${p.nombre}`).includes(normalize(search)) && (estado === 'Todos' || p.estado === estado))
  const visible = filtered.slice((page - 1) * 20, page * 20)
  function abrir(producto: StockProducto, mode: Editor['mode']) {
    setUnidad('VENTA')
    setEditor({ producto, mode }); setTipo('INGRESO'); setCantidad(mode === 'minimo' ? String(producto.stockMinimo ?? '') : ''); setMotivo(''); setError(''); setNotice('')
  }
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (!editor || saving) return
    setError('')
    try {
      const value = cantidadInput(cantidad, editor.mode === 'movimiento' && unidad === 'COMPRA' ? 'KILOS' : editor.producto.unidadVenta, editor.mode === 'minimo' || tipo === 'AJUSTE')
      const razon = editor.mode === 'movimiento' ? validarMotivo(motivo) : ''
      setSaving(true)
      if (editor.mode === 'minimo') {
        await guardarMinimo(editor.producto.id, value)
        setNotice('Límite de reposición actualizado.')
      } else {
        const movimiento = await guardarMovimiento({ productoId: editor.producto.id, tipo, motivo: razon, unidad, ...(tipo === 'AJUSTE' ? { stockObjetivo: value } : { cantMovimiento: value }) })
        setNotice(movimiento ? 'Movimiento registrado y stock actualizado.' : 'El stock contado coincide con el actual. No se generó un movimiento.')
      }
      setEditor(null); resource.refetch()
    } catch (fallo) { setError(errorMensaje(fallo)) } finally { setSaving(false) }
  }
  return <section>
    <Encabezado title="Inventario" description="Existencias, alertas de reposición y movimientos de mercadería." actions={<><button className="button primary" disabled={resource.loading || !!resource.error || !productos.length} onClick={() => { setNotice(''); setInventario(true) }}>Registrar nuevo inventario</button><Link className="button" to="/reposicion">Preparar reposición</Link><Link className="button" to="/movimientos">Ver movimientos</Link><Link className="button primary" to="/desposte">Desposte</Link></>} />
    <div className="stats-grid">
      <div className="stat">
        <div><span>Productos activos</span><strong>{productos.length}</strong></div>
        <AlertaVerde />
      </div>
      <div className="stat">
        <div><span>Próximos al mínimo</span><strong>{productos.filter(p => p.estado === 'Próximo al Mínimo').length}</strong></div>
        <AlertaAmarilla />
      </div>
      <div className="stat">
        <div><span>Stock crítico</span><strong>{productos.filter(p => p.estado === 'Crítico').length}</strong></div>
        <AlertaRoja />
      </div>
    </div>
    <ErrorCarga error={resource.error} retry={resource.refetch}/>
    {notice && <div className="notice success" role="status">{notice}</div>}
    <div className="catalog-panel">
      <div className="filters"><label className="search-field"><input aria-label="Buscar stock por nombre" placeholder="Buscar por nombre…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}/></label><label className="status-filter">Estado<select value={estado} onChange={e => { setEstado(e.target.value); setPage(1) }}>{['Todos', 'Normal', 'Próximo al Mínimo', 'Crítico'].map(s => <option key={s}>{s}</option>)}</select></label></div>
      {resource.loading ? <p className="operation-loading" role="status">Cargando inventario…</p> : <><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Existencias</th><th>Mínimo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><strong>{p.nombre}</strong></td><td>{cantidadFormato(p.stockActual)} {unidadCorta(p.unidadVenta)}</td><td>{p.stockMinimo === null ? 'Sin configurar' : `${cantidadFormato(p.stockMinimo)} ${unidadCorta(p.unidadVenta)}`}</td><td><EstadoStock estado={p.estado}/></td><td><div className="operation-actions"><button className="button" onClick={() => abrir(p, 'movimiento')}>Registrar movimiento</button><button className="icon-button btn-ruedita-inventario" aria-label={`Configurar mínimo de ${p.nombre}`} title="Configurar mínimo" onClick={() => abrir(p, 'minimo')}><IconoRuedita /></button><Link className="button" to={`/movimientos?productoId=${p.id}`}>Historial</Link></div></td></tr>)}</tbody></table></div>{!visible.length && <Vacio>{productos.length ? 'No hay productos que coincidan con los filtros.' : 'Registrá productos en el catálogo para comenzar.'}</Vacio>}<Paginacion page={page} count={filtered.length} onChange={setPage}/></>}
    </div>
    {inventario && <InventarioModal productos={productos} onClose={() => { setInventario(false); resource.refetch() }} onGuardado={ajustes => { setInventario(false); setNotice(`Inventario registrado: ${ajustes} ajustes de stock.`); resource.refetch() }}/>}
    {editor && <Modal title={editor.mode === 'minimo' ? `Reposición · ${editor.producto.nombre}` : `Movimiento · ${editor.producto.nombre}`} onClose={() => setEditor(null)} busy={saving}>
      <p>Stock actual: <strong>{cantidadFormato(editor.producto.stockActual)} {unidadCorta(editor.producto.unidadVenta)}</strong></p>
      <form onSubmit={enviar}><ErrorCarga error={error}/><fieldset disabled={saving} className="operation-fieldset"><div className="form-grid">
        {editor.mode === 'movimiento' && <label className="full-width">Tipo de movimiento<select value={tipo} onChange={e => { setTipo(e.target.value as TipoMovimiento); setCantidad(''); setError('') }}>{tipos.map(t => <option value={t.value} key={t.value}>{t.label}</option>)}</select></label>}
        {editor.mode === 'movimiento' && <label className="full-width">Medir en<select value={unidad} onChange={e => { setUnidad(e.target.value as 'COMPRA' | 'VENTA'); setCantidad('') }}><option value="VENTA">Venta · {unidadCorta(editor.producto.unidadVenta)}</option><option value="COMPRA">Compra · {editor.producto.unidadCompra ?? editor.producto.unidadVenta}</option></select></label>}
        <label className="full-width">{editor.mode === 'minimo' ? 'Stock mínimo' : tipo === 'AJUSTE' ? 'Stock contado' : 'Cantidad'} ({editor.mode === 'movimiento' && unidad === 'COMPRA' ? editor.producto.unidadCompra : unidadCorta(editor.producto.unidadVenta)})<input autoFocus required inputMode="decimal" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej. 5" /></label>
        {editor.mode === 'movimiento' && unidad === 'COMPRA' && <p className="full-width" aria-live="polite">Equivale a {cantidadFormato(Number(cantidad.replace(',', '.')) * (editor.producto.factorConversion ?? 1))} {unidadCorta(editor.producto.unidadVenta)} de inventario.</p>}
        {editor.mode === 'movimiento' && <label className="full-width">Motivo obligatorio<textarea required maxLength={250} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explicá el ingreso, salida, ajuste o baja"/></label>}
      </div></fieldset>
      {tipo === 'AJUSTE' && editor.mode === 'movimiento' && <p className="form-note">Ingresá el total encontrado en el conteo. El sistema registrará la diferencia.</p>}
      <div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={() => setEditor(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div></form>
    </Modal>}
  </section>
}
