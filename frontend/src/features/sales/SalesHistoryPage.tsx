import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Encabezado, ErrorCarga, Paginacion, Vacio } from '../../shared/components/OperacionesUI'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearMonto } from '../../shared/lib/money'
import { fechaHoraLocal, rangoDelDia } from '../../shared/lib/operaciones'
import { fetchVentas, fetchVenta } from '../../shared/services/operaciones'
import { Receipt } from './Receipt'

function VentaDetalle({ id, onClose }: { id: number; onClose: () => void }) {
  const venta = useApiResource(() => fetchVenta(id), id)
  return <Modal title={`Venta #${id}`} onClose={onClose}><ErrorCarga error={venta.error} retry={venta.refetch}/>{venta.loading ? <p role="status">Cargando venta…</p> : venta.data && <><Receipt data={venta.data}/><div className="modal-footer"><Link className="button" to={`/movimientos?ventaId=${id}`}>Ver egresos de stock</Link><button className="button primary" onClick={onClose}>Cerrar detalle</button></div></>}</Modal>
}
export function SalesHistoryPage() {
  const [params, setParams] = useSearchParams()
  const [desde, setDesde] = useState(''), [hasta, setHasta] = useState(''), [page, setPage] = useState(1)
  const ventas = useApiResource(() => fetchVentas({ page, ...rangoDelDia(desde, hasta) }), `${page}:${desde}:${hasta}`)
  const selectedId = Number(params.get('ventaId'))
  return <section>
    <Encabezado title="Historial de ventas" description="Consultá las ventas registradas, sus artículos y los egresos asociados." actions={<><button className="button" onClick={ventas.refetch}>Actualizar</button><Link className="button primary" to="/caja">Ir a caja</Link></>}/>
    <div className="catalog-panel"><div className="filters history-filters"><label>Desde<input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }}/></label><label>Hasta<input type="date" value={hasta} min={desde || undefined} onChange={e => { setHasta(e.target.value); setPage(1) }}/></label><button className="button" onClick={() => { setDesde(''); setHasta(''); setPage(1) }}>Limpiar filtros</button></div><ErrorCarga error={ventas.error} retry={ventas.refetch}/>
      {ventas.loading ? <p className="operation-loading" role="status">Cargando ventas…</p> : <><div className="table-scroll"><table><thead><tr><th>Venta</th><th>Fecha y hora</th><th>Artículos</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{ventas.data?.rows.map(({ venta, detalles }) => <tr key={venta.id}><td><strong>#{venta.id}</strong></td><td>{fechaHoraLocal(venta.fechaHora)}</td><td>{detalles.length} {detalles.length === 1 ? 'artículo' : 'artículos'}</td><td><strong>{formatearMonto(venta.total)}</strong></td><td><button className="button" onClick={() => setParams({ ventaId: String(venta.id) })}>Ver detalle</button></td></tr>)}</tbody></table></div>{!ventas.data?.rows.length && !ventas.error && <Vacio>No hay ventas en el período seleccionado.</Vacio>}<Paginacion page={page} count={ventas.data?.count ?? 0} onChange={setPage}/></>}
    </div>
    {Number.isSafeInteger(selectedId) && selectedId > 0 && <VentaDetalle id={selectedId} onClose={() => setParams({})}/>}
  </section>
}
