import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));

import {
  getProveedores, getProveedorById, createProveedor, updateProveedor,
  deactivateProveedor, reactivateProveedor,
} from '../../src/controllers/proveedorController.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';

function proveedor(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    nombre: 'Distribuidora Sur',
    cuil: '20123456789',
    descripcion: 'Aves frescas',
    ctaCte: true,
    telefono: '1145678900',
    email: 'ventas@sur.com',
    activo: true,
    fechaBaja: null,
    ...overrides,
  };
}

const BODY_VALIDO = {
  nombre: '  Distribuidora Sur  ',
  cuil: '20123456789',
  descripcion: '  Aves frescas  ',
  ctaCte: true,
  telefono: '1145678900',
  email: 'Ventas@Sur.com',
};

beforeEach(() => {
  proveedorRepo.buscarTodos.mockResolvedValue([proveedor()]);
  proveedorRepo.buscarPorId.mockResolvedValue(proveedor());
  proveedorRepo.crear.mockResolvedValue(proveedor());
  proveedorRepo.actualizar.mockResolvedValue(proveedor());
  proveedorRepo.eliminar.mockResolvedValue(proveedor({ activo: false }));
});

describe('getProveedores', () => {

  it('devuelve la lista ordenada por nombre', async () => {
    const res = crearRes();
    await getProveedores(crearReq(), res);

    expect(proveedorRepo.buscarTodos).toHaveBeenCalledWith('nombre', 'ASC');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([proveedor()]);
  });

  it('responde 500 si el repositorio falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedorRepo.buscarTodos.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await getProveedores(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo guardar el proveedor en la base de datos.',
    });
    consola.mockRestore();
  });
});

describe('getProveedorById', () => {

  it('devuelve el proveedor encontrado', async () => {
    const res = crearRes();
    await getProveedorById(crearReq({ params: { id: '5' } }), res);

    expect(proveedorRepo.buscarPorId).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith(proveedor());
  });

  it('rechaza un identificador inválido sin tocar el repositorio', async () => {
    const res = crearRes();
    await getProveedorById(crearReq({ params: { id: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El identificador del proveedor no es válido.',
    });
    expect(proveedorRepo.buscarPorId).not.toHaveBeenCalled();
  });

  it('rechaza el identificador cero', async () => {
    const res = crearRes();
    await getProveedorById(crearReq({ params: { id: '0' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedorRepo.buscarPorId).not.toHaveBeenCalled();
  });

  it('responde 404 cuando el proveedor no existe', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await getProveedorById(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Proveedor no encontrado.' });
  });

  it('responde 500 si el repositorio falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedorRepo.buscarPorId.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await getProveedorById(crearReq({ params: { id: '5' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    consola.mockRestore();
  });
});

describe('createProveedor', () => {

  it('normaliza el cuerpo y responde 201', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: BODY_VALIDO }), res);

    expect(proveedorRepo.crear).toHaveBeenCalledWith({
      nombre: 'Distribuidora Sur',
      cuil: '20123456789',
      descripcion: 'Aves frescas',
      ctaCte: true,
      telefono: '1145678900',
      email: 'ventas@sur.com',
      activo: true,
      fechaBaja: null,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('normaliza el email a minúsculas y acepta ctaCte como string "true"', async () => {
    const res = crearRes();
    await createProveedor(
      crearReq({ body: { nombre: 'Sur', ctaCte: 'true', email: 'MAYUS@sur.com' } }), res,
    );

    expect(proveedorRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ ctaCte: true, email: 'mayus@sur.com' }),
    );
  });

  it('interpreta ctaCte como false si no es booleano ni "true"', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: { nombre: 'Sur', ctaCte: 'no' } }), res);

    expect(proveedorRepo.crear).toHaveBeenCalledWith(expect.objectContaining({ ctaCte: false }));
  });

  it('deja en null los campos opcionales vacíos', async () => {
    const res = crearRes();
    await createProveedor(
      crearReq({ body: { nombre: 'Sur', cuil: '  ', descripcion: '', telefono: 123, email: null } }), res,
    );

    expect(proveedorRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ cuil: null, descripcion: null, telefono: null, email: null }),
    );
  });

  it('rechaza un nombre vacío o de más de 50 caracteres', async () => {
    for (const nombre of ['', '   ', 'x'.repeat(51)]) {
      const res = crearRes();
      await createProveedor(crearReq({ body: { nombre } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'El nombre debe tener entre 1 y 50 caracteres.',
      });
    }
    expect(proveedorRepo.crear).not.toHaveBeenCalled();
  });

  it('rechaza un nombre que no es texto', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: { nombre: 123 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El nombre debe tener entre 1 y 50 caracteres.',
    });
  });

  it('rechaza un CUIL que no tiene 11 dígitos', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: { nombre: 'Sur', cuil: '123' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El CUIL debe contener exactamente 11 dígitos numéricos.',
    });
  });

  it('rechaza un teléfono fuera de 10 a 15 dígitos', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: { nombre: 'Sur', telefono: '123' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El teléfono debe contener entre 10 y 15 dígitos.',
    });
  });

  it('rechaza un email que no termina en .com', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: { nombre: 'Sur', email: 'a@b.net' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El email debe tener un formato válido y finalizar en .com.',
    });
  });

  it('rechaza una descripción de más de 300 caracteres', async () => {
    const res = crearRes();
    await createProveedor(crearReq({ body: { nombre: 'Sur', descripcion: 'x'.repeat(301) } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La descripción no puede superar los 300 caracteres.',
    });
  });

  it('traduce el choque de unicidad a 409', async () => {
    proveedorRepo.crear.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "proveedores_cuil_unique"'),
    );
    const res = crearRes();
    await createProveedor(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Ya existe un proveedor registrado con ese CUIL, email o teléfono.',
    });
  });

  it('responde 500 aunque la base rechace con un valor que no es Error', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedorRepo.crear.mockRejectedValue('boom');
    const res = crearRes();
    await createProveedor(crearReq({ body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    consola.mockRestore();
  });
});

describe('updateProveedor', () => {

  it('rechaza un identificador inválido antes de leer el cuerpo', async () => {
    const res = crearRes();
    await updateProveedor(crearReq({ params: { id: 'abc' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedorRepo.actualizar).not.toHaveBeenCalled();
  });

  it('actualiza y responde 200', async () => {
    const res = crearRes();
    await updateProveedor(crearReq({ params: { id: '5' }, body: BODY_VALIDO }), res);

    expect(proveedorRepo.actualizar).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ nombre: 'Distribuidora Sur', email: 'ventas@sur.com' }),
    );
    expect(res.json).toHaveBeenCalledWith(proveedor());
  });

  it('valida el cuerpo aunque el id sea válido', async () => {
    const res = crearRes();
    await updateProveedor(
      crearReq({ params: { id: '5' }, body: { ...BODY_VALIDO, email: 'malo' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedorRepo.actualizar).not.toHaveBeenCalled();
  });

  it('responde 404 cuando el proveedor no existe', async () => {
    proveedorRepo.actualizar.mockResolvedValue(null);
    const res = crearRes();
    await updateProveedor(crearReq({ params: { id: '999' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Proveedor no encontrado.' });
  });

  it('responde 500 si la actualización falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedorRepo.actualizar.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await updateProveedor(crearReq({ params: { id: '5' }, body: BODY_VALIDO }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    consola.mockRestore();
  });
});

describe('deactivateProveedor', () => {

  it('rechaza un identificador inválido', async () => {
    const res = crearRes();
    await deactivateProveedor(crearReq({ params: { id: '-3' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedorRepo.eliminar).not.toHaveBeenCalled();
  });

  it('hace la baja lógica y responde 200', async () => {
    const res = crearRes();
    await deactivateProveedor(crearReq({ params: { id: '5' } }), res);

    expect(proveedorRepo.eliminar).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ activo: false }));
  });

  it('responde 404 cuando el proveedor no existe', async () => {
    proveedorRepo.eliminar.mockResolvedValue(null);
    const res = crearRes();
    await deactivateProveedor(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responde 500 si la baja falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedorRepo.eliminar.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await deactivateProveedor(crearReq({ params: { id: '5' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    consola.mockRestore();
  });
});

describe('reactivateProveedor', () => {

  it('reactiva el proveedor y responde 200', async () => {
    const res = crearRes();
    await reactivateProveedor(crearReq({ params: { id: '5' } }), res);

    expect(proveedorRepo.actualizar).toHaveBeenCalledWith(5, { activo: true, fechaBaja: null });
    expect(res.json).toHaveBeenCalledWith(proveedor());
  });

  it('rechaza un identificador inválido sin tocar el repositorio', async () => {
    const res = crearRes();
    await reactivateProveedor(crearReq({ params: { id: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedorRepo.actualizar).not.toHaveBeenCalled();
  });

  it('responde 404 cuando el proveedor no existe', async () => {
    proveedorRepo.actualizar.mockResolvedValue(null);
    const res = crearRes();
    await reactivateProveedor(crearReq({ params: { id: '999' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Proveedor no encontrado.' });
  });

  it('responde 500 si la reactivación falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedorRepo.actualizar.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();
    await reactivateProveedor(crearReq({ params: { id: '5' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    consola.mockRestore();
  });
});
