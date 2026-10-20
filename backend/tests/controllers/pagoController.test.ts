import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/pagoRepository', () => require('../mocks/pagoRepository.js'));
jest.mock('polleria-database/repositories/pagoPorCuentaRepository', () => require('../mocks/pagoPorCuentaRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));

import {
  getPagos,
  getPagoById,
  postPago,
} from '../../src/controllers/pagoController.js';
import { instancia as pagoRepo } from '../mocks/pagoRepository.js';
import { instancia as aplicacionRepo } from '../mocks/pagoPorCuentaRepository.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';

function pago(overrides: Record<string, unknown> = {}) {
  return { id: 9, proveedorId: 5, importe: '1000.00', importePendiente: '0.00', fechaHora: new Date('2026-03-02T00:00:00Z'), ...overrides };
}

beforeEach(() => {
  proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, nombre: 'Distribuidora Sur' });
  pagoRepo.registrarPagoYAplicar.mockResolvedValue(pago());
  pagoRepo.buscarPorId.mockResolvedValue(pago());
  pagoRepo.listarPaginados.mockResolvedValue({ rows: [pago()], count: 1 });
  pagoRepo.buscarPorProveedor.mockResolvedValue({ rows: [pago()], count: 1 });
  pagoRepo.buscarPorFechas.mockResolvedValue({ rows: [pago()], count: 1 });
  pagoRepo.buscarPorProveedorYFechas.mockResolvedValue({ rows: [pago()], count: 1 });
  pagoRepo.buscarConSaldoPendiente.mockResolvedValue({ rows: [pago({ importePendiente: '200.00' })], count: 1 });
  aplicacionRepo.buscarPorPago.mockResolvedValue([{ pagoId: 9, cuentaId: 1, importeAplicado: '1000.00' }]);
});

describe('postPago', () => {

  it('registra el pago y responde 201', async () => {
    const res = crearRes();
    await postPago(crearReq({ body: { proveedorId: 5, importe: 1000 } }), res);

    expect(pagoRepo.registrarPagoYAplicar).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorId: 5, importe: '1000.00' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responde 404 si el proveedor no existe', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await postPago(crearReq({ body: { proveedorId: 5, importe: 1000 } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza un importe no válido', async () => {
    const res = crearRes();
    await postPago(crearReq({ body: { proveedorId: 5, importe: 0 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'importe no es válido.' });
  });

  it('rechaza una fecha inválida', async () => {
    const res = crearRes();
    await postPago(crearReq({ body: { proveedorId: 5, importe: 1000, fechaHora: 'nada' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La fecha del pago no es válida.' });
  });
});

describe('getPagos', () => {

  it('sin filtros usa listarPaginados', async () => {
    const res = crearRes();
    await getPagos(crearReq(), res);

    expect(pagoRepo.listarPaginados).toHaveBeenCalledWith(1, 50);
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
  });

  it('conSaldoPendiente usa buscarConSaldoPendiente', async () => {
    const res = crearRes();
    await getPagos(crearReq({ query: { conSaldoPendiente: 'true' } }), res);

    expect(pagoRepo.buscarConSaldoPendiente).toHaveBeenCalledWith(1, 50);
  });

  it('filtra por proveedor', async () => {
    const res = crearRes();
    await getPagos(crearReq({ query: { proveedorId: '5' } }), res);

    expect(pagoRepo.buscarPorProveedor).toHaveBeenCalledWith(5, 1, 50);
  });

  it('filtra por fechas sin proveedor', async () => {
    const res = crearRes();
    await getPagos(crearReq({ query: { fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' } }), res);

    expect(pagoRepo.buscarPorFechas).toHaveBeenCalled();
  });

  it('filtra por proveedor y fechas', async () => {
    const res = crearRes();
    await getPagos(crearReq({ query: { proveedorId: '5', fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' } }), res);

    expect(pagoRepo.buscarPorProveedorYFechas).toHaveBeenCalled();
  });

  it('responde 400 con rango de fechas inválido', async () => {
    const res = crearRes();
    await getPagos(crearReq({ query: { fechaDesde: '2026-12-31', fechaHasta: '2026-01-01' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getPagoById', () => {

  it('devuelve el pago con sus aplicaciones', async () => {
    const res = crearRes();
    await getPagoById(crearReq({ params: { id: '9' } }), res);

    expect(res.json).toHaveBeenCalledWith({
      pago: pago(),
      aplicaciones: [{ pagoId: 9, cuentaId: 1, importeAplicado: '1000.00' }],
    });
  });

  it('responde 404 si el pago no existe', async () => {
    pagoRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await getPagoById(crearReq({ params: { id: '9' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Pago no encontrado.' });
  });
});
