import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal } from '../../shared/components/Modal'
import { Encabezado, ErrorCarga, Paginacion, Vacio } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { cantidadFormato, fechaHoraLocal, rangoDelDia } from '../../shared/lib/operaciones'
import { fetchMovimientos, type Movimiento } from '../../shared/services/operaciones'
import { fetchProducts } from '../../shared/services/api'

function motivoLegible(m: Movimiento) {
  if (!m.motivo) return m.ventaId ? `Venta #${m.ventaId}` : 'Sin motivo'
  if (m.motivo.startsWith('DESP:')) return `Desposte · ${m.motivo.split(' ').slice(1).join(' ')}`
  return m.motivo
}
export function MovementsPage() {
  const [params, setParams] = useSearchParams()
  const [desde, setDesde] = useState(''), [hasta, setHasta] = useState(''), [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Movimiento | null>(null)
  const productos = useApiResource(fetchProducts)
  const nombre = new Map((productos.data ?? []).map(p => [Number(p.id), `${p.name} · ${p.code}`]))
  const productoId = params.get('productoId') ?? '', tipo = params.get('tipo') ?? '', ventaId = params.get('ventaId') ?? '', operacionId = params.get('operacionId') ?? ''
  const movimientos = useApiResource(() => fetchMovimientos({ page, productoId, tipo, ventaId, operacionId, ...rangoDelDia(desde, hasta) }), `${page}:${params}:${desde}:${hasta}`)
  function filtrar(key: string, value: string) {
    const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key)
    setParams(next); setPage(1)
  }
  return <section>
    <Encabezado title="Movimientos de mercadería" description="Auditá entradas, salidas, ajustes, bajas y operaciones de desposte." actions={<><button className="button" onClick={movimientos.refetch}>Actualizar</button><Link className="button primary" to="/stock">Ir a inventario</Link></>}/>
    <div className="catalog-panel"><div className="filters history-filters"><label>Producto<select value={productoId} onChange={e => filtrar('productoId', e.target.value)}><option value="">Todos los productos</option>{(productos.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (inactivo)'}</option>)}</select></label><label>Tipo<select value={tipo} onChange={e => filtrar('tipo', e.target.value)}><option value="">Todos</option><option value="INGRESO">Entradas</option><option value="EGRESO">Salidas</option></select></label><label>Desde<input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }}/></label><label>Hasta<input type="date" value={hasta} min={desde || undefined} onChange={e => { setHasta(e.target.value); setPage(1) }}/></label><button className="button" onClick={() => { setParams({}); setDesde(''); setHasta(''); setPage(1) }}>Limpiar filtros</button></div>
      {(ventaId || operacionId) && <div className="operation-context">{ventaId ? `Movimientos de la venta #${ventaId}` : `Desposte ${operacionId}`}</div>}
      <ErrorCarga error={movimientos.error} retry={movimientos.refetch}/><ErrorCarga error={productos.error} retry={productos.refetch}/>
      {movimientos.loading ? <p className="operation-loading" role="status">Cargando movimientos…</p> : <><div className="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Stock final</th><th>Motivo</th><th>Detalle</th></tr></thead><tbody>{movimientos.data?.rows.map(m => <tr key={m.id}><td>{fechaHoraLocal(m.fechaHora)}</td><td>{nombre.get(m.productoId) ?? `Producto #${m.productoId}`}</td><td><span className={`stock-status ${m.tipo === 'INGRESO' ? 'normal' : 'near'}`}>{m.tipo === 'INGRESO' ? 'Entrada' : 'Salida'}</span></td><td>{m.tipo === 'INGRESO' ? '+' : '−'}{cantidadFormato(m.cantMovimiento)}</td><td>{cantidadFormato(m.cantFinal)}</td><td className="movement-reason">{motivoLegible(m)}</td><td><button className="button" onClick={() => setSelected(m)}>Ver</button></td></tr>)}</tbody></table></div>{!movimientos.data?.rows.length && !movimientos.error && <Vacio>No hay movimientos que coincidan con los filtros.</Vacio>}<Paginacion page={page} count={movimientos.data?.count ?? 0} onChange={setPage}/></>}
    </div>
    {selected && <Modal title={`Movimiento #${selected.id}`} onClose={() => setSelected(null)}><dl className="operation-details"><div><dt>Producto</dt><dd>{nombre.get(selected.productoId) ?? `#${selected.productoId}`}</dd></div><div><dt>Fecha</dt><dd>{fechaHoraLocal(selected.fechaHora)}</dd></div><div><dt>Tipo</dt><dd>{selected.tipo === 'INGRESO' ? 'Entrada' : 'Salida'}</dd></div><div><dt>Stock inicial</dt><dd>{cantidadFormato(selected.cantInicial)}</dd></div><div><dt>Cantidad</dt><dd>{cantidadFormato(selected.cantMovimiento)}</dd></div><div><dt>Stock final</dt><dd>{cantidadFormato(selected.cantFinal)}</dd></div><div><dt>Número por producto</dt><dd>{selected.numeroMovimiento}</dd></div><div><dt>Usuario registrado</dt><dd>#{selected.usuarioId}</dd></div><div><dt>Motivo</dt><dd>{motivoLegible(selected)}</dd></div></dl><div className="modal-footer">{selected.ventaId && <Link className="button" to={`/ventas?ventaId=${selected.ventaId}`}>Ver venta</Link>}{selected.motivo?.startsWith('DESP:') && <button className="button" onClick={() => { filtrar('operacionId', selected.motivo!.split(':')[1]); setSelected(null) }}>Ver desposte completo</button>}<button className="button primary" onClick={() => setSelected(null)}>Cerrar detalle</button></div></Modal>}
  </section>
}
