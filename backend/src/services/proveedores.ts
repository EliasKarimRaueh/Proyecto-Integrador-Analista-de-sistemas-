import sequelize from 'polleria-database/config/database';
import { Op, Transaction } from 'sequelize';
import Proveedor from 'polleria-database/models/Proveedor';
import Producto from 'polleria-database/models/Producto';
import ProductoProveedor from 'polleria-database/models/ProductoProveedor';
import Compra from 'polleria-database/models/Compra';
import CuentaProveedor from 'polleria-database/models/CuentaProveedor';
import Pago from 'polleria-database/models/Pago';
import PagoPorCuenta from 'polleria-database/models/PagoPorCuenta';
import { ErrorOperacion, id, objeto } from './validacion.js';
import { centavos, importe } from './dinero.js';

export function montoPositivo(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0 || Number(value) > 99999999.99) throw new ErrorOperacion('Ingresá un importe positivo de hasta dos decimales.');
  return Number(value).toFixed(2);
}
export function claveOperacion(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new ErrorOperacion('La operación requiere una clave válida.');
  return value;
}
export async function productosProveedor(proveedorId: number) {
  return sequelize.transaction(async transaction => {
    if (!await Proveedor.findByPk(proveedorId, { transaction })) throw new ErrorOperacion('Proveedor no encontrado.', 404);
    return ProductoProveedor.findAll({ where: { proveedorId }, order: [['productoId', 'ASC']], transaction });
  });
}
export async function asociarProductos(proveedorId: number, body: unknown) {
  const datos = objeto(body);
  if (!Array.isArray(datos.productoIds) || datos.productoIds.length > 1000) throw new ErrorOperacion('Indicá hasta 1000 productos.');
  const ids = datos.productoIds.map(p => id(p, 'productoId'));
  if (new Set(ids).size !== ids.length) throw new ErrorOperacion('Hay productos repetidos.');
  return sequelize.transaction(async transaction => {
    const proveedor = await Proveedor.findByPk(proveedorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
    if (!proveedor.activo) throw new ErrorOperacion('Reactivá el proveedor antes de modificar sus productos.', 409);
    const relaciones = await ProductoProveedor.findAll({ where: { proveedorId }, transaction });
    const productos = await Producto.findAll({ where: { id: { [Op.in]: ids } }, transaction, lock: transaction.LOCK.SHARE });
    if (productos.length !== ids.length || productos.some(p => !p.activo && !relaciones.some(r => r.productoId === p.id && r.activo))) throw new ErrorOperacion('Seleccioná productos existentes y activos.');
    for (const relacion of relaciones) {
      const activo = ids.includes(relacion.productoId);
      if (activo !== relacion.activo) await relacion.update({ activo, fechaBaja: activo ? null : new Date() }, { transaction });
    }
    for (const productoId of ids.filter(p => !relaciones.some(r => r.productoId === p))) await ProductoProveedor.create({ proveedorId, productoId, activo: true, fechaBaja: null }, { transaction });
    return ProductoProveedor.findAll({ where: { proveedorId }, transaction, order: [['productoId', 'ASC']] });
  });
}

export function filtrosCuenta(query: Record<string, unknown>) {
  const page = query.page === undefined ? 1 : id(query.page, 'Página');
  const limite = query.limite === undefined ? 20 : id(query.limite, 'Límite');
  if (limite > 100) throw new ErrorOperacion('El límite máximo es 100.');
  const estado = query.estado ?? 'TODAS';
  if (!['TODAS', 'PAGO PENDIENTE', 'PAGO PARCIAL', 'PAGADO'].includes(String(estado))) throw new ErrorOperacion('Estado de cuenta inválido.');
  const fechas: Record<symbol, Date> = {};
  for (const campo of ['desde', 'hasta'] as const) {
    if (query[campo] === undefined || query[campo] === '') continue;
    const valor = String(query[campo]);
    const fecha = new Date(`${valor}T${campo === 'desde' ? '00:00:00.000' : '23:59:59.999'}-03:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(fecha.getTime()) || new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) !== valor) throw new ErrorOperacion('Fecha inválida.');
    fechas[campo === 'desde' ? Op.gte : Op.lte] = fecha;
  }
  if (fechas[Op.gte] && fechas[Op.lte] && fechas[Op.gte]! > fechas[Op.lte]!) throw new ErrorOperacion('La fecha inicial no puede superar la final.');
  return { page, limite, estado: String(estado), fechas };
}
export async function estadoCuenta(proveedorId: number, query: Record<string, unknown>) {
  const { page, limite, estado, fechas } = filtrosCuenta(query);
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
    const proveedor = await Proveedor.findByPk(proveedorId, { transaction });
    if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
    const saldo = await CuentaProveedor.sum('importePendiente', { where: { proveedorId }, transaction });
    const credito = await Pago.sum('importePendiente', { where: { proveedorId }, transaction });
    const fechaWhere = Reflect.ownKeys(fechas).length ? { fechaHora: fechas } : {};
    const cuentas = await CuentaProveedor.findAndCountAll({ where: { proveedorId, ...(estado === 'TODAS' ? {} : { estado }) }, include: [{ model: Compra, as: 'compra', required: true, where: fechaWhere }], limit: limite, offset: (page - 1) * limite, order: [['id', 'DESC']], transaction });
    const pagos = await Pago.findAndCountAll({ where: { proveedorId, ...fechaWhere }, include: [{ model: PagoPorCuenta, as: 'pagosPorCuenta' }], distinct: true, limit: limite, offset: (page - 1) * limite, order: [['fechaHora', 'DESC'], ['id', 'DESC']], transaction });
    return { proveedor, saldo: Number(saldo ?? 0).toFixed(2), credito: Number(credito ?? 0).toFixed(2), cuentas, pagos };
  });
}
export async function registrarPago(proveedorId: number, body: unknown) {
  const b = objeto(body), monto = montoPositivo(b.importe), clave = claveOperacion(b.claveOperacion);
  return sequelize.transaction(async transaction => {
    const proveedor = await Proveedor.findByPk(proveedorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
    const anterior = await Pago.findOne({ where: { claveOperacion: clave }, transaction });
    if (anterior) {
      if (anterior.proveedorId !== proveedorId || centavos(1, anterior.importe) !== centavos(1, monto)) throw new ErrorOperacion('La clave ya se utilizó para otro pago.', 409);
      return { pago: anterior, aplicaciones: await PagoPorCuenta.findAll({ where: { pagoId: anterior.id }, transaction }) };
    }
    const cuentas = await CuentaProveedor.findAll({ where: { proveedorId, importePendiente: { [Op.gt]: 0 } }, include: [{ model: Compra, as: 'compra', required: true }], order: [[{ model: Compra, as: 'compra' }, 'fechaHora', 'ASC'], ['id', 'ASC']], transaction, lock: { level: transaction.LOCK.UPDATE, of: CuentaProveedor } });
    const saldo = cuentas.reduce((s, c) => s + centavos(1, c.importePendiente), 0n);
    let restante = centavos(1, monto);
    if (restante > saldo) throw new ErrorOperacion('El pago supera la deuda pendiente. Actualizá el estado de cuenta.', 409);
    const pago = await Pago.create({ proveedorId, importe: monto, importePendiente: '0.00', claveOperacion: clave }, { transaction });
    const aplicaciones = [];
    for (const cuenta of cuentas) {
      if (!restante) break;
      const pendiente = centavos(1, cuenta.importePendiente), aplicado = restante < pendiente ? restante : pendiente;
      const nuevoSaldo = pendiente - aplicado;
      await cuenta.update({ importePendiente: importe(nuevoSaldo), estado: nuevoSaldo === 0n ? 'PAGADO' : 'PAGO PARCIAL' }, { transaction });
      aplicaciones.push(await PagoPorCuenta.create({ pagoId: pago.id, cuentaId: cuenta.id, importeAplicado: importe(aplicado) }, { transaction }));
      restante -= aplicado;
    }
    return { pago, aplicaciones };
  });
}
export async function registrarComprobante(proveedorId: number, body: unknown) {
  const b = objeto(body), total = montoPositivo(b.total), clave = claveOperacion(b.claveOperacion);
  const numero = typeof b.numeroComprobante === 'string' ? b.numeroComprobante.trim() : '';
  if (!numero || numero.length > 80) throw new ErrorOperacion('Indicá un número de comprobante de hasta 80 caracteres.');
  const fecha = typeof b.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? new Date(`${b.fecha}T12:00:00-03:00`) : new Date(NaN);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== b.fecha || String(b.fecha) > hoy) throw new ErrorOperacion('Indicá una fecha válida que no sea futura.');
  return sequelize.transaction(async transaction => {
    const proveedor = await Proveedor.findByPk(proveedorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
    const anterior = await Compra.findOne({ where: { claveOperacion: clave }, transaction });
    if (anterior) {
      if (anterior.proveedorId !== proveedorId || centavos(1, anterior.total) !== centavos(1, total) || anterior.numeroComprobante !== numero || anterior.fechaHora.getTime() !== fecha.getTime()) throw new ErrorOperacion('La clave ya se utilizó para otro comprobante.', 409);
      return anterior;
    }
    if (!proveedor.activo || !proveedor.ctaCte) throw new ErrorOperacion('El proveedor debe estar activo y tener cuenta corriente habilitada.', 409);
    if (await Compra.findOne({ where: { proveedorId, numeroComprobante: numero }, transaction })) throw new ErrorOperacion('El comprobante ya está registrado para este proveedor.', 409);
    const compra = await Compra.create({ proveedorId, total, numeroComprobante: numero, claveOperacion: clave, fechaHora: fecha }, { transaction });
    await CuentaProveedor.create({ proveedorId, compraId: compra.id, importePendiente: total, estado: 'PAGO PENDIENTE' }, { transaction });
    return compra;
  });
}
