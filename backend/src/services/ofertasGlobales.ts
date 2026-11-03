import sequelize from 'polleria-database/config/database';
import Oferta from 'polleria-database/models/Oferta';
import OfertaProducto from 'polleria-database/models/OfertaProducto';
import Producto from 'polleria-database/models/Producto';
import PrecioRepository from 'polleria-database/repositories/precioRepository';
import { Op, type Transaction } from 'sequelize';
import { ErrorOperacion, id, numero, objeto } from './validacion.js';
import { centavos, descontarSubtotal } from './dinero.js';

export function porcentajeOferta(valor: unknown) {
  if ((typeof valor !== 'string' && typeof valor !== 'number') || !/^\d+(\.\d{1,2})?$/.test(String(valor)) || Number(valor) > 100) throw new ErrorOperacion('El descuento debe estar entre 0 y 100, con hasta dos decimales.');
  return Number(valor).toFixed(2);
}
export async function guardarOfertaGlobal(ofertaId: number | undefined, body: unknown) {
  const b = objeto(body);
  const nombre = typeof b.nombre === 'string' ? b.nombre.trim() : '';
  const descripcion = typeof b.descripcion === 'string' ? b.descripcion.trim() : '';
  if (!nombre || nombre.length > 50 || descripcion.length > 300) throw new ErrorOperacion('Revisá el nombre y la descripción de la oferta.');
  const descuentoPorcentaje = porcentajeOferta(b.descuentoPorcentaje);
  const fechaInicio = new Date(String(b.fechaInicio)), fechaFin = new Date(String(b.fechaFin));
  if ([b.fechaInicio, b.fechaFin].some(valor => typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(new Date(valor).getTime()) || new Date(valor).toISOString().slice(0, 10) !== valor)) throw new ErrorOperacion('Indicá fechas válidas para la oferta.');
  // El último día de vigencia se incluye completo, conservando la fecha del catálogo.
  fechaFin.setUTCHours(23, 59, 59, 999);
  if (!Number.isFinite(fechaInicio.getTime()) || !Number.isFinite(fechaFin.getTime()) || fechaFin <= fechaInicio) throw new ErrorOperacion('La fecha de fin debe ser posterior al inicio.');
  if (!Array.isArray(b.productos) || !b.productos.length || b.productos.length > 200) throw new ErrorOperacion('Seleccioná entre 1 y 200 productos.');
  const items = b.productos.map(crudo => { const p = objeto(crudo); return { productoId: id(p.productoId), cantidad: numero(p.cantidad ?? 1, 'Cantidad') }; });
  if (new Set(items.map(p => p.productoId)).size !== items.length) throw new ErrorOperacion('Hay productos repetidos en la oferta.');
  return sequelize.transaction(async transaction => {
    let oferta = ofertaId === undefined ? null : await Oferta.findByPk(ofertaId, { transaction, lock: transaction.LOCK.UPDATE });
    if (ofertaId !== undefined && (!oferta || !oferta.activo)) throw new ErrorOperacion('Oferta no encontrada o dada de baja.', 404);
    const productos = await Producto.findAll({ where: { id: { [Op.in]: items.map(i => i.productoId) } }, transaction, lock: transaction.LOCK.SHARE });
    if (productos.length !== items.length || productos.some(p => !p.activo)) throw new ErrorOperacion('Los productos deben existir y estar activos.');
    for (const item of items) {
      if (item.cantidad > 1000000 || Math.abs(item.cantidad * 1000000 - Math.round(item.cantidad * 1000000)) > 1e-5 || (productos.find(p => p.id === item.productoId)!.unidadVenta === 'UNIDADES' && !Number.isSafeInteger(item.cantidad))) throw new ErrorOperacion('Revisá las cantidades: unidades enteras o kilos con hasta seis decimales.');
    }
    const precios = await new PrecioRepository().findAllVigentes(items.map(i => i.productoId), new Date(), transaction);
    if (items.some(i => precios.filter(p => p.productoId === i.productoId).length !== 1)) throw new ErrorOperacion('Cada producto necesita un precio de lista vigente.');
    const cambios = { nombre, descripcion, fechaInicio, fechaFin, descuentoPorcentaje };
    oferta = oferta ? await oferta.update(cambios, { transaction }) : await Oferta.create({ ...cambios, activo: true, fechaBaja: null }, { transaction });
    const relaciones = await OfertaProducto.findAll({ where: { ofertaId: oferta.id }, transaction });
    for (const relacion of relaciones) {
      const item = items.find(i => i.productoId === relacion.productoId);
      await relacion.update(item ? { cantidad: item.cantidad, activo: true, fechaBaja: null } : { activo: false, fechaBaja: relacion.fechaBaja ?? new Date() }, { transaction });
    }
    for (const item of items.filter(i => !relaciones.some(r => r.productoId === i.productoId))) await OfertaProducto.create({ ofertaId: oferta.id, ...item, precioOferta: '0.00', activo: true, fechaBaja: null }, { transaction });
    return oferta;
  });
}
export async function precioCombo(items: { productoId: number; cantidad: number }[], descuento: string, lista: string, transaction?: Transaction) {
  const precios = await new PrecioRepository().findAllVigentes(items.map(i => i.productoId), new Date(), transaction);
  const componentes = items.map(item => {
    const vigentes = precios.filter(p => p.productoId === item.productoId);
    if (vigentes.length !== 1) throw new ErrorOperacion('Un componente no tiene exactamente un precio vigente.', 409);
    const valor = lista === 'MAYORISTA' ? vigentes[0].precioMayorista : vigentes[0].precioMinorista;
    if (valor === null) throw new ErrorOperacion('Un componente no tiene precio mayorista vigente.', 409);
    return { ...item, precioLista: String(valor), subtotal: centavos(item.cantidad, valor) };
  });
  const subtotal = componentes.reduce((s, i) => s + i.subtotal, 0n);
  if (subtotal > 9999999999n) throw new ErrorOperacion('El subtotal de la oferta supera el máximo permitido.');
  return { resumen: descontarSubtotal(subtotal, descuento), componentes };
}
