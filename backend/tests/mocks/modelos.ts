// Dobles de prueba de los modelos Sequelize de polleria-database.
//
// stockController consulta los modelos directamente (Producto.findAndCountAll,
// Producto.findByPk, MovimientoStock.findAndCountAll) en vez de pasar por un
// repositorio, y operaciones.ts usa Producto.findByPk, Oferta.findByPk y
// Venta.create. Los modelos reales ejecutan Model.init() contra la instancia de
// Sequelize al importarse, así que sin estos dobles la suite depende de la base.

export const ProductoModel = {
  findByPk: jest.fn(),
  findAndCountAll: jest.fn(),
};

export const OfertaModel = {
  findByPk: jest.fn(),
};

export const VentaModel = {
  create: jest.fn(),
};

export const MovimientoStockModel = {
  findAndCountAll: jest.fn(),
};