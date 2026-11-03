export const instancia = {
  crear: jest.fn(),
  crearMuchos: jest.fn(),
  buscarPorRecepcion: jest.fn(),
};

const DetalleRecepcionRepository = jest.fn(() => instancia);

export default DetalleRecepcionRepository;
