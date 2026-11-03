export const instancia = {
  crear: jest.fn(),
  buscarPorCompra: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

const RecepcionRepository = jest.fn(() => instancia);

export default RecepcionRepository;
