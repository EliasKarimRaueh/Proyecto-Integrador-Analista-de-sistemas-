export const instancia = {
  crear: jest.fn(),
  crearMuchos: jest.fn(),
  buscarPorPedido: jest.fn(),
};

const DetallePedidoCompraRepository = jest.fn(() => instancia);

export default DetallePedidoCompraRepository;
