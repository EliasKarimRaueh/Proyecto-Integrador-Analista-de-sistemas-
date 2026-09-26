import { describe, expect, it } from 'vitest'
import {
  armarPayloadPrecio,
  normalizarPrecio,
  vacioPrecioDraft,
  validarPrecio,
} from '../src/features/precios/precios'
import {
  armarPayloadActualizacion,
  armarPayloadOferta,
  estadoOferta,
  normalizarDetalle,
  normalizarOfertaProducto,
  validarOferta,
  vacioOfertaDraft,
  type Oferta,
  type OfertaDraft,
  type OfertaProductoApi,
} from '../src/features/ofertas/ofertas'
import { fechaInputDesdeHoy } from '../src/shared/lib/money'

describe('normalizarPrecio', () => {
  it('convierte el productoId a número', () => {
    const precio = normalizarPrecio({
      id: '7',
      productoId: '42',
      precioMinorista: '10.00',
      precioMayorista: null,
      fechaDesde: '2026-01-01T00:00:00.000Z',
      fechaHasta: null,
      vigente: true,
      activo: true,
      fechaBaja: null,
    })

    expect(precio.productoId).toBe(42)
  })
})

describe('validarPrecio', () => {
  it('acepta un precio minorista con coma decimal', () => {
    const errors = validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '4500,50' })
    expect(errors).toEqual({})
  })

  it('deja el mayorista vacío porque es opcional', () => {
    const errors = validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '4500' })
    expect(errors.precioMayorista).toBeUndefined()
  })

  it('exige el precio minorista', () => {
    const errors = validarPrecio(vacioPrecioDraft(1))
    expect(errors.precioMinorista).toBe('Ingresá el precio minorista.')
  })

  it('rechaza un mayorista más caro que el minorista', () => {
    const errors = validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '4000', precioMayorista: '4500' })
    expect(errors.precioMayorista).toBe('El precio mayorista no puede superar al minorista.')
  })

  it('rechaza separadores de miles porque son ambiguos', () => {
    const errors = validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '1.500' })
    expect(errors.precioMinorista).toContain('con hasta 2 decimales')
  })

  it('rechaza el cero y los negativos', () => {
    expect(validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '0' }).precioMinorista).toBe('El precio minorista debe ser mayor a cero.')
    expect(validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '-10' }).precioMinorista).toBeDefined()
  })

  it('rechaza una fecha imposible', () => {
    const errors = validarPrecio({ ...vacioPrecioDraft(1), precioMinorista: '100', fechaDesde: '2026-02-31' })
    expect(errors.fechaDesde).toBe('Ingresá una fecha válida.')
  })

  it('rechaza un producto inexistente', () => {
    expect(validarPrecio({ ...vacioPrecioDraft(0), precioMinorista: '100' }).productoId).toBe('El producto no es válido.')
  })
})

describe('armarPayloadPrecio', () => {
  it('manda los montos como texto y el mayorista vacío como null', () => {
    const payload = armarPayloadPrecio({ ...vacioPrecioDraft(3), precioMinorista: '1200', precioMayorista: '1100,5' })
    expect(payload).toEqual({ productoId: 3, precioMinorista: '1200.00', precioMayorista: '1100.50', fechaDesde: undefined })
  })

  it('omite la fecha cuando el backend la decide', () => {
    const payload = armarPayloadPrecio({ ...vacioPrecioDraft(3), precioMinorista: '1200', fechaDesde: '2026-10-01' })
    expect(payload?.fechaDesde).toBe('2026-10-01')
  })

  it('devuelve null si algo no pasó la validación', () => {
    expect(armarPayloadPrecio({ ...vacioPrecioDraft(3), precioMinorista: 'abc' })).toBeNull()
  })
})

describe('normalización de ofertas', () => {
  const productoApi: OfertaProductoApi = {
    productoId: '9',
    codigo: 'POL-009',
    nombre: 'Pechuga',
    unidadVenta: 'kg',
    stockActual: 12,
    precioOferta: '3800.00',
    activo: true,
  }

  it('convierte productoId a número en el detalle', () => {
    expect(normalizarOfertaProducto(productoApi).productoId).toBe(9)
    const detalle = normalizarDetalle({
      id: '1', nombre: 'O', descripcion: null,
      fechaInicio: '2026-01-01T00:00:00.000Z', fechaFin: '2026-01-31T00:00:00.000Z',
      vigente: true, activo: true, fechaBaja: null,
      productos: [productoApi],
    })
    expect(detalle.productos[0].productoId).toBe(9)
  })
})

describe('estadoOferta', () => {
  const base: Oferta = {
    id: '1',
    nombre: 'Oferta',
    descripcion: null,
    fechaInicio: '2026-01-01T00:00:00.000Z',
    fechaFin: '2026-01-31T00:00:00.000Z',
    vigente: false,
    activo: true,
    fechaBaja: null,
  }

  it('distingue vigente, programada, vencida y dada de baja', () => {
    expect(estadoOferta({ ...base, vigente: true })).toBe('vigente')
    expect(estadoOferta({ ...base, fechaInicio: fechaInputDesdeHoy(5) })).toBe('programada')
    expect(estadoOferta({ ...base, fechaInicio: '2020-01-01T00:00:00.000Z' })).toBe('vencida')
    expect(estadoOferta({ ...base, vigente: true, activo: false })).toBe('baja')
  })
})

describe('validarOferta', () => {
  function draft(extra: Partial<OfertaDraft> = {}): OfertaDraft {
    return {
      ...vacioOfertaDraft(),
      nombre: 'Finde',
      ...extra,
    }
  }

  function conProducto(precio = '3800'): OfertaDraft {
    return draft({
      productos: [{ productoId: 1, productoNombre: 'Suprema', productoCodigo: 'POL-001', unidadVenta: 'kg', precioOferta: precio }],
    })
  }

  it('acepta una oferta completa', () => {
    expect(validarOferta(conProducto())).toEqual({})
  })

  it('exige nombre, fechas y al menos un producto', () => {
    const errors = validarOferta(vacioOfertaDraft())
    expect(errors.nombre).toBeDefined()
    expect(errors.productos).toBe('Agregá al menos un producto a la oferta.')
  })

  it('exige que la fecha de fin sea posterior a la de inicio', () => {
    const errors = validarOferta(conProducto())
    expect(errors.fechaFin).toBeUndefined()

    const invertida = validarOferta(draft({
      fechaInicio: '2026-10-10',
      fechaFin: '2026-10-01',
      productos: [{ productoId: 1, productoNombre: 'Suprema', productoCodigo: 'POL-001', unidadVenta: 'kg', precioOferta: '3800' }],
    }))
    expect(invertida.fechaFin).toBe('La fecha de fin debe ser posterior a la fecha de inicio.')
  })

  it('detecta productos repetidos', () => {
    const producto = { productoId: 1, productoNombre: 'Suprema', productoCodigo: 'POL-001', unidadVenta: 'kg', precioOferta: '3800' }
    const errors = validarOferta(draft({ productos: [producto, { ...producto }] }))
    expect(errors.productos).toBe('Hay productos repetidos en la lista.')
  })

  it('reporta el precio inválido por producto', () => {
    const errors = validarOferta(conProducto('abc'))
    expect(errors.productosDetalle?.[1]).toContain('con hasta 2 decimales')
  })

  it('pide el precio de cada producto agregado', () => {
    const errors = validarOferta(conProducto(''))
    expect(errors.productosDetalle?.[1]).toBe('Ingresá el precio de oferta.')
  })
})

describe('payloads de ofertas', () => {
  it('arma el alta con productos y precios ya normalizados', () => {
    const payload = armarPayloadOferta({
      ...vacioOfertaDraft(),
      nombre: '  Finde  ',
      descripcion: '  promo  ',
      productos: [{ productoId: 1, productoNombre: 'Suprema', productoCodigo: 'POL-001', unidadVenta: 'kg', precioOferta: '3800,5' }],
    })

    expect(payload).toEqual({
      nombre: 'Finde',
      descripcion: 'promo',
      fechaInicio: fechaInputDesdeHoy(0),
      fechaFin: fechaInputDesdeHoy(7),
      productos: [{ productoId: 1, precioOferta: '3800.50' }],
    })
  })

  it('devuelve null si un precio no es válido', () => {
    expect(armarPayloadOferta({
      ...vacioOfertaDraft(),
      nombre: 'Finde',
      productos: [{ productoId: 1, productoNombre: 'S', productoCodigo: 'C', unidadVenta: 'kg', precioOferta: 'x' }],
    })).toBeNull()
  })

  it('la actualización no manda productos', () => {
    expect(armarPayloadActualizacion({ ...vacioOfertaDraft(), nombre: 'Nuevo' })).toEqual({
      nombre: 'Nuevo',
      descripcion: '',
      fechaInicio: fechaInputDesdeHoy(0),
      fechaFin: fechaInputDesdeHoy(7),
    })
  })
})
