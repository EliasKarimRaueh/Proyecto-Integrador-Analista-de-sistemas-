import { describe, expect, it } from 'vitest'
import { fechaInputOferta } from '../src/features/ofertas/fechasOfertas'
import { resumenOfertaCaja } from '../src/features/sales/promocionesCaja'
import type { OfertaConProductos } from '../src/features/ofertas/ofertas'
import type { Precio } from '../src/features/precios/precios'

const oferta: OfertaConProductos = { id: '1', nombre: 'Tres kilos', descripcion: '', activo: true, vigente: true, fechaBaja: null, fechaInicio: '2026-11-03', fechaFin: null, descuentoPorcentaje: '10', productos: [{ productoId: 1, codigo: 'OCULTO', nombre: 'Pollo', unidadVenta: 'KILOS', stockActual: 10, precioOferta: '1500', cantidad: 3, activo: true }] }
const precios = [{ productoId: 1, precioMinorista: '1000', precioMayorista: '800' }] as Precio[]
describe('caja y vigencias abiertas', () => {
  it('cobra el precio final explícito en ambas listas, sin depender de los precios de lista', () => {
    const fija = { ...oferta, precioFinal: '2500.25', descuentoPorcentaje: null }
    expect(resumenOfertaCaja(fija, [], 'MINORISTA')?.total).toBe(2500.25)
    expect(resumenOfertaCaja(fija, precios, 'MAYORISTA')?.total).toBe(2500.25)
  })
  it('aplica el descuento a la cantidad pactada y respeta la lista elegida', () => {
    expect(resumenOfertaCaja(oferta, precios, 'MINORISTA')).toEqual({ subtotal: 3000, descuento: 300, total: 2700 })
    expect(resumenOfertaCaja(oferta, precios, 'MAYORISTA')).toEqual({ subtotal: 2400, descuento: 240, total: 2160 })
  })
  it('mantiene el precio fijo legado sin multiplicarlo por kilos', () => {
    expect(resumenOfertaCaja({ ...oferta, descuentoPorcentaje: null }, [], 'MINORISTA')?.total).toBe(1500)
    expect(resumenOfertaCaja(oferta, [], 'MINORISTA')).toBeNull()
  })
  it('muestra el último día de la oferta en el calendario argentino', () => {
    expect(fechaInputOferta('2026-11-04T02:59:59.999Z')).toBe('2026-11-03')
    expect(fechaInputOferta('2026-11-03T03:00:00.000Z')).toBe('2026-11-03')
    expect(fechaInputOferta(null)).toBe('')
  })
  it('conserva los días del catálogo antiguo guardados en medianoche UTC', () => {
    expect(fechaInputOferta('2026-11-03T00:00:00.000Z')).toBe('2026-11-03')
  })
})
