import { useState } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { formatearFecha, parseMontoInput } from '../../shared/lib/money'
import { actualizarPrecioEnOferta, fetchOferta, quitarProductoDeOferta } from '../../shared/services/ofertas'
import { ETIQUETA_ESTADO, estadoOferta, type Oferta, type OfertaProducto } from './ofertas'

type Props = {
  oferta: Oferta
  onClose: () => void
  onCambio: () => void
}

function FilaProducto({
  producto,
  onGuardarPrecio,
  onQuitar,
}: {
  producto: OfertaProducto
  onGuardarPrecio: (precio: string) => void
  onQuitar: () => void
}) {
  const [precio, setPrecio] = useState(producto.precioOferta.replace('.', ','))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const original = producto.precioOferta.replace('.', ',')
  const cambio = precio !== original

  async function guardar() {
    const resultado = parseMontoInput(precio, 'precio de oferta')
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }

    setSaving(true)
    setError('')
    try {
      await onGuardarPrecio(resultado.value)
      setPrecio(resultado.value.replace('.', ','))
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo actualizar el precio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td>
        <div>
          <strong>{producto.nombre}</strong>
          <small className="product-description"><code>{producto.codigo}</code> · {producto.unidadVenta}</small>
        </div>
      </td>
      <td>{producto.stockActual}</td>
      <td>
        {producto.activo
          ? <input
              className="precio-input"
              inputMode="decimal"
              aria-label={`Precio de ${producto.nombre}`}
              value={precio}
              onChange={e => { setPrecio(e.target.value); setError('') }}
              aria-invalid={!!error}
            />
          : <span className="subtle">Quitado de la oferta</span>}
        {error !== '' && <small className="field-error">{error}</small>}
      </td>
      <td>
        {confirmando
          ? (
            <div className="row-actions">
              <button className="button danger" disabled={saving} onClick={onQuitar}>
                {saving ? 'Quitando...' : 'Confirmar'}
              </button>
              <button className="button" disabled={saving} onClick={() => setConfirmando(false)}>Cancelar</button>
            </div>
          )
          : (
            <div className="row-actions">
              {producto.activo && (
                <button
                  className="icon-button"
                  title="Guardar precio"
                  aria-label={`Guardar precio de ${producto.nombre}`}
                  disabled={!cambio || saving}
                  onClick={guardar}
                >
                  <Icon name="check" size={18} />
                </button>
              )}
              {producto.activo && (
                <button
                  className="icon-button danger-text"
                  title="Quitar de la oferta"
                  aria-label={`Quitar ${producto.nombre} de la oferta`}
                  onClick={() => setConfirmando(true)}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          )}
      </td>
    </tr>
  )
}

export function DetalleOfertaModal({ oferta, onClose, onCambio }: Props) {
  const { data, loading, error, refetch } = useApiResource(
    () => fetchOferta(oferta.id),
    oferta.id
  )

  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  const detalle = data
  const estado = detalle ? estadoOferta(detalle) : 'vigente'
  const productos = detalle?.productos ?? []

  async function guardarPrecio(productoId: number, precioOferta: string) {
    setActionError('')
    await actualizarPrecioEnOferta(oferta.id, productoId, precioOferta)
    setNotice('Precio de oferta actualizado.')
    refetch()
    onCambio()
  }

  async function quitar(productoId: number) {
    setActionError('')
    try {
      await quitarProductoDeOferta(oferta.id, productoId)
      setNotice('Producto quitado de la oferta.')
      refetch()
      onCambio()
    } catch (fallo) {
      setActionError(fallo instanceof Error ? fallo.message : 'No se pudo quitar el producto.')
    }
  }

  return (
    <Modal eyebrow="CATÁLOGO DE OFERTAS" title={oferta.nombre} onClose={onClose}>
      {notice !== '' && <div className="notice success" role="status"><Icon name="check" />{notice}</div>}
      {error !== '' && <div className="notice error" role="alert">{error}</div>}
      {actionError !== '' && <div className="notice error" role="alert">{actionError}</div>}

      {loading
        ? <p className="modal-loading">Cargando la oferta desde el servidor...</p>
        : detalle && (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Vigencia</dt>
                <dd>{formatearFecha(detalle.fechaInicio)} — {formatearFecha(detalle.fechaFin)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span className={'badge ' + (estado === 'vigente' ? 'active' : 'inactive')}><span />{ETIQUETA_ESTADO[estado]}</span>
                </dd>
              </div>
              <div className="full-width">
                <dt>Descripción</dt>
                <dd>{detalle.descripcion || 'Sin descripción'}</dd>
              </div>
            </dl>

            <h3 className="modal-section">Productos y precios</h3>

            {productos.length === 0
              ? <p className="modal-empty">Esta oferta no tiene productos.</p>
              : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Stock</th>
                        <th scope="col">Precio de oferta</th>
                        <th scope="col" className="actions-heading">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map(producto => (
                        <FilaProducto
                          key={producto.productoId}
                          producto={producto}
                          onGuardarPrecio={precio => guardarPrecio(producto.productoId, precio)}
                          onQuitar={() => quitar(producto.productoId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            <p className="form-note">
              Guardar un precio manda <code>PUT</code> y solo cambia ese producto. Quitarlo lo da de baja dentro
              de la oferta sin borrar el historial.
            </p>

            <div className="modal-footer">
              <button className="button" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
    </Modal>
  )
}
