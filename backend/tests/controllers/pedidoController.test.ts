import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('../../../database/src/repositories/pedidoRepository.js', () => require('../mocks/pedidoRepository.js'));
jest.mock('../../../database/src/repositories/detallePedidoRepository.js', () => require('../mocks/detallePedidoRepository.js'));
jest.mock('polleria-database/repositories/compraRepository', () => require('../mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/productoProveedorRepository', () => require('../mocks/productoProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));

import {
  getPedidos,
  getPedidoById,
  postPedido,
  postCancelarPedido,
} from '../../src/controllers/pedidoController.js';
import { instancia as pedidoRepo } from '../mocks/pedidoRepository.js';
import { instancia as detalleRepo } from '../mocks/detallePedidoRepository.js';
import { instancia as compraRepo } from '../mocks/compraRepository.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { instancia as relacionRepo } from '../mocks/productoProveedorRepository.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';

function pedido(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    proveedorId: 5,
    estado: 'REALIZADO',
    totalEstimado: '200.00',
    fechaHora: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  usarTransaccionFalsa();
  proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, nombre: 'Distribuidora Sur', activo: true });
  productoRepo.findById.mockResolvedValue({ id: 10, nombre: 'Pollo', activo: true });
  relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
  pedidoRepo.crear.mockResolvedValue(pedido());
  pedidoRepo.buscarDetalle.mockResolvedValue(pedido({ detalles: [] }));
  pedidoRepo.buscarPorIdConBloqueo.mockResolvedValue(pedido());
  pedidoRepo.listar.mockResolvedValue({ rows: [pedido()], count: 1 });
  pedidoRepo.actualizarEstado.mockResolvedValue(pedido({ estado: 'CANCELADO' }));
  compraRepo.findBy.mockResolvedValue(null);
  detalleRepo.crearMuchos.mockResolvedValue([{ id: 1, pedidoId: 3, productoId: 10 }]);
});

describe('postPedido', () => {
  it('crea el pedido y sus detalles en una transacción', async () => {
    const transaccion = usarTransaccionFalsa();
    const res = crearRes();

    await postPedido(crearReq({
      body: {
        proveedorId: 5,
        detalles: [{ productoId: 10, cantidad: 2, costoEstimado: 100 }],
      },
    }), res);

    expect(pedidoRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorId: 5, estado: 'REALIZADO', totalEstimado: '200.00' }),
      transaccion,
    );
    expect(detalleRepo.crearMuchos).toHaveBeenCalledWith(
      [expect.objectContaining({ pedidoId: 3, productoId: 10, cantidad: 2, subtotal: '200.00' })],
      transaccion,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('exige que el producto esté asociado al proveedor', async () => {
    relacionRepo.findByRelation.mockResolvedValue(null);
    const res = crearRes();

    await postPedido(crearReq({
      body: { proveedorId: 5, detalles: [{ productoId: 10, cantidad: 2, costoEstimado: 100 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El producto 10 no está asociado al proveedor.',
    });
  });

  it('rechaza un producto inactivo', async () => {
    productoRepo.findById.mockResolvedValue({ id: 10, activo: false });
    const res = crearRes();

    await postPedido(crearReq({
      body: { proveedorId: 5, detalles: [{ productoId: 10, cantidad: 2, costoEstimado: 100 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza proveedor inactivo', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, activo: false });
    const res = crearRes();

    await postPedido(crearReq({
      body: { proveedorId: 5, detalles: [{ productoId: 10, cantidad: 2, costoEstimado: 100 }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El proveedor está inactivo.' });
  });
});

describe('getPedidos', () => {
  it('lista pedidos con filtros', async () => {
    const res = crearRes();
    await getPedidos(crearReq({ query: { proveedorId: '5', estado: 'REALIZADO' } }), res);

    expect(pedidoRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorId: 5, estado: 'REALIZADO' }),
      1,
      50,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
  });

  it('rechaza un estado inválido', async () => {
    const res = crearRes();
    await getPedidos(crearReq({ query: { estado: 'PERDIDO' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getPedidoById', () => {
  it('devuelve el detalle', async () => {
    const res = crearRes();
    await getPedidoById(crearReq({ params: { id: '3' } }), res);

    expect(res.json).toHaveBeenCalledWith(pedido({ detalles: [] }));
  });

  it('responde 404 si no existe', async () => {
    pedidoRepo.buscarDetalle.mockResolvedValue(null);
    const res = crearRes();
    await getPedidoById(crearReq({ params: { id: '3' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('postCancelarPedido', () => {
  it('cancela un pedido realizado', async () => {
    const res = crearRes();
    await postCancelarPedido(crearReq({ params: { id: '3' } }), res);

    expect(pedidoRepo.actualizarEstado).toHaveBeenCalledWith(3, 'CANCELADO', expect.anything());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('responde 409 si el pedido no está realizado', async () => {
    pedidoRepo.buscarPorIdConBloqueo.mockResolvedValue(pedido({ estado: 'FACTURADO' }));
    const res = crearRes();
    await postCancelarPedido(crearReq({ params: { id: '3' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Solo se puede cancelar un pedido realizado.' });
  });
});
