import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/compraRepository', () => require('../mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('../mocks/cuentaProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));

import {
  getCompras,
  getCompraById,
  postCompra,
} from '../../src/controllers/compraController.js';
import { instancia as compraRepo } from '../mocks/compraRepository.js';
import { instancia as cuentaRepo } from '../mocks/cuentaProveedorRepository.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';

function compra(overrides: Record<string, unknown> = {}) {
  return { id: 7, proveedorId: 5, total: '1500.00', fechaHora: new Date('2026-03-01T00:00:00Z'), ...overrides };
}

beforeEach(() => {
  proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, nombre: 'Distribuidora Sur' });
  compraRepo.crear.mockResolvedValue(compra());
  compraRepo.buscarPorId.mockResolvedValue(compra());
  compraRepo.buscarPorProveedor.mockResolvedValue({ rows: [compra()], count: 1 });
  compraRepo.buscarPorFechas.mockResolvedValue({ rows: [compra()], count: 1 });
  compraRepo.buscarPorProveedorYFechas.mockResolvedValue({ rows: [compra()], count: 1 });
  compraRepo.buscarTodas.mockResolvedValue([compra()]);
  cuentaRepo.crear.mockResolvedValue({ id: 1, proveedorId: 5, compraId: 7, importePendiente: '1500.00', estado: 'PAGO PENDIENTE' });
  cuentaRepo.buscarPorCompra.mockResolvedValue({ id: 1, proveedorId: 5, compraId: 7 });
});

describe('postCompra', () => {

  it('crea la compra y su cuenta en una transacción, responde 201', async () => {
    const transaccion = usarTransaccionFalsa();
    const res = crearRes();
    await postCompra(crearReq({ body: { proveedorId: 5, total: 1500 } }), res);

    expect(compraRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorId: 5, total: '1500.00' }),
      transaccion,
    );
    expect(cuentaRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorId: 5, compraId: 7, importePendiente: '1500.00', estado: 'PAGO PENDIENTE' }),
      transaccion,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responde 404 si el proveedor no existe', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await postCompra(crearReq({ body: { proveedorId: 5, total: 1500 } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Proveedor no encontrado.' });
  });

  it('rechaza un total no numérico', async () => {
    const res = crearRes();
    await postCompra(crearReq({ body: { proveedorId: 5, total: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'total no es válido.' });
  });

  it('rechaza una fecha inválida', async () => {
    const res = crearRes();
    await postCompra(crearReq({ body: { proveedorId: 5, total: 1500, fechaHora: 'no-es-fecha' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La fecha de la compra no es válida.' });
  });
});

describe('getCompras', () => {

  it('usa buscarTodas y pagina en memoria sin filtros', async () => {
    const res = crearRes();
    await getCompras(crearReq(), res);

    expect(compraRepo.buscarTodas).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
    expect(res.json).toHaveBeenCalledWith([compra()]);
  });

  it('filtra por proveedor', async () => {
    const res = crearRes();
    await getCompras(crearReq({ query: { proveedorId: '5' } }), res);

    expect(compraRepo.buscarPorProveedor).toHaveBeenCalledWith(5, 1, 50);
  });

  it('filtra por rango de fechas', async () => {
    const res = crearRes();
    await getCompras(crearReq({ query: { fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' } }), res);

    expect(compraRepo.buscarPorFechas).toHaveBeenCalled();
  });

  it('filtra por proveedor y rango de fechas a la vez', async () => {
    const res = crearRes();
    await getCompras(crearReq({ query: { proveedorId: '5', fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' } }), res);

    expect(compraRepo.buscarPorProveedorYFechas).toHaveBeenCalled();
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

    expect(res.json).toHaveBeenCalledWith({ compra: compra(), cuenta: { id: 1, proveedorId: 5, compraId: 7 } });
  });

  it('responde 404 si la compra no existe', async () => {
    compraRepo.buscarPorId.mockResolvedValue(null);
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
