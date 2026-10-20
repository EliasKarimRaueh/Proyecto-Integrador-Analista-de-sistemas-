// Doble de prueba de polleria-database/repositories/pagoRepository.
export const instancia = {
  crear: jest.fn(),
  actualizar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarTodas: jest.fn(),
  listarPaginados: jest.fn(),
  buscarPorProveedor: jest.fn(),
  buscarPorFechas: jest.fn(),
  buscarPorProveedorYFechas: jest.fn(),
  buscarConSaldoPendiente: jest.fn(),
  actualizarSaldoPendiente: jest.fn(),
  buscarPagosPorCuenta: jest.fn(),
  registrarPagoYAplicar: jest.fn(),
};

const PagoRepository = jest.fn(() => instancia);

export default PagoRepository;
