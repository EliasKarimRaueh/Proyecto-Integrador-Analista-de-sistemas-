import { useRef, useState } from 'react'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { ErrorCarga } from '../../shared/components/OperacionesUI'
import { fetchProducts } from '../../shared/services/api'
import { fetchProductosProveedor, guardarProductosProveedor } from '../../shared/services/proveedores'
import { normalize } from '../products/products'
import type { Proveedor } from './proveedores'

export function ProductosProveedorModal({ proveedor, onClose }: { proveedor: Proveedor; onClose: () => void }) {
  const carga = useApiResource(async () => {
    const [productos, relaciones] = await Promise.all([fetchProducts(), fetchProductosProveedor(proveedor.id)])
    return { productos, relaciones }
  }, proveedor.id)
  const [editados, setSeleccion] = useState<number[] | null>(null)
  const seleccion = editados ?? carga.data?.relaciones.filter(r => r.activo).map(r => r.productoId) ?? []
  const [buscar, setBuscar] = useState(''), [error, setError] = useState(''), [aviso, setAviso] = useState('')
  const [saving, setSaving] = useState(false), lock = useRef(false)
  async function guardar() {
    if (lock.current) return
    lock.current = true; setSaving(true); setError(''); setAviso('')
    try { await guardarProductosProveedor(proveedor.id, seleccion); setAviso('Productos asociados correctamente.') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron asociar los productos.') }
    finally { lock.current = false; setSaving(false) }
  }
  const visibles = (carga.data?.productos ?? []).filter(p => (p.active || seleccion.includes(Number(p.id))) && normalize(p.name).includes(normalize(buscar)))
  return <Modal title={`Productos de ${proveedor.nombre}`} onClose={onClose} busy={saving}>
    <ErrorCarga error={carga.error} retry={carga.refetch} /><ErrorCarga error={error} />
    {aviso && <div className="notice success" role="status">{aviso}</div>}
    {carga.loading ? <p role="status">Cargando productos...</p> : carga.data && <>
      <p>Seleccioná los productos que abastece este proveedor. Quitar una asociación conserva su historial.</p>
      {!proveedor.activo && <p className="form-note">Reactivá el proveedor para modificar sus productos.</p>}
      <label className="search-field"><input aria-label="Buscar productos del proveedor" placeholder="Buscar por nombre..." value={buscar} onChange={e => setBuscar(e.target.value)} /></label>
      <div className="proveedor-productos">{visibles.map(p => <label key={p.id}><input type="checkbox" disabled={saving || !proveedor.activo || (!p.active && !seleccion.includes(Number(p.id)))} checked={seleccion.includes(Number(p.id))} onChange={e => { setAviso(''); setSeleccion(e.target.checked ? [...seleccion, Number(p.id)] : seleccion.filter(id => id !== Number(p.id))) }} /><span>{p.name}<small>{p.unit}{!p.active && ' · Producto inactivo'}</small></span></label>)}</div>
      {!visibles.length && <p>No hay productos para esta búsqueda.</p>}
      <p role="status">{seleccion.length} productos seleccionados</p>
    </>}
    <div className="modal-footer"><button className="button" disabled={saving} onClick={onClose}>Cerrar productos</button><button className="button primary" disabled={saving || carga.loading || !!carga.error || !proveedor.activo} onClick={guardar}>{saving ? 'Guardando...' : 'Guardar asociaciones'}</button></div>
  </Modal>
}
