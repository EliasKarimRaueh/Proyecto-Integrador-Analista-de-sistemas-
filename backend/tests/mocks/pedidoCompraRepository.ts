export const instancia = {
  crear: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorIdConBloqueo: jest.fn(),
  buscarDetalle: jest.fn(),
  listar: jest.fn(),
  actualizarEstado: jest.fn(),
};

const PedidoCompraRepository = jest.fn(() => instancia);

export default PedidoCompraRepository;
