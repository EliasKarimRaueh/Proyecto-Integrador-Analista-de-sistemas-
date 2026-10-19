// Doble de prueba de polleria-database/repositories/ofertaProductoRepository.
// Lo consume ofertaController.ts:12.
//
// Nota: cargarDetalle llama listarDetalleProductos con un solo argumento
// (ofertaController.ts:122) mientras getProductosDeOferta pasa el segundo
// (línea 370). El mock acepta ambos porque es un jest.fn() sin aridad fija.

export const instancia = {
  listarDetalleProductos: jest.fn(),
  listarDetalleOfertas: jest.fn(),
  crearOfertaConProductos: jest.fn(),
  updatePrecioOferta: jest.fn(),
  deleteByOfertaProducto: jest.fn(),
};

const OfertaProductoRepository = jest.fn(() => instancia);

export default OfertaProductoRepository;