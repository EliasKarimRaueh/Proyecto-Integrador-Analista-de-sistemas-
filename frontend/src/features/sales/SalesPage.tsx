import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../shared/components/Modal'
import { Encabezado, ErrorCarga, Paginacion, Vacio } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearMonto } from '../../shared/lib/money'
import { cantidadInput, cantidadFormato, unidadCorta, errorMensaje } from '../../shared/lib/operaciones'
import { buscarProductosCaja, cotizar, confirmarVenta, type Unidad, type ListaPrecio, type VentaCompleta } from '../../shared/services/operaciones'
import { fetchOfertas } from '../../shared/services/ofertas'
import { fetchPreciosVigentes } from '../../shared/services/precios'
import { ApiError } from '../../shared/services/api'
import { normalize } from '../products/products'
import { Receipt } from './Receipt'

type Item = { key: string; productoId?: number; ofertaId?: number; nombre: string; unidad: Unidad; cantidad: string }
export function SalesPage() {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1)
  const [tab, setTab] = useState<'productos' | 'ofertas'>('productos')
  const [items, setItems] = useState<Item[]>([]), [lista, setLista] = useState<ListaPrecio>('MINORISTA')
  const [saving, setSaving] = useState(false), [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState(''), [recibo, setRecibo] = useState<VentaCompleta | null>(null)
  const [vaciar, setVaciar] = useState(false)
  const [resultadoIncierto, setResultadoIncierto] = useState(false)
  const submitLock = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => { const timeout = setTimeout(() => { setQuery(search); setPage(1) }, 200); return () => clearTimeout(timeout) }, [search])
  const productos = useApiResource(() => buscarProductosCaja(query, page), `${query}:${page}`)
  const ofertas = useApiResource(fetchOfertas)
  const precios = useApiResource(fetchPreciosVigentes)
  const precioPorId = new Map((precios.data ?? []).map(p => [p.productoId, p]))
  const carritoKey = JSON.stringify({ items, lista })
  function payload() {
    return items.map(item => ({ productoId: item.productoId, ofertaId: item.ofertaId, cantidad: cantidadInput(item.cantidad, item.unidad), tipoPrecio: lista }))
  }
  const cotizacion = useApiResource(() => items.length ? cotizar(payload()) : Promise.resolve(null), carritoKey)
  function agregar(item: Omit<Item, 'cantidad'>) {
    setError(''); setRecibo(null)
    setItems(actual => {
      const existente = actual.find(i => i.key === item.key)
      if (!existente) return [...actual, { ...item, cantidad: '1' }]
      return actual.map(i => i.key === item.key ? { ...i, cantidad: String(Number(i.cantidad.replace(',', '.')) + 1) } : i)
    })
  }
  async function cobrar() {
    if (submitLock.current || resultadoIncierto || !cotizacion.data || cotizacion.loading || cotizacion.error) return
    submitLock.current = true; setSaving(true); setError('')
    try {
      const venta = await confirmarVenta(payload())
      setRecibo(venta); setItems([]); setConfirmando(false)
      productos.refetch(); ofertas.refetch(); precios.refetch()
    } catch (fallo) {
      if (!(fallo instanceof ApiError) || fallo.status >= 500) {
        setResultadoIncierto(true)
        setError('No se pudo comprobar si la venta quedó registrada. Revisá el historial antes de volver a cobrar.')
      } else setError(errorMensaje(fallo))
      setConfirmando(false); cotizacion.refetch()
    }
    finally { submitLock.current = false; setSaving(false) }
  }
  const ofertasVisibles = (ofertas.data ?? []).filter(o => o.activo && o.vigente && normalize(o.nombre).includes(normalize(search)))
  const listaLista = !cotizacion.loading && !!cotizacion.data && !cotizacion.error
  return <section>
    <Encabezado title="Caja y mostrador" description="Buscá un artículo, cargá kilos o unidades y confirmá la venta." actions={<Link className="button" to="/ventas">Historial de ventas</Link>}/>
    <div className="pos-layout"><div className="catalog-panel pos-catalog">
      <div className="filters"><label className="search-field"><input autoFocus ref={searchRef} aria-label="Buscar artículo para vender" placeholder="Código o nombre del producto…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => {
        if (e.key !== 'Enter' || tab !== 'productos' || search !== query || productos.loading) return
        const exacto = productos.data?.rows.find(p => normalize(p.codigo) === normalize(search))
        if (exacto && precioPorId.has(exacto.id)) { e.preventDefault(); agregar({ key: `p${exacto.id}`, productoId: exacto.id, nombre: exacto.nombre, unidad: exacto.unidadVenta }); setSearch('') }
      }}/></label><button className="button" onClick={() => { productos.refetch(); ofertas.refetch(); precios.refetch() }}>Actualizar</button></div>
      <div className="category-tabs" role="group" aria-label="Tipo de artículo"><button aria-pressed={tab === 'productos'} className={tab === 'productos' ? 'selected' : ''} onClick={() => setTab('productos')}>Productos</button><button aria-pressed={tab === 'ofertas'} className={tab === 'ofertas' ? 'selected' : ''} onClick={() => setTab('ofertas')}>Ofertas vigentes</button></div>
      <ErrorCarga error={tab === 'productos' ? productos.error : ofertas.error} retry={tab === 'productos' ? productos.refetch : ofertas.refetch}/><ErrorCarga error={precios.error} retry={precios.refetch}/>
      {tab === 'productos' ? <>{productos.loading || precios.loading ? <p className="operation-loading" role="status">Buscando productos…</p> : <div className="pos-product-grid">{productos.data?.rows.map(p => {
        const precio = precioPorId.get(p.id)
        const monto = lista === 'MINORISTA' ? precio?.precioMinorista : precio?.precioMayorista
        return <button className="pos-product" key={p.id} disabled={monto == null || search !== query || saving} onClick={() => agregar({ key: `p${p.id}`, productoId: p.id, nombre: p.nombre, unidad: p.unidadVenta })}><small>{p.codigo}</small><strong>{p.nombre}</strong><span>{monto == null ? 'Sin precio en esta lista' : `${formatearMonto(monto)} / ${unidadCorta(p.unidadVenta)}`}</span><small>Stock: {cantidadFormato(p.stockActual)} {unidadCorta(p.unidadVenta)}</small><span className="pos-add">+ Agregar</span></button>
      })}</div>}{!productos.loading && productos.data?.count === 0 && <Vacio>No encontramos productos con esa búsqueda.</Vacio>}<Paginacion page={page} count={productos.data?.count ?? 0} onChange={setPage} disabled={productos.loading}/></> : <>{ofertas.loading ? <p className="operation-loading">Cargando ofertas…</p> : <div className="pos-product-grid">{ofertasVisibles.map(o => <button className="pos-product" key={o.id} disabled={saving} onClick={() => agregar({ key: `o${o.id}`, ofertaId: Number(o.id), nombre: o.nombre, unidad: 'UNIDADES' })}><small>OFERTA</small><strong>{o.nombre}</strong><span>{o.descripcion || 'Precio especial por combo'}</span><span className="pos-add">+ Agregar oferta</span></button>)}</div>}{!ofertas.loading && !ofertasVisibles.length && <Vacio>No hay ofertas vigentes para esta búsqueda.</Vacio>}</>}
    </div><aside className="catalog-panel pos-cart">
      <div className="catalog-title"><div><h2>Venta actual <span className="count">{items.length}</span></h2><p>Kilos y unidades según el producto.</p></div></div>
      <label className="cart-list-label">Lista de precios<select aria-label="Lista de precios" disabled={saving} value={lista} onChange={e => setLista(e.target.value as ListaPrecio)}><option value="MINORISTA">Minorista</option><option value="MAYORISTA">Mayorista</option></select></label>
      {!items.length ? <Vacio>Agregá productos u ofertas para comenzar.</Vacio> : <ul className="cart-items">{items.map((item, index) => <li key={item.key}><div className="cart-item-title"><strong>{item.nombre}</strong><button className="icon-button danger-text" disabled={saving} aria-label={`Quitar ${item.nombre}`} onClick={() => setItems(actual => actual.filter(i => i.key !== item.key))}>×</button></div><div className="cart-item-values"><label>Cantidad ({unidadCorta(item.unidad)})<input aria-label={`Cantidad de ${item.nombre}`} inputMode={item.unidad === 'KILOS' ? 'decimal' : 'numeric'} disabled={saving} value={item.cantidad} onChange={e => setItems(actual => actual.map(i => i.key === item.key ? { ...i, cantidad: e.target.value } : i))}/></label><div><small>{cotizacion.loading ? 'Calculando…' : 'Subtotal'}</small><strong>{formatearMonto(cotizacion.data?.detalles[index]?.subtotal)}</strong></div></div></li>)}</ul>}
      <ErrorCarga error={items.length ? cotizacion.error : ''} retry={items.length ? cotizacion.refetch : undefined}/><ErrorCarga error={error}/>
      {resultadoIncierto && <div className="operation-context"><Link to="/ventas" target="_blank" rel="noreferrer">Revisar historial de ventas</Link><p>Confirmá que esta venta no figure antes de reintentarlo.</p><button className="button" onClick={() => { setResultadoIncierto(false); setError('') }}>Ya revisé el historial</button></div>}
      <div className="cart-summary"><span>Total a cobrar</span><strong aria-live="polite">{formatearMonto(items.length ? cotizacion.data?.total : '0')}</strong><button className="button primary checkout-button" disabled={!listaLista || !items.length || saving || resultadoIncierto} onClick={() => { setError(''); setConfirmando(true) }}>Confirmar venta</button><button className="button" disabled={!items.length || saving} onClick={() => setVaciar(true)}>Vaciar carrito</button></div>
    </aside></div>
    {confirmando && cotizacion.data && <Modal title="Confirmar venta" busy={saving} onClose={() => setConfirmando(false)}><p>Se registrará la venta y se descontarán las existencias.</p><div className="receipt-total"><span>Total</span><strong>{formatearMonto(cotizacion.data.total)}</strong></div><div className="modal-footer"><button className="button" disabled={saving} onClick={() => setConfirmando(false)}>Volver</button><button className="button primary" disabled={saving} onClick={cobrar}>{saving ? 'Registrando venta…' : 'Registrar venta'}</button></div></Modal>}
    {vaciar && <Modal title="Vaciar carrito" onClose={() => setVaciar(false)}><p>Se quitarán los artículos de la venta actual.</p><div className="modal-footer"><button className="button" onClick={() => setVaciar(false)}>Volver</button><button className="button danger" onClick={() => { setItems([]); setError(''); setVaciar(false); searchRef.current?.focus() }}>Vaciar carrito</button></div></Modal>}
    {recibo && <Modal title="Venta registrada" onClose={() => { setRecibo(null); searchRef.current?.focus() }}><div className="notice success" role="status">Venta #{recibo.venta.id} registrada. El stock ya está actualizado.</div><Receipt data={recibo}/><div className="modal-footer"><Link className="button" to={`/ventas?ventaId=${recibo.venta.id}`}>Ver en historial</Link><button className="button primary" onClick={() => { setRecibo(null); setSearch(''); searchRef.current?.focus() }}>Nueva venta</button></div></Modal>}
  </section>
}
