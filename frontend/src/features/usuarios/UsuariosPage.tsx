import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import {
  actualizarUsuario,
  crearUsuario,
  darDeBajaUsuario,
  fetchUsuarios,
  reactivarUsuario,
  type UsuarioDraft,
} from '../../shared/services/usuarios'
import type { Rol, Usuario } from '../auth/types'
import {
  filtrarUsuarios,
  nombreCompleto,
  validarUsuario,
  type ErroresUsuario,
} from './usuarios'

type Editor =
  | { modo: 'crear' }
  | { modo: 'editar' | 'detalle' | 'baja' | 'reactivar'; usuario: Usuario }

type FiltroRol = Rol | ''
type FiltroActivo = boolean | ''

const etiquetaRol = (rol: Rol) => rol === 'PROPIETARIO' ? 'Propietario' : 'Empleado'

function DraftInicial(usuario?: Usuario): UsuarioDraft {
  return {
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    rol: usuario?.rol ?? 'EMPLEADO',
    password: '',
  }
}

function FormularioUsuarioModal({
  usuario,
  onClose,
  onGuardado,
}: {
  usuario?: Usuario
  onClose: () => void
  onGuardado: (mensaje: string) => void
}) {
  const editando = !!usuario
  const [draft, setDraft] = useState<UsuarioDraft>(() => DraftInicial(usuario))
  const [errores, setErrores] = useState<ErroresUsuario>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function campo<K extends keyof UsuarioDraft>(clave: K, valor: UsuarioDraft[K]) {
    setDraft(actual => ({ ...actual, [clave]: valor }))
    setErrores(actual => ({ ...actual, [clave]: undefined }))
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (saving) return
    const fallos = validarUsuario(draft, editando)
    if (Object.keys(fallos).length) {
      setErrores(fallos)
      return
    }
    const payload: UsuarioDraft = {
      nombre: draft.nombre.trim(),
      apellido: draft.apellido.trim(),
      email: draft.email.trim().toLowerCase(),
      rol: draft.rol,
      ...(draft.password?.trim() ? { password: draft.password.trim() } : {}),
    }
    setSaving(true)
    setError('')
    try {
      if (usuario) await actualizarUsuario(usuario.id, payload)
      else await crearUsuario(payload)
      onGuardado(usuario ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.')
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  const titulo = editando ? `Editar ${nombreCompleto(usuario!)}` : 'Nuevo usuario'

  return (
    <Modal title={titulo} eyebrow="ADMINISTRACIÓN" busy={saving} onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        <p>Los usuarios acceden con su email o nombre de usuario. Nunca se muestra ni se pide el hash de la contraseña.</p>
        {error !== '' && <div className="notice error" role="alert">{error}</div>}
        <fieldset className="proveedor-fields" disabled={saving}>
          <div className="form-grid">
            <label>Nombre *<input aria-label="Nombre *" autoFocus value={draft.nombre} maxLength={50} onChange={evento => campo('nombre', evento.target.value)} />{errores.nombre && <small className="field-error">{errores.nombre}</small>}</label>
            <label>Apellido *<input aria-label="Apellido *" value={draft.apellido} maxLength={50} onChange={evento => campo('apellido', evento.target.value)} />{errores.apellido && <small className="field-error">{errores.apellido}</small>}</label>
            <label className="full-width">Email *<input aria-label="Email *" type="email" autoComplete="off" value={draft.email} onChange={evento => campo('email', evento.target.value)} />{errores.email && <small className="field-error">{errores.email}</small>}</label>
            <label>Rol *<select aria-label="Rol *" value={draft.rol} onChange={evento => campo('rol', evento.target.value as Rol)}>
              <option value="EMPLEADO">Empleado</option>
              <option value="PROPIETARIO">Propietario</option>
            </select>{errores.rol && <small className="field-error">{errores.rol}</small>}</label>
            <label>
              {editando ? 'Nueva contraseña (dejar vacío para conservar)' : 'Contraseña *'}
              <input
                aria-label={editando ? 'Nueva contraseña (dejar vacío para conservar)' : 'Contraseña *'}
                type="password"
                autoComplete="new-password"
                value={draft.password ?? ''}
                onChange={evento => campo('password', evento.target.value)}
              />
              {errores.password && <small className="field-error">{errores.password}</small>}
              {editando && !errores.password && <small>Dejala vacía para mantener la contraseña actual.</small>}
            </label>
          </div>
        </fieldset>
        <div className="modal-footer">
          <button type="button" className="button" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar usuario'}</button>
        </div>
      </form>
    </Modal>
  )
}

function DetalleUsuarioModal({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  return (
    <Modal title={nombreCompleto(usuario)} eyebrow="ADMINISTRACIÓN" onClose={onClose}>
      <dl className="operation-details">
        <div><dt>ID</dt><dd>#{usuario.id}</dd></div>
        <div><dt>Nombre completo</dt><dd>{nombreCompleto(usuario)}</dd></div>
        <div><dt>Email</dt><dd>{usuario.email}</dd></div>
        <div><dt>Rol</dt><dd>{etiquetaRol(usuario.rol)}</dd></div>
        <div><dt>Estado</dt><dd>{usuario.activo ? 'Activo' : 'Inactivo'}</dd></div>
      </dl>
      <div className="modal-footer"><button className="button primary" onClick={onClose}>Cerrar detalle</button></div>
    </Modal>
  )
}

function ConfirmacionUsuarioModal({
  usuario,
  accion,
  saving,
  error,
  onCancelar,
  onConfirmar,
}: {
  usuario: Usuario
  accion: 'baja' | 'reactivar'
  saving: boolean
  error: string
  onCancelar: () => void
  onConfirmar: () => void
}) {
  const darDeBaja = accion === 'baja'
  return (
    <Modal title={darDeBaja ? 'Dar de baja usuario' : 'Reactivar usuario'} eyebrow="ADMINISTRACIÓN" onClose={onCancelar} busy={saving}>
      <div className="confirmation-icon"><Icon name={darDeBaja ? 'archive' : 'check'} size={28} /></div>
      <p>
        {darDeBaja
          ? <>¿Querés dar de baja a <strong>{nombreCompleto(usuario)}</strong>?</>
          : <>¿Querés reactivar a <strong>{nombreCompleto(usuario)}</strong>?</>}
      </p>
      <p>{darDeBaja ? 'El usuario no podrá iniciar sesión. Sus datos se conservan y podés reactivarlo cuando quieras.' : 'El usuario volverá a tener acceso con sus credenciales actuales.'}</p>
      {error !== '' && <div className="notice error" role="alert">{error}</div>}
      <div className="modal-footer">
        <button autoFocus className="button" disabled={saving} onClick={onCancelar}>Cancelar</button>
        <button className={`button ${darDeBaja ? 'danger' : 'primary'}`} disabled={saving} onClick={onConfirmar}>
          {saving ? 'Procesando…' : darDeBaja ? 'Confirmar baja' : 'Confirmar reactivación'}
        </button>
      </div>
    </Modal>
  )
}

export function UsuariosPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [rol, setRol] = useState<FiltroRol>('')
  const [estado, setEstado] = useState<FiltroActivo>('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState('')
  const [accionError, setAccionError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const temporizador = setTimeout(() => setQuery(search), 150)
    return () => clearTimeout(temporizador)
  }, [search])

  const recurso = useApiResource(
    () => fetchUsuarios({ q: query, rol, activo: estado }),
    `${query}:${rol}:${String(estado)}`,
  )

  const usuarios = useMemo(() => recurso.data ?? [], [recurso.data])
  const visibles = useMemo(
    () => filtrarUsuarios(usuarios, { q: query, rol, activo: estado }),
    [usuarios, query, rol, estado],
  )
  const activos = usuarios.filter(usuario => usuario.activo).length

  function abrir(siguiente: Editor) {
    setAccionError('')
    setNotice('')
    setEditor(siguiente)
  }

  function limpiarFiltros() {
    setSearch('')
    setQuery('')
    setRol('')
    setEstado('')
  }

  function guardado(mensaje: string) {
    setNotice(mensaje)
    setEditor(null)
    recurso.refetch()
  }

  async function cambiarEstado(usuario: Usuario, modo: Editor['modo']) {
    const accion = modo === 'baja' ? 'baja' : 'reactivar'
    setSaving(true)
    setAccionError('')
    try {
      const actualizado = accion === 'baja'
        ? await darDeBajaUsuario(usuario.id)
        : await reactivarUsuario(usuario.id)
      setNotice(`${nombreCompleto(actualizado)} ${accion === 'baja' ? 'dado de baja' : 'reactivado'} correctamente.`)
      setEditor(null)
      recurso.refetch()
    } catch (fallo) {
      setAccionError(fallo instanceof Error ? fallo.message : 'No se pudo completar la operación.')
    } finally {
      setSaving(false)
    }
  }

  if (recurso.loading) {
    return (
      <section className="usuarios-page">
        <div className="breadcrumb">Administración <span>/</span> <span>Usuarios</span></div>
        <p role="status" className="operation-loading">Cargando usuarios…</p>
      </section>
    )
  }

  return (
    <section className="usuarios-page">
      <div className="breadcrumb">Administración <Icon name="arrow" size={14} /> <span>Usuarios</span></div>
      <div className="page-heading">
        <div>
          <h1>Gestión de usuarios</h1>
          <p>Alta, edición y baja de operadores del sistema.</p>
        </div>
        <button className="button primary" onClick={() => abrir({ modo: 'crear' })}>
          <Icon name="plus" /> Nuevo usuario
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat"><div><span>Total de usuarios</span><strong>{usuarios.length}</strong></div></div>
        <div className="stat"><div><span>Usuarios activos</span><strong>{activos}</strong></div></div>
      </div>

      {notice !== '' && <div className="notice success" role="status"><Icon name="check" />{notice}</div>}
      {recurso.error !== '' && <div className="notice error" role="alert">{recurso.error}<button className="button" onClick={recurso.refetch}>Reintentar</button></div>}

      <div className="catalog-panel">
        <div className="catalog-title">
          <div>
            <h2>Usuarios <span className="count">{visibles.length}</span></h2>
            <p>Buscá por nombre o email y filtrá por rol y estado.</p>
          </div>
        </div>
        <div className="filters">
          <label className="search-field">
            <Icon name="search" />
            <input aria-label="Buscar por nombre o email" placeholder="Buscar por nombre o email..." value={search} onChange={evento => setSearch(evento.target.value)} />
            {search !== '' && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><Icon name="close" size={16} /></button>}
          </label>
          <label className="status-filter">Rol
            <select aria-label="Filtrar por rol" value={rol} onChange={evento => setRol(evento.target.value as FiltroRol)}>
              <option value="">Todos los roles</option>
              <option value="PROPIETARIO">Propietario</option>
              <option value="EMPLEADO">Empleado</option>
            </select>
          </label>
          <label className="status-filter">Estado
            <select aria-label="Filtrar por estado" value={String(estado)} onChange={evento => setEstado(evento.target.value === '' ? '' : evento.target.value === 'true')}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="offers-table">
            <thead>
              <tr>
                <th scope="col">Nombre completo</th>
                <th scope="col">Email</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col" className="actions-heading">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(usuario => (
                <tr key={usuario.id}>
                  <td><button className="product-link" onClick={() => abrir({ modo: 'detalle', usuario })}>{nombreCompleto(usuario)}</button></td>
                  <td>{usuario.email}</td>
                  <td>{etiquetaRol(usuario.rol)}</td>
                  <td><span className={`badge ${usuario.activo ? 'active' : 'inactive'}`}><span />{usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" aria-label={`Ver ${nombreCompleto(usuario)}`} title="Ver detalle" onClick={() => abrir({ modo: 'detalle', usuario })}><Icon name="eye" size={18} /></button>
                      <button className="button" aria-label={`Editar ${nombreCompleto(usuario)}`} onClick={() => abrir({ modo: 'editar', usuario })}><Icon name="edit" size={18} /> Editar</button>
                      {usuario.activo
                        ? <button className="icon-button danger-text" aria-label={`Dar de baja ${nombreCompleto(usuario)}`} title="Dar de baja" onClick={() => abrir({ modo: 'baja', usuario })}><Icon name="archive" size={18} /></button>
                        : <button className="button" aria-label={`Reactivar ${nombreCompleto(usuario)}`} onClick={() => abrir({ modo: 'reactivar', usuario })}><Icon name="check" size={18} /> Reactivar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibles.length === 0 && (
          <div className="empty-state">
            <Icon name="users" size={32} />
            <h3>No encontramos usuarios</h3>
            <p>{search || rol || estado !== '' ? 'Probá con otro nombre, email, rol o estado.' : 'Todavía no hay usuarios registrados.'}</p>
            <button className="button" onClick={limpiarFiltros}>Limpiar filtros</button>
          </div>
        )}
        <div className="table-footer">Mostrando {visibles.length} de {usuarios.length} usuarios</div>
      </div>

      {editor?.modo === 'crear' && <FormularioUsuarioModal onClose={() => setEditor(null)} onGuardado={guardado} />}
      {editor?.modo === 'editar' && <FormularioUsuarioModal usuario={editor.usuario} onClose={() => setEditor(null)} onGuardado={guardado} />}
      {editor?.modo === 'detalle' && <DetalleUsuarioModal usuario={editor.usuario} onClose={() => setEditor(null)} />}
      {(editor?.modo === 'baja' || editor?.modo === 'reactivar') && (
        <ConfirmacionUsuarioModal
          usuario={editor.usuario}
          accion={editor.modo}
          saving={saving}
          error={accionError}
          onCancelar={() => setEditor(null)}
          onConfirmar={() => cambiarEstado(editor.usuario, editor.modo)}
        />
      )}
    </section>
  )
}
