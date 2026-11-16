jest.mock('polleria-database/models/Producto', () => ({}));
jest.mock('polleria-database/models/Proveedor', () => ({ findAll: jest.fn() }));
jest.mock('polleria-database/models/ProductoProveedor', () => ({ findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() }));
jest.mock('polleria-database/repositories/precioRepository', () => require('../mocks/precioRepository.js'));
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
import { camposProducto, guardarComplementos } from '../../src/services/productoEdicion.js';
import Proveedor from 'polleria-database/models/Proveedor';
import ProductoProveedor from 'polleria-database/models/ProductoProveedor';
import type Producto from 'polleria-database/models/Producto';
import type { Transaction } from 'sequelize';
import { instancia as precios } from '../mocks/precioRepository.js';

const tx = {} as Transaction;
beforeEach(() => jest.clearAllMocks());
test('valida precios, cantidades, reposición y proveedores antes de escribir', () => {
  for (const datos of [{ costoActual: -1 }, { precioMinorista: true }, { precioMinorista: '1.001' }, { precioMinorista: '10', precioMayorista: '11' }, { stockActual: 1.0001 }, { proveedorIds: [1, 1] }, { tipoReposicion: 'otro' }, { tipoReposicion: 'stockMinimo', stockMinimo: null }]) expect(() => camposProducto(datos, 'kg')).toThrow();
  expect(() => camposProducto({ stockActual: 1.5 }, 'unidad')).toThrow();
  expect(camposProducto({ costoActual: '1500.50', stockActual: 2.125, stockMinimo: null }, 'kg')).toMatchObject({ costoActual: '1500.50', stockActual: 2.125, stockMinimo: null });
});
test('rechaza un habitual que no está asociado', async () => {
  jest.mocked(ProductoProveedor.findOne).mockResolvedValue(null);
  await expect(guardarComplementos({ id: 1, proveedorHabitualId: 9 } as Producto, {}, tx)).rejects.toThrow('relacionado');
});
test('reactiva relaciones, conserva bajas y registra precios en la misma transacción', async () => {
  const update = jest.fn();
  jest.mocked(Proveedor.findAll).mockResolvedValue([{ id: 2, activo: true }] as Proveedor[]);
  jest.mocked(ProductoProveedor.findAll).mockResolvedValue([{ proveedorId: 1, activo: true, update }] as unknown as ProductoProveedor[]);
  precios.findVigente.mockResolvedValue(null);
  await guardarComplementos({ id: 1, proveedorHabitualId: null } as Producto, { proveedorIds: [2], precioMinorista: '2500', precioMayorista: '2200' }, tx);
  expect(update).toHaveBeenCalledWith({ activo: false, fechaBaja: expect.any(Date) }, { transaction: tx });
  expect(ProductoProveedor.create).toHaveBeenCalledWith({ productoId: 1, proveedorId: 2, activo: true }, { transaction: tx });
  expect(precios.registrarPrecio).toHaveBeenCalledWith(1, '2500.00', '2200.00', expect.any(Date), tx);
});
