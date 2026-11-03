import { beforeEach, describe, expect, it } from '@jest/globals';
jest.mock('polleria-database/models/Proveedor', () => ({ findByPk: jest.fn() }));
jest.mock('polleria-database/models/Producto', () => ({ findAll: jest.fn() }));
jest.mock('polleria-database/models/ProductoProveedor', () => ({ findAll: jest.fn(), create: jest.fn() }));
jest.mock('polleria-database/models/Compra', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('polleria-database/models/CuentaProveedor', () => ({ findAll: jest.fn(), create: jest.fn(), sum: jest.fn(), findAndCountAll: jest.fn() }));
jest.mock('polleria-database/models/Pago', () => ({ findOne: jest.fn(), create: jest.fn(), sum: jest.fn(), findAndCountAll: jest.fn() }));
jest.mock('polleria-database/models/PagoPorCuenta', () => ({ findAll: jest.fn(), create: jest.fn() }));
import Proveedor from 'polleria-database/models/Proveedor';
import Producto from 'polleria-database/models/Producto';
import Relacion from 'polleria-database/models/ProductoProveedor';
import Compra from 'polleria-database/models/Compra';
import Cuenta from 'polleria-database/models/CuentaProveedor';
import Pago from 'polleria-database/models/Pago';
import Aplicacion from 'polleria-database/models/PagoPorCuenta';
import { asociarProductos, estadoCuenta, filtrosCuenta, montoPositivo, registrarComprobante, registrarPago } from '../../src/services/proveedores.js';
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
  pagos.create.mockResolvedValue({ id: 7, importe: '15.15' });
  aplicaciones.create.mockImplementation(async datos => datos);
  relaciones.findAll.mockResolvedValue([]); producto.findAll.mockResolvedValue([{ id: 1, activo: true }]);
  cuentas.sum.mockResolvedValue('30.30'); pagos.sum.mockResolvedValue('0.00');
  cuentas.findAndCountAll.mockResolvedValue({ rows: [], count: 0 }); pagos.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
});

describe('Cuentas y pagos del Sprint 3', () => {
  it('distribuye el pago entre las cuentas más antiguas con importes exactos', async () => {
    const resultado = await registrarPago(5, { importe: '15.15', claveOperacion: clave });
    expect(proveedor.findByPk).toHaveBeenCalledWith(5, { transaction: tx, lock: 'UPDATE' });
    expect(cuenta1.update).toHaveBeenCalledWith({ importePendiente: '0.00', estado: 'PAGADO' }, { transaction: tx });
    expect(cuenta2.update).toHaveBeenCalledWith({ importePendiente: '15.15', estado: 'PAGO PARCIAL' }, { transaction: tx });
    expect(resultado.aplicaciones).toEqual([{ pagoId: 7, cuentaId: 1, importeAplicado: '10.10' }, { pagoId: 7, cuentaId: 2, importeAplicado: '5.05' }]);
  });
  it('cancela toda la deuda con un pago total', async () => {
    await registrarPago(5, { importe: '30.30', claveOperacion: clave });
    expect(cuenta2.update).toHaveBeenCalledWith({ importePendiente: '0.00', estado: 'PAGADO' }, { transaction: tx });
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
    cuenta1.update.mockRejectedValue(new Error('Fallo de escritura'));
    await expect(registrarPago(5, { importe: '15.15', claveOperacion: clave })).rejects.toThrow('Fallo de escritura');
    expect(aplicaciones.create).not.toHaveBeenCalled();
  });
  it.each([0, -1, true, '', '1.001', 'abc', '100000000'])('rechaza el importe inválido %p', valor => expect(() => montoPositivo(valor)).toThrow());
  it('requiere clave de operación para registrar pagos', async () => {
    await expect(registrarPago(5, { importe: '1.00' })).rejects.toThrow('clave válida');
  });
  it('crea comprobante y deuda en la misma transacción', async () => {
    compras.create.mockResolvedValue({ id: 10 });
    await registrarComprobante(5, { total: '100.50', numeroComprobante: '  A-123  ', fecha: '2020-01-01', claveOperacion: clave });
    expect(compras.create).toHaveBeenCalledWith(expect.objectContaining({ total: '100.50', numeroComprobante: 'A-123' }), { transaction: tx });
    expect(cuentas.create).toHaveBeenCalledWith({ proveedorId: 5, compraId: 10, importePendiente: '100.50', estado: 'PAGO PENDIENTE' }, { transaction: tx });
  });
  it('rechaza comprobantes duplicados y proveedores inactivos', async () => {
    const body = { total: '1.00', numeroComprobante: 'A-123', fecha: '2020-01-01', claveOperacion: clave };
    compras.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 });
    await expect(registrarComprobante(5, body)).rejects.toThrow('ya está registrado');
    proveedor.findByPk.mockResolvedValue({ id: 5, activo: false, ctaCte: true });
    await expect(registrarComprobante(5, body)).rejects.toThrow('activo');
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
