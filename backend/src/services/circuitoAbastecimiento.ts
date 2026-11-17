import sequelize from 'polleria-database/config/database';
import CircuitoRepository from 'polleria-database/repositories/circuitoAbastecimientoRepository';
import Producto from 'polleria-database/models/Producto';
import Proveedor from 'polleria-database/models/Proveedor';
import Pedido from 'polleria-database/models/Pedido';
import DetallePedido from 'polleria-database/models/DetallePedido';
import DetalleRecepcion from 'polleria-database/models/DetalleRecepcion';
import DetalleCompra from 'polleria-database/models/DetalleCompra';
import MovimientoStock from 'polleria-database/models/MovimientoStock';
import CuentaProveedor from 'polleria-database/models/CuentaProveedor';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import { Op, type Transaction } from 'sequelize';
import { ErrorOperacion, objeto, numero, id } from './validacion.js';
import { centavos, importe } from './dinero.js';

const circuito = new CircuitoRepository();
const repositorioMovimientos = new MovimientoStockRepository();
const presentaciones = ['KILOS', 'UNIDAD', 'CAJON', 'CAJA', 'BOLSA', 'BULTO'];
const redondear = (valor: number) => Number(valor.toFixed(3));
function validarCantidad(producto: Producto, cantidad: number) {
  if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > 1000000 || Math.abs(cantidad * 1000 - Math.round(cantidad * 1000)) > 1e-6 || producto.unidadVenta === 'UNIDADES' && !Number.isSafeInteger(cantidad)) throw new ErrorOperacion('La recepción admite unidades enteras o kilos con hasta tres decimales y un máximo de 1000000.');
}
function texto(valor: unknown, max: number) {
  if (valor == null || valor === '') return null;
  if (typeof valor !== 'string' || valor.trim().length > max) throw new ErrorOperacion(`El texto admite hasta ${max} caracteres.`);
  return valor.trim() || null;
}
async function esquema(transaction: Transaction) {
  if (!await circuito.esquemaDisponible(transaction)) throw new ErrorOperacion('Falta aplicar el cambio de BD de Jeremías: Compra.recepcionId y Recepción sin compraId obligatorio. No se registró la operación.', 409);
}

export async function crearRecepcion(body: unknown) {
  const b = objeto(body), pedidoId = id(b.pedidoId, 'pedidoId'), usuarioId = 1;
  if (b.compraId !== undefined) throw new ErrorOperacion('La recepción nace de un pedido; no debe indicar compraId.');
  const observaciones = texto(b.observaciones, 300);
  if (!Array.isArray(b.detalles) || !b.detalles.length || b.detalles.length > 100) throw new ErrorOperacion('Indicá entre 1 y 100 detalles.');
  return sequelize.transaction(async transaction => {
    await esquema(transaction);
    const pedido = await Pedido.findByPk(pedidoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!pedido) throw new ErrorOperacion('Pedido no encontrado.', 404);
    if (pedido.estado !== 'REALIZADO') throw new ErrorOperacion('El pedido ya fue recibido o cancelado.', 409);
    if ((await circuito.relacionadas(pedidoId, transaction)).recepcion) throw new ErrorOperacion('El pedido ya tiene una recepción.', 409);
    const pedidos = await DetallePedido.findAll({ where: { pedidoId }, transaction });
    if (!pedidos.length) throw new ErrorOperacion('El pedido no tiene productos.');
    const lineas: { productoId: number; presentacion: string; factorConversion: number; cantidadPresentacion: number; cantidadBase: number; cantidadRechazadaBase: number; cantidadFaltanteBase: number; cantidadSobranteBase: number; motivo: string | null; costoUnitario: null }[] = [];
    for (const crudo of b.detalles as unknown[]) {
      const d = objeto(crudo), productoId = id(d.productoId, 'productoId');
      if (lineas.some(l => l.productoId === productoId)) throw new ErrorOperacion('No se puede repetir un producto en la recepción.');
      const producto = await Producto.findByPk(productoId, { transaction });
      if (!producto?.activo) throw new ErrorOperacion('Seleccioná productos existentes y activos.');
      const presentacion = String(d.presentacion);
      if (!presentaciones.includes(presentacion)) throw new ErrorOperacion('Presentación inválida.');
      const factorConversion = numero(d.factorConversion, 'factorConversion');
      if (factorConversion > 1000000) throw new ErrorOperacion('El factor de conversión supera el máximo permitido.');
      if ((presentacion === 'KILOS' || presentacion === 'UNIDAD') && factorConversion !== 1) throw new ErrorOperacion('La unidad base requiere factor 1.');
      if (presentacion === 'KILOS' && producto.unidadVenta !== 'KILOS' || presentacion === 'UNIDAD' && producto.unidadVenta !== 'UNIDADES') throw new ErrorOperacion('La presentación no coincide con la unidad de venta.');
      const cantidadPresentacion = numero(d.cantidadPresentacion, 'cantidadPresentacion', true);
      const cantidadBase = redondear(cantidadPresentacion * factorConversion);
      const cantidadRechazadaBase = numero(d.cantidadRechazadaBase ?? 0, 'cantidadRechazadaBase', true);
      if (cantidadBase > 0) validarCantidad(producto, cantidadBase);
      if (cantidadRechazadaBase > 0) validarCantidad(producto, cantidadRechazadaBase);
      const pedida = Number(pedidos.find(p => p.productoId === productoId)?.cantidad ?? 0);
      const cantidadFaltanteBase = redondear(Math.max(0, pedida - cantidadBase - cantidadRechazadaBase));
      const cantidadSobranteBase = redondear(Math.max(0, cantidadBase + cantidadRechazadaBase - pedida));
      const motivo = texto(d.motivo, 200);
      if ((cantidadFaltanteBase > 0 || cantidadRechazadaBase > 0) && !motivo && !observaciones) throw new ErrorOperacion('Indicá el motivo de los faltantes o rechazos.');
      lineas.push({ productoId, presentacion, factorConversion, cantidadPresentacion, cantidadBase, cantidadRechazadaBase, cantidadFaltanteBase, cantidadSobranteBase, motivo, costoUnitario: null });
    }
    if (pedidos.some(p => !lineas.some(l => l.productoId === p.productoId))) throw new ErrorOperacion('Incluí todos los productos del pedido, con cantidad cero si no llegaron.');
    if (!lineas.some(l => l.cantidadBase > 0)) throw new ErrorOperacion('No se puede registrar una recepción sin mercadería aceptada. Cancelá el pedido desde la pestaña de pedidos.', 409);
    const conformidad = lineas.some(l => l.cantidadFaltanteBase > 0 || l.cantidadRechazadaBase > 0 || l.cantidadSobranteBase > 0) ? 'CON_DIFERENCIAS' : 'COMPLETA';
    const recepcion = await circuito.crearRecepcion({ pedidoId, proveedorId: pedido.proveedorId, observaciones, usuarioId, conformidad }, transaction);
    const detalles = await DetalleRecepcion.bulkCreate(lineas.map(({ cantidadSobranteBase: _sobrante, ...l }) => ({ ...l, recepcionId: recepcion.id })), { transaction });
    const movimientos = [];
    for (const l of [...lineas].sort((a, b) => a.productoId - b.productoId)) {
      if (l.cantidadBase > 0) movimientos.push(await repositorioMovimientos.registrarIngreso(l.productoId, l.cantidadBase, usuarioId, 'RECEPCION', null, transaction, recepcion.id));
    }
    await pedido.update({ estado: 'RECIBIDO', fechaHoraRecepcion: recepcion.fechaHora, usuarioRecepcion: usuarioId }, { transaction });
    return { recepcion, detalles, movimientos, conformidad, ajusteCuenta: 0 };
  });
}

export async function crearCompra(body: unknown) {
  const b = objeto(body), recepcionId = id(b.recepcionId, 'recepcionId');
  const tipoComprobante = texto(b.tipoComprobante, 20)?.toUpperCase() ?? null;
  if (tipoComprobante && !['FACTURA', 'REMITO', 'OTRO'].includes(tipoComprobante)) throw new ErrorOperacion('Tipo de comprobante inválido.');
  const numeroComprobante = texto(b.numeroComprobante, 80), observaciones = texto(b.observaciones, 300);
  if (!Array.isArray(b.detalles) || !b.detalles.length || b.detalles.length > 100) throw new ErrorOperacion('Indicá los costos de los productos recibidos.');
  const costos = b.detalles.map(crudo => {
    const d = objeto(crudo), productoId = id(d.productoId, 'productoId');
    if ((typeof d.costo !== 'string' && typeof d.costo !== 'number') || !/^\d+(\.\d{1,2})?$/.test(String(d.costo)) || !Number.isFinite(Number(d.costo)) || Number(d.costo) <= 0 || Number(d.costo) > 99999999.99) throw new ErrorOperacion('El costo total de cada producto debe ser mayor a cero.');
    if (['cantidad', 'cantidadPresentacion', 'factorConversion', 'presentacion'].some(k => d[k] !== undefined)) throw new ErrorOperacion('La presentación y la cantidad se toman de la recepción y no se pueden modificar.');
    return { productoId, costo: Number(d.costo).toFixed(2) };
  });
  if (new Set(costos.map(c => c.productoId)).size !== costos.length) throw new ErrorOperacion('Hay productos repetidos.');
  return sequelize.transaction(async transaction => {
    await esquema(transaction);
    const recepcion = await circuito.recepcion(recepcionId, transaction, true);
    if (!recepcion) throw new ErrorOperacion('Recepción no encontrada.', 404);
    if (recepcion.compra) throw new ErrorOperacion('La recepción ya tiene una compra registrada.', 409);
    if (!recepcion.pedidoId) throw new ErrorOperacion('La recepción necesita un pedido de origen.');
    const proveedor = await Proveedor.findByPk(recepcion.proveedorId, { transaction });
    if (!proveedor?.activo) throw new ErrorOperacion('El proveedor está inactivo.');
    const formaPago = String(b.formaPago ?? (proveedor.ctaCte ? 'A CUENTA' : 'PAGADO'));
    if (!['PAGADO', 'A CUENTA'].includes(formaPago) || !proveedor.ctaCte && formaPago !== 'PAGADO') throw new ErrorOperacion('Sin cuenta corriente la compra debe quedar PAGADO.');
    const recibidos = await DetalleRecepcion.findAll({ where: { recepcionId, cantidadBase: { [Op.gt]: 0 } }, order: [['productoId', 'ASC']], transaction });
    if (!recibidos.length || recibidos.length !== costos.length || recibidos.some(d => !costos.some(c => c.productoId === d.productoId))) throw new ErrorOperacion('La compra debe incluir exactamente los productos aceptados en la recepción.');
    const total = importe(costos.reduce((s, c) => s + centavos(1, c.costo), 0n));
    if (Number(total) > 99999999.99) throw new ErrorOperacion('El total supera el máximo permitido.');
    const compra = await circuito.crearCompra({ recepcionId, pedidoId: recepcion.pedidoId, proveedorId: recepcion.proveedorId, tipoComprobante, numeroComprobante, formaPago, observaciones, total }, transaction);
    const detalles = [];
    const pedidoDetalles = await DetallePedido.findAll({ where: { pedidoId: recepcion.pedidoId }, transaction });
    for (const [indice, d] of recibidos.entries()) {
      const producto = await Producto.findByPk(d.productoId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!producto) throw new ErrorOperacion('Producto recibido no encontrado.', 404);
      const costo = costos.find(c => c.productoId === d.productoId)!.costo;
      const cantidadMilesimas = BigInt(Math.round(Number(d.cantidadBase) * 1000));
      const costoNumerador = centavos(1, costo) * 1000n;
      const costoUnitario = importe((2n * costoNumerador + cantidadMilesimas) / (2n * cantidadMilesimas));
      if (Number(costoUnitario) > 9999999999.99) throw new ErrorOperacion('El costo por unidad de venta supera el máximo permitido.');
      detalles.push(await circuito.crearDetalleCompra({ compraId: compra.id, numeroItem: indice + 1, pedidoId: recepcion.pedidoId, numeroItemPedido: pedidoDetalles.find(p => p.productoId === d.productoId)?.numeroItem ?? null, productoId: d.productoId, nombre: producto.nombre, unidadCompra: producto.unidadVenta, cantidad: d.cantidadBase, importeUnitario: costoUnitario, subtotal: costo, presentacion: d.presentacion, cantidadPresentacion: d.cantidadPresentacion, factorConversion: d.factorConversion }, transaction));
      await producto.update({ costoActual: costoUnitario }, { transaction });
    }
    // Completa los ingresos ya generados; nunca vuelve a ingresar mercadería.
    await MovimientoStock.update({ compraId: compra.id }, { where: { recepcionId, compraId: null }, transaction });
    const cuenta = formaPago === 'A CUENTA' && Number(total) > 0 ? await CuentaProveedor.create({ proveedorId: recepcion.proveedorId, compraId: compra.id, importePendiente: total, estado: 'PAGO PENDIENTE' }, { transaction }) : null;
    return { compra, detalles, cuenta };
  });
}

export async function consultarRecepcion(recepcionId: number) {
  const recepcion = await circuito.recepcion(recepcionId);
  if (!recepcion) throw new ErrorOperacion('Recepción no encontrada.', 404);
  const detalles = await DetalleRecepcion.findAll({ where: { recepcionId }, include: [{ model: Producto, as: 'producto', attributes: ['id', 'nombre', 'unidadCompra', 'unidadVenta', 'factorConversion', 'costoActual'] }] });
  const pedidos = recepcion.pedidoId ? await DetallePedido.findAll({ where: { pedidoId: recepcion.pedidoId } }) : [];
  const proveedor = await Proveedor.findByPk(recepcion.proveedorId, { attributes: ['id', 'nombre', 'ctaCte'] });
  const movimientosStock = await MovimientoStock.findAll({ where: { recepcionId }, order: [['id', 'ASC']] });
  return { ...recepcion, proveedor, usuarioNombre: 'Dueño', pedido: recepcion.pedidoId ? { id: recepcion.pedidoId } : null, movimientosStock, detalles: detalles.map(d => ({ ...d.toJSON(), cantidadSobranteBase: redondear(Math.max(0, Number(d.cantidadBase) + Number(d.cantidadRechazadaBase) - Number(pedidos.find(p => p.productoId === d.productoId)?.cantidad ?? 0))) })) };
}

export async function consultarCompra(compraId: number) {
  const compra = await circuito.compra(compraId);
  if (!compra) throw new ErrorOperacion('Compra no encontrada.', 404);
  const detalles = await DetalleCompra.findAll({ where: { compraId }, include: [{ model: Producto, as: 'producto', attributes: ['id', 'nombre', 'unidadCompra', 'unidadVenta', 'factorConversion'] }] });
  const cuenta = await CuentaProveedor.findOne({ where: { compraId } });
  return { compra: { ...compra, pedido: compra.pedidoId ? { id: compra.pedidoId } : null, detalles }, cuenta, totalRecibido: null };
}

export async function consultarCompras(page: number, limit: number, proveedorId?: number, desde?: Date, hasta?: Date, estado?: string) {
  return circuito.listar('compras', { proveedorId, desde, hasta, estado }, page, limit);
}
export async function consultarRecepciones(page: number, limit: number, compraId?: number, proveedorId?: number, desde?: Date, hasta?: Date, pedidoId?: number) {
  return circuito.listar('recepciones', { compraId, proveedorId, desde, hasta, pedidoId }, page, limit);
}
