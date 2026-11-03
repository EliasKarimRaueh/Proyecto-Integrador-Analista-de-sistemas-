import { useMemo, useState } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fechaTextoOferta as formatearFecha } from './fechasOfertas'
import { cantidadFormato } from '../../shared/lib/operaciones'
import { ResumenOferta } from './ResumenOferta'
import { desactivarOferta, fetchOferta, fetchOfertas } from '../../shared/services/ofertas'
import { normalize } from '../products/products'
import { DetalleOfertaModal } from './DetalleOfertaModal'
import { FormularioOfertaModal } from './FormularioOfertaModal'
import { ReactivarOfertaModal } from './ReactivarOfertaModal'
import { fetchPreciosVigentes } from '../../shared/services/precios'
import type { Precio } from '../precios/precios'
import { ETIQUETA_ESTADO, estadoOferta, type Oferta } from './ofertas'

type Editor =
  | { modo: 'crear' }
  | { modo: 'editar' | 'detalle' | 'baja' | 'reactivar'; oferta: Oferta }

const FILTROS = [
  { valor: 'todas', etiqueta: 'Todas las ofertas' },
  { valor: 'vigente', etiqueta: 'Solo vigentes' },
  { valor: 'programada', etiqueta: 'Programadas' },
  { valor: 'vencida', etiqueta: 'Vencidas' },
  { valor: 'baja', etiqueta: 'Dadas de baja' },
]

function PreciosOferta({ ofertaId, revision, precios }: { ofertaId: string; revision: number; precios: Precio[] }) {
  const { data, loading, error, refetch } = useApiResource(
    () => fetchOferta(ofertaId),
    `${ofertaId}:${revision}`
  )

  if (loading) return <td colSpan={2}><span className="subtle">Cargando productos y precios...</span></td>
  if (error) return <td colSpan={2}><button className="precio-vacio" onClick={refetch}>Reintentar productos y precios</button></td>

  const productos = data?.productos.filter(producto => producto.activo) ?? []
  return <>
    <td>{productos.length === 0 ? <span className="subtle">Sin productos</span> : productos.map(producto => (
      <div key={producto.productoId} className="oferta-producto-cantidad">
        <strong>{producto.nombre}</strong><span className="subtle">{cantidadFormato(producto.cantidad ?? 1)} {producto.unidadVenta === 'UNIDADES' || producto.unidadVenta === 'unidad' ? 'unidades' : 'kg'}</span>
      </div>
    ))}</td>
    <td>{data && productos.length > 0 ? <ResumenOferta detalle={data} precios={precios} /> : '—'}</td>
  </>
}

function ModalBajaOferta({
  oferta,
  saving,
  error,
  onCancelar,
  onConfirmar,
}: {
  oferta: Oferta
  saving: boolean
  error: string
  onCancelar: () => void
  onConfirmar: () => void
}) {
  return (
    <Modal eyebrow="CATÁLOGO DE OFERTAS" title="Dar de baja oferta" onClose={onCancelar} busy={saving}>
      <div className="confirmation-icon"><Icon name="archive" size={28} /></div>
      <p>¿Querés dar de baja <strong>{oferta.nombre}</strong>?</p>
      <p>La oferta dejará de aplicarse. Sus datos se conservarán y sus productos quedarán sin precio de oferta.</p>
      {error !== '' && <div className="notice error" role="alert">{error}</div>}
      <div className="modal-footer">
        <button autoFocus className="button" disabled={saving} onClick={onCancelar}>Cancelar</button>
        <button className="button danger" disabled={saving} onClick={onConfirmar}>
          {saving ? 'Procesando...' : 'Confirmar baja'}
        </button>
      </div>
    </Modal>
  )
}

export function OfertasPage() {
  const { data, loading, error, refetch, setData } = useApiResource(fetchOfertas)
  const precios = useApiResource(fetchPreciosVigentes)

  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [bajaError, setBajaError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [revisionPrecios, setRevisionPrecios] = useState(0)

  function recargarOfertas() {
    refetch()
    precios.refetch()
    setRevisionPrecios(actual => actual + 1)
  }

  // `data ?? []` crea un array nuevo en cada render, así que se memoriza
  // para que el filtro de abajo no se recalcule siempre.
  const ofertas = useMemo(() => data ?? [], [data])

  const filtradas = useMemo(() => ofertas.filter(oferta => {
    if (!normalize(oferta.nombre).includes(normalize(search))) return false
    return filtro === 'todas' || estadoOferta(oferta) === filtro
  }), [ofertas, search, filtro])

  const vigentes = ofertas.filter(oferta => estadoOferta(oferta) === 'vigente').length
  const programadas = ofertas.filter(oferta => estadoOferta(oferta) === 'programada').length

  function abrir(next: Editor) {
    setBajaError('')
    setNotice('')
    setEditor(next)
  }

  async function darDeBaja(oferta: Oferta) {
    setSaving(true)
    setBajaError('')
    try {
      const actualizada = await desactivarOferta(oferta.id)
      setData(current => (current ?? []).map(item => item.id === actualizada.id ? actualizada : item))
      setNotice('Oferta dada de baja correctamente.')
      setEditor(null)
    } catch (fallo) {
      setBajaError(fallo instanceof Error ? fallo.message : 'No se pudo dar de baja la oferta.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="ofertas-page">
        <div className="breadcrumb">Gestión <Icon name="arrow" size={14} /> <span>Ofertas</span></div>
        <div className="cargando">
          <Icon name="tag" size={32} />
          <p>Cargando ofertas desde el servidor...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="ofertas-page">
      <div className="breadcrumb">Gestión <Icon name="arrow" size={14} /> <span>Ofertas</span></div>

      <div className="page-heading">
        <div>
          <h1>Ofertas y promociones</h1>
          <p>Armá combos y definí el precio final de cada oferta.</p>
        </div>
        <button className="button primary" disabled={error !== ''} onClick={() => abrir({ modo: 'crear' })}>
          <Icon name="plus" /> Nueva oferta
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat">
          <span className="stat-icon yellow"><Icon name="tag" size={24} /></span>
          <div><span>Total de ofertas</span><strong>{ofertas.length}</strong></div>
          <small>En el sistema</small>
        </div>
        <div className="stat">
          <span className="stat-icon status-green"><Icon name="check" size={24} /></span>
          <div><span>Ofertas vigentes</span><strong>{vigentes}</strong></div>
          <small>Se aplican hoy</small>
        </div>
        <div className="stat">
          <span className="stat-icon status-blue"><Icon name="calendar" size={24} /></span>
          <div><span>Programadas</span><strong>{programadas}</strong></div>
          <small>Todavía no empiezan</small>
        </div>
      </div>

      {notice !== '' && <div className="notice success" role="status"><Icon name="check" />{notice}</div>}
      {error !== '' && <div className="notice error" role="alert">{error}</div>}

      <div className="catalog-panel">
        <div className="catalog-title">
          <div>
            <h2>Todas las ofertas <span className="count">{filtradas.length}</span></h2>
            <p>Consultá los productos, cantidades y precio final del combo.</p>
          </div>
          <span className="subtle">Promociones</span>
        </div>

        <div className="filters">
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label="Buscar por nombre de la oferta"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search !== '' && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><Icon name="close" size={16} /></button>}
          </label>
          <label className="status-filter">
            Estado
            <select value={filtro} onChange={e => setFiltro(e.target.value)}>
              {FILTROS.map(({ valor, etiqueta }) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="offers-table">
            <thead>
              <tr>
                <th scope="col">Oferta</th>
                <th scope="col">Productos y cantidades</th>
                <th scope="col">Precio de oferta</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Estado</th>
                <th scope="col" className="actions-heading">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(oferta => {
                const estado = estadoOferta(oferta)
                return (
                  <tr key={oferta.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-symbol"><Icon name="tag" size={18} /></span>
                        <div>
                          <button className="product-link" onClick={() => abrir({ modo: 'detalle', oferta })}>{oferta.nombre}</button>
                          <span className="product-description">{oferta.descripcion || 'Sin descripción'}</span>
                        </div>
                      </div>
                    </td>
                    <PreciosOferta ofertaId={oferta.id} revision={revisionPrecios} precios={precios.data ?? []} />
                    <td>
                      <span className="offer-validity">
                        <span><Icon name="calendar" size={14} /><span>Desde: {formatearFecha(oferta.fechaInicio)}</span></span>
                        <span><Icon name="calendar" size={14} /><span>Hasta: {oferta.fechaFin ? formatearFecha(oferta.fechaFin) : 'Sin fecha de fin'}</span></span>
                      </span>
                    </td>
                    <td>
                      <span className={'badge offer-' + estado}><span />{ETIQUETA_ESTADO[estado]}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" title="Ver detalle" aria-label={'Ver ' + oferta.nombre} onClick={() => abrir({ modo: 'detalle', oferta })}><Icon name="eye" size={18} /></button>
                        <button className="button" disabled={!oferta.activo} title="Editar productos y cantidades de la oferta" aria-label={'Editar ' + oferta.nombre} onClick={() => abrir({ modo: 'editar', oferta })}><Icon name="edit" size={18} /> Editar oferta</button>
                        {!oferta.activo && <button className="button" aria-label={'Reactivar ' + oferta.nombre} onClick={() => abrir({ modo: 'reactivar', oferta })}><Icon name="check" size={18}/>Reactivar</button>}
                        <button className="icon-button danger-text" disabled={!oferta.activo} title={oferta.activo ? 'Dar de baja' : 'Oferta dada de baja'} aria-label={'Dar de baja ' + oferta.nombre} onClick={() => abrir({ modo: 'baja', oferta })}><Icon name="archive" size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtradas.length === 0 && (
          <div className="empty-state">
            <Icon name="tag" size={32} />
            <h3>{ofertas.length ? 'No encontramos ofertas' : 'Todavía no hay ofertas'}</h3>
            <p>{ofertas.length ? 'Probá con otro nombre o estado.' : 'Creá tu primera oferta para empezar a vender con precios especiales.'}</p>
            {ofertas.length > 0
              ? <button className="button" onClick={() => { setSearch(''); setFiltro('todas') }}>Limpiar filtros</button>
              : <button className="button primary" onClick={() => abrir({ modo: 'crear' })}>Crear la primera oferta</button>}
          </div>
        )}

        <div className="table-footer">
          Mostrando {filtradas.length} de {ofertas.length} ofertas
          <span>Las ofertas conservan su historial al darse de baja.</span>
        </div>
      </div>

      {editor?.modo === 'crear' && (
        <FormularioOfertaModal
          onClose={() => setEditor(null)}
          onGuardado={() => { recargarOfertas(); setEditor(null) }}
        />
      )}
      {editor?.modo === 'reactivar' && <ReactivarOfertaModal oferta={editor.oferta} onClose={() => setEditor(null)} onGuardado={() => { recargarOfertas(); setEditor(null); setNotice('Oferta reactivada correctamente.') }}/>}

      {editor?.modo === 'editar' && (
        <FormularioOfertaModal
          oferta={editor.oferta}
          onClose={() => setEditor(null)}
          onGuardado={() => { recargarOfertas(); setEditor(null) }}
        />
      )}

      {editor?.modo === 'detalle' && (
        <DetalleOfertaModal
          oferta={editor.oferta}
          onClose={() => setEditor(null)}
          onCambio={recargarOfertas}
        />
      )}

      {editor?.modo === 'baja' && (
        <ModalBajaOferta
          oferta={editor.oferta}
          saving={saving}
          error={bajaError}
          onCancelar={() => setEditor(null)}
          onConfirmar={() => darDeBaja(editor.oferta)}
        />
      )}
    </section>
  )
}
