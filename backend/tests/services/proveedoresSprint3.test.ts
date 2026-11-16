jest.mock('polleria-database/repositories/pagoPorCuentaRepository', () => require('../mocks/pagoPorCuentaRepository.js'));
import { beforeEach, describe, expect, it } from '@jest/globals';
jest.mock('polleria-database/models/Proveedor', () => ({ findByPk: jest.fn() }));
jest.mock('polleria-database/models/Producto', () => ({ findAll: jest.fn(), update: jest.fn() }));
jest.mock('polleria-database/models/ProductoProveedor', () => ({ findAll: jest.fn(), create: jest.fn() }));
jest.mock('polleria-database/models/Compra', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('polleria-database/models/CuentaProveedor', () => ({ findAll: jest.fn(), create: jest.fn(), sum: jest.fn(), findAndCountAll: jest.fn() }));
jest.mock('polleria-database/models/Pago', () => ({ findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), sum: jest.fn(), findAndCountAll: jest.fn() }));
jest.mock('polleria-database/models/PagoPorCuenta', () => ({ findAll: jest.fn(), create: jest.fn() }));
import Proveedor from 'polleria-database/models/Proveedor';
import Producto from 'polleria-database/models/Producto';
import Relacion from 'polleria-database/models/ProductoProveedor';
import Compra from 'polleria-database/models/Compra';
import Cuenta from 'polleria-database/models/CuentaProveedor';
import Pago from 'polleria-database/models/Pago';
import Aplicacion from 'polleria-database/models/PagoPorCuenta';
import { activarCuenta, aplicarCredito, comprobantePago, asociarProductos, estadoCuenta, filtrosCuenta, montoPositivo, registrarComprobante, registrarPago } from '../../src/services/proveedores.js';
import { instancia as imputaciones } from '../mocks/pagoPorCuentaRepository.js';
import { sequelize } from '../mocks/configDatabase.js';

type Modelo = { findByPk: jest.Mock; findAll: jest.Mock; findOne: jest.Mock; create: jest.Mock; sum: jest.Mock; findAndCountAll: jest.Mock };
const proveedor = Proveedor as unknown as Modelo, producto = Producto as unknown as Modelo, relaciones = Relacion as unknown as Modelo, compras = Compra as unknown as Modelo, cuentas = Cuenta as unknown as Modelo, pagos = Pago as unknown as Modelo, aplicaciones = Aplicacion as unknown as Modelo;
const clave = '12345678-1234-1234-1234-123456789abc';
const tx = { LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' } };
let cuenta1: { id: number; importePendiente: string; update: jest.Mock }, cuenta2: typeof cuenta1;
beforeEach(() => {
  jest.resetAllMocks();
  sequelize.transaction.mockImplementation(async (...args: unknown[]) => (args.at(-1) as (t: unknown) => Promise<unknown>)(tx));
  proveedor.findByPk.mockResolvedValue({ id: 5, activo: true, ctaCte: true });
  pagos.findOne.mockResolvedValue(null); compras.findOne.mockResolvedValue(null);
  cuenta1 = { id: 1, importePendiente: '10.10', update: jest.fn().mockResolvedValue({}) };
  cuenta2 = { id: 2, importePendiente: '20.20', update: jest.fn().mockResolvedValue({}) };
  cuentas.findAll.mockResolvedValue([cuenta1, cuenta2]);
  pagos.create.mockResolvedValue({ id: 7, importe: '15.15', reload: jest.fn() });
  pagos.findAll.mockResolvedValue([]);
  aplicaciones.findAll.mockResolvedValue([]);
  aplicaciones.create.mockImplementation(async datos => datos);
  relaciones.findAll.mockResolvedValue([]); producto.findAll.mockResolvedValue([{ id: 1, activo: true }]);
  cuentas.sum.mockResolvedValue('30.30'); pagos.sum.mockResolvedValue('0.00');
  cuentas.findAndCountAll.mockResolvedValue({ rows: [], count: 0 }); pagos.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
});

describe('Cuentas y pagos del Sprint 3', () => {
  it('aplica un crédito existente sin crear otro pago', async () => {
    pagos.findOne.mockResolvedValue({ id: 7, proveedorId: 5, importePendiente: '20.00', reload: jest.fn() });
    await aplicarCredito(5, 7, { importePendiente: '20.00' });
    expect(imputaciones.aplicarPagoAProveedor).toHaveBeenCalledWith(7, tx);
    expect(pagos.create).not.toHaveBeenCalled();
  });
  it('rechaza crédito desactualizado y pagos de otro proveedor', async () => {
    pagos.findOne.mockResolvedValue({ id: 7, importePendiente: '10.00' });
    await expect(aplicarCredito(5, 7, { importePendiente: '20.00' })).rejects.toMatchObject({ status: 409 });
    expect(imputaciones.aplicarPagoAProveedor).not.toHaveBeenCalled();
    pagos.findOne.mockResolvedValue(null);
    await expect(aplicarCredito(5, 7, { importePendiente: '20.00' })).rejects.toMatchObject({ status: 404 });
    await expect(comprobantePago(5, 7)).rejects.toMatchObject({ status: 404 });
    expect(pagos.findOne).toHaveBeenLastCalledWith({ where: { id: 7, proveedorId: 5 } });
  });
  it('habilita la cuenta sin sobrescribir los datos del proveedor', async () => {
    const update = jest.fn().mockResolvedValue({ id: 5, ctaCte: true });
    proveedor.findByPk.mockResolvedValue({ id: 5, activo: true, update });
    await activarCuenta(5);
    expect(update).toHaveBeenCalledWith({ ctaCte: true }, { transaction: tx });
  });
  it('crea el pago con saldo disponible y delega la imputacion al repositorio', async () => {
    await registrarPago(5, { importe: '15.15', claveOperacion: clave });
    expect(pagos.create).toHaveBeenCalledWith({ proveedorId: 5, importe: '15.15', importePendiente: '15.15', claveOperacion: clave }, { transaction: tx });
    expect(imputaciones.aplicarPagoAProveedor).toHaveBeenCalledWith(7, tx);
  });
  it('rechaza sobrepago sin registrar ni alterar cuentas', async () => {
    await expect(registrarPago(5, { importe: '30.31', claveOperacion: clave })).rejects.toMatchObject({ status: 409 });
    expect(pagos.create).not.toHaveBeenCalled(); expect(cuenta1.update).not.toHaveBeenCalled();
  });
  it('un reintento devuelve el pago anterior sin aplicarlo dos veces', async () => {
    pagos.findOne.mockResolvedValue({ id: 7, proveedorId: 5, importe: '15.15' });
    aplicaciones.findAll.mockResolvedValue([{ cuentaId: 1, importeAplicado: '15.15' }]);
    const resultado = await registrarPago(5, { importe: '15.15', claveOperacion: clave });
    expect(resultado.pago.id).toBe(7); expect(pagos.create).not.toHaveBeenCalled(); expect(cuentas.findAll).not.toHaveBeenCalled();
  });
  it('no permite reutilizar la clave con otro importe', async () => {
    pagos.findOne.mockResolvedValue({ id: 7, proveedorId: 5, importe: '1.00' });
    await expect(registrarPago(5, { importe: '15.15', claveOperacion: clave })).rejects.toMatchObject({ status: 409 });
  });
  it('propaga errores dentro de la transacción para revertir el pago', async () => {
    imputaciones.aplicarPagoAProveedor.mockRejectedValue(new Error('Fallo de escritura'));
    await expect(registrarPago(5, { importe: '15.15', claveOperacion: clave })).rejects.toThrow('Fallo de escritura');
    expect(aplicaciones.create).not.toHaveBeenCalled();
  });
  it.each([0, -1, true, '', '1.001', 'abc', '100000000'])('rechaza el importe inválido %p', valor => expect(() => montoPositivo(valor)).toThrow());
  it('requiere clave de operación para registrar pagos', async () => {
    await expect(registrarPago(5, { importe: '1.00' })).rejects.toThrow('clave válida');
  });
  it('rechaza comprobantes sin compra ni productos', async () => {
    await expect(registrarComprobante(5, {})).rejects.toMatchObject({ status: 410 });
    expect(compras.create).not.toHaveBeenCalled();
    expect(cuentas.create).not.toHaveBeenCalled();
  });
  it('los filtros del historial no alteran el saldo total', async () => {
    const datos = await estadoCuenta(5, { estado: 'PAGADO', desde: '2020-01-01', hasta: '2020-01-02', page: 2 });
    expect(datos.saldo).toBe('30.30');
    expect(cuentas.sum).toHaveBeenCalledWith('importePendiente', { where: { proveedorId: 5 }, transaction: tx });
    expect(cuentas.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 20, where: { proveedorId: 5, estado: 'PAGADO' } }));
  });
  it.each([{ desde: '2026-02-30' }, { desde: '2026-05-01', hasta: '2026-04-01' }, { page: 0 }, { limite: 101 }, { estado: 'OTRO' }])('rechaza filtros inválidos %p', query => expect(() => filtrosCuenta(query)).toThrow());
});
describe('Asociaciones de productos', () => {
  it('limpia el habitual solamente en productos que se desasocian', async () => {
    await asociarProductos(5, { productoIds: [1] });
    expect(Producto.update).toHaveBeenCalledWith({ proveedorHabitualId: null }, expect.objectContaining({ where: expect.objectContaining({ proveedorHabitualId: 5 }), transaction: tx }));
  });
  it('reactiva asociaciones y da de baja las desmarcadas sin borrar filas', async () => {
    const anterior = { productoId: 1, activo: false, update: jest.fn() }, quitar = { productoId: 2, activo: true, update: jest.fn() };
    relaciones.findAll.mockResolvedValue([anterior, quitar]);
    await asociarProductos(5, { productoIds: [1] });
    expect(anterior.update).toHaveBeenCalledWith({ activo: true, fechaBaja: null }, { transaction: tx });
    expect(quitar.update).toHaveBeenCalledWith({ activo: false, fechaBaja: expect.any(Date) }, { transaction: tx });
    expect(relaciones.create).not.toHaveBeenCalled();
  });
  it('rechaza productos inexistentes y repetidos', async () => {
    await expect(asociarProductos(5, { productoIds: [1, 1] })).rejects.toThrow('repetidos');
    producto.findAll.mockResolvedValue([]);
    await expect(asociarProductos(5, { productoIds: [1] })).rejects.toThrow('activos');
  });
});
