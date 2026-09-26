import { useState, type FormEvent } from 'react'
import { Icon } from '../../shared/components/Icon'
import { Modal } from '../../shared/components/Modal'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fechaInputDesdeHoy, formatearFecha, formatearMonto, hoyComoFechaInput } from '../../shared/lib/money'
import { actualizarPrecio, fetchHistorialPrecios, registrarPrecio } from '../../shared/services/precios'
import type { Product } from '../products/products'
import {
  armarPayloadPrecio,
  validarPrecio,
  vacioPrecioDraft,
  type Precio,
  type PrecioDraft,
} from './precios'

type Modo = 'ver' | 'nuevo' | 'editar'

type Props = {
  producto: Product
  onClose: () => void
  /** Avisa al catálogo para que recargue la columna de precios. */
  onGuardado: () => void
}

function PrecioActual({ precio }: { precio: Precio | null }) {
  if (!precio) {
    return (
      <div className="precio-actual vacio">
        <div>
          <span className="precio-actual-label">Precio vigente</span>
          <strong>Sin precio</strong>
          <p>Este producto todavía no tiene un precio registrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="precio-actual">
      <div>
        <span className="precio-actual-label">Precio minorista</span>
        <strong>{formatearMonto(precio.precioMinorista)}</strong>
        <small>Vigente desde {formatearFecha(precio.fechaDesde)}</small>
      </div>
      <div>
        <span className="precio-actual-label">Precio mayorista</span>
        <strong>{precio.precioMayorista === null ? '—' : formatearMonto(precio.precioMayorista)}</strong>
        <small>{precio.precioMayorista === null ? 'No aplica' : 'Vigente desde ' + formatearFecha(precio.fechaDesde)}</small>
      </div>
    </div>
  )
}

function HistorialPrecios({ historial }: { historial: Precio[] }) {
  if (historial.length === 0) {
    return <p className="modal-empty">Todavía no hay precios registrados para este producto.</p>
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Desde</th>
            <th scope="col">Hasta</th>
            <th scope="col">Minorista</th>
            <th scope="col">Mayorista</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {historial.map(precio => (
            <tr key={precio.id}>
              <td>{formatearFecha(precio.fechaDesde)}</td>
              <td>{precio.fechaHasta === null ? '—' : formatearFecha(precio.fechaHasta)}</td>
              <td>{formatearMonto(precio.precioMinorista)}</td>
              <td>{formatearMonto(precio.precioMayorista)}</td>
              <td>
                {!precio.activo
                  ? <span className="badge inactive"><span />Dado de baja</span>
                  : <span className={'badge ' + (precio.vigente ? 'active' : 'inactive')}><span />{precio.vigente ? 'Vigente' : 'Histórico'}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FormularioPrecio({
  modo,
  producto,
  draft,
  errors,
  formError,
  saving,
  onCampo,
  onEnviar,
  onVolver,
}: {
  modo: Exclude<Modo, 'ver'>
  producto: Product
  draft: PrecioDraft
  errors: Partial<Record<keyof PrecioDraft, string>>
  formError: string
  saving: boolean
  onCampo: <K extends keyof PrecioDraft>(key: K, value: PrecioDraft[K]) => void
  onEnviar: (event: FormEvent) => void
  onVolver: () => void
}) {

  return (
    <form onSubmit={onEnviar} noValidate>
      <p className="form-intro">
        {modo === 'editar'
          ? 'Corregí los montos. La vigencia del precio no se modifica.'
          : `El precio vigente de ${producto.name} se cerrará y este lo reemplaza.`}
      </p>

      {formError !== '' && <div className="notice error" role="alert">{formError}</div>}

      <div className="form-grid">
        <label>
          Precio minorista *
          <input
            autoFocus
            inputMode="decimal"
            value={draft.precioMinorista}
            onChange={e => onCampo('precioMinorista', e.target.value)}
            aria-invalid={!!errors.precioMinorista}
            aria-describedby={errors.precioMinorista ? 'error-precio-minorista' : undefined}
            placeholder="Ej. 4500,50"
          />
          {errors.precioMinorista && <small id="error-precio-minorista" className="field-error">{errors.precioMinorista}</small>}
        </label>

        <label>
          Precio mayorista
          <input
            inputMode="decimal"
            value={draft.precioMayorista}
            onChange={e => onCampo('precioMayorista', e.target.value)}
            aria-invalid={!!errors.precioMayorista}
            aria-describedby={errors.precioMayorista ? 'error-precio-mayorista' : undefined}
            placeholder="Opcional"
          />
          {errors.precioMayorista && <small id="error-precio-mayorista" className="field-error">{errors.precioMayorista}</small>}
        </label>

        {modo === 'nuevo' && (
          <label className="full-width">
            Vigente desde
            <input
              type="date"
              value={draft.fechaDesde}
              min={fechaInputDesdeHoy(-365)}
              onChange={e => onCampo('fechaDesde', e.target.value)}
              aria-invalid={!!errors.fechaDesde}
              aria-describedby={errors.fechaDesde ? 'error-fecha-desde' : undefined}
            />
            {errors.fechaDesde && <small id="error-fecha-desde" className="field-error">{errors.fechaDesde}</small>}
            <small>Por defecto, hoy.</small>
          </label>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="button" disabled={saving} onClick={onVolver}>Volver</button>
        <button type="submit" className="button primary" disabled={saving}>
          <Icon name="check" size={18} />
          {saving ? 'Guardando...' : modo === 'editar' ? 'Guardar corrección' : 'Registrar precio'}
        </button>
      </div>
    </form>
  )
}

export function PreciosProductoModal({ producto, onClose, onGuardado }: Props) {
  // El id del producto llega como texto en el catálogo y como número en
  // la API, por eso la clave del hook es el número ya convertido.
  const productoId = Number(producto.id)

  const { data, loading, error, refetch } = useApiResource(
    () => fetchHistorialPrecios(productoId),
    productoId
  )

  const [modo, setModo] = useState<Modo>('ver')
  const [draft, setDraft] = useState<PrecioDraft>(vacioPrecioDraft(productoId))
  const [errors, setErrors] = useState<Partial<Record<keyof PrecioDraft, string>>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const historial = data ?? []
  const vigente = historial.find(precio => precio.vigente) ?? null

  function abrirFormulario(origen: Exclude<Modo, 'ver'>) {
    if (origen === 'editar' && vigente !== null) {
      setDraft({
        productoId,
        precioMinorista: String(vigente.precioMinorista).replace('.', ','),
        precioMayorista: vigente.precioMayorista === null ? '' : String(vigente.precioMayorista).replace('.', ','),
        fechaDesde: '',
      })
    } else {
      setDraft({ ...vacioPrecioDraft(productoId), fechaDesde: hoyComoFechaInput() })
    }
    setErrors({})
    setFormError('')
    setNotice('')
    setModo(origen)
  }

  function campo<K extends keyof PrecioDraft>(key: K, value: PrecioDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
  }

  async function enviar(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validarPrecio(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload = armarPayloadPrecio(draft)
    if (payload === null) return

    const habiaVigente = vigente !== null

    setSaving(true)
    setFormError('')
    try {
      if (modo === 'editar' && vigente !== null) {
        await actualizarPrecio(vigente.id, {
          precioMinorista: payload.precioMinorista,
          precioMayorista: payload.precioMayorista,
        })
        setNotice('Precio corregido correctamente.')
      } else {
        await registrarPrecio(payload)
        setNotice(habiaVigente
          ? 'Precio registrado. El anterior quedó en el historial.'
          : 'Precio registrado correctamente.')
      }
      refetch()
      onGuardado()
      setModo('ver')
    } catch (fallo) {
      setFormError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el precio.')
    } finally {
      setSaving(false)
    }
  }

  const titulo = modo === 'ver'
    ? `Precios de ${producto.name}`
    : modo === 'nuevo' ? 'Registrar nuevo precio' : 'Corregir precio'

  return (
    <Modal eyebrow="CATÁLOGO DE PRODUCTOS" title={titulo} onClose={onClose}>
      {notice !== '' && <div className="notice success" role="status"><Icon name="check" />{notice}</div>}

      {modo === 'ver' && (
        <>
          {error !== '' && <div className="notice error" role="alert">{error}</div>}

          {loading
            ? <p className="modal-loading">Cargando precios desde el servidor...</p>
            : (
              <>
                <PrecioActual precio={vigente} />
                <h3 className="modal-section">Historial de precios</h3>
                <HistorialPrecios historial={historial} />
                <p className="form-note">Registrar un precio nuevo cierra el vigente y lo guarda en el historial.</p>
                <div className="modal-footer">
                  <button className="button" onClick={onClose}>Cerrar</button>
                  {vigente !== null && (
                    <button className="button" onClick={() => abrirFormulario('editar')}>
                      <Icon name="edit" size={18} />Corregir
                    </button>
                  )}
                  <button className="button primary" onClick={() => abrirFormulario('nuevo')}>
                    <Icon name="plus" />Registrar nuevo precio
                  </button>
                </div>
              </>
            )}
        </>
      )}

      {modo !== 'ver' && (
        <FormularioPrecio
          modo={modo}
          producto={producto}
          draft={draft}
          errors={errors}
          formError={formError}
          saving={saving}
          onCampo={campo}
          onEnviar={enviar}
          onVolver={() => setModo('ver')}
        />
      )}
    </Modal>
  )
}
