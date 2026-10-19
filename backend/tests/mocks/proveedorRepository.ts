// Doble de prueba de polleria-database/repositories/proveedorRepository.
//
// proveedorController.ts:4 lo instancia a nivel de módulo (`new
// ProveedorRepository()`), así que el mock exporta un CONSTRUCTOR. El test lo
// registra con:
//
//   jest.mock('polleria-database/repositories/proveedorRepository',
//             () => require('../mocks/proveedorRepository.js'));
//
// y luego importa `instancia` desde este archivo. Como el factory usa require y
// el módulo queda cacheado en el registro de Jest, la instancia que creó el
// controlador y la que importa el test son el mismo objeto.

export const instancia = {
  buscarTodos: jest.fn(),
  buscarPorId: jest.fn(),
  crear: jest.fn(),
  actualizar: jest.fn(),
  eliminar: jest.fn(),
};

const ProveedorRepository = jest.fn(() => instancia);

export default ProveedorRepository;
