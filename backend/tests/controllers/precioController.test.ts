import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/precioRepository', () => require('../mocks/precioRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));

import {
  getPrecios, getHistorialPrecios, getPrecioVigente,
  registrarPrecio, actualizarPrecio, desactivarPrecio,
} from '../../src/controllers/precioController.js';
import { instancia as precioRepo, ErrorVigenciaPrecio } from '../mocks/precioRepository.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';

function precio(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    productoId: 10,
    precioMinorista: '1500.00',
    precioMayorista: '1300.00',
    fechaDesde: new Date('2026-01-01T00:00:00.000Z'),
    fechaHasta: null,
    activo: true,
    fechaBaja: null,
    ...overrides,
  };
}

function producto(overrides: Record<string, unknown> = {}) {
  return { id: 10, nombre: 'Pollo entero', activo: true, ...overrides };
}

const BODY_VALIDO = { productoId: 10, precioMinorista: '1500', precioMayorista: '1300' };

beforeEach(() => {
  precioRepo.findGlobales.mockResolvedValue({ rows: [precio()], count: 1 });
  precioRepo.findHistorial.mockResolvedValue([precio()]);
  precioRepo.findVigente.mockResolvedValue(precio());
  precioRepo.registrarPrecio.mockResolvedValue(precio());
  precioRepo.updatePrecios.mockResolvedValue(precio());
  precioRepo.deleteById.mockResolvedValue(precio({ fechaHasta: new Date(), activo: false }));
  productoRepo.findById.mockResolvedValue(producto());
});

describe('getPrecios', () => {

  it('devuelve el precio vigente de cada producto por omisión', async () => {
    const res = crearRes();
    await getPrecios(crearReq(), res);

    expect(precioRepo.findGlobales).toHaveBeenCalledWith(true, 1, 1000);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: '1',
        productoId: 10,
        precioMinorista: '1500.00',
        precioMayorista: '1300.00',
        fechaDesde: new Date('2026-01-01T00:00:00.000Z'),
        fechaHasta: null,
        vigente: true,
        activo: true,
        fechaBaja: null,
      },
    ]);
  });

  it('deja una sola fila por producto aunque haya varias vigentes', async () => {
    // El índice único lo garantiza en la base, pero si un precio queda con
    // fechaHasta futura puede haber más de uno. Se queda el primero para no
    // romper la promesa de "una fila por producto".
    precioRepo.findGlobales.mockResolvedValue({
      rows: [
        precio({ id: 1, productoId: 10 }),
        precio({ id: 2, productoId: 10 }),
        precio({ id: 3, productoId: 11 }),
      ],
      count: 3,
    });
    const res = crearRes();
    await getPrecios(crearReq(), res);

    const cuerpo = res.json.mock.calls[0][0] as Array<{ id: string; productoId: number }>;
    expect(cuerpo).toHaveLength(2);
    expect(cuerpo.map(p => p.productoId)).toEqual([10, 11]);
  });

  it('devuelve el histórico completo con ?vigente=false', async () => {
    precioRepo.findGlobales.mockResolvedValue({
      rows: [
        precio({ id: 1, productoId: 10 }),
        precio({ id: 2, productoId: 10, fechaHasta: new Date('2026-02-01'), vigente: false }),
      ],
      count: 2,
    });
    const res = crearRes();
    await getPrecios(crearReq({ query: { vigente: 'false' } }), res);

    expect(precioRepo.findGlobales).toHaveBeenCalledWith(false, 1, 1000);
    expect(res.json.mock.calls[0][0]).toHaveLength(2);
  });

  it('rechaza una paginación inválida antes de consultar', async () => {
    const res = crearRes();
    await getPrecios(crearReq({ query: { limite: '1001' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(precioRepo.findGlobales).not.toHaveBeenCalled();
  });

  it('marca vigente=false cuando el precio está cerrado o dado de baja', async () => {
    precioRepo.findGlobales.mockResolvedValue({
      rows: [precio({ fechaHasta: new Date('2026-02-01') })], count: 1,
    });
    const res = crearRes();
    await getPrecios(crearReq(), res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ vigente: false })]);
  });
});

describe('getHistorialPrecios', () => {

  it('devuelve el historial del producto del más nuevo al más viejo', async () => {
    const res = crearRes();
    await getHistorialPrecios(crearReq({ params: { productoId: '10' } }), res);

    expect(precioRepo.findHistorial).toHaveBeenCalledWith(10, 1, 1000);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ productoId: 10 })]);
  });

  it('rechaza un productoId no numérico', async () => {
    const res = crearRes();
    await getHistorialPrecios(crearReq({ params: { productoId: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del producto no es válido.',
    });
  });
});

describe('getPrecioVigente', () => {

  it('devuelve 404 cuando el producto no tiene precio vigente', async () => {
    // 404 y no null para que el frontend no tenga que distinguir entre
    // "no hay precio" y "el producto no existe".
    precioRepo.findVigente.mockResolvedValue(null);
    const res = crearRes();
    await getPrecioVigente(crearReq({ params: { productoId: '10' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El producto no tiene un precio vigente.',
    });
  });

  it('devuelve el precio cuando existe', async () => {
    const res = crearRes();
    await getPrecioVigente(crearReq({ params: { productoId: '10' } }), res);

    expect(precioRepo.findVigente).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ vigente: true }));
  });

  it('rechaza un productoId inválido', async () => {
    const res = crearRes();
    await getPrecioVigente(crearReq({ params: { productoId: '0' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('registrarPrecio', () => {

  it('normaliza los montos y responde 201', async () => {
    const res = crearRes();
    await registrarPrecio(crearReq({ body: BODY_VALIDO }), res);

    expect(precioRepo.registrarPrecio).toHaveBeenCalledWith(
      10, '1500.00', '1300.00', expect.any(Date),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('acepta precioMayorista ausente como null', async () => {
    const res = crearRes();
    await registrarPrecio(
      crearReq({ body: { productoId: 10, precioMinorista: '1500' } }), res,
    );

    expect(precioRepo.registrarPrecio).toHaveBeenCalledWith(
      10, '1500.00', null, expect.any(Date),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rechaza el mayorista cuando supera al minorista', async () => {
    const res = crearRes();
    await registrarPrecio(
      crearReq({ body: { ...BODY_VALIDO, precioMayorista: '2000' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El precio mayorista no puede superar al minorista.',
    });
    expect(precioRepo.registrarPrecio).not.toHaveBeenCalled();
  });

  it('rechaza un productoId inválido', async () => {
    const res = crearRes();
    await registrarPrecio(crearReq({ body: { ...BODY_VALIDO, productoId: 'abc' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El producto no es válido.' });
  });

  it('rechaza un minorista obligatorio ausente', async () => {
    const res = crearRes();
    await registrarPrecio(crearReq({ body: { productoId: 10 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El campo precioMinorista es obligatorio.',
    });
  });

  it('rechaza una fechaDesde mal formada', async () => {
    const res = crearRes();
    await registrarPrecio(
      crearReq({ body: { ...BODY_VALIDO, fechaDesde: 'ayer' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El campo fechaDesde no es una fecha válida.',
    });
  });

  it('acepta una fechaDesde explícita', async () => {
    const res = crearRes();
    await registrarPrecio(
      crearReq({ body: { ...BODY_VALIDO, fechaDesde: '2026-05-01T00:00:00.000Z' } }), res,
    );

    expect(precioRepo.registrarPrecio).toHaveBeenCalledWith(
      10, '1500.00', '1300.00', new Date('2026-05-01T00:00:00.000Z'),
    );
  });

  it('responde 404 cuando el producto no existe', async () => {
    productoRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await registrarPrecio(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Producto no encontrado.' });
  });

  it('responde 404 cuando el producto está dado de baja', async () => {
    // productoExiste() exige activo: true, no basta con que la fila exista.
    productoRepo.findById.mockResolvedValue(producto({ activo: false }));
    const res = crearRes();
    await registrarPrecio(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responde 409 cuando el precio choca con la regla de vigencia', async () => {
    precioRepo.registrarPrecio.mockRejectedValue(
      new ErrorVigenciaPrecio('La fecha del precio nuevo no es posterior a la del vigente.'),
    );
    const res = crearRes();
    await registrarPrecio(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La fecha del precio nuevo no es posterior a la del vigente.',
    });
  });

  it('responde 409 cuando la base responde duplicate key', async () => {
    precioRepo.registrarPrecio.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "precios_unico_abierto"'),
    );
    const res = crearRes();
    await registrarPrecio(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('responde 500 ante un fallo no clasificado', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    precioRepo.registrarPrecio.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await registrarPrecio(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo completar la operación en la base de datos.',
    });
    consola.mockRestore();
  });
});

describe('actualizarPrecio', () => {

  it('actualiza los montos sin tocar la vigencia y responde 200', async () => {
    const res = crearRes();
    await actualizarPrecio(crearReq({ params: { id: '1' }, body: BODY_VALIDO }), res);

    expect(precioRepo.updatePrecios).toHaveBeenCalledWith(1, '1500.00', '1300.00');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rechaza un identificador inválido', async () => {
    const res = crearRes();
    await actualizarPrecio(crearReq({ params: { id: 'abc' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del precio no es válido.',
    });
  });

  it('rechaza el mayorista cuando supera al minorista', async () => {
    const res = crearRes();
    await actualizarPrecio(
      crearReq({ params: { id: '1' }, body: { ...BODY_VALIDO, precioMayorista: '9999' } }), res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(precioRepo.updatePrecios).not.toHaveBeenCalled();
  });

  it('responde 404 cuando el precio no existe', async () => {
    precioRepo.updatePrecios.mockResolvedValue(null);
    const res = crearRes();
    await actualizarPrecio(crearReq({ params: { id: '999' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Precio no encontrado.' });
  });
});

describe('desactivarPrecio', () => {

  it('hace la baja lógica y responde 200', async () => {
    const res = crearRes();
    await desactivarPrecio(crearReq({ params: { id: '1' } }), res);

    expect(precioRepo.deleteById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ activo: false }));
  });

  it('rechaza un identificador inválido', async () => {
    const res = crearRes();
    await desactivarPrecio(crearReq({ params: { id: '-1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('responde 404 cuando el precio no existe', async () => {
    precioRepo.deleteById.mockResolvedValue(null);
    const res = crearRes();
    await desactivarPrecio(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Precio no encontrado.' });
  });
});