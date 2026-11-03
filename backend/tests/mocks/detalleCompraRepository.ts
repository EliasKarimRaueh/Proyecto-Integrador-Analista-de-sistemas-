export const instancia = {
  crear: jest.fn(),
  crearMuchos: jest.fn(),
  buscarPorCompra: jest.fn(),
};

const DetalleCompraRepository = jest.fn(() => instancia);

export default DetalleCompraRepository;
