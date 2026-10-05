import { type Request, type Response } from 'express';
import Producto from 'polleria-database/models/Producto';
import MovimientoStock from 'polleria-database/models/MovimientoStock';
import { Op } from 'sequelize';
import { registrarMovimiento as guardarMovimiento, fraccionar, estadoStock, id, numero, objeto, ErrorOperacion } from '../services/operaciones.js';
import { ejecutar, paginacion, rangoFechas } from './operacionesController.js';
export const getEstadoStock = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const resultado = await Producto.findAndCountAll({ where: { activo: true }, attributes: { exclude: ['imagen'] }, order: [['id', 'ASC']], limit, offset: (page - 1) * limit });
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, stockActual: p.stockActual, stockMinimo: p.stockMinimo, margenStock: p.margenStock, unidadVenta: p.unidadVenta, estado: estadoStock(p.stockActual, p.stockMinimo) }));
});
export const registrarMovimiento = (req: Request, res: Response) => ejecutar(res, () => guardarMovimiento(req.body), 201);
export const registrarFraccionamiento = (req: Request, res: Response) => ejecutar(res, () => fraccionar(req.body), 201);
export const getMovimientos = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const where: Record<string, unknown> = {};
  const { desde, hasta } = rangoFechas(req);
  if (desde || hasta) where.fechaHora = { ...(desde ? { [Op.gte]: desde } : {}), ...(hasta ? { [Op.lte]: hasta } : {}) };
  const producto = req.params.productoId ?? req.query.productoId;
  if (producto !== undefined) where.productoId = id(producto);
  if (req.query.ventaId !== undefined) where.ventaId = id(req.query.ventaId);
  if (req.query.operacionId !== undefined) {
    if (typeof req.query.operacionId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.query.operacionId)) throw new ErrorOperacion('operacionId inválido.');
    where.motivo = { [Op.like]: `DESP:${req.query.operacionId}:%` };
  }
  if (req.query.tipo !== undefined) {
    if (req.query.tipo !== 'INGRESO' && req.query.tipo !== 'EGRESO') throw new ErrorOperacion('Tipo inválido.');
    where.tipo = req.query.tipo;
  }
  return MovimientoStock.findAndCountAll({ where, order: [['fechaHora', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit });
});
export const configurarReposicion = (req: Request, res: Response) => ejecutar(res, async () => {
  const producto = await Producto.findByPk(id(req.params.productoId));
  if (!producto) throw new ErrorOperacion('Producto no encontrado.', 404);
  const b = objeto(req.body);
  return producto.update({ stockMinimo: numero(b.stockMinimo, 'stockMinimo', true), tipoReposicion: 'stockMinimo' });
});
