import { describe, expect, it } from 'vitest'
import {
  aFechaInput,
  esFechaValida,
  fechaInputDesdeHoy,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  hoyComoFechaInput,
  parseMontoInput,
} from '../src/shared/lib/money'

describe('formatearMonto', () => {
  it('muestra los DECIMAL que llegan como texto con el formato local', () => {
    expect(formatearMonto('4500.50')).toContain('4.500,50')
    expect(formatearMonto('3900')).toContain('3.900,00')
    expect(formatearMonto(1234.5)).toContain('1.234,50')
  })

  it('devuelve un guion cuando no hay monto', () => {
    expect(formatearMonto(null)).toBe('—')
    expect(formatearMonto(undefined)).toBe('—')
    expect(formatearMonto('')).toBe('—')
    expect(formatearMonto('no es un número')).toBe('—')
  })
})

describe('parseMontoInput', () => {
  it('acepta coma o punto como separador decimal', () => {
    expect(parseMontoInput('4500,50', 'precio')).toEqual({ ok: true, value: '4500.50' })
    expect(parseMontoInput('4500.50', 'precio')).toEqual({ ok: true, value: '4500.50' })
    expect(parseMontoInput('4500', 'precio')).toEqual({ ok: true, value: '4500.00' })
    expect(parseMontoInput('4500,5', 'precio')).toEqual({ ok: true, value: '4500.50' })
  })

  it('devuelve dos decimales para no perder precisión con DECIMAL', () => {
    const resultado = parseMontoInput('0,1', 'precio')
    expect(resultado).toEqual({ ok: true, value: '0.10' })
  })

  it('rechaza un monto vacío cuando es obligatorio', () => {
    const resultado = parseMontoInput('  ', 'precio minorista')
    expect(resultado.ok).toBe(false)
  })

  it('deja pasar un monto vacío cuando es opcional', () => {
    expect(parseMontoInput('', 'precio mayorista', false)).toEqual({ ok: true, value: '' })
  })

  it('rechaza el cero y los negativos', () => {
    expect(parseMontoInput('0', 'precio').ok).toBe(false)
    expect(parseMontoInput('-5', 'precio').ok).toBe(false)
  })

  it('rechaza los separadores de miles en vez de adivinar', () => {
    // "1.500" puede ser mil quinientos o uno con cinco. Se rechaza.
    expect(parseMontoInput('1.500', 'precio').ok).toBe(false)
  })

  it('rechaza más de dos decimales y texto que no es un número', () => {
    expect(parseMontoInput('4500,555', 'precio').ok).toBe(false)
    expect(parseMontoInput('cuatro mil', 'precio').ok).toBe(false)
    expect(parseMontoInput('4500,50 pesos', 'precio').ok).toBe(false)
  })
})

describe('formatearFecha', () => {
  it('no corre el día por la zona horaria', () => {
    // El backend arma las fechas con new Date("2026-10-01"), que según
    // la especificación es UTC medianoche. Leer el día en la zona local
    // movería la fecha al 30/09 en Argentina.
    expect(formatearFecha('2026-10-01T00:00:00.000Z')).toBe('01/10/2026')
    expect(formatearFecha('2026-01-01T03:00:00.000Z')).toBe('01/01/2026')
  })

  it('devuelve un guion cuando no hay fecha', () => {
    expect(formatearFecha(null)).toBe('—')
    expect(formatearFecha(undefined)).toBe('—')
  })

  it('muestra la hora cuando viene', () => {
    expect(formatearFechaHora('2026-10-01T14:30:00.000Z')).toBe('01/10/2026 14:30')
  })
})

describe('aFechaInput', () => {
  it('devuelve la parte de fecha para los inputs de la formulario', () => {
    expect(aFechaInput('2026-10-01T00:00:00.000Z')).toBe('2026-10-01')
    expect(aFechaInput(null)).toBe('')
    expect(aFechaInput('no es una fecha')).toBe('')
  })
})

describe('fechas de hoy', () => {
  it('usa el día local y no el de UTC', () => {
    const hoy = new Date()
    const esperado = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0'),
    ].join('-')
    expect(hoyComoFechaInput()).toBe(esperado)
  })

  it('permite desplazar la fecha una cantidad de días', () => {
    expect(esFechaValida(fechaInputDesdeHoy(7))).toBe(true)
    expect(esFechaValida(fechaInputDesdeHoy(-30))).toBe(true)
    expect(fechaInputDesdeHoy(0)).toBe(hoyComoFechaInput())
  })
})

describe('esFechaValida', () => {
  it('acepta fechas reales', () => {
    expect(esFechaValida('2026-02-28')).toBe(true)
    expect(esFechaValida('2024-02-29')).toBe(true)
  })

  it('rechaza fechas que no existen', () => {
    expect(esFechaValida('2026-02-30')).toBe(false)
    expect(esFechaValida('2026-13-01')).toBe(false)
    expect(esFechaValida('2026-00-10')).toBe(false)
  })

  it('rechaza formatos que no son YYYY-MM-DD', () => {
    expect(esFechaValida('01/10/2026')).toBe(false)
    expect(esFechaValida('2026-10-01T00:00:00.000Z')).toBe(false)
    expect(esFechaValida('')).toBe(false)
  })
})
