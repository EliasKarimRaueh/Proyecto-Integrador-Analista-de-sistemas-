// Doble de prueba de polleria-database/repositories/pagoPorCuentaRepository.
export const instancia = {
  crear: jest.fn(),
  actualizar: jest.fn(),
  buscarPorPago: jest.fn(),
  buscarPorCuenta: jest.fn(),
  buscarPorPagoYCuenta: jest.fn(),
  buscarTodas: jest.fn(),
  listarPaginados: jest.fn(),
  buscarPorProveedor: jest.fn(),
  sumarImportesAplicadosPorPago: jest.fn(),
  sumarImportesAplicadosPorCuenta: jest.fn(),
  aplicarPagoAProveedor: jest.fn(),
};

const PagoPorCuentaRepository = jest.fn(() => instancia);

export default PagoPorCuentaRepository;
