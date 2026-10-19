import sequelize from 'polleria-database/config/database';
import { Op, type Transaction } from 'sequelize';
import Producto from 'polleria-database/models/Producto';
import Oferta from 'polleria-database/models/Oferta';
import Venta from 'polleria-database/models/Venta';
import DetalleVentaRepository from 'polleria-database/repositories/detalleVentaRepository';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import OfertaProductoRepository from 'polleria-database/repositories/ofertaProductoRepository';
import PrecioRepository from 'polleria-database/repositories/precioRepository';
import { centavos, importe as formatearImporte } from './dinero.js';
import { randomUUID } from 'node:crypto';

export class ErrorOperacion extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function objeto(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ErrorOperacion('Se esperaba un objeto.');
  return value as Record<string, unknown>;
}
export function numero(value: unknown, campo: string, cero = false): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') throw new ErrorOperacion(`${campo} debe ser numérico.`);
  const n = Number(value);
  if (!Number.isFinite(n) || (cero ? n < 0 : n <= 0)) throw new ErrorOperacion(`${campo} no es válido.`);
  return n;
}
export function id(value: unknown, campo = 'id'): number {
  const n = numero(value, campo);
  if (!Number.isSafeInteger(n) || n > 2147483647) throw new ErrorOperacion(`${campo} debe ser un entero válido.`);
  return n;
}
export function motivo(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 250) throw new ErrorOperacion('El motivo es obligatorio y admite hasta 250 caracteres.');
  return value.trim();
}
export function estadoStock(stock: number, minimo: number | null): string {
  if (stock <= 0 || (minimo !== null && stock <= minimo)) return 'Crítico';
  if (minimo !== null && stock <= minimo * 1.2) return 'Próximo al Mínimo';
  return 'Normal';
}
export function validarCantidad(producto: Producto, cantidad: number) {
  if (!producto.activo) throw new ErrorOperacion('El producto está inactivo.');
  if (producto.unidadVenta === 'UNIDADES' && !Number.isSafeInteger(cantidad)) throw new ErrorOperacion('Los productos por unidad requieren cantidades enteras.');
}
export async function bloquear(ids: number[], transaction: Transaction) {
  const productos = new Map<number, Producto>();
  for (const productoId of [...new Set(ids)].sort((a, b) => a - b)) {
    const p = await Producto.findByPk(productoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!p) throw new ErrorOperacion(`Producto ${productoId} no encontrado.`, 404);
    productos.set(productoId, p);
  }
  return productos;
}
const movimientos = new MovimientoStockRepository();
const ofertas = new OfertaProductoRepository();
const detalles = new DetalleVentaRepository();

export async function registrarMovimiento(body: unknown) {
  const b = objeto(body), productoId = id(b.productoId), usuarioId = id(b.usuarioId ?? 1);
  const tipos = ['INGRESO', 'EGRESO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'MERMA', 'PERDIDA', 'VENCIMIENTO', 'ROTURA', 'AJUSTE'];
  if (!tipos.includes(String(b.tipo))) throw new ErrorOperacion('Tipo de movimiento inválido.');
  const razon = motivo(b.motivo);
  const cantidad = numero(b.tipo === 'AJUSTE' ? b.stockObjetivo : b.cantMovimiento, 'cantidad', b.tipo === 'AJUSTE');
  return sequelize.transaction(async transaction => {
    const productos = await bloquear([productoId], transaction);
    const producto = productos.get(productoId)!;
    validarCantidad(producto, cantidad);
    const suma = b.tipo === 'INGRESO' || b.tipo === 'AJUSTE_POSITIVO';
    if (b.tipo !== 'AJUSTE' && !suma && producto.margenStock !== null && producto.stockActual - cantidad < -producto.margenStock) {
      throw new ErrorOperacion('El movimiento supera el margen de stock permitido.', 409);
    }
    const descripcion = `${b.tipo}: ${razon}`;
    if (b.tipo === 'AJUSTE') return movimientos.ajustarStock(productoId, cantidad, usuarioId, descripcion, transaction);
    if (b.tipo === 'INGRESO' || b.tipo === 'AJUSTE_POSITIVO') return movimientos.registrarIngreso(productoId, cantidad, usuarioId, descripcion, null, transaction);
    return movimientos.registrarEgreso(productoId, cantidad, usuarioId, descripcion, null, transaction);
  });
}

export async function fraccionar(body: unknown) {
  const b = objeto(body), productoOrigenId = id(b.productoOrigenId), usuarioId = id(b.usuarioId ?? 1);
  const cantidadOrigen = numero(b.cantidadOrigen, 'cantidadOrigen'), merma = numero(b.merma ?? 0, 'merma', true), razon = motivo(b.motivo);
  if (merma >= cantidadOrigen) throw new ErrorOperacion('La merma debe ser menor a la cantidad de origen.');
  if (!Array.isArray(b.derivados) || !b.derivados.length || b.derivados.length > 100) throw new ErrorOperacion('Debe indicar entre 1 y 100 derivados.');
  const derivados = b.derivados.map(value => { const d = objeto(value); return { productoId: id(d.productoId), cantidad: numero(d.cantidad, 'cantidad') }; });
  const ids = derivados.map(d => d.productoId);
  if (ids.includes(productoOrigenId) || new Set(ids).size !== ids.length) throw new ErrorOperacion('Los derivados deben ser distintos entre sí y del origen.');
  const total = derivados.reduce((s, d) => s + d.cantidad, merma);
  if (Math.abs(total - cantidadOrigen) > 1e-6) throw new ErrorOperacion('Origen debe coincidir con derivados más merma.');
  const operacionId = randomUUID();
  return sequelize.transaction(async transaction => {
    const productos = await bloquear([productoOrigenId, ...ids], transaction);
    for (const p of productos.values()) {
      if (!p.activo || p.unidadVenta !== 'KILOS') throw new ErrorOperacion('El fraccionamiento requiere productos activos medidos en kilos.');
    }
    const origen = productos.get(productoOrigenId)!;
    if (origen.margenStock !== null && origen.stockActual - cantidadOrigen < -origen.margenStock) {
      throw new ErrorOperacion('El fraccionamiento supera el margen de stock permitido.', 409);
    }
    const resultado = [];
    // La merma forma parte del origen; se descuenta una sola vez.
    const transformado = cantidadOrigen - merma;
    resultado.push(await movimientos.registrarEgreso(productoOrigenId, transformado, usuarioId, `DESP:${operacionId}:E ${razon}`, null, transaction));
    if (merma > 0) resultado.push(await movimientos.registrarEgreso(productoOrigenId, merma, usuarioId, `DESP:${operacionId}:M ${razon}`, null, transaction));
    for (const d of derivados) resultado.push(await movimientos.registrarIngreso(d.productoId, d.cantidad, usuarioId, `DESP:${operacionId}:I ${razon}`, null, transaction));
    return { operacionId, movimientos: resultado, merma };
  });
}

export async function vender(body: unknown, cotizacion = false) {
  const b = objeto(body), usuarioId = id(b.usuarioId ?? 1);
  if (!Array.isArray(b.detalles) || !b.detalles.length || b.detalles.length > 100) throw new ErrorOperacion('Debe indicar entre 1 y 100 detalles.');
  const lineas = b.detalles.map(value => {
    const d = objeto(value);
    if ((d.productoId != null) === (d.ofertaId != null)) throw new ErrorOperacion('Cada detalle requiere producto u oferta.');
    const tipoPrecio = d.tipoPrecio ?? b.tipoPrecio ?? 'MINORISTA';
    if (tipoPrecio !== 'MINORISTA' && tipoPrecio !== 'MAYORISTA') throw new ErrorOperacion('Lista de precios inválida.');
    return { productoId: d.productoId == null ? undefined : id(d.productoId), ofertaId: d.ofertaId == null ? undefined : id(d.ofertaId), cantidad: numero(d.cantidad, 'cantidad'), tipoPrecio };
  });
  return sequelize.transaction(async transaction => {
    const consumos = new Map<number, number>();
    const componentes = new Map<number, Awaited<ReturnType<typeof ofertas.listarDetalleProductos>>>();
    for (const l of lineas) {
      if (l.productoId !== undefined) consumos.set(l.productoId, (consumos.get(l.productoId) ?? 0) + l.cantidad);
      else {
        if (!Number.isSafeInteger(l.cantidad)) throw new ErrorOperacion('La cantidad de ofertas debe ser entera.');
        const oferta = await Oferta.findByPk(l.ofertaId!, { transaction, lock: transaction.LOCK.SHARE });
        const ahora = new Date();
        if (!oferta || !oferta.activo || oferta.fechaInicio > ahora || oferta.fechaFin < ahora) throw new ErrorOperacion('La oferta no está vigente.');
        const items = await ofertas.listarDetalleProductos(l.ofertaId!, true, transaction);
        if (!items.length) throw new ErrorOperacion('La oferta no tiene productos activos.');
        componentes.set(l.ofertaId!, items);
        for (const item of items) {
          const cantidad = l.cantidad * numero(item.relacion.cantidad, 'cantidad del componente');
          numero(item.relacion.precioOferta, 'precio del componente', true);
          validarCantidad(item.producto, cantidad);
          consumos.set(item.producto.id, (consumos.get(item.producto.id) ?? 0) + cantidad);
        }
      }
    }
    const productos = await bloquear([...consumos.keys()], transaction);
    for (const [productoId, cantidad] of consumos) {
      const p = productos.get(productoId)!;
      validarCantidad(p, cantidad);
      if (p.margenStock !== null && p.stockActual - cantidad < -p.margenStock) throw new ErrorOperacion(`Stock insuficiente para ${p.nombre}.`, 409);
    }
    const precios = new PrecioRepository();
    const calculados = [];
    for (const l of lineas) {
      let importeUnitario: number, nombre: string;
      if (l.productoId !== undefined) {
        validarCantidad(productos.get(l.productoId)!, l.cantidad);
        const vigentes = await precios.findAllVigentes([l.productoId], new Date(), transaction);
        if (vigentes.length !== 1) throw new ErrorOperacion('El producto debe tener exactamente un precio vigente.');
        const precio = vigentes[0]!;
        const importe = l.tipoPrecio === 'MINORISTA' ? precio.precioMinorista : precio.precioMayorista;
        if (importe === null) throw new ErrorOperacion('No hay precio mayorista vigente.');
        importeUnitario = Number(importe); nombre = productos.get(l.productoId)!.nombre;
      } else {
        importeUnitario = componentes.get(l.ofertaId!)!.reduce((s, i) => s + Number(i.relacion.precioOferta), 0);
        nombre = (await Oferta.findByPk(l.ofertaId!, { transaction }))!.nombre;
      }
      if (!Number.isFinite(importeUnitario) || importeUnitario < 0) throw new ErrorOperacion('Precio inválido.');
      const precioRedondeado = formatearImporte(centavos(1, importeUnitario));
      const subtotalCentavos = centavos(l.cantidad, precioRedondeado);
      if (subtotalCentavos > 9999999999n) throw new ErrorOperacion('El subtotal supera el máximo permitido.');
      calculados.push({ ...l, nombre, importeUnitario: precioRedondeado, subtotal: formatearImporte(subtotalCentavos) });
    }
    const totalCentavos = calculados.reduce((s, l) => s + centavos(1, l.subtotal), 0n);
    if (totalCentavos > 9999999999n) throw new ErrorOperacion('El total supera el máximo permitido.');
    const total = formatearImporte(totalCentavos);
    if (cotizacion) return { total, detalles: calculados };
    const venta = await Venta.create({ fechaHora: new Date(), total }, { transaction });
    const guardados = [];
    for (const [indice, l] of calculados.entries()) guardados.push(await detalles.create({ ventaId: venta.id, numeroItem: indice + 1, cantidad: l.cantidad, productoId: l.productoId ?? null, ofertaId: l.ofertaId ?? null, nombre: l.nombre, importeUnitario: Number(l.importeUnitario), subtotal: Number(l.subtotal) }, { transaction }));
    for (const [productoId, cantidad] of consumos) await movimientos.registrarEgreso(productoId, cantidad, usuarioId, null, venta.id, transaction);
    return { venta, detalles: guardados };
  });
}

export async function buscarProductos(q: string, page: number, limit: number) {
  return Producto.findAndCountAll({ where: { activo: true, ...(q ? { [Op.or]: [{ codigo: { [Op.iLike]: `%${q}%` } }, { nombre: { [Op.iLike]: `%${q}%` } }] } : {}) }, attributes: { exclude: ['imagen'] }, order: [['nombre', 'ASC']], offset: (page - 1) * limit, limit });
}
