import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga, Paginacion } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearMonto, hoyComoFechaInput, parseMontoInput } from '../../shared/lib/money'
import { fetchCuentaProveedor, pagarProveedor, registrarComprobante, type PagoProveedor } from '../../shared/services/proveedores'
import { ApiError } from '../../shared/services/api'
import type { Proveedor } from './proveedores'

const fecha = (valor: string) => new Date(valor).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
type Formulario = { modo: 'pago' | 'comprobante'; importe: string; numero: string; fecha: string; clave: string; confirmar: boolean }
export function CuentaProveedorModal({ proveedor, onClose }: { proveedor: Proveedor; onClose: () => void }) {
  const [filtros, setFiltros] = useState({ page: 1, estado: 'TODAS', desde: '', hasta: '' })
  const [tab, setTab] = useState<'cuentas' | 'pagos'>('cuentas')
  const recurso = useApiResource(() => fetchCuentaProveedor(proveedor.id, filtros), JSON.stringify(filtros))
  const [form, setForm] = useState<Formulario | null>(null)
  const [error, setError] = useState(''), [aviso, setAviso] = useState(''), [saving, setSaving] = useState(false)
  const [recibo, setRecibo] = useState<PagoProveedor | null>(null)
  const [incierto, setIncierto] = useState(false)
  const lock = useRef(false)
  const datos = recurso.data
  function abrir(modo: Formulario['modo']) {
    setForm({ modo, importe: '', numero: '', fecha: hoyComoFechaInput(), clave: crypto.randomUUID(), confirmar: false })
    setError(''); setAviso(''); setRecibo(null); setIncierto(false)
  }
  function cambiar(cambios: Partial<Formulario>) { if (!incierto) setForm(actual => actual && ({ ...actual, ...cambios, confirmar: false })) }
  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (!form || lock.current || !datos) return
    const monto = parseMontoInput(form.importe, 'importe')
    if (!monto.ok) { setError(monto.error); return }
    if (!incierto && form.modo === 'pago' && Number(monto.value) > Number(datos.saldo)) { setError('El pago no puede superar la deuda pendiente.'); return }
    if (form.modo === 'comprobante' && (!form.numero.trim() || !form.fecha || form.fecha > hoyComoFechaInput())) { setError('Completá el número y una fecha válida que no sea futura.'); return }
    if (!form.confirmar) { setError(''); setForm({ ...form, confirmar: true }); return }
    lock.current = true; setSaving(true); setError('')
    try {
      if (form.modo === 'pago') {
        const resultado = await pagarProveedor(proveedor.id, monto.value, form.clave)
        setRecibo({ ...resultado.pago, pagosPorCuenta: resultado.aplicaciones })
        setAviso(`Pago #${resultado.pago.id} registrado correctamente.`)
      } else {
        const resultado = await registrarComprobante(proveedor.id, { total: monto.value, fecha: form.fecha, numeroComprobante: form.numero.trim(), claveOperacion: form.clave })
        setAviso(`Comprobante #${resultado.id} registrado correctamente.`)
      }
      setForm(null); setIncierto(false); recurso.refetch()
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) { setIncierto(true); setError('No pudimos comprobar el resultado. Reintentá esta misma operación: no se registrará dos veces.') }
      else { setIncierto(false); setError(e.message); setForm(actual => actual && ({ ...actual, confirmar: false })); recurso.refetch() }
    } finally { lock.current = false; setSaving(false) }
  }
  return <Modal title={`Cuenta corriente · ${proveedor.nombre}`} busy={saving || incierto} onClose={onClose}>
    <ErrorCarga error={recurso.error} retry={recurso.refetch} />
    {aviso && <div className="notice success" role="status">{aviso}</div>}
    {!form && <div className="history-filters"><label>Desde<input aria-label="Desde" type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value, page: 1 })} /></label><label>Hasta<input aria-label="Hasta" type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value, page: 1 })} /></label><label>Estado del comprobante<select value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value, page: 1 })}>{['TODAS', 'PAGO PENDIENTE', 'PAGO PARCIAL', 'PAGADO'].map(e => <option key={e}>{e}</option>)}</select></label><button className="button" onClick={() => setFiltros({ page: 1, estado: 'TODAS', desde: '', hasta: '' })}>Limpiar filtros</button></div>}
    {recurso.loading ? <p role="status">Cargando estado de cuenta...</p> : datos && <>
      <div className="cuenta-resumen"><div><span>Deuda pendiente total</span><strong>{formatearMonto(datos.saldo)}</strong></div><div><span>Crédito sin aplicar</span><strong>{formatearMonto(datos.credito)}</strong></div></div>
      <p className="form-note">El saldo total incluye todas las fechas. Los pagos cancelan primero los comprobantes más antiguos.</p>
      {!form && <div className="operation-actions"><button className="button primary" disabled={Number(datos.saldo) <= 0} onClick={() => abrir('pago')}>Registrar pago</button><button className="button" disabled={!datos.proveedor.activo || !datos.proveedor.ctaCte} onClick={() => abrir('comprobante')}>Registrar comprobante</button></div>}
      {!datos.proveedor.ctaCte && <p>La cuenta corriente no está habilitada para nuevos comprobantes.</p>}
      {form && <form className="cuenta-form" onSubmit={enviar} noValidate>
        <h3>{form.modo === 'pago' ? 'Registrar pago' : 'Registrar comprobante'}</h3>
        <fieldset className="proveedor-fields" disabled={saving || incierto || form.confirmar}>
          {form.modo === 'comprobante' && <><p>Registrá la deuda de una factura recibida. Esta operación no modifica existencias.</p><label>Número de comprobante<input aria-label="Número de comprobante" maxLength={80} value={form.numero} onChange={e => cambiar({ numero: e.target.value })} /></label><label>Fecha del comprobante<input aria-label="Fecha del comprobante" type="date" max={hoyComoFechaInput()} value={form.fecha} onChange={e => cambiar({ fecha: e.target.value })} /></label></>}
          <label>Importe<input autoFocus aria-label="Importe" inputMode="decimal" value={form.importe} onChange={e => cambiar({ importe: e.target.value })} /></label>
          {form.modo === 'pago' && <button className="button" type="button" onClick={() => cambiar({ importe: datos.saldo.replace('.', ',') })}>Pagar saldo total</button>}
        </fieldset>
        {form.confirmar && <p role="status">Confirmá {form.modo === 'pago' ? 'el pago' : 'el comprobante'} por <strong>{formatearMonto(form.importe.replace(',', '.'))}</strong> para {proveedor.nombre}.</p>}
        <ErrorCarga error={error} />
        <div className="modal-footer"><button className="button" type="button" disabled={saving || incierto} onClick={() => { setForm(null); setError('') }}>Cancelar operación</button>{form.confirmar && !incierto && <button className="button" type="button" disabled={saving} onClick={() => setForm({ ...form, confirmar: false })}>Corregir</button>}<button className="button primary" disabled={saving}>{saving ? 'Registrando...' : incierto ? 'Reintentar operación' : form.confirmar ? 'Confirmar registro' : 'Revisar operación'}</button></div>
      </form>}
      {recibo && <div className="operation-context"><h3>Comprobante de pago #{recibo.id}</h3><p>{fecha(recibo.fechaHora)} · {formatearMonto(recibo.importe)}</p><ul>{recibo.pagosPorCuenta.map(a => <li key={a.cuentaId}>Cuenta #{a.cuentaId}: {formatearMonto(a.importeAplicado)}</li>)}</ul></div>}
      {!form && <>

        <div className="category-tabs"><button className={tab === 'cuentas' ? 'selected' : ''} onClick={() => { setTab('cuentas'); setFiltros({ ...filtros, page: 1 }) }}>Comprobantes</button><button className={tab === 'pagos' ? 'selected' : ''} onClick={() => { setTab('pagos'); setFiltros({ ...filtros, page: 1 }) }}>Pagos realizados</button></div>
        <div className="table-scroll">{tab === 'cuentas' ? <table><thead><tr><th>Comprobante</th><th>Fecha</th><th>Total</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody>{datos.cuentas.rows.map(c => <tr key={c.id}><td>{c.compra.numeroComprobante || `Compra #${c.compraId}`}<small className="product-description">Cuenta #{c.id}</small></td><td>{fecha(c.compra.fechaHora)}</td><td>{formatearMonto(c.compra.total)}</td><td>{formatearMonto(c.importePendiente)}</td><td>{c.estado}</td></tr>)}</tbody></table> : <table><thead><tr><th>Pago</th><th>Fecha</th><th>Importe</th><th>Aplicaciones</th></tr></thead><tbody>{datos.pagos.rows.map(p => <tr key={p.id}><td>#{p.id}</td><td>{fecha(p.fechaHora)}</td><td>{formatearMonto(p.importe)}</td><td>{p.pagosPorCuenta.map(a => <div key={a.cuentaId}>Cuenta #{a.cuentaId}: {formatearMonto(a.importeAplicado)}</div>)}{Number(p.importePendiente) > 0 && <small>Sin aplicar: {formatearMonto(p.importePendiente)}</small>}<button className="product-link" onClick={() => setRecibo(p)}>Ver comprobante de pago #{p.id}</button></td></tr>)}</tbody></table>}</div>
        {datos[tab].count === 0 && <p>No hay movimientos para estos filtros.</p>}
        <Paginacion page={filtros.page} count={datos[tab].count} onChange={page => setFiltros({ ...filtros, page })} />
      </>}
    </>}
    <div className="modal-footer"><button className="button" disabled={saving || incierto} onClick={onClose}>Cerrar cuenta</button></div>
  </Modal>
}
