// Format helpers for amounts and dates.
//
// Amounts arrive from the API as text ("4800.00") because they are
// DECIMAL in Postgres. Dates arrive as ISO strings with time zone.

const MONTO_MAXIMO = 99999999.99

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Shows an amount with the local currency format, or a dash if there is none. */
export function formatearMonto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  return moneda.format(numero)
}

export type ResultadoMonto =
  | { ok: true; value: string }
  | { ok: false; error: string }

/**
 * Reads what the user typed in a price field.
 *
 * Accepts comma or dot as the decimal separator, because in Argentina
 * people type "4500,50". Thousand separators are rejected on purpose:
 * guessing whether "1.500" means one thousand five hundred or one
 * point five is worse than asking for a clean number.
 *
 * Returns the amount as text with two decimals, the same format the API
 * and the database use, so nothing loses precision on the way.
 */
export function parseMontoInput(
  entrada: string,
  campo: string,
  obligatorio = true
): ResultadoMonto {

  const texto = entrada.trim()

  if (texto === '') {
    return obligatorio
      ? { ok: false, error: `Ingresá el ${campo}.` }
      : { ok: true, value: '' }
  }

  const normalizado = texto.replace(',', '.')

  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(normalizado)) {
    return { ok: false, error: `Ingresá el ${campo} con hasta 2 decimales, usando coma o punto.` }
  }

  const numero = Number(normalizado)

  if (numero <= 0) {
    return { ok: false, error: `El ${campo} debe ser mayor a cero.` }
  }

  if (numero > MONTO_MAXIMO) {
    return { ok: false, error: `El ${campo} supera el máximo permitido.` }
  }

  return { ok: true, value: numero.toFixed(2) }
}

/** Turns an amount coming from an input into a number for comparisons. */
export function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

/**
 * The date part of an ISO string, read without timezone conversion.
 *
 * The backend builds dates with `new Date("2026-10-01")`, and per the
 * JS spec a date-only string is parsed as UTC midnight. So the day the
 * user picked is always the day in the UTC part of the string, and
 * formatting it with the local timezone would move offers to the
 * previous day depending on where the browser is. Reading the first ten
 * characters keeps "starts on 1/10" meaning 1/10 everywhere.
 */
function parteFecha(iso: string): string {
  return iso.slice(0, 10)
}

/** 2026-10-01 -> 01/10/2026 */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [anio, mes, dia] = parteFecha(iso).split('-')
  if (!anio || !mes || !dia) return '—'
  return `${dia}/${mes}/${anio}`
}

/** 2026-10-01T00:00:00.000Z -> 01/10/2026 00:00 */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const dia = formatearFecha(iso)
  const hora = iso.slice(11, 16)
  return hora ? `${dia} ${hora}` : dia
}

/** The value a <input type="date"> expects. */
export function aFechaInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const parte = parteFecha(iso)
  return /^\d{4}-\d{2}-\d{2}$/.test(parte) ? parte : ''
}

/**
 * Today in YYYY-MM-DD using the local calendar day.
 *
 * toISOString() is not used on purpose: it converts to UTC first, so
 * late at night it would return tomorrow's date.
 */
export function hoyComoFechaInput(): string {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

/** Same as hoyComoFechaInput but shifted by whole days. */
export function fechaInputDesdeHoy(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** True when the value looks like YYYY-MM-DD and is a real date. */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio
    && fecha.getUTCMonth() === mes - 1
    && fecha.getUTCDate() === dia
}
