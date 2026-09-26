import { aFechaInput, esFechaValida, fechaInputDesdeHoy, hoyComoFechaInput, parseMontoInput } from '../../shared/lib/money'

/**
 * The offer endpoints send productoId as a string in the detail responses
 * and as a number in the per-product ones. Everything is normalized to a
 * number here so it can be compared with the catalog, where Product.id
 * is text.
 */
export type OfertaProductoApi = {
  productoId: number | string
  codigo: string
  nombre: string
  unidadVenta: string
  stockActual: number
  precioOferta: string
  activo: boolean
}

export type OfertaProducto = Omit<OfertaProductoApi, 'productoId'> & { productoId: number }

export type Oferta = {
  id: string
  nombre: string
  descripcion: string | null
  fechaInicio: string
  fechaFin: string
  vigente: boolean
  activo: boolean
  fechaBaja: string | null
}

export type OfertaConProductos = Oferta & { productos: OfertaProducto[] }

/** A product being added to an offer, with the price typed by the user. */
export type ProductoOfertaDraft = {
  productoId: number
  productoNombre: string
  productoCodigo: string
  unidadVenta: string
  precioOferta: string
}

export type OfertaDraft = {
  nombre: string
  descripcion: string
  fechaInicio: string
  fechaFin: string
  productos: ProductoOfertaDraft[]
}

export function vacioOfertaDraft(): OfertaDraft {
  return {
    nombre: '',
    descripcion: '',
    fechaInicio: fechaInputDesdeHoy(0),
    fechaFin: fechaInputDesdeHoy(7),
    productos: [],
  }
}

export function normalizarOfertaProducto(producto: OfertaProductoApi): OfertaProducto {
  return { ...producto, productoId: Number(producto.productoId) }
}

export function normalizarDetalle(detalle: OfertaConProductos): OfertaConProductos {
  return { ...detalle, productos: detalle.productos.map(normalizarOfertaProducto) }
}

const MAXIMO_PRODUCTOS = 200

export type EstadoOferta = 'vigente' | 'programada' | 'vencida' | 'baja'

export const ETIQUETA_ESTADO: Record<EstadoOferta, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
  baja: 'Dada de baja',
}

/**
 * Whether the offer is running, still to come, over, or deleted.
 *
 * The vigente flag is the one the API computes. The other two are
 * decided here comparing the YYYY-MM-DD part of the dates as text, which
 * is safe because that format sorts chronologically, and avoids the
 * timezone shifts a Date would introduce.
 */
export function estadoOferta(oferta: Oferta): EstadoOferta {
  if (!oferta.activo) return 'baja'
  if (oferta.vigente) return 'vigente'
  return aFechaInput(oferta.fechaInicio) > hoyComoFechaInput() ? 'programada' : 'vencida'
}

export type ErroresOferta = Partial<Record<'nombre' | 'descripcion' | 'fechaInicio' | 'fechaFin' | 'productos', string>> & {
  productosDetalle?: Record<number, string>
}

export function validarOferta(draft: OfertaDraft): ErroresOferta {
  const errors: ErroresOferta = {}
  const nombre = draft.nombre.trim()

  if (nombre.length < 1 || nombre.length > 50) {
    errors.nombre = 'Ingresá un nombre de entre 1 y 50 caracteres.'
  }

  if (draft.descripcion.length > 300) {
    errors.descripcion = 'La descripción admite hasta 300 caracteres.'
  }

  if (draft.fechaInicio === '' || !esFechaValida(draft.fechaInicio)) {
    errors.fechaInicio = 'Ingresá una fecha de inicio válida.'
  }

  if (draft.fechaFin === '' || !esFechaValida(draft.fechaFin)) {
    errors.fechaFin = 'Ingresá una fecha de fin válida.'
  }

  if (errors.fechaInicio === undefined && errors.fechaFin === undefined && draft.fechaFin <= draft.fechaInicio) {
    errors.fechaFin = 'La fecha de fin debe ser posterior a la fecha de inicio.'
  }

  if (draft.productos.length === 0) {
    errors.productos = 'Agregá al menos un producto a la oferta.'
  } else if (draft.productos.length > MAXIMO_PRODUCTOS) {
    errors.productos = `La oferta no puede tener más de ${MAXIMO_PRODUCTOS} productos.`
  } else {
    const repetidos = draft.productos.filter((producto, indice) =>
      draft.productos.findIndex(otro => otro.productoId === producto.productoId) !== indice
    )
    if (repetidos.length > 0) {
      errors.productos = 'Hay productos repetidos en la lista.'
    }

    const detalle: Record<number, string> = {}
    for (const producto of draft.productos) {
      const precio = parseMontoInput(producto.precioOferta, 'precio de oferta')
      if (!precio.ok) detalle[producto.productoId] = precio.error
    }
    if (Object.keys(detalle).length > 0) errors.productosDetalle = detalle
  }

  return errors
}

/** Builds the request body from a validated draft. Amounts go as text. */
export function armarPayloadOferta(draft: OfertaDraft) {
  const productos = draft.productos.flatMap(producto => {
    const precio = parseMontoInput(producto.precioOferta, 'precio de oferta')
    return precio.ok ? [{ productoId: producto.productoId, precioOferta: precio.value }] : []
  })

  if (productos.length !== draft.productos.length) return null

  return {
    nombre: draft.nombre.trim(),
    descripcion: draft.descripcion.trim(),
    fechaInicio: draft.fechaInicio,
    fechaFin: draft.fechaFin,
    productos,
  }
}

/** Body for PUT /api/ofertas/:id, which rejects an empty change. */
export function armarPayloadActualizacion(draft: OfertaDraft) {
  return {
    nombre: draft.nombre.trim(),
    descripcion: draft.descripcion.trim(),
    fechaInicio: draft.fechaInicio,
    fechaFin: draft.fechaFin,
  }
}
