import { useState, useMemo, type FormEvent } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearMonto } from '../../shared/lib/money'
import { createProduct, deactivateProduct, fetchProducts, updateProduct } from '../../shared/services/api'
import { fetchPreciosVigentes } from '../../shared/services/precios'
import { PreciosProductoModal } from '../precios/PreciosProductoModal'
import { categories, units, emptyDraft, validateProduct, normalize, type Product, type ProductDraft } from './products'

type Editor = { mode: 'create' } | { mode: 'edit' | 'detail' | 'deactivate'; product: Product }
const categorySymbols: Record<Product['category'], string> = { Fresco: 'F', Congelado: 'C', 'Seco Almacen': 'S' }

export function ProductsPage() {
  const {
    data: productos,
    setData: setProductos,
    loading,
    error: errorCarga,
  } = useApiResource(fetchProducts)

  // Los precios de todos los productos llegan en una sola llamada, así
  // que la columna no hace un request por fila.
  const { data: precios, refetch: recargarPrecios } = useApiResource(fetchPreciosVigentes)

  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [status, setStatus] = useState('todos')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [preciosDe, setPreciosDe] = useState<Product | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductDraft, string>>>({})
  const [notice, setNotice] = useState('')

  const products = productos ?? []

  // El precio llega con productoId numérico y el producto del catálogo
  // con id de texto, por eso la búsqueda convierte antes de comparar.
  const precioPorProducto = useMemo(
    () => new Map((precios ?? []).map(precio => [precio.productoId, precio])),
    [precios]
  )

  const filtered = products.filter(p => (category === 'Todas' || p.category === category) &&
    (status === 'todos' || p.active === (status === 'activos')) &&
    normalize(p.name + ' ' + p.code).includes(normalize(search)))
  const activeCount = products.filter(p => p.active).length

  function open(next: Editor) {
    setDraft(next.mode === 'create' ? { ...emptyDraft } : { ...next.product })
    setErrors({})
    setNotice('')
    setEditor(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const editing = editor?.mode === 'edit' ? editor.product : undefined
    const nextErrors = validateProduct(draft, products, editing?.id)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const payload = { ...draft, code: draft.code.trim().toUpperCase(), name: draft.name.trim(), description: draft.description.trim() }
    setSaving(true)
    setApiError('')
    try {
      const product = editing ? await updateProduct(editing.id, payload) : await createProduct(payload)
      setProductos(current => {
        const lista = current ?? []
        return editing ? lista.map(item => item.id === editing.id ? product : item) : [...lista, product]
      })
      setNotice(editing ? 'Producto actualizado correctamente.' : 'Producto registrado correctamente.')
      setEditor(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(product: Product) {
    setSaving(true)
    setApiError('')
    try {
      const updated = await deactivateProduct(product.id)
      setProductos(current => (current ?? []).map(item => item.id === product.id ? updated : item))
      setNotice('Producto dado de baja correctamente.')
      setEditor(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'No se pudo dar de baja el producto.')
    } finally {
      setSaving(false)
    }
  }

  function field<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
  }

  // Pantalla de carga mientras espera la respuesta del backend
  if (loading) {
    return (
      <section className="products-page">
        <div className="breadcrumb">Gestión <Icon name="arrow" size={14} /> <span>Productos</span></div>
        <div className="cargando">
          <Icon name="box" size={32} />
          <p>Cargando catálogo desde el servidor...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="products-page">
      <div className="breadcrumb">Gestión <Icon name="arrow" size={14} /> <span>Productos</span></div>
      <div className="page-heading"><div><h1>Catálogo de productos</h1><p>Administrá los productos de tu pollería en un solo lugar.</p></div><button className="button primary" disabled={!!apiError} onClick={() => open({ mode: 'create' })}><Icon name="plus" /> Nuevo producto</button></div>
      <div className="stats-grid">
        <div className="stat"><span className="stat-icon yellow"><Icon name="box" size={24} /></span><div><span>Total de productos</span><strong>{products.length}</strong></div><small>En tu catálogo</small></div>
        <div className="stat"><span className="stat-icon green"><Icon name="check" size={24} /></span><div><span>Productos activos</span><strong>{activeCount}</strong></div><small>Disponibles</small></div>
        <div className="stat"><span className="stat-icon gray"><Icon name="archive" size={24} /></span><div><span>Productos inactivos</span><strong>{products.length - activeCount}</strong></div><small>Dados de baja</small></div>
      </div>
      {notice && <div className="notice success" role="status"><Icon name="check" />{notice}</div>}
      {(apiError || errorCarga) && !editor && <div className="notice error" role="alert">{apiError || errorCarga}</div>}
      <div className="catalog-panel">
        <div className="catalog-title"><div><h2>Todos los productos <span className="count">{products.length}</span></h2><p>Consultá y mantené actualizado tu catálogo.</p></div><span className="subtle">Catálogo general</span></div>
        <div className="filters">
          <label className="search-field"><Icon name="search" /><input aria-label="Buscar por nombre o código" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><Icon name="close" size={16} /></button>}</label>
          <label className="status-filter">Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="todos">Todos los estados</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></label>
        </div>
        <div className="category-tabs" role="group" aria-label="Filtrar por categoría">{['Todas', ...categories].map(c => <button key={c} className={category === c ? 'selected' : ''} aria-pressed={category === c} onClick={() => setCategory(c)}>{c === 'Todas' ? 'Todos' : c}</button>)}</div>
        <div className="table-scroll"><table><thead><tr><th scope="col">Producto</th><th scope="col">Código</th><th scope="col">Categoría</th><th scope="col">Unidad de venta</th><th scope="col">Precio</th><th scope="col">Estado</th><th scope="col" className="actions-heading">Acciones</th></tr></thead><tbody>
          {filtered.map(p => { const precio = precioPorProducto.get(Number(p.id)); return <tr key={p.id}><td><div className="product-cell"><span className={'product-symbol symbol-' + p.category.toLowerCase()}>{categorySymbols[p.category]}</span><div><button className="product-link" onClick={() => open({ mode: 'detail', product: p })}>{p.name}</button><span className="product-description">{p.description || 'Sin descripción'}</span></div></div></td><td><code>{p.code}</code></td><td><span className="category-label">{p.category}</span></td><td>{p.unit === 'kg' ? 'Kilogramo (kg)' : p.unit[0].toUpperCase() + p.unit.slice(1)}</td><td>{precio ? <div className="precio-cell"><strong>{formatearMonto(precio.precioMinorista)}</strong>{precio.precioMayorista !== null && <small>Mayor. {formatearMonto(precio.precioMayorista)}</small>}</div> : <button className="precio-vacio" onClick={() => setPreciosDe(p)}>Sin precio &middot; agregar</button>}</td><td><span className={'badge ' + (p.active ? 'active' : 'inactive')}><span />{p.active ? 'Activo' : 'Inactivo'}</span></td><td><div className="row-actions"><button className="icon-button" title="Ver detalle" aria-label={'Ver ' + p.name} onClick={() => open({ mode: 'detail', product: p })}><Icon name="eye" size={18} /></button><button className="icon-button" title="Precios e historial" aria-label={'Precios de ' + p.name} onClick={() => setPreciosDe(p)}><Icon name="percent" size={18} /></button><button className="icon-button" title="Editar producto" aria-label={'Editar ' + p.name} onClick={() => open({ mode: 'edit', product: p })}><Icon name="edit" size={18} /></button><button className="icon-button danger-text" disabled={!p.active} title={p.active ? 'Dar de baja' : 'Producto inactivo'} aria-label={'Dar de baja ' + p.name} onClick={() => open({ mode: 'deactivate', product: p })}><Icon name="archive" size={18} /></button></div></td></tr> })}
        </tbody></table></div>
        {filtered.length === 0 && <div className="empty-state"><Icon name="search" size={32} /><h3>{products.length ? 'No encontramos productos' : 'Tu catálogo está vacío'}</h3><p>{products.length ? 'Probá con otro nombre, código o categoría.' : 'Registrá tu primer producto para comenzar.'}</p>{products.length > 0 && <button className="button" onClick={() => { setSearch(''); setCategory('Todas'); setStatus('todos') }}>Limpiar filtros</button>}</div>}
        <div className="table-footer">Mostrando {filtered.length} de {products.length} productos<span>Las bajas conservan el historial del catálogo.</span></div>
      </div>
      <div className="local-note"><Icon name="box" size={18} /><span><strong>Conexión exitosa.</strong> Los cambios del catálogo se guardan en la base de datos.</span></div>
      
      {preciosDe && <PreciosProductoModal producto={preciosDe} onClose={() => setPreciosDe(null)} onGuardado={recargarPrecios} />}

      {/* Acá sigue el Modal tal cual lo tenías, sin modificaciones porque maneja puro estado de React */}
      {editor && <Modal eyebrow="CATÁLOGO DE PRODUCTOS" title={editor.mode === 'create' ? 'Nuevo producto' : editor.mode === 'edit' ? 'Editar producto' : editor.mode === 'detail' ? 'Detalle del producto' : 'Dar de baja producto'} onClose={() => setEditor(null)}>
        {apiError && <div className="notice error" role="alert">{apiError}</div>}
        {(editor.mode === 'create' || editor.mode === 'edit') && <form onSubmit={submit} noValidate>
          <p className="form-intro">Completá los datos del producto. Los campos con * son obligatorios.</p>
          <div className="form-grid">
            <label>Nombre del producto *<input autoFocus value={draft.name} maxLength={50} onChange={e => field('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'error-name' : undefined} placeholder="Ej. Suprema de pollo" />{errors.name && <small id="error-name" className="field-error">{errors.name}</small>}</label>
            <label>Código *<input value={draft.code} maxLength={20} onChange={e => field('code', e.target.value)} aria-invalid={!!errors.code} aria-describedby={errors.code ? 'error-code' : undefined} placeholder="Ej. COR-005" />{errors.code && <small id="error-code" className="field-error">{errors.code}</small>}</label>
            <label>Categoría *<select value={draft.category} onChange={e => field('category', e.target.value as Product['category'])}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Unidad de venta *<select value={draft.unit} onChange={e => field('unit', e.target.value as Product['unit'])}>{units.map(u => <option key={u} value={u}>{u === 'kg' ? 'Kilogramo (kg)' : u}</option>)}</select></label>
            <label className="full-width">Descripción<textarea value={draft.description} maxLength={300} rows={3} onChange={e => field('description', e.target.value)} placeholder="Agregá detalles para identificar el producto" /><small>{draft.description.length}/300 caracteres</small></label>
          </div>
          <div className="form-note">Los precios y las ofertas se gestionan desde el botón de precios de cada producto.</div>
          <div className="modal-footer"><button type="button" className="button" disabled={saving} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="button primary" disabled={saving}><Icon name="check" size={18} />{saving ? 'Guardando...' : editor.mode === 'create' ? 'Registrar producto' : 'Guardar cambios'}</button></div>
        </form>}
        {editor.mode === 'detail' && <><div className="detail-product"><span className={'product-symbol symbol-' + editor.product.category.toLowerCase()}>{categorySymbols[editor.product.category]}</span><div><h3>{editor.product.name}</h3><span className={'badge ' + (editor.product.active ? 'active' : 'inactive')}>{editor.product.active ? 'Activo' : 'Inactivo'}</span></div></div><dl className="detail-grid"><div><dt>Código</dt><dd>{editor.product.code}</dd></div><div><dt>Categoría</dt><dd>{editor.product.category}</dd></div><div><dt>Unidad de venta</dt><dd>{editor.product.unit}</dd></div><div className="full-width"><dt>Descripción</dt><dd>{editor.product.description || 'Sin descripción'}</dd></div></dl><div className="modal-footer"><button className="button" onClick={() => setEditor(null)}>Cerrar</button><button className="button primary" onClick={() => open({ mode: 'edit', product: editor.product })}><Icon name="edit" size={18} />Editar producto</button></div></>}
        {editor.mode === 'deactivate' && <><div className="confirmation-icon"><Icon name="archive" size={28} /></div><p>¿Querés dar de baja <strong>{editor.product.name}</strong>?</p><p>El producto quedará inactivo. Sus datos se conservarán y podrás consultarlo usando el filtro de estado.</p><div className="modal-footer"><button autoFocus className="button" disabled={saving} onClick={() => setEditor(null)}>Cancelar</button><button className="button danger" disabled={saving} onClick={() => deactivate(editor.product)}>{saving ? 'Procesando...' : 'Confirmar baja'}</button></div></>}
      </Modal>}
    </section>
  )
}
