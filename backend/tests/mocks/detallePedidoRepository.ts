export const instancia = {
  crear: jest.fn(),
  crearMuchos: jest.fn(),
  buscarPorPedido: jest.fn(),
};

const DetallePedidoRepository = jest.fn(() => instancia);

export default DetallePedidoRepository;
