import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/compraRepository', () => require('./mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('./mocks/cuentaProveedorRepository.js'));
jest.mock('polleria-database/repositories/detalleCompraRepository', () => require('./mocks/detalleCompraRepository.js'));
jest.mock('../../database/src/repositories/pedidoRepository.js', () => require('./mocks/pedidoRepository.js'));
jest.mock('../../database/src/repositories/detallePedidoRepository.js', () => require('./mocks/detallePedidoRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('./mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/productoProveedorRepository', () => require('./mocks/productoProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('./mocks/proveedorRepository.js'));

import { postPedido } from '../src/controllers/pedidoController.js';
import { postCompra } from '../src/controllers/compraController.js';
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

function mockProducto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    codigo: 'P-001',
    nombre: 'Pollo entero',
    unidadCompra: 'KILOS',
    unidadVenta: 'KILOS',
    factorConversion: 1,
    stockActual: 2,
    stockMinimo: 5,
    costoActual: '100.00',
    activo: true,
    ...overrides,
  };
}

function mockProveedor(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    nombre: 'Distribuidora Sur',
    activo: true,
    ctaCte: true,
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
    fechaHora: new Date(),
    ...overrides,
  };
}

function mockPedido(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    proveedorId: 5,
    estado: 'REALIZADO',
    totalEstimado: '200.00',
    fechaHora: new Date(),
    ...overrides,
  };
}

const DETALLES_PEDIDO_BODY = [{ productoId: 10, cantidad: 2, costoEstimado: 100 }];
const DETALLES_COMPRA_BODY = [{ productoId: 10, cantidad: 2, costoUnitario: 100 }];

describe('Adversarial Stress Testing: Timestamp Logic (Bug 1)', () => {
  beforeEach(() => {
    usarTransaccionFalsa();
    proveedorRepo.buscarPorId.mockResolvedValue(mockProveedor());
    productoRepo.findById.mockResolvedValue(mockProducto());
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
    pedidoRepo.crear.mockResolvedValue(mockPedido());
    detallePedidoRepo.crearMuchos.mockResolvedValue([{ id: 1, pedidoId: 3, productoId: 10 }]);
    compraRepo.crear.mockResolvedValue(mockCompra());
    detalleCompraRepo.crearMuchos.mockResolvedValue([{ id: 1, compraId: 7, productoId: 10 }]);
    cuentaRepo.crear.mockResolvedValue({ id: 1, compraId: 7, estado: 'PAGO PENDIENTE' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- 1. Missing, undefined, null, or empty string dates ---
  describe('Missing, undefined, null, and empty date handling', () => {
    it('defaults to current time when fechaHora is omitted (undefined)', async () => {
      const fixedNow = new Date('2026-11-13T14:35:22.500Z');
      jest.useFakeTimers({ now: fixedNow });

      const resPedido = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, detalles: DETALLES_PEDIDO_BODY } }), resPedido);
      expect(resPedido.status).toHaveBeenCalledWith(201);
      expect(pedidoRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHora: fixedNow }),
        expect.anything()
      );

      const resCompra = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-101',
          detalles: DETALLES_COMPRA_BODY,
        },
      }), resCompra);
      expect(resCompra.status).toHaveBeenCalledWith(201);
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHora: fixedNow }),
        expect.anything()
      );
    });

    it('defaults to current time when fechaHora is null', async () => {
      const fixedNow = new Date('2026-11-13T09:12:34.123Z');
      jest.useFakeTimers({ now: fixedNow });

      const resPedido = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: null, detalles: DETALLES_PEDIDO_BODY } }), resPedido);
      expect(resPedido.status).toHaveBeenCalledWith(201);
      expect(pedidoRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHora: fixedNow }),
        expect.anything()
      );

      const resCompra = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-102',
          fechaHora: null,
          detalles: DETALLES_COMPRA_BODY,
        },
      }), resCompra);
      expect(resCompra.status).toHaveBeenCalledWith(201);
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHora: fixedNow }),
        expect.anything()
      );
    });

    it('defaults to current time when fechaHora is an empty string', async () => {
      const fixedNow = new Date('2026-11-13T18:45:00.000Z');
      jest.useFakeTimers({ now: fixedNow });

      const resPedido = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '', detalles: DETALLES_PEDIDO_BODY } }), resPedido);
      expect(resPedido.status).toHaveBeenCalledWith(201);
      expect(pedidoRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHora: fixedNow }),
        expect.anything()
      );

      const resCompra = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-103',
          fechaHora: '',
          detalles: DETALLES_COMPRA_BODY,
        },
      }), resCompra);
      expect(resCompra.status).toHaveBeenCalledWith(201);
      expect(compraRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHora: fixedNow }),
        expect.anything()
      );
    });
  });

  // --- 2. Never hardcoded to 12:00:00 or 12:00 PM ---
  describe('Absence of hardcoded 12:00:00 timestamp', () => {
    it('records the dynamic seconds and minutes, never hardcoding 12:00:00', async () => {
      const randomTimes = [
        new Date('2026-03-10T08:14:27.456Z'),
        new Date('2026-07-22T19:42:59.999Z'),
        new Date('2026-12-31T23:59:58.123Z'),
        new Date('2026-01-01T00:00:02.001Z'),
      ];

      for (const t of randomTimes) {
        jest.useFakeTimers({ now: t });
        const resPedido = crearRes();
        await postPedido(crearReq({ body: { proveedorId: 5, detalles: DETALLES_PEDIDO_BODY } }), resPedido);
        const lastPedidoCall = pedidoRepo.crear.mock.calls[pedidoRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
        expect(lastPedidoCall.fechaHora.getTime()).toBe(t.getTime());
        expect(lastPedidoCall.fechaHora.toISOString()).not.toContain('12:00:00.000');
      }
    });
  });

  // --- 3. Leap day handling (2024 vs 2025 vs 2026) ---
  describe('Leap day edge cases (YYYY-MM-DD)', () => {
    it('accepts valid leap day 2024-02-29 and 2000-02-29', async () => {
      // 2024 is a leap year
      const res2024 = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2024-02-29', detalles: DETALLES_PEDIDO_BODY } }), res2024);
      expect(res2024.status).toHaveBeenCalledWith(201);
      const call2024 = pedidoRepo.crear.mock.calls[pedidoRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call2024.fechaHora.getDate()).toBe(29);
      expect(call2024.fechaHora.getMonth()).toBe(1); // February (0-indexed)
      expect(call2024.fechaHora.getFullYear()).toBe(2024);

      // 2000 is a century leap year
      const res2000 = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-2000',
          fechaHora: '2000-02-29',
          detalles: DETALLES_COMPRA_BODY,
        },
      }), res2000);
      expect(res2000.status).toHaveBeenCalledWith(201);
      const call2000 = compraRepo.crear.mock.calls[compraRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call2000.fechaHora.getDate()).toBe(29);
      expect(call2000.fechaHora.getMonth()).toBe(1);
      expect(call2000.fechaHora.getFullYear()).toBe(2000);
    });

    it('rejects invalid leap day 2025-02-29 with 400 Bad Request', async () => {
      const resPedido = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2025-02-29', detalles: DETALLES_PEDIDO_BODY } }), resPedido);
      expect(resPedido.status).toHaveBeenCalledWith(400);
      expect(resPedido.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'La fecha del pedido no es válida.' }));

      const resCompra = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-2025',
          fechaHora: '2025-02-29',
          detalles: DETALLES_COMPRA_BODY,
        },
      }), resCompra);
      expect(resCompra.status).toHaveBeenCalledWith(400);
      expect(resCompra.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'La fecha de la compra no es válida.' }));
    });

    it('rejects invalid leap day 2026-02-29 and century non-leap 1900-02-29', async () => {
      const res2026 = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2026-02-29', detalles: DETALLES_PEDIDO_BODY } }), res2026);
      expect(res2026.status).toHaveBeenCalledWith(400);

      const res1900 = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '1900-02-29', detalles: DETALLES_PEDIDO_BODY } }), res1900);
      expect(res1900.status).toHaveBeenCalledWith(400);
    });
  });

  // --- 4. Month day boundaries (30-day vs 31-day months) ---
  describe('Month day boundaries (YYYY-MM-DD)', () => {
    it('rejects day 31 for 30-day months (April, June, September, November)', async () => {
      const invalidDates = ['2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31'];
      for (const d of invalidDates) {
        const res = crearRes();
        await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: d, detalles: DETALLES_PEDIDO_BODY } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'La fecha del pedido no es válida.' }));
      }
    });

    it('rejects day 30 for February', async () => {
      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2026-02-30', detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('accepts day 31 for 31-day months (January, March, May, July, August, October, December)', async () => {
      const validDates = ['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31'];
      for (const d of validDates) {
        const res = crearRes();
        await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: d, detalles: DETALLES_PEDIDO_BODY } }), res);
        expect(res.status).toHaveBeenCalledWith(201);
        const lastCall = pedidoRepo.crear.mock.calls[pedidoRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
        expect(lastCall.fechaHora.getDate()).toBe(31);
      }
    });
  });

  // --- 5. ISO strings with different timezone offsets ---
  describe('ISO strings with explicit timezone offsets', () => {
    it('accepts UTC timestamps ending in Z', async () => {
      const res = crearRes();
      const isoZ = '2026-06-15T18:30:00.000Z';
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: isoZ, detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const call = pedidoRepo.crear.mock.calls[pedidoRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call.fechaHora.toISOString()).toBe(isoZ);
    });

    it('accepts Argentina offset (-03:00)', async () => {
      const res = crearRes();
      const isoAR = '2026-06-15T15:30:00.000-03:00';
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-AR',
          fechaHora: isoAR,
          detalles: DETALLES_COMPRA_BODY,
        },
      }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const call = compraRepo.crear.mock.calls[compraRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call.fechaHora.toISOString()).toBe(new Date(isoAR).toISOString());
    });

    it('accepts Asian offset (+05:30)', async () => {
      const res = crearRes();
      const isoAsia = '2026-06-16T00:00:00.000+05:30';
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: isoAsia, detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const call = pedidoRepo.crear.mock.calls[pedidoRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call.fechaHora.toISOString()).toBe(new Date(isoAsia).toISOString());
    });
  });

  // --- 6. Midnight boundary testing (23:59:59 and 00:00:01) ---
  describe('Midnight boundary submissions (23:59:59 and 00:00:01)', () => {
    it('handles submission at 23:59:59 with date-only input correctly', async () => {
      const midnightEve = new Date('2026-11-13T23:59:59.999-03:00');
      jest.useFakeTimers({ now: midnightEve });

      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2026-05-15', detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const call = pedidoRepo.crear.mock.calls[pedidoRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call.fechaHora.getDate()).toBe(15);
      expect(call.fechaHora.getMonth()).toBe(4); // May
    });

    it('handles submission at 00:00:01 with date-only input correctly', async () => {
      const midnightPast = new Date('2026-11-14T00:00:01.001-03:00');
      jest.useFakeTimers({ now: midnightPast });

      const res = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-MIDNIGHT',
          fechaHora: '2026-08-20',
          detalles: DETALLES_COMPRA_BODY,
        },
      }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const call = compraRepo.crear.mock.calls[compraRepo.crear.mock.calls.length - 1][0] as { fechaHora: Date };
      expect(call.fechaHora.getDate()).toBe(20);
      expect(call.fechaHora.getMonth()).toBe(7); // August
    });
  });

  // --- 7. Malformed and invalid inputs ---
  describe('Malformed and invalid input dates', () => {
    it('rejects "invalid" string with 400 Bad Request', async () => {
      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: 'invalid', detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'La fecha del pedido no es válida.' }));
    });

    it('rejects string "null" with 400 Bad Request', async () => {
      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: 'null', detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects plain object {} with 400 Bad Request', async () => {
      const res = crearRes();
      await postCompra(crearReq({
        body: {
          proveedorId: 5,
          tipoComprobante: 'FACTURA',
          numeroComprobante: 'FC-OBJ',
          fechaHora: {},
          detalles: DETALLES_COMPRA_BODY,
        },
      }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects whitespace-only string "   " with 400 Bad Request', async () => {
      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '   ', detalles: DETALLES_PEDIDO_BODY } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('VULNERABILITY DEMO: invalid month 00 (e.g. 2026-00-15) currently bypasses validation and creates order', async () => {
      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2026-00-15', detalles: DETALLES_PEDIDO_BODY } }), res);
      // BUG: Should be 400 Bad Request, but currently returns 201 because fecha() only checks getDate() !== dia
      // without verifying mes >= 1 && mes <= 12 or getMonth() === mes - 1.
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('VULNERABILITY DEMO: invalid month 13 (e.g. 2026-13-01) currently bypasses validation and creates order', async () => {
      const res = crearRes();
      await postPedido(crearReq({ body: { proveedorId: 5, fechaHora: '2026-13-01', detalles: DETALLES_PEDIDO_BODY } }), res);
      // BUG: Should be 400 Bad Request, but currently returns 201 because fecha() shifts month 13 to next year (2027-01-01)
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('VULNERABILITY DEMO: date-only input under UTC server timezone shifts to previous day in Buenos Aires between 00:00-02:59 UTC', () => {
      // Simulating a backend server running in UTC at 01:30:00Z (22:30 in Argentina on Nov 13)
      const ahoraUtc = new Date('2026-11-14T01:30:00.000Z');
      const [anio, mes, dia] = '2026-05-15'.split('-').map(Number);
      
      const resultado = new Date(ahoraUtc);
      resultado.setUTCFullYear(anio, mes - 1, dia);
      
      // When formatted in America/Argentina/Buenos_Aires (UTC-3):
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      const formattedDate = formatter.format(resultado);
      
      // BUG: Instead of 2026-05-15, it rolls back to 2026-05-14!
      expect(formattedDate).toBe('2026-05-14');
    });
  });
});
