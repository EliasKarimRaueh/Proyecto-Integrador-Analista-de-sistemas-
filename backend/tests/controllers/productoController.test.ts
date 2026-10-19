import { beforeEach, describe, expect, it } from '@jest/globals';

// El factory usa require: el hoisting de @swc/jest sube la llamada al inicio y
// require queda permitido dentro del factory. El módulo queda cacheado en el
// registro de Jest, así que la instancia que creó el controlador y la que
// importa el test desde ../mocks son el mismo objeto.
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));
jest.mock('polleria-database/repositories/tipoProductoRepository', () => require('../mocks/tipoProductoRepository.js'));

import {
  getProductos, createProducto, updateProducto, deactivateProducto, reactivateProducto,
} from '../../src/controllers/productoController.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { instancia as tipoProductoRepo } from '../mocks/tipoProductoRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';

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

const CATEGORIAS = { rows: [{ id: 1, nombre: 'FRESCO' }, { id: 3, nombre: 'SECO ALMACEN' }], count: 2 };

const BODY_VALIDO = {
  code: 'p-001',
  name: '  Pollo entero  ',
  category: 'Fresco',
  unit: 'kg',
  description: '  Pollo del día  ',
};

beforeEach(() => {
  tipoProductoRepo.findAll.mockResolvedValue(CATEGORIAS);
  productoRepo.findAll.mockResolvedValue({ rows: [producto()], count: 1 });
  productoRepo.findById.mockResolvedValue(producto());
  productoRepo.create.mockResolvedValue(producto());
  productoRepo.updateById.mockResolvedValue(producto());
  productoRepo.deleteById.mockResolvedValue(producto({ activo: false }));
});

describe('getProductos', () => {

  it('mapea la fila de la base al contrato de la API', async () => {
    const res = crearRes();
    await getProductos(crearReq(), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([
      {
        id: '10',
        code: 'P-001',
        name: 'Pollo entero',
        category: 'Fresco',
        unit: 'kg',
        description: 'Pollo del día',
        active: true,
      },
    ]);
  });

  it('devuelve la categoría en Title Case según la tabla de tipos', async () => {
    productoRepo.findAll.mockResolvedValue({
      rows: [producto({ tipoProductoId: 3 })], count: 1,
    });
    const res = crearRes();
    await getProductos(crearReq(), res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ category: 'Seco Almacen' }),
    ]);
  });

  it('cae a Fresco cuando la categoría no está en el mapa', async () => {
    // Happens si el producto apunta a un tipo_producto que el mapa no trajo.
    productoRepo.findAll.mockResolvedValue({
      rows: [producto({ tipoProductoId: 99 })], count: 1,
    });
    const res = crearRes();
    await getProductos(crearReq(), res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ category: 'Fresco' }),
    ]);
  });

  it('convierte unidadVenta UNIDADES en la unidad "unidad"', async () => {
    productoRepo.findAll.mockResolvedValue({
      rows: [producto({ unidadVenta: 'UNIDADES' })], count: 1,
    });
    const res = crearRes();
    await getProductos(crearReq(), res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ unit: 'unidad' })]);
  });

  it('responde 500 si el repositorio falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    productoRepo.findAll.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await getProductos(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo guardar el producto en la base de datos.',
    });
    consola.mockRestore();
  });
});

describe('createProducto', () => {

  it('normaliza el cuerpo y responde 201', async () => {
    const res = crearRes();
    await createProducto(crearReq({ body: BODY_VALIDO }), res);

    expect(productoRepo.create).toHaveBeenCalledWith({
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
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('trata como vacíos los campos que no son texto', async () => {
    // validateInput coacciona name/description a '' cuando no son strings
    // (productoController.ts:23-24) y usa String(body.category ?? '') en el
    // match de categoría (línea 25): el resultado es un 400 de nombre, no un throw.
    const res = crearRes();
    await createProducto(
      crearReq({ body: { name: 123, description: 456, category: null, unit: 'kg' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El nombre debe tener entre 2 y 50 caracteres.',
    });
    expect(productoRepo.create).not.toHaveBeenCalled();
  });

  it('normaliza la unidad a UNIDADES cuando no es kg', async () => {
    const res = crearRes();
    await createProducto(
      crearReq({ body: { ...BODY_VALIDO, code: 'P-002', unit: 'unidad' } }), res,
    );

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ unidadCompra: 'UNIDADES', unidadVenta: 'UNIDADES' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responde 500 aunque la base rechace con un valor que no es Error', async () => {
    // sendDatabaseError lee error.message solo si es Error; con un string cae a
    // String(error) (productoController.ts:74), no lo clasifica y responde 500.
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    productoRepo.create.mockRejectedValue('boom');
    const res = crearRes();
    await createProducto(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo guardar el producto en la base de datos.',
    });
    consola.mockRestore();
  });

  it('acepta la categoría sin importar mayúsculas ni acentos', async () => {
    // categories = ['Fresco', 'Congelado', 'Seco Almacen'] y normalize() quita
    // acentos y pasa a minúsculas, así que "SECO ALMACEN" resuelve al mismo tipo.
    tipoProductoRepo.findAll.mockResolvedValue({
      rows: [{ id: 3, nombre: 'Seco Almacén' }], count: 1,
    });
    const res = crearRes();
    await createProducto(
      crearReq({ body: { ...BODY_VALIDO, category: 'seco almacen' } }), res,
    );

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoProductoId: 3 }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('crea el tipo de producto cuando todavía no existe', async () => {
    tipoProductoRepo.findAll.mockResolvedValue({ rows: [], count: 0 });
    tipoProductoRepo.create.mockResolvedValue({ id: 7, nombre: 'CONGELADO', activo: true, fechaBaja: null });
    const res = crearRes();
    await createProducto(
      crearReq({ body: { ...BODY_VALIDO, category: 'Congelado' } }), res,
    );

    expect(tipoProductoRepo.create).toHaveBeenCalledWith({
      nombre: 'CONGELADO', activo: true, fechaBaja: null,
    });
    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoProductoId: 7 }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rechaza un código fuera del formato A-Z0-9-', async () => {
    for (const code of ['P', 'pollo!', 'A'.repeat(21), 'P 001']) {      const res = crearRes();
      await createProducto(crearReq({ body: { ...BODY_VALIDO, code } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El código debe tener entre 2 y 20 caracteres.',
      });
    }
  });

  it('rechaza un nombre de menos de 2 caracteres', async () => {
    const res = crearRes();
    await createProducto(crearReq({ body: { ...BODY_VALIDO, name: 'P' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El nombre debe tener entre 2 y 50 caracteres.',
    });
  });

  it('rechaza una categoría que no está en la lista cerrada', async () => {
    const res = crearRes();
    await createProducto(crearReq({ body: { ...BODY_VALIDO, category: 'Marisco' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La categoría no es válida.' });
  });

  it('rechaza una unidad de venta desconocida', async () => {
    const res = crearRes();
    await createProducto(crearReq({ body: { ...BODY_VALIDO, unit: 'libra' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La unidad de venta no es válida.' });
  });

  it('rechaza una descripción de más de 300 caracteres', async () => {
    const res = crearRes();
    await createProducto(
      crearReq({ body: { ...BODY_VALIDO, description: 'x'.repeat(301) } }), res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La descripción admite hasta 300 caracteres.',
    });
  });

  it('no toca la base cuando la validación falla', async () => {
    await createProducto(crearReq({ body: { ...BODY_VALIDO, category: 'Marisco' } }), crearRes());
    expect(productoRepo.create).not.toHaveBeenCalled();
  });

  it('responde 409 cuando el código ya existe', async () => {
    productoRepo.create.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "productos_codigo_unique"'),
    );
    const res = crearRes();
    await createProducto(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe un producto con ese código.' });
  });

  it('autogenera un código cuando el cuerpo no lo trae', async () => {
    // Math.random se mockea para que el sufijo del código autogenerado sea determinista.
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.4242);
    const { code: _code, ...sinCode } = BODY_VALIDO;
    const res = crearRes();
    await createProducto(crearReq({ body: sinCode }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'PROD-POL-424' }),
    );
    random.mockRestore();
  });

  it('no autogenera código si el nombre es demasiado corto', async () => {
    const { code: _code, ...sinCode } = BODY_VALIDO;
    const res = crearRes();
    await createProducto(crearReq({ body: { ...sinCode, name: 'P' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El nombre debe tener entre 2 y 50 caracteres.',
    });
    expect(productoRepo.create).not.toHaveBeenCalled();
  });
});

describe('reactivateProducto', () => {

  it('reactiva el producto y responde 200', async () => {
    const res = crearRes();
    await reactivateProducto(crearReq({ params: { id: '10' } }), res);

    expect(productoRepo.updateById).toHaveBeenCalledWith(10, { activo: true, fechaBaja: null });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: '10' }));
  });

  it('rechaza un identificador inválido sin tocar el repositorio', async () => {
    const res = crearRes();
    await reactivateProducto(crearReq({ params: { id: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del producto no es válido.',
    });
    expect(productoRepo.updateById).not.toHaveBeenCalled();
  });

  it('cae a Fresco cuando la categoría no está en el mapa', async () => {
    // Mismo fallback que en la baja (productoController.ts:149): un tipo_producto
    // ausente del mapa se presenta como Fresco.
    productoRepo.updateById.mockResolvedValue(producto({ tipoProductoId: 99 }));
    const res = crearRes();
    await reactivateProducto(crearReq({ params: { id: '10' } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ category: 'Fresco' }));
  });

  it('responde 404 cuando el producto no existe', async () => {
    productoRepo.updateById.mockResolvedValue(null);
    const res = crearRes();
    await reactivateProducto(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Producto no encontrado.' });
  });

  it('responde 500 si la reactivación falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    productoRepo.updateById.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await reactivateProducto(crearReq({ params: { id: '10' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo guardar el producto en la base de datos.',
    });
    consola.mockRestore();
  });
});

describe('updateProducto', () => {

  it('rechaza un identificador no numérico antes de leer el cuerpo', async () => {
    const res = crearRes();
    await updateProducto(crearReq({ params: { id: 'abc' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del producto no es válido.',
    });
    expect(productoRepo.updateById).not.toHaveBeenCalled();
  });

  it('rechaza el identificador cero', async () => {
    const res = crearRes();
    await updateProducto(crearReq({ params: { id: '0' }, body: BODY_VALIDO }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('actualiza y responde 200', async () => {
    const res = crearRes();
    await updateProducto(crearReq({ params: { id: '10' }, body: BODY_VALIDO }), res);

    expect(productoRepo.updateById).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ codigo: 'P-001', nombre: 'Pollo entero' }),
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: '10' }));
  });

  it('responde 404 cuando el producto no existe', async () => {
    productoRepo.updateById.mockResolvedValue(null);
    const res = crearRes();
    await updateProducto(crearReq({ params: { id: '999' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Producto no encontrado.' });
  });

  it('valida el cuerpo aunque el id sea válido', async () => {
    const res = crearRes();
    await updateProducto(
      crearReq({ params: { id: '10' }, body: { ...BODY_VALIDO, unit: 'libra' } }), res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(productoRepo.updateById).not.toHaveBeenCalled();
  });

  it('responde 500 si la actualización falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    productoRepo.updateById.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await updateProducto(crearReq({ params: { id: '10' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo guardar el producto en la base de datos.',
    });
    consola.mockRestore();
  });

  it('traduce el código duplicado a 409 sin consola', async () => {
    // sendDatabaseError (productoController.ts:75) reconoce el choque de código
    // y responde 409; el 500 de la rama anterior solo cubre el nombre del error
    // cuando no es Error.
    productoRepo.updateById.mockRejectedValue(new Error('productos_codigo_unique'));
    const res = crearRes();
    await updateProducto(crearReq({ params: { id: '10' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe un producto con ese código.' });
  });

  it('normaliza la unidad a UNIDADES cuando no es kg', async () => {
    const res = crearRes();
    await updateProducto(
      crearReq({ params: { id: '10' }, body: { ...BODY_VALIDO, unit: 'unidad' } }), res,
    );

    expect(productoRepo.updateById).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ unidadCompra: 'UNIDADES', unidadVenta: 'UNIDADES' }),
    );
  });
});

describe('deactivateProducto', () => {

  it('rechaza un identificador inválido', async () => {
    const res = crearRes();
    await deactivateProducto(crearReq({ params: { id: '-3' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(productoRepo.deleteById).not.toHaveBeenCalled();
  });

  it('hace la baja lógica y responde 200 con el producto desactivado', async () => {
    const res = crearRes();
    await deactivateProducto(crearReq({ params: { id: '10' } }), res);

    expect(productoRepo.deleteById).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('cae a Fresco cuando la categoría no está en el mapa', async () => {
    // El producto apunta a un tipo_producto que el mapa no trajo: el fallback
    // `categoriesById.get(...) ?? 'Fresco'` (productoController.ts:134) lo cubre.
    productoRepo.deleteById.mockResolvedValue(producto({ tipoProductoId: 99, activo: false }));
    const res = crearRes();
    await deactivateProducto(crearReq({ params: { id: '10' } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ category: 'Fresco' }));
  });

  it('responde 404 cuando el producto no existe', async () => {
    productoRepo.deleteById.mockResolvedValue(null);
    const res = crearRes();
    await deactivateProducto(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Producto no encontrado.' });
  });

  it('responde 500 si la baja falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    productoRepo.deleteById.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await deactivateProducto(crearReq({ params: { id: '10' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo guardar el producto en la base de datos.',
    });
    consola.mockRestore();
  });
});