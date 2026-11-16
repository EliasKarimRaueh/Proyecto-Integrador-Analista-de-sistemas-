import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga, Paginacion } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearMonto, parseMontoInput } from '../../shared/lib/money'
import { aplicarCreditoProveedor, fetchComprobantePago, fetchCuentaProveedor, pagarProveedor } from '../../shared/services/proveedores'
import { fetchCompra } from '../../shared/services/abastecimiento'
import { ApiError } from '../../shared/services/api'
import { DetalleAbastecimiento } from '../abastecimiento/HistorialAbastecimientoPage'
import type { Proveedor } from './proveedores'

const fecha = (valor: string) => new Date(valor).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
type Formulario = { modo: 'pago' | 'credito'; importe: string; pagoId: string; pendiente: string; clave: string; confirmar: boolean }

function ComprobantePago({ proveedor, id, onClose }: { proveedor: Proveedor; id: number; onClose: () => void }) {
  const recurso = useApiResource(() => fetchComprobantePago(proveedor.id, id), id)
  return <Modal title={`Comprobante de pago #${id}`} onClose={onClose}>
    <ErrorCarga error={recurso.error} retry={recurso.refetch}/>
    {recurso.loading ? <p role="status">Cargando comprobante...</p> : recurso.data && <>
      <p>{proveedor.nombre} · {fecha(recurso.data.pago.fechaHora)}</p>
      <p>Importe del pago: <strong>{formatearMonto(recurso.data.pago.importe)}</strong></p>
      <p>Crédito sin aplicar: <strong>{formatearMonto(recurso.data.pago.importePendiente)}</strong></p>
      <h3>Aplicaciones del pago</h3>
      {recurso.data.aplicaciones.length ? <ul>{recurso.data.aplicaciones.map(a => <li key={a.cuentaId}>{a.cuentaProveedor?.compra?.numeroComprobante ?? (a.cuentaProveedor ? `Compra #${a.cuentaProveedor.compraId}` : `Cuenta #${a.cuentaId}`)}: {formatearMonto(a.importeAplicado)}</li>)}</ul> : <p>Este pago todavía no tiene aplicaciones.</p>}
    </>}
    <div className="modal-footer"><button className="button" onClick={onClose}>Cerrar comprobante</button></div>
  </Modal>
}

function CompraRelacionada({ id, onClose }: { id: number; onClose: () => void }) {
  const recurso = useApiResource(() => fetchCompra(id), id)
  if (recurso.data) return <DetalleAbastecimiento tipo="compras" detalle={{ registro: recurso.data.compra, cuenta: recurso.data.cuenta, totalRecibido: recurso.data.totalRecibido }} onClose={onClose}/>
  return <Modal title={`Compra #${id}`} onClose={onClose}><ErrorCarga error={recurso.error} retry={recurso.refetch}/>{recurso.loading && <p role="status">Cargando compra...</p>}</Modal>
}

export function CuentaProveedorModal({ proveedor, onClose }: { proveedor: Proveedor; onClose: () => void }) {
  const [filtros, setFiltros] = useState({ page: 1, estado: 'TODAS', desde: '', hasta: '' })
  const [tab, setTab] = useState<'cuentas' | 'pagos'>('cuentas')
  const recurso = useApiResource(() => fetchCuentaProveedor(proveedor.id, filtros), JSON.stringify(filtros))
  const [form, setForm] = useState<Formulario | null>(null)
  const [error, setError] = useState(''), [aviso, setAviso] = useState(''), [saving, setSaving] = useState(false)
  const [recibo, setRecibo] = useState<number | null>(null), [compra, setCompra] = useState<number | null>(null)
  const [incierto, setIncierto] = useState(false)
  const lock = useRef(false), datos = recurso.data
  function abrir(modo: Formulario['modo']) {
    const pago = datos?.creditos?.[0]
    setForm({ modo, importe: '', pagoId: pago ? String(pago.id) : '', pendiente: pago ? String(pago.importePendiente) : '', clave: crypto.randomUUID(), confirmar: false })
    setError(''); setAviso(''); setIncierto(false)
  }
  function cambiar(cambios: Partial<Formulario>) { if (!incierto) setForm(actual => actual && ({ ...actual, ...cambios, confirmar: false })) }
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (!form || lock.current || !datos) return
    const monto = form.modo === 'credito' ? { ok: true as const, value: '0.00' } : parseMontoInput(form.importe, 'importe')
    if (!monto.ok) { setError(monto.error); return }
    if (!incierto && form.modo === 'pago' && Number(monto.value) > Number(datos.saldo)) { setError('El pago no puede superar la deuda pendiente.'); return }
    if (form.modo === 'credito' && (!form.pagoId || Number(form.pendiente) <= 0)) { setError('Seleccioná un pago con crédito disponible.'); return }
    if (!form.confirmar) { setError(''); setForm({ ...form, confirmar: true }); return }
    lock.current = true; setSaving(true); setError('')
    try {
      const resultado = form.modo === 'pago' ? await pagarProveedor(proveedor.id, monto.value, form.clave) : await aplicarCreditoProveedor(proveedor.id, Number(form.pagoId), form.pendiente)
      setRecibo(resultado.pago.id)
      setAviso(form.modo === 'pago' ? `Pago #${resultado.pago.id} registrado correctamente.` : `Crédito del pago #${resultado.pago.id} aplicado correctamente.`)
      setForm(null); setIncierto(false); recurso.refetch()
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) { setIncierto(true); setError('No pudimos comprobar el resultado. Reintentá esta misma operación: no se registrará dos veces.') }
      else { setIncierto(false); setError(e.message); setForm(actual => actual && ({ ...actual, confirmar: false })); recurso.refetch() }
    } finally { lock.current = false; setSaving(false) }
  }
  return <>
    <Modal title={`Cuenta corriente · ${proveedor.nombre}`} busy={saving || incierto} onClose={onClose}>
      <ErrorCarga error={recurso.error} retry={recurso.refetch}/>
      {aviso && <div className="notice success" role="status">{aviso}</div>}
      {!form && <div className="history-filters"><label>Desde<input aria-label="Desde" type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value, page: 1 })}/></label><label>Hasta<input aria-label="Hasta" type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value, page: 1 })}/></label><label>Estado del comprobante<select value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value, page: 1 })}>{['TODAS', 'PAGO PENDIENTE', 'PAGO PARCIAL', 'PAGADO'].map(e => <option key={e}>{e}</option>)}</select></label><button className="button" onClick={() => setFiltros({ page: 1, estado: 'TODAS', desde: '', hasta: '' })}>Limpiar filtros</button></div>}
      {recurso.loading ? <p role="status">Cargando estado de cuenta...</p> : datos && <>
        <div className="cuenta-resumen"><div><span>Deuda pendiente total</span><strong>{formatearMonto(datos.saldo)}</strong></div><div><span>Crédito sin aplicar</span><strong>{formatearMonto(datos.credito)}</strong></div></div>
        <p className="form-note">El saldo total incluye todas las fechas. Los pagos y el crédito cancelan primero las compras más antiguas.</p>
        {!form && <div className="operation-actions"><button className="button primary" disabled={Number(datos.saldo) <= 0} onClick={() => abrir('pago')}>Registrar pago</button><button className="button" disabled={Number(datos.saldo) <= 0 || Number(datos.credito) <= 0} onClick={() => abrir('credito')}>Aplicar crédito</button>{datos.proveedor.activo && <a className="button" href={`/compras?nueva=1&proveedorId=${proveedor.id}`}>Registrar compra</a>}</div>}
        {!datos.proveedor.ctaCte && <p>La cuenta corriente no está habilitada para nuevas compras a cuenta.</p>}
        {form && <form className="cuenta-form" onSubmit={enviar} noValidate>
          <h3>{form.modo === 'pago' ? 'Registrar pago' : 'Aplicar crédito sin ingresar dinero'}</h3>
          <fieldset className="proveedor-fields" disabled={saving || incierto || form.confirmar}>
            {form.modo === 'pago' ? <><label>Importe<input autoFocus aria-label="Importe" inputMode="decimal" value={form.importe} onChange={e => cambiar({ importe: e.target.value })}/></label><button className="button" type="button" onClick={() => cambiar({ importe: datos.saldo.replace('.', ',') })}>Pagar saldo total</button></> : <><label>Pago con crédito disponible<select value={form.pagoId} onChange={e => { const pago = datos.creditos.find(p => p.id === Number(e.target.value)); cambiar({ pagoId: e.target.value, pendiente: String(pago?.importePendiente ?? '') }) }}>{(datos.creditos ?? []).map(p => <option key={p.id} value={p.id}>Pago #{p.id} · {fecha(p.fechaHora)} · {formatearMonto(p.importePendiente)}</option>)}</select></label><p>Se aplicará hasta {formatearMonto(Math.min(Number(form.pendiente), Number(datos.saldo)))} a las compras pendientes más antiguas. El resto conservará su crédito.</p></>}
          </fieldset>
          {form.confirmar && <p role="status">Confirmá {form.modo === 'pago' ? `el pago por ${formatearMonto(form.importe.replace(',', '.'))}` : `la aplicación del crédito del pago #${form.pagoId}`} para {proveedor.nombre}.</p>}
          <ErrorCarga error={error}/>
          <div className="modal-footer"><button className="button" type="button" disabled={saving || incierto} onClick={() => { setForm(null); setError('') }}>Cancelar operación</button>{form.confirmar && !incierto && <button className="button" type="button" disabled={saving} onClick={() => setForm({ ...form, confirmar: false })}>Corregir</button>}<button className="button primary" disabled={saving}>{saving ? 'Registrando...' : incierto ? 'Reintentar operación' : form.confirmar ? 'Confirmar registro' : 'Revisar operación'}</button></div>
        </form>}
        {!form && <>
          <div className="category-tabs"><button className={tab === 'cuentas' ? 'selected' : ''} onClick={() => { setTab('cuentas'); setFiltros({ ...filtros, page: 1 }) }}>Comprobantes</button><button className={tab === 'pagos' ? 'selected' : ''} onClick={() => { setTab('pagos'); setFiltros({ ...filtros, page: 1 }) }}>Pagos realizados</button></div>
          <div className="table-scroll">{tab === 'cuentas' ? <table><thead><tr><th>Comprobante</th><th>Fecha</th><th>Total</th><th>Pendiente</th><th>Estado</th><th>Compra</th></tr></thead><tbody>{datos.cuentas.rows.map(c => <tr key={c.id}><td>{c.compra.numeroComprobante || `Compra #${c.compraId}`}<small className="product-description">Cuenta #{c.id}</small></td><td>{fecha(c.compra.fechaHora)}</td><td>{formatearMonto(c.compra.total)}</td><td>{formatearMonto(c.importePendiente)}</td><td>{c.estado}</td><td><button className="product-link" onClick={() => setCompra(c.compraId)}>Ver compra #{c.compraId}</button></td></tr>)}</tbody></table> : <table><thead><tr><th>Pago</th><th>Fecha</th><th>Importe</th><th>Aplicaciones</th></tr></thead><tbody>{datos.pagos.rows.map(p => <tr key={p.id}><td>#{p.id}</td><td>{fecha(p.fechaHora)}</td><td>{formatearMonto(p.importe)}</td><td>{p.pagosPorCuenta.map(a => <div key={a.cuentaId}>Cuenta #{a.cuentaId}: {formatearMonto(a.importeAplicado)}</div>)}{Number(p.importePendiente) > 0 && <small>Sin aplicar: {formatearMonto(p.importePendiente)}</small>}<button className="product-link" onClick={() => setRecibo(p.id)}>Ver comprobante de pago #{p.id}</button></td></tr>)}</tbody></table>}</div>
          {datos[tab].count === 0 && <p>No hay movimientos para estos filtros.</p>}
          <Paginacion page={filtros.page} count={datos[tab].count} onChange={page => setFiltros({ ...filtros, page })}/>
        </>}
      </>}
      <div className="modal-footer"><button className="button" disabled={saving || incierto} onClick={onClose}>Cerrar cuenta</button></div>
    </Modal>
    {recibo !== null && <ComprobantePago proveedor={proveedor} id={recibo} onClose={() => setRecibo(null)}/>}
    {compra !== null && <CompraRelacionada id={compra} onClose={() => setCompra(null)}/>}
  </>
}
