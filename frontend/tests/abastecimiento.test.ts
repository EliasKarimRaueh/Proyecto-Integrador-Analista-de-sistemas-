import { describe, expect, it } from 'vitest'
import { datosLinea, validarLineas } from '../src/features/abastecimiento/calculos'
import type { Product } from '../src/features/products/products'

const productos: Product[] = [{ id: '1', code: 'P-001', name: 'Pollo', category: 'Fresco', unit: 'kg', description: '', active: true, unidadCompra: 'CAJONES', factorConversion: 20 }]
describe('cantidades y costos de abastecimiento', () => {
  it('convierte cajones y su costo a la cantidad y costo base que recibe la API', () => {
    const lineas = [{ productoId: '1', cantidad: '2', costo: '20000', unidad: 'COMPRA' as const }]
    expect(datosLinea(lineas[0], productos)).toMatchObject({ cantidadBase: 40, costoBase: 1000, subtotal: 40000 })
    expect(validarLineas(lineas, productos)[0]).toMatchObject({ productoId: 1, cantidad: 40, costoUnitario: '1000.00', cantidadPresentacion: 2, factorConversion: 20 })
  })
  it('acepta pesaje decimal y conserva los centavos del costo base', () => {
    expect(validarLineas([{ productoId: '1', cantidad: '12,375', costo: '1000,25', unidad: 'VENTA' }], productos)[0]).toMatchObject({ cantidad: 12.375, costoUnitario: '1000.25' })
  })
  it('rechaza duplicados, cantidades negativas y costos inválidos', () => {
    const linea = { productoId: '1', cantidad: '1', costo: '10', unidad: 'VENTA' as const }
    expect(() => validarLineas([linea, linea], productos)).toThrow('No repitas')
    expect(() => validarLineas([{ ...linea, cantidad: '-1' }], productos)).toThrow('positivas')
    expect(() => validarLineas([{ ...linea, costo: '1.001' }], productos)).toThrow('dos decimales')
  })
  it('impide fracciones de unidades y productos inactivos', () => {
    const linea = { productoId: '1', cantidad: '0.5', costo: '10', unidad: 'VENTA' as const }
    expect(() => validarLineas([linea], [{ ...productos[0], unit: 'unidad' }])).toThrow('enteras')
    expect(() => validarLineas([linea], [{ ...productos[0], active: false }])).toThrow('activos')
  })
})
