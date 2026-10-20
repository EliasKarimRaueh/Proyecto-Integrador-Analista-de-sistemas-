// Doble de prueba de polleria-database/repositories/productoProveedorRepository.
// Los servicios de catálogo lo instancian a nivel de módulo, así que el mock
// exporta un CONSTRUCTOR y una instancia compartida.
export const instancia = {
  findByRelation: jest.fn(),
  existsRelation: jest.fn(),
  getProveedores: jest.fn(),
  getProveedoresActivos: jest.fn(),
  getProductos: jest.fn(),
  getProductosActivos: jest.fn(),
  create: jest.fn(),
  updateRelation: jest.fn(),
  activateRelation: jest.fn(),
  deleteRelation: jest.fn(),
};

const ProductoProveedorRepository = jest.fn(() => instancia);

export default ProductoProveedorRepository;
