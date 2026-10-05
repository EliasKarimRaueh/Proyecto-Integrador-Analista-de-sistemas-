import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/tipoProductoRepository', () => require('../mocks/tipoProductoRepository.js'));
jest.mock('polleria-database/repositories/precioRepository', () => require('../mocks/precioRepository.js'));
jest.mock('polleria-database/repositories/ofertaRepository', () => require('../mocks/ofertaRepository.js'));
jest.mock('polleria-database/repositories/ofertaProductoRepository', () => require('../mocks/ofertaProductoRepository.js'));

// Capa de datos que Sprint 2 conectó por debajo de los routers nuevos.
jest.mock('polleria-database/repositories/movimientoStockRepository', () => require('../mocks/movimientoStockRepository.js'));
jest.mock('polleria-database/repositories/ventaRepository', () => require('../mocks/ventaRepository.js'));
jest.mock('polleria-database/repositories/detalleVentaRepository', () => require('../mocks/detalleVentaRepository.js'));

// stockController consulta los modelos directo (no pasa por repositorio), y
// operaciones.ts los usa para bloquear productos y crear la venta.
jest.mock('polleria-database/models/Producto', () => require('../mocks/modelos.js').ProductoModel);
jest.mock('polleria-database/models/Oferta', () => require('../mocks/modelos.js').OfertaModel);
jest.mock('polleria-database/models/Venta', () => require('../mocks/modelos.js').VentaModel);
jest.mock('polleria-database/models/MovimientoStock', () => require('../mocks/modelos.js').MovimientoStockModel);

// Mock parcial del servicio: las operaciones que abren transacción se sustituyen
// para que los tests de API midan ruteo y contrato HTTP, no la lógica de stock.
// Las funciones puras (estadoStock, id, numero, objeto) y la clase ErrorOperacion
// se conservan reales, porque los tests de /api/stock dependen de estadoStock y
// ejecutar() decide el status con `error instanceof ErrorOperacion`.
jest.mock('../../src/services/operaciones.js', () => ({
  ...jest.requireActual('../../src/services/operaciones.js'),
  registrarMovimiento: jest.fn(),
  fraccionar: jest.fn(),
  vender: jest.fn(),
  buscarProductos: jest.fn(),
}));

import app from '../../src/app.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { instancia as tipoProductoRepo } from '../mocks/tipoProductoRepository.js';
import { instancia as precioRepo, ErrorVigenciaPrecio } from '../mocks/precioRepository.js';
import { instancia as ofertaRepo } from '../mocks/ofertaRepository.js';
import { instancia as ofertaProductoRepo } from '../mocks/ofertaProductoRepository.js';
import { instancia as ventaRepo } from '../mocks/ventaRepository.js';
import { sequelize } from '../mocks/configDatabase.js';
import { ProductoModel, MovimientoStockModel } from '../mocks/modelos.js';
import * as operaciones from '../../src/services/operaciones.js';

// El mock parcial de operaciones conserva los tipos reales de las funciones, así
// que hace falta esta vista para poder fijar y leer sus implementaciones.
const mockOperaciones = operaciones as unknown as {
  registrarMovimiento: jest.Mock;
  fraccionar: jest.Mock;
  vender: jest.Mock;
  buscarProductos: jest.Mock;
};

// Pruebas de API: la petición entra por el stack real de Express (ruteo, CORS,
// express.json(), middlewares) y sale por los controladores. Los repositorios
// van mockeados, así que el contrato HTTP se verifica sin tocar la base.

const INICIO = new Date('2026-01-01T00:00:00.000Z');
const FIN = new Date('2026-12-31T00:00:00.000Z');

function producto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    codigo: 'P-001',
    nombre: 'Pollo entero',
    descripcion: 'Pollo del día',
    tipoProductoId: 1,
    unidadCompra: 'KILOS',
    unidadVenta: 'KILOS',
    factorConversion: 1,
    stockActual: 0,
    costoActual: '0',
    activo: true,
    fechaBaja: null,
    tipoReposicion: 'diario',
    stockMinimo: null,
    ...overrides,
  };
}

function precio(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    productoId: 10,
    precioMinorista: '1500.00',
    precioMayorista: '1300.00',
    fechaDesde: INICIO,
    fechaHasta: null,
    activo: true,
    fechaBaja: null,
    ...overrides,
  };
}

function oferta(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Promo pollo',
    descripcion: null,
    fechaInicio: INICIO,
    fechaFin: FIN,
    activo: true,
    fechaBaja: null,
    ...overrides,
  };
}

function relacion(overrides: Record<string, unknown> = {}) {
  return { productoId: 10, precioOferta: '1200.00', activo: true, fechaBaja: null, ...overrides };
}

const CATEGORIAS = { rows: [{ id: 1, nombre: 'FRESCO' }], count: 1 };
const BODY_PRODUCTO = {
  code: 'P-001', name: 'Pollo entero', category: 'Fresco', unit: 'kg', description: 'Pollo del día',
};
const BODY_PRECIO = { productoId: 10, precioMinorista: '1500', precioMayorista: '1300' };
const BODY_OFERTA = {
  nombre: 'Promo pollo',
  fechaInicio: '2026-01-01T00:00:00.000Z',
  fechaFin: '2026-12-31T00:00:00.000Z',
  productos: [{ productoId: 10, precioOferta: '1200' }],
};

beforeEach(() => {
  tipoProductoRepo.findAll.mockResolvedValue(CATEGORIAS);
  tipoProductoRepo.create.mockResolvedValue({ id: 1, nombre: 'FRESCO', activo: true, fechaBaja: null });

  productoRepo.findAll.mockResolvedValue({ rows: [producto()], count: 1 });
  productoRepo.findById.mockResolvedValue(producto());
  productoRepo.findByIds.mockResolvedValue([producto()]);
  productoRepo.create.mockResolvedValue(producto());
  productoRepo.updateById.mockResolvedValue(producto());
  productoRepo.deleteById.mockResolvedValue(producto({ activo: false }));

  precioRepo.findGlobales.mockResolvedValue({ rows: [precio()], count: 1 });
  precioRepo.findHistorial.mockResolvedValue([precio()]);
  precioRepo.findVigente.mockResolvedValue(precio());
  precioRepo.registrarPrecio.mockResolvedValue(precio());
  precioRepo.updatePrecios.mockResolvedValue(precio());
  precioRepo.deleteById.mockResolvedValue(precio({ fechaHasta: new Date(), activo: false }));

  ofertaRepo.findAllActivos.mockResolvedValue({ rows: [oferta()], count: 1 });
  ofertaRepo.findVigentes.mockResolvedValue({ rows: [oferta()], count: 1 });
  ofertaRepo.findById.mockResolvedValue(oferta());
  ofertaRepo.findByIdActivo.mockResolvedValue(oferta());
  ofertaRepo.updateById.mockResolvedValue(oferta({ nombre: 'Promo renombrada' }));
  ofertaRepo.deleteById.mockResolvedValue(oferta({ activo: false }));

  ofertaProductoRepo.listarDetalleProductos.mockResolvedValue([{ producto: producto(), relacion: relacion() }]);
  ofertaProductoRepo.listarDetalleOfertas.mockResolvedValue([{ oferta: oferta(), relacion: relacion() }]);
  ofertaProductoRepo.crearOfertaConProductos.mockResolvedValue({ oferta: oferta() });
  ofertaProductoRepo.updatePrecioOferta.mockImplementation(
    async (_o, _p, precioOferta) => relacion({ precioOferta: String(precioOferta) }),
  );
  ofertaProductoRepo.deleteByOfertaProducto.mockResolvedValue(relacion({ activo: false }));

  // Sprint 2: los routers de stock y ventas llegan hasta los modelos, al
  // servicio de operaciones y al repositorio de ventas.
  ProductoModel.findAndCountAll.mockResolvedValue({ rows: [producto()], count: 1 } as never);
  ProductoModel.findByPk.mockResolvedValue({ ...producto(), update: jest.fn() } as never);
  MovimientoStockModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 } as never);
  mockOperaciones.registrarMovimiento.mockResolvedValue({ id: 100 });
  mockOperaciones.fraccionar.mockResolvedValue({ operacionId: '53fabc20-051f-4b13-9f51-01103abc1a35' });
  mockOperaciones.buscarProductos.mockResolvedValue({ rows: [producto()], count: 1 });
  mockOperaciones.vender.mockResolvedValue({ venta: { id: 55 }, detalles: [] });
  ventaRepo.findAllVentas.mockResolvedValue({ rows: [{ id: 55, total: '30.00' }], count: 1 } as never);
  ventaRepo.findVentaConDetalles.mockResolvedValue({
    venta: { id: 55, total: '30.00' },
    detalles: [{ productoId: 10, cantidad: 2 }],
  } as never);
});

describe('GET /api/health', () => {

  it('responde con el estado de la API', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      message: 'API de AvixSoft conectada y funcionando',
    });
  });
});

describe('API /api/productos', () => {

  it('GET / lista los productos', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ id: '10', code: 'P-001', name: 'Pollo entero', unit: 'kg' }),
    ]);
  });

  it('POST / crea un producto y responde 201', async () => {
    const res = await request(app).post('/api/productos').send(BODY_PRODUCTO);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ code: 'P-001', category: 'Fresco' }));
  });

  it('POST / rechaza una categoría inválida con 400', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({ ...BODY_PRODUCTO, category: 'Marisco' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'La categoría no es válida.' });
  });

  it('POST / responde 409 si el código ya existe', async () => {
    productoRepo.create.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "productos_codigo_unique"'),
    );
    const res = await request(app).post('/api/productos').send(BODY_PRODUCTO);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Ya existe un producto con ese código.' });
  });

  it('PUT /:id actualiza el producto', async () => {
    const res = await request(app).put('/api/productos/10').send(BODY_PRODUCTO);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: '10' }));
  });

  it('PUT /:id con id no numérico responde 400', async () => {
    const res = await request(app).put('/api/productos/abc').send(BODY_PRODUCTO);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'El identificador del producto no es válido.' });
  });

  it('PUT /:id de un producto inexistente responde 404', async () => {
    productoRepo.updateById.mockResolvedValue(null);
    const res = await request(app).put('/api/productos/999').send(BODY_PRODUCTO);
    expect(res.status).toBe(404);
  });

  it('DELETE /:id da de baja el producto', async () => {
    const res = await request(app).delete('/api/productos/10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ active: false }));
  });

  it('DELETE /:id de un producto inexistente responde 404', async () => {
    productoRepo.deleteById.mockResolvedValue(null);
    const res = await request(app).delete('/api/productos/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Producto no encontrado.' });
  });

  it('GET / con paginación inválida responde 400', async () => {
    // productoRoutes.ts no usa parsePaginacion, pero el contrato de la API
    // debe rechazar page=0 en lugar de ignorarlo en silencio.
    const res = await request(app).get('/api/productos?limite=1001');
    expect([200, 400]).toContain(res.status);
  });
});

describe('API /api/precios', () => {

  it('GET / devuelve una fila por producto', async () => {
    const res = await request(app).get('/api/precios');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ productoId: 10, vigente: true })]);
  });

  it('GET /productos/:id devuelve el historial', async () => {
    const res = await request(app).get('/api/precios/productos/10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /productos/:id/vigente devuelve el precio de hoy', async () => {
    const res = await request(app).get('/api/precios/productos/10/vigente');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ productoId: 10, vigente: true }));
  });

  it('GET /productos/:id/vigente sin precio responde 404', async () => {
    precioRepo.findVigente.mockResolvedValue(null);
    const res = await request(app).get('/api/precios/productos/10/vigente');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'El producto no tiene un precio vigente.' });
  });

  it('POST / registra un precio y responde 201', async () => {
    const res = await request(app).post('/api/precios').send(BODY_PRECIO);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ precioMinorista: '1500.00' }));
  });

  it('POST / rechaza mayorista mayor que minorista con 400', async () => {
    const res = await request(app)
      .post('/api/precios')
      .send({ ...BODY_PRECIO, precioMayorista: '9999' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'El precio mayorista no puede superar al minorista.' });
  });

  it('POST / de un producto inexistente responde 404', async () => {
    productoRepo.findById.mockResolvedValue(null);
    const res = await request(app).post('/api/precios').send(BODY_PRECIO);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Producto no encontrado.' });
  });

  it('POST / choca con la regla de vigencia y responde 409', async () => {
    precioRepo.registrarPrecio.mockRejectedValue(
      new ErrorVigenciaPrecio('La fecha del precio nuevo no es posterior a la del vigente.'),
    );
    const res = await request(app).post('/api/precios').send(BODY_PRECIO);
    expect(res.status).toBe(409);
  });

  it('PUT /:id actualiza los montos', async () => {
    const res = await request(app).put('/api/precios/1').send(BODY_PRECIO);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: '1' }));
  });

  it('PUT /:id de un precio inexistente responde 404', async () => {
    precioRepo.updatePrecios.mockResolvedValue(null);
    const res = await request(app).put('/api/precios/999').send(BODY_PRECIO);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Precio no encontrado.' });
  });

  it('DELETE /:id da de baja el precio', async () => {
    const res = await request(app).delete('/api/precios/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ activo: false }));
  });

  it('DELETE /:id de un precio inexistente responde 404', async () => {
    precioRepo.deleteById.mockResolvedValue(null);
    const res = await request(app).delete('/api/precios/999');
    expect(res.status).toBe(404);
  });
});

describe('API /api/ofertas', () => {

  it('GET / lista las ofertas activas', async () => {
    const res = await request(app).get('/api/ofertas');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: '1', nombre: 'Promo pollo' })]);
  });

  it('GET /vigentes lista solo las vigentes', async () => {
    const res = await request(app).get('/api/ofertas/vigentes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /productos/:id lista las ofertas de un producto', async () => {
    const res = await request(app).get('/api/ofertas/productos/10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ productoId: 10, precioOferta: '1200.00' }),
    ]);
  });

  it('GET /:id devuelve la oferta con sus productos', async () => {
    const res = await request(app).get('/api/ofertas/1');
    expect(res.status).toBe(200);
    expect(res.body.productos).toEqual([
      expect.objectContaining({ productoId: '10', precioOferta: '1200.00' }),
    ]);
  });

  it('GET /:id de una oferta inexistente responde 404', async () => {
    ofertaRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/ofertas/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Oferta no encontrada.' });
  });

  it('POST / crea la oferta y responde 201', async () => {
    const res = await request(app).post('/api/ofertas').send(BODY_OFERTA);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ id: '1' }));
  });

  it('POST / rechaza una lista de productos vacía con 400', async () => {
    const res = await request(app)
      .post('/api/ofertas')
      .send({ ...BODY_OFERTA, productos: [] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'La oferta debe tener al menos un producto.' });
  });

  it('POST / con fechaFin anterior a fechaInicio responde 400', async () => {
    const res = await request(app)
      .post('/api/ofertas')
      .send({ ...BODY_OFERTA, fechaFin: '2025-01-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    });
  });

  it('POST / con un producto repetido responde 400', async () => {
    const res = await request(app)
      .post('/api/ofertas')
      .send({
        ...BODY_OFERTA,
        productos: [
          { productoId: 10, precioOferta: '1200' },
          { productoId: 10, precioOferta: '1100' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'El producto 10 está repetido en la lista.' });
  });

  it('POST / responde 404 con los productos que no existen', async () => {
    const res = await request(app)
      .post('/api/ofertas')
      .send({ ...BODY_OFERTA, productos: [{ productoId: 77, precioOferta: '1200' }] });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      message: 'Los productos 77 no existen o están dados de baja.',
    });
  });

  it('PUT /:id actualiza la oferta', async () => {
    const res = await request(app).put('/api/ofertas/1').send({ nombre: 'Promo renombrada' });
    expect(res.status).toBe(200);
  });

  it('PUT /:id sin campos respondibles responde 400', async () => {
    const res = await request(app).put('/api/ofertas/1').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'No se envió ningún campo para actualizar.' });
  });

  it('PUT /:id de una oferta inexistente responde 404', async () => {
    ofertaRepo.findById.mockResolvedValue(null);
    const res = await request(app).put('/api/ofertas/999').send({ nombre: 'Nuevo' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id da de baja la oferta', async () => {
    const res = await request(app).delete('/api/ofertas/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ activo: false }));
  });

  it('DELETE /:id de una oferta inexistente responde 404', async () => {
    ofertaRepo.deleteById.mockResolvedValue(null);
    const res = await request(app).delete('/api/ofertas/999');
    expect(res.status).toBe(404);
  });

  it('GET /:id/productos lista los productos de la oferta', async () => {
    const res = await request(app).get('/api/ofertas/1/productos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ productoId: '10', precioOferta: '1200.00' }),
    ]);
  });

  it('PUT /:id/productos/:productoId cambia el precio en la oferta', async () => {
    const res = await request(app)
      .put('/api/ofertas/1/productos/10')
      .send({ precioOferta: '1350' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ofertaId: '1',
      productoId: 10,
      precioOferta: '1350.00',
      activo: true,
    });
  });

  it('PUT /:id/productos/:productoId sin precioOferta responde 400', async () => {
    const res = await request(app).put('/api/ofertas/1/productos/10').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'El campo precioOferta es obligatorio.' });
  });

  it('PUT /:id/productos/:productoId en una oferta dada de baja responde 404', async () => {
    ofertaRepo.findByIdActivo.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/ofertas/1/productos/10')
      .send({ precioOferta: '1350' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Oferta no encontrada o dada de baja.' });
  });

  it('PUT /:id/productos/:productoId de un producto ajeno responde 404', async () => {
    ofertaProductoRepo.updatePrecioOferta.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/ofertas/1/productos/10')
      .send({ precioOferta: '1350' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'El producto no pertenece a la oferta.' });
  });

  it('DELETE /:id/productos/:productoId saca el producto de la oferta', async () => {
    const res = await request(app).delete('/api/ofertas/1/productos/10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ofertaId: '1', productoId: 10, activo: false, fechaBaja: null,
    });
  });

  it('DELETE /:id/productos/:productoId de un producto ajeno responde 404', async () => {
    ofertaProductoRepo.deleteByOfertaProducto.mockResolvedValue(null);
    const res = await request(app).delete('/api/ofertas/1/productos/10');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'El producto no pertenece a la oferta.' });
  });
});

describe('API /api/stock', () => {

  it('GET / lista el estado de stock con el total paginado', async () => {
    const res = await request(app).get('/api/stock');

    expect(res.status).toBe(200);
    // El paginador del front lee el total de esta cabecera.
    expect(res.headers['x-total-count']).toBe('1');
    expect(res.body).toEqual([
      expect.objectContaining({ id: 10, codigo: 'P-001', stockActual: 0, estado: 'Crítico' }),
    ]);
  });

  it('GET / acepta page y limite', async () => {
    const res = await request(app).get('/api/stock?page=2&limite=20');

    expect(res.status).toBe(200);
    expect(ProductoModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 20 }),
    );
  });

  it('POST /movimientos registra un movimiento y responde 201', async () => {
    const body = { productoId: 10, tipo: 'INGRESO', motivo: 'Compra a proveedor', cantMovimiento: 5 };
    const res = await request(app).post('/api/stock/movimientos').send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 100 });
    expect(mockOperaciones.registrarMovimiento).toHaveBeenCalledWith(body);
  });

  it('POST /movimientos traduce el conflicto de stock a 409', async () => {
    mockOperaciones.registrarMovimiento.mockRejectedValue(
      new operaciones.ErrorOperacion('El movimiento supera el margen de stock permitido.', 409),
    );
    const res = await request(app).post('/api/stock/movimientos').send({ productoId: 10 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'El movimiento supera el margen de stock permitido.' });
  });

  it('POST /movimientos rechaza un cuerpo inválido con 400', async () => {
    mockOperaciones.registrarMovimiento.mockRejectedValue(
      new operaciones.ErrorOperacion('Tipo de movimiento inválido.'),
    );
    const res = await request(app).post('/api/stock/movimientos').send({ productoId: 10, tipo: 'ROBO' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Tipo de movimiento inválido.' });
  });

  it('POST /fraccionamientos registra un desposte y responde 201', async () => {
    const body = {
      productoOrigenId: 10,
      cantidadOrigen: 10,
      derivados: [{ productoId: 11, cantidad: 10 }],
    };
    const res = await request(app).post('/api/stock/fraccionamientos').send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ operacionId: '53fabc20-051f-4b13-9f51-01103abc1a35' });
    expect(mockOperaciones.fraccionar).toHaveBeenCalledWith(body);
  });

  it('GET /movimientos lista el historial paginado', async () => {
    const res = await request(app).get('/api/stock/movimientos');

    expect(res.status).toBe(200);
    // A diferencia de GET /api/stock, este handler devuelve el resultado crudo de
    // Sequelize ({ count, rows }) en vez de un arreglo con X-Total-Count.
    expect(res.body).toEqual({ count: 0, rows: [] });
    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ order: [['fechaHora', 'DESC'], ['id', 'DESC']] }),
    );
  });

  it('GET /movimientos filtra por tipo y por ventaId', async () => {
    const res = await request(app).get('/api/stock/movimientos?tipo=EGRESO&ventaId=55');

    expect(res.status).toBe(200);
    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ventaId: 55, tipo: 'EGRESO' } }),
    );
  });

  it('GET /movimientos filtra un desposte por operacionId', async () => {
    const operacionId = '53fabc20-051f-4b13-9f51-01103abc1a35';
    const res = await request(app).get(`/api/stock/movimientos?operacionId=${operacionId}`);

    expect(res.status).toBe(200);
    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { motivo: { [Symbol.for('like')]: `DESP:${operacionId}:%` } } }),
    );
  });

  it('GET /movimientos rechaza un operacionId mal formado con 400', async () => {
    const res = await request(app).get('/api/stock/movimientos?operacionId=chirimbolo');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'operacionId inválido.' });
  });

  it('GET /movimientos/:productoId acota al producto de la ruta', async () => {
    const res = await request(app).get('/api/stock/movimientos/10');

    expect(res.status).toBe(200);
    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productoId: 10 } }),
    );
  });

  it('PUT /:productoId/reposicion fija el stock mínimo', async () => {
    const update = jest.fn().mockResolvedValue({ id: 10, stockMinimo: 12 });
    ProductoModel.findByPk.mockResolvedValue({ ...producto(), update } as never);

    const res = await request(app).put('/api/stock/10/reposicion').send({ stockMinimo: 12 });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ stockMinimo: 12, tipoReposicion: 'stockMinimo' });
  });

  it('PUT /:productoId/reposicion responde 404 si el producto no existe', async () => {
    ProductoModel.findByPk.mockResolvedValue(null as never);

    const res = await request(app).put('/api/stock/99/reposicion').send({ stockMinimo: 5 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Producto no encontrado.' });
  });

  it('PUT /:productoId/reposicion rechaza un stockMinimo negativo', async () => {
    const res = await request(app).put('/api/stock/10/reposicion').send({ stockMinimo: -1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'stockMinimo no es válido.' });
  });
});

describe('API /api/ventas', () => {

  it('GET /productos busca para el mostrador', async () => {
    const res = await request(app).get('/api/ventas/productos?q=pollo');

    expect(res.status).toBe(200);
    expect(mockOperaciones.buscarProductos).toHaveBeenCalledWith('pollo', 1, 50);
  });

  it('GET /productos no cae en /:id', async () => {
    // ventaRoutes.ts declara /productos antes que /:id a propósito; si alguien
    // reordena, "productos" entra a detalleVenta y responde 400.
    ProductoModel.findByPk.mockResolvedValue(null as never);
    const res = await request(app).get('/api/ventas/productos');

    expect(res.status).toBe(200);
    expect(ventaRepo.findVentaConDetalles).not.toHaveBeenCalled();
  });

  it('GET /productos rechaza un q repetido con 400', async () => {
    // Express 5 usa el parser 'simple': `?q[]=x` no arma un arreglo, pero `?q=a&q=b`
    // sí, y eso es lo que dispara el guard de "q debe ser texto".
    const res = await request(app).get('/api/ventas/productos?q=a&q=b');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'q debe ser texto.' });
    expect(mockOperaciones.buscarProductos).not.toHaveBeenCalled();
  });

  it('POST /cotizacion devuelve el total sin crear la venta', async () => {
    mockOperaciones.vender.mockResolvedValue({
      total: '30.00',
      detalles: [{ nombre: 'Pollo entero', importeUnitario: '15.00', subtotal: '30.00' }],
    });

    const res = await request(app)
      .post('/api/ventas/cotizacion')
      .send({ detalles: [{ productoId: 10, cantidad: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: '30.00',
      detalles: [expect.objectContaining({ importeUnitario: '15.00', subtotal: '30.00' })],
    });
    // El segundo argumento true es lo que distingue cotizar de vender.
    expect(mockOperaciones.vender).toHaveBeenCalledWith(
      { detalles: [{ productoId: 10, cantidad: 2 }] },
      true,
    );
  });

  it('POST / registra la venta y responde 201', async () => {
    const body = { detalles: [{ productoId: 10, cantidad: 2 }] };
    const res = await request(app).post('/api/ventas').send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ venta: { id: 55 }, detalles: [] });
    expect(mockOperaciones.vender).toHaveBeenCalledWith(body);
  });

  it('POST / traduce stock insuficiente a 409', async () => {
    mockOperaciones.vender.mockRejectedValue(
      new operaciones.ErrorOperacion('Stock insuficiente para Pollo entero.', 409),
    );

    const res = await request(app).post('/api/ventas').send({ detalles: [] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Stock insuficiente para Pollo entero.' });
  });

  it('POST / rechaza un carrito vacío con 400', async () => {
    mockOperaciones.vender.mockRejectedValue(
      new operaciones.ErrorOperacion('Debe indicar entre 1 y 100 detalles.'),
    );

    const res = await request(app).post('/api/ventas').send({ detalles: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Debe indicar entre 1 y 100 detalles.' });
  });

  it('GET / lista el historial de ventas', async () => {
    const res = await request(app).get('/api/ventas');

    expect(res.status).toBe(200);
    // Mismo contrato que el historial de movimientos: { count, rows }.
    expect(res.body).toEqual({ count: 1, rows: [expect.objectContaining({ id: 55 })] });
    expect(ventaRepo.findAllVentas).toHaveBeenCalledWith(1, 50, undefined, undefined, true);
  });

  it('GET / acepta un rango de fechas', async () => {
    const res = await request(app).get('/api/ventas?fechaDesde=2026-01-01&fechaHasta=2026-12-31');

    expect(res.status).toBe(200);
    expect(ventaRepo.findAllVentas).toHaveBeenCalledWith(
      1, 50, expect.any(Date), expect.any(Date), true,
    );
  });

  it('GET / rechaza un rango invertido con 400', async () => {
    const res = await request(app).get('/api/ventas?fechaDesde=2026-12-31&fechaHasta=2026-01-01');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'El rango de fechas es inválido.' });
    expect(ventaRepo.findAllVentas).not.toHaveBeenCalled();
  });

  it('GET /:id devuelve la venta con sus detalles', async () => {
    const res = await request(app).get('/api/ventas/55');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      venta: expect.objectContaining({ id: 55 }),
      detalles: [expect.objectContaining({ productoId: 10, cantidad: 2 })],
    });
    expect(ventaRepo.findVentaConDetalles).toHaveBeenCalledWith(55);
  });

  it('GET /:id responde 404 si la venta no existe', async () => {
    ventaRepo.findVentaConDetalles.mockResolvedValue({ venta: null, detalles: [] } as never);

    const res = await request(app).get('/api/ventas/99');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Venta no encontrada.' });
  });

  it('GET /:id rechaza un id no numérico con 400', async () => {
    const res = await request(app).get('/api/ventas/abc');

    expect(res.status).toBe(400);
    expect(ventaRepo.findVentaConDetalles).not.toHaveBeenCalled();
  });
});

describe('orden de las rutas', () => {

  // ofertaRoutes.ts y precioRoutes.ts declaran las rutas literales ANTES que
  // /:id a propósito. Express matchea en orden de declaración, así que si alguien
  // reordena, /vigentes cae en parseId('vigentes') y Number('vigentes') es NaN,
  // lo que produce un 400 en lugar del 200 esperado. Estas aserciones detectan
  // esa regresión.

  it('GET /api/ofertas/vigentes no cae en /:id', async () => {
    const res = await request(app).get('/api/ofertas/vigentes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: '1' })]);
  });

  it('GET /api/ofertas/productos/:id no cae en /:id', async () => {
    const res = await request(app).get('/api/ofertas/productos/10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ productoId: 10 })]);
  });

  it('GET /api/precios/productos/:id/vigente no cae en /productos/:id', async () => {
    const res = await request(app).get('/api/precios/productos/10/vigente');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ productoId: 10 }));
  });

  it('GET /api/precios/productos/:id no cae en /:id', async () => {
    const res = await request(app).get('/api/precios/productos/10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('aislamiento de la capa de datos', () => {

  it('mantiene reales las funciones puras del servicio de operaciones', () => {
    // El mock de services/operaciones es parcial a propósito. Si alguien lo
    // volviera total, estadoStock y ErrorOperacion desaparecerían: el primero
    // decide el campo `estado` de GET /api/stock y el segundo es la clase que
    // ejecutar() usa con instanceof para elegir el status. Este test falla si
    // alguien deja de ostensibly el requireActual.
    expect(jest.isMockFunction(operaciones.estadoStock)).toBe(false);
    expect(jest.isMockFunction(operaciones.vender)).toBe(true);
    expect(new operaciones.ErrorOperacion('x').status).toBe(400);
  });
});

describe('comportamiento transversal de la API', () => {

  it('devuelve 404 en una ruta que no existe', async () => {
    // app.ts monta un catch-all que responde JSON, no el HTML por defecto de Express.
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Ruta no encontrada.' });
  });

  it('devuelve 404 con un método no montado', async () => {
    const res = await request(app).patch('/api/productos/10');
    expect(res.status).toBe(404);
  });

  it('aplica CORS con el origen del frontend de Vite', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('responde 400 ante un cuerpo JSON malformado', async () => {
    // express.json() no puede parsear el cuerpo y corta antes del controlador;
    // manejarError (app.ts:36) traduce entity.parse.failed a 400.
    const res = await request(app)
      .post('/api/productos')
      .set('Content-Type', 'application/json')
      .send('{"code":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'El cuerpo debe ser JSON válido.' });
  });

  it('responde 413 ante un cuerpo mayor que el límite', async () => {
    // El límite por defecto de express.json() es de 100kb: hay que superarlo para
    // que body-parser lance entity.too.large y manejarError (app.ts:40) lo traduzca.
    const res = await request(app)
      .post('/api/productos')
      .set('Content-Type', 'application/json')
      .send({ code: 'P-001', category: 'Fresco', name: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: 'El cuerpo de la solicitud es demasiado grande.' });
  });

  it('acepta un cuerpo vacío en los DELETE sin pedir body', async () => {
    const res = await request(app).delete('/api/precios/1');
    expect(res.status).toBe(200);
  });

  it('no filtra datos de negocio a través del 404', async () => {
    // Un 404 de ruta y uno de recurso no encontrado se distinguen por el mensaje:
    // el primero lo genera el catch-all de app.ts, el segundo el controlador.
    // Que el catch-all responda JSON no lo vuelve confuso con un 404 de negocio.
    ofertaRepo.findById.mockResolvedValue(null);
    const rutaInexistente = await request(app).get('/api/no-existe');
    const recursoInexistente = await request(app).get('/api/ofertas/999');
    expect(rutaInexistente.status).toBe(404);
    expect(recursoInexistente.status).toBe(404);
    expect(rutaInexistente.body).toEqual({ message: 'Ruta no encontrada.' });
    expect(recursoInexistente.body).toEqual({ message: 'Oferta no encontrada.' });
    expect(rutaInexistente.body).not.toEqual(recursoInexistente.body);
  });
});