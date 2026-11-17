jest.mock('polleria-database/repositories/circuitoAbastecimientoRepository', () => ({ __esModule: true, default: jest.fn(() => ({ esquemaDisponible: esquema, relacionadas, crearRecepcion: recepcionCrear, recepcion: recepcionBuscar, crearCompra: compraCrear, crearDetalleCompra: detalleCrear })) }));
jest.mock('polleria-database/models/Producto', () => ({ findByPk: jest.fn() }));
jest.mock('polleria-database/models/Proveedor', () => ({ findByPk: jest.fn() }));
jest.mock('polleria-database/models/Pedido', () => ({ findByPk: jest.fn() }));
jest.mock('polleria-database/models/DetallePedido', () => ({ findAll: jest.fn() }));
jest.mock('polleria-database/models/DetalleRecepcion', () => ({ findAll: jest.fn(), bulkCreate: jest.fn() }));
jest.mock('polleria-database/models/DetalleCompra', () => ({}));
jest.mock('polleria-database/models/MovimientoStock', () => ({ update: jest.fn() }));
jest.mock('polleria-database/models/CuentaProveedor', () => ({ create: jest.fn() }));
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
import Producto from 'polleria-database/models/Producto';
import Proveedor from 'polleria-database/models/Proveedor';
import Pedido from 'polleria-database/models/Pedido';
import DetallePedido from 'polleria-database/models/DetallePedido';
import DetalleRecepcion from 'polleria-database/models/DetalleRecepcion';
import MovimientoStock from 'polleria-database/models/MovimientoStock';
import CuentaProveedor from 'polleria-database/models/CuentaProveedor';
import { instancia as movimientos } from '../mocks/movimientoStockRepository.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';
// El import dinámico permite inicializar los dobles usados por el constructor.
const esquema = jest.fn(), relacionadas = jest.fn(), recepcionCrear = jest.fn(), recepcionBuscar = jest.fn(), compraCrear = jest.fn(), detalleCrear = jest.fn();
let servicio: typeof import('../../src/services/circuitoAbastecimiento.js');
const productoUpdate = jest.fn(), pedidoUpdate = jest.fn();
beforeAll(async () => { servicio = await import('../../src/services/circuitoAbastecimiento.js'); });
beforeEach(() => {
  jest.resetAllMocks(); usarTransaccionFalsa(); esquema.mockResolvedValue(true); relacionadas.mockResolvedValue({ recepcion: null });
  jest.mocked(Pedido.findByPk).mockResolvedValue({ id: 42, proveedorId: 5, estado: 'REALIZADO', update: pedidoUpdate } as unknown as Pedido);
  jest.mocked(DetallePedido.findAll).mockResolvedValue([{ productoId: 1, cantidad: 100, numeroItem: 1 }] as DetallePedido[]);
  jest.mocked(Producto.findByPk).mockImplementation(async id => ({ id: Number(id), nombre: `Producto ${id}`, unidadVenta: 'UNIDADES', activo: true, update: productoUpdate }) as unknown as Producto);
  jest.mocked(Proveedor.findByPk).mockResolvedValue({ id: 5, activo: true, ctaCte: true } as Proveedor);
  recepcionCrear.mockResolvedValue({ id: 7, pedidoId: 42, proveedorId: 5, fechaHora: new Date() });
  recepcionBuscar.mockResolvedValue({ id: 7, pedidoId: 42, proveedorId: 5, compra: null });
  compraCrear.mockResolvedValue({ id: 8, recepcionId: 7 });
  jest.mocked(DetalleRecepcion.findAll).mockResolvedValue([{ productoId: 1, cantidadBase: 110, cantidadPresentacion: 11, factorConversion: 10, presentacion: 'CAJA' }] as DetalleRecepcion[]);
});
const recibir = { pedidoId: 42, detalles: [{ productoId: 1, presentacion: 'UNIDAD', cantidadPresentacion: 110, factorConversion: 1 }, { productoId: 2, presentacion: 'UNIDAD', cantidadPresentacion: 120, factorConversion: 1 }] };
const comprar = { recepcionId: 7, detalles: [{ productoId: 1, costo: '2200.00' }] };
test('recibe sobrantes y productos extra sin compra y genera solo los ingresos aceptados', async () => {
  await servicio.crearRecepcion(recibir);
  expect(recepcionCrear).toHaveBeenCalledWith(expect.objectContaining({ pedidoId: 42, usuarioId: 1, conformidad: 'CON_DIFERENCIAS' }), expect.any(Object));
  expect(movimientos.registrarIngreso).toHaveBeenNthCalledWith(1, 1, 110, 1, 'RECEPCION', null, expect.any(Object), 7);
  expect(movimientos.registrarIngreso).toHaveBeenNthCalledWith(2, 2, 120, 1, 'RECEPCION', null, expect.any(Object), 7);
  expect(productoUpdate).not.toHaveBeenCalled(); expect(CuentaProveedor.create).not.toHaveBeenCalled();
  expect(pedidoUpdate).toHaveBeenCalledWith(expect.objectContaining({ estado: 'RECIBIDO' }), expect.any(Object));
});
test('compra lo aceptado, calcula el costo unitario, crea deuda y enlaza los movimientos existentes', async () => {
  await servicio.crearCompra(comprar);
  expect(compraCrear).toHaveBeenCalledWith(expect.objectContaining({ recepcionId: 7, pedidoId: 42, total: '2200.00', formaPago: 'A CUENTA', tipoComprobante: null, numeroComprobante: null }), expect.any(Object));
  expect(detalleCrear).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 110, cantidadPresentacion: 11, factorConversion: 10, importeUnitario: '20.00', subtotal: '2200.00' }), expect.any(Object));
  expect(productoUpdate).toHaveBeenCalledWith({ costoActual: '20.00' }, expect.any(Object));
  expect(MovimientoStock.update).toHaveBeenCalledWith({ compraId: 8 }, expect.objectContaining({ where: { recepcionId: 7, compraId: null } }));
  expect(movimientos.registrarIngreso).not.toHaveBeenCalled();
  expect(CuentaProveedor.create).toHaveBeenCalled();
});
test('conserva el costo total facturado aunque el costo unitario se redondee', async () => {
  jest.mocked(DetalleRecepcion.findAll).mockResolvedValue([{ productoId: 1, cantidadBase: 3, cantidadPresentacion: 3, factorConversion: 1, presentacion: 'UNIDAD' }] as DetalleRecepcion[]);
  await servicio.crearCompra({ ...comprar, detalles: [{ productoId: 1, costo: '100.00' }] });
  expect(detalleCrear).toHaveBeenCalledWith(expect.objectContaining({ importeUnitario: '33.33', subtotal: '100.00' }), expect.any(Object));
});
test('sin cuenta corriente queda pagado; pagar en el momento no genera deuda', async () => {
  jest.mocked(Proveedor.findByPk).mockResolvedValue({ activo: true, ctaCte: false } as Proveedor);
  await servicio.crearCompra(comprar);
  expect(compraCrear).toHaveBeenCalledWith(expect.objectContaining({ formaPago: 'PAGADO' }), expect.any(Object));
  expect(CuentaProveedor.create).not.toHaveBeenCalled();
  await expect(servicio.crearCompra({ ...comprar, formaPago: 'A CUENTA' })).rejects.toThrow('PAGADO');
});
test('rechaza costos iguales o menores a cero', async () => {
  for (const costo of [0, '0', '0.00', -1, '-1']) {
    await expect(servicio.crearCompra({ ...comprar, detalles: [{ productoId: 1, costo }] })).rejects.toThrow('mayor a cero');
  }
  expect(compraCrear).not.toHaveBeenCalled();
  expect(detalleCrear).not.toHaveBeenCalled();
});
test('rechaza compra sin recepción, cantidades editadas y una segunda compra de la misma recepción', async () => {
  await expect(servicio.crearCompra({ pedidoId: 42, detalles: comprar.detalles })).rejects.toThrow('recepcionId');
  await expect(servicio.crearCompra({ ...comprar, detalles: [{ ...comprar.detalles[0], cantidad: 5 }] })).rejects.toThrow('no se pueden modificar');
  recepcionBuscar.mockResolvedValue({ pedidoId: 42, proveedorId: 5, compra: { id: 8 } });
  await expect(servicio.crearCompra(comprar)).rejects.toMatchObject({ status: 409 });
  expect(compraCrear).not.toHaveBeenCalled();
});
test('la transición pendiente no crea una compra ni recepción ficticias', async () => {
  esquema.mockResolvedValue(false);
  await expect(servicio.crearRecepcion(recibir)).rejects.toMatchObject({ status: 409 });
  await expect(servicio.crearCompra(comprar)).rejects.toMatchObject({ status: 409 });
  expect(recepcionCrear).not.toHaveBeenCalled(); expect(compraCrear).not.toHaveBeenCalled(); expect(movimientos.registrarIngreso).not.toHaveBeenCalled();
});
