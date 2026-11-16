jest.mock('polleria-database/models/Producto', () => ({ findAll: jest.fn() }));
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
import Producto from 'polleria-database/models/Producto';
import { registrarInventario } from '../../src/services/inventario.js';
import { instancia as movimientos } from '../mocks/movimientoStockRepository.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';

beforeEach(() => {
  jest.clearAllMocks(); usarTransaccionFalsa();
  jest.mocked(Producto.findAll).mockResolvedValue([{ id: 1, nombre: 'Pollo', unidadVenta: 'KILOS', stockActual: 20 }, { id: 2, nombre: 'Unidad', unidadVenta: 'UNIDADES', stockActual: 5 }] as Producto[]);
});
const datos = { motivo: 'Conteo de cierre', productos: [{ productoId: 1, stockEsperado: 20, stockContado: 0 }, { productoId: 2, stockEsperado: 5, stockContado: 4 }] };
test('guarda todos los ajustes en la misma transacción y admite stock cero', async () => {
  const resultado = await registrarInventario(datos);
  expect(resultado.ajustes).toBe(2);
  expect(movimientos.ajustarStock).toHaveBeenNthCalledWith(1, 1, 0, 1, 'INVENTARIO: Conteo de cierre', expect.any(Object));
  expect(movimientos.ajustarStock.mock.calls[0][4]).toBe(movimientos.ajustarStock.mock.calls[1][4]);
});
test('valida todo el conteo antes de escribir y rechaza stocks desactualizados', async () => {
  await expect(registrarInventario({ ...datos, productos: [datos.productos[0], { ...datos.productos[1], stockContado: 1.5 }] })).rejects.toThrow('Cantidad inválida');
  expect(movimientos.ajustarStock).not.toHaveBeenCalled();
  await expect(registrarInventario({ ...datos, productos: [{ ...datos.productos[0], stockEsperado: 21 }, datos.productos[1]] })).rejects.toMatchObject({ status: 409 });
  expect(movimientos.ajustarStock).not.toHaveBeenCalled();
});
test('rechaza duplicados, omisiones y no genera movimientos cuando no hay diferencias', async () => {
  await expect(registrarInventario({ ...datos, productos: [datos.productos[0], datos.productos[0]] })).rejects.toThrow('repetidos');
  await expect(registrarInventario({ ...datos, productos: [datos.productos[0]] })).rejects.toMatchObject({ status: 409 });
  const resultado = await registrarInventario({ ...datos, productos: datos.productos.map(p => ({ ...p, stockContado: p.stockEsperado })) });
  expect(resultado.ajustes).toBe(0);
  expect(movimientos.ajustarStock).not.toHaveBeenCalled();
});
