export const instancia = {
  crear: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorIdConBloqueo: jest.fn(),
  buscarDetalle: jest.fn(),
  listar: jest.fn(),
  actualizarEstado: jest.fn(),
  updateById: jest.fn(),
};

const PedidoRepository = jest.fn(() => instancia);

export default PedidoRepository;
