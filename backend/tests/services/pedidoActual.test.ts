jest.mock('../../src/services/operaciones.js', () => ({ ...require('../../src/services/validacion.js'), validarCantidad: jest.fn() }));
jest.mock('../../../database/src/repositories/circuitoAbastecimientoRepository.js', () => ({ __esModule: true, default: jest.fn(() => ({})) }));
jest.mock('../../../database/src/repositories/pedidoRepository.js', () => require('../mocks/pedidoRepository.js'));
jest.mock('../../../database/src/repositories/detallePedidoRepository.js', () => require('../mocks/detallePedidoRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/productoProveedorRepository', () => require('../mocks/productoProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));
jest.mock('polleria-database/repositories/compraRepository', () => require('../mocks/compraRepository.js'));
jest.mock('polleria-database/repositories/detalleCompraRepository', () => require('../mocks/detalleCompraRepository.js'));
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
jest.mock('polleria-database/repositories/cuentaProveedorRepository', () => require('../mocks/cuentaProveedorRepository.js'));
import { registrarPedido } from '../../src/services/pedidos.js';
import { instancia as pedidos } from '../mocks/pedidoRepository.js';
import { instancia as detalles } from '../mocks/detallePedidoRepository.js';
import { instancia as productos } from '../mocks/productoRepository.js';
import { instancia as relaciones } from '../mocks/productoProveedorRepository.js';
import { instancia as proveedores } from '../mocks/proveedorRepository.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';
beforeEach(() => {
  jest.clearAllMocks(); usarTransaccionFalsa();
  productos.findById.mockResolvedValue({ id: 1, nombre: 'Pollo', activo: true, unidadVenta: 'KILOS', unidadCompra: 'CAJONES', factorConversion: 10, costoActual: '100.00' });
  proveedores.buscarPorId.mockResolvedValue({ id: 5, activo: true });
  relaciones.findByRelation.mockResolvedValue({ activo: true });
  pedidos.crear.mockResolvedValue({ id: 42 });
});
test('usa costo actual por cantidad de venta y deja la fecha a su valor por defecto', async () => {
  await registrarPedido({ proveedorId: 5, fechaHora: '2000-01-01', detalles: [{ productoId: 1, cantidad: 2, costoEstimado: 9999 }] });
  const cabecera = pedidos.crear.mock.calls[0][0];
  expect(cabecera).not.toHaveProperty('fechaHora'); expect(cabecera.totalEstimado).toBe('200.00');
  expect(detalles.crearMuchos).toHaveBeenCalledWith([expect.objectContaining({ costoEstimado: '100.00', cantidad: 2, subtotal: '200.00' })], expect.any(Object));
});
test('usa el factor del producto para calcular el costo de presentaciones de compra', async () => {
  await registrarPedido({ proveedorId: 5, detalles: [{ productoId: 1, cantidad: 999, cantidadPresentacion: 3, factorConversion: 999, costoEstimado: 1 }] });
  expect(detalles.crearMuchos).toHaveBeenCalledWith([expect.objectContaining({ cantidad: 30, cantidadPresentacion: 3, factorConversion: 10, costoEstimado: '100.00', subtotal: '3000.00' })], expect.any(Object));
});
