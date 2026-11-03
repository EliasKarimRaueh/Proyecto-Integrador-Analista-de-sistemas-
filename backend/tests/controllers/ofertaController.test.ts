import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/ofertaRepository', () => require('../mocks/ofertaRepository.js'));
jest.mock('polleria-database/repositories/ofertaProductoRepository', () => require('../mocks/ofertaProductoRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));

import {
  getOfertas, getOfertasVigentes, getOfertasDeProducto, getOferta, createOferta,
  updateOferta, desactivarOferta, getProductosDeOferta, actualizarPrecioEnOferta,
  quitarProductoDeOferta,
} from '../../src/controllers/ofertaController.js';
import { instancia as ofertaRepo } from '../mocks/ofertaRepository.js';
import { instancia as ofertaProductoRepo } from '../mocks/ofertaProductoRepository.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';

const INICIO = new Date('2026-01-01T00:00:00.000Z');
const FIN = new Date('2026-12-31T00:00:00.000Z');

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

function producto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    codigo: 'P-001',
    nombre: 'Pollo entero',
    unidadVenta: 'KILOS',
    stockActual: 5,
    activo: true,
    ...overrides,
  };
}

function relacion(overrides: Record<string, unknown> = {}) {
  // cantidad viene desde la base en OfertaProducto; el controller la expone en el
  // detalle de la oferta y en getProductosDeOferta (ofertaController.ts:66, :386).
  return { productoId: 10, precioOferta: '1200.00', cantidad: 1, activo: true, fechaBaja: null, ...overrides };
}

const BODY_VALIDO = {
  nombre: 'Promo pollo',
  descripcion: 'Oferta de la quincena',
  fechaInicio: '2026-01-01T00:00:00.000Z',
  fechaFin: '2026-12-31T00:00:00.000Z',
  productos: [{ productoId: 10, precioOferta: '1200' }],
};

beforeEach(() => {
  ofertaRepo.findAllActivos.mockResolvedValue({ rows: [oferta()], count: 1 });
  ofertaRepo.findVigentes.mockResolvedValue({ rows: [oferta()], count: 1 });
  ofertaRepo.findById.mockResolvedValue(oferta());
  ofertaRepo.findByIdActivo.mockResolvedValue(oferta());
  ofertaRepo.updateById.mockResolvedValue(oferta({ nombre: 'Promo renombrada' }));
  ofertaRepo.deleteById.mockResolvedValue(oferta({ activo: false, fechaBaja: new Date() }));

  ofertaProductoRepo.listarDetalleProductos.mockResolvedValue([{ producto: producto(), relacion: relacion() }]);
  ofertaProductoRepo.listarDetalleOfertas.mockResolvedValue([{ oferta: oferta(), relacion: relacion() }]);
  ofertaProductoRepo.crearOfertaConProductos.mockResolvedValue({ oferta: oferta() });
  ofertaProductoRepo.updatePrecioOferta.mockImplementation(
    async (_ofertaId, _productoId, precioOferta) =>
      relacion({ precioOferta: String(precioOferta) }),
  );
  ofertaProductoRepo.deleteByOfertaProducto.mockResolvedValue(
    relacion({ activo: false, fechaBaja: new Date('2026-03-01T00:00:00.000Z') }),
  );

  productoRepo.findByIds.mockResolvedValue([producto()]);
});

describe('getOfertas', () => {

  it('devuelve las ofertas activas ordenadas por id descendente', async () => {
    const res = crearRes();
    await getOfertas(crearReq(), res);

    expect(ofertaRepo.findAllActivos).toHaveBeenCalledWith(1, 1000, 'id', 'DESC');
    expect(res.json).toHaveBeenCalledWith([
      {
        id: '1',
        nombre: 'Promo pollo',
        descuentoPorcentaje: null,
        descripcion: null,
        fechaInicio: INICIO,
        fechaFin: FIN,
        vigente: true,
        activo: true,
        fechaBaja: null,
      },
    ]);
  });

  it('marca vigente=false si la ventana de fechas no incluye hoy', async () => {
    ofertaRepo.findAllActivos.mockResolvedValue({
      rows: [oferta({ fechaInicio: new Date('2020-01-01'), fechaFin: new Date('2020-12-31') })],
      count: 1,
    });
    const res = crearRes();
    await getOfertas(crearReq(), res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ vigente: false })]);
  });

  it('rechaza una paginación inválida', async () => {
    const res = crearRes();
    await getOfertas(crearReq({ query: { page: '0' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ofertaRepo.findAllActivos).not.toHaveBeenCalled();
  });
});

describe('getOfertasVigentes', () => {

  it('filtra por la ventana de fechas usando la fecha de hoy', async () => {
    const res = crearRes();
    await getOfertasVigentes(crearReq(), res);

    expect(ofertaRepo.findVigentes).toHaveBeenCalledWith(
      expect.any(Date), 1, 1000, 'id', 'DESC',
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rechaza una paginación inválida', async () => {
    const res = crearRes();
    await getOfertasVigentes(crearReq({ query: { limite: '0' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getOfertasDeProducto', () => {

  it('devuelve las ofertas con el precio que el producto tiene en cada una', async () => {
    const res = crearRes();
    await getOfertasDeProducto(crearReq({ params: { productoId: '10' } }), res);

    expect(ofertaProductoRepo.listarDetalleOfertas).toHaveBeenCalledWith(10, true);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ id: '1', productoId: 10, precioOferta: '1200.00' }),
    ]);
  });

  it('incluye las no vigentes con ?vigentes=false', async () => {
    const res = crearRes();
    await getOfertasDeProducto(
      crearReq({ params: { productoId: '10' }, query: { vigentes: 'false' } }), res,
    );
    expect(ofertaProductoRepo.listarDetalleOfertas).toHaveBeenCalledWith(10, false);
  });

  it('rechaza un productoId inválido', async () => {
    const res = crearRes();
    await getOfertasDeProducto(crearReq({ params: { productoId: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del producto no es válido.',
    });
  });
});

describe('getOferta', () => {

  it('devuelve la oferta con el detalle de productos y precios', async () => {
    const res = crearRes();
    await getOferta(crearReq({ params: { id: '1' } }), res);

    expect(ofertaRepo.findById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        productos: [
          {
            productoId: '10',
            codigo: 'P-001',
            nombre: 'Pollo entero',
            unidadVenta: 'KILOS',
            stockActual: 5,
            precioOferta: '1200.00',
            cantidad: 1,
            activo: true,
          },
        ],
      }),
    );
  });

  it('responde 404 cuando la oferta no existe', async () => {
    ofertaRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await getOferta(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Oferta no encontrada.' });
  });

  it('rechaza un id inválido', async () => {
    const res = crearRes();
    await getOferta(crearReq({ params: { id: '0' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('createOferta', () => {

  it('crea la oferta con sus productos y responde 201 con el detalle', async () => {
    const res = crearRes();
    await createOferta(crearReq({ body: BODY_VALIDO }), res);

    expect(ofertaProductoRepo.crearOfertaConProductos).toHaveBeenCalledWith(
      {
        nombre: 'Promo pollo',
        descripcion: 'Oferta de la quincena',
        fechaInicio: INICIO,
        fechaFin: FIN,
      },
      [{ productoId: 10, precioOferta: '1200.00', cantidad: 1 }],
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('acepta la descripción ausente como null', async () => {
    const body = { ...BODY_VALIDO };
    delete (body as Record<string, unknown>).descripcion;
    const res = crearRes();
    await createOferta(crearReq({ body }), res);

    expect(ofertaProductoRepo.crearOfertaConProductos).toHaveBeenCalledWith(
      expect.objectContaining({ descripcion: null }), expect.any(Array),
    );
  });

  it('rechaza un nombre vacío o de más de 50 caracteres', async () => {
    for (const nombre of ['', '   ', 'x'.repeat(51)]) {
      const res = crearRes();
      await createOferta(crearReq({ body: { ...BODY_VALIDO, nombre } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El nombre debe tener entre 1 y 50 caracteres.',
      });
    }
  });

  it('rechaza una descripción de más de 300 caracteres', async () => {
    const res = crearRes();
    await createOferta(
      crearReq({ body: { ...BODY_VALIDO, descripcion: 'x'.repeat(301) } }), res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza fechaFin anterior o igual a fechaInicio', async () => {
    const res = crearRes();
    await createOferta(
      crearReq({ body: { ...BODY_VALIDO, fechaFin: '2026-01-01T00:00:00.000Z' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    });
  });

  it('rechaza una fecha de inicio mal formada', async () => {
    const res = crearRes();
    await createOferta(crearReq({ body: { ...BODY_VALIDO, fechaInicio: 'ayer' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza una fecha de fin mal formada', async () => {
    const res = crearRes();
    await createOferta(
      crearReq({ body: { ...BODY_VALIDO, fechaFin: 'el mes que viene' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El campo fechaFin no es una fecha válida.',
    });
    expect(ofertaProductoRepo.crearOfertaConProductos).not.toHaveBeenCalled();
  });

  it('responde con presentOferta cuando el detalle no se puede recargar', async () => {
    // Si cargarDetalle devuelve null (la oferta recién creada no se puede
    // releer), el handler cae al fallback `detalle ?? presentOferta(oferta)`.
    ofertaRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await createOferta(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  describe('validarProductos', () => {

    it('rechaza un valor que no es arreglo', async () => {
      const res = crearRes();
      await createOferta(crearReq({ body: { ...BODY_VALIDO, productos: 'P-001' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'El campo productos debe ser un arreglo.' });
    });

    it('rechaza un arreglo vacío', async () => {
      const res = crearRes();
      await createOferta(crearReq({ body: { ...BODY_VALIDO, productos: [] } }), res);
      expect(res.json).toHaveBeenCalledWith({
        message: 'La oferta debe tener al menos un producto.',
      });
    });

    it('rechaza más de 200 productos', async () => {
      const productos = Array.from({ length: 201 }, (_, i) => ({
        productoId: i + 1, precioOferta: '1000',
      }));
      const res = crearRes();
      await createOferta(crearReq({ body: { ...BODY_VALIDO, productos } }), res);
      expect(res.json).toHaveBeenCalledWith({
        message: 'La oferta no puede tener más de 200 productos.',
      });
    });

    it('rechaza un elemento que no es objeto', async () => {
      const res = crearRes();
      await createOferta(crearReq({ body: { ...BODY_VALIDO, productos: ['P-001'] } }), res);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El producto en la posición 0 no es un objeto válido.',
      });
    });

    it('rechaza un productoId inválida señalando la posición', async () => {
      const res = crearRes();
      await createOferta(
        crearReq({ body: { ...BODY_VALIDO, productos: [{ productoId: 'abc', precioOferta: '1000' }] } }),
        res,
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'El productoId en la posición 0 no es válido.',
      });
    });

    it('rechaza un precioOferta ausente señalando la posición', async () => {
      const res = crearRes();
      await createOferta(
        crearReq({ body: { ...BODY_VALIDO, productos: [{ productoId: 10 }] } }), res,
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'El campo el precioOferta del producto en la posición 0 es obligatorio.',
      });
    });

    it('detecta el producto repetido antes de tocar la base', async () => {
      // Si no se detectara acá, el error del índice único volvería un 500.
      const res = crearRes();
      await createOferta(
        crearReq({
          body: {
            ...BODY_VALIDO,
            productos: [
              { productoId: 10, precioOferta: '1000' },
              { productoId: 10, precioOferta: '1100' },
            ],
          },
        }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El producto 10 está repetido en la lista.',
      });
      expect(ofertaProductoRepo.crearOfertaConProductos).not.toHaveBeenCalled();
    });

    it('rechaza una cantidad que no es positiva', async () => {
      // validarProductos normaliza la cantidad con Number() y exige > 0
      // (ofertaController.ts:113). Cubre los tres tipos de falla: no numérico,
      // no finito y negativo.
      for (const cantidad of [0, -3, 'muchos', null, true]) {
        const res = crearRes();
        await createOferta(
          crearReq({ body: { ...BODY_VALIDO, productos: [{ productoId: 10, precioOferta: '1200', cantidad }] } }),
          res,
        );
        expect(res.json).toHaveBeenCalledWith({
          message: 'La cantidad de cada producto debe ser positiva.',
        });
      }
      expect(ofertaProductoRepo.crearOfertaConProductos).not.toHaveBeenCalled();
    });

    it('acepta la cantidad explícita y la propaga al repositorio', async () => {
      const res = crearRes();
      await createOferta(
        crearReq({ body: { ...BODY_VALIDO, productos: [{ productoId: 10, precioOferta: '1200', cantidad: '2.5' }] } }),
        res,
      );
      expect(ofertaProductoRepo.crearOfertaConProductos).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Promo pollo' }),
        [{ productoId: 10, precioOferta: '1200.00', cantidad: 2.5 }],
      );
    });

    it('exige cantidad entera para productos vendidos por unidad', async () => {
      // La validación de UNIDADES corre después de la de cantidad positiva
      // (ofertaController.ts:255), así que 1.5 pasa la primera y falla la segunda.
      productoRepo.findByIds.mockResolvedValue([producto({ id: 10, unidadVenta: 'UNIDADES' })]);
      const res = crearRes();
      await createOferta(
        crearReq({ body: { ...BODY_VALIDO, productos: [{ productoId: 10, precioOferta: '1200', cantidad: 1.5 }] } }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Los componentes vendidos por unidad requieren cantidades enteras.',
      });
      expect(ofertaProductoRepo.crearOfertaConProductos).not.toHaveBeenCalled();
    });

    it('acepta cantidad entera en productos por unidad', async () => {
      productoRepo.findByIds.mockResolvedValue([producto({ id: 10, unidadVenta: 'UNIDADES' })]);
      const res = crearRes();
      await createOferta(
        crearReq({ body: { ...BODY_VALIDO, productos: [{ productoId: 10, precioOferta: '1200', cantidad: 3 }] } }),
        res,
      );
      expect(res.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Los componentes vendidos por unidad requieren cantidades enteras.' }),
      );
    });
  });

  it('responde 404 con la lista de productos que faltan', async () => {
    productoRepo.findByIds.mockResolvedValue([producto({ id: 10 })]);
    const res = crearRes();
    await createOferta(
      crearReq({
        body: {
          ...BODY_VALIDO,
          productos: [
            { productoId: 10, precioOferta: '1200' },
            { productoId: 11, precioOferta: '900' },
          ],
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Los productos 11 no existen o están dados de baja.',
    });
  });

  it('cuenta como faltante un producto dado de baja', async () => {
    productoRepo.findByIds.mockResolvedValue([producto({ id: 10, activo: false })]);
    const res = crearRes();
    await createOferta(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateOferta', () => {

  it('rechaza un cuerpo sin ningún campo actualizable', async () => {
    const res = crearRes();
    await updateOferta(crearReq({ params: { id: '1' }, body: {} }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se envió ningún campo para actualizar.',
    });
    expect(ofertaRepo.findById).not.toHaveBeenCalled();
  });

  it('rechaza un id inválido', async () => {
    const res = crearRes();
    await updateOferta(crearReq({ params: { id: 'abc' }, body: { nombre: 'Nuevo' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('valida la vigencia contra el valor guardado, no contra el cuerpo', async () => {
    // La oferta guardada va de 2026-01-01 a 2026-12-31. Mandar solo fechaFin
    // anterior a la fechaInicio guardada debe rechazarse.
    const res = crearRes();
    await updateOferta(
      crearReq({ params: { id: '1' }, body: { fechaFin: '2025-06-01T00:00:00.000Z' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    });
  });

  it('actualiza solo los campos enviados y responde 200', async () => {
    const res = crearRes();
    await updateOferta(
      crearReq({ params: { id: '1' }, body: { nombre: '  Promo renombrada  ' } }), res,
    );

    expect(ofertaRepo.updateById).toHaveBeenCalledWith(1, { nombre: 'Promo renombrada' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 404 cuando la oferta no existe', async () => {
    ofertaRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await updateOferta(crearReq({ params: { id: '999' }, body: { nombre: 'Nuevo' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Oferta no encontrada.' });
  });

  it('responde 404 si la actualización no affectó filas', async () => {
    ofertaRepo.updateById.mockResolvedValue(null);
    const res = crearRes();
    await updateOferta(crearReq({ params: { id: '1' }, body: { nombre: 'Nuevo' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responde con presentOferta cuando el detalle no se puede recargar', async () => {
    // updateById devuelve la fila actualizada, pero cargarDetalle no encuentra
    // la oferta: el fallback `detalle ?? presentOferta(actualizada)` responde 200.
    ofertaRepo.findById
      .mockResolvedValueOnce(oferta())
      .mockResolvedValue(null);
    const res = crearRes();
    await updateOferta(crearReq({ params: { id: '1' }, body: { nombre: 'Promo renombrada' } }), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('rechaza una descripción de más de 300 caracteres', async () => {
    const res = crearRes();
    await updateOferta(
      crearReq({ params: { id: '1' }, body: { descripcion: 'x'.repeat(301) } }), res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza un nombre vacío o demasiado largo', async () => {
    for (const nombre of ['', '   ', 'x'.repeat(51)]) {
      const res = crearRes();
      await updateOferta(crearReq({ params: { id: '1' }, body: { nombre } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El nombre debe tener entre 1 y 50 caracteres.',
      });
    }
    expect(ofertaRepo.updateById).not.toHaveBeenCalled();
  });

  it('rechaza una fechaInicio mal formada', async () => {
    const res = crearRes();
    await updateOferta(
      crearReq({ params: { id: '1' }, body: { fechaInicio: 'ayer' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El campo fechaInicio no es una fecha válida.',
    });
    expect(ofertaRepo.updateById).not.toHaveBeenCalled();
  });

  it('rechaza una fechaFin mal formada', async () => {
    const res = crearRes();
    await updateOferta(
      crearReq({ params: { id: '1' }, body: { fechaFin: 'el mes que viene' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El campo fechaFin no es una fecha válida.',
    });
    expect(ofertaRepo.updateById).not.toHaveBeenCalled();
  });

  it('aplica descripción y fechaInicio cuando vienen en el cuerpo', async () => {
    const res = crearRes();
    await updateOferta(
      crearReq({
        params: { id: '1' },
        body: { descripcion: '  Nueva descripción  ', fechaInicio: '2026-03-01T00:00:00.000Z' },
      }),
      res,
    );

    expect(ofertaRepo.updateById).toHaveBeenCalledWith(1, {
      descripcion: 'Nueva descripción',
      fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('acepta la descripción nula para vaciarla', async () => {
    const res = crearRes();
    await updateOferta(
      crearReq({ params: { id: '1' }, body: { descripcion: null } }), res,
    );

    expect(ofertaRepo.updateById).toHaveBeenCalledWith(1, { descripcion: null });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('desactivarOferta', () => {

  it('hace la baja lógica y responde 200', async () => {
    const res = crearRes();
    await desactivarOferta(crearReq({ params: { id: '1' } }), res);

    expect(ofertaRepo.deleteById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ activo: false }));
  });

  it('responde 404 cuando la oferta no existe', async () => {
    ofertaRepo.deleteById.mockResolvedValue(null);
    const res = crearRes();
    await desactivarOferta(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza un id inválido', async () => {
    const res = crearRes();
    await desactivarOferta(crearReq({ params: { id: '-1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getProductosDeOferta', () => {

  it('devuelve los productos con su precio en la oferta', async () => {
    const res = crearRes();
    await getProductosDeOferta(crearReq({ params: { id: '1' } }), res);

    expect(ofertaProductoRepo.listarDetalleProductos).toHaveBeenCalledWith(1, true);
    expect(res.json).toHaveBeenCalledWith([
      {
        productoId: '10',
        codigo: 'P-001',
        nombre: 'Pollo entero',
        unidadVenta: 'KILOS',
        stockActual: 5,
        precioOferta: '1200.00',
        cantidad: 1,
        activo: true,
      },
    ]);
  });

  it('incluye los dados de baja con ?activos=false', async () => {
    const res = crearRes();
    await getProductosDeOferta(crearReq({ params: { id: '1' }, query: { activos: 'false' } }), res);
    expect(ofertaProductoRepo.listarDetalleProductos).toHaveBeenCalledWith(1, false);
  });

  it('responde 404 cuando la oferta no existe', async () => {
    ofertaRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await getProductosDeOferta(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza un id inválido', async () => {
    const res = crearRes();
    await getProductosDeOferta(crearReq({ params: { id: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador de la oferta no es válido.',
    });
    expect(ofertaRepo.findById).not.toHaveBeenCalled();
  });
});

describe('actualizarPrecioEnOferta', () => {

  it('cambia solo el precio del producto', async () => {
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: '10' }, body: { precioOferta: '1350' } }), res,
    );

    // La firma real es (ofertaId, productoId, precioOferta, transaction, cantidad);
    // sin `cantidad` en el cuerpo el controlador pasa undefined en los dos últimos.
    expect(ofertaProductoRepo.updatePrecioOferta).toHaveBeenCalledWith(1, 10, '1350.00', undefined, undefined);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      ofertaId: '1',
      productoId: 10,
      precioOferta: '1350.00',
      cantidad: 1,
      activo: true,
    });
  });

  it('rechaza un precioOferta ausente', async () => {
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: '10' }, body: {} }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El campo precioOferta es obligatorio.',
    });
  });

  it('rechaza un productoId inválido', async () => {
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: 'abc' }, body: { precioOferta: '1350' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del producto no es válido.',
    });
  });

  it('rechaza un id de oferta inválido', async () => {
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: 'abc', productoId: '10' }, body: { precioOferta: '1350' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador de la oferta no es válido.',
    });
    expect(ofertaRepo.findByIdActivo).not.toHaveBeenCalled();
  });

  it('responde 404 cuando la oferta está dada de baja', async () => {
    // Usa findByIdActivo, no findById: una oferta inactiva no se puede tocar.
    ofertaRepo.findByIdActivo.mockResolvedValue(null);
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: '10' }, body: { precioOferta: '1350' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Oferta no encontrada o dada de baja.',
    });
  });

  it('responde 404 cuando el producto no pertenece a la oferta', async () => {
    ofertaProductoRepo.updatePrecioOferta.mockResolvedValue(null);
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: '10' }, body: { precioOferta: '1350' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El producto no pertenece a la oferta.',
    });
  });

  it('actualiza también la cantidad cuando viene en el cuerpo', async () => {
    // Con cantidad presente el controlador consulta el producto para validar
    // contra su unidad de venta (ofertaController.ts:412).
    const res = crearRes();
    await actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: '10' }, body: { precioOferta: '1350', cantidad: 2 } }),
      res,
    );

    expect(productoRepo.findById).toHaveBeenCalledWith(10);
    expect(ofertaProductoRepo.updatePrecioOferta).toHaveBeenCalledWith(1, 10, '1350.00', undefined, 2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rechaza una cantidad inválida para la unidad de venta del producto', async () => {
    // Cubre las cuatro condiciones del guard de ofertaController.ts:414: tipo no
    // numérico, no finito, no positivo y entero inválido en productos UNIDADES.
    const casos: Array<[unknown, Record<string, unknown> | undefined]> = [
      [true, undefined],
      ['muchos', undefined],
      [0, undefined],
      [-2, undefined],
      [1.5, { unidadVenta: 'UNIDADES' }],
    ];

    for (const [cantidad, overrides] of casos) {
      productoRepo.findById.mockResolvedValue(producto({ id: 10, ...overrides }));
      const res = crearRes();
      await actualizarPrecioEnOferta(
        crearReq({ params: { id: '1', productoId: '10' }, body: { precioOferta: '1350', cantidad } }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'La cantidad del componente no es válida para su unidad de venta.',
      });
    }
    expect(ofertaProductoRepo.updatePrecioOferta).not.toHaveBeenCalled();
  });
});

describe('quitarProductoDeOferta', () => {

  it('hace la baja lógica del producto dentro de la oferta', async () => {
    const res = crearRes();
    await quitarProductoDeOferta(crearReq({ params: { id: '1', productoId: '10' } }), res);

    expect(ofertaProductoRepo.deleteByOfertaProducto).toHaveBeenCalledWith(1, 10);
    expect(res.json).toHaveBeenCalledWith({
      ofertaId: '1',
      productoId: 10,
      activo: false,
      fechaBaja: new Date('2026-03-01T00:00:00.000Z'),
    });
  });

  it('responde 404 cuando la relación no existe', async () => {
    // El handler no consulta la oferta: va directo a la relación, así que
    // una oferta inexistente y un producto que no pertenece dan el mismo 404.
    ofertaProductoRepo.deleteByOfertaProducto.mockResolvedValue(null);
    const res = crearRes();
    await quitarProductoDeOferta(crearReq({ params: { id: '999', productoId: '10' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El producto no pertenece a la oferta.',
    });
  });

  it('rechaza un id de oferta inválido', async () => {
    const res = crearRes();
    await quitarProductoDeOferta(crearReq({ params: { id: 'abc', productoId: '10' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ofertaProductoRepo.deleteByOfertaProducto).not.toHaveBeenCalled();
  });

  it('rechaza un productoId inválido', async () => {
    const res = crearRes();
    await quitarProductoDeOferta(crearReq({ params: { id: '1', productoId: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del producto no es válido.',
    });
    expect(ofertaProductoRepo.deleteByOfertaProducto).not.toHaveBeenCalled();
  });
});

describe('fallos de base de datos', () => {

  // Los diez handlers de ofertas delegan la traducción del fallo a
  // sendDatabaseError: un error sin constraint conocido responde 500 con el
  // mensaje genérico y loguea por consola.
  async function expect500(accion: (res: ReturnType<typeof crearRes>) => Promise<void>) {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = crearRes();
    await accion(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo completar la operación en la base de datos.',
    });
    consola.mockRestore();
  }

  it('getOfertas responde 500 cuando la lectura falla', async () => {
    ofertaRepo.findAllActivos.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => getOfertas(crearReq(), res));
  });

  it('getOfertasVigentes responde 500 cuando la lectura falla', async () => {
    ofertaRepo.findVigentes.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => getOfertasVigentes(crearReq(), res));
  });

  it('getOfertasDeProducto responde 500 cuando la lectura falla', async () => {
    ofertaProductoRepo.listarDetalleOfertas.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => getOfertasDeProducto(crearReq({ params: { productoId: '10' } }), res));
  });

  it('getOferta responde 500 cuando la lectura falla', async () => {
    ofertaRepo.findById.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => getOferta(crearReq({ params: { id: '1' } }), res));
  });

  it('createOferta responde 500 cuando la creación falla', async () => {
    ofertaProductoRepo.crearOfertaConProductos.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => createOferta(crearReq({ body: BODY_VALIDO }), res));
  });

  it('updateOferta responde 500 cuando la lectura falla', async () => {
    ofertaRepo.findById.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => updateOferta(
      crearReq({ params: { id: '1' }, body: { nombre: 'Nuevo' } }), res,
    ));
  });

  it('desactivarOferta responde 500 cuando la baja falla', async () => {
    ofertaRepo.deleteById.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => desactivarOferta(crearReq({ params: { id: '1' } }), res));
  });

  it('getProductosDeOferta responde 500 cuando la lectura falla', async () => {
    ofertaProductoRepo.listarDetalleProductos.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => getProductosDeOferta(crearReq({ params: { id: '1' } }), res));
  });

  it('actualizarPrecioEnOferta responde 500 cuando la escritura falla', async () => {
    ofertaProductoRepo.updatePrecioOferta.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => actualizarPrecioEnOferta(
      crearReq({ params: { id: '1', productoId: '10' }, body: { precioOferta: '1350' } }), res,
    ));
  });

  it('quitarProductoDeOferta responde 500 cuando la baja falla', async () => {
    ofertaProductoRepo.deleteByOfertaProducto.mockRejectedValue(new Error('se cayó la conexión'));
    await expect500((res) => quitarProductoDeOferta(
      crearReq({ params: { id: '1', productoId: '10' } }), res,
    ));
  });
});
