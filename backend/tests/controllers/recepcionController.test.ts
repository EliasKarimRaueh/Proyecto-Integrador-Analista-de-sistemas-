import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/compraRepository', () => require('../mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/detalleCompraRepository', () => require('../mocks/detalleCompraRepository.js'));
jest.mock('polleria-database/repositories/detalleRecepcionRepository', () => require('../mocks/detalleRecepcionRepository.js'));
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
jest.mock('polleria-database/repositories/pedidoCompraRepository', () => require('../mocks/pedidoCompraRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/recepcionRepository', () => require('../mocks/recepcionRepository.js'));

import {
  getRecepciones,
  getRecepcionById,
  postRecepcion,
} from '../../src/controllers/recepcionController.js';
import { instancia as compraRepo } from '../mocks/compraRepository.js';
import { instancia as detalleCompraRepo } from '../mocks/detalleCompraRepository.js';
import { instancia as detalleRecepcionRepo } from '../mocks/detalleRecepcionRepository.js';
import { instancia as movimientoRepo } from '../mocks/movimientoStockRepository.js';
import { instancia as pedidoRepo } from '../mocks/pedidoCompraRepository.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { instancia as recepcionRepo } from '../mocks/recepcionRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';

function compra(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    proveedorId: 5,
    pedidoId: 3,
    estado: 'PENDIENTE_RECEPCION',
    total: '200.00',
    ...overrides,
  };
}

function detalleCompra(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    compraId: 7,
    productoId: 10,
    cantidad: 20,
    costoUnitario: '10.00',
    ...overrides,
  };
}

beforeEach(() => {
  usarTransaccionFalsa();
  compraRepo.buscarPorIdConBloqueo.mockResolvedValue(compra());
  compraRepo.actualizar.mockResolvedValue(compra({ estado: 'RECIBIDA' }));
  detalleCompraRepo.buscarPorCompra.mockResolvedValue([detalleCompra()]);
  productoRepo.findById.mockResolvedValue({
    id: 10,
    nombre: 'Pollo',
    activo: true,
    unidadCompra: 'CAJONES',
    factorConversion: 10,
  });
  productoRepo.updateCosto.mockResolvedValue({ id: 10, costoActual: '10.00' });
  recepcionRepo.buscarPorCompra.mockResolvedValue(null);
  recepcionRepo.crear.mockResolvedValue({ id: 9, compraId: 7, proveedorId: 5, pedidoId: 3 });
  recepcionRepo.listar.mockResolvedValue({ rows: [{ id: 9 }], count: 1 });
  recepcionRepo.buscarPorId.mockResolvedValue({ id: 9, compraId: 7, detalles: [] });
  detalleRecepcionRepo.crearMuchos.mockResolvedValue([{ id: 1, recepcionId: 9, productoId: 10 }]);
  movimientoRepo.registrarIngreso.mockResolvedValue({ id: 1, recepcionId: 9 });
  pedidoRepo.actualizarEstado.mockResolvedValue({ id: 3, estado: 'RECIBIDO' });
});

describe('postRecepcion', () => {
  it('registra recepción, detalles, stock y costos en una transacción', async () => {
    const transaccion = usarTransaccionFalsa();
    const res = crearRes();

    await postRecepcion(crearReq({
      body: {
        compraId: 7,
        detalles: [{ productoId: 10, presentacion: 'CAJON', cantidadPresentacion: 2, factorConversion: 10, costoPresentacion: 100 }],
      },
    }), res);

    expect(recepcionRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ compraId: 7, proveedorId: 5, pedidoId: 3, usuarioId: 1 }),
      transaccion,
    );
    expect(detalleRecepcionRepo.crearMuchos).toHaveBeenCalledWith(
      [expect.objectContaining({ recepcionId: 9, productoId: 10, cantidadBase: 20, costoUnitario: '10.00' })],
      transaccion,
    );
    expect(movimientoRepo.registrarIngreso).toHaveBeenCalledWith(
      10,
      20,
      1,
      'RECEPCION',
      7,
      transaccion,
      9,
    );
    expect(productoRepo.updateCosto).toHaveBeenCalledWith(10, '10.00', transaccion);
    expect(compraRepo.actualizar).toHaveBeenCalledWith(7, { estado: 'RECIBIDA' }, transaccion);
    expect(pedidoRepo.actualizarEstado).toHaveBeenCalledWith(3, 'RECIBIDO', transaccion);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responde 409 si la compra ya fue recibida', async () => {
    compraRepo.buscarPorIdConBloqueo.mockResolvedValue(compra({ estado: 'RECIBIDA' }));
    const res = crearRes();

    await postRecepcion(crearReq({ body: { compraId: 7, detalles: [] } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'La compra ya fue recibida.' });
  });

  it('responde 409 si ya existe una recepción', async () => {
    recepcionRepo.buscarPorCompra.mockResolvedValue({ id: 9, compraId: 7 });
    const res = crearRes();

    await postRecepcion(crearReq({
      body: { compraId: 7, detalles: [{ productoId: 10, cantidadPresentacion: 2, factorConversion: 10 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'La compra ya tiene una recepción.' });
  });

  it('rechaza un producto que no pertenece a la compra', async () => {
    const res = crearRes();
    await postRecepcion(crearReq({
      body: { compraId: 7, detalles: [{ productoId: 99, cantidadPresentacion: 2, factorConversion: 10 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El producto 99 no pertenece a la compra.' });
  });

  it('exige observar diferencias de cantidad', async () => {
    const res = crearRes();
    await postRecepcion(crearReq({
      body: { compraId: 7, detalles: [{ productoId: 10, cantidadPresentacion: 1, factorConversion: 10 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La recepción tiene diferencias y requiere una observación.',
    });
  });

  it('acepta diferencias con observación', async () => {
    const res = crearRes();
    await postRecepcion(crearReq({
      body: {
        compraId: 7,
        observaciones: 'faltó un cajón',
        detalles: [{ productoId: 10, cantidadPresentacion: 1, factorConversion: 10 }],
      },
    }), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('exige recibir todos los productos', async () => {
    detalleCompraRepo.buscarPorCompra.mockResolvedValue([
      detalleCompra(),
      detalleCompra({ id: 2, productoId: 11 }),
    ]);
    const res = crearRes();

    await postRecepcion(crearReq({
      body: { compraId: 7, detalles: [{ productoId: 10, cantidadPresentacion: 2, factorConversion: 10 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Debe recibir todos los productos de la compra.' });
  });
});

describe('getRecepciones', () => {
  it('lista recepciones con filtros', async () => {
    const res = crearRes();
    await getRecepciones(crearReq({ query: { compraId: '7', proveedorId: '5' } }), res);

    expect(recepcionRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ compraId: 7, proveedorId: 5 }),
      1,
      50,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
  });
});

describe('getRecepcionById', () => {
  it('devuelve la recepción', async () => {
    const res = crearRes();
    await getRecepcionById(crearReq({ params: { id: '9' } }), res);

    expect(res.json).toHaveBeenCalledWith({ id: 9, compraId: 7, detalles: [] });
  });

  it('responde 404 si no existe', async () => {
    recepcionRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await getRecepcionById(crearReq({ params: { id: '9' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
