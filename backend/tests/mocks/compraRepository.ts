export const instancia = {
  buscarPorId: jest.fn(),
  buscarPorIdConBloqueo: jest.fn(),
  buscarDetalleCompleto: jest.fn(),
  buscarTodas: jest.fn(),
  buscarPorProveedor: jest.fn(),
  buscarPorFechas: jest.fn(),
  buscarPorProveedorYFechas: jest.fn(),
  listarConFiltros: jest.fn(),
  crear: jest.fn(),
  actualizar: jest.fn(),
};

const CompraRepository = jest.fn(() => instancia);

export default CompraRepository;
