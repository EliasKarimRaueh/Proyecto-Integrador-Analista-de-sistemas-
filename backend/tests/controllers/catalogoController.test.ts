import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/productoProveedorRepository', () => require('../mocks/productoProveedorRepository.js'));
jest.mock('polleria-database/repositories/proveedorRepository', () => require('../mocks/proveedorRepository.js'));
jest.mock('polleria-database/repositories/productoRepository', () => require('../mocks/productoRepository.js'));

import {
  getProductosDeProveedor,
  getProveedoresDeProducto,
  postRelacion,
  putRelacion,
  deleteRelacion,
} from '../../src/controllers/catalogoController.js';
import { instancia as relacionRepo } from '../mocks/productoProveedorRepository.js';
import { instancia as proveedorRepo } from '../mocks/proveedorRepository.js';
import { instancia as productoRepo } from '../mocks/productoRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { usarTransaccionFalsa } from '../helpers/transaccion.js';

function producto(overrides: Record<string, unknown> = {}) {
  return { id: 10, codigo: 'P-001', nombre: 'Pollo entero', activo: true, ...overrides };
}

function proveedor(overrides: Record<string, unknown> = {}) {
  return { id: 5, nombre: 'Distribuidora Sur', activo: true, ...overrides };
}

beforeEach(() => {
  proveedorRepo.buscarPorId.mockResolvedValue(proveedor());
  productoRepo.findById.mockResolvedValue(producto());
  relacionRepo.getProductos.mockResolvedValue([producto()]);
  relacionRepo.getProductosActivos.mockResolvedValue([producto()]);
  relacionRepo.getProveedores.mockResolvedValue([proveedor()]);
  relacionRepo.create.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
  relacionRepo.findByRelation.mockResolvedValue(null);
  relacionRepo.activateRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true, fechaBaja: null });
  relacionRepo.deleteRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: false });
});

describe('getProductosDeProveedor', () => {

  it('lista todos los productos del proveedor', async () => {
    const res = crearRes();
    await getProductosDeProveedor(crearReq({ params: { proveedorId: '5' } }), res);

    expect(relacionRepo.getProductos).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith([{ id: 10, codigo: 'P-001', nombre: 'Pollo entero', activo: true }]);
  });

  it('lista solo los activos si activo=true', async () => {
    const res = crearRes();
    await getProductosDeProveedor(crearReq({ params: { proveedorId: '5' }, query: { activo: 'true' } }), res);

    expect(relacionRepo.getProductosActivos).toHaveBeenCalledWith(5);
  });

  it('responde 404 si el proveedor no existe', async () => {
    proveedorRepo.buscarPorId.mockResolvedValue(null);
    const res = crearRes();
    await getProductosDeProveedor(crearReq({ params: { proveedorId: '5' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Proveedor no encontrado.' });
  });
});

describe('getProveedoresDeProducto', () => {

  it('lista los proveedores del producto', async () => {
    const res = crearRes();
    await getProveedoresDeProducto(crearReq({ params: { productoId: '10' } }), res);

    expect(relacionRepo.getProveedores).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith([{ id: 5, nombre: 'Distribuidora Sur', activo: true }]);
  });

  it('responde 404 si el producto no existe', async () => {
    productoRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await getProveedoresDeProducto(crearReq({ params: { productoId: '10' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('postRelacion', () => {

  it('crea la relación y responde 201', async () => {
    usarTransaccionFalsa();
    const res = crearRes();
    await postRelacion(crearReq({ body: { productoId: 10, proveedorId: 5 } }), res);

    expect(relacionRepo.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('reactiva una relación inactiva existente', async () => {
    usarTransaccionFalsa();
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: false });
    const res = crearRes();
    await postRelacion(crearReq({ body: { productoId: 10, proveedorId: 5 } }), res);

    expect(relacionRepo.activateRelation).toHaveBeenCalledWith(10, 5, expect.anything());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responde 409 si la relación ya está activa', async () => {
    usarTransaccionFalsa();
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
    const res = crearRes();
    await postRelacion(crearReq({ body: { productoId: 10, proveedorId: 5 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'La relación ya existe.' });
  });

  it('valida productoId/proveedorId inválidos', async () => {
    const res = crearRes();
    await postRelacion(crearReq({ body: { productoId: 0, proveedorId: 5 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'productoId inválido.' });
  });

  it('valida proveedorId inválido', async () => {
    const res = crearRes();
    await postRelacion(crearReq({ body: { productoId: 10, proveedorId: 0 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'proveedorId inválido.' });
  });

  it('responde 404 si el producto no existe', async () => {
    productoRepo.findById.mockResolvedValue(null);
    const res = crearRes();
    await postRelacion(crearReq({ body: { productoId: 10, proveedorId: 5 } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('putRelacion', () => {

  it('da de baja la relación si activo=false', async () => {
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
    const res = crearRes();
    await putRelacion(crearReq({ params: { productoId: '10', proveedorId: '5' }, body: { activo: false } }), res);

    expect(relacionRepo.deleteRelation).toHaveBeenCalledWith(10, 5);
  });

  it('reactiva la relación si activo=true', async () => {
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: false });
    const res = crearRes();
    await putRelacion(crearReq({ params: { productoId: '10', proveedorId: '5' }, body: { activo: true } }), res);

    expect(relacionRepo.activateRelation).toHaveBeenCalledWith(10, 5);
  });

  it('responde 404 si la relación no existe', async () => {
    relacionRepo.findByRelation.mockResolvedValue(null);
    const res = crearRes();
    await putRelacion(crearReq({ params: { productoId: '10', proveedorId: '5' }, body: { activo: true } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Relación no encontrada.' });
  });
});

describe('deleteRelacion', () => {

  it('elimina lógicamente la relación existente', async () => {
    relacionRepo.findByRelation.mockResolvedValue({ productoId: 10, proveedorId: 5, activo: true });
    const res = crearRes();
    await deleteRelacion(crearReq({ params: { productoId: '10', proveedorId: '5' } }), res);

    expect(relacionRepo.deleteRelation).toHaveBeenCalledWith(10, 5);
  });

  it('responde 404 si no existe', async () => {
    relacionRepo.findByRelation.mockResolvedValue(null);
    const res = crearRes();
    await deleteRelacion(crearReq({ params: { productoId: '10', proveedorId: '5' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
