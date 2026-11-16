jest.mock('polleria-database/models/Pago', () => ({ findByPk: jest.fn() }));
jest.mock('polleria-database/models/PagoPorCuenta', () => ({ findOne: jest.fn(), create: jest.fn(), update: jest.fn() }));
jest.mock('polleria-database/models/CuentaProveedor', () => ({ findOne: jest.fn() }));
jest.mock('polleria-database/models/Compra', () => ({}));
jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('../mocks/cuentaProveedorRepository.js'));
import Pago from 'polleria-database/models/Pago';
import Aplicacion from 'polleria-database/models/PagoPorCuenta';
import Cuenta from 'polleria-database/models/CuentaProveedor';
import Compra from 'polleria-database/models/Compra';
import PagoPorCuentaRepository from 'polleria-database/repositories/pagoPorCuentaRepository';
import { instancia as cuentas } from '../mocks/cuentaProveedorRepository.js';
import type { Transaction } from 'sequelize';

const tx = { LOCK: { UPDATE: 'UPDATE' } } as unknown as Transaction;
beforeEach(() => jest.resetAllMocks());

test('imputa primero la compra más antigua, cubre parcialmente la siguiente y conserva centavos', async () => {
  const pago = { id: 7, proveedorId: 5, importePendiente: '15.15', update: jest.fn(async datos => { pago.importePendiente = datos.importePendiente }) };
  jest.mocked(Pago.findByPk).mockResolvedValue(pago as unknown as Pago);
  jest.mocked(Cuenta.findOne).mockResolvedValueOnce({ id: 1, importePendiente: '10.10' } as Cuenta).mockResolvedValueOnce({ id: 2, importePendiente: '20.20' } as Cuenta);
  cuentas.actualizarSaldoYEstado.mockResolvedValue({});
  jest.mocked(Aplicacion.findOne).mockResolvedValue(null);
  await new PagoPorCuentaRepository().aplicarPagoAProveedor(7, tx);
  expect(Cuenta.findOne).toHaveBeenCalledWith(expect.objectContaining({ order: [[{ model: Compra, as: 'compra' }, 'fechaHora', 'ASC'], ['id', 'ASC']], lock: { level: 'UPDATE', of: Cuenta } }));
  expect(cuentas.actualizarSaldoYEstado.mock.calls).toEqual([[1, 10.1, tx], [2, 5.05, tx]]);
  expect(pago.importePendiente).toBe('0.00');
});

test('conserva el sobrante y acumula una nueva aplicación a la misma cuenta', async () => {
  const pago = { id: 7, proveedorId: 5, importePendiente: '30.00', update: jest.fn(async datos => { pago.importePendiente = datos.importePendiente }) };
  jest.mocked(Pago.findByPk).mockResolvedValue(pago as unknown as Pago);
  jest.mocked(Cuenta.findOne).mockResolvedValueOnce({ id: 1, importePendiente: '10.00' } as Cuenta).mockResolvedValueOnce(null);
  jest.mocked(Aplicacion.findOne).mockResolvedValue({ importeAplicado: '5.00' } as Aplicacion);
  cuentas.actualizarSaldoYEstado.mockResolvedValue({});
  await new PagoPorCuentaRepository().aplicarPagoAProveedor(7, tx);
  expect(Aplicacion.update).toHaveBeenCalledWith({ importeAplicado: '15.00' }, { where: { pagoId: 7, cuentaId: 1 }, transaction: tx });
  expect(Aplicacion.create).not.toHaveBeenCalled();
  expect(pago.importePendiente).toBe('20.00');
});
