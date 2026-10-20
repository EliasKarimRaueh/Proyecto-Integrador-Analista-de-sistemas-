// Doble de prueba de polleria-database/repositories/compraRepository.
export const instancia = {
  buscarPorId: jest.fn(),
  buscarTodas: jest.fn(),
  buscarPorProveedor: jest.fn(),
  buscarPorFechas: jest.fn(),
  buscarPorProveedorYFechas: jest.fn(),
  crear: jest.fn(),
  actualizar: jest.fn(),
};

const CompraRepository = jest.fn(() => instancia);

export default CompraRepository;
