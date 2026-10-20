// Doble de prueba de polleria-database/repositories/cuentaProveedorRepository.
export const instancia = {
  crear: jest.fn(),
  actualizar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarTodas: jest.fn(),
  listarPaginados: jest.fn(),
  buscarPorProveedor: jest.fn(),
  buscarPorCompra: jest.fn(),
  buscarPorEstado: jest.fn(),
  buscarPendientesPorProveedor: jest.fn(),
  buscarPagadasPorProveedor: jest.fn(),
  actualizarSaldoYEstado: jest.fn(),
  buscarPagosAplicados: jest.fn(),
};

const CuentaProveedorRepository = jest.fn(() => instancia);

export default CuentaProveedorRepository;
