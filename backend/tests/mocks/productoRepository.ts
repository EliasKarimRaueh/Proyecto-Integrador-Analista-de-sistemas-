// Doble de prueba de polleria-database/repositories/productoRepository.
//
// Los controladores instancian los repositorios a nivel de módulo
// (productoController.ts:5, precioController.ts:11, ofertaController.ts:13),
// así que el mock tiene que exportar un CONSTRUCTOR, no una instancia. El
// test lo registra con:
//
//   jest.mock('polleria-database/repositories/productoRepository',
//             () => require('../mocks/productoRepository.js'));
//
// y después importa `instancia` desde este mismo archivo. Como el factory usa
// require y el módulo queda cacheado en el registro de Jest, la instancia que
// creó el controlador y la que importa el test son el mismo objeto.

export const instancia = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findBy: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
};

// Cuando un constructor devuelve un objeto, `new` usa ese objeto como
// resultado en lugar de `this`.
const ProductoRepository = jest.fn(() => instancia);

export default ProductoRepository;