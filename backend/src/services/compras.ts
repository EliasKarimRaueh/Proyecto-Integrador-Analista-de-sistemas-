import sequelize from 'polleria-database/config/database';
import CompraRepository from 'polleria-database/repositories/compraRepository';
import CuentaProveedorRepository from 'polleria-database/repositories/cuentaProveedorRepository';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';
import { ErrorOperacion, objeto, numero, id } from './operaciones.js';

const compras = new CompraRepository();
const cuentas = new CuentaProveedorRepository();
const proveedores = new ProveedorRepository();

export async function registrarCompra(body: unknown) {
  const b = objeto(body);
  const proveedorId = id(b.proveedorId, 'proveedorId');
  const total = numero(b.total, 'total', true);
  const monto = total.toFixed(2);

  const proveedor = await proveedores.buscarPorId(proveedorId);
  if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);

  const fechaHora = b.fechaHora === undefined ? new Date() : new Date(String(b.fechaHora));
  if (Number.isNaN(fechaHora.getTime())) throw new ErrorOperacion('La fecha de la compra no es válida.');

  return await sequelize.transaction(async transaction => {
    const compra = await compras.crear(
      { proveedorId, total: monto as unknown as number, fechaHora } as never,
      transaction
    );

    const cuenta = await cuentas.crear(
      {
        proveedorId,
        compraId: compra.id,
        importePendiente: monto as unknown as number,
        estado: 'PAGO PENDIENTE'
      } as never,
      transaction
    );

    return { compra, cuenta };
  });
}

export async function listarCompras(
  page: number,
  limit: number,
  proveedorId?: number,
  desde?: Date,
  hasta?: Date
) {
  if (proveedorId !== undefined && desde && hasta) {
    return await compras.buscarPorProveedorYFechas(proveedorId, desde, hasta, page, limit);
  }
  if (proveedorId !== undefined) {
    return await compras.buscarPorProveedor(proveedorId, page, limit);
  }
  if (desde && hasta) {
    return await compras.buscarPorFechas(desde, hasta, page, limit);
  }
  const filas = await compras.buscarTodas();
  return { count: filas.length, rows: filas.slice((page - 1) * limit, (page - 1) * limit + limit) };
}

export async function detalleCompra(compraId: number) {
  const compra = await compras.buscarPorId(compraId);
  if (!compra) throw new ErrorOperacion('Compra no encontrada.', 404);
  const cuenta = await cuentas.buscarPorCompra(compraId);
  return { compra, cuenta };
}
