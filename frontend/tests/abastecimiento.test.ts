import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { datosLinea, validarLineas } from '../src/features/abastecimiento/calculos'
import { FormularioAbastecimiento, timestampParaEnvio } from '../src/features/abastecimiento/FormularioAbastecimiento'
import type { Product } from '../src/features/products/products'
import type { Proveedor } from '../src/features/proveedores/proveedores'
import { hoyComoFechaInput } from '../src/shared/lib/money'

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
}

const productos: Product[] = [{ id: '1', code: 'P-001', name: 'Pollo', category: 'Fresco', unit: 'kg', description: '', active: true, unidadCompra: 'CAJONES', factorConversion: 20 }]

const proveedores: Proveedor[] = [{
  id: 5,
  nombre: 'Distribuidora Sur',
  cuil: null,
  telefono: null,
  email: null,
  direccion: null,
  diasEntrega: [],
  descripcion: null,
  ctaCte: true,
  activo: true,
  fechaBaja: null,
}]

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

describe('timestampParaEnvio (Bug 1)', () => {
  it('genera timestamp ISO dinámico y nunca termina en T12:00:00-03:00', () => {
    const ts = timestampParaEnvio(hoyComoFechaInput())
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(ts).not.toContain('T12:00:00-03:00')
  })

  it('respeta fecha pasada combinándola con la hora actual', () => {
    const ts = timestampParaEnvio('2026-05-15')
    const parsed = new Date(ts)
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(4) // Mayo (0-indexed)
    expect(parsed.getDate()).toBe(15)
  })
})

describe('FormularioAbastecimiento - Bloqueo de pedido en compra (Bug 2)', () => {
  beforeEach(() => {
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/productos')) return json(productos)
      if (url.includes('/productos')) return json([{ productoId: 1, activo: true }])
      return json([])
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('bloquea producto, unidad y cantidad cuando es compra desde pedido pero mantiene editable el costo y comprobante', async () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(FormularioAbastecimiento, {
          modo: 'compra',
          inicio: {
            proveedorId: 5,
            pedidoId: 42,
            lineas: [{ productoId: '1', cantidad: '3', costo: '150.00', unidad: 'VENTA' }],
          },
          proveedores,
          onClose: () => {},
          onGuardado: () => {},
        })
      )
    )

    // Proveedor bloqueado
    const selectProveedor = screen.getByLabelText('Proveedor') as HTMLSelectElement
    expect(selectProveedor.disabled).toBe(true)

    // Mensaje informativo presente
    expect(screen.getByText(/Los productos y cantidades están bloqueados según el pedido #42/)).toBeTruthy()

    // Producto, unidad y cantidad bloqueados
    const selectProducto = screen.getByLabelText('Producto 1') as HTMLSelectElement
    expect(selectProducto.disabled).toBe(true)

    const selectUnidad = screen.getByLabelText('Medir producto 1 en') as HTMLSelectElement
    expect(selectUnidad.disabled).toBe(true)

    const inputCantidad = screen.getByLabelText('Cantidad producto 1') as HTMLInputElement
    expect(inputCantidad.disabled).toBe(true)

    // Costo por presentación editable
    const inputCosto = screen.getByLabelText('Costo producto 1') as HTMLInputElement
    expect(inputCosto.disabled).toBe(false)

    // Comprobante y fecha editables
    const inputFecha = screen.getByLabelText('Fecha') as HTMLInputElement
    expect(inputFecha.disabled).toBe(false)
    const selectTipo = screen.getByLabelText('Tipo de comprobante') as HTMLSelectElement
    expect(selectTipo.disabled).toBe(false)
    const inputNumero = screen.getByLabelText('Número de comprobante') as HTMLInputElement
    expect(inputNumero.disabled).toBe(false)

    // Botones Quitar producto y Agregar producto ocultos
    expect(screen.queryByRole('button', { name: /Quitar producto/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar producto' })).toBeNull()
  })

  it('permite modificar producto, unidad, cantidad y agregar líneas cuando es compra directa (sin pedido)', async () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(FormularioAbastecimiento, {
          modo: 'compra',
          inicio: {
            proveedorId: 5,
            lineas: [{ productoId: '1', cantidad: '3', costo: '150.00', unidad: 'VENTA' }],
          },
          proveedores,
          onClose: () => {},
          onGuardado: () => {},
        })
      )
    )

    // Proveedor desbloqueado
    const selectProveedor = screen.getByLabelText('Proveedor') as HTMLSelectElement
    expect(selectProveedor.disabled).toBe(false)

    // No debe mostrar el aviso de pedido bloqueado
    expect(screen.queryByText(/Los productos y cantidades están bloqueados/)).toBeNull()

    // Producto, unidad y cantidad desbloqueados
    const selectProducto = screen.getByLabelText('Producto 1') as HTMLSelectElement
    expect(selectProducto.disabled).toBe(false)

    const selectUnidad = screen.getByLabelText('Medir producto 1 en') as HTMLSelectElement
    expect(selectUnidad.disabled).toBe(false)

    const inputCantidad = screen.getByLabelText('Cantidad producto 1') as HTMLInputElement
    expect(inputCantidad.disabled).toBe(false)

    // Botones Quitar y Agregar producto visibles
    expect(screen.getByRole('button', { name: /Quitar producto 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar producto' })).toBeTruthy()
  })
})
