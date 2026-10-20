import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('../mocks/cuentaProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));

import {
  getCuentas,
  getCuentaById,
  getSaldoProveedor,
} from '../../src/controllers/cuentaController.js';
import { instancia as cuentaRepo } from '../mocks/cuentaProveedorRepository.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';

function cuenta(overrides: Record<string, unknown> = {}) {
  return { id: 1, proveedorId: 5, compraId: 7, importePendiente: '500.00', estado: 'PAGO PARCIAL', ...overrides };
}

beforeEach(() => {
  proveedorRepo.buscarPorId.mockResolvedValue({ id: 5, nombre: 'Distribuidora Sur' });
  cuentaRepo.buscarPorProveedor.mockResolvedValue({ rows: [cuenta()], count: 1 });
  cuentaRepo.listarPaginados.mockResolvedValue({ rows: [cuenta()], count: 1 });
  cuentaRepo.buscarTodas.mockResolvedValue([
    cuenta({ id: 1, importePendiente: '500.00', estado: 'PAGO PARCIAL' }),
    cuenta({ id: 2, importePendiente: '0.00', estado: 'PAGADO' }),
    cuenta({ id: 3, importePendiente: '300.00', estado: 'PAGO PENDIENTE' }),
  ]);
  cuentaRepo.buscarPorId.mockResolvedValue(cuenta());
  cuentaRepo.buscarPagosAplicados.mockResolvedValue([{ pagoId: 9, cuentaId: 1, importeAplicado: '500.00' }]);
});

describe('getCuentas', () => {

  it('delega a buscarTodas cuando no hay filtros de estado', async () => {
    const res = crearRes();
    await getCuentas(crearReq({ query: { proveedorId: '5' } }), res);

    expect(cuentaRepo.buscarPorProveedor).toHaveBeenCalledWith(5, 'TODAS', 1, 50);
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
  });

  it('pasa el filtro de estado al repositorio', async () => {
    const res = crearRes();
    await getCuentas(crearReq({ query: { proveedorId: '5', estado: 'PAGADO' } }), res);

    expect(cuentaRepo.buscarPorProveedor).toHaveBeenCalledWith(5, 'PAGADO', 1, 50);
  });

  it('sin proveedor y TODAS usa listarPaginados', async () => {
    const res = crearRes();
    await getCuentas(crearReq(), res);

    expect(cuentaRepo.listarPaginados).toHaveBeenCalledWith(1, 50);
  });

  it('sin proveedor y PAGADO filtra en memoria', async () => {
    const res = crearRes();
    await getCuentas(crearReq({ query: { estado: 'PAGADO' } }), res);

    expect(cuentaRepo.buscarTodas).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
  });

  it('sin proveedor y NO_PAGADO filtra en memoria', async () => {
    const res = crearRes();
    await getCuentas(crearReq({ query: { estado: 'NO_PAGADO' } }), res);

    expect(cuentaRepo.buscarTodas).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 2);
  });

  it('rechaza un estado inválido', async () => {
    const res = crearRes();
    await getCuentas(crearReq({ query: { estado: 'CUALQUIERA' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El filtro estado debe ser TODAS, PAGADO o NO_PAGADO.' });
  });
});

describe('getCuentaById', () => {

  it('devuelve la cuenta con sus pagos aplicados', async () => {
    const res = crearRes();
    await getCuentaById(crearReq({ params: { id: '1' } }), res);

    expect(res.json).toHaveBeenCalledWith({
      cuenta: cuenta(),
      pagos: [{ pagoId: 9, cuentaId: 1, importeAplicado: '500.00' }],
    });
  });

  it('responde 404 si no existe', async () => {
    cuentaRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await getCuentaById(crearReq({ params: { id: '1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cuenta corriente no encontrada.' });
  });
});

describe('getSaldoProveedor', () => {

  it('consolida el saldo pendiente del proveedor', async () => {
    const res = crearRes();
    await getSaldoProveedor(crearReq({ params: { proveedorId: '5' } }), res);

    expect(res.json).toHaveBeenCalledWith({
      proveedorId: 5,
      proveedor: 'Distribuidora Sur',
      totalPendiente: 800,
      cuentas: { total: 3, pagadas: 1, parciales: 1, pendientes: 1 },
    });
  });

  it('ignora las cuentas de otros proveedores', async () => {
    cuentaRepo.buscarTodas.mockResolvedValue([
      cuenta({ proveedorId: 5, importePendiente: '500.00', estado: 'PAGO PARCIAL' }),
      cuenta({ proveedorId: 6, importePendiente: '9999.00', estado: 'PAGO PENDIENTE' }),
    ]);
    const res = crearRes();
    await getSaldoProveedor(crearReq({ params: { proveedorId: '5' } }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalPendiente: 500, cuentas: expect.objectContaining({ total: 1 }) }),
    );
  });

  it('responde 404 si el proveedor no existe', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await getSaldoProveedor(crearReq({ params: { proveedorId: '5' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
