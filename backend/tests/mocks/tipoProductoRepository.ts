// Doble de prueba de polleria-database/repositories/tipoProductoRepository.
// Lo consume productoController para resolver el mapa de categorías
// (getCategoryMap) y para crear la categoría si no existe (findOrCreateCategory).

export const instancia = {
  findAll: jest.fn(),
  create: jest.fn(),
};

const TipoProductoRepository = jest.fn(() => instancia);

export default TipoProductoRepository;