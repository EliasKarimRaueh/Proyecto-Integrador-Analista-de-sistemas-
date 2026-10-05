// OJO: `jest` NO se importa desde '@jest/globals' a propósito. Hacerlo rompe el
// hoisting de jest.mock() que hace @swc/jest, los imports estáticos corren antes
// de los jest.mock() y el módulo real se carga. Ver app.test.ts.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/models/Producto', () => require('../mocks/modelos.js').ProductoModel);
jest.mock('polleria-database/models/Oferta', () => require('../mocks/modelos.js').OfertaModel);
jest.mock('polleria-database/models/Venta', () => require('../mocks/modelos.js').VentaModel);
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
jest.mock('polleria-database/repositories/detalleVentaRepository', () => require('../mocks/detalleVentaRepository.js'));
jest.mock('polleria-database/repositories/ofertaProductoRepository', () => require('../mocks/ofertaProductoRepository.js'));
jest.mock('polleria-database/repositories/precioRepository', () => require('../mocks/precioRepository.js'));

import { buscarProductos, bloquear, fraccionar, registrarMovimiento, vender } from '../../src/services/operaciones.js';
import { Op } from 'sequelize';
import { usarTransaccionFalsa, type TransaccionFalsa } from '../helpers/transaccion.js';
import { sequelize } from '../mocks/configDatabase.js';
import { ProductoModel, OfertaModel, VentaModel } from '../mocks/modelos.js';
import { instancia as movimientosRepo } from '../mocks/movimientoStockRepository.js';
import { instancia as detallesRepo } from '../mocks/detalleVentaRepository.js';
import { instancia as ofertasRepo } from '../mocks/ofertaProductoRepository.js';
import { instancia as preciosRepo } from '../mocks/precioRepository.js';

// registrarMovimiento, fraccionar y vender son las tres operaciones que abren
// transacción y mueven stock. El doble de config/database devuelve una transacción
// falsa, así que la prueba real es doble: ¿se/secuencia todo dentro del callback
// transaccional, y la referencia de la transacción llega hasta los repositorios?
//
// randomUUID no se mockea: se extrae el operacionId de una llamada y se verifica
// que las demás lo reutilicen, que es lo que importa para poder correlacionar un
// desposte en la UI.

const AHORA = new Date('2026-06-15T12:00:00.000Z');
const INICIO = new Date('2026-01-01T00:00:00.000Z');
const FIN = new Date('2026-12-31T00:00:00.000Z');

function producto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    nombre: 'Pollo entero',
    unidadVenta: 'KILOS',
    stockActual: 50,
    margenStock: 5,
    activo: true,
    ...overrides,
  };
}

function oferta(overrides: Record<string, unknown> = {}) {
  return { id: 7, nombre: 'Promo pollo', activo: true, fechaInicio: INICIO, fechaFin: FIN, ...overrides };
}

let transaccion: TransaccionFalsa;
let catalogo: Map<number, Record<string, unknown>>;

beforeEach(() => {
  transaccion = usarTransaccionFalsa();
  catalogo = new Map();
  // findByPk resuelve contra el mapa del test, y devuelve null si el producto no
  // está: ese null es lo que dispara el 404 de bloquear().
  ProductoModel.findByPk.mockImplementation(
    async (id: number) => (catalogo.get(id) ?? null) as never,
  );

  movimientosRepo.registrarIngreso.mockResolvedValue({ id: 100 } as never);
  movimientosRepo.registrarEgreso.mockResolvedValue({ id: 101 } as never);
  movimientosRepo.ajustarStock.mockResolvedValue({ id: 102 } as never);
  detallesRepo.create.mockImplementation(async (d: { numeroItem: number }) => ({ id: d.numeroItem }) as never);
  VentaModel.create.mockResolvedValue({ id: 55 } as never);
});

describe('bloquear', () => {

  it('ordena y deduplica los ids antes de bloquear', async () => {
    // El orden estable evita dos transacciones acquires en orden distinto y hace
    // que un deadlock entre ventas concurrentes sea reproducible.
    catalogo.set(3, producto({ id: 3 }));
    catalogo.set(1, producto({ id: 1 }));

    const productos = await bloquear([3, 1, 3], transaccion as never);

    expect([...productos.keys()]).toEqual([1, 3]);
    expect(ProductoModel.findByPk).toHaveBeenNthCalledWith(1, 1, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE,
    });
    expect(ProductoModel.findByPk).toHaveBeenNthCalledWith(2, 3, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE,
    });
  });

  it('responde 404 si falta algún producto del lote', async () => {
    catalogo.set(1, producto({ id: 1 }));
    await expect(bloquear([1, 99], transaccion as never)).rejects.toThrow('Producto 99 no encontrado.');
  });
});

describe('registrarMovimiento', () => {

  const cuerpo = (overrides: Record<string, unknown> = {}) => ({
    productoId: 10,
    tipo: 'INGRESO',
    motivo: 'Compra a proveedor',
    // OJO: el campo del cuerpo es cantMovimiento, no cantidad. `cantidad` es el
    // nombre del mensaje de error de numero(), no el nombre de la entrada.
    cantMovimiento: 5,
    ...overrides,
  });

  it('registra un ingreso con la descripción tipada', async () => {
    catalogo.set(10, producto());
    await registrarMovimiento(cuerpo());

    expect(movimientosRepo.registrarIngreso).toHaveBeenCalledWith(
      10, 5, 1, 'INGRESO: Compra a proveedor', null, transaccion,
    );
  });

  it('atribuye el movimiento al usuario informado', async () => {
    catalogo.set(10, producto());
    await registrarMovimiento(cuerpo({ usuarioId: 4, tipo: 'EGRESO' }));
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalledWith(
      10, 5, 4, 'EGRESO: Compra a proveedor', null, transaccion,
    );
  });

  it('trata AJUSTE_POSITIVO como ingreso y AJUSTE_NEGATIVO como egreso', async () => {
    catalogo.set(10, producto());
    await registrarMovimiento(cuerpo({ tipo: 'AJUSTE_POSITIVO' }));
    expect(movimientosRepo.registrarIngreso).toHaveBeenCalled();

    movimientosRepo.registrarIngreso.mockClear();
    await registrarMovimiento(cuerpo({ tipo: 'AJUSTE_NEGATIVO' }));
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalled();
  });

  it('un AJUSTE fija el stock objetivo en vez de mover una cantidad', async () => {
    catalogo.set(10, producto());
    await registrarMovimiento(
      cuerpo({ tipo: 'AJUSTE', cantMovimiento: 999, stockObjetivo: 12 }),
    );
    expect(movimientosRepo.ajustarStock).toHaveBeenCalledWith(
      10, 12, 1, 'AJUSTE: Compra a proveedor', transaccion,
    );
  });

  it('admite stockObjetivo cero pero rechaza una cantidad cero', async () => {
    // numero(..., cero=true) para AJUSTE: dejar el stock en 0 es una operación
    // válida, sacar 0 kilos no.
    catalogo.set(10, producto());
    await registrarMovimiento(cuerpo({ tipo: 'AJUSTE', cantMovimiento: 0, stockObjetivo: 0 }));
    expect(movimientosRepo.ajustarStock).toHaveBeenCalledWith(10, 0, 1, expect.any(String), transaccion);

    await expect(registrarMovimiento(cuerpo({ tipo: 'INGRESO', cantMovimiento: 0 }))).rejects.toThrow(
      'cantidad no es válido.',
    );
  });

  it('rechaza un tipo fuera del catálogo', async () => {
    await expect(registrarMovimiento(cuerpo({ tipo: 'ROBO' }))).rejects.toThrow('Tipo de movimiento inválido.');
  });

  it('bloquea el producto dentro de la transacción y propaga la referencia', async () => {
    catalogo.set(10, producto());
await registrarMovimiento(cuerpo());
    expect(ordenRelativo()).toEqual([
      'transaction',
      'Producto.findByPk',
      'movimientos.registrarIngreso',
    ]);
  });

  it('rechaza un egreso que excede el margen de stock permitido', async () => {
    // margenStock 5 y stockActual 50 toleran stock -5 como piso, así que hay que
    // sacar 56 para dejar -6 y cruzar el margen.
    catalogo.set(10, producto({ stockActual: 50, margenStock: 5 }));
    await expect(registrarMovimiento(cuerpo({ tipo: 'EGRESO', cantMovimiento: 56 }))).rejects.toThrow(
      'El movimiento supera el margen de stock permitido.',
    );
    expect(movimientosRepo.registrarEgreso).not.toHaveBeenCalled();
  });

  it('permite el ingreso aunque el margen no dé', async () => {
    catalogo.set(10, producto({ stockActual: 0, margenStock: 0 }));
    await registrarMovimiento(cuerpo({ tipo: 'INGRESO', cantidad: 100 }));
    expect(movimientosRepo.registrarIngreso).toHaveBeenCalled();
  });

  it('respeta un producto sin margen configurado', async () => {
    // margenStock null significa "sin tope": no hay que compararlo contra -null,
    // que en JS es 0 y rechazaría de más.
    catalogo.set(10, producto({ stockActual: 1, margenStock: null }));
    await registrarMovimiento(cuerpo({ tipo: 'EGRESO', cantidad: 500 }));
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalled();
  });

  it('rechaza mover un producto inactivo', async () => {
    catalogo.set(10, producto({ activo: false }));
    await expect(registrarMovimiento(cuerpo())).rejects.toThrow('El producto está inactivo.');
  });

  it('valida el cuerpo antes de abrir la transacción', async () => {
    // Abrir una transacción para un cuerpo inválido dejaría un BEGIN sin trabajo.
    await expect(registrarMovimiento(null)).rejects.toThrow('Se esperaba un objeto.');
    // id(b.productoId) no propaga el nombre del campo, así que el mensaje sale
    // siempre como "id ..." y no "productoId ...".
    await expect(registrarMovimiento(cuerpo({ productoId: 'abc' }))).rejects.toThrow('id no es válido.');
    await expect(registrarMovimiento(cuerpo({ productoId: {} }))).rejects.toThrow('id debe ser numérico.');
    await expect(registrarMovimiento(cuerpo({ motivo: '' }))).rejects.toThrow(
      'El motivo es obligatorio y admite hasta 250 caracteres.',
    );
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
});

describe('fraccionar', () => {

  const cuerpo = (overrides: Record<string, unknown> = {}) => ({
    productoOrigenId: 10,
    cantidadOrigen: 10,
    motivo: 'Desposte',
    // La conservación de masa es obligatoria: 8 al derivado + 2 de merma = 10.
    derivados: [{ productoId: 11, cantidad: 8 }],
    merma: 2,
    ...overrides,
  });

  beforeEach(() => {
    catalogo.set(10, producto({ id: 10 }));
    catalogo.set(11, producto({ id: 11 }));
  });

  it('descuenta el origen e ingresa cada derivado con el mismo operacionId', async () => {
    const resultado = await fraccionar(cuerpo());

    const egreso = movimientosRepo.registrarEgreso.mock.calls[0]!;
    const ingreso = movimientosRepo.registrarIngreso.mock.calls[0]!;
    expect(ordenRelativo()).toEqual([
      'transaction',
      'Producto.findByPk',
      'movimientos.registrarEgreso',
      'movimientos.registrarIngreso',
    ]);

    // El egreso al origen descuenta solo la parte que se transforma
    // (cantidadOrigen - merma); la merma sale en un segundo egreso aparte.
    expect(egreso[1]).toBe(8);
    expect(ingreso[1]).toBe(8);
    // El motivo lleva el operacionId para que el historial de stock se pueda
    // correlacionar con la operación.
    expect(egreso[3]).toMatch(/^DESP:[0-9a-f-]{36}:E Desposte$/);
    expect(ingreso[3]).toMatch(/^DESP:[0-9a-f-]{36}:I Desposte$/);
    expect((egreso[3] as string).split(':')[1]).toBe((ingreso[3] as string).split(':')[1]);
    expect(resultado.merma).toBe(2);
  });

  it('descuenta la merma en un segundo egreso sobre el mismo origen', async () => {
    // 6 al derivado + 4 de merma = 10: el egreso de transformación es de 6 y la
    // merma sale en un segundo egreso de 4 contra el mismo origen.
    await fraccionar(cuerpo({ derivados: [{ productoId: 11, cantidad: 6 }], merma: 4 }));
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalledTimes(2);
    expect(movimientosRepo.registrarEgreso.mock.calls[0]![1]).toBe(6);
    expect(movimientosRepo.registrarEgreso.mock.calls[1]![1]).toBe(4);
    expect(movimientosRepo.registrarEgreso.mock.calls[1]![3]).toMatch(/:M Desposte$/);
  });

  it('exige que derivados más merma igualen el origen', async () => {
    await expect(fraccionar(cuerpo({ derivados: [{ productoId: 11, cantidad: 5 }] }))).rejects.toThrow(
      'Origen debe coincidir con derivados más merma.',
    );
  });

  it('rechaza incluir el origen entre los derivados', async () => {
    await expect(
      fraccionar(cuerpo({ derivados: [{ productoId: 10, cantidad: 10 }] })),
    ).rejects.toThrow('Los derivados deben ser distintos entre sí y del origen.');
  });

  it('rechaza derivados repetidos', async () => {
    await expect(
      fraccionar(cuerpo({
        cantidadOrigen: 4,
        derivados: [{ productoId: 11, cantidad: 2 }, { productoId: 11, cantidad: 2 }],
      })),
    ).rejects.toThrow('Los derivados deben ser distintos entre sí y del origen.');
  });

  it('rechaza una merma igual o mayor que el origen', async () => {
    await expect(fraccionar(cuerpo({ merma: 10 }))).rejects.toThrow(
      'La merma debe ser menor a la cantidad de origen.',
    );
  });

  it('exige entre 1 y 100 derivados', async () => {
    for (const derivados of [[], 'no-array']) {
      await expect(fraccionar(cuerpo({ derivados }))).rejects.toThrow(
        'Debe indicar entre 1 y 100 derivados.',
      );
    }
    const demasiados = Array.from({ length: 101 }, (_, i) => ({ productoId: 100 + i, cantidad: 1 }));
    await expect(fraccionar(cuerpo({ derivados: demasiados }))).rejects.toThrow(
      'Debe indicar entre 1 y 100 derivados.',
    );
  });

  it('solo fracciona productos activos medidos en kilos', async () => {
    catalogo.set(11, producto({ id: 11, unidadVenta: 'UNIDADES' }));
    await expect(fraccionar(cuerpo())).rejects.toThrow(
      'El fraccionamiento requiere productos activos medidos en kilos.',
    );
  });

  it('rechaza un fraccionamiento que excede el margen', async () => {
    // margenStock 5 toleraba stock -5 como piso; con stock 4 y origen 10 el
    // resultado sería -6 y cruza el margen.
    catalogo.set(10, producto({ id: 10, stockActual: 4, margenStock: 5 }));
    await expect(fraccionar(cuerpo())).rejects.toThrow(
      'El fraccionamiento supera el margen de stock permitido.',
    );
  });
});

describe('vender', () => {

  const cuerpo = (overrides: Record<string, unknown> = {}) => ({
    detalles: [{ productoId: 10, cantidad: 2 }],
    ...overrides,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(AHORA);
    catalogo.set(10, producto());
    preciosRepo.findAllVigentes.mockResolvedValue([
      { productoId: 10, precioMinorista: '15.00', precioMayorista: '13.00' },
    ] as never);
  });

  // El reloj queda fijado en AHORA para que la oferta de 2026 esté vigente sin
  // depender de la fecha real en que corre la suite.
  afterAll(() => {
    jest.useRealTimers();
  });

  it('crea la venta, sus detalles y los egresos de stock', async () => {
    const resultado = await vender(cuerpo());

    expect(VentaModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ total: '30.00' }),
      { transaction: transaccion },
    );
    expect(detallesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ventaId: 55,
        numeroItem: 1,
        cantidad: 2,
        productoId: 10,
        ofertaId: null,
        nombre: 'Pollo entero',
        importeUnitario: 15,
        subtotal: 30,
      }),
      { transaction: transaccion },
    );
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalledWith(10, 2, 1, null, 55, transaccion);
    expect(resultado.venta).toEqual({ id: 55 });
  });

  it('usa el precio mayorista cuando la línea lo pide', async () => {
    await vender(cuerpo({ detalles: [{ productoId: 10, cantidad: 2, tipoPrecio: 'MAYORISTA' }] }));
    expect(detallesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ importeUnitario: 13, subtotal: 26 }),
      { transaction: transaccion },
    );
  });

  it('hereda el tipo de precio del cuerpo', async () => {
    await vender(cuerpo({ tipoPrecio: 'MAYORISTA' }));
    expect(detallesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ importeUnitario: 13 }),
      { transaction: transaccion },
    );
  });

  it('una cotización no persiste nada', async () => {
    // Es la diferencia entre simular y cobrar: la cotización devuelve los
    // importes calculados y no toca Venta ni DetalleVenta.
    const resultado = await vender(cuerpo(), true);

    expect(resultado).toEqual({
      total: '30.00',
      detalles: [expect.objectContaining({ importeUnitario: '15.00', subtotal: '30.00' })],
    });
    expect(VentaModel.create).not.toHaveBeenCalled();
    expect(detallesRepo.create).not.toHaveBeenCalled();
    expect(movimientosRepo.registrarEgreso).not.toHaveBeenCalled();
  });

  it('suma los consumos de varias líneas del mismo producto', async () => {
    // Dos líneas del mismo producto bloquean una sola vez y mueven el total.
    await vender(cuerpo({ detalles: [{ productoId: 10, cantidad: 2 }, { productoId: 10, cantidad: 3 }] }));

    expect(ProductoModel.findByPk).toHaveBeenCalledTimes(1);
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalledTimes(1);
    expect(movimientosRepo.registrarEgreso).toHaveBeenCalledWith(10, 5, 1, null, 55, transaccion);
    expect(VentaModel.create).toHaveBeenCalledWith(expect.objectContaining({ total: '75.00' }), { transaction: transaccion });
  });

  it('numera los detalles desde uno', async () => {
    catalogo.set(11, producto({ id: 11, nombre: 'Pechuga' }));
    preciosRepo.findAllVigentes.mockImplementation(async (ids: number[]) =>
      ids.map((id) => ({
        productoId: id,
        precioMinorista: id === 10 ? '15.00' : '20.00',
        precioMayorista: id === 10 ? '13.00' : '20.00',
      })) as never,
    );

    await vender(cuerpo({ detalles: [{ productoId: 10, cantidad: 1 }, { productoId: 11, cantidad: 1 }] }));

    const numeros = detallesRepo.create.mock.calls.map((c) => (c[0] as { numeroItem: number }).numeroItem);
    expect(numeros).toEqual([1, 2]);
    expect(VentaModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ total: '35.00' }),
      { transaction: transaccion },
    );
  });

  it('rechaza una línea con producto y oferta a la vez', async () => {
    await expect(
      vender(cuerpo({ detalles: [{ productoId: 10, ofertaId: 7, cantidad: 1 }] })),
    ).rejects.toThrow('Cada detalle requiere producto u oferta.');
  });

  it('rechaza una línea sin producto ni oferta', async () => {
    await expect(vender(cuerpo({ detalles: [{ cantidad: 1 }] }))).rejects.toThrow(
      'Cada detalle requiere producto u oferta.',
    );
  });

  it('exige entre 1 y 100 detalles', async () => {
    for (const detalles of [[], 'no-array']) {
      await expect(vender(cuerpo({ detalles }))).rejects.toThrow('Debe indicar entre 1 y 100 detalles.');
    }
    const demasiados = Array.from({ length: 101 }, () => ({ productoId: 10, cantidad: 1 }));
    await expect(vender(cuerpo({ detalles: demasiados }))).rejects.toThrow('Debe indicar entre 1 y 100 detalles.');
  });

  it('rechaza una lista de precios desconocida', async () => {
    await expect(vender(cuerpo({ tipoPrecio: 'INTERNA' }))).rejects.toThrow('Lista de precios inválida.');
  });

  it('exige exactamente un precio vigente', async () => {
    // Sin precio vigente no hay de dónde tomar el importe; con dos, cuál de los
    // dos cobrar sería arbitrario.
    preciosRepo.findAllVigentes.mockResolvedValue([] as never);
    await expect(vender(cuerpo())).rejects.toThrow('El producto debe tener exactamente un precio vigente.');

    preciosRepo.findAllVigentes.mockResolvedValue([
      { productoId: 10, precioMinorista: '15.00', precioMayorista: '13.00' },
      { productoId: 10, precioMinorista: '16.00', precioMayorista: '14.00' },
    ] as never);
    await expect(vender(cuerpo())).rejects.toThrow('El producto debe tener exactamente un precio vigente.');
  });

  it('rechaza una lista mayorista sin precio', async () => {
    preciosRepo.findAllVigentes.mockResolvedValue([
      { productoId: 10, precioMinorista: '15.00', precioMayorista: null },
    ] as never);
    await expect(vender(cuerpo({ tipoPrecio: 'MAYORISTA' }))).rejects.toThrow(
      'No hay precio mayorista vigente.',
    );
  });

  it('rechaza un precio no numérico', async () => {
    preciosRepo.findAllVigentes.mockResolvedValue([
      { productoId: 10, precioMinorista: 'mucho', precioMayorista: '13.00' },
    ] as never);
    await expect(vender(cuerpo())).rejects.toThrow('Precio inválido.');
  });

  it('rechaza stock insuficiente con el nombre del producto', async () => {
    // El margen de 5 con stock 3 tolera vender hasta 8: recién 10 cruza el piso.
    catalogo.set(10, producto({ stockActual: 3, margenStock: 5, nombre: 'Pollo entero' }));
    await expect(vender(cuerpo({ detalles: [{ productoId: 10, cantidad: 10 }] }))).rejects.toThrow(
      'Stock insuficiente para Pollo entero.',
    );
    expect(VentaModel.create).not.toHaveBeenCalled();
  });

  it('rechaza una cantidad fraccionaria en productos por unidad', async () => {
    catalogo.set(10, producto({ unidadVenta: 'UNIDADES' }));
    await expect(vender(cuerpo({ detalles: [{ productoId: 10, cantidad: 1.5 }] }))).rejects.toThrow(
      'Los productos por unidad requieren cantidades enteras.',
    );
  });

  it('cobra la oferta como la suma de sus componentes', async () => {
    catalogo.set(11, producto({ id: 11 }));
    OfertaModel.findByPk.mockResolvedValue(oferta() as never);
    ofertasRepo.listarDetalleProductos.mockResolvedValue([
      { producto: producto({ id: 10 }), relacion: { precioOferta: '10.00', cantidad: 2 } },
      { producto: producto({ id: 11 }), relacion: { precioOferta: '5.00', cantidad: 1 } },
    ] as never);

    const resultado = await vender(
      cuerpo({ detalles: [{ ofertaId: 7, cantidad: 1 }] }),
      true,
    );

    // precioOferta es el precio unitario ya calculado del componente dentro de la
    // oferta: la línea suma los precios (10.00 + 5.00 = 15.00) y NO los multiplica
    // por relacion.cantidad. Solo el CONSUMO de stock usa esa cantidad.
    expect(resultado).toEqual({
      total: '15.00',
      detalles: [expect.objectContaining({ nombre: 'Promo pollo', importeUnitario: '15.00' })],
    });
    expect(movimientosRepo.registrarEgreso).not.toHaveBeenCalled();
    expect(ofertasRepo.listarDetalleProductos).toHaveBeenCalledWith(7, true, transaccion);
    expect(OfertaModel.findByPk).toHaveBeenCalledWith(7, { transaction: transaccion, lock: transaccion.LOCK.SHARE });
  });

  it('exige cantidad entera al vender una oferta', async () => {
    await expect(
      vender(cuerpo({ detalles: [{ ofertaId: 7, cantidad: 1.5 }] })),
    ).rejects.toThrow('La cantidad de ofertas debe ser entera.');
  });

  it('rechaza una oferta no vigente', async () => {
    const casos: Array<Record<string, unknown>> = [
      { activo: false },
      { fechaInicio: new Date('2026-07-01T00:00:00.000Z') },
      { fechaFin: new Date('2026-01-02T00:00:00.000Z') },
    ];
    for (const overrides of casos) {
      OfertaModel.findByPk.mockResolvedValue(oferta(overrides) as never);
      await expect(vender(cuerpo({ detalles: [{ ofertaId: 7, cantidad: 1 }] }))).rejects.toThrow(
        'La oferta no está vigente.',
      );
    }
  });

  it('rechaza una oferta sin productos activos', async () => {
    OfertaModel.findByPk.mockResolvedValue(oferta() as never);
    ofertasRepo.listarDetalleProductos.mockResolvedValue([] as never);
    await expect(vender(cuerpo({ detalles: [{ ofertaId: 7, cantidad: 1 }] }))).rejects.toThrow(
      'La oferta no tiene productos activos.',
    );
  });

  it('valida la cantidad del componente antes de consumir', async () => {
    // cantidad de la línea por cantidad del componente: 2 x 0 daría 0, que
    // numero() rechaza porque exige > 0.
    OfertaModel.findByPk.mockResolvedValue(oferta() as never);
    ofertasRepo.listarDetalleProductos.mockResolvedValue([
      { producto: producto({ id: 10 }), relacion: { precioOferta: '10.00', cantidad: 0 } },
    ] as never);
    await expect(vender(cuerpo({ detalles: [{ ofertaId: 7, cantidad: 2 }] }))).rejects.toThrow(
      'cantidad del componente no es válido.',
    );
  });

  it('rechaza un total por encima del máximo permitido', async () => {
    // margenStock null desactiva el control de stock para llegar al cálculo del
    // importe; 200 x 99999999.99 excede el tope de 9999999999 centavos.
    catalogo.set(10, producto({ stockActual: 50, margenStock: null }));
    preciosRepo.findAllVigentes.mockResolvedValue([
      { productoId: 10, precioMinorista: '99999999.99', precioMayorista: '1.00' },
    ] as never);
    await expect(
      vender(cuerpo({ detalles: [{ productoId: 10, cantidad: 200 }] })),
    ).rejects.toThrow(/supera el máximo permitido/);
  });

  it('rechaza un cuerpo inválido antes de abrir la transacción', async () => {
    await expect(vender('nope')).rejects.toThrow('Se esperaba un objeto.');
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
});

describe('buscarProductos', () => {

  it('busca por código o nombre con iLike y ordena por nombre', async () => {
    await buscarProductos('pollo', 2, 10);

    expect(ProductoModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          activo: true,
          [Op.or]: [
            { codigo: { [Op.iLike]: '%pollo%' } },
            { nombre: { [Op.iLike]: '%pollo%' } },
          ],
        },
        order: [['nombre', 'ASC']],
        offset: 10,
        limit: 10,
      }),
    );
  });

  it('omite el filtro de texto cuando la búsqueda viene vacía', async () => {
    await buscarProductos('', 1, 50);

    const opciones = ProductoModel.findAndCountAll.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(opciones.where).toEqual({ activo: true });
  });
});

/**
 * Orden relativo de la ÚLTIMA llamada de cada colaborador, para afirmar que las
 * escrituras ocurren dentro de la transacción y después de bloquear el producto.
 * Se usa invocationCallOrder (monótono global de Jest) en vez de contar llamadas
 * porque clearMocks no reinicia ese contador.
 */
function ordenRelativo(): string[] {
  const ultimo = (mock: { mock: { invocationCallOrder: number[] } }): number => {
    const ordenes = mock.mock.invocationCallOrder;
    return ordenes.length ? ordenes[ordenes.length - 1]! : -1;
  };
  const marcas: Array<{ orden: number; nombre: string }> = [
    { orden: ultimo(sequelize.transaction), nombre: 'transaction' },
    { orden: ultimo(ProductoModel.findByPk), nombre: 'Producto.findByPk' },
    { orden: ultimo(movimientosRepo.registrarEgreso), nombre: 'movimientos.registrarEgreso' },
    { orden: ultimo(movimientosRepo.registrarIngreso), nombre: 'movimientos.registrarIngreso' },
    { orden: ultimo(movimientosRepo.ajustarStock), nombre: 'movimientos.ajustarStock' },
    { orden: ultimo(detallesRepo.create), nombre: 'detalles.create' },
    { orden: ultimo(VentaModel.create), nombre: 'Venta.create' },
  ];
  return marcas
    .filter((m) => m.orden >= 0)
    .sort((a, b) => a.orden - b.orden)
    .map((m) => m.nombre);
}