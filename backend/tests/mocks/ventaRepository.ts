// Doble de prueba de polleria-database/repositories/ventaRepository.
// operacionesController.ts:20 lo instancia a nivel de módulo (`new
// VentaRepository()`) para historialVentas y detalleVenta. Los otros métodos
// (iniciarVenta y sus auxiliares) los ejercita backend/test/integration.test.ts
// contra PostgreSQL, así que acá solo hacen falta los dos que usa el controller.

export const instancia = {
  findAllVentas: jest.fn(),
  findVentaConDetalles: jest.fn(),
  iniciarVenta: jest.fn(),
};

const VentaRepository = jest.fn(() => instancia);

export default VentaRepository;