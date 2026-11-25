import { Op, type Transaction } from 'sequelize';
import Producto from 'polleria-database/models/Producto';
import Proveedor from 'polleria-database/models/Proveedor';
import ProductoProveedor from 'polleria-database/models/ProductoProveedor';
import PrecioRepository from 'polleria-database/repositories/precioRepository';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import { ErrorOperacion, id } from './validacion.js';

export function camposProducto(body: Record<string, unknown>, unidad: unknown) {
  const data: Partial<Producto> = {};
  for (const campo of ['stockActual', 'stockMinimo', 'margenStock'] as const) {
    if (body[campo] === undefined) continue;
    if (body[campo] === null && campo !== 'stockActual') { data[campo] = null; continue; }
    const valor = body[campo];
    if ((typeof valor !== 'number' && typeof valor !== 'string') || String(valor).trim() === '' || !Number.isFinite(Number(valor)) || Number(valor) < 0 || Number(valor) > 1000000 || Math.abs(Number(valor) * 1000 - Math.round(Number(valor) * 1000)) > 1e-6 || unidad === 'unidad' && !Number.isInteger(Number(valor))) throw new ErrorOperacion(`Valor inválido para ${campo}.`);
    data[campo] = Number(valor);
  }
  if (body.tipoReposicion !== undefined) {
    if (!['diario', 'semanal', 'stockMinimo'].includes(String(body.tipoReposicion))) throw new ErrorOperacion('Tipo de reposición inválido.');
    data.tipoReposicion = body.tipoReposicion as Producto['tipoReposicion'];
  }
  if (body.costoActual !== undefined) data.costoActual = monto(body.costoActual);
  if (['imagenBase64', 'imagenNombre', 'imagenMime', 'imagenBytes'].some(campo => body[campo] !== undefined)) throw new ErrorOperacion('No se permiten imágenes de producto.');
  if (body.proveedorHabitualId !== undefined) {
    if (body.proveedorHabitualId !== null && (!Number.isSafeInteger(body.proveedorHabitualId) || Number(body.proveedorHabitualId) <= 0)) throw new ErrorOperacion('Proveedor habitual inválido.');
    data.proveedorHabitualId = body.proveedorHabitualId as number | null;
  }
  if (data.tipoReposicion === 'stockMinimo' && body.stockMinimo === null) throw new ErrorOperacion('Indicá el stock mínimo.');
  if (body.precioMinorista !== undefined) monto(body.precioMinorista);
  if (body.precioMayorista !== undefined && body.precioMayorista !== null) {
    monto(body.precioMayorista);
    if (body.precioMinorista === undefined || Number(body.precioMayorista) > Number(body.precioMinorista)) throw new ErrorOperacion('El mayorista no puede superar al minorista.');
  }
  if (body.proveedorIds !== undefined && (!Array.isArray(body.proveedorIds) || body.proveedorIds.length > 1000 || body.proveedorIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(body.proveedorIds).size !== body.proveedorIds.length)) throw new ErrorOperacion('Lista de proveedores inválida.');
  return data;
}

function monto(valor: unknown) {
  if ((typeof valor !== 'number' && typeof valor !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(valor)) || Number(valor) > 99999999.99) throw new ErrorOperacion('El precio debe ser positivo o cero y admitir hasta dos decimales.');
  return Number(valor).toFixed(2);
}

export async function guardarComplementos(producto: Producto, body: Record<string, unknown>, transaction: Transaction, operadorId?: number) {
  if (operadorId !== undefined && body.usuarioId !== undefined) throw new ErrorOperacion('El operador se toma de la sesión; no se puede enviar usuarioId.', 400);
  if (body.stockActual !== undefined && Number(body.stockActual) !== producto.stockActual) {
    await new MovimientoStockRepository().ajustarStock(producto.id, Number(body.stockActual), operadorId ?? id(body.usuarioId ?? 1), 'AJUSTE desde catálogo de productos', transaction);
    await producto.reload({ transaction });
  }
  if (body.proveedorIds !== undefined) {
    const ids = body.proveedorIds as number[];
    const proveedores = await Proveedor.findAll({ where: { id: { [Op.in]: ids } }, transaction });
    const relaciones = await ProductoProveedor.findAll({ where: { productoId: producto.id }, transaction });
    if (proveedores.length !== ids.length || proveedores.some(p => !p.activo && !relaciones.some(r => r.proveedorId === p.id && r.activo))) throw new ErrorOperacion('Seleccioná proveedores activos.');
    for (const r of relaciones) {
      const activo = ids.includes(r.proveedorId);
      if (r.activo !== activo) await r.update({ activo, fechaBaja: activo ? null : new Date() }, { transaction });
    }
    for (const proveedorId of ids.filter(id => !relaciones.some(r => r.proveedorId === id))) await ProductoProveedor.create({ productoId: producto.id, proveedorId, activo: true }, { transaction });
  }
  if (producto.proveedorHabitualId != null) {
    const relacion = await ProductoProveedor.findOne({ where: { productoId: producto.id, proveedorId: producto.proveedorHabitualId, activo: true }, transaction });
    if (!relacion) throw new ErrorOperacion('El proveedor habitual debe estar relacionado al producto.');
  }
  if (body.precioMinorista !== undefined) {
    const repo = new PrecioRepository();
    const actual = await repo.findVigente(producto.id, new Date(), transaction);
    const minorista = monto(body.precioMinorista), mayorista = body.precioMayorista == null ? null : monto(body.precioMayorista);
    if (!actual || Number(actual.precioMinorista) !== Number(minorista) || (actual.precioMayorista == null ? null : Number(actual.precioMayorista)) !== (mayorista === null ? null : Number(mayorista))) await repo.registrarPrecio(producto.id, minorista, mayorista, new Date(), transaction);
  }
}
