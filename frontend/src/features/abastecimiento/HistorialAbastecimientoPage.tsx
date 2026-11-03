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
import { estadoTexto, fechaTexto } from './calculos'
import { FormularioAbastecimiento, type InicioFormulario } from './FormularioAbastecimiento'
import { RecepcionModal } from './RecepcionModal'

type Tipo = 'pedidos' | 'compras' | 'recepciones'
type Registro = PedidoCompra | Compra | Recepcion
type Detalle = { registro: Registro; cuenta?: { importePendiente: string; estado: string } | null }
const titulos: Record<Tipo, string> = { pedidos: 'Pedidos a proveedores', compras: 'Compras', recepciones: 'Historial de recepciones' }
export function HistorialAbastecimientoPage({ tipo }: { tipo: Tipo }) {
  const location = useLocation(), navigate = useNavigate()
  const inicial = (location.state as { nuevoPedido?: InicioFormulario; nuevaCompra?: InicioFormulario } | null)
  const [form, setForm] = useState<InicioFormulario | null>(tipo === 'pedidos' ? inicial?.nuevoPedido ?? null : tipo === 'compras' ? inicial?.nuevaCompra ?? null : null)
  const [filtros, setFiltros] = useState<FiltrosAbastecimiento>({ page: 1 })
  const proveedores = useApiResource(fetchProveedores)
  const recurso = useApiResource(() => listarAbastecimiento<Registro>(tipo, filtros), JSON.stringify({ tipo, filtros }))
  const [detalle, setDetalle] = useState<Detalle | null>(null), [recepcion, setRecepcion] = useState<Compra | null>(null), [cancelar, setCancelar] = useState<PedidoCompra | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [ocupado, setOcupado] = useState(false)
  function cerrarFormulario() { setForm(null); if (location.state) navigate(location.pathname, { replace: true, state: null }) }
  async function abrir(id: number, accion: 'detalle' | 'comprar' | 'recibir' = 'detalle') {
    if (ocupado) return
    setOcupado(true); setError('')
    try {
      if (tipo === 'pedidos') {
        const pedido = await fetchPedido(id)
        if (accion === 'comprar') navigate('/compras', { state: { nuevaCompra: { proveedorId: pedido.proveedorId, pedidoId: pedido.id, lineas: pedido.detalles.map(d => ({ productoId: String(d.productoId), cantidad: String(d.cantidad), costo: String(d.costoEstimado ?? 0), unidad: 'VENTA' })) } } })
        else setDetalle({ registro: pedido })
      } else if (tipo === 'compras') {
        const resultado = await fetchCompra(id)
        if (accion === 'recibir') setRecepcion(resultado.compra)
        else setDetalle({ registro: resultado.compra, cuenta: resultado.cuenta })
      } else setDetalle({ registro: await fetchRecepcion(id) })
    } catch (fallo) { setError(errorMensaje(fallo)) } finally { setOcupado(false) }
  }
  async function confirmarCancelacion() {
    if (!cancelar || ocupado) return
    setOcupado(true); setError('')
    try { await cancelarPedido(cancelar.id); setCancelar(null); setNotice('Pedido cancelado.'); recurso.refetch() }
    catch (fallo) { setError(errorMensaje(fallo)) } finally { setOcupado(false) }
  }
  const estados = tipo === 'pedidos' ? ['PENDIENTE', 'FACTURADO', 'RECIBIDO', 'CANCELADO'] : tipo === 'compras' ? ['PENDIENTE_RECEPCION', 'RECIBIDA'] : undefined
  return <section><Encabezado title={titulos[tipo]} description={tipo === 'pedidos' ? 'Confeccioná pedidos y seguí su facturación y recepción.' : tipo === 'compras' ? 'Registrá comprobantes y consultá compras por fecha, proveedor y estado.' : 'Consultá lo recibido y su ingreso al inventario.'} actions={tipo !== 'recepciones' ? <button className="button primary" disabled={proveedores.loading || !!proveedores.error} onClick={() => { setForm({}); setError('') }}>{tipo === 'pedidos' ? 'Nuevo pedido' : 'Nueva compra'}</button> : <Link className="button primary" to="/compras">Recibir una compra</Link>}/><NavegacionAbastecimiento/>
    <ErrorCarga error={proveedores.error} retry={proveedores.refetch}/><ErrorCarga error={recurso.error} retry={recurso.refetch}/>{!cancelar && <ErrorCarga error={error}/>}{notice && <div className="notice success" role="status">{notice}</div>}
    <div className="catalog-panel"><FiltrosAbastecimientoUI filtros={filtros} onChange={setFiltros} proveedores={proveedores.data ?? []} estados={estados}/>
      {recurso.loading ? <p className="operation-loading" role="status">Cargando {tipo}…</p> : <><div className="table-scroll"><table><thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th>{tipo === 'recepciones' ? 'Compra' : 'Estado'}</th>{tipo !== 'recepciones' && <th>{tipo === 'pedidos' ? 'Total estimado' : 'Comprobante / total'}</th>}<th>Acciones</th></tr></thead><tbody>{recurso.data?.rows.map(r => <tr key={r.id}><td>#{r.id}</td><td>{fechaTexto(r.fechaHora)}</td><td>{r.proveedor?.nombre ?? proveedores.data?.find(p => p.id === r.proveedorId)?.nombre ?? `Proveedor #${r.proveedorId}`}</td><td>{'estado' in r ? <span className="badge">{estadoTexto(r.estado)}</span> : `Compra #${r.compraId}`}</td>{tipo !== 'recepciones' && <td>{'totalEstimado' in r ? formatearMonto(r.totalEstimado) : 'total' in r ? <>{r.tipoComprobante} {r.numeroComprobante ?? 'Sin número'}<strong className="supply-amount">{formatearMonto(r.total)}</strong></> : null}</td>}<td><div className="operation-actions"><button className="button" disabled={ocupado} onClick={() => abrir(r.id)}>Ver detalle</button>{tipo === 'pedidos' && 'estado' in r && r.estado === 'PENDIENTE' && <><button className="button" disabled={ocupado} onClick={() => abrir(r.id, 'comprar')}>Registrar compra</button><button className="button danger" disabled={ocupado} onClick={() => { setCancelar(r as PedidoCompra); setError('') }}>Cancelar pedido</button></>}{tipo === 'compras' && 'estado' in r && r.estado === 'PENDIENTE_RECEPCION' && <button className="button primary" disabled={ocupado} onClick={() => abrir(r.id, 'recibir')}>Recibir mercadería</button>}</div></td></tr>)}</tbody></table></div>{!recurso.data?.rows.length && !recurso.error && <Vacio>No hay {tipo} para estos filtros.</Vacio>}<Paginacion page={filtros.page ?? 1} count={recurso.data?.count ?? 0} onChange={page => setFiltros(actual => ({ ...actual, page }))}/></>}
    </div>
    {form && tipo !== 'recepciones' && <FormularioAbastecimiento modo={tipo === 'pedidos' ? 'pedido' : 'compra'} inicio={form} proveedores={proveedores.data ?? []} onClose={cerrarFormulario} onGuardado={id => { cerrarFormulario(); setNotice(`${tipo === 'pedidos' ? 'Pedido' : 'Compra'} #${id} registrado correctamente.`); recurso.refetch() }}/>} 
    {recepcion && <RecepcionModal compra={recepcion} onClose={() => setRecepcion(null)} onGuardado={id => { setRecepcion(null); setNotice(`Recepción #${id} registrada. Stock y costos actualizados.`); recurso.refetch() }}/>} 
    {cancelar && <Modal title={`Cancelar pedido #${cancelar.id}`} onClose={() => setCancelar(null)} busy={ocupado}><ErrorCarga error={error}/><p>El pedido quedará cancelado y conservará su historial. Solo se pueden cancelar pedidos pendientes.</p><div className="modal-footer"><button className="button" disabled={ocupado} onClick={() => setCancelar(null)}>Volver</button><button className="button danger" disabled={ocupado} onClick={confirmarCancelacion}>{ocupado ? 'Cancelando…' : 'Confirmar cancelación'}</button></div></Modal>}
    {detalle && <DetalleAbastecimiento tipo={tipo} detalle={detalle} onClose={() => setDetalle(null)}/>}
  </section>
}

function DetalleAbastecimiento({ tipo, detalle: { registro: r, cuenta }, onClose }: { tipo: Tipo; detalle: Detalle; onClose: () => void }) {
  return <Modal title={`${titulos[tipo]} · #${r.id}`} onClose={onClose}><p>{r.proveedor?.nombre} · {fechaTexto(r.fechaHora)}</p>{'estado' in r && <p>Estado: <strong>{estadoTexto(r.estado)}</strong></p>}{'numeroComprobante' in r && <p>{r.tipoComprobante} {r.numeroComprobante ?? 'Sin número'}{'pedidoId' in r && r.pedidoId ? ` · Pedido #${r.pedidoId}` : ''}</p>}{'compraId' in r && <p>Compra #{r.compraId}</p>}
    <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Cantidad base</th><th>{tipo === 'recepciones' ? 'Presentación recibida' : 'Costo base / subtotal'}</th></tr></thead><tbody>{r.detalles?.map((d, i) => <tr key={d.id ?? i}><td>{d.producto?.nombre ?? 'Producto no disponible'}</td><td>{cantidadFormato(Number(d.cantidadBase ?? d.cantidad))} {d.producto?.unidadVenta === 'UNIDADES' ? 'un.' : 'kg'}</td><td>{tipo === 'recepciones' ? <>{d.cantidadPresentacion} {d.presentacion} × {d.factorConversion}</> : <>{formatearMonto(d.costoUnitario ?? d.costoEstimado)}<strong className="supply-amount">{formatearMonto(d.subtotal)}</strong>{d.cantidadPresentacion != null && <small>{d.cantidadPresentacion} {d.presentacion} × {d.factorConversion}</small>}</>}</td></tr>)}</tbody></table></div>
    {'total' in r && <div className="receipt-total"><span>Total</span><strong>{formatearMonto(r.total)}</strong></div>}{'totalEstimado' in r && <div className="receipt-total"><span>Total estimado</span><strong>{formatearMonto(r.totalEstimado)}</strong></div>}
    {r.observaciones && <p>Observaciones: {r.observaciones}</p>}{cuenta && <p>Cuenta corriente: {cuenta.estado} · Pendiente {formatearMonto(cuenta.importePendiente)}</p>}
    {'movimientosStock' in r && !!r.movimientosStock?.length && <div><h3>Ingreso al inventario</h3>{r.movimientosStock.map(m => <p key={m.id}>Movimiento #{m.id} · {r.detalles?.find(d => d.productoId === m.productoId)?.producto?.nombre ?? 'Producto no disponible'} · Ingreso {cantidadFormato(m.cantMovimiento)} · Stock final {cantidadFormato(m.cantFinal)}</p>)}</div>}
    <div className="modal-footer"><button className="button primary" onClick={onClose}>Cerrar</button></div>
  </Modal>
}
