import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { aFechaInput, fechaInputDesdeHoy } from '../../shared/lib/money'
import { fetchProducts } from '../../shared/services/api'
import { crearOferta, actualizarOferta, fetchOferta } from '../../shared/services/ofertas'
import { fetchPreciosVigentes } from '../../shared/services/precios'
import { normalize, type Product } from '../products/products'
import {
  armarPayloadActualizacion,
  armarPayloadOferta,
  validarOferta,
  vacioOfertaDraft,
  type ErroresOferta,
  type Oferta,
  type OfertaDraft,
  type ProductoOfertaDraft,
} from './ofertas'

type Props = {
  oferta?: Oferta
  onClose: () => void
  onGuardado: () => void
}

const MAXIMO_RESULTADOS = 8

function unidadLegible(unidad: string) {
  return unidad === 'kg' ? 'kg' : unidad
}

export function FormularioOfertaModal({ oferta, onClose, onGuardado }: Props) {
  const editando = oferta !== undefined

  const [draft, setDraft] = useState<OfertaDraft>(vacioOfertaDraft())
  const [errors, setErrors] = useState<ErroresOferta>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const { data: productos } = useApiResource(fetchProducts)

  // Los precios vigentes sirven para precompletar el precio de oferta con
  // el precio actual del producto, que es la base más natural.
  const { data: precios } = useApiResource(fetchPreciosVigentes)
  const precioPorProducto = useMemo(
    () => new Map((precios ?? []).map(precio => [precio.productoId, precio.precioMinorista])),
    [precios]
  )

  // Al editar hay que traer los productos que ya tiene la oferta para
  // mostrar sus precios actuales en la lista.
  const { data: detalle } = useApiResource(
    () => (oferta ? fetchOferta(oferta.id) : Promise.resolve(null)),
    oferta?.id ?? 'nueva'
  )

  const yaCargados = useRef(false)
  useEffect(() => {
    if (detalle === null || yaCargados.current) return
    yaCargados.current = true

    setDraft(current => ({
      ...current,
      nombre: detalle.nombre,
      descripcion: detalle.descripcion ?? '',
      // Al crear, las fechas por defecto son hoy y hoy+7; al editar
      // mandan las que ya tenía la oferta.
      fechaInicio: editando ? aFechaInput(detalle.fechaInicio) : current.fechaInicio,
      fechaFin: editando ? aFechaInput(detalle.fechaFin) : current.fechaFin,
      productos: detalle.productos.map(producto => ({
        productoId: producto.productoId,
        productoNombre: producto.nombre,
        productoCodigo: producto.codigo,
        unidadVenta: producto.unidadVenta,
        precioOferta: producto.precioOferta.replace('.', ','),
      })),
    }))
  }, [detalle, editando])

  const agregados = draft.productos

  const candidatos = useMemo(() => {
    const yaAgregados = new Set(agregados.map(producto => producto.productoId))
    const activos = (productos ?? []).filter((producto: Product) => producto.active)
    const disponibles = activos.filter(producto => !yaAgregados.has(Number(producto.id)))
    if (busqueda.trim() === '') return disponibles.slice(0, MAXIMO_RESULTADOS)
    const objetivo = normalize(busqueda)
    return disponibles
      .filter(producto => normalize(producto.name + ' ' + producto.code).includes(objetivo))
      .slice(0, MAXIMO_RESULTADOS)
  }, [productos, agregados, busqueda])

  function campo<K extends keyof OfertaDraft>(key: K, value: OfertaDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
  }

  function agregarProducto(producto: Product) {
    const productoId = Number(producto.id)
    const precioActual = precioPorProducto.get(productoId)
    const nuevo: ProductoOfertaDraft = {
      productoId,
      productoNombre: producto.name,
      productoCodigo: producto.code,
      unidadVenta: producto.unit,
      precioOferta: precioActual === undefined ? '' : precioActual.replace('.', ','),
    }
    setDraft(current => ({ ...current, productos: [...current.productos, nuevo] }))
    setErrors(current => ({ ...current, productos: undefined, productosDetalle: undefined }))
    setBusqueda('')
  }

  function cambiarPrecio(productoId: number, precioOferta: string) {
    setDraft(current => ({
      ...current,
      productos: current.productos.map(producto =>
        producto.productoId === productoId ? { ...producto, precioOferta } : producto
      ),
    }))
    setErrors(current => {
      if (current.productosDetalle === undefined) return current
      const { [productoId]: _quitado, ...resto } = current.productosDetalle
      return { ...current, productosDetalle: Object.keys(resto).length > 0 ? resto : undefined }
    })
  }

  function quitarProducto(productoId: number) {
    setDraft(current => ({
      ...current,
      productos: current.productos.filter(producto => producto.productoId !== productoId),
    }))
  }

  async function enviar(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validarOferta(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).filter(clave => clave !== 'productosDetalle').length > 0) return

    setSaving(true)
    setFormError('')
    try {
      if (oferta) {
        await actualizarOferta(oferta.id, armarPayloadActualizacion(draft))
      } else {
        const payload = armarPayloadOferta(draft)
        if (payload === null) return
        await crearOferta(payload)
      }
      onGuardado()
    } catch (fallo) {
      setFormError(fallo instanceof Error ? fallo.message : 'No se pudo guardar la oferta.')
    } finally {
      setSaving(false)
    }
  }

  const fechaMinima = draft.fechaInicio === '' ? fechaInputDesdeHoy(0) : draft.fechaInicio

  return (
    <Modal
      eyebrow="CATÁLOGO DE OFERTAS"
      title={editando ? `Editar ${oferta.nombre}` : 'Nueva oferta'}
      onClose={onClose}
    >
      <form onSubmit={enviar} noValidate>
        <p className="form-intro">
          {editando
            ? 'Modificá los datos de la oferta. Para cambiar precios o quitar productos usá el detalle.'
            : 'Completá los datos y agregá al menos un producto con su precio de oferta.'}
        </p>

        {formError !== '' && <div className="notice error" role="alert">{formError}</div>}

        <div className="form-grid">
          <label className="full-width">
            Nombre de la oferta *
            <input
              autoFocus={!editando}
              maxLength={50}
              value={draft.nombre}
              onChange={e => campo('nombre', e.target.value)}
              aria-invalid={!!errors.nombre}
              aria-describedby={errors.nombre ? 'error-nombre-oferta' : undefined}
              placeholder="Ej. Oferta de fin de semana"
            />
            {errors.nombre && <small id="error-nombre-oferta" className="field-error">{errors.nombre}</small>}
          </label>

          <label>
            Vigente desde *
            <input
              type="date"
              value={draft.fechaInicio}
              onChange={e => campo('fechaInicio', e.target.value)}
              aria-invalid={!!errors.fechaInicio}
              aria-describedby={errors.fechaInicio ? 'error-fecha-inicio' : undefined}
            />
            {errors.fechaInicio && <small id="error-fecha-inicio" className="field-error">{errors.fechaInicio}</small>}
          </label>

          <label>
            Vigente hasta *
            <input
              type="date"
              value={draft.fechaFin}
              min={fechaMinima}
              onChange={e => campo('fechaFin', e.target.value)}
              aria-invalid={!!errors.fechaFin}
              aria-describedby={errors.fechaFin ? 'error-fecha-fin' : undefined}
            />
            {errors.fechaFin && <small id="error-fecha-fin" className="field-error">{errors.fechaFin}</small>}
          </label>

          <label className="full-width">
            Descripción
            <textarea
              rows={2}
              maxLength={300}
              value={draft.descripcion}
              onChange={e => campo('descripcion', e.target.value)}
              placeholder="Opcional"
            />
            <small>{draft.descripcion.length}/300 caracteres</small>
          </label>
        </div>

        {editando
          ? <p className="form-note">Los productos y sus precios se modifican desde el detalle de la oferta.</p>
          : (
            <>
              <h3 className="modal-section">Productos de la oferta</h3>

              <label className="search-field">
                <Icon name="search" />
                <input
                  aria-label="Buscar producto para agregar"
                  placeholder="Buscar producto por nombre o código..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </label>

              {candidatos.length > 0 && (
                <ul className="product-picker">
                  {candidatos.map(producto => (
                    <li key={producto.id}>
                      <div>
                        <strong>{producto.name}</strong>
                        <small><code>{producto.code}</code> · {unidadLegible(producto.unit)}</small>
                      </div>
                      <button
                        type="button"
                        className="button"
                        aria-label={`Agregar ${producto.name}`}
                        onClick={() => agregarProducto(producto)}
                      >
                        <Icon name="plus" size={16} />Agregar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {busqueda.trim() !== '' && candidatos.length === 0 && (
                <p className="modal-empty">No encontramos productos disponibles con ese criterio.</p>
              )}

              {errors.productos && <div className="notice error" role="alert">{errors.productos}</div>}

              {agregados.length > 0 && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Precio de oferta *</th>
                        <th scope="col" className="actions-heading">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agregados.map(producto => (
                        <tr key={producto.productoId}>
                          <td>
                            <div>
                              <strong>{producto.productoNombre}</strong>
                              <small className="product-description"><code>{producto.productoCodigo}</code> · {unidadLegible(producto.unidadVenta)}</small>
                            </div>
                          </td>
                          <td>
                            <input
                              className="precio-input"
                              inputMode="decimal"
                              aria-label={`Precio de oferta para ${producto.productoNombre}`}
                              value={producto.precioOferta}
                              onChange={e => cambiarPrecio(producto.productoId, e.target.value)}
                              aria-invalid={!!errors.productosDetalle?.[producto.productoId]}
                              placeholder="Ej. 3900,00"
                            />
                            {errors.productosDetalle?.[producto.productoId] && (
                              <small className="field-error">{errors.productosDetalle[producto.productoId]}</small>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button danger-text"
                              aria-label={`Quitar ${producto.productoNombre}`}
                              onClick={() => quitarProducto(producto.productoId)}
                            >
                              <Icon name="close" size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {agregados.length === 0 && <p className="modal-empty">Todavía no agregaste productos.</p>}
            </>
          )}

        <div className="modal-footer">
          <button type="button" className="button" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="button primary" disabled={saving}>
            <Icon name="check" size={18} />
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar oferta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
