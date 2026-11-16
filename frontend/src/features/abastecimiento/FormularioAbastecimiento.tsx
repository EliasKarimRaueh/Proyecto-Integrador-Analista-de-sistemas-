import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../shared/components/Modal'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fetchProducts, ApiError } from '../../shared/services/api'
import { fetchProductosProveedor } from '../../shared/services/proveedores'
import { guardarPedido } from '../../shared/services/abastecimiento'
import { formatearMonto } from '../../shared/lib/money'
import { errorMensaje, cantidadFormato } from '../../shared/lib/operaciones'
import type { Proveedor } from '../proveedores/proveedores'
import { datosLinea, validarLineas, type LineaEditor } from './calculos'

export type InicioFormulario = { proveedorId?: number; pedidoId?: number; recepcionId?: number; lineas?: LineaEditor[] }

export function FormularioAbastecimiento({ inicio, proveedores, onClose, onGuardado }: { modo: 'pedido'; inicio: InicioFormulario; proveedores: Proveedor[]; onClose: () => void; onGuardado: (id: number) => void }) {
  const [proveedorId, setProveedorId] = useState(String(inicio.proveedorId ?? ''))
  const [lineas, setLineas] = useState<LineaEditor[]>(inicio.lineas ?? [])
  const [observaciones, setObservaciones] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false), [incierto, setIncierto] = useState(false)
  const lock = useRef(false)
  const productos = useApiResource(fetchProducts)
  const relaciones = useApiResource(() => proveedorId ? fetchProductosProveedor(Number(proveedorId)) : Promise.resolve([]), proveedorId)
  const disponibles = (productos.data ?? []).filter(p => p.active && (relaciones.data ?? []).some(r => r.activo && r.productoId === Number(p.id)))
  const calculadas = lineas.map(l => {
    const p = productos.data?.find(p => p.id === l.productoId)
    return { ...l, factorConversion: undefined, costo: (Number(p?.costoActual ?? 0) * (l.unidad === 'COMPRA' ? p?.factorConversion ?? 1 : 1)).toFixed(2) }
  })
  const estimado = (l: LineaEditor) => { const d = datosLinea(l, productos.data ?? []); return Math.round(d.cantidadBase * Math.round(Number(d.producto?.costoActual ?? 0) * 100)) / 100 }
  const total = calculadas.reduce((s, l) => s + estimado(l), 0)
  const patch = (i: number, cambios: Partial<LineaEditor>) => setLineas(actual => actual.map((l, j) => j === i ? { ...l, ...cambios } : l))
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (lock.current || incierto) return
    setError('')
    try {
      if (!proveedores.some(p => p.id === Number(proveedorId) && p.activo)) throw new Error('Seleccioná un proveedor activo.')
      if (relaciones.loading || relaciones.error) throw new Error('Esperá a que carguen los productos del proveedor.')
      const detalles = validarLineas(calculadas, productos.data ?? [])
      if (detalles.some(d => !disponibles.some(p => Number(p.id) === d.productoId))) throw new Error('El pedido solo admite productos asociados al proveedor.')
      if (!Number.isFinite(total) || total > 99999999.99) throw new Error('El total supera el máximo permitido.')
      lock.current = true; setSaving(true)
      const resultado = await guardarPedido({ proveedorId: Number(proveedorId), observaciones: observaciones.trim(), detalles })
      onGuardado(resultado.pedido.id)
    } catch (fallo) {
      setError(errorMensaje(fallo)); if (lock.current && (!(fallo instanceof ApiError) || fallo.status >= 500)) setIncierto(true)
    } finally { lock.current = false; setSaving(false) }
  }
  return <Modal title="Nuevo pedido al proveedor" onClose={onClose} busy={saving}><form onSubmit={enviar}>
    <ErrorCarga error={error}/><ErrorCarga error={productos.error} retry={productos.refetch}/><ErrorCarga error={relaciones.error} retry={relaciones.refetch}/>
    {incierto && <p role="alert">No se pudo confirmar el resultado. Revisá el historial antes de volver a registrar el pedido.</p>}
    <p>La fecha y hora se asignan automáticamente al registrar el pedido.</p>
    <fieldset className="operation-fieldset" disabled={saving || incierto}>
      <label>Proveedor<select aria-label="Proveedor" required value={proveedorId} onChange={e => { setProveedorId(e.target.value); setLineas([]) }}><option value="">Seleccionar proveedor</option>{proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <div className="supply-lines">{calculadas.map((l, i) => {
        const d = datosLinea(l, productos.data ?? [])
        return <div className="supply-line" key={i}><div className="form-grid">
          <label>Producto {i + 1}<select aria-label={`Producto ${i + 1}`} required value={l.productoId} onChange={e => patch(i, { productoId: e.target.value, cantidad: '1', unidad: 'VENTA' })}><option value="">Seleccionar producto</option>{disponibles.filter(p => p.id === l.productoId || !lineas.some(otra => otra.productoId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Medir en<select aria-label={`Medir producto ${i + 1} en`} value={l.unidad} onChange={e => patch(i, { unidad: e.target.value as LineaEditor['unidad'] })}><option value="VENTA">Venta · {d.producto?.unit ?? 'kg/un.'}</option><option value="COMPRA">Compra · {d.producto?.unidadCompra ?? 'presentación'}</option></select></label>
          <label>Cantidad<input aria-label={`Cantidad producto ${i + 1}`} required inputMode="decimal" value={l.cantidad} onChange={e => patch(i, { cantidad: e.target.value })}/></label>
          <div><small>Costo actual por {d.producto?.unit ?? 'unidad de venta'}</small><strong>{formatearMonto(d.producto?.costoActual ?? 0)}</strong></div>
          <div><small>Costo estimado</small><strong className="supply-amount">{formatearMonto(Number.isFinite(estimado(l)) ? estimado(l) : 0)}</strong><small>{cantidadFormato(d.cantidadBase || 0)} {d.producto?.unit}</small></div>
        </div><button className="button" type="button" onClick={() => setLineas(actual => actual.filter((_, j) => i !== j))}>Quitar producto {i + 1}</button></div>
      })}</div>
      <button className="button" type="button" disabled={!proveedorId || productos.loading || relaciones.loading || lineas.length >= 100} onClick={() => setLineas(actual => [...actual, { productoId: '', cantidad: '1', costo: '0', unidad: 'VENTA' }])}>Agregar producto</button>
      <label className="supply-observations">Observaciones<textarea maxLength={300} value={observaciones} onChange={e => setObservaciones(e.target.value)}/></label>
      <div className="receipt-total"><span>Total estimado</span><strong>{formatearMonto(total)}</strong></div>
    </fieldset><div className="modal-footer"><button className="button" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || incierto || productos.loading || !!productos.error || !lineas.length}>{saving ? 'Guardando...' : 'Registrar pedido'}</button></div>
  </form></Modal>
}
