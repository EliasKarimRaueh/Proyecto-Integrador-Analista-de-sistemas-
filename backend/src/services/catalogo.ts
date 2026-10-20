import sequelize from 'polleria-database/config/database';
import ProductoProveedorRepository from 'polleria-database/repositories/productoProveedorRepository';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import { ErrorOperacion, objeto } from './operaciones.js';

const relaciones = new ProductoProveedorRepository();
const proveedores = new ProveedorRepository();
const productos = new ProductoRepository();

async function exigirProveedor(proveedorId: number) {
  const proveedor = await proveedores.buscarPorId(proveedorId);
  if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
  return proveedor;
}

async function exigirProducto(productoId: number) {
  const producto = await productos.findById(productoId);
  if (!producto) throw new ErrorOperacion('Producto no encontrado.', 404);
  return producto;
}

export async function listarProductosDeProveedor(proveedorId: number, soloActivos: boolean) {
  await exigirProveedor(proveedorId);
  const items = soloActivos
    ? await relaciones.getProductosActivos(proveedorId)
    : await relaciones.getProductos(proveedorId);
  return items.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, activo: p.activo }));
}

export async function listarProveedoresDeProducto(productoId: number) {
  await exigirProducto(productoId);
  const items = await relaciones.getProveedores(productoId);
  return items.map(p => ({ id: p.id, nombre: p.nombre, activo: p.activo }));
}

export async function asociar(body: unknown) {
  const b = objeto(body);
  const productoId = Number(b.productoId);
  const proveedorId = Number(b.proveedorId);

  if (!Number.isSafeInteger(productoId) || productoId <= 0) throw new ErrorOperacion('productoId inválido.');
  if (!Number.isSafeInteger(proveedorId) || proveedorId <= 0) throw new ErrorOperacion('proveedorId inválido.');

  await exigirProducto(productoId);
  await exigirProveedor(proveedorId);

  return await sequelize.transaction(async transaction => {
    const existente = await relaciones.findByRelation(productoId, proveedorId, transaction);

    if (existente) {
      if (existente.activo) throw new ErrorOperacion('La relación ya existe.', 409);
      return await relaciones.activateRelation(productoId, proveedorId, transaction);
    }

    return await relaciones.create(
      { productoId, proveedorId, activo: true, fechaBaja: null } as never,
      { transaction }
    );
  });
}

export async function cambiarEstado(productoId: number, proveedorId: number, activo: boolean) {
  const existente = await relaciones.findByRelation(productoId, proveedorId);
  if (!existente) throw new ErrorOperacion('Relación no encontrada.', 404);

  if (activo) return await relaciones.activateRelation(productoId, proveedorId);
  return await relaciones.deleteRelation(productoId, proveedorId);
}

export async function desasociar(productoId: number, proveedorId: number) {
  const existente = await relaciones.findByRelation(productoId, proveedorId);
  if (!existente) throw new ErrorOperacion('Relación no encontrada.', 404);
  return await relaciones.deleteRelation(productoId, proveedorId);
}
