import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/compraRepository', () => require('./mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('./mocks/cuentaProveedorRepository.js'));
jest.mock('polleria-database/repositories/detalleCompraRepository', () => require('./mocks/detalleCompraRepository.js'));
jest.mock('../../database/src/repositories/pedidoRepository.js', () => require('./mocks/pedidoRepository.js'));
jest.mock('../../database/src/repositories/detallePedidoRepository.js', () => require('./mocks/detallePedidoRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('./mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/productoProveedorRepository', () => require('./mocks/productoProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('./mocks/proveedorRepository.js'));

import { postCompra } from '../src/controllers/compraController.js';
import { validarDetallesConPedido } from '../src/services/comprasCalculos.js';
import { ErrorOperacion } from '../src/services/operaciones.js';
import { instancia as compraRepo } from './mocks/compraRepository.js';
import { instancia as cuentaRepo } from './mocks/cuentaProveedorRepository.js';
import { instancia as detalleCompraRepo } from './mocks/detalleCompraRepository.js';
import { instancia as pedidoRepo } from './mocks/pedidoRepository.js';
import { instancia as detallePedidoRepo } from './mocks/detallePedidoRepository.js';
import { instancia as productoRepo } from './mocks/productoRepository.js';
import { instancia as relacionRepo } from './mocks/productoProveedorRepository.js';
import { instancia as proveedorRepo } from './mocks/proveedorRepository.js';
import { crearReq, crearRes } from './helpers/http.js';
import { usarTransaccionFalsa } from './helpers/transaccion.js';

function mockProducto(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    codigo: `P-${id}`,
    nombre: `Producto ${id}`,
    unidadCompra: 'KILOS',
    unidadVenta: 'KILOS',
    factorConversion: 1,
    stockActual: 10,
    stockMinimo: 5,
    costoActual: '100.00',
    activo: true,
    ...overrides,
  };
}

function mockCompra(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    proveedorId: 5,
    pedidoId: null,
    tipoComprobante: 'FACTURA',
    numeroComprobante: 'A-1',
    estado: 'PENDIENTE_RECEPCION',
    total: '200.00',
    fechaHora: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

describe('Adversarial Stress Suite - Bug 2 Validation Logic & Contracts', () => {
  beforeEach(() => {
    usarTransaccionFalsa();
    proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, nombre: 'Distribuidora Central', activo: true, ctaCte: true });
    productoRepo.findById.mockImplementation(async (id: number) => mockProducto(id));
    compraRepo.crear.mockResolvedValue(mockCompra());
    compraRepo.findBy.mockResolvedValue(null);
    detalleCompraRepo.crearMuchos.mockImplementation(async (items: any[]) => items.map((it, idx) => ({ id: idx + 1, ...it })));
    cuentaRepo.crear.mockResolvedValue({ id: 1, proveedorId: 5, compraId: 7, importePendiente: '200.00' });
    pedidoRepo.buscarPorIdConBloqueo.mockResolvedValue({ id: 3, proveedorId: 5, estado: 'REALIZADO' });
    relacionRepo.findByRelation.mockImplementation(async (productoId: number, proveedorId: number) => ({
      productoId,
      proveedorId,
      activo: true,
    }));
  });

  // =========================================================================
  // 1. UNIT-LEVEL ADVERSARIAL TESTING: validarDetallesConPedido
  // =========================================================================
  describe('Unit: validarDetallesConPedido pure function stress', () => {
    it('Scenario 1.1: Permuted line orders with 4 items must pass', () => {
      const lineasCompra = [
        { productoId: 40, cantidadBase: 4.5 },
        { productoId: 10, cantidadBase: 1.0 },
        { productoId: 30, cantidadBase: 3.25 },
        { productoId: 20, cantidadBase: 2.0 },
      ];
      const detallesPedido = [
        { productoId: 10, cantidad: 1.0 },
        { productoId: 20, cantidad: 2.0 },
        { productoId: 30, cantidad: 3.25 },
        { productoId: 40, cantidad: 4.5 },
      ];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 1.2: Permuted line orders with reversed lists must pass', () => {
      const lineasCompra = [
        { productoId: 20, cantidadBase: 10 },
        { productoId: 10, cantidadBase: 5 },
      ];
      const detallesPedido = [
        { productoId: 10, cantidad: 5 },
        { productoId: 20, cantidad: 10 },
      ];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 2.1: Floating point drift (0.1 + 0.2 vs 0.3) must pass', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 0.1 + 0.2 }];
      const detallesPedido = [{ productoId: 10, cantidad: 0.3 }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 2.2: Floating point drift (2.333 vs 2.3330000000000001) must pass', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 2.333 }];
      const detallesPedido = [{ productoId: 10, cantidad: 2.3330000000000001 }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 2.3: Difference within tolerance (diff = 0.0009) behavior depending on base', () => {
      // With base 2: 2.0009 rounds to 2.001, diff is 0.0009999999999998899 <= 0.001 -> PASSES
      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 2.0009 }],
        [{ productoId: 10, cantidad: 2.0000 }]
      )).not.toThrow();

      // With base 5: 5.0009 rounds to 5.001, diff is 0.001000000000000334.
      // With redondearCantidad fix, this now consistently passes without throwing!
      const throwsAtBase5 = (() => {
        try {
          validarDetallesConPedido(
            [{ productoId: 10, cantidadBase: 5.0009 }],
            [{ productoId: 10, cantidad: 5.0000 }]
          );
          return false;
        } catch (e) {
          return true;
        }
      })();
      expect(throwsAtBase5).toBe(false);
      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 5.0009 }],
        [{ productoId: 10, cantidad: 5.0000 }]
      )).not.toThrow();
    });

    it('Scenario 2.4: Difference exactly at tolerance (diff = 0.001) across various integer bases', () => {
      // Test base 10 (diff = 0.0009999999999994458 <= 0.001)
      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 10.001 }],
        [{ productoId: 10, cantidad: 10.000 }]
      )).not.toThrow();

      // Test base 5 (diff = 0.001000000000000334).
      // With redondearCantidad fix, drift is neutralized and base 5 passes without throwing!
      const throwsAtBase5 = (() => {
        try {
          validarDetallesConPedido(
            [{ productoId: 10, cantidadBase: 5.001 }],
            [{ productoId: 10, cantidad: 5.000 }]
          );
          return false;
        } catch (e) {
          return true;
        }
      })();
      expect(throwsAtBase5).toBe(false);
      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 5.001 }],
        [{ productoId: 10, cantidad: 5.000 }]
      )).not.toThrow();

      // Test base 4 (another previously drifting base: 4.001 - 4.000 = 0.001000000000000334)
      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 4.001 }],
        [{ productoId: 10, cantidad: 4.000 }]
      )).not.toThrow();

      // Verify that differences > 0.001 (e.g., 5.002 vs 5.000, 4.002 vs 4.000) STILL reliably throw ErrorOperacion
      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 5.002 }],
        [{ productoId: 10, cantidad: 5.000 }]
      )).toThrow('La cantidad del producto 10 (5.002) no coincide con la solicitada en el pedido (5).');

      expect(() => validarDetallesConPedido(
        [{ productoId: 10, cantidadBase: 4.002 }],
        [{ productoId: 10, cantidad: 4.000 }]
      )).toThrow('La cantidad del producto 10 (4.002) no coincide con la solicitada en el pedido (4).');
    });

    it('Scenario 6.1: Duplicate product entries in lineasCompra when calling validarDetallesConPedido', () => {
      // Compra has two lines of product 10 with quantities 2 and 5 (total 7)
      // Pedido has one line of product 10 with quantity 5
      const lineasCompra = [
        { productoId: 10, cantidadBase: 2 },
        { productoId: 10, cantidadBase: 5 },
      ];
      const detallesPedido = [
        { productoId: 10, cantidad: 5 },
      ];
      // Note: validarDetallesConPedido silently overwrites duplicates in lineasCompraMap because it does not check Map size.
      // However, registrarCompra guards against this in normalizarLineas (see Scenario B).
      let threw = false;
      try {
        validarDetallesConPedido(lineasCompra, detallesPedido);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    it('Scenario 6.2: Duplicate product entries in detallesPedido when calling validarDetallesConPedido', () => {
      // Pedido has two lines of product 10 with quantities 2 and 5 (total 7)
      // Compra has one line of product 10 with quantity 5
      const lineasCompra = [
        { productoId: 10, cantidadBase: 5 },
      ];
      const detallesPedido = [
        { productoId: 10, cantidad: 2 },
        { productoId: 10, cantidad: 5 },
      ];
      // Note: validarDetallesConPedido silently overwrites duplicates in detallePedidoMap because it does not check Map size.
      // However, registrarPedido guards against this in lineasPedido.
      let threw = false;
      try {
        validarDetallesConPedido(lineasCompra, detallesPedido);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    it('Scenario 2.5: Difference exceeding tolerance (diff = 0.0011) must be rejected', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 5.002 }];
      const detallesPedido = [{ productoId: 10, cantidad: 5.000 }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).toThrow(ErrorOperacion);
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).toThrow(
        'La cantidad del producto 10 (5.002) no coincide con la solicitada en el pedido (5).'
      );
    });

    it('Scenario 2.6: Negative difference exceeding tolerance (compra 4.998 vs pedido 5.000) must be rejected', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 4.998 }];
      const detallesPedido = [{ productoId: 10, cantidad: 5.000 }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).toThrow(
        'La cantidad del producto 10 (4.998) no coincide con la solicitada en el pedido (5).'
      );
    });

    it('Scenario 3.1: Extra product in multi-item compra must be rejected', () => {
      const lineasCompra = [
        { productoId: 10, cantidadBase: 5 },
        { productoId: 20, cantidadBase: 3 },
        { productoId: 99, cantidadBase: 1 },
      ];
      const detallesPedido = [
        { productoId: 10, cantidad: 5 },
        { productoId: 20, cantidad: 3 },
      ];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).toThrow(
        'El producto 99 no pertenece al pedido.'
      );
    });

    it('Scenario 3.2: Missing product in multi-item compra must be rejected', () => {
      const lineasCompra = [
        { productoId: 10, cantidadBase: 5 },
      ];
      const detallesPedido = [
        { productoId: 10, cantidad: 5 },
        { productoId: 20, cantidad: 3 },
      ];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).toThrow(
        'Falta el producto 20 solicitado en el pedido.'
      );
    });

    it('Scenario 4.1: Extreme quantities (large numbers: 1,000,000) must pass if matching', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 1000000.5 }];
      const detallesPedido = [{ productoId: 10, cantidad: 1000000.5 }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 4.2: Small fractional quantities (0.001) must pass if matching', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 0.001 }];
      const detallesPedido = [{ productoId: 10, cantidad: '0.001' }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 4.3: String quantities in pedido with spaces or formatting must pass', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 12.5 }];
      const detallesPedido = [{ productoId: 10, cantidad: ' 12.500 ' }];
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedido)).not.toThrow();
    });

    it('Scenario 5.1: Pedido detail with null or undefined productoId must be rejected with 400', () => {
      const lineasCompra = [{ productoId: 10, cantidadBase: 5 }];
      const detallesPedidoNull = [{ productoId: null, cantidad: 5 }];
      const detallesPedidoUndef = [{ productoId: undefined as any, cantidad: 5 }];

      expect(() => validarDetallesConPedido(lineasCompra, detallesPedidoNull)).toThrow(
        'El pedido contiene un detalle sin producto asociado.'
      );
      expect(() => validarDetallesConPedido(lineasCompra, detallesPedidoUndef)).toThrow(
        'El pedido contiene un detalle sin producto asociado.'
      );
    });
  });

  // =========================================================================
  // 2. CONTROLLER / SERVICE INTEGRATION ADVERSARIAL TESTING: postCompra
  // =========================================================================
  describe('Integration: postCompra adversarial scenarios', () => {
    it('Scenario A: Permuted lines in compra correctly links numeroItemPedido for each item', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2 },
        { numeroItem: 2, pedidoId: 3, productoId: 20, cantidad: 5 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-PERM-01',
          pedidoId: 3,
          detalles: [
            { productoId: 20, cantidad: 5, costoUnitario: 50 }, // reversed!
            { productoId: 10, cantidad: 2, costoUnitario: 100 },
          ],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ pedidoId: 3, total: '450.00' }),
        expect.anything()
      );
      expect(detalleCompraRepo.crearMuchos).toHaveBeenCalledWith([
        expect.objectContaining({
          compraId: 7,
          productoId: 20,
          numeroItem: 1,
          pedidoId: 3,
          numeroItemPedido: 2, // correctly refers to item 2 of pedido
          cantidad: 5,
          subtotal: '250.00',
        }),
        expect.objectContaining({
          compraId: 7,
          productoId: 10,
          numeroItem: 2,
          pedidoId: 3,
          numeroItemPedido: 1, // correctly refers to item 1 of pedido
          cantidad: 2,
          subtotal: '200.00',
        }),
      ], expect.anything());
    });

    it('Scenario B: Duplicate products in compra payload must be rejected with 400', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 4 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-DUP-01',
          pedidoId: 3,
          detalles: [
            { productoId: 10, cantidad: 2, costoUnitario: 50 },
            { productoId: 10, cantidad: 2, costoUnitario: 50 },
          ],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No se puede repetir el mismo producto en la compra.',
      });
    });

    it('Scenario C: Modified unit costs are accepted and correctly calculate new total', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 3 },
      ]);
      const res = crearRes();

      // Pedido estimated cost might have been 100, but now actual cost is 175.50
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-COST-01',
          pedidoId: 3,
          detalles: [{ productoId: 10, cantidad: 3, costoUnitario: 175.50 }],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ pedidoId: 3, total: '526.50' }),
        expect.anything()
      );
    });

    it('Scenario D: Zero unit cost (promotional/free sample item) is accepted', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'REMITO',
          numeroComprobante: 'REM-FREE-01',
          pedidoId: 3,
          detalles: [{ productoId: 10, cantidad: 2, costoUnitario: 0 }],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ pedidoId: 3, total: '0.00' }),
        expect.anything()
      );
    });

    it('Scenario E: Extra product added to pedido compra is rejected with 400', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-EXTRA-01',
          pedidoId: 3,
          detalles: [
            { productoId: 10, cantidad: 2, costoUnitario: 100 },
            { productoId: 15, cantidad: 1, costoUnitario: 80 }, // extra!
          ],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El producto 15 no pertenece al pedido.',
      });
    });

    it('Scenario F: Missing product from pedido compra is rejected with 400', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2 },
        { numeroItem: 2, pedidoId: 3, productoId: 20, cantidad: 5 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-MISS-01',
          pedidoId: 3,
          detalles: [
            { productoId: 10, cantidad: 2, costoUnitario: 100 },
            // producto 20 omitted!
          ],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Falta el producto 20 solicitado en el pedido.',
      });
    });

    it('Scenario G: Quantity alteration (> 0.001) in pedido compra is rejected with 400', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2.0 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-QTY-01',
          pedidoId: 3,
          detalles: [
            { productoId: 10, cantidad: 2.005, costoUnitario: 100 },
          ],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'La cantidad del producto 10 (2.005) no coincide con la solicitada en el pedido (2).',
      });
    });

    it('Scenario H: Quantity within 0.001 tolerance (e.g. 2.0008) is accepted with 201', async () => {
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2.0 },
      ]);
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-TOL-01',
          pedidoId: 3,
          detalles: [
            { productoId: 10, cantidad: 2.0008, costoUnitario: 100 },
          ],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('Scenario I: Purchases WITHOUT pedidoId remain completely unaffected', async () => {
      const res = crearRes();

      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-DIRECT-01',
          // pedidoId omitted!
          detalles: [
            { productoId: 99, cantidad: 10, costoUnitario: 120 },
          ],
        },
      }), res);

      // Verify that pedido repos were NEVER called
      expect(pedidoRepo.buscarPorIdConBloqueo).not.toHaveBeenCalled();
      expect(detallePedidoRepo.buscarPorPedido).not.toHaveBeenCalled();

      // Verify compra was created with pedidoId = null
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ pedidoId: null, total: '1200.00' }),
        expect.anything()
      );

      // Verify detalles were created with pedidoId = null and numeroItemPedido = null
      expect(detalleCompraRepo.crearMuchos).toHaveBeenCalledWith([
        expect.objectContaining({
          compraId: 7,
          productoId: 99,
          pedidoId: null,
          numeroItemPedido: null,
          cantidad: 10,
          subtotal: '1200.00',
        }),
      ], expect.anything());

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('Scenario J: Conversion from presentación to base quantity matches pedido base quantity', async () => {
      // Pedido requested 6 units base
      detallePedidoRepo.buscarPorPedido.mockResolvedValue([
        { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 6 },
      ]);
      // Product has factorConversion: 3 (e.g., box of 3 units)
      productoRepo.findById.mockImplementation(async (id: number) => mockProducto(id, { factorConversion: 3 }));
      const res = crearRes();

      // User buys 2 boxes at $300 per box -> base qty = 2 * 3 = 6, unit cost = 300 / 3 = 100
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'INV-PRES-01',
          pedidoId: 3,
          detalles: [{
            productoId: 10,
            cantidadPresentacion: 2,
            costoPresentacion: 300,
            presentacion: 'CAJA',
            factorConversion: 3,
          }],
        },
      }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(detalleCompraRepo.crearMuchos).toHaveBeenCalledWith([
        expect.objectContaining({
          productoId: 10,
          cantidad: 6,
          importeUnitario: '100.00',
          subtotal: '600.00',
          presentacion: 'CAJA',
          cantidadPresentacion: 2,
          factorConversion: 3,
        }),
      ], expect.anything());
    });
  });
});
