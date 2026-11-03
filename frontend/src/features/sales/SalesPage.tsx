import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../shared/components/Modal'
import { Encabezado, ErrorCarga, Paginacion, Vacio } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearMonto } from '../../shared/lib/money'
import { cantidadInput, cantidadFormato, unidadCorta, errorMensaje } from '../../shared/lib/operaciones'
import { buscarProductosCaja, fetchCategoriasCaja, cotizar, confirmarVenta, type Unidad, type ListaPrecio, type VentaCompleta, type LineaVenta } from '../../shared/services/operaciones'
import { fetchOferta, fetchOfertas } from '../../shared/services/ofertas'
import { fetchPreciosVigentes } from '../../shared/services/precios'
import { ApiError } from '../../shared/services/api'
import { normalize } from '../products/products'
import type { Oferta, OfertaConProductos } from '../ofertas/ofertas'
import type { Precio } from '../precios/precios'
import { resumenOfertaCaja } from './promocionesCaja'
import { Receipt } from './Receipt'

type Componente = { productoId: number; nombre: string; unidad: Unidad; cantidadPorCombo: number; pesoReal: string }
type Item = { key: string; productoId?: number; ofertaId?: number; nombre: string; unidad: Unidad; cantidad: string; componentes?: Componente[] }

function TarjetaOferta({ oferta, precios, lista, revision, disabled, onAgregar }: { oferta: Oferta; precios: Precio[]; lista: ListaPrecio; revision: number; disabled: boolean; onAgregar: (detalle: OfertaConProductos) => void }) {
  const recurso = useApiResource(() => fetchOferta(oferta.id), `${oferta.id}:${revision}`)
  const detalle = recurso.data, resumen = detalle ? resumenOfertaCaja(detalle, precios, lista) : null
  return <div className="pos-offer-card"><button className="pos-product" disabled={disabled || recurso.loading || !!recurso.error || !resumen} onClick={() => detalle && onAgregar(detalle)}><small>OFERTA</small><strong>{oferta.nombre}</strong>
    {recurso.loading ? <span>Cargando componentes…</span> : detalle?.productos.filter(p => p.activo).map(p => <span key={p.productoId}>{cantidadFormato(p.cantidad ?? 1)} {p.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'} de {p.nombre}</span>)}
    {resumen ? <>{detalle?.descuentoPorcentaje == null ? <span>Precio pactado por combo</span> : <span>Lista: {formatearMonto(resumen.subtotal)} · Descuento: {formatearMonto(resumen.descuento)}</span>}<strong>Total del combo: {formatearMonto(resumen.total)}</strong></> : !recurso.loading && <span>Precio no disponible</span>}
    <span className="pos-add">+ Agregar oferta</span></button>{recurso.error && <button className="button" onClick={recurso.refetch}>Reintentar {oferta.nombre}</button>}</div>
}

export function SalesPage() {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1)
  const [categoria, setCategoria] = useState(''), [orden, setOrden] = useState('nombre_asc')
  const [tab, setTab] = useState<'productos' | 'ofertas'>('productos')
  const [items, setItems] = useState<Item[]>([]), [lista, setLista] = useState<ListaPrecio>('MINORISTA')
  const [saving, setSaving] = useState(false), [confirmando, setConfirmando] = useState(false), [revision, setRevision] = useState(0)
  const [error, setError] = useState(''), [recibo, setRecibo] = useState<VentaCompleta | null>(null), [vaciar, setVaciar] = useState(false)
  const [resultadoIncierto, setResultadoIncierto] = useState(false)
  const submitLock = useRef(false), searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => { const timeout = setTimeout(() => { setQuery(search); setPage(1) }, 200); return () => clearTimeout(timeout) }, [search])
  const productos = useApiResource(() => buscarProductosCaja(query, page, undefined, { categoria, orden }), `${query}:${categoria}:${orden}:${page}`)
  const categorias = useApiResource(fetchCategoriasCaja), ofertas = useApiResource(fetchOfertas), precios = useApiResource(fetchPreciosVigentes)
  const precioPorId = new Map((precios.data ?? []).map(p => [p.productoId, p]))
  function payload(exigirPeso: boolean): LineaVenta[] {
    return items.map(item => {
      const cantidad = cantidadInput(item.cantidad, item.unidad)
      const despacho = item.componentes?.map(p => {
        if (exigirPeso && p.unidad === 'KILOS' && !p.pesoReal.trim()) throw new Error(`Ingresá el peso real de ${p.nombre}.`)
        const cantidadReal = p.unidad === 'UNIDADES' || !p.pesoReal.trim() ? cantidad * p.cantidadPorCombo : cantidadInput(p.pesoReal, 'KILOS')
        if (cantidadReal > 1000000 || Math.abs(cantidadReal * 1000 - Math.round(cantidadReal * 1000)) > 1e-6) throw new Error('El pesaje admite hasta tres decimales y un máximo de 1000000.')
        return { productoId: p.productoId, cantidadReal }
      })
      return { productoId: item.productoId, ofertaId: item.ofertaId, cantidad, tipoPrecio: lista, ...(despacho ? { despacho } : {}) }
    })
  }
  const cotizacion = useApiResource(() => items.length ? cotizar(payload(false)) : Promise.resolve(null), JSON.stringify({ items, lista }))
  const pesajesCompletos = items.every(i => i.componentes?.every(p => p.unidad !== 'KILOS' || p.pesoReal.trim()) ?? true)
  function agregar(item: Omit<Item, 'cantidad'>) {
    setError(''); setRecibo(null)
    setItems(actual => actual.some(i => i.key === item.key) ? actual.map(i => i.key === item.key ? { ...i, cantidad: String(Number(i.cantidad.replace(',', '.')) + 1), componentes: i.componentes?.map(p => ({ ...p, pesoReal: '' })) } : i) : [...actual, { ...item, cantidad: '1' }])
  }
  function agregarOferta(detalle: OfertaConProductos) {
    agregar({ key: `o${detalle.id}`, ofertaId: Number(detalle.id), nombre: detalle.nombre, unidad: 'UNIDADES', componentes: detalle.productos.filter(p => p.activo).map(p => ({ productoId: p.productoId, nombre: p.nombre, unidad: p.unidadVenta === 'UNIDADES' ? 'UNIDADES' : 'KILOS', cantidadPorCombo: p.cantidad ?? 1, pesoReal: '' })) })
  }
  function actualizar() { productos.refetch(); ofertas.refetch(); precios.refetch(); categorias.refetch(); setRevision(r => r + 1) }
  async function cobrar() {
    if (submitLock.current || resultadoIncierto || !cotizacion.data || cotizacion.loading || cotizacion.error || !pesajesCompletos) return
    submitLock.current = true; setSaving(true); setError('')
    try { const venta = await confirmarVenta(payload(true)); setRecibo(venta); setItems([]); setConfirmando(false); actualizar() }
    catch (fallo) {
      if (!(fallo instanceof ApiError) || fallo.status >= 500) { setResultadoIncierto(true); setError('No se pudo comprobar si la venta quedó registrada. Revisá el historial antes de volver a cobrar.') }
      else setError(errorMensaje(fallo))
      setConfirmando(false); cotizacion.refetch()
    } finally { submitLock.current = false; setSaving(false) }
  }
  const ofertasVisibles = (ofertas.data ?? []).filter(o => o.activo && o.vigente && normalize(o.nombre).includes(normalize(search)))
  const listaLista = !cotizacion.loading && !!cotizacion.data && !cotizacion.error && pesajesCompletos
  const buscando = search !== query
  return <section><Encabezado title="Caja y mostrador" description="Cobrá productos y promociones registrando el pesaje real despachado." actions={<Link className="button" to="/ventas">Historial de ventas</Link>}/>
    <div className="pos-layout"><div className="catalog-panel pos-catalog">
      <div className="filters"><label className="search-field"><input autoFocus ref={searchRef} aria-label="Buscar artículo para vender" placeholder="Nombre del producto…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => {
        if (e.key !== 'Enter' || tab !== 'productos' || buscando || productos.loading) return
        const exacto = productos.data?.rows.find(p => normalize(p.nombre) === normalize(search) || normalize(p.codigo) === normalize(search))
        if (exacto && precioPorId.has(exacto.id)) { e.preventDefault(); agregar({ key: `p${exacto.id}`, productoId: exacto.id, nombre: exacto.nombre, unidad: exacto.unidadVenta }); setSearch('') }
      }}/></label><button className="button" onClick={actualizar}>Actualizar</button></div>
      <div className="category-tabs" role="group" aria-label="Tipo de artículo"><button aria-pressed={tab === 'productos'} className={tab === 'productos' ? 'selected' : ''} onClick={() => setTab('productos')}>Productos</button><button aria-pressed={tab === 'ofertas'} className={tab === 'ofertas' ? 'selected' : ''} onClick={() => setTab('ofertas')}>Ofertas vigentes</button></div>
      {tab === 'productos' && <div className="filters pos-category-filters"><label>Categoría<select aria-label="Filtrar por categoría" value={categoria} disabled={categorias.loading} onChange={e => { setCategoria(e.target.value); setPage(1) }}><option value="">Todas las categorías</option>{(categorias.data ?? []).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></label><label>Ordenar<select aria-label="Ordenar productos" value={orden} onChange={e => { setOrden(e.target.value); setPage(1) }}><option value="nombre_asc">Nombre A–Z</option><option value="nombre_desc">Nombre Z–A</option><option value="mas_vendido">Más vendido</option></select></label></div>}
      <ErrorCarga error={tab === 'productos' ? productos.error : ofertas.error} retry={tab === 'productos' ? productos.refetch : ofertas.refetch}/><ErrorCarga error={precios.error} retry={precios.refetch}/>{tab === 'productos' && <ErrorCarga error={categorias.error} retry={categorias.refetch}/>}
      {tab === 'productos' ? <>{productos.loading || precios.loading ? <p className="operation-loading" role="status">Buscando productos…</p> : <div className="pos-product-grid">{productos.data?.rows.map(p => {
        const precio = precioPorId.get(p.id), monto = lista === 'MINORISTA' ? precio?.precioMinorista : precio?.precioMayorista
        return <button className="pos-product" key={p.id} disabled={monto == null || buscando || saving} onClick={() => agregar({ key: `p${p.id}`, productoId: p.id, nombre: p.nombre, unidad: p.unidadVenta })}><strong>{p.nombre}</strong><span>{monto == null ? 'Sin precio en esta lista' : `${formatearMonto(monto)} / ${unidadCorta(p.unidadVenta)}`}</span><span className="pos-add">+ Agregar</span></button>
      })}</div>}{!productos.loading && productos.data?.count === 0 && <Vacio>No encontramos productos con esa búsqueda.</Vacio>}<Paginacion page={page} count={productos.data?.count ?? 0} onChange={setPage} disabled={productos.loading}/></> : <>{ofertas.loading ? <p className="operation-loading">Cargando ofertas…</p> : <div className="pos-product-grid">{ofertasVisibles.map(o => <TarjetaOferta key={o.id} oferta={o} precios={precios.data ?? []} lista={lista} revision={revision} disabled={saving || precios.loading || !!precios.error} onAgregar={agregarOferta}/>)}</div>}{!ofertas.loading && !ofertasVisibles.length && <Vacio>No hay ofertas vigentes para esta búsqueda.</Vacio>}</>}
    </div><aside className="catalog-panel pos-cart"><div className="catalog-title"><div><h2>Venta actual <span className="count">{items.length}</span></h2><p>Kilos, unidades y combos.</p></div></div>
      <label className="cart-list-label">Lista de precios<select aria-label="Lista de precios" disabled={saving} value={lista} onChange={e => setLista(e.target.value as ListaPrecio)}><option value="MINORISTA">Minorista</option><option value="MAYORISTA">Mayorista</option></select></label>
      {!items.length ? <Vacio>Agregá productos u ofertas para comenzar.</Vacio> : <ul className="cart-items">{items.map((item, index) => <li key={item.key}>
        <div className="cart-item-title"><strong>{item.nombre}</strong><button className="icon-button danger-text" disabled={saving} aria-label={`Quitar ${item.nombre}`} onClick={() => setItems(actual => actual.filter(i => i.key !== item.key))}>×</button></div>
        <div className="cart-item-values"><label>{item.ofertaId ? 'Cantidad de combos' : `Cantidad (${unidadCorta(item.unidad)})`}<input aria-label={`Cantidad de ${item.nombre}`} inputMode={item.unidad === 'KILOS' ? 'decimal' : 'numeric'} disabled={saving} value={item.cantidad} onChange={e => setItems(actual => actual.map(i => i.key === item.key ? { ...i, cantidad: e.target.value, componentes: i.componentes?.map(p => ({ ...p, pesoReal: '' })) } : i))}/></label><div><small>{cotizacion.loading ? 'Calculando…' : 'Subtotal'}</small><strong>{formatearMonto(cotizacion.data?.detalles[index]?.subtotal)}</strong></div></div>
        {item.componentes && <div className="cart-despacho"><p>Precio por combo: <strong>{formatearMonto(cotizacion.data?.detalles[index]?.importeUnitario)}</strong></p>{item.componentes.map(p => <div key={p.productoId}><p>{p.nombre} · Cantidad promocional: {cantidadFormato(p.cantidadPorCombo * Number(item.cantidad.replace(',', '.')))} {unidadCorta(p.unidad)}</p>{p.unidad === 'KILOS' ? <label>Peso real total (kg)<input aria-label={`Peso real de ${p.nombre} en ${item.nombre}`} inputMode="decimal" placeholder="Pesaje de balanza" disabled={saving} value={p.pesoReal} onChange={e => setItems(actual => actual.map(i => i.key === item.key ? { ...i, componentes: i.componentes?.map(c => c.productoId === p.productoId ? { ...c, pesoReal: e.target.value } : c) } : i))}/></label> : <small>Se despachan las unidades incluidas en el combo.</small>}</div>)}<small>El peso real descuenta inventario. El precio corresponde a los combos seleccionados.</small></div>}
      </li>)}</ul>}
      {!pesajesCompletos && <p className="form-note" role="status">Completá los pesajes reales antes de cobrar.</p>}<ErrorCarga error={items.length ? cotizacion.error : ''} retry={items.length ? cotizacion.refetch : undefined}/><ErrorCarga error={error}/>
      {resultadoIncierto && <div className="operation-context"><Link to="/ventas" target="_blank" rel="noreferrer">Revisar historial de ventas</Link><p>Confirmá que esta venta no figure antes de reintentarlo.</p><button className="button" onClick={() => { setResultadoIncierto(false); setError('') }}>Ya revisé el historial</button></div>}
      <div className="cart-summary"><span>Total a cobrar</span><strong aria-live="polite">{formatearMonto(items.length ? cotizacion.data?.total : '0')}</strong><button className="button primary checkout-button" disabled={!listaLista || !items.length || saving || resultadoIncierto} onClick={() => { setError(''); setConfirmando(true) }}>Confirmar venta</button><button className="button" disabled={!items.length || saving} onClick={() => setVaciar(true)}>Vaciar carrito</button></div>
    </aside></div>
    {confirmando && cotizacion.data && <Modal title="Confirmar venta" busy={saving} onClose={() => setConfirmando(false)}><p>Se registrará la venta y se descontarán las cantidades reales despachadas.</p>{cotizacion.data.detalles.flatMap((d, i) => d.despacho?.map(p => <p key={`${i}:${p.productoId}`}>{p.nombre}: {cantidadFormato(p.cantidadReal)} {unidadCorta(p.unidadVenta)} de inventario</p>) ?? [])}<div className="receipt-total"><span>Total</span><strong>{formatearMonto(cotizacion.data.total)}</strong></div><div className="modal-footer"><button className="button" disabled={saving} onClick={() => setConfirmando(false)}>Volver</button><button className="button primary" disabled={saving} onClick={cobrar}>{saving ? 'Registrando venta…' : 'Registrar venta'}</button></div></Modal>}
    {vaciar && <Modal title="Vaciar carrito" onClose={() => setVaciar(false)}><p>Se quitarán los artículos de la venta actual.</p><div className="modal-footer"><button className="button" onClick={() => setVaciar(false)}>Volver</button><button className="button danger" onClick={() => { setItems([]); setError(''); setVaciar(false); searchRef.current?.focus() }}>Vaciar carrito</button></div></Modal>}
    {recibo && <Modal title="Venta registrada" onClose={() => { setRecibo(null); searchRef.current?.focus() }}><div className="notice success" role="status">Venta #{recibo.venta.id} registrada. El stock ya está actualizado.</div><Receipt data={recibo}/><div className="modal-footer"><Link className="button" to={`/ventas?ventaId=${recibo.venta.id}`}>Ver en historial</Link><button className="button primary" onClick={() => { setRecibo(null); setSearch(''); searchRef.current?.focus() }}>Nueva venta</button></div></Modal>}
  </section>
}
