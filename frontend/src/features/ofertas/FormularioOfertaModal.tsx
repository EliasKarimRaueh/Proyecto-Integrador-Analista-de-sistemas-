import { fechaInputOferta } from './fechasOfertas'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { Icon } from '../../shared/components/Icon'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { esFechaValida, fechaInputDesdeHoy, formatearMonto, subtotalListaCentavos, parseMontoInput } from '../../shared/lib/money'
import { cantidadInput } from '../../shared/lib/operaciones'
import { fetchProducts } from '../../shared/services/api'
import { actualizarOferta, crearOferta, fetchOferta, reactivarOferta } from '../../shared/services/ofertas'
import { fetchPreciosVigentes } from '../../shared/services/precios'
import { normalize, type Oferta } from './ofertas'

type Draft = { nombre: string; descripcion: string; fechaInicio: string; fechaFin: string; precioFinal: string; productos: { productoId: number; cantidad: string }[] }
export function FormularioOfertaModal({ oferta, modo = 'editar', ofertasExistentes, onClose, onGuardado }: { oferta?: Oferta; modo?: 'editar' | 'copiar' | 'reactivar'; ofertasExistentes?: Oferta[]; onClose: () => void; onGuardado: () => void }) {
  const carga = useApiResource(async () => {
    const [productos, precios, detalle] = await Promise.all([fetchProducts(), fetchPreciosVigentes(), oferta ? fetchOferta(oferta.id) : Promise.resolve(null)])
    return { productos, precios, detalle }
  }, oferta?.id ?? 'alta')
  const [draft, setDraft] = useState<Draft>({ nombre: '', descripcion: '', fechaInicio: fechaInputDesdeHoy(0), fechaFin: fechaInputDesdeHoy(7), precioFinal: '', productos: [] })
  const [buscar, setBuscar] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const lock = useRef(false), inicializado = useRef(false)
  useEffect(() => {
    const d = carga.data?.detalle
    if (!d || inicializado.current) return
    inicializado.current = true
    const precioFinal = d.precioFinal ?? d.resumen?.total ?? (d.descuentoPorcentaje == null ? (d.productos.filter(p => p.activo).reduce((s, p) => s + Math.round(Number(p.precioOferta) * 100), 0) / 100).toFixed(2) : '')
    setDraft({ nombre: modo === 'copiar' ? `${d.nombre.slice(0, 42)} (copia)` : d.nombre, descripcion: d.descripcion ?? '', fechaInicio: modo === 'editar' ? fechaInputOferta(d.fechaInicio) : fechaInputDesdeHoy(0), fechaFin: modo === 'editar' ? fechaInputOferta(d.fechaFin) : fechaInputDesdeHoy(7), precioFinal, productos: d.productos.filter(p => p.activo).map(p => ({ productoId: p.productoId, cantidad: String(p.cantidad ?? 1) })) })
  }, [carga.data, modo])
  const productos = carga.data?.productos ?? []
  const precios = new Map((carga.data?.precios ?? []).map(p => [p.productoId, p.precioMinorista]))
  const candidatos = productos.filter(p => p.active && !draft.productos.some(i => i.productoId === Number(p.id)) && normalize(p.name).includes(normalize(buscar)))
  function cantidad(item: Draft['productos'][number]) {
    const p = productos.find(p => Number(p.id) === item.productoId)
    return cantidadInput(item.cantidad, p?.unit === 'unidad' ? 'UNIDADES' : 'KILOS')
  }
  const subtotales = draft.productos.map(item => {
    try { const precio = precios.get(item.productoId); return precio === undefined ? null : subtotalListaCentavos(precio, cantidad(item)) }
    catch { return null }
  })
  const subtotal = subtotales.every(s => s !== null) ? subtotales.reduce<number>((s, i) => s + (i ?? 0), 0) : null
  const precioFinal = parseMontoInput(draft.precioFinal, 'precio final de la oferta')
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (lock.current) return
    setError('')
    if (!draft.nombre.trim() || draft.nombre.trim().length > 50) { setError('Ingresá un nombre de hasta 50 caracteres.'); return }
    if (ofertasExistentes?.some(o => (modo === 'copiar' || o.id !== oferta?.id) && normalize(o.nombre) === normalize(draft.nombre))) { setError('Ya existe una oferta con ese nombre.'); return }
    if (!esFechaValida(draft.fechaInicio) || draft.fechaFin && (!esFechaValida(draft.fechaFin) || draft.fechaFin <= draft.fechaInicio)) { setError('La fecha de fin debe ser posterior al inicio.'); return }
    if (!draft.productos.length) { setError('Agregá al menos un producto a la oferta.'); return }
    if (!precioFinal.ok) { setError(precioFinal.error); return }
    try { draft.productos.forEach(cantidad) } catch (fallo) { setError(fallo instanceof Error ? fallo.message : 'Revisá las cantidades.'); return }
    if (subtotal === null) { setError('No se puede validar el precio final porque faltan precios de lista vigentes en uno o más productos.'); return }
    if (Math.round(Number(precioFinal.value) * 100) >= subtotal) { setError('El precio final debe ser menor a la suma de los precios base de los productos.'); return }
    if (draft.productos.some(i => !productos.find(p => Number(p.id) === i.productoId)?.active)) { setError('Quitá los productos inactivos antes de guardar.'); return }
    const payload = { nombre: draft.nombre.trim(), descripcion: draft.descripcion.trim(), fechaInicio: draft.fechaInicio, fechaFin: draft.fechaFin || null, precioFinal: precioFinal.value, productos: draft.productos.map(i => ({ productoId: i.productoId, cantidad: cantidad(i) })) }
    lock.current = true; setSaving(true)
    try { if (oferta && modo === 'reactivar') await reactivarOferta(oferta.id, payload); else if (oferta && modo !== 'copiar') await actualizarOferta(oferta.id, payload); else await crearOferta(payload); onGuardado() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la oferta.') }
    finally { lock.current = false; setSaving(false) }
  }
  return <Modal className="modal-oferta" title={oferta ? `${modo === 'copiar' ? 'Copiar' : modo === 'reactivar' ? 'Reactivar' : 'Editar'} ${oferta.nombre}` : 'Nueva oferta'} eyebrow="CATÁLOGO DE OFERTAS" busy={saving} onClose={onClose}>
    <ErrorCarga error={carga.error} retry={carga.refetch} />
    {carga.loading ? <p role="status">Cargando catálogo y precios...</p> : carga.data && <form onSubmit={enviar} noValidate>
      <p>Elegí los productos y las cantidades del combo e ingresá el precio final que querés cobrar.</p>
      <ErrorCarga error={error} />
      <fieldset className="proveedor-fields" disabled={saving}><div className="form-grid">
        <label className="full-width">Nombre de la oferta *<input autoFocus aria-label="Nombre de la oferta *" value={draft.nombre} maxLength={50} onChange={e => setDraft({ ...draft, nombre: e.target.value })} /></label>
        <label>Vigente desde *<input aria-label="Vigente desde *" type="date" value={draft.fechaInicio} onChange={e => setDraft({ ...draft, fechaInicio: e.target.value })} /></label>
        <label>Vigente hasta (opcional)<input aria-label="Vigente hasta (opcional)" type="date" min={draft.fechaInicio} value={draft.fechaFin} onChange={e => setDraft({ ...draft, fechaFin: e.target.value })} /><small>Dejá vacío para una vigencia sin fecha de finalización.</small></label>
        <label className="full-width">Descripción<textarea aria-label="Descripción" value={draft.descripcion} maxLength={300} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} /></label>
      </div>
      <h3>Productos del combo</h3><p className="form-note">Modificá la cantidad de cada producto según su unidad de venta: kilos o unidades enteras.</p>
      <label className="search-field"><input aria-label="Buscar producto para agregar" placeholder="Buscar producto por nombre..." value={buscar} onChange={e => setBuscar(e.target.value)} /></label>
      <ul className="product-picker">{candidatos.map(p => <li key={p.id}><div><strong>{p.name}</strong><small>{precios.has(Number(p.id)) ? `${formatearMonto(precios.get(Number(p.id)))} / ${p.unit}` : 'Sin precio de lista'}</small></div><button type="button" className="button" aria-label={`Agregar ${p.name}`} onClick={() => { setDraft({ ...draft, productos: [...draft.productos, { productoId: Number(p.id), cantidad: '1' }] }); setBuscar('') }}>Agregar</button></li>)}</ul>
      {!draft.productos.length ? <p>Todavía no agregaste productos.</p> : <div className="table-scroll oferta-table-scroll"><table className="oferta-subtabla"><thead><tr><th>Producto</th><th>Cantidad por combo</th><th>Precio de lista</th><th>Subtotal de lista</th><th className="actions-heading-center">Acciones</th></tr></thead><tbody>{draft.productos.map((item, index) => {
        const p = productos.find(p => Number(p.id) === item.productoId)
        return <tr key={item.productoId}><td><strong>{p?.name ?? 'Producto no disponible'}</strong>{p && !p.active && <small className="subtle" style={{ display: 'block' }}>Inactivo</small>}</td><td><div className="oferta-cantidad-cell"><input className="precio-input oferta-cantidad-input" inputMode={p?.unit === 'unidad' ? 'numeric' : 'decimal'} aria-label={`Cantidad en oferta de ${p?.name}`} value={item.cantidad} onChange={e => setDraft({ ...draft, productos: draft.productos.map(i => i.productoId === item.productoId ? { ...i, cantidad: e.target.value } : i) })} /><span className="subtle"> {p?.unit === 'unidad' ? 'unidades' : 'kg'}</span></div></td><td>{formatearMonto(precios.get(item.productoId))}</td><td>{subtotales[index] === null ? 'Revisar' : formatearMonto(subtotales[index]! / 100)}</td><td className="actions-cell-center"><button type="button" className="icon-button danger-text oferta-quitar-btn" aria-label={`Quitar ${p?.name}`} title={`Quitar ${p?.name} de la oferta`} onClick={() => setDraft({ ...draft, productos: draft.productos.filter(i => i.productoId !== item.productoId) })}><Icon name="close" size={20} /></button></td></tr>
      })}</tbody></table></div>}
      <label className="oferta-precio-final">Precio final de la oferta *<input aria-label="Precio final de la oferta *" inputMode="decimal" placeholder="Ej. 25000,00" value={draft.precioFinal} onChange={e => setDraft({ ...draft, precioFinal: e.target.value })} /></label>
      <dl className="detail-grid"><div><dt>Subtotal de lista (referencia)</dt><dd>{subtotal === null ? '—' : formatearMonto(subtotal / 100)}</dd></div><div><dt>Precio final del combo</dt><dd>{precioFinal.ok ? formatearMonto(precioFinal.value) : '—'}</dd></div></dl>
      <p className="form-note">Se cobrará este precio por cada combo, con las cantidades indicadas.</p>
      </fieldset><div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando...' : modo === 'reactivar' ? 'Confirmar reactivación' : oferta && modo !== 'copiar' ? 'Guardar cambios' : 'Registrar oferta'}</button></div>
    </form>}
  </Modal>
}
