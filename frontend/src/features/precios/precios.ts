import { aNumero, esFechaValida, parseMontoInput } from '../../shared/lib/money'

/**
 * Shape the price endpoints send.
 *
 * productoId is declared as number | string because the API is not
 * consistent about it: the price endpoints send a number while the offer
 * endpoints send a string in some responses. Taking the union here and
 * normalizing below keeps a mistake from becoming a silently empty list.
 */
export type PrecioApi = {
  id: string
  productoId: number | string
  precioMinorista: string
  precioMayorista: string | null
  fechaDesde: string
  fechaHasta: string | null
  vigente: boolean
  activo: boolean
  fechaBaja: string | null
}

export type Precio = Omit<PrecioApi, 'productoId'> & { productoId: number }

/** Raw text the user typed, before validation. */
export type PrecioDraft = {
  productoId: number
  precioMinorista: string
  precioMayorista: string
  fechaDesde: string
}

export function vacioPrecioDraft(productoId: number): PrecioDraft {
  return { productoId, precioMinorista: '', precioMayorista: '', fechaDesde: '' }
}

export function normalizarPrecio(precio: PrecioApi): Precio {
  return { ...precio, productoId: Number(precio.productoId) }
}

export function validarPrecio(draft: PrecioDraft): Partial<Record<keyof PrecioDraft, string>> {
  const errors: Partial<Record<keyof PrecioDraft, string>> = {}

  if (!Number.isSafeInteger(draft.productoId) || draft.productoId <= 0) {
    errors.productoId = 'El producto no es válido.'
  }

  const minorista = parseMontoInput(draft.precioMinorista, 'precio minorista')
  if (!minorista.ok) errors.precioMinorista = minorista.error

  const mayorista = parseMontoInput(draft.precioMayorista, 'precio mayorista', false)
  if (!mayorista.ok) errors.precioMayorista = mayorista.error

  if (minorista.ok && mayorista.ok && mayorista.value !== '' && aNumero(mayorista.value) > aNumero(minorista.value)) {
    errors.precioMayorista = 'El precio mayorista no puede superar al minorista.'
  }

  if (draft.fechaDesde !== '' && !esFechaValida(draft.fechaDesde)) {
    errors.fechaDesde = 'Ingresá una fecha válida.'
  }

  return errors
}

/** Builds the request body from a validated draft. Amounts go as text. */
export function armarPayloadPrecio(draft: PrecioDraft) {
  const minorista = parseMontoInput(draft.precioMinorista, 'precio minorista')
  const mayorista = parseMontoInput(draft.precioMayorista, 'precio mayorista', false)

  if (!minorista.ok || !mayorista.ok) return null

  return {
    productoId: draft.productoId,
    precioMinorista: minorista.value,
    precioMayorista: mayorista.value === '' ? null : mayorista.value,
    fechaDesde: draft.fechaDesde === '' ? undefined : draft.fechaDesde,
  }
}
