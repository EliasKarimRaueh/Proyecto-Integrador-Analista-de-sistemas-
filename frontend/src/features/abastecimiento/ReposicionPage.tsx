import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Encabezado, ErrorCarga, EstadoStock, Paginacion, Vacio } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fetchProveedores } from '../../shared/services/proveedores'
import { guardarHabitual, listarAbastecimiento, type ProductoAbastecimiento } from '../../shared/services/abastecimiento'
import { cantidadFormato, unidadCorta, errorMensaje } from '../../shared/lib/operaciones'
import { NavegacionAbastecimiento } from './AbastecimientoUI'
import type { LineaEditor } from './calculos'

export function ReposicionPage() {
  const navigate = useNavigate()
  const [proveedorId, setProveedorId] = useState(''), [q, setQ] = useState(''), [page, setPage] = useState(1)
  const [proximos, setProximos] = useState(true), [soloHabitual, setSoloHabitual] = useState(false)
  const [seleccion, setSeleccion] = useState<ProductoAbastecimiento[]>([]), [error, setError] = useState(''), [guardando, setGuardando] = useState<number | null>(null)
  const proveedores = useApiResource(fetchProveedores)
  const filtros = { proveedorId, q, page, incluirProximos: proximos, soloHabitual }
  const recurso = useApiResource(() => listarAbastecimiento<ProductoAbastecimiento>('compras/reposicion', filtros), JSON.stringify(filtros))
  function cambiar(fn: () => void) { fn(); setPage(1); setSeleccion([]); setError('') }
  function preparar() {
    const proveedor = Number(proveedorId)
    if (!proveedor || !seleccion.length) { setError('Elegí un proveedor y seleccioná los productos del pedido.'); return }
    const lineas: LineaEditor[] = seleccion.map(p => ({ productoId: String(p.id), cantidad: String(Math.max(1, p.cantidadSugerida / p.factorConversion)), costo: (Number(p.costoActual) * p.factorConversion).toFixed(2), unidad: 'COMPRA' }))
    navigate('/pedidos', { state: { nuevoPedido: { proveedorId: proveedor, lineas } } })
  }
  async function habitual(productoId: number, valor: string) {
    if (guardando !== null) return
    setGuardando(productoId); setError('')
    try { await guardarHabitual(productoId, valor ? Number(valor) : null); recurso.refetch(); setSeleccion([]) }
    catch (fallo) { setError(errorMensaje(fallo)) } finally { setGuardando(null) }
  }
  return <section><Encabezado title="Reposición" description="Detectá faltantes y prepará pedidos por proveedor." actions={<Link className="button" to="/stock">Configurar mínimos en inventario</Link>}/><NavegacionAbastecimiento/>
    <ErrorCarga error={proveedores.error} retry={proveedores.refetch}/><ErrorCarga error={recurso.error} retry={recurso.refetch}/><ErrorCarga error={error}/>
    <div className="catalog-panel"><div className="filters supply-filters"><label>Buscar producto<input value={q} onChange={e => cambiar(() => setQ(e.target.value))} placeholder="Nombre del producto"/></label><label>Proveedor<select aria-label="Proveedor" value={proveedorId} onChange={e => cambiar(() => setProveedorId(e.target.value))}><option value="">Todos los proveedores</option>{(proveedores.data ?? []).filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label className="supply-check"><input type="checkbox" checked={proximos} onChange={e => cambiar(() => setProximos(e.target.checked))}/>Incluir próximos al mínimo</label><label className="supply-check"><input type="checkbox" checked={soloHabitual} disabled={!proveedorId} onChange={e => cambiar(() => setSoloHabitual(e.target.checked))}/>Solo proveedor habitual</label></div>
      <div className="supply-toolbar"><p>La sugerencia cubre el faltante redondeando a presentaciones completas. Para productos próximos al mínimo podés preparar una presentación y ajustar el pedido.</p><button className="button primary" disabled={!proveedorId || !seleccion.length || recurso.loading} onClick={preparar}>Preparar pedido ({seleccion.length})</button></div>
      {recurso.loading ? <p role="status" className="operation-loading">Consultando necesidades…</p> : <><div className="table-scroll"><table><thead><tr><th>Seleccionar</th><th>Producto</th><th>Stock / mínimo</th><th>Estado</th><th>Faltante</th><th>Sugerencia</th><th>Proveedor habitual</th></tr></thead><tbody>{recurso.data?.rows.map(p => <tr key={p.id}><td><input type="checkbox" aria-label={`Pedir ${p.nombre}`} disabled={!proveedorId || !p.proveedores.some(s => s.id === Number(proveedorId)) || seleccion.length >= 100 && !seleccion.some(s => s.id === p.id)} checked={seleccion.some(s => s.id === p.id)} onChange={e => setSeleccion(actual => e.target.checked ? [...actual, p] : actual.filter(s => s.id !== p.id))}/></td><td><strong>{p.nombre}</strong></td><td>{cantidadFormato(p.stockActual)} / {cantidadFormato(p.stockMinimo ?? 0)} {unidadCorta(p.unidadVenta)}</td><td><EstadoStock estado={p.estado}/></td><td>{cantidadFormato(p.faltante)} {unidadCorta(p.unidadVenta)}</td><td>{cantidadFormato(p.cantidadSugerida / p.factorConversion)} {p.unidadCompra}<small className="product-description">{cantidadFormato(p.cantidadSugerida)} {unidadCorta(p.unidadVenta)}</small></td><td><select aria-label={`Proveedor habitual de ${p.nombre}`} disabled={guardando !== null} value={p.proveedorHabitualId ?? ''} onChange={e => habitual(p.id, e.target.value)}><option value="">Sin definir</option>{p.proveedores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>{!p.proveedores.length && <small>Asociá proveedores desde Proveedores.</small>}</td></tr>)}</tbody></table></div>{!recurso.data?.rows.length && !recurso.error && <Vacio>No hay necesidades con estos filtros. Los productos necesitan un stock mínimo configurado.</Vacio>}<Paginacion page={page} count={recurso.data?.count ?? 0} onChange={setPage}/></>}
    </div>
  </section>
}
