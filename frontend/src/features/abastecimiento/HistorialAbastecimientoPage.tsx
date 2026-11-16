import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Encabezado, ErrorCarga, Paginacion, Vacio } from '../../shared/components/OperacionesUI'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fetchProveedores } from '../../shared/services/proveedores'
import { cancelarPedido, fetchCompra, fetchPedido, fetchRecepcion, listarAbastecimiento, type Compra, type PedidoCompra, type Recepcion, type FiltrosAbastecimiento } from '../../shared/services/abastecimiento'
import { cantidadFormato, errorMensaje } from '../../shared/lib/operaciones'
import { formatearMonto } from '../../shared/lib/money'
import { NavegacionAbastecimiento, FiltrosAbastecimientoUI } from './AbastecimientoUI'
import { conformidadTexto, estadoTexto, fechaTexto } from './calculos'
import { FormularioAbastecimiento, type InicioFormulario } from './FormularioAbastecimiento'
import { RecepcionModal } from './RecepcionModal'
import { CompraRecepcionModal, SeleccionarRecepcionModal } from './CompraRecepcionModal'

type Tipo = 'pedidos' | 'compras' | 'recepciones'
type Registro = PedidoCompra | Compra | Recepcion
type Detalle = { registro: Registro; cuenta?: { importePendiente: string; estado: string } | null; totalRecibido?: string | null }
const titulos: Record<Tipo, string> = { pedidos: 'Pedidos a proveedores', compras: 'Compras', recepciones: 'Historial de recepciones' }
async function consultar(tipo: Tipo, id: number): Promise<Detalle> {
  if (tipo === 'compras') { const d = await fetchCompra(id); return { registro: d.compra, cuenta: d.cuenta, totalRecibido: d.totalRecibido } }
  return { registro: tipo === 'pedidos' ? await fetchPedido(id) : await fetchRecepcion(id) }
}

export function HistorialAbastecimientoPage({ tipo }: { tipo: Tipo }) {
  const location = useLocation(), navigate = useNavigate(), parametros = new URLSearchParams(location.search)
  const inicial = location.state as { nuevoPedido?: InicioFormulario; nuevaCompra?: InicioFormulario } | null
  const [form, setForm] = useState<InicioFormulario | null>(tipo === 'pedidos' ? inicial?.nuevoPedido ?? null : null)
  const [elegirRecepcion, setElegirRecepcion] = useState(tipo === 'compras' && (parametros.get('nueva') === '1' || Boolean(inicial?.nuevaCompra && !inicial.nuevaCompra.recepcionId)))
  const [compraIdRecepcion, setCompraIdRecepcion] = useState<number | null>(inicial?.nuevaCompra?.recepcionId ?? null)
  const [filtros, setFiltros] = useState<FiltrosAbastecimiento>({ page: 1 })
  const proveedores = useApiResource(fetchProveedores)
  const recurso = useApiResource(() => listarAbastecimiento<Registro>(tipo, filtros), JSON.stringify({ tipo, filtros }))
  const [detalle, setDetalle] = useState<Detalle | null>(null), [recepcion, setRecepcion] = useState<PedidoCompra | null>(null), [cancelar, setCancelar] = useState<PedidoCompra | null>(null)
  const [ofrecerCompra, setOfrecerCompra] = useState<number | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [ocupado, setOcupado] = useState(false)
  function limpiarInicio() { if (location.state || parametros.has('nueva')) navigate(location.pathname, { replace: true, state: null }) }
  async function abrir(id: number, recibir = false) {
    if (ocupado) return
    setOcupado(true); setError('')
    try { const d = await consultar(tipo, id); if (recibir && tipo === 'pedidos') setRecepcion(d.registro as PedidoCompra); else setDetalle(d) }
    catch (fallo) { setError(errorMensaje(fallo)) } finally { setOcupado(false) }
  }
  async function confirmarCancelacion() {
    if (!cancelar || ocupado) return
    setOcupado(true); setError('')
    try { await cancelarPedido(cancelar.id); setCancelar(null); setNotice('Pedido cancelado.'); recurso.refetch() }
    catch (fallo) { setError(errorMensaje(fallo)) } finally { setOcupado(false) }
  }
  const estados = tipo === 'pedidos' ? ['REALIZADO', 'RECIBIDO', 'CANCELADO'] : tipo === 'compras' ? ['RECIBIDA', 'PENDIENTE_RECEPCION'] : undefined
  return <section><Encabezado title={titulos[tipo]} description="Circuito de abastecimiento: pedido, recepción de mercadería y compra." actions={tipo === 'pedidos' ? <button className="button primary" disabled={proveedores.loading || !!proveedores.error} onClick={() => setForm({})}>Nuevo pedido</button> : tipo === 'compras' ? <button className="button primary" onClick={() => setElegirRecepcion(true)}>Nueva compra</button> : <Link className="button primary" to="/pedidos">Recibir un pedido</Link>}/><NavegacionAbastecimiento/>
    <ErrorCarga error={proveedores.error} retry={proveedores.refetch}/><ErrorCarga error={recurso.error} retry={recurso.refetch}/>{!cancelar && <ErrorCarga error={error}/>}{notice && <div className="notice success" role="status">{notice}</div>}
    <div className="catalog-panel"><FiltrosAbastecimientoUI filtros={filtros} onChange={setFiltros} proveedores={proveedores.data ?? []} estados={estados}/>
      {recurso.loading ? <p role="status">Cargando {tipo}...</p> : <><div className="table-scroll"><table><thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th>Estado / conformidad</th><th>Origen / total</th><th>Acciones</th></tr></thead><tbody>{recurso.data?.rows.map(r => <tr key={r.id}><td>#{r.id}</td><td>{fechaTexto(r.fechaHora)}</td><td>{r.proveedor?.nombre ?? proveedores.data?.find(p => p.id === r.proveedorId)?.nombre}</td><td>{'estado' in r ? estadoTexto(r.estado) : conformidadTexto(r.conformidad)}</td><td>{'totalEstimado' in r ? formatearMonto(r.totalEstimado) : 'total' in r ? <>{r.numeroComprobante ?? 'Sin comprobante'}<strong className="supply-amount">{formatearMonto(r.total)}</strong></> : `Pedido #${r.pedidoId}`}</td><td><div className="operation-actions"><button className="button" disabled={ocupado} onClick={() => abrir(r.id)}>Ver detalle</button>
        {tipo === 'pedidos' && (r as PedidoCompra).estado === 'REALIZADO' && !(r as PedidoCompra).recepcion && <><button className="button primary" disabled={ocupado} onClick={() => abrir(r.id, true)}>Registrar recepción</button><button className="button danger" disabled={ocupado} onClick={() => { setCancelar(r as PedidoCompra); setError('') }}>Cancelar pedido</button></>}
        {tipo === 'recepciones' && !(r as Recepcion).compra && <button className="button primary" onClick={() => setCompraIdRecepcion(r.id)}>Registrar compra</button>}
      </div></td></tr>)}</tbody></table></div>{!recurso.data?.rows.length && !recurso.error && <Vacio>No hay {tipo} para estos filtros.</Vacio>}<Paginacion page={filtros.page ?? 1} count={recurso.data?.count ?? 0} onChange={page => setFiltros(actual => ({ ...actual, page }))}/></>}
    </div>
    {form && <FormularioAbastecimiento modo="pedido" inicio={form} proveedores={proveedores.data ?? []} onClose={() => { setForm(null); limpiarInicio() }} onGuardado={id => { setForm(null); limpiarInicio(); setNotice(`Pedido #${id} registrado correctamente.`); recurso.refetch() }}/>}
    {recepcion && <RecepcionModal pedido={recepcion} onClose={() => setRecepcion(null)} onGuardado={id => { setRecepcion(null); setNotice(`Recepción #${id} registrada. El stock ya está actualizado.`); setOfrecerCompra(id); recurso.refetch() }}/>}
    {ofrecerCompra !== null && <Modal title="Recepción confirmada" onClose={() => setOfrecerCompra(null)}><p>¿Querés registrar la compra de la recepción #{ofrecerCompra} en este momento?</p><div className="modal-footer"><button className="button" onClick={() => setOfrecerCompra(null)}>Más tarde</button><button className="button primary" onClick={() => { setCompraIdRecepcion(ofrecerCompra); setOfrecerCompra(null) }}>Registrar compra ahora</button></div></Modal>}
    {elegirRecepcion && <SeleccionarRecepcionModal proveedorId={Number(parametros.get('proveedorId')) || inicial?.nuevaCompra?.proveedorId} onSelect={id => { setElegirRecepcion(false); setCompraIdRecepcion(id); limpiarInicio() }} onClose={() => { setElegirRecepcion(false); limpiarInicio() }}/>}
    {compraIdRecepcion !== null && <CompraRecepcionModal recepcionId={compraIdRecepcion} onClose={() => { setCompraIdRecepcion(null); limpiarInicio() }} onGuardado={id => { setCompraIdRecepcion(null); limpiarInicio(); setNotice(`Compra #${id} registrada correctamente.`); recurso.refetch() }}/>}
    {cancelar && <Modal title={`Cancelar pedido #${cancelar.id}`} onClose={() => setCancelar(null)} busy={ocupado}><ErrorCarga error={error}/><p>Se puede cancelar un pedido realizado que todavía no tenga recepción.</p><div className="modal-footer"><button className="button" disabled={ocupado} onClick={() => setCancelar(null)}>Volver</button><button className="button danger" disabled={ocupado} onClick={confirmarCancelacion}>Confirmar cancelación</button></div></Modal>}
    {detalle && <DetalleAbastecimiento tipo={tipo} detalle={detalle} onClose={() => setDetalle(null)}/>}
  </section>
}

export function DetalleAbastecimiento({ tipo, detalle: { registro: r, cuenta }, onClose }: { tipo: Tipo; detalle: Detalle; onClose: () => void }) {
  const [asociado, setAsociado] = useState<{ tipo: Tipo; detalle: Detalle } | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  async function abrir(tipoAsociado: Tipo, id: number) {
    setLoading(true); setError('')
    try { setAsociado({ tipo: tipoAsociado, detalle: await consultar(tipoAsociado, id) }) }
    catch (fallo) { setError(errorMensaje(fallo)) } finally { setLoading(false) }
  }
  const pedidoId = 'pedidoId' in r ? r.pedidoId : null
  const recepcion = 'recepcion' in r ? r.recepcion : null
  const compra = 'compra' in r ? r.compra : null
  return <><Modal className="modal-abastecimiento-detalle" title={`${titulos[tipo]} · #${r.id}`} onClose={onClose}>
    <ErrorCarga error={error}/><p>{r.proveedor?.nombre} · {fechaTexto(r.fechaHora)}</p>{'estado' in r && <p>Estado: {estadoTexto(r.estado)}</p>}{'conformidad' in r && <p>Conformidad: {conformidadTexto(r.conformidad)} · Recibe: {r.usuarioNombre ?? 'Dueño'}</p>}
    <div className="operation-actions detalle-abastecimiento-actions">{pedidoId && <button className="button" disabled={loading} onClick={() => abrir('pedidos', pedidoId)}>Ver pedido #{pedidoId}</button>}{recepcion && <button className="button" disabled={loading} onClick={() => abrir('recepciones', recepcion.id)}>Ver recepción #{recepcion.id}</button>}{compra && <button className="button" disabled={loading} onClick={() => abrir('compras', compra.id)}>Ver compra #{compra.id}</button>}</div>
    {'numeroComprobante' in r && <p>{r.tipoComprobante ?? 'Sin comprobante'} {r.numeroComprobante ?? ''} · Forma de pago: {r.formaPago ?? 'Sin informar'}</p>}
    <div className="table-scroll detalle-abastecimiento-table-scroll"><table className="detalle-abastecimiento-tabla"><thead><tr><th>Producto</th>{tipo === 'recepciones' ? <><th>Aceptado</th><th>Rechazado</th><th>Faltante / sobrante</th><th>Presentación</th><th>Motivo</th></> : <><th>Cantidad base</th><th>Costo por unidad de venta</th><th>Costo total</th></>}</tr></thead><tbody>{r.detalles?.map((d, i) => <tr key={d.id ?? i}><td><strong>{d.producto?.nombre ?? 'Producto no disponible'}</strong></td>{tipo === 'recepciones' ? <><td>{cantidadFormato(Number(d.cantidadBase ?? 0))} {d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'}</td><td>{cantidadFormato(Number(d.cantidadRechazadaBase ?? 0))}</td><td>{Number(d.cantidadSobranteBase ?? 0) > 0 ? `Sobrante: ${cantidadFormato(Number(d.cantidadSobranteBase))}` : `Faltante: ${cantidadFormato(Number(d.cantidadFaltanteBase ?? 0))}`}</td><td>{d.cantidadPresentacion} {d.presentacion} × {d.factorConversion}</td><td>{d.motivo ?? '—'}</td></> : <><td>{cantidadFormato(Number(d.cantidad))} {d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'}{d.cantidadPresentacion != null && <small>{d.cantidadPresentacion} {d.presentacion} × {d.factorConversion}</small>}</td><td>{formatearMonto(d.importeUnitario ?? d.costoUnitario ?? d.costoEstimado)}</td><td>{formatearMonto(d.subtotal)}</td></>}</tr>)}</tbody></table></div>
    {'total' in r && <div className="receipt-total"><span>Total</span><strong>{formatearMonto(r.total)}</strong></div>}{'totalEstimado' in r && <div className="receipt-total"><span>Total estimado</span><strong>{formatearMonto(r.totalEstimado)}</strong></div>}
    {r.observaciones && <p>Observaciones: {r.observaciones}</p>}{cuenta && <p>Cuenta corriente: {cuenta.estado} · Pendiente {formatearMonto(cuenta.importePendiente)}</p>}
    {'movimientosStock' in r && !!r.movimientosStock?.length && <div><h3>Ingreso al inventario</h3>{r.movimientosStock.map(m => <p key={m.id}>Movimiento #{m.id} · Ingreso {cantidadFormato(m.cantMovimiento)} · Stock final {cantidadFormato(m.cantFinal)}</p>)}</div>}
    <div className="modal-footer"><button className="button primary" onClick={onClose}>Cerrar</button></div>
  </Modal>{asociado && <DetalleAbastecimiento tipo={asociado.tipo} detalle={asociado.detalle} onClose={() => setAsociado(null)}/>}</>
}
