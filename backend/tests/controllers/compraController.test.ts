import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/compraRepository', () => require('../mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('../mocks/cuentaProveedorRepository.js'));
jest.mock('polleria-database/repositories/detalleCompraRepository', () => require('../mocks/detalleCompraRepository.js'));
jest.mock('../../../database/src/repositories/pedidoRepository.js', () => require('../mocks/pedidoRepository.js'));
jest.mock('../../../database/src/repositories/detallePedidoRepository.js', () => require('../mocks/detallePedidoRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/productoProveedorRepository', () => require('../mocks/productoProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));

import {
  getCompras,
  getCompraById,
  getReposicion,
  postCompra,
} from '../../src/controllers/compraController.js';
import { instancia as compraRepo } from '../mocks/compraRepository.js';
import { instancia as cuentaRepo } from '../mocks/cuentaProveedorRepository.js';
import { instancia as detalleCompraRepo } from '../mocks/detalleCompraRepository.js';
import { instancia as pedidoRepo } from '../mocks/pedidoRepository.js';
import { instancia as detallePedidoRepo } from '../mocks/detallePedidoRepository.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { instancia as relacionRepo } from '../mocks/productoProveedorRepository.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';

function compra(overrides: Record<string, unknown> = {}) {
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

function producto(overrides: Record<string, unknown> = {}) {
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

const DETALLE_VALIDO = [{ productoId: 10, cantidad: 2, costoUnitario: 100 }];

beforeEach(() => {
  usarTransaccionFalsa();
  proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, nombre: 'Distribuidora Sur', activo: true, ctaCte: true });
  productoRepo.findById.mockResolvedValue(producto());
  compraRepo.crear.mockResolvedValue(compra());
  compraRepo.findBy.mockResolvedValue(null);
  compraRepo.listarConFiltros.mockResolvedValue({ rows: [compra()], count: 1 });
  compraRepo.buscarDetalleCompleto.mockResolvedValue(compra({ cuentaProveedor: { id: 1, compraId: 7 } }));
  compraRepo.buscarPorId.mockResolvedValue(compra());
  detalleCompraRepo.crearMuchos.mockResolvedValue([{ id: 1, compraId: 7, productoId: 10 }]);
  cuentaRepo.crear.mockResolvedValue({ id: 1, proveedorId: 5, compraId: 7, importePendiente: '200.00' });
  pedidoRepo.buscarPorIdConBloqueo.mockResolvedValue({ id: 3, proveedorId: 5, estado: 'REALIZADO' });
  detallePedidoRepo.buscarPorPedido.mockResolvedValue([{ numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2 }]);
  productoRepo.buscarParaReposicion.mockResolvedValue({ rows: [producto()], count: 1 });
  relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
  relacionRepo.getProveedoresActivosPorProductos.mockResolvedValue(new Map([
    [10, [{ id: 5, nombre: 'Distribuidora Sur' }]],
  ]));
});

describe('postCompra', () => {
  it('calcula el total en el servidor y crea compra, detalles y cuenta', async () => {
    const transaccion = usarTransaccionFalsa();
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-1',
        total: 999,
        detalles: DETALLE_VALIDO,
      },
    }), res);

    expect(compraRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        estado: 'PENDIENTE_RECEPCION',
        total: '200.00',
      }),
      transaccion,
    );
    expect(detalleCompraRepo.crearMuchos).toHaveBeenCalledWith(
      [expect.objectContaining({ compraId: 7, productoId: 10, cantidad: 2, subtotal: '200.00' })],
      transaccion,
    );
    expect(cuentaRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ compraId: 7, importePendiente: '200.00' }),
      transaccion,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('registra la compra asociada a un pedido realizado', async () => {
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-2',
        pedidoId: 3,
        detalles: DETALLE_VALIDO,
      },
    }), res);

    expect(pedidoRepo.buscarPorIdConBloqueo).toHaveBeenCalledWith(3, expect.anything());
    expect(detallePedidoRepo.buscarPorPedido).toHaveBeenCalledWith(3, expect.anything());
    expect(compraRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoId: 3 }),
      expect.anything(),
    );
    expect(detalleCompraRepo.crearMuchos).toHaveBeenCalledWith(
      [expect.objectContaining({ compraId: 7, productoId: 10, pedidoId: 3, numeroItemPedido: 1 })],
      expect.anything(),
    );
  });

  it('rechaza una compra de pedido si el pedido no tiene detalles registrados', async () => {
    detallePedidoRepo.buscarPorPedido.mockResolvedValue([]);
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-2',
        pedidoId: 3,
        detalles: DETALLE_VALIDO,
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'El pedido no tiene detalles registrados.' });
  });

  it('rechaza una compra de pedido si se agrega un producto que no pertenece al pedido', async () => {
    productoRepo.findById.mockImplementation(async (id: number) => producto({ id }));
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 11, proveedorId: 5, activo: true });
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-2',
        pedidoId: 3,
        detalles: [
          { productoId: 10, cantidad: 2, costoUnitario: 100 },
          { productoId: 11, cantidad: 1, costoUnitario: 50 },
        ],
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El producto 11 no pertenece al pedido.' });
  });

  it('rechaza una compra de pedido si falta un producto solicitado en el pedido', async () => {
    detallePedidoRepo.buscarPorPedido.mockResolvedValue([
      { numeroItem: 1, pedidoId: 3, productoId: 10, cantidad: 2 },
      { numeroItem: 2, pedidoId: 3, productoId: 11, cantidad: 1 },
    ]);
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-2',
        pedidoId: 3,
        detalles: [{ productoId: 10, cantidad: 2, costoUnitario: 100 }],
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Falta el producto 11 solicitado en el pedido.' });
  });

  it('rechaza una compra de pedido si la cantidad no coincide con la del pedido', async () => {
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-2',
        pedidoId: 3,
        detalles: [{ productoId: 10, cantidad: 5, costoUnitario: 100 }],
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La cantidad del producto 10 (5) no coincide con la solicitada en el pedido (2).',
    });
  });

  it('permite registrar compra de pedido modificando costos unitarios', async () => {
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-2',
        pedidoId: 3,
        detalles: [{ productoId: 10, cantidad: 2, costoUnitario: 150 }],
      },
    }), res);

    expect(compraRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoId: 3, total: '300.00' }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('acepta fecha en formato YYYY-MM-DD combinando con la hora actual', async () => {
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-20',
        fechaHora: '2026-11-20',
        detalles: DETALLE_VALIDO,
      },
    }), res);

    expect(compraRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaHora: expect.any(Date),
      }),
      expect.anything(),
    );
    const llamada = (compraRepo.crear as jest.Mock).mock.calls[0][0];
    expect(llamada.fechaHora.getFullYear()).toBe(2026);
    expect(llamada.fechaHora.getMonth()).toBe(10); // Noviembre (0-indexed)
    expect(llamada.fechaHora.getDate()).toBe(20);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responde 404 si el proveedor no existe', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();

    await postCompra(crearReq({
      body: { proveedorId: 5, tipoComprobante: 'FACTURA', numeroComprobante: 'A-3', detalles: DETALLE_VALIDO },
    }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Proveedor no encontrado.' });
  });

  it('rechaza un tipo de comprobante inválido', async () => {
    const res = crearRes();
    await postCompra(crearReq({ body: { proveedorId: 5, tipoComprobante: 'TICKET', detalles: DETALLE_VALIDO } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El tipo de comprobante no es válido.' });
  });

  it('rechaza una fecha inválida', async () => {
    const res = crearRes();
    await postCompra(crearReq({
      body: { proveedorId: 5, tipoComprobante: 'FACTURA', numeroComprobante: 'A-7', fechaHora: 'no-es-fecha', detalles: DETALLE_VALIDO },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La fecha de la compra no es válida.' });
  });

  it('exige detalles', async () => {
    const res = crearRes();
    await postCompra(crearReq({ body: { proveedorId: 5, tipoComprobante: 'FACTURA', numeroComprobante: 'A-4' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Debe indicar entre 1 y 100 detalles.' });
  });

  it('rechaza productos repetidos', async () => {
    const res = crearRes();
    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-5',
        detalles: [DETALLE_VALIDO[0], DETALLE_VALIDO[0]],
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No se puede repetir el mismo producto en la compra.' });
  });

  it('rechaza un pedido de otro proveedor', async () => {
    pedidoRepo.buscarPorIdConBloqueo.mockResolvedValue({ id: 3, proveedorId: 9, estado: 'PENDIENTE' });
    const res = crearRes();

    await postCompra(crearReq({
      body: { proveedorId: 5, tipoComprobante: 'FACTURA', numeroComprobante: 'A-6', pedidoId: 3, detalles: DETALLE_VALIDO },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El pedido pertenece a otro proveedor.' });
  });

  it('rechaza un pedido que ya no está pendiente', async () => {
    pedidoRepo.buscarPorIdConBloqueo.mockResolvedValue({ id: 3, proveedorId: 5, estado: 'FACTURADO' });
    const res = crearRes();

    await postCompra(crearReq({
      body: { proveedorId: 5, tipoComprobante: 'FACTURA', numeroComprobante: 'A-6', pedidoId: 3, detalles: DETALLE_VALIDO },
    }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('exige que el producto esté asociado al proveedor', async () => {
    relacionRepo.findByRelation.mockResolvedValue(null);
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-1',
        detalles: DETALLE_VALIDO,
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El producto 10 no está asociado al proveedor.',
    });
  });

  it('rechaza una relación inactiva con el proveedor', async () => {
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: false });
    const res = crearRes();

    await postCompra(crearReq({
      body: {
        proveedorId: 5,
        tipoComprobante: 'FACTURA',
        numeroComprobante: 'A-1',
        detalles: DETALLE_VALIDO,
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El producto 10 no está asociado al proveedor.',
    });
  });
});

describe('getCompras', () => {
  it('lista con filtros y cabecera de total', async () => {
    const res = crearRes();
    await getCompras(crearReq({ query: { proveedorId: '5', estado: 'RECIBIDA' } }), res);

    expect(compraRepo.listarConFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorId: 5, estado: 'RECIBIDA' }),
      1,
      50,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
    expect(res.json).toHaveBeenCalledWith([compra()]);
  });

  it('responde 400 con un rango de fechas inválido', async () => {
    const res = crearRes();
    await getCompras(crearReq({ query: { fechaDesde: '2026-12-31', fechaHasta: '2026-01-01' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El rango de fechas es inválido.' });
  });
});

describe('getCompraById', () => {
  it('devuelve la compra con su cuenta', async () => {
    const res = crearRes();
    await getCompraById(crearReq({ params: { id: '7' } }), res);

    expect(res.json).toHaveBeenCalledWith({
      compra: compra({ cuentaProveedor: { id: 1, compraId: 7 } }),
      cuenta: { id: 1, compraId: 7 },
    });
  });

  it('responde 404 si la compra no existe', async () => {
    compraRepo.buscarDetalleCompleto.mockResolvedValue(null);
    const res = crearRes();
    await getCompraById(crearReq({ params: { id: '7' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Compra no encontrada.' });
  });

  it('rechaza un id inválido', async () => {
    const res = crearRes();
    await getCompraById(crearReq({ params: { id: '0' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getReposicion', () => {
  it('devuelve productos con faltante y proveedores', async () => {
    const res = crearRes();
    await getReposicion(crearReq(), res);

    expect(productoRepo.buscarParaReposicion).toHaveBeenCalledWith({
      proveedorId: undefined,
      incluirProximos: false,
      q: undefined,
      page: 1,
      limit: 50,
    });
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 10,
        faltante: 3,
        cantidadSugerida: 3,
        estado: 'Crítico',
        proveedores: [{ id: 5, nombre: 'Distribuidora Sur' }],
      }),
    ]);
  });

  it('respeta incluirProximos, q y proveedorId', async () => {
    const res = crearRes();
    await getReposicion(crearReq({ query: { proveedorId: '5', incluirProximos: 'true', q: 'pollo' } }), res);

    expect(productoRepo.buscarParaReposicion).toHaveBeenCalledWith({
      proveedorId: 5,
      incluirProximos: true,
      q: 'pollo',
      page: 1,
      limit: 50,
    });
  });

  it('rechaza q no textual', async () => {
    const res = crearRes();
    await getReposicion(crearReq({ query: { q: ['pollo'] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
