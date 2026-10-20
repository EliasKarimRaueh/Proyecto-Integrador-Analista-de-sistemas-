import { useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { cambiarEstadoProveedor, fetchProveedores, guardarProveedor } from '../../shared/services/proveedores'
import { normalize } from '../products/products'
import { diasEntrega, editarProveedor, nuevoProveedor, validarProveedor, type Proveedor, type ProveedorDraft } from './proveedores'
import '../../shared/styles/proveedores.css'

type Editor = { modo: 'alta' } | { modo: 'editar' | 'detalle' | 'estado'; proveedor: Proveedor }

export function ProveedoresPage() {
  const recurso = useApiResource(fetchProveedores)
  const proveedores = recurso.data ?? []
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('todos')
  const [cuenta, setCuenta] = useState('todas')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [draft, setDraft] = useState<ProveedorDraft>(nuevoProveedor)
  const [errores, setErrores] = useState<Partial<Record<keyof ProveedorDraft, string>>>({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const ocupado = useRef(false)
  const filtrados = proveedores.filter(p =>
    (estado === 'todos' || p.activo === (estado === 'activos')) &&
    (cuenta === 'todas' || p.ctaCte === (cuenta === 'si')) &&
    normalize([p.nombre, p.cuil, p.telefono, p.email, p.direccion].join(' ')).includes(normalize(buscar)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  function abrir(proximo: Editor) {
    setEditor(proximo)
    setDraft(proximo.modo === 'alta' ? nuevoProveedor() : editarProveedor(proximo.proveedor))
    setErrores({}); setError(''); setAviso('')
  }
  function campo<K extends keyof ProveedorDraft>(key: K, value: ProveedorDraft[K]) {
    setDraft(actual => ({ ...actual, [key]: value }))
    setErrores(actual => ({ ...actual, [key]: undefined }))
  }
  async function ejecutar(accion: () => Promise<Proveedor>, mensaje: string) {
    if (ocupado.current) return
    ocupado.current = true; setGuardando(true); setError('')
    try {
      const actualizado = await accion()
      recurso.setData(actual => [...(actual ?? []).filter(p => p.id !== actualizado.id), actualizado])
      setAviso(mensaje); setEditor(null)
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el proveedor.')
    } finally { ocupado.current = false; setGuardando(false) }
  }
  function guardar(evento: FormEvent) {
    evento.preventDefault()
    const id = editor?.modo === 'editar' ? editor.proveedor.id : undefined
    const validacion = validarProveedor(draft, proveedores, id)
    setErrores(validacion)
    if (Object.keys(validacion).length) return
    void ejecutar(() => guardarProveedor(draft, id), id === undefined ? 'Proveedor registrado correctamente.' : 'Proveedor actualizado correctamente.')
  }
  const titulos = { alta: 'Nuevo proveedor', editar: 'Editar proveedor', detalle: 'Detalle del proveedor', estado: editor && 'proveedor' in editor && editor.proveedor.activo ? 'Dar de baja proveedor' : 'Reactivar proveedor' }

  return <section className="products-page proveedores-page">
    <div className="breadcrumb">Gestión <Icon name="arrow" size={14} /> <span>Proveedores</span></div>
    <div className="page-heading"><div><h1>Directorio de proveedores</h1><p>Administrá los distribuidores y sus datos de contacto.</p></div><button className="button primary" disabled={recurso.loading || !!recurso.error} onClick={() => abrir({ modo: 'alta' })}><Icon name="plus" />Nuevo proveedor</button></div>
    <div className="stats-grid">
      <div className="stat"><span className="stat-icon yellow"><Icon name="users" /></span><div><span>Total de proveedores</span><strong>{proveedores.length}</strong></div></div>
      <div className="stat"><span className="stat-icon status-green"><Icon name="check" /></span><div><span>Proveedores activos</span><strong>{proveedores.filter(p => p.activo).length}</strong></div></div>
      <div className="stat"><span className="stat-icon status-red"><Icon name="archive" /></span><div><span>Proveedores inactivos</span><strong>{proveedores.filter(p => !p.activo).length}</strong></div></div>
    </div>
    {aviso && <div className="notice success" role="status">{aviso}</div>}
    {recurso.error && <div className="notice error" role="alert">{recurso.error}<button className="button" onClick={recurso.refetch}>Reintentar</button></div>}
    {recurso.loading ? <p role="status">Cargando proveedores...</p> : !recurso.error && <div className="catalog-panel">
      <div className="catalog-title"><div><h2>Proveedores <span className="count">{proveedores.length}</span></h2><p>Los filtros se actualizan mientras escribís.</p></div></div>
      <div className="filters">
        <label className="search-field"><Icon name="search" /><input aria-label="Buscar proveedores" placeholder="Razón social, CUIT, teléfono o dirección..." value={buscar} onChange={e => setBuscar(e.target.value)} />{buscar && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => setBuscar('')}><Icon name="close" /></button>}</label>
        <label className="status-filter">Estado<select value={estado} onChange={e => setEstado(e.target.value)}><option value="todos">Todos los estados</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></label>
        <label className="status-filter">Cuenta corriente<select value={cuenta} onChange={e => setCuenta(e.target.value)}><option value="todas">Todas</option><option value="si">Habilitada</option><option value="no">No habilitada</option></select></label>
      </div>
      <div className="table-scroll"><table><thead><tr><th scope="col">Razón social / CUIT</th><th scope="col">Contacto</th><th scope="col">Entregas</th><th scope="col">Cuenta corriente</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>
        {filtrados.map(p => <tr key={p.id}>
          <td><button className="product-link" onClick={() => abrir({ modo: 'detalle', proveedor: p })}>{p.nombre}</button><small className="product-description">{p.cuil || 'Sin CUIT'}</small></td>
          <td>{p.telefono || 'Sin teléfono'}<small className="product-description">{p.email || 'Sin email'}</small></td>
          <td>{p.direccion || 'Sin dirección'}<small className="product-description">{p.diasEntrega?.join(', ') || 'Días sin definir'}</small></td>
          <td>{p.ctaCte ? 'Habilitada' : 'No habilitada'}</td>
          <td><span className={'badge ' + (p.activo ? 'product-active' : 'product-inactive')}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
          <td><div className="row-actions"><button className="icon-button" aria-label={`Ver ${p.nombre}`} onClick={() => abrir({ modo: 'detalle', proveedor: p })}><Icon name="eye" /></button><button className="icon-button" aria-label={`Editar ${p.nombre}`} onClick={() => abrir({ modo: 'editar', proveedor: p })}><Icon name="edit" /></button><button className={'icon-button ' + (p.activo ? 'danger-text' : '')} aria-label={`${p.activo ? 'Dar de baja' : 'Reactivar'} ${p.nombre}`} onClick={() => abrir({ modo: 'estado', proveedor: p })}><Icon name={p.activo ? 'archive' : 'check'} /></button></div></td>
        </tr>)}
      </tbody></table></div>
      {!filtrados.length && <div className="empty-state"><Icon name="users" size={32} /><h3>{proveedores.length ? 'No encontramos proveedores' : 'Todavía no hay proveedores'}</h3><p>{proveedores.length ? 'Probá con otros datos o limpiá los filtros.' : 'Registrá tu primer distribuidor para comenzar.'}</p>{proveedores.length > 0 && <button className="button" onClick={() => { setBuscar(''); setEstado('todos'); setCuenta('todas') }}>Limpiar filtros</button>}</div>}
      <div className="table-footer" role="status">Mostrando {filtrados.length} de {proveedores.length} proveedores<span>Las bajas conservan el historial.</span></div>
    </div>}
    {editor && <Modal eyebrow="GESTIÓN DE PROVEEDORES" title={titulos[editor.modo]} busy={guardando} onClose={() => setEditor(null)}>
      {error && <div className="notice error" role="alert">{error}</div>}
      {(editor.modo === 'alta' || editor.modo === 'editar') && <form onSubmit={guardar} noValidate>
        <p className="form-intro">La razón social es obligatoria. Completá los datos disponibles del distribuidor.</p>
        <fieldset className="proveedor-fields" disabled={guardando}><div className="form-grid">
          {([['nombre', 'Razón social *', 50], ['cuil', 'CUIT', 13], ['telefono', 'Teléfono', 25], ['email', 'Email', 254], ['direccion', 'Dirección', 200]] as const).map(([key, label, max]) => <label key={key} className={key === 'direccion' ? 'full-width' : undefined}>{label}<input aria-label={label} autoFocus={key === 'nombre'} value={draft[key]} maxLength={max} type={key === 'email' ? 'email' : key === 'telefono' ? 'tel' : 'text'} inputMode={key === 'cuil' ? 'numeric' : undefined} aria-invalid={!!errores[key]} aria-describedby={errores[key] ? `proveedor-${key}` : undefined} onChange={e => campo(key, e.target.value)} />{errores[key] && <small className="field-error" id={`proveedor-${key}`}>{errores[key]}</small>}</label>)}
          <fieldset className="full-width entrega-fields"><legend>Días habituales de entrega</legend><div className="entrega-dias">{diasEntrega.map(dia => <label key={dia}><input type="checkbox" checked={draft.diasEntrega.includes(dia)} onChange={e => campo('diasEntrega', e.target.checked ? [...draft.diasEntrega, dia] : draft.diasEntrega.filter(d => d !== dia))} />{dia}</label>)}</div></fieldset>
          <label className="full-width">Descripción<textarea value={draft.descripcion} maxLength={300} rows={3} onChange={e => campo('descripcion', e.target.value)} />{errores.descripcion && <small className="field-error">{errores.descripcion}</small>}</label>
          <label className="full-width proveedor-check"><input type="checkbox" checked={draft.ctaCte} onChange={e => campo('ctaCte', e.target.checked)} />Habilitar cuenta corriente</label>
        </div></fieldset>
        <div className="modal-footer"><button className="button" type="button" disabled={guardando} onClick={() => setEditor(null)}>Cancelar</button><button className="button primary" disabled={guardando}>{guardando ? 'Guardando...' : editor.modo === 'alta' ? 'Registrar proveedor' : 'Guardar cambios'}</button></div>
      </form>}
      {editor.modo === 'detalle' && <><dl className="detail-grid">{[
        ['Razón social', editor.proveedor.nombre], ['CUIT', editor.proveedor.cuil], ['Teléfono', editor.proveedor.telefono], ['Email', editor.proveedor.email], ['Dirección', editor.proveedor.direccion], ['Días de entrega', editor.proveedor.diasEntrega?.join(', ')], ['Cuenta corriente', editor.proveedor.ctaCte ? 'Habilitada' : 'No habilitada'], ['Estado', editor.proveedor.activo ? 'Activo' : 'Inactivo'], ['Descripción', editor.proveedor.descripcion],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Sin especificar'}</dd></div>)}</dl><div className="modal-footer"><button className="button" onClick={() => setEditor(null)}>Cerrar detalle</button><button className="button primary" onClick={() => abrir({ modo: 'editar', proveedor: editor.proveedor })}>Editar proveedor</button></div></>}
      {editor.modo === 'estado' && <><p>¿Querés {editor.proveedor.activo ? 'dar de baja' : 'reactivar'} a <strong>{editor.proveedor.nombre}</strong>?</p><p>{editor.proveedor.activo ? 'El proveedor quedará inactivo y conservará sus datos y su historial transaccional.' : 'El proveedor volverá a estar activo con sus datos e historial conservados.'}</p><div className="modal-footer"><button autoFocus className="button" disabled={guardando} onClick={() => setEditor(null)}>Cancelar</button><button className={'button ' + (editor.proveedor.activo ? 'danger' : 'primary')} disabled={guardando} onClick={() => ejecutar(() => cambiarEstadoProveedor(editor.proveedor.id, !editor.proveedor.activo), editor.proveedor.activo ? 'Proveedor dado de baja correctamente.' : 'Proveedor reactivado correctamente.')}>{guardando ? 'Procesando...' : editor.proveedor.activo ? 'Confirmar baja' : 'Confirmar reactivación'}</button></div></>}
    </Modal>}
  </section>
}
