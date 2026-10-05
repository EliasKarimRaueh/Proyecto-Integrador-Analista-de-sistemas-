import { type Request, type Response } from 'express';
import { ErrorOperacion, vender, buscarProductos, id } from '../services/operaciones.js';
import VentaRepository from 'polleria-database/repositories/ventaRepository';
import { sendDatabaseError } from './controllerHelpers.js';
export async function ejecutar(res: Response, accion: () => Promise<unknown>, status = 200) {
  try { res.status(status).json(await accion()); }
  catch (error) {
    if (error instanceof ErrorOperacion) res.status(error.status).json({ message: error.message });
    else sendDatabaseError(res, error, 'No se pudo completar la operación.');
  }
}
export function paginacion(req: Request) {
  const page = id(req.query.page ?? 1, 'page'), limit = id(req.query.limite ?? 50, 'limite');
  if (limit > 1000) throw new ErrorOperacion('limite no puede superar 1000.');
  return { page, limit };
}
function fecha(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) throw new ErrorOperacion('Fecha inválida: utilice ISO 8601.');
  const calendario = new Date(value.slice(0, 10));
  if (Number.isNaN(calendario.getTime()) || calendario.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new ErrorOperacion('Fecha de calendario inválida.');
  return new Date(value);
}
export function rangoFechas(req: Request) {
  const desde = fecha(req.query.fechaDesde), hasta = fecha(req.query.fechaHasta);
  if (desde && hasta && desde > hasta) throw new ErrorOperacion('El rango de fechas es inválido.');
  return { desde, hasta };
}
const ventas = new VentaRepository();
export const crearVenta = (req: Request, res: Response) => ejecutar(res, () => vender(req.body), 201);
export const cotizarVenta = (req: Request, res: Response) => ejecutar(res, () => vender(req.body, true));
export const productosMostrador = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  if (req.query.q !== undefined && typeof req.query.q !== 'string') throw new ErrorOperacion('q debe ser texto.');
  return buscarProductos(String(req.query.q ?? '').trim(), page, limit);
});
export const historialVentas = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  return ventas.findAllVentas(page, limit, desde, hasta, true);
});
export const detalleVenta = (req: Request, res: Response) => ejecutar(res, async () => {
  const resultado = await ventas.findVentaConDetalles(id(req.params.id));
  if (!resultado.venta) throw new ErrorOperacion('Venta no encontrada.', 404);
  return resultado;
});
